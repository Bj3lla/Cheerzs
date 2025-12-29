import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import { useGame } from "../context/GameContext";
import { translations } from "../locales/translations";

export default function MenuPage({ language, onLanguageChange }) {
  const navigate = useNavigate();
  const { roomId, gameStarted } = useGame();

  const i18n = translations[language] || translations.en;

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

      <h2>{i18n.ui.selectLanguage}</h2>
      <div className="language-options">
        <label>
          <input
            type="radio"
            name="language"
            value="en"
            checked={language === "en"}
            onChange={() => onLanguageChange("en")}
          />
          🇬🇧 English
        </label>
        <label>
          <input
            type="radio"
            name="language"
            value="no"
            checked={language === "no"}
            onChange={() => onLanguageChange("no")}
          />
          🇳🇴 Norsk
        </label>
      </div>

      <h2>Game rules</h2>
      <p>
        Welcome to Cheerzs! The rules of the game: the host is the leader of the game and
        responsible for drawing the cards and reading them out loud for the rest of the party.
        Each card belongs to a category, and the rules for each category are as follows:
      </p>
      <ul className="cheerzs-rules-list">
        <li>Truth - the chosen one must answer the question truthfully, or drink 5 sips.</li>
        <li>Dare - the chosen one must do the dare, or drink 5 sips.</li>
        <li>
          Who&apos;s Most Likely To... - everyone points at the person most likely to do what the card
          says. The one with the most fingers pointing at them drinks.
        </li>
        <li>
          Never Have I Ever - this one&apos;s a classic, if you have ever done what the card says,
          you drink.
        </li>
        <li>
          New Rule (and Rule Repealed) - the card introduces a new rule to the game! Everyone
          must follow it until it is repealed. If you forget the rule, you drink.
        </li>
        <li>
          Drinkingbuddy - the card picks two people to be drinkingbuddies. If one of them drinks,
          the other one drinks too.
        </li>
        <li>Wildcard - play the game to figure this one out! Cheerzs</li>
      </ul>
    </div>
  );
}
