import { useEffect, useMemo, useState } from "react";
import Button from "./Button";
import { translations } from "../locales/translations";
import type { LanguageCode } from "../hooks/useLanguage";
import { useConvexRoom } from "../hooks/useConvexRoom";

type JoinRoomProps = {
  onRoomJoined: (args: {
    roomID: string;
    username: string;
    gameStarted: boolean;
    startedAt: string | null;
  }) => void;
  language?: LanguageCode;
  username?: string;
};

export default function JoinRoom({ onRoomJoined, language = "en", username }: JoinRoomProps) {
  const [roomID, setRoomID] = useState<string>("");
  const [localUsername, setLocalUsername] = useState<string>(username || "");
  const [showUsernameInput, setShowUsernameInput] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const i18n = translations[language] || translations.en;
  const { joinRoom } = useConvexRoom();

  useEffect(() => {
    setLocalUsername(username || "");
  }, [username]);

  const storedPlayerId = useMemo(() => {
    return localStorage.getItem("playerId") || "";
  }, []);

  const storedPlayerRoomId = useMemo(() => {
    return localStorage.getItem("playerRoomId") || "";
  }, []);

  const handleJoin = async () => {
    const name = (localUsername || "").trim();
    if (!name) {
      setError(i18n.ui.pleaseEnterPlayerName || "Please enter a name first");
      return;
    }

    if (!roomID.trim()) {
      setError(i18n.ui.pleaseEnterRoomID || "Please enter a room ID");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const normalizedRoomID = roomID.trim().toUpperCase();

      // Determinewhich player ID to use
      let playerId = "";
      if (
        storedPlayerId &&
        storedPlayerRoomId &&
        storedPlayerRoomId === normalizedRoomID &&
        (localStorage.getItem("playerName") || "").trim() === name
      ) {
        // Re-joining the same room with the same name
        playerId = storedPlayerId;
      } else {
        // New player or different room
        playerId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      }

      const result = await joinRoom({
        code: normalizedRoomID,
        playerId,
        playerName: name,
      });

      if (result.success && result.roomId) {
        // Store player session
        localStorage.setItem("playerId", playerId);
        localStorage.setItem("playerRoomId", normalizedRoomID);
        localStorage.setItem("playerName", name);

        onRoomJoined({
          roomID: normalizedRoomID,
          username: name,
          gameStarted: result.gameStarted || false,
          startedAt: null, // Convex doesn't return this yet, can be added if needed
        });
      } else {
        // Check if it's a username taken error
        if (result.error && result.error.includes("already in use")) {
          setShowUsernameInput(true);
          setError(i18n.ui.usernameTaken || "The username is already taken");
        } else {
          setError(result.error || i18n.ui.networkError || "Failed to join room");
        }
      }
    } catch (err) {
      console.error("[JoinRoom] request failed", err);
      setError(i18n.ui.networkError || "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="join-room">
      {/* <h2>{i18n.ui.joinRoom}</h2> */}
      {showUsernameInput && (
        <div className="friend-input" style={{ marginBottom: "1rem" }}>
          <input
            type="text"
            placeholder={i18n.ui.placeholderPlayerName || "playername..."}
            value={localUsername}
            onChange={(e) => {
              setLocalUsername(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && !loading && void handleJoin()}
            disabled={loading}
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      )}
      <div className="friend-input">
        <input
          type="text"
          placeholder={i18n.ui.placeholderEnterRoomID || "enter room ID..."}
          value={roomID}
          onChange={(e) => setRoomID(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && !loading && void handleJoin()}
          disabled={loading}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className={`${error ? "error " : ""}room-code-input`}
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
