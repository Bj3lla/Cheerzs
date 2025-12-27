import { useState } from "react";
import Button from "./Button";
import { translations } from "../locales/translations";

export default function CreateRoom({ onRoomCreated, language = "en", username }) {
  const [roomID, setRoomID] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdRoomID, setCreatedRoomID] = useState("");
  const [copied, setCopied] = useState(false);
  const i18n = translations[language];

  const handleCreate = async () => {
    if (!roomID.trim()) {
      setError(i18n.ui.pleaseEnterRoomID || "Please enter a room ID");
      return;
    }

    setLoading(true);
    setError("");
    setCopied(false);

    try {
      const res = await fetch("/api/create-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID: roomID.trim(), username }),
      });

      if (res.ok) {
        setCreatedRoomID(roomID.trim());
        onRoomCreated({ roomID: roomID.trim(), username });
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
    <div className="create-room">
      <h2>{i18n.ui.createRoom}</h2>
      <div className="friend-input">
        <input
          type="text"
          placeholder={i18n.ui.placeholderRoomID}
          value={roomID}
          onChange={(e) => setRoomID(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && handleCreate()}
          disabled={loading}
          className={error ? "error" : ""}
        />
      </div>
      {error && <p className="error-message">{error}</p>}
      <div className="create-room-button">
        <Button
          label={loading ? i18n.ui.loading : i18n.ui.createRoom}
          color="accent"
          onClick={handleCreate}
          disabled={loading || !roomID.trim()}
          size="medium"
        />
      </div>
    </div>
  );
}
