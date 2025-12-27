import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Ably from "ably";
import Button from "../components/Button";
import Card from "../components/Card";
import Topbar from "../components/Topbar";
import { useGame } from "../context/GameContext";
import { categoryColors } from "../utils/gameUtils";
import { translations } from "../locales/translations";

export default function GamePage({ language }) {
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
    setShowActiveRules,
    roomId,
    setRoomSession,
    clearRoomSession,
    setGameStarted,
  } = useGame();

  const navigate = useNavigate();

  const username = useMemo(() => {
    return localStorage.getItem("playerName") || "";
  }, []);

  const [roomHost, setRoomHost] = useState("");
  const isRoomGame = Boolean(roomId);
  const isHost = Boolean(isRoomGame && username && roomHost && username === roomHost);

  const normalizedRoomID = useMemo(() => {
    return typeof roomId === "string" ? roomId.trim().toUpperCase() : "";
  }, [roomId]);

  const isSyncing = Boolean(isRoomGame && gameStarted && !currentCard);

  const ablyRef = useRef(null);
  const channelRef = useRef(null);


  const i18n = translations[language];
  const isRepealCard = Boolean(repelActive || category === "repeal");

  const cardPrompt = isSyncing
    ? i18n.ui.loading || "Loading..."
    : isRepealCard
      ? repelMessage || prompt
      : prompt || i18n.ui.pressNext;

  useEffect(() => {
    if (isRoomGame) return;
    if (gameStarted && !prompt) {
      generatePrompt();
    }
  }, [isRoomGame, gameStarted, prompt, generatePrompt]);

  const fetchGameState = async () => {
    if (!normalizedRoomID) return;

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

      if (data?.state) {
        applyRoomBroadcastState(data.state, language);
      }
    } catch {
      // ignore
    }
  };

  const publishCurrentRoomState = async () => {
    if (!normalizedRoomID || !username) return;

    const state = getRoomBroadcastState();
    if (!state || typeof state !== "object") return;
    if (!state.card) return;

    try {
      await fetch("/api/draw-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID: normalizedRoomID, username, state }),
      });
    } catch {
      // ignore
    }
  };

  const hostNext = async () => {
    if (!isHost) return;
    generatePrompt();
    await publishCurrentRoomState();
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

  const heartbeat = async () => {
    if (!normalizedRoomID || !username) return;

    try {
      await fetch("/api/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID: normalizedRoomID, username }),
      });
    } catch {
      // ignore
    }
  };

  const sendLeaveBeacon = () => {
    if (!normalizedRoomID || !username) return;

    try {
      const blob = new Blob([JSON.stringify({ roomID: normalizedRoomID, username })], {
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
      authUrl: `/api/ably-auth?roomID=${encodeURIComponent(normalizedRoomID)}&username=${encodeURIComponent(username)}`,
    });
    ablyRef.current = ably;

    const channel = ably.channels.get(`room-${normalizedRoomID}`);
    channelRef.current = channel;

    const refetch = () => {
      fetchRoomState();
    };

    channel.subscribe("card-updated", (msg) => {
      // DB is the source of truth; Ably is only used to notify clients to refetch.
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
      await publishCurrentRoomState();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRoomGame, gameStarted, isHost]);

  return (
    <div className="game-screen">
      <Topbar />
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

      <Card
        prompt={cardPrompt}
        category={isRepealCard ? "repeal" : category}
      />

      {(!isRoomGame || isHost) && (
        <Button
          label={i18n.ui.next}
          color="primary"
          onClick={isRoomGame ? hostNext : generatePrompt}
          size="large"
        />
      )}

      {activeRules.length > 0 && (
        <div className="active-rules-container">
          <div
            className="active-rules-header"
            // onClick={() => setShowActiveRules((prev) => !prev)}
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
