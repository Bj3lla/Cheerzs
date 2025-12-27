import { useState } from "react";
import Button from "./Button";
import AddPlayer from "./AddPlayer";
import { translations } from "../locales/translations";

export default function JoinRoom({ onRoomJoined, language = "en" }) {
  const [roomID, setRoomID] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const i18n = translations[language];

  const handleJoin = async (username) => {
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

      const data = await res.json();

      if (res.ok) {
        onRoomJoined({ roomID: roomID.trim(), username });
      } else if (res.status === 404) {
        setError(i18n.ui.roomNotFound || "Room not found");
      } else {
        setError(i18n.ui.networkError || "Network error");
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
          placeholder={i18n.ui.placeholderRoomID || "Enter room ID"}
          value={roomID}
          onChange={(e) => setRoomID(e.target.value)}
          disabled={loading}
        />
      </div>
      <AddPlayer
        language={language}
        onPlayerAdded={handleJoin}
        isLoading={loading}
      />
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}
