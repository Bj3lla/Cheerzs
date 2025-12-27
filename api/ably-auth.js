import Ably from "ably";
import { createClient } from "@supabase/supabase-js";
import { getClientIp, rateLimit, validateRoomId, validateUsername } from "./_lib/security";

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = getClientIp(req);
  const rl = rateLimit({ key: `ably-auth:${ip}`, limit: 60, windowMs: 60 * 1000 });
  if (!rl.allowed) {
    res.setHeader("Retry-After", String(rl.retryAfterSec));
    return res.status(429).json({ error: "Too many requests" });
  }

  // Check that the Ably API key exists
  if (!process.env.ABLY_API_KEY) {
    console.error("❌ ABLY_API_KEY is missing");
    return res.status(500).json({ error: "Ably API key not configured" });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  const roomIdCheck = validateRoomId(req.query?.roomID);
  if (!roomIdCheck.ok) {
    return res.status(400).json({ error: roomIdCheck.error });
  }

  const usernameCheck = validateUsername(req.query?.username);
  if (!usernameCheck.ok) {
    return res.status(400).json({ error: usernameCheck.error });
  }

  const roomID = roomIdCheck.value;
  const username = usernameCheck.value;

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Verify the room exists
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id")
      .eq("id", roomID)
      .single();

    if (roomError) {
      if (roomError.code === "PGRST116") {
        return res.status(404).json({ error: "Room not found" });
      }
      return res.status(500).json({ error: roomError.message });
    }

    // Verify the user is in the room
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id")
      .eq("room_id", roomID)
      .eq("username", username)
      .maybeSingle();

    if (playerError) {
      return res.status(500).json({ error: playerError.message });
    }

    if (!player?.id) {
      return res.status(403).json({ error: "Not in room" });
    }

    // Create Ably REST client with server API key
    const client = new Ably.Rest({ key: process.env.ABLY_API_KEY });

    // Generate a token request for client-side authentication
    const tokenRequestData = await client.auth.createTokenRequest({
      clientId: `room:${roomID}:${username}`,
      // Subscribe-only to the specific room channel.
      capability: {
        [`room-${roomID}`]: ["subscribe"],
      },
      // Short-lived tokens reduce abuse if stolen.
      ttl: 15 * 60 * 1000,
    });

    res.setHeader("Content-Type", "application/json");
    res.status(200).json(tokenRequestData);
  } catch (err) {
    console.error("❌ Failed to create Ably token request:", err);
    res.status(500).json({ error: "Failed to create Ably token request" });
  }
}
