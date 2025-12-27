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
      const payload = { roomID: roomID.trim(), username };
      console.groupCollapsed("[JoinRoom] POST /api/join-room");
      console.log("payload", payload);

      const res = await fetch("/api/join-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
        data = null;
        console.warn("[JoinRoom] failed to parse JSON", parseErr);
      }

      console.log("status", res.status);
      console.log("response", data);
      console.groupEnd();

      if (res.ok) {
        onRoomJoined({ roomID: roomID.trim(), username });
      } else {
        setError((data && data.error) || i18n.ui.networkError || "Network error");
      }
    } catch (err) {
      console.error(err);
      console.groupEnd?.();
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
