import { createClient } from "@supabase/supabase-js";
import { validateRoomId } from "./_lib/security.js";

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

    const roomIdCheck = validateRoomId(req.query?.roomID);
    if (!roomIdCheck.ok) {
      return res.status(400).json({ error: roomIdCheck.error, requestId });
    }

    const roomID = roomIdCheck.value;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Remove inactive players (tracked via joined_at heartbeat)
    const cutoff = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
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

    // Remove expired rooms ONLY when BOTH are true:
    // 1) rooms.created_at is older than 1 hours
    // 2) room_game_state.updated_at is older than 1 hours
    const roomCutoff = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

    const { data: gameStateRow, error: gameStateError } = await supabase
      .from("room_game_state")
      .select("updated_at")
      .eq("room_id", roomID)
      .maybeSingle();

    if (gameStateError) {
      console.error("[room-state] room_game_state fetch failed", { requestId, gameStateError });
      return res.status(500).json({ error: gameStateError.message, requestId });
    }

    const stateUpdatedAt = gameStateRow?.updated_at || room?.created_at;
    const roomExpired =
      Boolean(room?.created_at) &&
      Boolean(stateUpdatedAt) &&
      room.created_at < roomCutoff &&
      stateUpdatedAt < roomCutoff;

    if (roomExpired) {
      const { error: deletePlayersError } = await supabase
        .from("players")
        .delete()
        .eq("room_id", roomID);

      if (deletePlayersError) {
        console.error("[room-state] expired cleanup players failed", { requestId, deletePlayersError });
        return res.status(500).json({ error: deletePlayersError.message, requestId });
      }

      const { error: deleteStateError } = await supabase
        .from("room_game_state")
        .delete()
        .eq("room_id", roomID);

      if (deleteStateError) {
        console.error("[room-state] expired cleanup room_game_state failed", { requestId, deleteStateError });
        return res.status(500).json({ error: deleteStateError.message, requestId });
      }

      const { error: deleteRoomError } = await supabase
        .from("rooms")
        .delete()
        .eq("id", roomID);

      if (deleteRoomError) {
        console.error("[room-state] expired cleanup room failed", { requestId, deleteRoomError });
        return res.status(500).json({ error: deleteRoomError.message, requestId });
      }

      return res.status(404).json({ error: "Room not found", requestId });
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
