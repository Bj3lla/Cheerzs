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
  const [roomError, setRoomError] = useState<string>("");
  const [nameError, setNameError] = useState<string>("");
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

    // Validate both fields upfront so both errors can show at once
    let hasError = false;
    setRoomError("");
    setNameError("");

    if (!name) {
      setNameError(i18n.ui.pleaseEnterPlayerName || "Please enter a name first");
      setShowUsernameInput(true);
      hasError = true;
    }

    if (!roomID.trim()) {
      setRoomError(i18n.ui.pleaseEnterRoomID || "Please enter a room ID");
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);

    try {
      const normalizedRoomID = roomID.trim().toUpperCase();

      // Determine which player ID to use
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
          startedAt: null,
        });
      } else {
        classifyError(result.error || "");
      }
    } catch (err: any) {
      console.error("[JoinRoom] request failed", err);
      const errorMessage = err?.message || String(err);
      classifyError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /** Map a backend error string to the right field-level error. */
  const classifyError = (msg: string) => {
    if (msg.includes("already in use")) {
      setShowUsernameInput(true);
      setNameError(i18n.ui.usernameTaken || "The username is already taken");
    } else if (msg.includes("Room not found")) {
      setRoomError(i18n.ui.roomNotFound || "Room not found");
    } else if (msg.includes("Game has already finished")) {
      setRoomError(i18n.ui.roomNotFound || "Room not found");
    } else {
      setRoomError(i18n.ui.networkError || "Network error");
    }
  };

  return (
    <div className="join-room">
      <div className="friend-input">
        <input
          type="text"
          placeholder={i18n.ui.placeholderEnterRoomID || "enter room ID..."}
          value={roomID}
          onChange={(e) => {
            setRoomID(e.target.value.toUpperCase());
            setRoomError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && !loading && void handleJoin()}
          disabled={loading}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className={`${roomError ? "error " : ""}room-code-input`}
        />
      </div>
      {roomError && <p className="error-message">{roomError}</p>}
      {showUsernameInput && (
        <div className="friend-input" style={{ marginTop: "0.75rem" }}>
          <input
            type="text"
            placeholder={i18n.ui.placeholderPlayerName || "playername..."}
            value={localUsername}
            onChange={(e) => {
              setLocalUsername(e.target.value);
              setNameError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && !loading && void handleJoin()}
            disabled={loading}
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            className={`${nameError ? "error " : ""}room-code-input`}
          />
        </div>
      )}
      {nameError && <p className="error-message">{nameError}</p>}
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
