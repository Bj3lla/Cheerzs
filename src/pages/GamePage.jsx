import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { BsChevronCompactDown, BsChevronCompactUp } from "react-icons/bs";
import Button from "../components/Button";
import Card from "../components/Card";
import Topbar from "../components/Topbar";
import { useGame } from "../context/GameContext";
import { categoryColors } from "../utils/gameUtils";
import { translations } from "../locales/translations";

export default function GamePage({ language }) {
    const {
    gameStarted,
    category,
    prompt,
    generatePrompt,
    activeRules,
    repelMessage,
    repelActive,
    showActiveRules,
    setShowActiveRules,
    } = useGame();


  const i18n = translations[language];

  useEffect(() => {
    if (gameStarted && !prompt) {
      generatePrompt();
    }
  }, [gameStarted, prompt, generatePrompt]);

  return (
    <div className="game-screen">
      <Topbar />
      <h2
        className="category-header"
        style={{
          color:
            categoryColors[repelActive ? "repeal" : category] ||
            "var(--dark)",
        }}
      >
        {repelActive
          ? i18n.categories.repeal
          : i18n.categories[category] || ""}
      </h2>

        <Card
          prompt={repelActive ? repelMessage : prompt || i18n.ui.pressNext}
          category={repelActive ? "repeal" : category}
        />

      <Button
        label={i18n.ui.next}
        color="primary"
        onClick={generatePrompt}
        size="large"
      />

      {activeRules.length > 0 && (
        <div className="active-rules-container">
          <div
            className="active-rules-header"
            // onClick={() => setShowActiveRules((prev) => !prev)}
            style={{ cursor: "pointer" }}
          >
            <h3>{i18n.ui.activeRules}</h3>
            <span className="toggle-icon">
              {/* {showActiveRules ? (
                <BsChevronCompactUp fontSize={24} />
              ) : (
                <BsChevronCompactDown fontSize={24} />
              )} */}
            </span>
          </div>

          {showActiveRules && (
            <div className="active-rules">
              <ul>
                {activeRules.map((rule) => (
                  <li key={rule.id}>{rule[language]}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
