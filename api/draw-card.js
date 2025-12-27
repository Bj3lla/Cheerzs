import { createClient } from "@supabase/supabase-js";
import Ably from "ably";

const makeRequestId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

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

const isPlainObject = (v) =>
  v != null && typeof v === "object" && !Array.isArray(v);

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

    const { roomID, username, state } = body;
    if (!roomID || !username) {
      return res.status(400).json({ error: "Missing roomID or username", requestId });
    }

    if (!isPlainObject(state)) {
      return res.status(400).json({ error: "Missing state", requestId });
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
      return res.status(403).json({ error: "Only the host can draw cards", requestId });
    }

    const { data: existingState, error: existingError } = await supabase
      .from("room_game_state")
      .select("seq")
      .eq("room_id", roomID)
      .maybeSingle();

    if (existingError) {
      return res.status(500).json({ error: existingError.message, requestId });
    }

    const nextSeq = (existingState?.seq ?? 0) + 1;

    const { error: upsertError } = await supabase
      .from("room_game_state")
      .upsert(
        {
          room_id: roomID,
          seq: nextSeq,
          state,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "room_id" }
      );

    if (upsertError) {
      return res.status(500).json({ error: upsertError.message, requestId });
    }

    const ably = new Ably.Rest({ key: process.env.ABLY_API_KEY });
    try {
      await ably.channels
        .get(`room-${roomID}`)
        .publish("card-updated", {
          roomID,
          seq: nextSeq,
          requestId,
          updatedBy: username,
        });
    } catch (ablyError) {
      console.error("[draw-card] ably publish failed", { requestId, ablyError });
    }

    return res.status(200).json({ ok: true, roomID, seq: nextSeq, requestId });
  } catch (err) {
    console.error("[draw-card] crashed", { requestId, err });
    return res.status(500).json({ error: "Internal Server Error", requestId });
  }
}
