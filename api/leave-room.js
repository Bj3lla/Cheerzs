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

    return res.status(200).json({ ok: true, requestId });
  } catch (err) {
    console.error("[leave-room] crashed", { requestId, err });
    return res.status(500).json({ error: "Internal Server Error", requestId });
  }
}
