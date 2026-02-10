import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Ably from "ably";
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

export default function GamePage({ language }: { language: LanguageCode }) {
  const {
    gameStarted,
    category,
    prompt,
    generatePrompt,
    currentCard,
    getRoomBroadcastState,
    applyRoomBroadcastState,
    activeRules,
    repelMessage,
    repelActive,
    showActiveRules,
    setShowActiveRules: _setShowActiveRules,
    roomId,
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

  const [roomHost, setRoomHost] = useState("");
  const isRoomGame = Boolean(roomId);
  const isHost = Boolean(isRoomGame && username && roomHost && username === roomHost);

  const normalizedRoomID = useMemo(() => {
    return typeof roomId === "string" ? roomId.trim().toUpperCase() : "";
  }, [roomId]);

  const isSyncing = Boolean(isRoomGame && !currentCard);

  const ablyRef = useRef(null);
  const channelRef = useRef(null);

  const lastSeqRef = useRef(0);
  const lastAppliedLanguageRef = useRef(language);
  const fetchGameStateInFlightRef = useRef(false);
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

  const fetchGameState = async () => {
    if (!normalizedRoomID) return;

    if (fetchGameStateInFlightRef.current) return;
    fetchGameStateInFlightRef.current = true;

    try {
      const res = await fetch(`/api/game-state?roomID=${encodeURIComponent(normalizedRoomID)}`);
      const data = await res.json().catch(() => null);

      if (res.status === 404) {
        clearRoomSession();
        setGameStarted(false);
        navigate("/");
        return;
      }

      if (!res.ok) return;

      setRoomHost(data?.host || "");

      const nextSeq = Number(data?.seq || 0);
      const isNewer = Number.isFinite(nextSeq) && nextSeq > lastSeqRef.current;
      const isSameButNewLanguage =
        Number.isFinite(nextSeq) &&
        nextSeq === lastSeqRef.current &&
        language !== lastAppliedLanguageRef.current;

      if ((isNewer || isSameButNewLanguage) && data?.state) {
        if (isNewer) lastSeqRef.current = nextSeq;
        lastAppliedLanguageRef.current = language;

        const startedAt = typeof data.state?.startedAt === "string" ? data.state.startedAt : "";
        if (startedAt) startedAtRef.current = startedAt;

        applyRoomBroadcastState(data.state, language);
      }
    } catch {
      // ignore
    } finally {
      fetchGameStateInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (!isRoomGame) return;
    if (!normalizedRoomID) return;

    // When language changes mid-game, re-apply current state (same seq is OK).
    if (language === initialLanguageRef.current) return;
    initialLanguageRef.current = language;
    void fetchGameState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, isRoomGame, normalizedRoomID]);

  const publishCurrentRoomState = async (retryCount = 0, isRetryCall = false): Promise<boolean> => {
    if (!normalizedRoomID || !username) return false;

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
      const response = await fetch("/api/draw-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID: normalizedRoomID, username, playerId, state }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
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
    
    generatePrompt();
    const success = await publishCurrentRoomState();
    
    if (!success) {
      console.warn("[hostNext] Failed to publish card state after all retries");
      // The error message is already displayed via setPublishError in publishCurrentRoomState
    }
  };

  const fetchRoomState = async () => {
    if (!normalizedRoomID) return;

    try {
      const res = await fetch(`/api/room-state?roomID=${encodeURIComponent(normalizedRoomID)}`);
      const data = await res.json().catch(() => null);
      if (res.status === 404) {
        clearRoomSession();
        setGameStarted(false);
        navigate("/");
        return;
      }
      if (!res.ok) return;

      const nextPlayers = Array.isArray(data?.players) ? data.players : [];
      setRoomSession({ roomID: data?.roomID || normalizedRoomID, players: nextPlayers });
    } catch {
      // ignore (room sync is best-effort)
    }
  };

  const leaveFromGamePage = async () => {
    if (!isRoomGame || !normalizedRoomID || !username) {
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
      await fetch("/api/leave-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID: normalizedRoomID, username, playerId }),
      });
    } catch {
      // ignore
    } finally {
      clearRoomSession();
      setGameStarted(false);
      localStorage.removeItem("playerId");
      localStorage.removeItem("playerRoomId");
      navigate("/join-room");
    }
  };

  const heartbeat = async () => {
    if (!normalizedRoomID || !username) return;

    try {
      await fetch("/api/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID: normalizedRoomID, username, playerId }),
      });
    } catch {
      // ignore
    }
  };

  const sendLeaveBeacon = () => {
    if (!normalizedRoomID || !username) return;

    try {
      const blob = new Blob([JSON.stringify({ roomID: normalizedRoomID, username, playerId })], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/leave-room", blob);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!normalizedRoomID) return;

    // Load existing current card (supports reconnect / late join)
    fetchGameState();
    fetchRoomState();
    heartbeat();

    const intervalId = window.setInterval(heartbeat, 5 * 60 * 1000);
    const onVisibilityChange = () => {
      if (!document.hidden) heartbeat();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", sendLeaveBeacon);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", sendLeaveBeacon);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedRoomID, username]);

  useEffect(() => {
    if (!normalizedRoomID) return;

    const ably = new Ably.Realtime({
      authUrl: `/api/ably-auth?roomID=${encodeURIComponent(normalizedRoomID)}&username=${encodeURIComponent(username)}&playerId=${encodeURIComponent(playerId)}`,
    });
    ablyRef.current = ably;

    const channel = ably.channels.get(`room-${normalizedRoomID}`);
    channelRef.current = channel;

    const refetch = () => {
      fetchRoomState();
    };

    channel.subscribe("player-joined", refetch);
    channel.subscribe("player-left", refetch);
    channel.subscribe("player-removed", (msg) => {
      const removedUsername = msg?.data?.removedUsername;

      // If you were removed by the host, force you out of the room immediately.
      if (removedUsername && removedUsername === username) {
        clearRoomSession();
        setGameStarted(false);
        localStorage.removeItem("playerId");
        localStorage.removeItem("playerRoomId");
        navigate("/join-room", { replace: true });
        return;
      }

      refetch();
    });

    channel.subscribe("card-updated", (msg) => {
      const nextSeq = Number(msg?.data?.seq || 0);
      const hasNewerSeq = Number.isFinite(nextSeq) && nextSeq > lastSeqRef.current;

      // Fast path: apply the authoritative server-published state immediately.
      if (hasNewerSeq && msg?.data?.state && typeof msg.data.state === "object") {
        lastSeqRef.current = nextSeq;
        lastAppliedLanguageRef.current = language;

        if (typeof msg.data.state?.startedAt === "string") {
          startedAtRef.current = msg.data.state.startedAt;
        }

        applyRoomBroadcastState(msg.data.state, language);
        return;
      }

      // Fallback: DB is still the source of truth.
      void fetchGameState();
    });

    channel.subscribe("room-deleted", () => {
      clearRoomSession();
      setGameStarted(false);
      navigate("/");
    });

    return () => {
      channel.unsubscribe();
      try {
        channel.detach();
      } catch {
        // ignore
      }
      try {
        ably.close();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedRoomID, username, language]);

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
    if (!isRoomGame) return;
    if (!gameStarted) return;
    if (isHost) return;
    if (prompt) return;

    void fetchGameState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRoomGame, gameStarted, isHost, prompt]);

  useEffect(() => {
    // Host: if game starts and there is no current card stored yet, draw the first card and publish it.
    if (!isRoomGame) return;
    if (!gameStarted) return;
    if (!isHost) return;
    if (currentCard) return;

    (async () => {
      // Ensure we have host info (from DB) before drawing.
      await fetchGameState();
      if (roomHost && username !== roomHost) return;
      generatePrompt();
      const success = await publishCurrentRoomState();
      if (!success) {
        console.warn("[GamePage] Failed to publish initial card state");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRoomGame, gameStarted, isHost]);

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
