import { useState } from "react";
import Button from "./Button";
import { translations } from "../locales/translations";

export default function AddPlayer({
  language,
  onPlayerAdded,
  isLoading = false,
  value, // optional controlled value
  onChange, // optional controlled change handler
  hideButton = false, // hide internal add button when used as simple input
  placeholderPlayerName,
}) {
  const [internalName, setInternalName] = useState("");
  const [error, setError] = useState("");
  const i18n = translations[language] || translations.en;

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
    } catch (err) {
      setError(err.message || "Failed to add player");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !isLoading) {
      handleAddPlayer();
    }
  };

  return (
    <div className="add-player">
    <div className= "add-player-error"> 
      <div className="player-input">
        <input
          type="text"
          placeholder={placeholderPlayerName || i18n?.ui?.placeholderPlayerName || "Enter your name"}
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={isLoading}
        />
        {!hideButton && (
          <Button
            label={isLoading ? (i18n.ui.loading || "Loading...") : (i18n.ui.add || "Add")}
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
