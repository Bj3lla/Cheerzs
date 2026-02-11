import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";
import Button from "../components/Button";
import Card from "../components/Card";
import LateJoinPopup from "../components/LateJoinPopup";
import LeaveRoomPopup from "../components/LeaveRoomPopup";
import { useGame } from "../context/GameContext";
import { categoryColors } from "../utils/gameUtils";
import { translations } from "../locales/translations";
import type { LanguageCode } from "../hooks/useLanguage";
import SpotifyCard from "../components/SpotifyCard";
import { useConvexRoom } from "../hooks/useConvexRoom";
import { useConvexGame } from "../hooks/useConvexGame";
import type { Id } from "../../convex/_generated/dataModel";

export default function GamePage({ language }: { language: LanguageCode }) {
  const {
    gameStarted,
    category,
    setCategory,
    prompt,
    setPrompt,
    generatePrompt,
    currentCard,
    setCurrentCard,
    getRoomBroadcastState,
    applyRoomBroadcastState,
    activeRules,
    repelMessage,
    repelActive,
    showActiveRules,
    setShowActiveRules: _setShowActiveRules,
    roomId,
    playersForPrompts,
    setRoomSession,
    clearRoomSession,
    setGameStarted,
  } = useGame();

  const navigate = useNavigate();
  const location = useLocation();

  const username = useMemo(() => {
    return localStorage.getItem("playerName") || "";
  }, []);

  const playerId = useMemo(() => {
    return localStorage.getItem("playerId") || "";
  }, []);

  const normalizedRoomID = useMemo(() => {
    return typeof roomId === "string" ? roomId.trim().toUpperCase() : "";
  }, [roomId]);

  // Convex real-time subscriptions
  const { room, players: playerRecords, leaveRoom: leaveRoomMutation, updatePlayerStatus } = useConvexRoom(normalizedRoomID);
  const roomIdTyped = room?._id as Id<"rooms"> | undefined;
  const { gameState, seq, updateGameState, drawCard: drawCardFromConvex } = useConvexGame(roomIdTyped);

  const [roomHost, setRoomHost] = useState("");
  const isRoomGame = Boolean(roomId);
  const isHost = Boolean(isRoomGame && playerId && room?.hostId && playerId === room.hostId);

  const isSyncing = Boolean(isRoomGame && !currentCard);

  const lastSeqRef = useRef(0);
  const lastAppliedLanguageRef = useRef(language);
  const initialLanguageRef = useRef(language);
  const startedAtRef = useRef("");

  const [lateJoinMessage, setLateJoinMessage] = useState("");
  const [showLateJoinPopup, setShowLateJoinPopup] = useState(false);
  const [showLeaveRoomPopup, setShowLeaveRoomPopup] = useState(false);
  const [isDrawingCard, setIsDrawingCard] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);

  const drawCardInFlightRef = useRef(false);

  const i18n = translations[language] || translations.en;
  const isRepealCard = Boolean(repelActive || category === "repeal");

  const cardPrompt = isSyncing
    ? i18n.ui.loading || "Loading..."
    : isRepealCard
      ? repelMessage || prompt
      : prompt || i18n.ui.pressNext;

  useEffect(() => {
    // Guard against manual URL navigation.
    // Multiplayer requires both username + roomID; single-mode requires gameStarted.
    if (isRoomGame) {
      if (!username || !normalizedRoomID) {
        clearRoomSession();
        setGameStarted(false);
        navigate("/", { replace: true });
      }
      return;
    }

    if (!gameStarted) {
      navigate("/", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted, isRoomGame, normalizedRoomID, username]);

  useEffect(() => {
    if (isRoomGame) return;
    if (gameStarted && !prompt) {
      generatePrompt();
    }
  }, [isRoomGame, gameStarted, prompt, generatePrompt]);

  useEffect(() => {
    if (!isRoomGame) return;
    if (!gameState) return;

    const nextSeq = seq ?? 0;
    const isNewer = Number.isFinite(nextSeq) && nextSeq > lastSeqRef.current;
    const isSameButNewLanguage =
      Number.isFinite(nextSeq) &&
      nextSeq === lastSeqRef.current &&
      language !== lastAppliedLanguageRef.current;

    if ((isNewer || isSameButNewLanguage) && gameState) {
      if (isNewer) lastSeqRef.current = nextSeq;
      lastAppliedLanguageRef.current = language;

      const startedAt = typeof gameState?.startedAt === "string" ? gameState.startedAt : "";
      if (startedAt) startedAtRef.current = startedAt;

      applyRoomBroadcastState(gameState, language);
    }
  }, [isRoomGame, gameState, seq, language, applyRoomBroadcastState]);

  const publishCurrentRoomState = async (retryCount = 0, isRetryCall = false): Promise<boolean> => {
    if (!playerId || !roomIdTyped) return false;

    const state = getRoomBroadcastState();
    if (!state || typeof state !== "object") return false;
    if (!state.card) return false;

    // Prevent overlapping API calls (but allow retry calls to proceed)
    if (!isRetryCall && drawCardInFlightRef.current) return false;

    drawCardInFlightRef.current = true;
    setIsDrawingCard(true);
    if (!isRetryCall) setPublishError(""); // Clear any previous errors only on first attempt

    const maxRetries = 3;
    const baseDelay = 500; // ms

    try {
      const result = await updateGameState(playerId, state);

      if (!result.success) {
        throw new Error(result.error || "Failed to update game state");
      }

      // Success - reset state and add smooth transition delay
      setIsRetrying(false);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      drawCardInFlightRef.current = false;
      setIsDrawingCard(false);
      return true;
    } catch (error) {
      console.error(`[publishCurrentRoomState] Attempt ${retryCount + 1} failed:`, error);
      
      // If we haven't exceeded max retries, try again with exponential backoff
      if (retryCount < maxRetries) {
        setIsRetrying(true);
        const delay = baseDelay * Math.pow(2, retryCount);
        console.log(`[publishCurrentRoomState] Retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Keep the lock held and recursively retry (isRetryCall=true bypasses lock check)
        return await publishCurrentRoomState(retryCount + 1, true);
      }
      
      // All retries exhausted - show error to host
      setIsRetrying(false);
      const errorMsg = i18n.ui.cardPublishError || 
        "Failed to sync card with other players. They may see a different card. Please try clicking Next again.";
      setPublishError(errorMsg);
      
      drawCardInFlightRef.current = false;
      setIsDrawingCard(false);
      return false;
    }
  };

  const hostNext = async () => {
    if (!isHost) return;
    if (drawCardInFlightRef.current) return; // Prevent spam clicks
    
    // For multiplayer games, draw a card from Convex instead of using local data
    if (isRoomGame && roomIdTyped) {
      setIsDrawingCard(true);
      drawCardInFlightRef.current = true;
      setPublishError("");
      
      try {
        const result = await drawCardFromConvex();
        
        if (!result.success) {
          setPublishError(result.error || "Failed to draw card from database");
          drawCardInFlightRef.current = false;
          setIsDrawingCard(false);
          return;
        }
        
        // Success - card is now in room.currentCard and will be synced via useEffect
        await new Promise(resolve => setTimeout(resolve, 300));
        
        drawCardInFlightRef.current = false;
        setIsDrawingCard(false);
      } catch (error) {
        console.error("[hostNext] Failed to draw card:", error);
        setPublishError("Failed to draw card from database");
        drawCardInFlightRef.current = false;
        setIsDrawingCard(false);
      }
    } else {
      // Single player mode - use local generation
      generatePrompt();
      const success = await publishCurrentRoomState();
      
      if (!success) {
        console.warn("[hostNext] Failed to publish card state after all retries");
      }
    }
  };

  // Update room session from Convex subscription
  useEffect(() => {
    if (!room || !playerRecords) return;

    const nextPlayers = playerRecords.map(p => p.name);
    setRoomSession({ roomID: normalizedRoomID, players: nextPlayers });
  }, [room, playerRecords, normalizedRoomID, setRoomSession]);

  // Sync currentCard from Convex to local state (for host and non-host players)
  useEffect(() => {
    if (!isRoomGame || !room?.currentCard) return;
    
    const convexCard = room.currentCard;
    const cardData = convexCard.content;
    
    if (!cardData) return;
    
    // Map Convex card to local format
    if (convexCard.type === 'song') {
      setCategory('spotify');
      setPrompt(cardData.spotifyUrl || '');
      const selectedPlayer = playersForPrompts.length > 0 ? getRandomItem(playersForPrompts) : null;
      setCurrentCard({
        kind: 'question',
        category: 'spotify',
        questionId: cardData._id,
        selectedPlayer,
      } as any);
    } else if (['truth', 'dare', 'neverHaveIEver', 'pointingGame', 'drinkingBuddy'].includes(convexCard.type)) {
      const cat = convexCard.type === 'neverHaveIEver' ? 'never' : 
                  convexCard.type === 'pointingGame' ? 'point' :
                  convexCard.type === 'drinkingBuddy' ? 'drinkingbuddy' : convexCard.type;
      const text = language === 'en' ? cardData.textEn : cardData.textNo;
      
      setCategory(cat as any);
      
      if (convexCard.type === 'drinkingBuddy') {
        const { p1, p2 } = pickTwoDifferentPlayers(playersForPrompts);
        setPrompt(p1 && p2 ? `${p1}${i18n.ui.and}${p2} ${text}` : text);
        setCurrentCard({ kind: 'drinkingbuddy', p1, p2 } as any);
      } else {
        const selectedPlayer = playersForPrompts.length > 0 ? getRandomItem(playersForPrompts) : null;
        if (selectedPlayer && ['truth', 'dare'].includes(convexCard.type)) {
          setPrompt(`${selectedPlayer}, ${text}`);
        } else if (convexCard.type === 'pointingGame') {
          setPrompt(text); // Text already contains the pointing instruction
        } else {
          setPrompt(text);
        }
        setCurrentCard({
          kind: 'question',
          category: cat,
          questionId: cardData._id,
          selectedPlayer,
        } as any);
      }
    } else if (convexCard.type === 'wildcard') {
      const selectedPlayer = cardData.type === 'onePlayer' && playersForPrompts.length > 0 
        ? getRandomItem(playersForPrompts) : null;
      const text = language === 'en' ? cardData.textEn : cardData.textNo;
      
      setCategory('wildcard');
      setPrompt(selectedPlayer ? `${selectedPlayer}, ${text}` : text);
      setCurrentCard({
        kind: 'wildcard',
        questionId: cardData._id,
        selectedPlayer,
      } as any);
    } else if (convexCard.type === 'newRule') {
      const text = language === 'en' ? cardData.textEn : cardData.textNo;
      setCategory('rule');
      setPrompt(text);
      setCurrentCard({
        kind: 'rule',
        ruleId: cardData._id,
      } as any);
    }
  }, [room?.currentCard, isRoomGame, playersForPrompts, language, i18n]);
  
  // Helper function to pick two different players
  const pickTwoDifferentPlayers = (players: string[]) => {
    if (!Array.isArray(players) || players.length < 2) return { p1: null, p2: null };
    const p1 = players[Math.floor(Math.random() * players.length)];
    const remaining = players.filter((p) => p !== p1);
    const p2 = remaining.length > 0 ? remaining[Math.floor(Math.random() * remaining.length)] : null;
    return { p1, p2 };
  };
  
  const getRandomItem = <T,>(arr: T[]): T => {
    return arr[Math.floor(Math.random() * arr.length)];
  };

  const leaveFromGamePage = async () => {
    if (!isRoomGame || !roomIdTyped || !playerId) {
      setGameStarted(false);
      navigate("/join-room");
      return;
    }

    // Host should be able to go back to the waiting room without deleting the room.
    if (isHost) {
      setGameStarted(false);
      navigate(`/room/${encodeURIComponent(normalizedRoomID)}`);
      return;
    }

    // Non-host: actually leave the room/game.
    try {
      await leaveRoomMutation(roomIdTyped, playerId);
    } catch (err) {
      console.error("[leaveFromGamePage] Failed to leave room:", err);
    } finally {
      clearRoomSession();
      setGameStarted(false);
      localStorage.removeItem("playerId");
      localStorage.removeItem("playerRoomId");
      navigate("/join-room");
    }
  };

  // Update player online status (heartbeat)
  useEffect(() => {
    if (!roomIdTyped || !playerId) return;

    // Mark as online when joining
    updatePlayerStatus(roomIdTyped, playerId, true);

    // Heartbeat interval
    const heartbeatInterval = setInterval(() => {
      updatePlayerStatus(roomIdTyped, playerId, true);
    }, 30 * 1000); // Every 30 seconds

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updatePlayerStatus(roomIdTyped, playerId, true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Beacon on page unload
    const handleBeforeUnload = () => {
      if (!isHost) {
        try {
          // Use sendBeacon for reliable delivery on page close
          navigator.sendBeacon(
            `/api/leave-room`,
            JSON.stringify({ roomID: normalizedRoomID, username, playerId })
          );
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("pagehide", handleBeforeUnload);

    // Cleanup
    return () => {
      clearInterval(heartbeatInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handleBeforeUnload);
    };
  }, [roomIdTyped, playerId, updatePlayerStatus, isHost, normalizedRoomID, username]);

  // Redirect if room deleted or player removed
  useEffect(() => {
    if (!isRoomGame) return;

    // Room deleted
    if (room === null && normalizedRoomID) {
      clearRoomSession();
      setGameStarted(false);
      navigate("/");
      return;
    }

    // Player removed from room
    if (room && playerId && playerRecords && !playerRecords.some(p => p.playerId === playerId)) {
      clearRoomSession();
      setGameStarted(false);
      localStorage.removeItem("playerId");
      localStorage.removeItem("playerRoomId");
      navigate("/join-room", { replace: true });
      return;
    }
  }, [isRoomGame, room, playerRecords, normalizedRoomID, playerId, clearRoomSession, setGameStarted, navigate]);

  useEffect(() => {
    if (!isRoomGame) return;
    if (!normalizedRoomID) return;
    if (!username) return;
    if (isHost) return;

    // Only show this for players who truly joined after the game started.
    // Players that were already in the waiting room get marked as joined-before-start.
    let joinedBeforeStartRoomId = "";
    try {
      joinedBeforeStartRoomId = sessionStorage.getItem("joinedBeforeStartRoomId") || "";
    } catch {
      joinedBeforeStartRoomId = "";
    }
    if (joinedBeforeStartRoomId === normalizedRoomID) return;

    const lateJoinFromNav = Boolean(location?.state?.lateJoin);
    if (!lateJoinFromNav) return;

    const startedAtFromNav = typeof location?.state?.startedAt === "string" ? location.state.startedAt : "";
    const startedAt = startedAtFromNav || startedAtRef.current;
    const startedAtMs = startedAt ? Date.parse(startedAt) : NaN;
    if (!Number.isFinite(startedAtMs)) return;

    const minutesLate = Math.max(0, Math.floor((Date.now() - startedAtMs) / 60000));

    const penalty =
      minutesLate < 5
        ? i18n.ui.penalty3 || "drink 3 sips"
        : minutesLate < 7
          ? i18n.ui.penalty5 || "drink 5 sips"
          : minutesLate < 10
            ? i18n.ui.penalty7 || "drink 7 sips"
            : i18n.ui.penaltyShot || "take a shot";

    const shownKey = `latePenaltyShown:${normalizedRoomID}:${username}`;
    try {
      if (sessionStorage.getItem(shownKey)) return;
      sessionStorage.setItem(shownKey, "1");
    } catch {
      // ignore
    }

    setLateJoinMessage(
      (i18n.ui.lateJoinPenaltyMessage || "Ops! You're late to the party, so unfortunatly, you have to {penalty}")
        .replace("{penalty}", penalty)
    );
    setShowLateJoinPopup(true);
  }, [i18n, isRoomGame, normalizedRoomID, username, isHost, location]);

  useEffect(() => {
    // Host: if game starts and there is no current card stored yet, draw the first card.
    if (!isRoomGame) return;
    if (!gameStarted) return;
    if (!isHost) return;
    if (currentCard) return;
    if (!roomIdTyped) return;

    (async () => {
      setIsDrawingCard(true);
      drawCardInFlightRef.current = true;
      
      try {
        const result = await drawCardFromConvex();
        
        if (!result.success) {
          console.error("[GamePage] Failed to draw initial card:", result.error);
        }
        
        // Wait a moment for Convex subscription to sync the card
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error("[GamePage] Failed to draw initial card:", error);
      } finally {
        drawCardInFlightRef.current = false;
        setIsDrawingCard(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRoomGame, gameStarted, isHost, roomIdTyped]);

  return (
    <div className="game-screen">
      {showLateJoinPopup && lateJoinMessage && (
        <LateJoinPopup
          message={lateJoinMessage}
          onClose={() => setShowLateJoinPopup(false)}
          language={language}
        />
      )}

      {showLeaveRoomPopup && (
        <LeaveRoomPopup
          language={language}
          onClose={() => setShowLeaveRoomPopup(false)}
          onConfirm={() => {
            setShowLeaveRoomPopup(false);
            void leaveFromGamePage();
          }}
        />
      )}
      <div className="top-bar">
        <button
          type="button"
          className="button"
          onClick={() => {
            if (isHost) {
              leaveFromGamePage();
              return;
            } else {
              setShowLeaveRoomPopup(true);
            }
          }}
          aria-label={i18n.ui.leaveGame}
          title={i18n.ui.leaveGame}
        >
          <IoArrowBack size={24} />
        </button>

        {isRoomGame && normalizedRoomID && (
          <p className="room-id-header">{i18n.ui.roomID}{normalizedRoomID}</p>
        )}
      </div>
      <h2
        className="category-header"
        style={{
          color:
            categoryColors[isRepealCard ? "repeal" : category] ||
            "var(--dark)",
        }}
      >
        {isRepealCard
          ? i18n.categories.repeal
          : i18n.categories[category] || ""}
      </h2>

      {isSyncing && (
        <div className="sync-loading" aria-label="Syncing game state">
          <div className="sync-loading-bar" />
        </div>
      )}

      {String(category) === "spotify" ? (
        <SpotifyCard
          trackID={
            currentCard && 'questionId' in currentCard 
              ? (typeof currentCard.questionId === 'number' ? currentCard.questionId : Number(currentCard.questionId) || 0)
              : 0
          }
          trackUrl={prompt}
          language={language}
          selectedPlayer={
            currentCard && 'selectedPlayer' in currentCard ? currentCard.selectedPlayer : null
          }
        />
      ) : (
        <Card prompt={cardPrompt} />
      )}

      {(!isRoomGame || isHost) && (
        <>
          {publishError && (
            <div className="error-message publish-error" style={{ 
              marginBottom: "1rem", 
              padding: "0.75rem", 
              backgroundColor: "rgba(255, 59, 48, 0.1)",
              border: "1px solid rgba(255, 59, 48, 0.3)",
              borderRadius: "8px",
              color: "#ff3b30"
            }}>
              {publishError}
            </div>
          )}
          <Button
            label={
              isRoomGame && isRetrying 
                ? (i18n.ui.retrying || "Retrying...") 
                : i18n.ui.next
            }
            color="primary"
            onClick={isRoomGame ? hostNext : generatePrompt}
            size="large"
            disabled={isRoomGame && isDrawingCard}
          />
        </>
      )}

      {activeRules.length > 0 && (
        <div className="active-rules-container">
          <div
            className="active-rules-header"
            // onClick={() => _setShowActiveRules((prev) => !prev)}
            style={{ cursor: "pointer" }}
          >
            <h3>{i18n.ui.activeRules}</h3>
            <span className="toggle-icon">
              {/* {showActiveRules ? (
                <BsChevronCompactUp fontSize={24} />
              ) : (
                <BsChevronCompactDown fontSize={24} />
              )} */}
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
