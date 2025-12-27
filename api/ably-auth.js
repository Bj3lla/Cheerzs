import Ably from "ably";

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Check that the Ably API key exists
  if (!process.env.ABLY_API_KEY) {
    console.error("❌ ABLY_API_KEY is missing");
    return res.status(500).json({ error: "Ably API key not configured" });
  }

  try {
    // Create Ably REST client with server API key
    const client = new Ably.Rest({ key: process.env.ABLY_API_KEY });

    // Generate a token request for client-side authentication
    const tokenRequestData = await client.auth.createTokenRequest();

    res.setHeader("Content-Type", "application/json");
    res.status(200).json(tokenRequestData);
  } catch (err) {
    console.error("❌ Failed to create Ably token request:", err);
    res.status(500).json({ error: "Failed to create Ably token request" });
  }
}
