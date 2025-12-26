import Ably from "ably";

export default async function handler(req, res) {
  try {
    const client = new Ably.Rest({ key: process.env.ABLY_API_KEY });
    const tokenRequestData = await client.auth.createTokenRequest();
    res.setHeader("Content-Type", "application/json"); // explicit
    res.status(200).json(tokenRequestData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create Ably token request" });
  }
}
