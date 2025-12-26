import { BsChevronCompactDown, BsChevronCompactUp } from "react-icons/bs";
import Button from "../components/Button";
import Card from "../components/Card";
import { categoryColors } from "../utils/gameUtils";
import { translations } from "../locales/translations";

export default function GamePage({
  language,
  category,
  prompt,
  repelActive,
  repelMessage,
  showActiveRules,
  setShowActiveRules,
  activeRules,
  onGeneratePrompt,
  onBackToHome,
}) {
  const i18n = translations[language];

  return (
    <div className="game-screen">
      <div className="top-bar">
        <Button
          label={i18n.ui.editGame}
          color="dark"
          onClick={onBackToHome}
          size="small"
        />
      </div>

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

      <div className="card-wrapper">
        <Card
          prompt={repelActive ? repelMessage : prompt || i18n.ui.pressNext}
          category={repelActive ? "repeal" : category}
        />
      </div>

      <Button
        label={i18n.ui.next}
        color="primary"
        onClick={onGeneratePrompt}
        size="medium"
      />

      {activeRules.length > 0 && (
        <div className="active-rules-container">
          <div
            className="active-rules-header"
            onClick={() => setShowActiveRules((prev) => !prev)}
            style={{ cursor: "pointer" }}
          >
            <h3>{i18n.ui.activeRules}</h3>
            <span className="toggle-icon">
              {showActiveRules ? (
                <BsChevronCompactUp fontSize={25} />
              ) : (
                <BsChevronCompactDown fontSize={25} />
              )}
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
