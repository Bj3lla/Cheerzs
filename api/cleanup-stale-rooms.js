import { createClient } from "@supabase/supabase-js";
import Ably from "ably";

const makeRequestId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const getBearerToken = (req) => {
  const header = req?.headers?.authorization;
  if (!header || typeof header !== "string") return "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
};

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).end();
  }

  const requestId = makeRequestId();

  try {
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
    if (!cronSecret) {
      return res
        .status(500)
        .json({ error: "Server misconfiguration", requestId, missing: "CRON_SECRET" });
    }

    const provided = getBearerToken(req) || (req.query?.secret ? String(req.query.secret) : "");
    if (provided !== cronSecret) {
      return res.status(401).json({ error: "Unauthorized", requestId });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Server misconfiguration", requestId });
    }

    const cutoffMs = 2 * 60 * 60 * 1000;
    const cutoffIso = new Date(Date.now() - cutoffMs).toISOString();

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: staleRows, error: staleError } = await supabase
      .from("room_game_state")
      .select("room_id, updated_at")
      .lt("updated_at", cutoffIso)
      .limit(1000);

    if (staleError) {
      return res.status(500).json({ error: staleError.message, requestId });
    }

    const candidateRoomIDs = (Array.isArray(staleRows) ? staleRows : [])
      .map((r) => r?.room_id)
      .filter((id) => typeof id === "string" && id.trim().length > 0);

    const uniqueCandidateRoomIDs = Array.from(new Set(candidateRoomIDs));

    if (uniqueCandidateRoomIDs.length === 0) {
      return res.status(200).json({ ok: true, requestId, deletedRooms: 0 });
    }

    // Only delete rooms that were created more than 2 hours ago as well.
    const { data: oldRooms, error: roomsFetchError } = await supabase
      .from("rooms")
      .select("id, created_at")
      .in("id", uniqueCandidateRoomIDs)
      .lt("created_at", cutoffIso)
      .limit(1000);

    if (roomsFetchError) {
      return res.status(500).json({ error: roomsFetchError.message, requestId });
    }

    const roomIDs = (Array.isArray(oldRooms) ? oldRooms : [])
      .map((r) => r?.id)
      .filter((id) => typeof id === "string" && id.trim().length > 0);

    if (roomIDs.length === 0) {
      return res.status(200).json({ ok: true, requestId, deletedRooms: 0 });
    }

    const { error: playersDeleteError } = await supabase
      .from("players")
      .delete()
      .in("room_id", roomIDs);

    if (playersDeleteError) {
      return res.status(500).json({ error: playersDeleteError.message, requestId });
    }

    const { error: stateDeleteError } = await supabase
      .from("room_game_state")
      .delete()
      .in("room_id", roomIDs);

    if (stateDeleteError) {
      return res.status(500).json({ error: stateDeleteError.message, requestId });
    }

    const { error: roomsDeleteError } = await supabase.from("rooms").delete().in("id", roomIDs);

    if (roomsDeleteError) {
      return res.status(500).json({ error: roomsDeleteError.message, requestId });
    }

    // Best-effort notify connected clients.
    if (process.env.ABLY_API_KEY) {
      const ably = new Ably.Rest({ key: process.env.ABLY_API_KEY });
      for (const roomID of roomIDs) {
        try {
          // Same event name used elsewhere for consistency.
          // Reason is "stale" so clients can show a helpful message later if desired.
          await ably.channels.get(`room-${roomID}`).publish("room-deleted", {
            roomID,
            reason: "stale",
            requestId,
          });
        } catch {
          // ignore
        }
      }
    }

    return res.status(200).json({ ok: true, requestId, deletedRooms: roomIDs.length, roomIDs });
  } catch (err) {
    console.error("[cleanup-stale-rooms] crashed", { requestId, err });
    return res.status(500).json({ error: "Internal Server Error", requestId });
  }
}
