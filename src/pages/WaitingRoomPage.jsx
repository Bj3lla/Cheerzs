import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Ably from "ably";
import Button from "../components/Button";
import CheerzsRulesPopup from "../components/CheerzsRulesPopup";
import { useGame } from "../context/GameContext";
import { translations } from "../locales/translations";

export default function WaitingRoomPage({ language = "en" }) {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { setGameStarted, setRoomSession, clearRoomSession } = useGame();

  const i18n = translations[language] || translations.en;

  const normalizedRoomID = useMemo(() => {
    return typeof roomId === "string" ? roomId.trim().toUpperCase() : "";
  }, [roomId]);

  const username = useMemo(() => {
    return localStorage.getItem("playerName") || "";
  }, []);

  const playerId = useMemo(() => {
    return localStorage.getItem("playerId") || "";
  }, []);

  const [host, setHost] = useState("");
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showRulesPopup, setShowRulesPopup] = useState(false);

  const ablyRef = useRef(null);
  const channelRef = useRef(null);
  const gameStateFetchInFlightRef = useRef(false);

  const isHost = Boolean(username) && Boolean(host) && username === host;

  useEffect(() => {
    if (!normalizedRoomID || !username) {
      clearRoomSession();
      setGameStarted(false);
      navigate("/", { replace: true });
    }
  }, [clearRoomSession, navigate, normalizedRoomID, setGameStarted, username]);

  const fetchRoomState = async () => {
    if (!normalizedRoomID) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/room-state?roomID=${encodeURIComponent(normalizedRoomID)}`);
      const data = await res.json().catch(() => null);

      if (res.status === 404) {
        // Room deleted (likely host left). Kick back to Home.
        clearRoomSession();
        setGameStarted(false);
        navigate("/");
        return;
      }

      if (!res.ok) {
        setError((data && data.error) || i18n.ui.failedToLoadRoom);
        setPlayers([]);
        setHost("");
        return;
      }

      const nextHost = data.host || "";
      const nextIsHost = Boolean(username) && Boolean(nextHost) && username === nextHost;

      setHost(nextHost);
      const nextPlayers = Array.isArray(data.players) ? data.players : [];
      setPlayers(nextPlayers);
      setRoomSession({ roomID: data?.roomID || normalizedRoomID, players: nextPlayers });

      // If someone opens the waiting room after the host already started the game,
      // skip straight to the game page.
      try {
        const gsRes = await fetch(`/api/game-state?roomID=${encodeURIComponent(normalizedRoomID)}`);
        const gsData = await gsRes.json().catch(() => null);
        const started = Boolean(gsData?.state?.started);
        // If someone opens the waiting room after the host already started the game,
        // only non-hosts should be forced into the game.
        if (gsRes.ok && started && !nextIsHost) {
          setGameStarted(true);
          navigate("/game");
          return;
        }
      } catch {
        // ignore
      }
    } catch (err) {
      console.error("[WaitingRoom] room-state failed", err);
      setError(i18n.ui.failedToLoadRoom);
    } finally {
      setLoading(false);
    }
  };

  const leaveGame = async () => {
    const destination = isHost ? "/create-room" : "/join-room";

    if (!normalizedRoomID || !username) {
      clearRoomSession();
      setGameStarted(false);
      navigate(destination);
      return;
    }

    setError("");

    try {
      const res = await fetch("/api/leave-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID: normalizedRoomID, username }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && data.error) || i18n.ui.failedToLeaveRoom);
        return;
      }

      clearRoomSession();
      setGameStarted(false);

      try {
        sessionStorage.removeItem("joinedBeforeStartRoomId");
      } catch {
        // ignore
      }

      localStorage.removeItem("playerId");
      localStorage.removeItem("playerRoomId");

      navigate(destination);
    } catch (err) {
      console.error("[WaitingRoom] leave-room failed", err);
      setError(i18n.ui.failedToLeaveRoom);
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
    } catch (err) {
      console.warn("[WaitingRoom] heartbeat failed", err);
    }
  };

  const startGame = async () => {
    if (!normalizedRoomID || !username) return;

    try {
      const res = await fetch("/api/start-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID: normalizedRoomID, username }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && data.error) || i18n.ui.failedToStartGame);
        return;
      }

      // Host will also receive the Ably event, but this removes perceived latency.
      // Pull latest players into game state before entering /game.
      await fetchRoomState();
      setGameStarted(true);
      navigate("/game");
    } catch (err) {
      console.error("[WaitingRoom] start-game failed", err);
      setError(i18n.ui.failedToStartGame);
    }
  };

  const removePlayer = async (targetUsername) => {
    if (!normalizedRoomID || !username) return;
    if (!isHost) return;
    if (!targetUsername) return;

    try {
      const res = await fetch("/api/remove-player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID: normalizedRoomID, username, targetUsername }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && data.error) || i18n.ui.failedToRemovePlayer);
        return;
      }

      await fetchRoomState();
    } catch (err) {
      console.error("[WaitingRoom] remove-player failed", err);
      setError(i18n.ui.failedToRemovePlayer);
    }
  };

  useEffect(() => {
    fetchRoomState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedRoomID]);

  useEffect(() => {
    // Presence handling
    heartbeat();
    const intervalId = window.setInterval(heartbeat, 5 * 60 * 1000);

    const onVisibilityChange = () => {
      if (!document.hidden) heartbeat();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
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
    channel.subscribe("room-created", refetch);

    channel.subscribe("card-updated", async (msg) => {
      // If the host is already in-game, redirect non-hosts.
      const startedFromEvent = Boolean(msg?.data?.state?.started);
      if (startedFromEvent && !isHost) {
        setGameStarted(true);
        navigate("/game");
        return;
      }

      // Fallback for older events that don't include state.
      if (gameStateFetchInFlightRef.current) return;
      gameStateFetchInFlightRef.current = true;
      try {
        const gsRes = await fetch(`/api/game-state?roomID=${encodeURIComponent(normalizedRoomID)}`);
        const gsData = await gsRes.json().catch(() => null);
        const started = Boolean(gsData?.state?.started);
        if (gsRes.ok && started && !isHost) {
          setGameStarted(true);
          navigate("/game");
        }
      } catch {
        // ignore
      } finally {
        gameStateFetchInFlightRef.current = false;
      }
    });

    channel.subscribe("room-deleted", () => {
      clearRoomSession();
      setGameStarted(false);
      navigate("/");
    });

    channel.subscribe("game-started", async () => {
      await fetchRoomState();
      setGameStarted(true);
      try {
        sessionStorage.setItem("joinedBeforeStartRoomId", normalizedRoomID);
      } catch {
        // ignore
      }
      navigate("/game");
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
  }, [normalizedRoomID, username]);

  return (
    <div className="waiting-room-page">
      {showRulesPopup && (
        <CheerzsRulesPopup onClose={() => setShowRulesPopup(false)} />
      )}
      <div className="top-bar">
        <button
          type="button"
          className="dark-border small"
          onClick={leaveGame}
          aria-label={i18n.ui.leaveGame}
          title={i18n.ui.leaveGame}
        >
          {i18n.ui.leaveGame}
        </button>
      </div>

      <h2 className="waiting-room-title">{i18n.ui.roomID}{normalizedRoomID || roomId}</h2>

      {loading && <p>{i18n.ui.loading}</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && !error && (
        <>
          <div className="friends-list">
            {players.map((name, index) => (
              <div key={`${name}-${index}`} className="friend-item">
                <span className="friend-name">{name}</span>
                {isHost && name !== host && (
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => removePlayer(name)}
                    aria-label={`Remove ${name}`}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="start-game-btn">
            <Button
              label={i18n.ui.rulesButton || "Rules"}
              color="light"
              onClick={() => setShowRulesPopup(true)}
              size="large"
            />

            {isHost ? (
              <Button
                label={i18n.ui.startGame}
                color="primary"
                onClick={startGame}
                size="large"
              />
            ) : (
              <p className="waiting-for-host-message">
                {i18n.ui.waitingForHostToStart || "Waiting for the host to start the game."}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
