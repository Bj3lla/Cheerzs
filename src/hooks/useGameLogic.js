import { useState, useEffect } from "react";
import { newRules } from "../data/newRule";
import { getRandomItem, getRandomRounds, getRandomCategory } from "../utils/gameUtils";
import { translations } from "../locales/translations";
import useQuestionState from "./useQuestionState";
import useFriendManagement from "./useFriendManagement";

export default function useGameLogic(language) {
  const { unread, read, pickQuestion } = useQuestionState();
  const {
    friends,
    friendInput,
    setFriendInput,
    addFriend,
    removeFriend,
    player,
    setPlayer,
  } = useFriendManagement();

  const [gameStarted, setGameStarted] = useState(false);
  const [category, setCategory] = useState(null);
  const [prompt, setPrompt] = useState("");

  const [availableRules, setAvailableRules] = useState([...newRules]);
  const [activeRules, setActiveRules] = useState([]);
  const [repelMessage, setRepelMessage] = useState("");
  const [repelActive, setRepelActive] = useState(false);
  const [showActiveRules, setShowActiveRules] = useState(true);

  const updateActiveRules = () => {
    if (!Array.isArray(activeRules) || activeRules.length === 0) {
      return false;
    }

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
    translations,
  };
}