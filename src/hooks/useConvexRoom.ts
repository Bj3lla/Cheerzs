import { useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function useConvexRoom(roomCode?: string, roomId?: Id<"rooms">) {
  // Get room by code
  const room = useQuery(
    api.rooms.getRoomByCode,
    roomCode ? { code: roomCode.toUpperCase() } : "skip"
  );

  // Get players for room
  const players = useQuery(
    api.rooms.getRoomPlayers,
    roomId ? { roomId } : room?._id ? { roomId: room._id } : "skip"
  );

  // Mutations
  const createRoomMutation = useMutation(api.rooms.createRoom);
  const joinRoomMutation = useMutation(api.rooms.joinRoom);
  const leaveRoomMutation = useMutation(api.rooms.leaveRoom);
  const updatePlayerStatusMutation = useMutation(api.rooms.updatePlayerStatus);
  const startGameMutation = useMutation(api.rooms.startGame);

  // Helper functions (wrapped in useCallback to keep stable references)
  const createRoom = useCallback(async ({
    code,
    hostId,
    hostName,
    gameMode = "classic",
    language = "en",
  }: {
    code: string;
    hostId: string;
    hostName: string;
    gameMode?: string;
    language?: string;
  }) => {
    try {
      const result = await createRoomMutation({
        code,
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
  }, [createRoomMutation]);

  const joinRoom = useCallback(async ({
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
  }, [joinRoomMutation]);

  const leaveRoom = useCallback(async (roomId: Id<"rooms">, playerId: string) => {
    console.log("[useConvexRoom] leaveRoom called", { roomId, playerId });
    try {
      console.log("[useConvexRoom] calling leaveRoomMutation");
      const result = await leaveRoomMutation({ roomId, playerId });
      console.log("[useConvexRoom] leaveRoomMutation completed", result);
      return { success: true };
    } catch (error) {
      console.error("[useConvexRoom] leaveRoom failed:", error);
      return { success: false, error: String(error) };
    }
  }, [leaveRoomMutation]);

  const updatePlayerStatus = useCallback(async (
    roomId: Id<"rooms">,
    playerId: string,
    isOnline: boolean
  ) => {
    try {
      await updatePlayerStatusMutation({ roomId, playerId, isOnline });
      return { success: true };
    } catch (error) {
      console.error("[useConvexRoom] updatePlayerStatus failed:", error);
      return { success: false, error: String(error) };
    }
  }, [updatePlayerStatusMutation]);

  const startGame = useCallback(async (
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
  }, [startGameMutation]);

  return {
    room,
    players,
    createRoom,
    joinRoom,
    leaveRoom,
    updatePlayerStatus,
    startGame,
  };
}
