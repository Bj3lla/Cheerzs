import { useState } from "react";
import Button from "./Button";
import { translations } from "../locales/translations";
import type { LanguageCode } from "../hooks/useLanguage";

type AddPlayerProps = {
  language?: LanguageCode;
  onPlayerAdded?: (name: string) => void | Promise<void>;
  isLoading?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  hideButton?: boolean;
  placeholderPlayerName?: string;
};

export default function AddPlayer({
  language = "en",
  onPlayerAdded,
  isLoading = false,
  value,
  onChange,
  hideButton = false,
  placeholderPlayerName,
}: AddPlayerProps) {
  const [internalName, setInternalName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const i18n = translations[language] || translations.no;

  const playerName = typeof value === "string" ? value : internalName;
  const setPlayerName = typeof onChange === "function" ? onChange : setInternalName;

  const handleAddPlayer = async () => {
    const name = (playerName || "").trim();

    if (!name) {
      setError(i18n.ui.pleaseEnterPlayerName || "Please enter a player name");
      return;
    }

    setError("");

    try {
      if (typeof onPlayerAdded === "function") {
        await onPlayerAdded(name);
      }

      // clear internal input only when uncontrolled
      if (typeof value !== "string") setInternalName("");
    } catch (err: any) {
      setError(err?.message || "Failed to add player");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isLoading) {
      void handleAddPlayer();
    }
  };

  return (
    <div className="add-player">
      <div className="add-player-error">
        <div className="player-input">
          <input
            type="text"
            placeholder={
              placeholderPlayerName || i18n?.ui?.placeholderPlayerName || "Enter your name"
            }
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          {!hideButton && (
            <Button
              label={isLoading ? i18n.ui.loading || "Loading..." : i18n.ui.add || "Add"}
              color="accent"
              onClick={handleAddPlayer}
              size="small"
              disabled={isLoading || !(playerName || "").trim()}
            />
          )}
        </div>
        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
}
