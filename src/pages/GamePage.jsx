import Button from "../components/Button";
import Card from "../components/Card";
import { BsChevronCompactDown, BsChevronCompactUp } from "react-icons/bs";

export default function GamePage({
  game,
  translations,
  language,
  categoryColors,
}) {
  const {
    gameStarted,
    setGameStarted,
    category,
    prompt,
    repelActive,
    repelMessage,
    generatePrompt,
    activeRules,
  } = game;

  return (
    <>
      <div className="top-bar">
        <Button
          label={translations[language].ui.editGame}
          color="dark"
          onClick={() => setGameStarted(false)}
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
          ? translations[language].categories.repeal
          : translations[language].categories[category]}
      </h2>

      <div className="card-wrapper">
        <Card
          prompt={
            repelActive
              ? repelMessage
              : prompt || translations[language].ui.pressNext
          }
          category={repelActive ? "repeal" : category}
        />
      </div>

      <Button
        label={translations[language].ui.next}
        color="primary"
        onClick={generatePrompt}
        size="medium"
      />

      {activeRules.length > 0 && (
        <div className="active-rules-container">
          <div className="active-rules-header">
            <h3>{translations[language].ui.activeRules}</h3>
          </div>
          <ul>
            {activeRules.map((rule) => (
              <li key={rule.id}>{rule[language]}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
