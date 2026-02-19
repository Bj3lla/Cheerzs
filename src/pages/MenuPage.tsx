import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import { useGame } from "../context/GameContext";
import { translations } from "../locales/translations";
import GameRules from "../components/GameRules";
import type { LanguageCode } from "../hooks/useLanguage";

export default function MenuPage({
  language,
  onLanguageChange,
}: {
  language: LanguageCode;
  onLanguageChange: (next: LanguageCode) => void;
}) {
  const navigate = useNavigate();
  const { roomId, gameStarted } = useGame();

  const i18n = translations[language] || translations.no; // Fallback to Norwegian if language code is unrecognized

  useEffect(() => {
    // Prevent manual navigation here from a cold start.
    const isRoomGame = Boolean(roomId);
    if (!isRoomGame && !gameStarted) {
      navigate("/", { replace: true });
    }
  }, [gameStarted, navigate, roomId]);

  return (
    <div className="menu-page">
      <Topbar to="/game" />

      <h2 className="menu-title">{i18n.ui.menu || (language === "no" ? "Meny" : "Menu")}</h2>

      {/* <hr className="menu-divider" /> */}

      <div className="select-language">
        <h3>{i18n.ui.selectLanguage}</h3>
        <div className="language-options">
          <label>
            <input
              type="radio"
              name="language"
              value="en"
              checked={language === "en"}
              onChange={() => onLanguageChange("en")}
            />
            English
          </label>
          <label>
            <input
              type="radio"
              name="language"
              value="no"
              checked={language === "no"}
              onChange={() => onLanguageChange("no")}
            />
            Norsk
          </label>
        </div>
      </div>

      <hr className="menu-divider" />

      <GameRules language={language} />
    </div>
  );
}
