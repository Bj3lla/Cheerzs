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
import { drinkingBuddy } from "../data/drinkingBuddy";
import { wildcard } from "../data/wildcard";

const pickTwoDifferentPlayers = (players) => {
  if (!Array.isArray(players) || players.length < 2) return { p1: null, p2: null };
  const p1 = getRandomItem(players);
  const remaining = players.filter((p) => p !== p1);
  const p2 = remaining.length > 0 ? getRandomItem(remaining) : null;
  return { p1, p2 };
};

export default function useGameLogic(language) {
  const { unread: _unread, read, pickQuestion, resetAllQuestions } = useQuestionState();
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
    resetRules,
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

  const resetGameState = () => {
    setGameStarted(false);
    setCategory(null);
    setPrompt("");
    setCurrentCard(null);
    broadcastStateRef.current = null;
    setPlayer("");
    setShowActiveRules(true);

    // Local mode state should never leak between rooms or sessions.
    replaceFriends([]);
    setFriendInput("");

    // Reset decks/rules so a new room is always a fresh game.
    resetAllQuestions();
    resetRules();
  };

  const playersForPrompts = roomId ? roomPlayers : friends;

  const setRoomSession = ({ roomID, players }) => {
    const nextRoomId = roomID || null;
    if (nextRoomId !== roomId) {
      resetGameState();
    }
    setRoomId(nextRoomId);
    setRoomPlayers(Array.isArray(players) ? players : []);
  };

  const clearRoomSession = () => {
    resetGameState();
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
    const activeAfterTick = tick?.activeRules ?? (Array.isArray(activeRules) ? activeRules : []);

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

    if (cat === "drinkingbuddy") {
      const questionObj = pickQuestion("drinkingbuddy");

      const { p1, p2 } = pickTwoDifferentPlayers(playersForPrompts);
      const suffix = questionObj?.[language] || "";

      const newPrompt = p1 && p2
        ? `${p1}${translations[language].ui.and}${p2} ${suffix}`
        : `${translations[language].ui.you}${translations[language].ui.and}${translations[language].ui.i} ${suffix}`;

      const nextCard = {
        kind: "question",
        category: "drinkingbuddy",
        questionId: questionObj.id,
        selectedPlayer: p1,
        selectedPlayer2: p2,
      };

      setCurrentCard(nextCard);
      broadcastStateRef.current = { card: nextCard, activeRules: activeAfterTick };
      setPrompt(newPrompt);
      return nextCard;
    }

    if (cat === "wildcard") {
      const wildcardType = Math.random() < 0.5 ? "onePlayer" : "allPlayers";
      const deckKey = wildcardType === "onePlayer" ? "wildcardOne" : "wildcardAll";
      const questionObj = pickQuestion(deckKey);

      const selectedPlayer = wildcardType === "onePlayer" && playersForPrompts.length > 0
        ? getRandomItem(playersForPrompts)
        : null;

      const text = questionObj?.[language] || "";
      const newPrompt = selectedPlayer ? `${selectedPlayer}, ${text}` : text;

      const nextCard = {
        kind: "question",
        category: "wildcard",
        wildcardType,
        questionId: questionObj.id,
        selectedPlayer,
      };

      setCurrentCard(nextCard);
      broadcastStateRef.current = { card: nextCard, activeRules: activeAfterTick };
      setPrompt(newPrompt);
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
    const base =
      broadcastStateRef.current || {
        card: currentCard,
        activeRules: Array.isArray(activeRules) ? activeRules : [],
      };

    // In room games, once you're on the game page, treat state as started.
    return roomId ? { ...base, started: true } : base;
  };

  const applyRoomBroadcastState = (state, nextLanguage = language) => {
    if (!state || typeof state !== "object") return;

    const nextCard = state.card;

    // Sync active rules across the room (host and non-host).
    if (Array.isArray(state.activeRules)) {
      replaceActiveRules(state.activeRules);
    } else if (nextCard && typeof nextCard === "object") {
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

    // Allow an initial "started" state with no card yet.
    if (!nextCard || typeof nextCard !== "object") {
      setCurrentCard(null);
      setPlayer("");
      setCategory(null);
      return;
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
        if (cat === "drinkingbuddy") return drinkingBuddy.find((q) => q.id === questionId);
        if (cat === "wildcard") {
          const type = nextCard.wildcardType;
          if (type === "allPlayers") return wildcard.allPlayers.find((q) => q.id === questionId);
          return wildcard.onePlayer.find((q) => q.id === questionId);
        }
        return null;
      })();

      if (!question) {
        setPrompt(translations[nextLanguage].ui.pressNext);
        return;
      }

      const text = question[nextLanguage];
      if (cat === "drinkingbuddy") {
        const p1 = nextCard.selectedPlayer;
        const p2 = nextCard.selectedPlayer2;
        if (p1 && p2) {
          setPrompt(`${p1}${translations[nextLanguage].ui.and}${p2} ${text}`);
        } else {
          setPrompt(`${translations[nextLanguage].ui.you}${translations[nextLanguage].ui.and}${translations[nextLanguage].ui.i} ${text}`);
        }
        return;
      }

      if (cat === "wildcard") {
        const type = nextCard.wildcardType;
        if (type === "onePlayer" && selectedPlayer) {
          setPrompt(`${selectedPlayer}, ${text}`);
        } else {
          setPrompt(text);
        }
        return;
      }

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