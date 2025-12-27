import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Ably from "ably";
import Button from "../components/Button";
import { useGame } from "../context/GameContext";

export default function WaitingRoomPage() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { setGameStarted, setRoomSession, clearRoomSession } = useGame();

  const username = useMemo(() => {
    return localStorage.getItem("playerName") || "";
  }, []);

  const [host, setHost] = useState("");
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const ablyRef = useRef(null);
  const channelRef = useRef(null);

  const isHost = Boolean(username) && Boolean(host) && username === host;

  const fetchRoomState = async () => {
    if (!roomId) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/room-state?roomID=${encodeURIComponent(roomId)}`);
      const data = await res.json().catch(() => null);

      if (res.status === 404) {
        // Room deleted (likely host left). Kick back to Home.
        clearRoomSession();
        setGameStarted(false);
        navigate("/");
        return;
      }

      if (!res.ok) {
        setError((data && data.error) || "Failed to load room");
        setPlayers([]);
        setHost("");
        return;
      }

      setHost(data.host || "");
      const nextPlayers = Array.isArray(data.players) ? data.players : [];
      setPlayers(nextPlayers);
      setRoomSession({ roomID: roomId, players: nextPlayers });
    } catch (err) {
      console.error("[WaitingRoom] room-state failed", err);
      setError("Failed to load room");
    } finally {
      setLoading(false);
    }
  };

  const leaveGame = async () => {
    if (!roomId || !username) {
      clearRoomSession();
      setGameStarted(false);
      navigate(-1);
      return;
    }

    setError("");

    try {
      const res = await fetch("/api/leave-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID: roomId, username }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && data.error) || "Failed to leave room");
        return;
      }

      clearRoomSession();
      setGameStarted(false);

      if (data?.roomDeleted) {
        navigate("/");
      } else {
        navigate(-1);
      }
    } catch (err) {
      console.error("[WaitingRoom] leave-room failed", err);
      setError("Failed to leave room");
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
    } catch (err) {
      console.warn("[WaitingRoom] heartbeat failed", err);
    }
  };

  const sendLeaveBeacon = () => {
    if (!roomId || !username) return;

    try {
      const blob = new Blob([
        JSON.stringify({ roomID: roomId, username }),
      ], { type: "application/json" });
      navigator.sendBeacon("/api/leave-room", blob);
    } catch (err) {
      // ignore
    }
  };

  const startGame = async () => {
    if (!roomId || !username) return;

    try {
      const res = await fetch("/api/start-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID: roomId, username }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && data.error) || "Failed to start game");
        return;
      }

      // Host will also receive the Ably event, but this removes perceived latency.
      // Pull latest players into game state before entering /game.
      await fetchRoomState();
      setGameStarted(true);
      navigate("/game");
    } catch (err) {
      console.error("[WaitingRoom] start-game failed", err);
      setError("Failed to start game");
    }
  };

  const removePlayer = async (targetUsername) => {
    if (!roomId || !username) return;
    if (!isHost) return;
    if (!targetUsername) return;

    try {
      const res = await fetch("/api/remove-player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomID: roomId, username, targetUsername }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && data.error) || "Failed to remove player");
        return;
      }

      await fetchRoomState();
    } catch (err) {
      console.error("[WaitingRoom] remove-player failed", err);
      setError("Failed to remove player");
    }
  };

  useEffect(() => {
    fetchRoomState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    // Presence handling
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

    const ably = new Ably.Realtime({
      authUrl: `/api/ably-auth?roomID=${encodeURIComponent(roomId)}&username=${encodeURIComponent(username)}`,
    });
    ablyRef.current = ably;

    const channel = ably.channels.get(`room-${roomId}`);
    channelRef.current = channel;

    const refetch = () => {
      fetchRoomState();
    };

    channel.subscribe("player-joined", refetch);
    channel.subscribe("player-left", refetch);
    channel.subscribe("player-removed", refetch);
    channel.subscribe("room-created", refetch);

    channel.subscribe("room-deleted", () => {
      clearRoomSession();
      setGameStarted(false);
      navigate("/");
    });

    channel.subscribe("game-started", async () => {
      await fetchRoomState();
      setGameStarted(true);
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
  }, [roomId]);

  return (
    <div className="waiting-room-page">
      <div className="top-bar">
        <button
          type="button"
          className="dark-border small"
          onClick={leaveGame}
          aria-label="Leave game"
          title="Leave game"
        >
          Leave game
        </button>
      </div>

      <h2 className="waiting-room-title">Room: {roomId}</h2>

      {loading && <p>Loading...</p>}
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
              label="Start Game"
              color="primary"
              onClick={startGame}
              size="large"
              disabled={!isHost}
            />
          </div>
        </>
      )}
    </div>
  );
}
