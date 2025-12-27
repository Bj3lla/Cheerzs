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

    const { roomID, username, targetUsername } = body;
    if (!roomID || !username || !targetUsername) {
      return res.status(400).json({ error: "Missing roomID, username, or targetUsername", requestId });
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

    if (room.host !== username) {
      return res.status(403).json({ error: "Only the host can remove players", requestId });
    }

    if (targetUsername === room.host) {
      return res.status(400).json({ error: "Host cannot be removed", requestId });
    }

    const { error: deleteError } = await supabase
      .from("players")
      .delete()
      .eq("room_id", roomID)
      .eq("username", targetUsername);

    if (deleteError) {
      console.error("[remove-player] delete failed", { requestId, deleteError });
      return res.status(500).json({ error: deleteError.message, requestId });
    }

    const ably = new Ably.Rest({ key: process.env.ABLY_API_KEY });

    try {
      await ably.channels
        .get(`room-${roomID}`)
        .publish("player-removed", {
          roomID,
          removedUsername: targetUsername,
          removedBy: username,
          requestId,
        });

      // Also publish a generic "left" event so older clients refresh.
      await ably.channels
        .get(`room-${roomID}`)
        .publish("player-left", {
          roomID,
          username: targetUsername,
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
