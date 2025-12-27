import { useState } from "react";
import Button from "./Button";
import "../index.css";

export default function CreateRoom({ onRoomCreated }) {
  const [roomID, setRoomID] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdRoomID, setCreatedRoomID] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!roomID.trim()) {
      setError("Please enter a room ID");
      return;
    }

    setLoading(true);
    setError("");
    setCopied(false);

    try {
      const res = await fetch("/api/create-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID: roomID.trim() }),
      });
      const data = await res.json();

      if (res.ok) {
        setCreatedRoomID(roomID);
        onRoomCreated(roomID);
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
    navigator.clipboard.writeText(createdRoomID);
    setCopied(true);
  };

  return (
    <div className="create-room">
      <h2>Create Room</h2>
      {!createdRoomID ? (
        <>
        <div className="friend-input"> 
          <input
            type="text"
            placeholder="enter room ID..."
            value={roomID}
            onChange={(e) => setRoomID(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleCreate()}
            disabled={loading}
          />
        </div>
          {error && <p className="error-message" >{error}</p>}
          <Button
            label={loading ? "Creating..." : "Create Room"}
            color="accent"
            onClick={handleCreate}
            disabled={loading || !roomID.trim()}
            size="medium"
          />
        </>
      ) : (
        <div className="room-created">
          <p>
            Room created! Share this ID with your friends: <strong>{createdRoomID}</strong>
          </p>
          <Button
            label={copied ? "Copied!" : "Copy Room ID"}
            color="accent"
            onClick={copyToClipboard}
            size="small"
          />
        </div>
      )}
    </div>
  );
}
