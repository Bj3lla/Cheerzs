import { useEffect, useMemo, useState } from "react";
import Button from "./Button";
import { translations } from "../locales/translations";
import type { LanguageCode } from "../hooks/useLanguage";

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

export default function JoinRoom({ onRoomJoined, language = "no", username }: JoinRoomProps) {
  const [roomID, setRoomID] = useState<string>("");
  const [localUsername, setLocalUsername] = useState<string>(username || "");
  const [showUsernameInput, setShowUsernameInput] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const i18n = translations[language] || translations.no;

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

    console.groupCollapsed("[JoinRoom] POST /api/join-room");
    try {
      const normalizedRoomID = roomID.trim().toUpperCase();
      const payload: Record<string, string> = { roomID: normalizedRoomID, username: name };

      // Only send playerId when re-joining the same room with the same username.
      if (
        storedPlayerId &&
        storedPlayerRoomId &&
        storedPlayerRoomId === normalizedRoomID &&
        (localStorage.getItem("playerName") || "").trim() === name
      ) {
        (payload as Record<string, string | undefined>).playerId = storedPlayerId;
      }
      console.log("payload", payload);

      const res = await fetch("/api/join-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get("content-type") || "";
      const vercelError = res.headers.get("x-vercel-error") || "";
      const vercelId = res.headers.get("x-vercel-id") || "";

      const rawText = await res.text();
      let data: Record<string, unknown> | null = null;
      if (rawText) {
        try {
          data = JSON.parse(rawText) as Record<string, unknown>;
        } catch {
          data = null;
        }
      }

      console.log("status", res.status);
      console.log("content-type", contentType);
      if (vercelError) console.log("x-vercel-error", vercelError);
      if (vercelId) console.log("x-vercel-id", vercelId);
      console.log("parsed response", data);
      if (!data && rawText) console.log("raw response", rawText);

      if (res.ok) {
        const playerId = (data as Record<string, unknown>)?.playerId;
        if (playerId) {
          localStorage.setItem("playerId", String(playerId));
          localStorage.setItem("playerRoomId", normalizedRoomID);
        }
        localStorage.setItem("playerName", name);
        onRoomJoined({
          roomID: normalizedRoomID,
          username: name,
          gameStarted: Boolean((data as Record<string, unknown>)?.gameStarted),
          startedAt: (typeof (data as Record<string, unknown>)?.startedAt === "string" ? (data as Record<string, unknown>).startedAt : null) as string | null,
        });
      } else {
        const code = (data as Record<string, unknown>)?.code;
        if (res.status === 409 && code === "USERNAME_TAKEN") {
          setShowUsernameInput(true);
          setError(i18n.ui.usernameTaken || "The username is already taken");
        } else {
          const errorMsg = typeof (data as Record<string, unknown>)?.error === "string" ? (data as Record<string, unknown>).error as string : i18n.ui.networkError || "Network error";
          setError(errorMsg);
        }
      }
    } catch (err) {
      console.error("[JoinRoom] request failed", err);
      setError(i18n.ui.networkError || "Network error");
    } finally {
      console.groupEnd();
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
