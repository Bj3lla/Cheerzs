import { createClient } from "@supabase/supabase-js";

const makeRequestId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const requestId = makeRequestId();

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Server misconfiguration", requestId });
    }

    const roomID = req.query?.roomID;
    if (!roomID || typeof roomID !== "string") {
      return res.status(400).json({ error: "Missing roomID", requestId });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, host")
      .eq("id", roomID)
      .single();

    if (roomError) {
      if (roomError.code === "PGRST116") {
        return res.status(404).json({ error: "Room not found", requestId });
      }
      return res.status(500).json({ error: roomError.message, requestId });
    }

    const { data: gameState, error: stateError } = await supabase
      .from("room_game_state")
      .select("room_id, seq, state, updated_at")
      .eq("room_id", roomID)
      .maybeSingle();

    if (stateError) {
      return res.status(500).json({ error: stateError.message, requestId });
    }

    return res.status(200).json({
      requestId,
      roomID,
      host: room.host,
      seq: gameState?.seq ?? 0,
      state: gameState?.state ?? null,
      updatedAt: gameState?.updated_at ?? null,
    });
  } catch (err) {
    console.error("[game-state] crashed", { requestId, err });
    return res.status(500).json({ error: "Internal Server Error", requestId });
  }
}
