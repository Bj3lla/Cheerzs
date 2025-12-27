import { useState } from "react";
import Button from "./Button";
import { translations } from "../locales/translations";

export default function JoinRoom({ onRoomJoined, language = "en" }) {
  const [roomID, setRoomID] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
    const i18n = translations[language];
 
  const handleJoin = async () => {
    if (!roomID.trim()) {
      setError("Please enter a room ID");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/join-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID: roomID.trim() }),
      });
      const data = await res.json();

      if (res.ok) {
        onRoomJoined(roomID.trim());
      } else {
        setError("Opsie! This room does not exist");
      }
    } catch (err) {
      console.error(err);
      setError("Opsie! This room does not exist");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="join-room">
      <h2> {i18n.ui.joinRoom} </h2>
      <div className="friend-input">
      <input
        type="text"
        placeholder="enter room ID..."
        value={roomID}
        onChange={(e) => setRoomID(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !loading && handleJoin()}
        disabled={loading}
      />
      </div>
      {error && <p className="error-message">{error}</p>}
      <Button
        label={loading ? "Joining..." : "Join Room"}
        color="primary"
        onClick={handleJoin}
        disabled={loading || !roomID.trim()}
        size="medium"
      />
    </div>
  );
}
