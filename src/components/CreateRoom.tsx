import { useState } from "react";
import Button from "./Button";
import { translations } from "../locales/translations";
import type { LanguageCode } from "../hooks/useLanguage";
import { useConvexRoom } from "../hooks/useConvexRoom";

type CreateRoomProps = {
  onRoomCreated: (args: { roomID: string; username: string }) => void;
  language?: LanguageCode;
  username?: string;
};

export default function CreateRoom({ onRoomCreated, language = "en", username }: CreateRoomProps) {
  const [roomID, setRoomID] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const i18n = translations[language] || translations.en;
  const { createRoom } = useConvexRoom();

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

    const cleanRoomCode = roomID.trim().toUpperCase();
    const cleanUsername = username.trim();

    // Generate a unique player ID
    const playerId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    try {
      const result = await createRoom({
        hostId: playerId,
        hostName: cleanUsername,
        gameMode: "classic",
        language,
      });

      if (result.success && result.roomCode) {
        // Store player session
        localStorage.setItem("playerId", playerId);
        localStorage.setItem("playerRoomId", result.roomCode);
        localStorage.setItem("playerName", cleanUsername);
        
        onRoomCreated({ roomID: result.roomCode, username: cleanUsername });
      } else {
        setError(result.error || i18n.ui.networkError || "Failed to create room");
      }
    } catch (err) {
      console.error("[CreateRoom] request failed", err);
      setError(i18n.ui.networkError || "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-room">
      {/* <h2>{i18n.ui.createRoom}</h2> */}
      <div className="friend-input">
        <input
          type="text"
          placeholder={i18n.ui.placeholderCreateRoomID || "create room ID..."}
          value={roomID}
          onChange={(e) => setRoomID(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && !loading && void handleCreate()}
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
