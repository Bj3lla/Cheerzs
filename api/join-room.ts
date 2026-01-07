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
  console.log("[join-room] start", { requestId, method: req.method, contentType: req.headers?.["content-type"] });

  try {
    const ip = getClientIp(req);
    const rl = rateLimit({ key: `join-room:${ip}`, limit: 15, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      res.setHeader("Retry-After", String(rl.retryAfterSec));
      return res.status(429).json({ error: "Too many requests", requestId });
    }

    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.ABLY_API_KEY
    ) {
      console.error("[join-room] missing env", {
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
      console.error("[join-room] invalid JSON body", { requestId, bodyType: typeof req.body });
      return res.status(400).json({ error: "Invalid JSON body", requestId });
    }

    const { roomID, username, playerId: rawPlayerId } = body;

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

    const playerId = typeof rawPlayerId === "string" ? rawPlayerId.trim() : "";

    console.log("[join-room] payload", {
      requestId,
      roomID: normalizedRoomID,
      username: normalizedUsername,
    });

    // Check if room exists
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", normalizedRoomID)
      .single();

    if (roomError) {
      if (roomError.code === "PGRST116") {
        return res.status(404).json({ error: "Room not found", requestId });
      }
      console.error("[join-room] supabase room fetch error", { requestId, roomError });
      return res.status(500).json({ error: roomError.message, requestId });
    }

    // Treat rooms as expired ONLY when BOTH are true:
    // 1) rooms.created_at is older than 1 hours
    // 2) room_game_state.updated_at is older than 1 hours
    const cutoffIso = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

    const { data: gameStateRow, error: gameStateError } = await supabase
      .from("room_game_state")
      .select("updated_at")
      .eq("room_id", normalizedRoomID)
      .maybeSingle();

    if (gameStateError) {
      console.error("[join-room] room_game_state fetch failed", { requestId, gameStateError });
      return res.status(500).json({ error: gameStateError.message, requestId });
    }

    const stateUpdatedAt = gameStateRow?.updated_at || room?.created_at;

    const isExpired =
      Boolean(room?.created_at) &&
      Boolean(stateUpdatedAt) &&
      room.created_at < cutoffIso &&
      stateUpdatedAt < cutoffIso;
    if (isExpired) {
      const { error: deletePlayersError } = await supabase
        .from("players")
        .delete()
        .eq("room_id", normalizedRoomID);

      if (deletePlayersError) {
        console.error("[join-room] expired cleanup players failed", { requestId, deletePlayersError });
        return res.status(500).json({ error: deletePlayersError.message, requestId });
      }

      const { error: deleteStateError } = await supabase
        .from("room_game_state")
        .delete()
        .eq("room_id", normalizedRoomID);

      if (deleteStateError) {
        console.error("[join-room] expired cleanup room_game_state failed", { requestId, deleteStateError });
        return res.status(500).json({ error: deleteStateError.message, requestId });
      }

      const { error: deleteRoomError } = await supabase
        .from("rooms")
        .delete()
        .eq("id", normalizedRoomID);

      if (deleteRoomError) {
        console.error("[join-room] expired cleanup room failed", { requestId, deleteRoomError });
        return res.status(500).json({ error: deleteRoomError.message, requestId });
      }

      return res.status(404).json({ error: "Room not found", requestId });
    }

    // Idempotent join: if already in the room, do not insert a duplicate.
    const { data: existingPlayer, error: existingPlayerError } = await supabase
      .from("players")
      .select("id")
      .eq("room_id", normalizedRoomID)
      .eq("username", normalizedUsername)
      .maybeSingle();

    if (existingPlayerError) {
      console.error("[join-room] existing player check failed", { requestId, existingPlayerError });
      return res.status(500).json({ error: existingPlayerError.message, requestId });
    }

    if (existingPlayer?.id) {
      // If username is already present in the room, only allow if it is the same player
      // (identified by username + playerId).
      const samePlayer = Boolean(playerId) && existingPlayer.id === playerId;

      if (!samePlayer) {
        return res.status(409).json({
          error: "The username is already taken",
          code: "USERNAME_TAKEN",
          requestId,
        });
      }

      const { data: gameState } = await supabase
        .from("room_game_state")
        .select("state")
        .eq("room_id", normalizedRoomID)
        .maybeSingle();

      const gameStarted = Boolean(gameState?.state?.started);
      return res.status(200).json({
        success: true,
        roomID: normalizedRoomID,
        username: normalizedUsername,
        playerId: existingPlayer?.id || playerId,
        gameStarted,
        startedAt: gameState?.state?.startedAt || null,
        requestId,
      });
    }

    // Add player
    const { data: insertedPlayer, error: playerError } = await supabase
      .from("players")
      .insert({ room_id: normalizedRoomID, username: normalizedUsername })
      .select("id")
      .single();

    if (playerError) {
      console.error("[join-room] supabase player insert error", { requestId, playerError });
      return res.status(500).json({ error: playerError.message, requestId });
    }

    // Notify Ably
    try {
      await ably.channels
        .get(`room-${normalizedRoomID}`)
        .publish("player-joined", { username: normalizedUsername, roomID: normalizedRoomID, requestId });
    } catch (ablyError) {
      console.error("[join-room] ably publish failed", { requestId, ablyError });
      // Not fatal for join
    }

    console.log("[join-room] success", { requestId, roomID: normalizedRoomID, username: normalizedUsername, host: room?.host });

    const { data: gameState } = await supabase
      .from("room_game_state")
      .select("state")
      .eq("room_id", normalizedRoomID)
      .maybeSingle();

    const gameStarted = Boolean(gameState?.state?.started);
    return res.status(200).json({
      success: true,
      roomID: normalizedRoomID,
      username: normalizedUsername,
      playerId: insertedPlayer?.id || "",
      gameStarted,
      startedAt: gameState?.state?.startedAt || null,
      requestId,
    });
  } catch (err) {
    console.error("[join-room] crashed", { requestId, err });
    return res.status(500).json({ error: "Internal Server Error", requestId });
  }
}
