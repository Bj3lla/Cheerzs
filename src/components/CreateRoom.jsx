import { useState } from "react";
import Button from "./Button";
import { translations } from "../locales/translations";
import "../index.css";

// Map error codes to translation keys
const getErrorMessage = (errorCode, i18n) => {
  const errorMap = {
    emptyRoomID: i18n.ui.pleaseEnterRoomID || "Please enter a room ID",
    createFailed: i18n.ui.failedToCreateRoom || "Failed to create room",
    networkError: i18n.ui.networkError || "Network error",
  };
  return errorMap[errorCode] || null;
};

export default function CreateRoom({ onRoomCreated, language = "en" }) {
  const [roomID, setRoomID] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState(null);
  const [createdRoomID, setCreatedRoomID] = useState("");
  const [copied, setCopied] = useState(false);
  const i18n = translations[language];

  const errorMessage = getErrorMessage(errorCode, i18n);

  const handleCreate = async () => {
    if (!roomID.trim()) {
      setErrorCode("emptyRoomID");
      return;
    }

    setLoading(true);
    setErrorCode(null);
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
        setErrorCode("createFailed");
      }
    } catch (err) {
      console.error(err);
      setErrorCode("networkError");
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
            placeholder= {i18n.ui.placeholderRoomID}
            value={roomID}
            onChange={(e) => setRoomID(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleCreate()}
            disabled={loading}
            className={errorMessage ? "error" : ""} 
          />
        </div>
          {errorMessage && <p className="error-message">{errorMessage}</p>}
          <div className="create-room-button">
            <Button
              label={loading ? i18n.ui.joiningRoom : i18n.ui.joinRoom}
              color="accent"
              onClick={handleCreate}
              disabled={loading || !roomID.trim()}
              size="medium"
            />
          </div>
        </>
      ) : (
        <div className="room-created">
          <p>
            {i18n.ui.roomCreated} <strong>{createdRoomID}</strong>
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
