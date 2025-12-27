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
    const { data: existingRoom, error: fetchError } = await supabase
      .from("rooms")
      .select("id")
      .eq("id", roomID)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Supabase fetch error:", fetchError);
      return res.status(500).json({ error: fetchError.message });
    }

    if (existingRoom) {
      return res.status(409).json({ error: "Room already exists" });
    }

    // Create room
    const { error: roomError } = await supabase
      .from("rooms")
      .insert({ id: roomID, host: username });

    if (roomError) {
      console.error("Supabase room insert error:", roomError);
      return res.status(500).json({ error: roomError.message });
    }

    // Add host as first player
    const { error: playerError } = await supabase
      .from("players")
      .insert({ room_id: roomID, username });

    if (playerError) {
      console.error("Supabase player insert error:", playerError);
      return res.status(500).json({ error: playerError.message });
    }

    // Notify Ably
    await ably.channels.get(`room-${roomID}`).publish("room-created", { roomID, username });

    return res.status(200).json({ roomID, username });
  } catch (err) {
    console.error("❌ create-room.js crashed:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
