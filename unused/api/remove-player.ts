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
    const rl = rateLimit({ key: `remove-player:${ip}`, limit: 60, windowMs: 60 * 1000 });
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

    const { roomID, username, targetUsername, playerId: rawPlayerId } = body;

    const roomIdCheck = validateRoomId(roomID);
    if (!roomIdCheck.ok) {
      return res.status(400).json({ error: roomIdCheck.error, requestId });
    }

    const usernameCheck = validateUsername(username);
    if (!usernameCheck.ok) {
      return res.status(400).json({ error: usernameCheck.error, requestId });
    }

    const targetCheck = validateUsername(targetUsername);
    if (!targetCheck.ok) {
      return res.status(400).json({ error: targetCheck.error, requestId });
    }

    const normalizedRoomID = roomIdCheck.value;
    const normalizedUsername = usernameCheck.value;
    const normalizedTargetUsername = targetCheck.value;

    const playerId = typeof rawPlayerId === "string" ? rawPlayerId.trim() : "";
    if (!playerId) {
      return res.status(400).json({ error: "Missing playerId", requestId });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

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

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, host")
      .eq("id", normalizedRoomID)
      .single();

    if (roomError) {
      if (roomError.code === "PGRST116") {
        return res.status(404).json({ error: "Room not found", requestId });
      }
      return res.status(500).json({ error: roomError.message, requestId });
    }

    if (room.host !== normalizedUsername) {
      return res.status(403).json({ error: "Only the host can remove players", requestId });
    }

    if (normalizedTargetUsername === room.host) {
      return res.status(400).json({ error: "Host cannot be removed", requestId });
    }

    const { data: deletedPlayers, error: deleteError } = await supabase
      .from("players")
      .delete()
      .eq("room_id", normalizedRoomID)
      .eq("username", normalizedTargetUsername)
      .select("id");

    if (deleteError) {
      console.error("[remove-player] delete failed", { requestId, deleteError });
      return res.status(500).json({ error: deleteError.message, requestId });
    }

    if (!deletedPlayers || deletedPlayers.length === 0) {
      return res.status(404).json({ error: "Player not found in room", requestId });
    }

    const ably = await getAblyRest(process.env.ABLY_API_KEY);

    try {
      await ably.channels
        .get(`room-${normalizedRoomID}`)
        .publish("player-removed", {
          roomID: normalizedRoomID,
          removedUsername: normalizedTargetUsername,
          removedBy: normalizedUsername,
          requestId,
        });

      // Also publish a generic "left" event so older clients refresh.
      await ably.channels
        .get(`room-${normalizedRoomID}`)
        .publish("player-left", {
          roomID: normalizedRoomID,
          username: normalizedTargetUsername,
          reason: "removed",
          requestId,
        });
    } catch (ablyError) {
      console.error("[remove-player] ably publish failed", { requestId, ablyError });
    }

    return res.status(200).json({ ok: true, requestId });
  } catch (err) {
    console.error("[remove-player] crashed", { requestId, err });
    return res.status(500).json({ error: "Internal Server Error", requestId });
  }
}
