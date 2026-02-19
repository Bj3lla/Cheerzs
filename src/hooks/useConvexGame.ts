import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function useConvexGame(roomId?: Id<"rooms">) {
  // Get current room (for gameState and seq)
  const room = useQuery(
    api.rooms.getRoomById,
    roomId ? { roomId } : "skip"
  );

  // Mutations
  const drawCardMutation = useMutation(api.game.drawCard);
  const updateGameStateMutation = useMutation(api.game.updateGameState);
  const endGameMutation = useMutation(api.game.endGame);
  const restartGameMutation = useMutation(api.game.restartGame);

  // Helper functions
  const drawCard = async () => {
    if (!roomId) {
      console.error("Cannot draw card: no roomId");
      return { success: false, error: "No room ID" };
    }

    try {
      const card = await drawCardMutation({ roomId });
      return { success: true, card };
    } catch (error) {
      console.error("Failed to draw card:", error);
      return { success: false, error: String(error) };
    }
  };

  const updateGameState = async (playerId: string, state: any) => {
    if (!roomId) {
      console.error("Cannot update game state: no roomId");
      return { success: false, error: "No room ID" };
    }

    try {
      const result = await updateGameStateMutation({ roomId, playerId, state });
      return { success: true, seq: result.seq };
    } catch (error) {
      console.error("Failed to update game state:", error);
      return { success: false, error: String(error) };
    }
  };

  const endGame = async () => {
    if (!roomId) {
      console.error("Cannot end game: no roomId");
      return { success: false, error: "No room ID" };
    }

    try {
      await endGameMutation({ roomId });
      return { success: true };
    } catch (error) {
      console.error("Failed to end game:", error);
      return { success: false, error: String(error) };
    }
  };

  const restartGame = async () => {
    if (!roomId) {
      console.error("Cannot restart game: no roomId");
      return { success: false, error: "No room ID" };
    }

    try {
      await restartGameMutation({ roomId });
      return { success: true };
    } catch (error) {
      console.error("Failed to restart game:", error);
      return { success: false, error: String(error) };
    }
  };

  return {
    room,
    gameState: room?.gameState,
    seq: room?.seq,
    drawCard,
    updateGameState,
    endGame,
    restartGame,
  };
}
