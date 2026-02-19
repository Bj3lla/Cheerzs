import { useState, useEffect, useRef, useCallback } from "react";
import { getRandomItem, getRandomCategory, type CategoryKey } from "../utils/gameUtils";
import { translations } from "../locales/translations";
import useQuestionState from "./useQuestionState";
import useFriendManagement from "./useFriendManagement";
import useRuleManagement from "./useRuleManagement";
import type { LanguageCode } from "./useLanguage";
import { truthOrDare } from "../data/truthOrDare";
import { neverHaveIEver } from "../data/neverHaveIEver";
import { pointAtSomeone } from "../data/pointAtSomeone";
import { newRules } from "../data/newRule";
import { drinkingBuddy } from "../data/drinkingBuddy";
import { wildcard } from "../data/wildcard";
import { spotifyUrls } from "../data/urls/spotifyUrls";

type PlayerName = string;

type CardDescriptor =
  | { kind: "repeal"; ruleId: string | number }
  | { kind: "question"; category: CategoryKey; questionId?: string | number; selectedPlayer?: PlayerName }
  | { kind: "rule"; ruleId: string | number }
  | { kind: "wildcard"; questionId?: string | number; selectedPlayer?: PlayerName }
  | { kind: "drinkingbuddy"; p1: PlayerName | null; p2: PlayerName | null }

const pickTwoDifferentPlayers = (players: PlayerName[]) => {
  if (!Array.isArray(players) || players.length < 2) return { p1: null, p2: null };
  const p1 = getRandomItem(players);
  const remaining = players.filter((p) => p !== p1);
  const p2 = remaining.length > 0 ? getRandomItem(remaining) : null;
  return { p1, p2 };
};

export default function useGameLogic(language: LanguageCode) {
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
    activeRulesRef,
    repelMessage,
    repelActive,
    repelActiveRef,
    updateActiveRules,
    addRule,
    clearRepel,
    replaceActiveRules,
    resetRules,
  } = useRuleManagement(language);

  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [category, setCategory] = useState<CategoryKey | null>(null);
  const [prompt, setPrompt] = useState<string>("");
  const [showActiveRules, setShowActiveRules] = useState<boolean>(true);

  // A serializable descriptor of what is currently shown.
  // Used for multiplayer sync (host broadcasts; clients apply).
  const [currentCard, setCurrentCard] = useState<CardDescriptor | null>(null);

  // Keep a synchronous snapshot for multiplayer publish.
  const broadcastStateRef = useRef<any>(null);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<PlayerName[]>([]);

  // Refs for unstable callbacks so memoized functions always call the latest version
  const replaceFriendsRef = useRef(replaceFriends);
  replaceFriendsRef.current = replaceFriends;
  const resetAllQuestionsRef = useRef(resetAllQuestions);
  resetAllQuestionsRef.current = resetAllQuestions;
  const resetRulesRef = useRef(resetRules);
  resetRulesRef.current = resetRules;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  const resetGameState = useCallback(() => {
    setGameStarted(false);
    setCategory(null);
    setPrompt("");
    setCurrentCard(null);
    broadcastStateRef.current = null;
    cardQueueRef.current = [];
    setPlayer("");
    setShowActiveRules(true);

    // Local mode state should never leak between rooms or sessions.
    replaceFriendsRef.current([]);
    setFriendInput("");

    // Reset decks/rules so a new room is always a fresh game.
    resetAllQuestionsRef.current();
    resetRulesRef.current();
  }, [setPlayer, setFriendInput]);

  const playersForPrompts = roomId ? roomPlayers : friends;

  const setRoomSession = useCallback(({
    roomID,
    players,
  }: {
    roomID?: string | null;
    players?: PlayerName[];
  }) => {
    const nextRoomId = roomID || null;
    if (nextRoomId !== roomIdRef.current) {
      resetGameState();
    }
    setRoomId(nextRoomId);
    setRoomPlayers(Array.isArray(players) ? players : []);
  }, [resetGameState]);

  const clearRoomSession = useCallback(() => {
    resetGameState();
    setRoomId(null);
    setRoomPlayers([]);
  }, [resetGameState]);

  useEffect(() => {
    // If current selected player left the room, clear it.
    if (!roomId) return;
    if (player && !roomPlayers.includes(player)) setPlayer("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, roomPlayers]);

  // ─── Card Queue (FIFO buffer) ───────────────────────────────────────────
  // We keep a ref-based queue of pre-generated card snapshots so the UI can
  // serve the next card instantly while a replacement is generated.

  interface CardSnapshot {
    card: CardDescriptor;
    category: CategoryKey | "repeal" | null;
    prompt: string;
    player: string;
    broadcastState: any;
  }

  const cardQueueRef = useRef<CardSnapshot[]>([]);
  // Keep a ref to playersForPrompts so _generateCardSnapshot reads the latest value.
  const playersForPromptsRef = useRef(playersForPrompts);
  playersForPromptsRef.current = playersForPrompts;

  /**
   * Generate a card snapshot WITHOUT touching display state. Uses refs for
   * deck & rule state so it can be called multiple times synchronously.
   * Returns a self-contained snapshot that can be applied to the UI later.
   */
  const _generateCardSnapshot = (): CardSnapshot => {
    const players = playersForPromptsRef.current;
    const i18n = translations[language] || translations.no;

    // Handle repeal (clear it for the queue – each snapshot is independent).
    if (repelActiveRef.current) {
      clearRepel();
    }

    // Tick active rules (reads from ref, writes back to ref + state).
    const tick = updateActiveRules();
    const activeAfterTick = tick?.activeRules ?? activeRulesRef.current;

    if (tick?.expiredRule) {
      const card: CardDescriptor = { kind: "repeal", ruleId: tick.expiredRule.id };
      const rule = newRules.find((r) => r.id === tick.expiredRule.id);
      const promptText = rule
        ? (language === "en" ? rule.repelEn : rule.repelNo)
        : i18n.ui.pressNext;
      return {
        card,
        category: "repeal",
        prompt: promptText,
        player: "",
        broadcastState: { card, activeRules: activeAfterTick, started: true },
      };
    }

    const cat = getRandomCategory();

    if (cat === "spotify") {
      const track = getRandomItem(spotifyUrls);
      const trackUrl = track?.url || "https://open.spotify.com";
      const selectedPlayer = players.length > 0 ? getRandomItem(players) : null;
      const card: CardDescriptor = { kind: "question", category: "spotify", questionId: track?.id, selectedPlayer };
      return {
        card,
        category: "spotify",
        prompt: trackUrl,
        player: selectedPlayer || "",
        broadcastState: { card, activeRules: activeAfterTick, started: true },
      };
    }

    if (cat === "rule") {
      const remainingRules = newRules.filter(
        (r) => !activeAfterTick.some((a: any) => a.id === r.id)
      );
      if (remainingRules.length === 0) {
        const card: CardDescriptor = { kind: "wildcard", questionId: undefined };
        return {
          card,
          category: "wildcard",
          prompt: i18n.ui.noMoreRules,
          player: "",
          broadcastState: { card, activeRules: activeAfterTick, started: true },
        };
      }
      const picked = getRandomItem(remainingRules);
      const addResult = addRule(picked);
      const nextActiveRules = addResult?.activeRules ?? activeAfterTick;
      const card: CardDescriptor = { kind: "rule", ruleId: picked.id };
      return {
        card,
        category: "rule",
        prompt: picked[language],
        player: "",
        broadcastState: { card, activeRules: nextActiveRules, started: true },
      };
    }

    if (cat === "drinkingbuddy") {
      const questionObj = pickQuestion("drinkingbuddy");
      const { p1, p2 } = pickTwoDifferentPlayers(players);
      const suffix = questionObj?.[language] || "";
      const promptText = p1 && p2
        ? `${p1}${i18n.ui.and}${p2} ${suffix}`
        : `${i18n.ui.you}${i18n.ui.and}${i18n.ui.i} ${suffix}`;
      const card: CardDescriptor = { kind: "drinkingbuddy", p1: p1 || null, p2: p2 || null };
      return {
        card,
        category: "drinkingbuddy",
        prompt: promptText,
        player: "",
        broadcastState: { card, activeRules: activeAfterTick, started: true },
      };
    }

    if (cat === "wildcard") {
      const wildcardType = Math.random() < 0.5 ? "onePlayer" : "allPlayers";
      const deckKey = wildcardType === "onePlayer" ? "wildcardOne" : "wildcardAll";
      const questionObj = pickQuestion(deckKey);
      const selectedPlayer =
        wildcardType === "onePlayer" && players.length > 0 ? getRandomItem(players) : null;
      const text = questionObj?.[language] || "";
      const promptText = selectedPlayer ? `${selectedPlayer}, ${text}` : text;
      const card: CardDescriptor = { kind: "wildcard", questionId: questionObj.id, selectedPlayer };
      return {
        card,
        category: "wildcard",
        prompt: promptText,
        player: selectedPlayer || "",
        broadcastState: { card, activeRules: activeAfterTick, started: true },
      };
    }

    // truth, dare, never, point
    const questionObj = pickQuestion(cat);
    const text = questionObj[language];

    if ((cat === "truth" || cat === "dare") && players.length > 0) {
      const selectedPlayer = getRandomItem(players);
      const card: CardDescriptor = { kind: "question", category: cat, questionId: questionObj.id, selectedPlayer };
      return {
        card,
        category: cat,
        prompt: `${selectedPlayer}, ${text}`,
        player: selectedPlayer,
        broadcastState: { card, activeRules: activeAfterTick, started: true },
      };
    }

    const card: CardDescriptor = { kind: "question", category: cat, questionId: questionObj.id, selectedPlayer: undefined };
    return {
      card,
      category: cat,
      prompt: text,
      player: "",
      broadcastState: { card, activeRules: activeAfterTick, started: true },
    };
  };

  /** Apply a snapshot to the UI display state. */
  const _applySnapshot = (snap: CardSnapshot) => {
    setCategory(snap.category as CategoryKey);
    setPrompt(snap.prompt);
    setPlayer(snap.player);
    setCurrentCard(snap.card);
    broadcastStateRef.current = snap.broadcastState;
  };

  /**
   * Fill the queue up to `target` cards (default 7).
   * Generates cards synchronously using ref-based state.
   */
  const prefillCardQueue = useCallback((target = 7) => {
    const needed = target - cardQueueRef.current.length;
    for (let i = 0; i < needed; i++) {
      cardQueueRef.current.push(_generateCardSnapshot());
    }
    console.log(`[useGameLogic] Queue prefilled to ${cardQueueRef.current.length} cards`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  /**
   * Pop the next card from the queue, apply it to the UI, and generate
   * one replacement card to keep the buffer full.  Returns the snapshot
   * so the caller can publish it (multiplayer).
   *
   * If the queue is empty (shouldn't happen), falls back to generating
   * a card on the spot.
   */
  const advanceCardQueue = useCallback((): CardSnapshot => {
    let snap: CardSnapshot;
    if (cardQueueRef.current.length > 0) {
      snap = cardQueueRef.current.shift()!;
    } else {
      console.warn("[useGameLogic] Queue empty – generating card on the fly");
      snap = _generateCardSnapshot();
    }

    // Apply popped card to UI
    _applySnapshot(snap);

    // Generate one replacement to refill the buffer
    cardQueueRef.current.push(_generateCardSnapshot());
    console.log(`[useGameLogic] Queue advanced. Remaining: ${cardQueueRef.current.length}`);

    return snap;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  /** How many cards are currently buffered. */
  const getQueueLength = () => cardQueueRef.current.length;

  const generatePrompt = () => {
    if (repelActive) {
      clearRepel();
      // Continue to generate the next prompt instead of returning
    }

    const tick = updateActiveRules(activeRules);
    const activeAfterTick = tick?.activeRules ?? (Array.isArray(activeRules) ? activeRules : []);

    if (tick?.expiredRule) {
      const nextCard: CardDescriptor = { kind: "repeal", ruleId: tick.expiredRule.id };
      setCurrentCard(nextCard);
      broadcastStateRef.current = { card: nextCard, activeRules: activeAfterTick };
      return nextCard;
    }

    const cat = getRandomCategory();
    setCategory(cat);

    if (cat === "spotify") {
      const track = getRandomItem(spotifyUrls);
      const trackUrl = track?.url || "https://open.spotify.com";
      const selectedPlayer = playersForPrompts.length > 0 ? getRandomItem(playersForPrompts) : null;

      setPrompt(trackUrl);
      
      if (selectedPlayer) {
        setPlayer(selectedPlayer);
      }

      const nextCard: CardDescriptor = {
        kind: "question",
        category: "spotify",
        questionId: track?.id,
        selectedPlayer,
      };

      setCurrentCard(nextCard);
      broadcastStateRef.current = { card: nextCard, activeRules: activeAfterTick };
      return nextCard;
    }
    if (cat === "rule") {
      const remainingRules = newRules.filter((r) => !activeAfterTick.some((a) => a.id === r.id));

      if (remainingRules.length === 0) {
        setPrompt(translations[language].ui.noMoreRules);
        // Use wildcard as fallback card type
        const nextCard: CardDescriptor = { kind: "wildcard", questionId: undefined };
        setCurrentCard(nextCard);
        broadcastStateRef.current = { card: nextCard, activeRules: activeAfterTick };
        return nextCard;
      }

      const picked = getRandomItem(remainingRules);
      const addResult = addRule(picked, activeAfterTick);
      const nextActiveRules = addResult?.activeRules ?? activeAfterTick;
      setPrompt(picked[language]);
      const nextCard: CardDescriptor = { kind: "rule", ruleId: picked.id };
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

      const nextCard: CardDescriptor = {
        kind: "drinkingbuddy",
        p1: p1 || null,
        p2: p2 || null,
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

      const nextCard: CardDescriptor = {
        kind: "wildcard",
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
        const nextCard: CardDescriptor = {
          kind: "question",
          category: cat,
          questionId: questionObj.id,
          selectedPlayer: undefined,
        };
        setCurrentCard(nextCard);
        broadcastStateRef.current = { card: nextCard, activeRules: activeAfterTick };
        setPrompt(newPrompt);
        return nextCard;
      } else {
        const selectedPlayer = getRandomItem(playersForPrompts);
        setPlayer(selectedPlayer);
        newPrompt = `${selectedPlayer}, ${questionObj[language]}`;
        const nextCard: CardDescriptor = {
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
      const nextCard: CardDescriptor = { kind: "question", category: cat, questionId: questionObj.id, selectedPlayer: undefined };
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

      // Handle spotify category specially
      if (cat === "spotify") {
        const track = spotifyUrls.find((t) => t.id === questionId);
        const trackUrl = track?.url || "https://open.spotify.com";
        setPrompt(trackUrl);
        return;
      }

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
    setCategory,
    prompt,
    setPrompt,
    generatePrompt,
    currentCard,
    setCurrentCard,
    getRoomBroadcastState,
    applyRoomBroadcastState,
    availableRules,
    activeRules,
    repelMessage,
    repelActive,
    showActiveRules,
    setShowActiveRules,
    translations,
    // Card queue API
    prefillCardQueue,
    advanceCardQueue,
    getQueueLength,
  };
}