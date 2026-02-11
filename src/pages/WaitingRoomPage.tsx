import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../components/Button";
import CheerzsRulesPopup from "../components/CheerzsRulesPopup";
import { useGame } from "../context/GameContext";
import { translations } from "../locales/translations"; 
import type { LanguageCode } from "../hooks/useLanguage";
import { IoArrowBack } from "react-icons/io5";
import LeaveRoomPopup from "../components/LeaveRoomPopup";
import { useConvexRoom } from "../hooks/useConvexRoom";
import type { Id } from "../../convex/_generated/dataModel";

export default function WaitingRoomPage({ language = "en" }: { language?: LanguageCode }) {
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

  // Convex real-time subscription
  const { room, players: playerRecords, leaveRoom, updatePlayerStatus, startGame: startGameMutation } = useConvexRoom(normalizedRoomID);

  const [error, setError] = useState<string>("");
  const [showRulesPopup, setShowRulesPopup] = useState<boolean>(false);
  const [showLeaveRoomPopup, setShowLeaveRoomPopup] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const isHost = room?.hostId === playerId;
  const players = playerRecords?.map(p => p.name) || [];
  const host = playerRecords?.find(p => p.playerId === room?.hostId)?.name || "";
  const loading = room === undefined || playerRecords === undefined;

  // Redirect if no room or not logged in
  useEffect(() => {
    if (!normalizedRoomID || !username) {
      clearRoomSession();
      setGameStarted(false);
      navigate("/", { replace: true });
      return;
    }

    // Room not found (deleted or invalid)
    if (room === null) {
      clearRoomSession();
      setGameStarted(false);
      navigate("/", { replace: true });
      return;
    }
  }, [clearRoomSession, navigate, normalizedRoomID, setGameStarted, username, room]);

  // Update local game context when room data changes
  useEffect(() => {
    if (room && room.status !== "finished" && playerRecords) {
      setRoomSession({ 
        roomID: normalizedRoomID, 
        players: playerRecords.map(p => p.name) 
      });
    }
  }, [room, playerRecords, normalizedRoomID, setRoomSession]);

  // Handle game started state - navigate all players when status changes to "playing"
  useEffect(() => {
    if (room?.status === "playing") {
      // All players (including host) navigate when game starts
      setGameStarted(true);
      navigate("/game");
    }
  }, [room?.status, setGameStarted, navigate]);

  // Update player online status (heartbeat)
  useEffect(() => {
    if (!room?._id || !playerId) return;

    // Mark as online when joining
    updatePlayerStatus(room._id, playerId, true);

    // Heartbeat interval
    const heartbeatInterval = setInterval(() => {
      updatePlayerStatus(room._id, playerId, true);
    }, 30 * 1000); // Every 30 seconds

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updatePlayerStatus(room._id, playerId, true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup
    return () => {
      clearInterval(heartbeatInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [room?._id, playerId, updatePlayerStatus]);

  const handleLeaveRoom = async () => {
    const destination = isHost ? "/create-room" : "/join-room";

    if (!room?._id || !playerId) {
      clearRoomSession();
      setGameStarted(false);
      navigate(destination);
      return;
    }

    setError("");

    try {
      const result = await leaveRoom(room._id, playerId);
      
      if (!result.success) {
        setError(result.error || i18n.ui.failedToLeaveRoom);
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

  const handleStartGame = async () => {
    if (!room?._id || !playerId || !isHost) return;

    setIsStarting(true);
    setError("");

    try {
      const questionTypes = ["truth", "dare", "never_have_i_ever", "drinking_buddy", "wildcard"];
      const result = await startGameMutation(room._id, questionTypes);

      if (!result.success) {
        setError(result.error || i18n.ui.failedToStartGame);
        setIsStarting(false);
        return;
      }

      // Store session info (navigation will happen via useEffect when room status updates)
      try {
        sessionStorage.setItem("joinedBeforeStartRoomId", normalizedRoomID);
      } catch {
        // ignore
      }
      
      // Don't navigate here - let the useEffect handle it when room status updates
      // This ensures all players navigate together
    } catch (err) {
      console.error("[WaitingRoom] start-game failed", err);
      setError(i18n.ui.failedToStartGame);
      setIsStarting(false);
    }
  };

  const handleRemovePlayer = async (targetUsername: string) => {
    if (!room?._id || !playerId || !isHost || !targetUsername || !playerRecords) return;

    setError("");

    try {
      // Find the player's ID
      const targetPlayer = playerRecords.find(p => p.name === targetUsername);
      if (!targetPlayer) return;

      const result = await leaveRoom(room._id, targetPlayer.playerId);

      if (!result.success) {
        setError(result.error || i18n.ui.failedToRemovePlayer);
      }
    } catch (err) {
      console.error("[WaitingRoom] remove-player failed", err);
      setError(i18n.ui.failedToRemovePlayer);
    }
  };

  return (
    <div className="waiting-room-page">
      {showRulesPopup && (
        <CheerzsRulesPopup onClose={() => setShowRulesPopup(false)} language={language} />
      )}

      {showLeaveRoomPopup && (
        <LeaveRoomPopup
          language={language}
          onClose={() => setShowLeaveRoomPopup(false)}
          onConfirm={() => {
            setShowLeaveRoomPopup(false);
            void handleLeaveRoom();
          }}
        />
      )}

      <div className="top-bar">
        <button
          type="button"
          className="button"
          onClick={() => setShowLeaveRoomPopup(true)}
          aria-label={i18n.ui.leaveGame}
          title={i18n.ui.leaveGame}
        >
          <IoArrowBack size={24} />
        </button>
      </div>

      <h2 className="waiting-room-title">
        <span style={{ color: 'var(--dark)' }}>{i18n.ui.roomID}</span>
        {' '}
        <span style={{ color: 'var(--pink)' }}>{normalizedRoomID || roomId}</span>
      </h2>

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
                    onClick={() => handleRemovePlayer(name)}
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
              label={i18n.ui.gameRules || "Rules"}
              color="dark-border"
              onClick={() => setShowRulesPopup(true)}
              size="large"
            />

            {isHost ? (
              <Button
                label={i18n.ui.startGame}
                color="primary"
                onClick={handleStartGame}
                size="large"
                disabled={isStarting}
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
