import { createClient } from "@supabase/supabase-js";
import { getAblyRest } from "./_lib/ably.js";
import { getClientIp, rateLimit, validateRoomId, validateUsername } from "./_lib/security.js";

const makeRequestId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const safeJson = async (req) => {
  if (req?.body == null) return null;
  if (typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return null;
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const requestId = makeRequestId();
  console.log("[create-room] start", { requestId, method: req.method, contentType: req.headers?.["content-type"] });

  try {
    const ip = getClientIp(req);
    const rl = rateLimit({ key: `create-room:${ip}`, limit: 6, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      res.setHeader("Retry-After", String(rl.retryAfterSec));
      return res.status(429).json({ error: "Too many requests", requestId });
    }

    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.ABLY_API_KEY
    ) {
      console.error("[create-room] missing env", {
        requestId,
        hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
        hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        hasAblyKey: Boolean(process.env.ABLY_API_KEY),
      });
      return res.status(500).json({ error: "Server misconfiguration", requestId });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const ably = await getAblyRest(process.env.ABLY_API_KEY);

    const body = await safeJson(req);
    if (!body) {
      console.error("[create-room] invalid JSON body", { requestId, bodyType: typeof req.body });
      return res.status(400).json({ error: "Invalid JSON body", requestId });
    }

    const { roomID, username } = body;

    const roomIdCheck = validateRoomId(roomID);
    if (!roomIdCheck.ok) {
      return res.status(400).json({ error: roomIdCheck.error, requestId });
    }

    const usernameCheck = validateUsername(username);
    if (!usernameCheck.ok) {
      return res.status(400).json({ error: usernameCheck.error, requestId });
    }

    const normalizedRoomID = roomIdCheck.value;
    const normalizedUsername = usernameCheck.value;

    console.log("[create-room] payload", {
      requestId,
      roomID: typeof roomID === "string" ? roomID : null,
      username: typeof username === "string" ? username : null,
    });

    if (!normalizedRoomID || !normalizedUsername) {
      return res.status(400).json({ error: "Missing roomID or username", requestId });
    }

    // Check if room exists
    const { data: existingRoom, error: fetchError } = await supabase
      .from("rooms")
      .select("id, created_at")
      .eq("id", normalizedRoomID)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("[create-room] supabase fetch error", { requestId, fetchError });
      return res.status(500).json({ error: fetchError.message, requestId });
    }

    if (existingRoom) {
      const cutoffIso = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      const { data: gameStateRow, error: gameStateError } = await supabase
        .from("room_game_state")
        .select("updated_at")
        .eq("room_id", normalizedRoomID)
        .maybeSingle();

      if (gameStateError) {
        console.error("[create-room] room_game_state fetch failed", { requestId, gameStateError });
        return res.status(500).json({ error: gameStateError.message, requestId });
      }

      const stateUpdatedAt = gameStateRow?.updated_at || existingRoom.created_at;

      const isExpired =
        Boolean(existingRoom.created_at) &&
        Boolean(stateUpdatedAt) &&
        existingRoom.created_at < cutoffIso &&
        stateUpdatedAt < cutoffIso;

      if (!isExpired) {
        return res.status(409).json({ error: "Room already exists", requestId });
      }

      // Expired room: delete it (and any players) so the ID can be reused.
      const { error: deletePlayersError } = await supabase
        .from("players")
        .delete()
        .eq("room_id", normalizedRoomID);

      if (deletePlayersError) {
        console.error("[create-room] expired cleanup players failed", { requestId, deletePlayersError });
        return res.status(500).json({ error: deletePlayersError.message, requestId });
      }

      const { error: deleteStateError } = await supabase
        .from("room_game_state")
        .delete()
        .eq("room_id", normalizedRoomID);

      if (deleteStateError) {
        console.error("[create-room] expired cleanup room_game_state failed", { requestId, deleteStateError });
        return res.status(500).json({ error: deleteStateError.message, requestId });
      }

      const { error: deleteRoomError } = await supabase
        .from("rooms")
        .delete()
        .eq("id", normalizedRoomID);

      if (deleteRoomError) {
        console.error("[create-room] expired cleanup room failed", { requestId, deleteRoomError });
        return res.status(500).json({ error: deleteRoomError.message, requestId });
      }
    }

    // Create room
    const { error: roomError } = await supabase
      .from("rooms")
      .insert({ id: normalizedRoomID, host: normalizedUsername });

    if (roomError) {
      console.error("[create-room] supabase room insert error", { requestId, roomError });
      return res.status(500).json({ error: roomError.message, requestId });
    }

    // Add host as first player
    const { data: insertedPlayer, error: playerError } = await supabase
      .from("players")
      .insert({ room_id: normalizedRoomID, username: normalizedUsername })
      .select("id")
      .single();

    if (playerError) {
      console.error("[create-room] supabase player insert error", { requestId, playerError });
      return res.status(500).json({ error: playerError.message, requestId });
    }

    // Initialize a fresh game state for this room.
    // Keeps rooms isolated even if an old room_game_state row existed for this code.
    const { error: initStateError } = await supabase
      .from("room_game_state")
      .upsert(
        {
          room_id: normalizedRoomID,
          seq: 0,
          state: { started: false, card: null, activeRules: [] },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "room_id" }
      );

    if (initStateError) {
      console.error("[create-room] init game state failed", { requestId, initStateError });
      return res.status(500).json({ error: initStateError.message, requestId });
    }

    // Notify Ably
    try {
      await ably.channels
        .get(`room-${normalizedRoomID}`)
        .publish("room-created", { roomID: normalizedRoomID, username: normalizedUsername, requestId });
    } catch (ablyError) {
      console.error("[create-room] ably publish failed", { requestId, ablyError });
      // Not fatal for room creation; client can still proceed.
    }

    console.log("[create-room] success", { requestId, roomID: normalizedRoomID, username: normalizedUsername });
    return res.status(200).json({
      roomID: normalizedRoomID,
      username: normalizedUsername,
      playerId: insertedPlayer?.id || "",
      requestId,
    });
  } catch (err) {
    console.error("[create-room] crashed", { requestId, err });
    return res.status(500).json({ error: "Internal Server Error", requestId });
  }
}
