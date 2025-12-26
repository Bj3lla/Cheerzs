import { useState } from "react";

export default function JoinRoom({ onRoomJoined }) {
  const [username, setUsername] = useState("");
  const [roomID, setRoomID] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async () => {
    if (!username || !roomID) {
      setError("Please enter your name and room ID");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/join-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, roomID }),
      });
      const data = await res.json();
      if (res.ok) {
        onRoomJoined(roomID);
      } else {
        setError(data.error || "Failed to join room");
      }
    } catch (err) {
      console.error(err);
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Join a Room</h2>
      <input
        type="text"
        placeholder="Enter your name"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="text"
        placeholder="Enter Room ID"
        value={roomID}
        onChange={(e) => setRoomID(e.target.value)}
      />
      <button onClick={handleJoin} disabled={loading}>
        {loading ? "Joining..." : "Join Room"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
