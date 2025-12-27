import { useState } from "react";
import Button from "./Button";
import AddPlayer from "./AddPlayer";
import { translations } from "../locales/translations";
import "../index.css";

export default function CreateRoom({ onRoomCreated, language = "en" }) {
  const [roomID, setRoomID] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdRoomID, setCreatedRoomID] = useState("");
  const [copied, setCopied] = useState(false);
  const i18n = translations[language];

  const handleCreate = async (username) => {
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

      const data = await res.json();

      if (res.ok) {
        setCreatedRoomID(roomID.trim());
        onRoomCreated({ roomID: roomID.trim(), username });
      } else if (res.status === 409) {
        setError(i18n.ui.failedToCreateRoom || "Failed to create room");
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(createdRoomID);
    setCopied(true);
  };

  return (
    <div className="create-room">
      <h2>{i18n.ui.createRoom}</h2>
      {!createdRoomID ? (
        <>
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
            onPlayerAdded={handleCreate}
            isLoading={loading}
          />
          {error && <p className="error-message">{error}</p>}
        </>
      ) : (
        <div className="room-created">
          <p>{i18n.ui.roomCreated || "Room created"} <strong>{createdRoomID}</strong></p>
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
