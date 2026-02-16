import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../components/Button";
import CheerzsRulesPopup from "../components/CheerzsRulesPopup";
import { useGame } from "../context/GameContext";
import { translations } from "../locales/translations"; 
import type { LanguageCode } from "../hooks/useLanguage";
import { IoArrowBack } from "react-icons/io5";
import LeaveRoomPopup from "../components/LeaveRoomPopup";
import { useConvexRoom } from "../hooks/useConvexRoom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export default function WaitingRoomPage({ language = "en" }: { language?: LanguageCode }) {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { setGameStarted, setRoomSession, clearRoomSession } = useGame();

  const i18n = translations[language] || translations.en;

  // Log that component mounted
  console.log("[WaitingRoom] Component rendered, roomId from URL:", roomId);

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
  const { room, players: playerRecords, leaveRoom, updatePlayerStatus } = useConvexRoom(normalizedRoomID);
  
  // Direct mutation calls for operations the hook doesn't provide
  const startGameDirectMutation = useMutation(api.rooms.startGame);

  const [error, setError] = useState<string>("");
  const [showRulesPopup, setShowRulesPopup] = useState<boolean>(false);
  const [showLeaveRoomPopup, setShowLeaveRoomPopup] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  
  // Ref to track heartbeat interval so we can clear it before leaving
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Debug - check if api.rooms.startGame exists
  useEffect(() => {
    console.log("[WaitingRoom] API available:", {
      hasStartGame: api.rooms && "startGame" in api.rooms,
    });
  }, []);

  const isHost = room?.hostId === playerId;

  // Debug the isHost calculation
  useEffect(() => {
    console.log("[WaitingRoom] isHost calculation:", {
      roomHostId: room?.hostId,
      currentPlayerId: playerId,
      isHost: isHost,
      comparison: `"${room?.hostId}" === "${playerId}"`,
    });
  }, [room?.hostId, playerId, isHost]);

  // Debug logging
  useEffect(() => {
    console.log("[WaitingRoom] Hook values updated:", {
      normalizedRoomID,
      roomId: roomId,
      room: room ? { _id: room._id, status: room.status, playerIds: room.playerIds } : "null",
      playersCount: playerRecords?.length || 0,
      isHost,
      playerId: playerId ? "set" : "not set",
      username: username ? `"${username}"` : "not set",
      startGameDirectMutation: typeof startGameDirectMutation,
    });
  }, [normalizedRoomID, roomId, room, playerRecords, isHost, playerId, username, startGameDirectMutation]);
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

    // room === undefined means still loading – do nothing yet.
    // room === null means the query completed and the room was not found.
    if (room === null) {
      clearRoomSession();
      setGameStarted(false);
      navigate("/", { replace: true });
      return;
    }
  }, [clearRoomSession, navigate, normalizedRoomID, setGameStarted, username, room]);

  // Update local game context when room data changes
  const playersArray = useMemo(() => {
    return playerRecords?.map(p => p.name) || [];
  }, [playerRecords]);

  const roomStatus = room?.status;
  
  useEffect(() => {
    if (room && roomStatus !== "finished" && playersArray.length > 0) {
      setRoomSession({ 
        roomID: normalizedRoomID, 
        players: playersArray 
      });
    }
  }, [room, roomStatus, normalizedRoomID, playersArray, setRoomSession]);

  // Handle game started state - navigate all players when status changes to "playing"
  useEffect(() => {
    console.log("[WaitingRoom] room.status effect triggered", { roomStatus: room?.status, shouldNavigate: room?.status === "playing" });
    if (room?.status === "playing") {
      console.log("[WaitingRoom] NAVIGATING TO GAME - room status is playing");
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
    heartbeatIntervalRef.current = setInterval(() => {
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
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [room?._id, playerId, updatePlayerStatus]);

  const handleLeaveRoom = async () => {
    console.log("[WaitingRoom] handleLeaveRoom START", { room: room?._id, playerId, hasUser: !!username });
    
    if (!room?._id || !playerId) {
      console.log("[WaitingRoom] handleLeaveRoom: missing room or playerId, navigating to home");
      clearRoomSession();
      setGameStarted(false);
      navigate("/", { replace: true });
      return;
    }

    // Stop heartbeat to prevent write conflicts with leaveRoom mutation
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    setError("");
    console.log("[WaitingRoom] handleLeaveRoom: calling leaveRoom mutation");

    try {
      console.log("[WaitingRoom] handleLeaveRoom: executing leaveRoom with", { roomId: room._id, playerId });
      const result = await leaveRoom(room._id, playerId);
      console.log("[WaitingRoom] handleLeaveRoom: leaveRoom result", result);
      
      if (!result.success) {
        console.error("[WaitingRoom] handleLeaveRoom: mutation failed with error", result.error);
        setError(result.error || i18n.ui.failedToLeaveRoom);
        return;
      }

      console.log("[WaitingRoom] handleLeaveRoom: clearing session and local storage");
      clearRoomSession();
      setGameStarted(false);

      try {
        sessionStorage.removeItem("joinedBeforeStartRoomId");
      } catch {
        // ignore
      }

      localStorage.removeItem("playerId");
      localStorage.removeItem("playerRoomId");

      console.log("[WaitingRoom] handleLeaveRoom: navigating to home");
      navigate("/", { replace: true });
    } catch (err) {
      console.error("[WaitingRoom] handleLeaveRoom: caught exception", err);
      setError(i18n.ui.failedToLeaveRoom);
    }
  };

  const handleStartGame = async () => {
    console.log("[WaitingRoom] handleStartGame START", { room: room?._id, playerId, isHost, startGameDirect: typeof startGameDirectMutation });
    
    if (!room?._id) {
      console.error("[WaitingRoom] handleStartGame: no room._id");
      setError("Error: Room not found");
      return;
    }
    if (!playerId) {
      console.error("[WaitingRoom] handleStartGame: no playerId");
      setError("Error: Player not found");
      return;
    }
    if (!isHost) {
      console.error("[WaitingRoom] handleStartGame: current user is not host");
      setError("Error: Only host can start game");
      return;
    }

    console.log("[WaitingRoom] handleStartGame: validation passed, setting isStarting=true");
    setIsStarting(true);
    setError("");

    try {
      const questionTypes = ["truth", "dare", "never_have_i_ever", "drinking_buddy", "wildcard"];
      console.log("[WaitingRoom] handleStartGame: calling startGameDirectMutation", { roomId: room._id, questionTypes });
      
      if (!startGameDirectMutation) {
        console.error("[WaitingRoom] handleStartGame: startGameDirectMutation is UNDEFINED!");
        setError("Error: Start game function not available");
        setIsStarting(false);
        return;
      }
      
      const result = await startGameDirectMutation({ roomId: room._id, questionTypes });
      
      console.log("[WaitingRoom] handleStartGame: mutation response", result);

      if (!result?.success) {
        console.error("[WaitingRoom] handleStartGame: mutation returned success=false or no result", result);
        setError((result as any)?.error || i18n.ui.failedToStartGame);
        setIsStarting(false);
        return;
      }

      console.log("[WaitingRoom] handleStartGame: storing session info");
      try {
        sessionStorage.setItem("joinedBeforeStartRoomId", normalizedRoomID);
      } catch {
        // ignore
      }
      
      console.log("[WaitingRoom] handleStartGame: mutation succeeded, resetting isStarting and waiting for room.status change");
      setIsStarting(false);
    } catch (err) {
      console.error("[WaitingRoom] handleStartGame: exception thrown", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[WaitingRoom] handleStartGame: error message:", errorMsg);
      setError(errorMsg || i18n.ui.failedToStartGame);
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
            console.log("[WaitingRoom] LEAVE ROOM POPUP CONFIRMED!");
            setShowLeaveRoomPopup(false);
            void handleLeaveRoom();
          }}
        />
      )}

      <div className="top-bar">
        <button
          type="button"
          className="button"
          onClick={() => {
            console.log("[WaitingRoom] LEAVE BUTTON IN TOP BAR CLICKED!");
            setShowLeaveRoomPopup(true);
          }}
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

            {(() => {
              if (isHost) {
                return (
                  <div>
                    <Button
                      label={i18n.ui.startGame}
                      color="primary"
                      onClick={() => {
                        console.log("[WaitingRoom] START GAME BUTTON CLICKED!");
                        void handleStartGame();
                      }}
                      size="large"
                      disabled={isStarting}
                    />
                  </div>
                );
              } else {
                return (
                  <p className="waiting-for-host-message">
                    {i18n.ui.waitingForHostToStart || "Waiting for the host to start the game."}
                  </p>
                );
              }
            })()}
          </div>
        </>
      )}
    </div>
  );
}
