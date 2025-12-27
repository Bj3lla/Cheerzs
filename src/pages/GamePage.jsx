import { useEffect, useMemo, useRef } from "react";
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

  const ablyRef = useRef(null);
  const channelRef = useRef(null);


  const i18n = translations[language];

  useEffect(() => {
    if (gameStarted && !prompt) {
      generatePrompt();
    }
  }, [gameStarted, prompt, generatePrompt]);

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

    channel.subscribe("player-joined", refetch);
    channel.subscribe("player-left", refetch);
    channel.subscribe("player-removed", refetch);

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
  }, [roomId]);

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
        onClick={generatePrompt}
        size="large"
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
