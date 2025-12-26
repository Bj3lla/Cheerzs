import { useState } from "react";

export default function CreateRoom({ onRoomCreated }) {
  const [username, setUsername] = useState("");
  const [roomID, setRoomID] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!username) {
      setError("Please enter your name");
      return;
    }
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const res = await fetch("/api/create-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (res.ok) {
        setRoomID(data.roomID);
        onRoomCreated(data.roomID);
      } else {
        setError(data.error || "Failed to create room");
      }
    } catch (err) {
      console.error(err);
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(roomID);
    setCopied(true);
  };

  return (
    <div>
      <h2>Create a Room</h2>
      {!roomID ? (
        <>
          <input
            type="text"
            placeholder="Enter your name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button onClick={handleCreate} disabled={loading}>
            {loading ? "Creating..." : "Create Room"}
          </button>
        </>
      ) : (
        <div>
          <p>
            Room created! Share this ID with your friends: <strong>{roomID}</strong>
          </p>
          <button onClick={copyToClipboard}>
            {copied ? "Copied!" : "Copy Room ID"}
          </button>
        </div>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
