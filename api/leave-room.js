import { createClient } from "@supabase/supabase-js";
import Ably from "ably";

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

    const { roomID, username } = body;
    if (!roomID || !username) {
      return res.status(400).json({ error: "Missing roomID or username", requestId });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const ably = new Ably.Rest({ key: process.env.ABLY_API_KEY });

    // Determine if the leaving user is the host. If the room doesn't exist, treat it as already closed.
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, host")
      .eq("id", roomID)
      .single();

    const roomNotFound = roomError?.code === "PGRST116";
    const isHost = Boolean(room?.host) && room.host === username;

    if (roomNotFound) {
      return res.status(200).json({ ok: true, roomDeleted: true, requestId });
    }

    if (roomError) {
      console.error("[leave-room] room fetch failed", { requestId, roomError });
      return res.status(500).json({ error: roomError.message, requestId });
    }

    if (isHost) {
      const { error: deletePlayersError } = await supabase
        .from("players")
        .delete()
        .eq("room_id", roomID);

      if (deletePlayersError) {
        console.error("[leave-room] delete players failed", { requestId, deletePlayersError });
        return res.status(500).json({ error: deletePlayersError.message, requestId });
      }

      const { error: deleteRoomError } = await supabase
        .from("rooms")
        .delete()
        .eq("id", roomID);

      if (deleteRoomError) {
        console.error("[leave-room] delete room failed", { requestId, deleteRoomError });
        return res.status(500).json({ error: deleteRoomError.message, requestId });
      }

      try {
        await ably.channels
          .get(`room-${roomID}`)
          .publish("room-deleted", {
            roomID,
            deletedBy: username,
            reason: "host-left",
            requestId,
          });
      } catch (ablyError) {
        console.error("[leave-room] ably publish room-deleted failed", { requestId, ablyError });
      }

      return res.status(200).json({ ok: true, roomDeleted: true, requestId });
    }

    const { error: deleteError } = await supabase
      .from("players")
      .delete()
      .eq("room_id", roomID)
      .eq("username", username);

    if (deleteError) {
      console.error("[leave-room] delete failed", { requestId, deleteError });
      return res.status(500).json({ error: deleteError.message, requestId });
    }

    try {
      await ably.channels
        .get(`room-${roomID}`)
        .publish("player-left", { username, roomID, requestId });
    } catch (ablyError) {
      console.error("[leave-room] ably publish failed", { requestId, ablyError });
    }

    return res.status(200).json({ ok: true, roomDeleted: false, requestId });
  } catch (err) {
    console.error("[leave-room] crashed", { requestId, err });
    return res.status(500).json({ error: "Internal Server Error", requestId });
  }
}
