import { createClient } from "@supabase/supabase-js";

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
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
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

    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("players")
      .update({ joined_at: now })
      .eq("room_id", roomID)
      .eq("username", username)
      .select("id");

    if (updateError) {
      console.error("[heartbeat] update failed", { requestId, updateError });
      return res.status(500).json({ error: updateError.message, requestId });
    }

    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabase
        .from("players")
        .insert({ room_id: roomID, username, joined_at: now });

      if (insertError) {
        console.error("[heartbeat] insert failed", { requestId, insertError });
        return res.status(500).json({ error: insertError.message, requestId });
      }
    }

    return res.status(200).json({ ok: true, requestId });
  } catch (err) {
    console.error("[heartbeat] crashed", { requestId, err });
    return res.status(500).json({ error: "Internal Server Error", requestId });
  }
}
