import { useState } from "react";
import Button from "./Button";
import { translations } from "../locales/translations";

// Map error codes to translation keys
const getErrorMessage = (errorCode, i18n) => {
  const errorMap = {
    emptyRoomID: i18n.ui.pleaseEnterRoomID || "Please enter a room ID",
    roomNotFound: i18n.ui.roomNotFound || "Opsie! This room does not exist",
    networkError: i18n.ui.networkError || "Network error",
  };
  return errorMap[errorCode] || null;
};

export default function JoinRoom({ onRoomJoined, language = "en" }) {
  const [roomID, setRoomID] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState(null);
  const i18n = translations[language];

  const errorMessage = getErrorMessage(errorCode, i18n);
 
  const handleJoin = async () => {
    if (!roomID.trim()) {
      setErrorCode("emptyRoomID");
      return;
    }

    setLoading(true);
    setErrorCode(null);

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
        setErrorCode("roomNotFound");
      }
    } catch (err) {
      console.error(err);
      setErrorCode("roomNotFound");
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
        placeholder= {i18n.ui.placeholderRoomID}
        value={roomID}
        onChange={(e) => setRoomID(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !loading && handleJoin()}
        disabled={loading}
        className={errorMessage ? "error" : ""} 
      />
      </div>
      {errorMessage && <p className="error-message">{errorMessage}</p>}
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
