import { createClient } from "@supabase/supabase-js";
import Ably from "ably";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.ABLY_API_KEY
    ) {
      console.error("❌ Missing environment variables");
      return res.status(500).json({ error: "Server misconfiguration" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const ably = new Ably.Rest({ key: process.env.ABLY_API_KEY });

    const { roomID, username } = req.body;
    if (!roomID || !username) {
      return res.status(400).json({ error: "Missing roomID or username" });
    }

    // Check if room exists
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomID)
      .single();

    if (roomError) {
      if (roomError.code === "PGRST116") return res.status(404).json({ error: "Room not found" });
      console.error("Supabase error:", roomError);
      return res.status(500).json({ error: roomError.message });
    }

    // Add player
    const { error: playerError } = await supabase
      .from("players")
      .insert({ room_id: roomID, username });

    if (playerError) {
      console.error("Supabase player insert error:", playerError);
      return res.status(500).json({ error: playerError.message });
    }

    // Notify Ably
    await ably.channels.get(`room-${roomID}`).publish("player-joined", { username });

    return res.status(200).json({ success: true, roomID, username });
  } catch (err) {
    console.error("❌ join-room.js crashed:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
