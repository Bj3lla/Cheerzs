import { useState, useEffect } from "react";
import { truthOrDare } from "./data/truthOrDare";
import { neverHaveIEver } from "./data/neverHaveIEver";
import { newRules } from "./data/newRule"; // ✅ plural and matching export
import { pointAtSomeone } from "./data/pointAtSomeone";
import { getRandomItem } from "./utils/randomItem";
import Button from "./components/Button";
import Card from "./components/Card";
import "./index.css";
import { BsChevronCompactDown, BsChevronCompactUp } from "react-icons/bs";
import { GrLanguage } from "react-icons/gr";
import { IoClose } from "react-icons/io5";
import { translations } from "./locales/translations";

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
  /* -------------------------------
     👥 Language Management
  -------------------------------- */
  const [language, setLanguage] = useState("en");
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

  /* -------------------------------
     👥 Player Management
  -------------------------------- */
  const [friends, setFriends] = useState([]);
  const [friendInput, setFriendInput] = useState("");
  const [player, setPlayer] = useState("");

  /* -------------------------------
     🎮 Game State
  -------------------------------- */
  const [gameStarted, setGameStarted] = useState(false);
  const [category, setCategory] = useState(null);
  const [prompt, setPrompt] = useState("");

  /* -------------------------------
     📜 Rules System
  -------------------------------- */
  const [availableRules, setAvailableRules] = useState([...newRules]);
  const [activeRules, setActiveRules] = useState([]);
  const [repelMessage, setRepelMessage] = useState("");
  const [repelActive, setRepelActive] = useState(false);
  const [showActiveRules, setShowActiveRules] = useState(true);

  /* -------------------------------
     📚 Question Management
  -------------------------------- */
  const [unread, setUnread] = useState({
    truth: [...truthOrDare.truth],
    dare: [...truthOrDare.dare],
    never: [...neverHaveIEver],
    point: [...pointAtSomeone],
  });

  const [read, setRead] = useState({
    truth: [],
    dare: [],
    never: [],
    point: [],
  });

  /* ---------------------------------------
     ➕ Add & Remove Friends
  --------------------------------------- */
  const addFriend = () => {
    const name = friendInput.trim();
    if (name && !friends.includes(name)) {
      setFriends((prev) => [...prev, name]);
      setFriendInput("");
    }
  };

  const removeFriend = (nameToRemove) => {
    setFriends((prev) => prev.filter((name) => name !== nameToRemove));
    if (player === nameToRemove) setPlayer("");
  };

  /* ---------------------------------------
     🎲 Category Selection
  --------------------------------------- */
  const getRandomCategory = () => {
    const random = Math.random() * 100;
    if (random < 10) return "rule";
    if (random < 35) return "point";
    if (random < 60) return "never";
    if (random < 80) return "truth";
    return "dare";
  };

  /* ---------------------------------------
     🧠 Question Handling
  --------------------------------------- */
  const pickQuestion = (category) => {
    let categoryUnread = [...unread[category]];
    let categoryRead = [...read[category]];

    // Prefer unread questions first
    if (categoryUnread.length > 0) {
      const questionObj = getRandomItem(categoryUnread);
      categoryUnread = categoryUnread.filter((q) => q.id !== questionObj.id);
      categoryRead.push(questionObj);

      setUnread((prev) => ({ ...prev, [category]: categoryUnread }));
      setRead((prev) => ({ ...prev, [category]: categoryRead }));

      return questionObj;
    }

    // If all have been read, reset and start over
    const questionObj = getRandomItem(categoryRead);
    setUnread((prev) => ({ ...prev, [category]: categoryRead }));
    setRead((prev) => ({ ...prev, [category]: [] }));
    return questionObj;
  };

  /* ---------------------------------------
     ⏳ Rule Countdown & Expiration
  --------------------------------------- */
  const updateActiveRules = () => {
    let ruleExpired = null;

    const updated = activeRules.map((rule) => {
      const newRounds = rule.roundsLeft - 1;
      if (newRounds <= 0 && !ruleExpired) ruleExpired = rule;
      return { ...rule, roundsLeft: newRounds };
    });

    if (ruleExpired) {
      const stillActive = updated.filter((r) => r.id !== ruleExpired.id);
      setActiveRules(stillActive);
      setRepelMessage(language === "en" ? ruleExpired.repelEn : ruleExpired.repelNo);
      setRepelActive(true);
      return true;
    }

    setActiveRules(updated);
    return false;
  };

  /* ---------------------------------------
     🎨 Generate Prompt
  --------------------------------------- */
  const generatePrompt = () => {
    if (repelActive) {
      setRepelActive(false);
      setRepelMessage("");
      return;
    }

    const expired = updateActiveRules();
    if (expired) return;

    const cat = getRandomCategory();
    setCategory(cat);

    if (cat === "rule") {
      const remainingRules = availableRules.filter(
        (r) => !activeRules.some((a) => a.id === r.id)
      );

      if (remainingRules.length === 0) {
        setPrompt(translations[language].ui.noMoreRules);
        return;
      }

      const picked = getRandomItem(remainingRules);
      setActiveRules([...activeRules, { ...picked, roundsLeft: getRandomRounds() }]);
      setAvailableRules(
        remainingRules.filter((r) => r.id !== picked.id)
      );
      setPrompt(picked[language]);
      return;
    }

    // Other categories
    const questionObj = pickQuestion(cat);
    let newPrompt;

    if (cat === "truth" || cat === "dare") {
      if (friends.length === 0) {
        newPrompt = questionObj[language];
      } else {
        const selectedPlayer = getRandomItem(friends);
        setPlayer(selectedPlayer);
        newPrompt = `${selectedPlayer}, ${questionObj[language]}`;
      }
    } else {
      newPrompt = questionObj[language];
    }

    setPrompt(newPrompt);
  };

  /* ---------------------------------------
     🔄 Update current prompt when language changes
  --------------------------------------- */
  useEffect(() => {
    if (!prompt) return;
    if (repelActive) return;

    if (category === "rule") {
      const currentRule = activeRules[activeRules.length - 1];
      if (currentRule) {
        setPrompt(currentRule[language]);
      }
    } else {
      const currentCategoryRead = read[category];
      const currentQuestion = currentCategoryRead[currentCategoryRead.length - 1];
      if (currentQuestion) {
        if (category === "truth" || category === "dare") {
          if (player) {
            setPrompt(`${player}, ${currentQuestion[language]}`);
          } else {
            setPrompt(currentQuestion[language]);
          }
        } else {
          setPrompt(currentQuestion[language]);
        }
      }
    }
  }, [language]);

  /* ---------------------------------------
     🎨 JSX Layout
  --------------------------------------- */
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
            <h2>{translations[language].ui.selectLanguage}</h2>
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
            {translations[language].ui.cheers}
            <br />
            {translations[language].ui.year}
          </h1>

          <div className="friend-input">
            <input
              type="text"
              placeholder={translations[language].ui.placeholder}
              value={friendInput}
              onChange={(e) => setFriendInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFriend()}
            />
            <Button
              label={translations[language].ui.add}
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
            label={translations[language].ui.startGame}
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
              ? getNameCategory("repeal", language)
              : getNameCategory(category, language)}
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
              <div
                className="active-rules-header"
                onClick={() => setShowActiveRules((prev) => !prev)}
                style={{ cursor: "pointer" }}
              >
                <h3>{translations[language].ui.activeRules}</h3>
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
                    {activeRules.map((rule, index) => (
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
