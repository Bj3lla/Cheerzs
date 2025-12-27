import { useState } from "react";
import Button from "./Button";
import { translations } from "../locales/translations";

export default function JoinRoom({ onRoomJoined, language = "en", username }) {
  const [roomID, setRoomID] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const i18n = translations[language];

  const handleJoin = async () => {
    if (!roomID.trim()) {
      setError(i18n.ui.pleaseEnterRoomID || "Please enter a room ID");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/join-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID: roomID.trim(), username }),
      });

      if (res.ok) {
        onRoomJoined({ roomID: roomID.trim(), username });
      } else {
        const data = await res.json();
        setError(data.error || i18n.ui.networkError || "Network error");
      }
    } catch (err) {
      console.error(err);
      setError(i18n.ui.networkError || "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="join-room">
      <h2>{i18n.ui.joinRoom}</h2>
      <div className="friend-input">
        <input
          type="text"
          placeholder={i18n.ui.placeholderRoomID}
          value={roomID}
          onChange={(e) => setRoomID(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && handleJoin()}
          disabled={loading}
          className={error ? "error" : ""}
        />
      </div>
      {error && <p className="error-message">{error}</p>}
      <div className="join-room-button">
        <Button
          label={loading ? i18n.ui.joiningRoom : i18n.ui.joinRoom}
          color="primary"
          onClick={handleJoin}
          disabled={loading || !roomID.trim()}
          size="medium"
        />
      </div>
    </div>
  );
}
