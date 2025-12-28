import { createClient } from "@supabase/supabase-js";
import { validateRoomId, validateUsername } from "./_lib/security.js";

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

    const { roomID, username, playerCreatedAt: rawPlayerCreatedAt } = body;

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

    const playerCreatedAt =
      typeof rawPlayerCreatedAt === "string" && !Number.isNaN(Date.parse(rawPlayerCreatedAt))
        ? rawPlayerCreatedAt
        : "";

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // If room does not exist (or was deleted), return 404 instead of failing FK constraint.
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id")
      .eq("id", normalizedRoomID)
      .single();

    if (roomError) {
      if (roomError.code === "PGRST116") {
        return res.status(404).json({ error: "Room not found", requestId });
      }
      console.error("[heartbeat] room check failed", { requestId, roomError });
      return res.status(500).json({ error: roomError.message, requestId });
    }

    const now = new Date().toISOString();

    let updateQuery = supabase
      .from("players")
      .update({ joined_at: now })
      .eq("room_id", normalizedRoomID)
      .eq("username", normalizedUsername);

    if (playerCreatedAt) {
      updateQuery = updateQuery.eq("created_at", playerCreatedAt);
    }

    const { data: updated, error: updateError } = await updateQuery.select("id");

    if (updateError) {
      console.error("[heartbeat] update failed", { requestId, updateError });
      return res.status(500).json({ error: updateError.message, requestId });
    }

    if (!updated || updated.length === 0) {
      // If the client provided a created_at but we couldn't update, do NOT insert a new row.
      // This prevents accidentally creating duplicates or bypassing "username taken".
      if (playerCreatedAt) {
        return res.status(404).json({ error: "Player not found", requestId });
      }

      // Backward-compatible fallback: only insert if username is not already present in the room.
      const { data: existing, error: existingError } = await supabase
        .from("players")
        .select("id")
        .eq("room_id", normalizedRoomID)
        .eq("username", normalizedUsername)
        .maybeSingle();

      if (existingError) {
        console.error("[heartbeat] existing check failed", { requestId, existingError });
        return res.status(500).json({ error: existingError.message, requestId });
      }

      if (!existing?.id) {
        const { error: insertError } = await supabase
          .from("players")
          .insert({ room_id: normalizedRoomID, username: normalizedUsername, joined_at: now });

        if (insertError) {
          console.error("[heartbeat] insert failed", { requestId, insertError });
          return res.status(500).json({ error: insertError.message, requestId });
        }
      }
    }

    return res.status(200).json({ ok: true, requestId });
  } catch (err) {
    console.error("[heartbeat] crashed", { requestId, err });
    return res.status(500).json({ error: "Internal Server Error", requestId });
  }
}
