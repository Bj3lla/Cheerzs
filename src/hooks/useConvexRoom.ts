import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function useConvexRoom(roomCode?: string) {
  // Get room by code
  const room = useQuery(
    api.rooms.getRoomByCode,
    roomCode ? { code: roomCode.toUpperCase() } : "skip"
  );

  // Mutations
  const createRoomMutation = useMutation(api.rooms.createRoom);
  const joinRoomMutation = useMutation(api.rooms.joinRoom);
  const leaveRoomMutation = useMutation(api.rooms.leaveRoom);
  const updatePlayerStatusMutation = useMutation(api.rooms.updatePlayerStatus);
  const startGameMutation = useMutation(api.rooms.startGame);

  // Helper functions
  const createRoom = async ({
    hostId,
    hostName,
    gameMode = "classic",
    language = "en",
  }: {
    hostId: string;
    hostName: string;
    gameMode?: string;
    language?: string;
  }) => {
    try {
      const result = await createRoomMutation({
        hostId,
        hostName,
        gameMode,
        language,
      });
      return { success: true, roomCode: result.code, roomId: result.roomId };
    } catch (error) {
      console.error("Failed to create room:", error);
      return { success: false, error: String(error) };
    }
  };

  const joinRoom = async ({
    code,
    playerId,
    playerName,
  }: {
    code: string;
    playerId: string;
    playerName: string;
  }) => {
    try {
      const result = await joinRoomMutation({
        code: code.toUpperCase(),
        playerId,
        playerName,
      });
      const gameStarted = result.room.status === "playing";
      return { success: true, roomId: result.roomId, gameStarted };
    } catch (error) {
      console.error("Failed to join room:", error);
      return { success: false, error: String(error) };
    }
  };

  const leaveRoom = async (roomId: Id<"rooms">, playerId: string) => {
    try {
      await leaveRoomMutation({ roomId, playerId });
      return { success: true };
    } catch (error) {
      console.error("Failed to leave room:", error);
      return { success: false, error: String(error) };
    }
  };

  const updatePlayerStatus = async (
    roomId: Id<"rooms">,
    playerId: string,
    isOnline: boolean
  ) => {
    try {
      await updatePlayerStatusMutation({ roomId, playerId, isOnline });
      return { success: true };
    } catch (error) {
      console.error("Failed to update player status:", error);
      return { success: false, error: String(error) };
    }
  };

  const startGame = async (
    roomId: Id<"rooms">,
    questionTypes: string[]
  ) => {
    try {
      await startGameMutation({ roomId, questionTypes });
      return { success: true };
    } catch (error) {
      console.error("Failed to start game:", error);
      return { success: false, error: String(error) };
    }
  };

  return {
    room,
    createRoom,
    joinRoom,
    leaveRoom,
    updatePlayerStatus,
    startGame,
  };
}
