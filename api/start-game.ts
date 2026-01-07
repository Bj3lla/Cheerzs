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
    const rl = rateLimit({ key: `start-game:${ip}`, limit: 30, windowMs: 60 * 1000 });
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

    // Verify caller is the same player row as the host (prevents host-username spoofing).
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
      return res.status(403).json({ error: "Only the host can start the game", requestId });
    }

    // Mark game as started and reset any previous state.
    // This also enables mid-game joiners to skip the waiting room.
    const startedAt = new Date().toISOString();
    const { error: upsertError } = await supabase
      .from("room_game_state")
      .upsert(
        {
          room_id: normalizedRoomID,
          seq: 0,
          state: { started: true, startedAt, card: null, activeRules: [] },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "room_id" }
      );

    if (upsertError) {
      console.error("[start-game] init game state failed", { requestId, upsertError });
      return res.status(500).json({ error: upsertError.message, requestId });
    }

    const ably = await getAblyRest(process.env.ABLY_API_KEY);

    await ably.channels
      .get(`room-${normalizedRoomID}`)
      .publish("game-started", { roomID: normalizedRoomID, startedBy: normalizedUsername, requestId });

    return res.status(200).json({ ok: true, requestId });
  } catch (err) {
    console.error("[start-game] crashed", { requestId, err });
    return res.status(500).json({ error: "Internal Server Error", requestId });
  }
}
