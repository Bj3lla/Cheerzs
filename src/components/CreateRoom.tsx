import { useState } from "react";
import Button from "./Button";
import { translations } from "../locales/translations";
import type { LanguageCode } from "../hooks/useLanguage";

type CreateRoomProps = {
  onRoomCreated: (args: { roomID: string; username: string }) => void;
  language?: LanguageCode;
  username?: string;
};

export default function CreateRoom({ onRoomCreated, language = "no", username }: CreateRoomProps) {
  const [roomID, setRoomID] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const i18n = translations[language] || translations.no;

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

    const payload = { roomID: roomID.trim().toUpperCase(), username: username.trim() };
    console.groupCollapsed("[CreateRoom] POST /api/create-room");
    console.log("payload", payload);

    try {
      const res = await fetch("/api/create-room", {
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
      console.log("playerId value:", (data as Record<string, unknown>)?.playerId, "type:", typeof (data as Record<string, unknown>)?.playerId);
      if (!data && rawText) console.log("raw response", rawText);

      if (res.ok) {
        const playerId = (data as Record<string, unknown>)?.playerId;
        if (playerId) {
          localStorage.setItem("playerId", String(playerId));
          localStorage.setItem("playerRoomId", roomID.trim().toUpperCase());
        }
        onRoomCreated({ roomID: roomID.trim().toUpperCase(), username: username.trim() });
      } else {
        const requestId = typeof (data as Record<string, unknown>)?.requestId === "string" ? (data as Record<string, unknown>).requestId : "";
        if (requestId) console.log("requestId", requestId);
        const errorMsg = typeof (data as Record<string, unknown>)?.error === "string" ? (data as Record<string, unknown>).error as string : i18n.ui.networkError || "Network error";
        setError(errorMsg);
      }
    } catch (err) {
      console.error("[CreateRoom] request failed", err);
      setError(i18n.ui.networkError || "Network error");
    } finally {
      console.groupEnd();
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
