import { useState } from "react";

export default function useAddPlayerToRoom() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const addPlayerToRoom = async (playerName: string, roomId: string) => {
    setIsLoading(true);
    setError("");

    try {
      // Make POST request to your database API
      const response = await fetch("/api/add-player", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerName,
          roomId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add player to room");
      }

      const data: unknown = await response.json();
      setIsLoading(false);
      return data;
    } catch (err: any) {
      setError(err?.message || "Failed to add player to room");
      setIsLoading(false);
      throw err;
    }
  };

  return {
    addPlayerToRoom,
    isLoading,
    error,
  };
}
