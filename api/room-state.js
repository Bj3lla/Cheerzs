import { createClient } from "@supabase/supabase-js";

const makeRequestId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const requestId = makeRequestId();

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[room-state] missing env", {
        requestId,
        hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
        hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      });
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

    // Remove inactive players (tracked via joined_at heartbeat)
    const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const { error: cleanupError } = await supabase
      .from("players")
      .delete()
      .eq("room_id", roomID)
      .lt("joined_at", cutoff);

    if (cleanupError) {
      console.error("[room-state] cleanup failed", { requestId, cleanupError });
    }

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, host, created_at")
      .eq("id", roomID)
      .single();

    if (roomError) {
      if (roomError.code === "PGRST116") {
        return res.status(404).json({ error: "Room not found", requestId });
      }
      console.error("[room-state] room fetch failed", { requestId, roomError });
      return res.status(500).json({ error: roomError.message, requestId });
    }

    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("username, joined_at")
      .eq("room_id", roomID)
      .order("joined_at", { ascending: true });

    if (playersError) {
      console.error("[room-state] players fetch failed", { requestId, playersError });
      return res.status(500).json({ error: playersError.message, requestId });
    }

    return res.status(200).json({
      requestId,
      roomID: room.id,
      host: room.host,
      createdAt: room.created_at,
      players: (players || []).map((p) => p.username),
    });
  } catch (err) {
    console.error("[room-state] crashed", { requestId, err });
    return res.status(500).json({ error: "Internal Server Error", requestId });
  }
}
