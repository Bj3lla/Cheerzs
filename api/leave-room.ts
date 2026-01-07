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

  try {
    const ip = getClientIp(req);
    const rl = rateLimit({ key: `leave-room:${ip}`, limit: 60, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      res.setHeader("Retry-After", String(rl.retryAfterSec));
      return res.status(429).json({ error: "Too many requests", requestId });
    }

    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.ABLY_API_KEY
    ) {
      return res.status(500).json({ error: "Server misconfiguration", requestId });
    }

    const body = await safeJson(req);
    if (!body) {
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
    if (!playerId) {
      return res.status(400).json({ error: "Missing playerId", requestId });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const ably = await getAblyRest(process.env.ABLY_API_KEY);

    // Determine if the leaving user is the host. If the room doesn't exist, treat it as already closed.
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, host")
      .eq("id", normalizedRoomID)
      .single();

    const roomNotFound = roomError?.code === "PGRST116";
    const isHost = Boolean(room?.host) && room.host === normalizedUsername;

    if (roomNotFound) {
      return res.status(200).json({ ok: true, roomDeleted: true, requestId });
    }

    if (roomError) {
      console.error("[leave-room] room fetch failed", { requestId, roomError });
      return res.status(500).json({ error: roomError.message, requestId });
    }

    // Verify caller is a real player row.
    const { data: callerRow, error: callerError } = await supabase
      .from("players")
      .select("id")
      .eq("room_id", normalizedRoomID)
      .eq("username", normalizedUsername)
      .eq("id", playerId)
      .maybeSingle();

    if (callerError) {
      return res.status(500).json({ error: callerError.message, requestId });
    }
    if (!callerRow?.id) {
      return res.status(403).json({ error: "Not in room", requestId });
    }

    if (isHost) {
      const { error: deletePlayersError } = await supabase
        .from("players")
        .delete()
        .eq("room_id", normalizedRoomID);

      if (deletePlayersError) {
        console.error("[leave-room] delete players failed", { requestId, deletePlayersError });
        return res.status(500).json({ error: deletePlayersError.message, requestId });
      }

      // Remove game state before deleting the room (FK-safe and avoids state leaking if codes are reused).
      const { error: deleteStateError } = await supabase
        .from("room_game_state")
        .delete()
        .eq("room_id", normalizedRoomID);

      if (deleteStateError) {
        console.error("[leave-room] delete room_game_state failed", { requestId, deleteStateError });
        return res.status(500).json({ error: deleteStateError.message, requestId });
      }

      const { error: deleteRoomError } = await supabase
        .from("rooms")
        .delete()
        .eq("id", normalizedRoomID);

      if (deleteRoomError) {
        console.error("[leave-room] delete room failed", { requestId, deleteRoomError });
        return res.status(500).json({ error: deleteRoomError.message, requestId });
      }

      try {
        await ably.channels
          .get(`room-${normalizedRoomID}`)
          .publish("room-deleted", {
            roomID: normalizedRoomID,
            deletedBy: normalizedUsername,
            reason: "host-left",
            requestId,
          });
      } catch (ablyError) {
        console.error("[leave-room] ably publish room-deleted failed", { requestId, ablyError });
      }

      return res.status(200).json({ ok: true, roomDeleted: true, requestId });
    }

    let deleteQuery = supabase
      .from("players")
      .delete()
      .eq("room_id", normalizedRoomID)
      .eq("username", normalizedUsername);

    deleteQuery = deleteQuery.eq("id", playerId);

    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      console.error("[leave-room] delete failed", { requestId, deleteError });
      return res.status(500).json({ error: deleteError.message, requestId });
    }

    try {
      await ably.channels
        .get(`room-${normalizedRoomID}`)
        .publish("player-left", { username: normalizedUsername, roomID: normalizedRoomID, requestId });
    } catch (ablyError) {
      console.error("[leave-room] ably publish failed", { requestId, ablyError });
    }

    return res.status(200).json({ ok: true, roomDeleted: false, requestId });
  } catch (err) {
    console.error("[leave-room] crashed", { requestId, err });
    return res.status(500).json({ error: "Internal Server Error", requestId });
  }
}
