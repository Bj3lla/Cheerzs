import { useState } from "react";
import Button from "./Button";
import { translations } from "../locales/translations";
import type { LanguageCode } from "../hooks/useLanguage";

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

    try {
      const payload = { roomID: roomID.trim().toUpperCase(), username: username.trim() };
      console.groupCollapsed("[CreateRoom] POST /api/create-room");
      console.log("payload", payload);

      const res = await fetch("/api/create-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: any;
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
        if (data?.playerId) {
          localStorage.setItem("playerId", String(data.playerId));
          localStorage.setItem("playerRoomId", roomID.trim().toUpperCase());
        }
        onRoomCreated({ roomID: roomID.trim().toUpperCase(), username: username.trim() });
      } else {
        setError((data && data.error) || i18n.ui.networkError || "Network error");
      }
    } catch (err) {
      console.error(err);
      (console as any).groupEnd?.();
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
