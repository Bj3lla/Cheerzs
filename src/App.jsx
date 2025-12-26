import Button from "./components/Button";
import Card from "./components/Card";
import "./index.css";
import { BsChevronCompactDown, BsChevronCompactUp } from "react-icons/bs";
import { GrLanguage } from "react-icons/gr";
import { IoClose } from "react-icons/io5";
import { translations } from "./locales/translations";
import useLanguage from "./hooks/useLanguage";
import useGameLogic from "./hooks/useGameLogic";

/* ---------------------------------------
   🧮 Helpers
--------------------------------------- */
const getRandomRounds = (min = 10, max = 20) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const getNameCategory = (category, language) =>
  translations[language].categories[category] || "";

const categoryColors = {
  truth: "#4169e1",
  dare: "#e91e63",
  point: "#7541dd",
  never: "#007f96",
  rule: "#b42a82",
  repeal: "#b42a82",
};

/* ---------------------------------------
   🕹️ Main Component
--------------------------------------- */
export default function App() {
  const { language, setLanguage, languageMenuOpen, setLanguageMenuOpen } = useLanguage();

  const {
    friends,
    friendInput,
    setFriendInput,
    addFriend,
    removeFriend,
    player,
    gameStarted,
    setGameStarted,
    category,
    prompt,
    generatePrompt,
    activeRules,
    repelMessage,
    repelActive,
    showActiveRules,
    setShowActiveRules,
    categoryColors,
    translations: hookTranslations,
  } = useGameLogic(language);

  const i18n = translations[language] || hookTranslations[language];

  return (
    <div className="app">
      {/* Language Button */}
      <GrLanguage
        className="language-btn"
        onClick={() => setLanguageMenuOpen(true)}
        title="Change language"
      />

      {/* Language Popup */}
      {languageMenuOpen && (
        <div className="language-popup-overlay">
          <div className="language-popup">
            <IoClose
              className="popup-close-btn"
              onClick={() => setLanguageMenuOpen(false)}
            />
            <h2>{i18n.ui.selectLanguage}</h2>
            <div className="language-options">
              <label>
                <input
                  type="radio"
                  name="language"
                  value="en"
                  checked={language === "en"}
                  onChange={() => setLanguage("en")}
                />
                🇬🇧 English
              </label>
              <label>
                <input
                  type="radio"
                  name="language"
                  value="no"
                  checked={language === "no"}
                  onChange={() => setLanguage("no")}
                />
                🇳🇴 Norsk
              </label>
            </div>

            <button
              className="popup-done-btn"
              onClick={() => setLanguageMenuOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {!gameStarted ? (
        <div className="home-screen">
          <h1>
            {i18n.ui.cheers}
            <br />
            {i18n.ui.year}
          </h1>

          <div className="friend-input">
              <input
                type="text"
                placeholder={i18n.ui.placeholder}
                value={friendInput}
                onChange={(e) => setFriendInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addFriend()}
              />
            <Button
                label={i18n.ui.add}
              color="accent"
              onClick={addFriend}
              size="small"
            />
          </div>

          <div className="friends-list">
            {friends.map((friend, index) => (
              <div key={index} className="friend-item">
                <span>{friend}</span>
                <button
                  className="remove-btn"
                  onClick={() => removeFriend(friend)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <Button
            label={i18n.ui.startGame}
            color="primary"
            onClick={() => {
              generatePrompt();
              setGameStarted(true);
            }}
            size="large"
            disabled={friends.length === 0}
          />
        </div>
      ) : (
        <>
          <div className="top-bar">
            <Button
              label={i18n.ui.editGame}
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
              ? i18n.categories.repeal
              : i18n.categories[category] || ""}
          </h2>

          <div className="card-wrapper">
              <Card
                prompt={
                  repelActive
                    ? repelMessage
                    : prompt || i18n.ui.pressNext
                }
                category={repelActive ? "repeal" : category}
              />
          </div>

          <Button
            label={i18n.ui.next}
            color="primary"
            onClick={generatePrompt}
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
        </>
      )}
    </div>
  );
}
