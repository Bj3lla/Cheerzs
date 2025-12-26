import { useState, useEffect } from "react";
import { truthOrDare } from "../data/truthOrDare";
import { neverHaveIEver } from "../data/neverHaveIEver";
import { newRules } from "../data/newRule";
import { pointAtSomeone } from "../data/pointAtSomeone";
import { getRandomItem } from "../utils/randomItem";
import { translations } from "../locales/translations";

const getRandomRounds = (min = 10, max = 20) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const getRandomCategory = () => {
  const random = Math.random() * 100;
  if (random < 10) return "rule";
  if (random < 35) return "point";
  if (random < 60) return "never";
  if (random < 80) return "truth";
  return "dare";
};

const categoryColors = {
  truth: "#4169e1",
  dare: "#e91e63",
  point: "#7541dd",
  never: "#007f96",
  rule: "#b42a82",
  repeal: "#b42a82",
};

export default function useGameLogic(language) {
  const [friends, setFriends] = useState([]);
  const [friendInput, setFriendInput] = useState("");
  const [player, setPlayer] = useState("");

  const [gameStarted, setGameStarted] = useState(false);
  const [category, setCategory] = useState(null);
  const [prompt, setPrompt] = useState("");

  const [availableRules, setAvailableRules] = useState([...newRules]);
  const [activeRules, setActiveRules] = useState([]);
  const [repelMessage, setRepelMessage] = useState("");
  const [repelActive, setRepelActive] = useState(false);
  const [showActiveRules, setShowActiveRules] = useState(true);

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

  const pickQuestion = (categoryKey) => {
    let categoryUnread = [...unread[categoryKey]];
    let categoryRead = [...read[categoryKey]];

    if (categoryUnread.length > 0) {
      const questionObj = getRandomItem(categoryUnread);
      categoryUnread = categoryUnread.filter((q) => q.id !== questionObj.id);
      categoryRead.push(questionObj);

      setUnread((prev) => ({ ...prev, [categoryKey]: categoryUnread }));
      setRead((prev) => ({ ...prev, [categoryKey]: categoryRead }));

      return questionObj;
    }

    const questionObj = getRandomItem(categoryRead);
    setUnread((prev) => ({ ...prev, [categoryKey]: categoryRead }));
    setRead((prev) => ({ ...prev, [categoryKey]: [] }));
    return questionObj;
  };

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
      setAvailableRules(remainingRules.filter((r) => r.id !== picked.id));
      setPrompt(picked[language]);
      return;
    }

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

  useEffect(() => {
    if (!prompt) return;
    if (repelActive) return;

    if (category === "rule") {
      const currentRule = activeRules[activeRules.length - 1];
      if (currentRule) {
        setPrompt(currentRule[language]);
      }
    } else {
      const currentCategoryRead = read[category] || [];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  return {
    friends,
    friendInput,
    setFriendInput,
    addFriend,
    removeFriend,
    player,
    setPlayer,
    gameStarted,
    setGameStarted,
    category,
    prompt,
    generatePrompt,
    availableRules,
    activeRules,
    repelMessage,
    repelActive,
    showActiveRules,
    setShowActiveRules,
    categoryColors,
    translations,
  };
}

