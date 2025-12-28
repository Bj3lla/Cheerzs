import { useEffect, useMemo, useState } from "react";
import Button from "./Button";
import { translations } from "../locales/translations";

export default function JoinRoom({ onRoomJoined, language = "en", username }) {
  const [roomID, setRoomID] = useState("");
  const [localUsername, setLocalUsername] = useState(username || "");
  const [showUsernameInput, setShowUsernameInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const i18n = translations[language];

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
      const payload = { roomID: normalizedRoomID, username: name };

      // Only send playerId when re-joining the same room with the same username.
      if (
        storedPlayerId &&
        storedPlayerRoomId &&
        storedPlayerRoomId === normalizedRoomID &&
        (localStorage.getItem("playerName") || "").trim() === name
      ) {
        payload.playerId = storedPlayerId;
      }
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
        if (data?.playerId) {
          localStorage.setItem("playerId", String(data.playerId));
          localStorage.setItem("playerRoomId", normalizedRoomID);
        }
        localStorage.setItem("playerName", name);
        onRoomJoined({
          roomID: normalizedRoomID,
          username: name,
          gameStarted: Boolean(data?.gameStarted),
          startedAt: data?.startedAt || null,
        });
      } else {
        const code = data?.code;
        if (res.status === 409 && code === "USERNAME_TAKEN") {
          setShowUsernameInput(true);
          setError(i18n.ui.usernameTaken || "The username is already taken");
        } else {
          setError((data && data.error) || i18n.ui.networkError || "Network error");
        }
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
            onKeyDown={(e) => e.key === "Enter" && !loading && handleJoin()}
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
          onKeyDown={(e) => e.key === "Enter" && !loading && handleJoin()}
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
