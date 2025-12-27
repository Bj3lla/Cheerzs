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
    if (!username || typeof username !== "string" || !username.trim()) {
      setError(i18n.ui.pleaseEnterPlayerName || "Please enter a name first");
      return;
    }

    if (!roomID.trim()) {
      setError(i18n.ui.pleaseEnterRoomID || "Please enter a room ID");
      return;
    }

    setLoading(true);
    setError("");
    setCopied(false);

    try {
      const payload = { roomID: roomID.trim().toUpperCase(), username: username.trim() };
      console.groupCollapsed("[CreateRoom] POST /api/create-room");
      console.log("payload", payload);

      const res = await fetch("/api/create-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
        data = null;
        console.warn("[CreateRoom] failed to parse JSON", parseErr);
      }

      console.log("status", res.status);
      console.log("response", data);
      console.groupEnd();

      if (res.ok) {
        setCreatedRoomID(roomID.trim().toUpperCase());
        onRoomCreated({ roomID: roomID.trim().toUpperCase(), username: username.trim() });
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
    <div className="create-room">
      <h2>{i18n.ui.createRoom}</h2>
      <div className="friend-input">
        <input
          type="text"
          placeholder={i18n.ui.placeholderRoomID}
          value={roomID}
          onChange={(e) => setRoomID(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && !loading && handleCreate()}
          disabled={loading}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className={`${error ? "error " : ""}room-code-input`}
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
