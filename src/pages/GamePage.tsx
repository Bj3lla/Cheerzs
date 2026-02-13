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
  const { gameState, seq, updateGameState } = useConvexGame(roomIdTyped);

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
    console.log("[GamePage] hostNext START", { isHost, isRoomGame, roomId: roomIdTyped, playerId });
    
    if (isRoomGame && !isHost) {
      console.log("[GamePage] hostNext: not host in room game, skipping");
      return;
    }
    if (drawCardInFlightRef.current) {
      console.log("[GamePage] hostNext: already in flight, preventing spam clicks");
      return;
    }
    
    // Use useGameLogic's generatePrompt for ALL modes (single + multiplayer).
    // generatePrompt() handles: category selection, question picking from local decks,
    // rule management (expiry/repeal), player assignment, and broadcastStateRef update.
    console.log("[GamePage] hostNext: calling generatePrompt()");
    generatePrompt();
    
    // For room games, publish the state to Convex so non-host players get the update
    // via the gameState subscription → applyRoomBroadcastState flow.
    if (isRoomGame && roomIdTyped) {
      console.log("[GamePage] hostNext: publishing state to Convex for multiplayer sync");
      const success = await publishCurrentRoomState();
      if (!success) {
        console.warn("[GamePage] hostNext: failed to publish card state after all retries");
      }
    }
    
    console.log("[GamePage] hostNext: completed");
  };

  // Update room session from Convex subscription
  const playersArray = useMemo(() => {
    return playerRecords?.map(p => p.name) || [];
  }, [playerRecords]);

  useEffect(() => {
    if (!room || !playerRecords || playersArray.length === 0) return;

    setRoomSession({ roomID: normalizedRoomID, players: playersArray });
  }, [room?.status, normalizedRoomID, playersArray]);

  // NOTE: Card sync from Convex to local state is handled by the gameState
  // useEffect above (line ~131) which calls applyRoomBroadcastState.
  // The host uses generatePrompt() locally → publishCurrentRoomState() → updateGameState
  // → which updates room.gameState → all clients sync via applyRoomBroadcastState.

  const leaveFromGamePage = async () => {
    console.log("[GamePage] leaveFromGamePage START", { isRoomGame, isHost, roomId: roomIdTyped, playerId });
    
    if (!isRoomGame || !roomIdTyped || !playerId) {
      console.log("[GamePage] leaveFromGamePage: not room game or missing data, navigating to join-room");
      setGameStarted(false);
      navigate("/join-room");
      return;
    }

    // Host should be able to go back to the waiting room without deleting the room.
    if (isHost) {
      console.log("[GamePage] leaveFromGamePage: host returning to waiting room");
      setGameStarted(false);
      navigate(`/room/${encodeURIComponent(normalizedRoomID)}`);
      return;
    }

    // Non-host: actually leave the room/game.
    console.log("[GamePage] leaveFromGamePage: non-host leaving room");
    try {
      console.log("[GamePage] leaveFromGamePage: calling leaveRoomMutation");
      await leaveRoomMutation(roomIdTyped, playerId);
      console.log("[GamePage] leaveFromGamePage: leaveRoomMutation completed");
    } catch (err) {
      console.error("[GamePage] leaveFromGamePage: mutation failed", err);
    } finally {
      console.log("[GamePage] leaveFromGamePage: cleaning up session and navigating");
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

    // On page unload, mark player as offline via Convex
    const handleBeforeUnload = () => {
      if (!isHost && roomIdTyped) {
        // Best-effort: mark as offline. Convex cron cleanup handles stale players.
        updatePlayerStatus(roomIdTyped, playerId, false);
      }
    };
    window.addEventListener("pagehide", handleBeforeUnload);

    // Cleanup
    return () => {
      clearInterval(heartbeatInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handleBeforeUnload);
    };
  }, [roomIdTyped, playerId, updatePlayerStatus, isHost]);

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
    // Host: if game starts and there is no current card stored yet, draw the first card
    // using the same generatePrompt → publishCurrentRoomState flow as hostNext.
    if (!isRoomGame) return;
    if (!gameStarted) return;
    if (!isHost) return;
    if (currentCard) return;
    if (!roomIdTyped) return;

    console.log("[GamePage] Drawing initial card via generatePrompt");
    generatePrompt();
    
    // Publish immediately for multiplayer sync
    (async () => {
      const success = await publishCurrentRoomState();
      if (!success) {
        console.warn("[GamePage] Failed to publish initial card state");
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
