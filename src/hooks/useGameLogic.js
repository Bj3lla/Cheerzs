import { useState, useEffect } from "react";
import { getRandomItem, getRandomCategory } from "../utils/gameUtils";
import { translations } from "../locales/translations";
import useQuestionState from "./useQuestionState";
import useFriendManagement from "./useFriendManagement";
import useRuleManagement from "./useRuleManagement";

export default function useGameLogic(language) {
  const { unread, read, pickQuestion } = useQuestionState();
  const {
    friends,
    replaceFriends,
    friendInput,
    setFriendInput,
    addFriend,
    removeFriend,
    player,
    setPlayer,
  } = useFriendManagement();

  const {
    availableRules,
    activeRules,
    repelMessage,
    repelActive,
    updateActiveRules,
    addRule,
    clearRepel,
  } = useRuleManagement(language);

  const [gameStarted, setGameStarted] = useState(false);
  const [category, setCategory] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [showActiveRules, setShowActiveRules] = useState(true);

  const [roomId, setRoomId] = useState(null);
  const [roomPlayers, setRoomPlayers] = useState([]);

  const playersForPrompts = roomId ? roomPlayers : friends;

  const setRoomSession = ({ roomID, players }) => {
    setRoomId(roomID || null);
    setRoomPlayers(Array.isArray(players) ? players : []);
  };

  const clearRoomSession = () => {
    setRoomId(null);
    setRoomPlayers([]);
  };

  useEffect(() => {
    // If current selected player left the room, clear it.
    if (!roomId) return;
    if (player && !roomPlayers.includes(player)) setPlayer("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, roomPlayers]);

  const generatePrompt = () => {
    if (repelActive) {
      clearRepel();
      // Continue to generate the next prompt instead of returning
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
      addRule(picked);
      setPrompt(picked[language]);
      return;
    }

    const questionObj = pickQuestion(cat);
    let newPrompt;

    if (cat === "truth" || cat === "dare") {
      if (playersForPrompts.length === 0) {
        newPrompt = questionObj[language];
      } else {
        const selectedPlayer = getRandomItem(playersForPrompts);
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
    replaceFriends,
    friendInput,
    setFriendInput,
    addFriend,
    removeFriend,
    player,
    setPlayer,
    gameStarted,
    setGameStarted,
    roomId,
    roomPlayers,
    playersForPrompts,
    setRoomSession,
    clearRoomSession,
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