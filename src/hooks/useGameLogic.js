import { useState, useEffect, useRef } from "react";
import { getRandomItem, getRandomCategory } from "../utils/gameUtils";
import { translations } from "../locales/translations";
import useQuestionState from "./useQuestionState";
import useFriendManagement from "./useFriendManagement";
import useRuleManagement from "./useRuleManagement";
import { truthOrDare } from "../data/truthOrDare";
import { neverHaveIEver } from "../data/neverHaveIEver";
import { pointAtSomeone } from "../data/pointAtSomeone";
import { newRules } from "../data/newRule";

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
    replaceActiveRules,
  } = useRuleManagement(language);

  const [gameStarted, setGameStarted] = useState(false);
  const [category, setCategory] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [showActiveRules, setShowActiveRules] = useState(true);

  // A serializable descriptor of what is currently shown.
  // Used for multiplayer sync (host broadcasts; clients apply).
  const [currentCard, setCurrentCard] = useState(null);

  // Keep a synchronous snapshot for multiplayer publish.
  const broadcastStateRef = useRef(null);

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

    const tick = updateActiveRules(activeRules);
    const activeAfterTick = tick?.activeRules ?? Array.isArray(activeRules) ? activeRules : [];

    if (tick?.expiredRule) {
      const nextCard = { kind: "repeal", ruleId: tick.expiredRule.id };
      setCurrentCard(nextCard);
      broadcastStateRef.current = { card: nextCard, activeRules: activeAfterTick };
      return nextCard;
    }

    const cat = getRandomCategory();
    setCategory(cat);

    if (cat === "rule") {
      const remainingRules = newRules.filter((r) => !activeAfterTick.some((a) => a.id === r.id));

      if (remainingRules.length === 0) {
        setPrompt(translations[language].ui.noMoreRules);
        const nextCard = { kind: "info", messageKey: "noMoreRules" };
        setCurrentCard(nextCard);
        broadcastStateRef.current = { card: nextCard, activeRules: activeAfterTick };
        return nextCard;
      }

      const picked = getRandomItem(remainingRules);
      const addResult = addRule(picked, activeAfterTick);
      const nextActiveRules = addResult?.activeRules ?? activeAfterTick;
      setPrompt(picked[language]);
      const nextCard = { kind: "rule", ruleId: picked.id };
      setCurrentCard(nextCard);
      broadcastStateRef.current = { card: nextCard, activeRules: nextActiveRules };
      return nextCard;
    }

    const questionObj = pickQuestion(cat);
    let newPrompt;

    if (cat === "truth" || cat === "dare") {
      if (playersForPrompts.length === 0) {
        newPrompt = questionObj[language];
        const nextCard = {
          kind: "question",
          category: cat,
          questionId: questionObj.id,
          selectedPlayer: null,
        };
        setCurrentCard(nextCard);
        broadcastStateRef.current = { card: nextCard, activeRules: activeAfterTick };
        setPrompt(newPrompt);
        return nextCard;
      } else {
        const selectedPlayer = getRandomItem(playersForPrompts);
        setPlayer(selectedPlayer);
        newPrompt = `${selectedPlayer}, ${questionObj[language]}`;
        const nextCard = {
          kind: "question",
          category: cat,
          questionId: questionObj.id,
          selectedPlayer,
        };
        setCurrentCard(nextCard);
        broadcastStateRef.current = { card: nextCard, activeRules: activeAfterTick };
        setPrompt(newPrompt);
        return nextCard;
      }
    } else {
      newPrompt = questionObj[language];
      const nextCard = { kind: "question", category: cat, questionId: questionObj.id };
      setCurrentCard(nextCard);
      broadcastStateRef.current = { card: nextCard, activeRules: activeAfterTick };
      setPrompt(newPrompt);
      return nextCard;
    }
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

  const getRoomBroadcastState = () => {
    return (
      broadcastStateRef.current || {
        card: currentCard,
        activeRules: Array.isArray(activeRules) ? activeRules : [],
      }
    );
  };

  const applyRoomBroadcastState = (state, nextLanguage = language) => {
    if (!state || typeof state !== "object") return;

    const nextCard = state.card;

    if (!nextCard || typeof nextCard !== "object") return;

    // Sync active rules across the room (host and non-host).
    if (Array.isArray(state.activeRules)) {
      replaceActiveRules(state.activeRules);
    } else {
      // Backward-compatible fallback: apply deltas.
      if (nextCard.kind === "repeal" && nextCard.ruleId) {
        replaceActiveRules(activeRules.filter((r) => r.id !== nextCard.ruleId));
      }
      if (nextCard.kind === "rule" && nextCard.ruleId) {
        const existing = activeRules.some((r) => r.id === nextCard.ruleId);
        if (!existing) {
          const rule = newRules.find((r) => r.id === nextCard.ruleId);
          if (rule) {
            replaceActiveRules([...activeRules, { ...rule, roundsLeft: 999 }]);
          }
        }
      }
    }

    broadcastStateRef.current = {
      card: nextCard,
      activeRules: Array.isArray(state.activeRules) ? state.activeRules : activeRules,
    };

    setCurrentCard(nextCard);

    if (nextCard.kind === "repeal") {
      const rule = newRules.find((r) => r.id === nextCard.ruleId);
      if (rule) {
        setPrompt(nextLanguage === "en" ? rule.repelEn : rule.repelNo);
      } else {
        setPrompt(translations[nextLanguage].ui.pressNext);
      }
      setPlayer("");
      setCategory("repeal");
      return;
    }

    if (nextCard.kind === "rule") {
      const rule = newRules.find((r) => r.id === nextCard.ruleId);
      if (rule) setPrompt(rule[nextLanguage]);
      setPlayer("");
      setCategory("rule");
      return;
    }

    if (nextCard.kind === "info") {
      if (nextCard.messageKey && translations[nextLanguage]?.ui?.[nextCard.messageKey]) {
        setPrompt(translations[nextLanguage].ui[nextCard.messageKey]);
      } else {
        setPrompt(translations[nextLanguage].ui.pressNext);
      }
      setPlayer("");
      setCategory(null);
      return;
    }

    if (nextCard.kind === "question") {
      const { category: cat, questionId, selectedPlayer } = nextCard;
      setCategory(cat);
      setPlayer(selectedPlayer || "");

      const question = (() => {
        if (cat === "truth") return truthOrDare.truth.find((q) => q.id === questionId);
        if (cat === "dare") return truthOrDare.dare.find((q) => q.id === questionId);
        if (cat === "never") return neverHaveIEver.find((q) => q.id === questionId);
        if (cat === "point") return pointAtSomeone.find((q) => q.id === questionId);
        return null;
      })();

      if (!question) {
        setPrompt(translations[nextLanguage].ui.pressNext);
        return;
      }

      const text = question[nextLanguage];
      if ((cat === "truth" || cat === "dare") && selectedPlayer) {
        setPrompt(`${selectedPlayer}, ${text}`);
      } else {
        setPrompt(text);
      }

      return;
    }
  };

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
    currentCard,
    getRoomBroadcastState,
    applyRoomBroadcastState,
    availableRules,
    activeRules,
    repelMessage,
    repelActive,
    showActiveRules,
    setShowActiveRules,
    translations,
  };
}