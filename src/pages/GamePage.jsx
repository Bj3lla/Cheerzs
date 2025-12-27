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

  const ablyRef = useRef(null);
  const channelRef = useRef(null);


  const i18n = translations[language];

  useEffect(() => {
    if (isRoomGame) return;
    if (gameStarted && !prompt) {
      generatePrompt();
    }
  }, [isRoomGame, gameStarted, prompt, generatePrompt]);

  const fetchGameState = async () => {
    if (!roomId) return;

    try {
      const res = await fetch(`/api/game-state?roomID=${encodeURIComponent(roomId)}`);
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

  const publishCurrentCard = async (card) => {
    if (!roomId || !username) return;
    if (!card) return;

    try {
      await fetch("/api/draw-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID: roomId, username, state: { card } }),
      });
    } catch {
      // ignore
    }
  };

  const hostNext = async () => {
    if (!isHost) return;
    const card = generatePrompt();
    await publishCurrentCard(card);
  };

  const fetchRoomState = async () => {
    if (!roomId) return;

    try {
      const res = await fetch(`/api/room-state?roomID=${encodeURIComponent(roomId)}`);
      const data = await res.json().catch(() => null);
      if (res.status === 404) {
        clearRoomSession();
        setGameStarted(false);
        navigate("/");
        return;
      }
      if (!res.ok) return;

      const nextPlayers = Array.isArray(data?.players) ? data.players : [];
      setRoomSession({ roomID: roomId, players: nextPlayers });
    } catch {
      // ignore (room sync is best-effort)
    }
  };

  const heartbeat = async () => {
    if (!roomId || !username) return;

    try {
      await fetch("/api/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID: roomId, username }),
      });
    } catch {
      // ignore
    }
  };

  const sendLeaveBeacon = () => {
    if (!roomId || !username) return;

    try {
      const blob = new Blob([JSON.stringify({ roomID: roomId, username })], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/leave-room", blob);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!roomId) return;

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
  }, [roomId, username]);

  useEffect(() => {
    if (!roomId) return;

    const ably = new Ably.Realtime({ authUrl: "/api/ably-auth" });
    ablyRef.current = ably;

    const channel = ably.channels.get(`room-${roomId}`);
    channelRef.current = channel;

    const refetch = () => {
      fetchRoomState();
    };

    channel.subscribe("card-updated", (msg) => {
      const nextState = msg?.data?.state;
      if (nextState) applyRoomBroadcastState(nextState, language);
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
  }, [roomId, language]);

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
      const card = generatePrompt();
      await publishCurrentCard(card);
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
            categoryColors[repelActive ? "repeal" : category] ||
            "var(--dark)",
        }}
      >
        {repelActive
          ? i18n.categories.repeal
          : i18n.categories[category] || ""}
      </h2>

        <Card
          prompt={repelActive ? repelMessage : prompt || i18n.ui.pressNext}
          category={repelActive ? "repeal" : category}
        />

      <Button
        label={i18n.ui.next}
        color="primary"
        onClick={isRoomGame ? hostNext : generatePrompt}
        size="large"
        disabled={isRoomGame && !isHost}
      />

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
