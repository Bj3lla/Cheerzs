import { useState } from "react";

export default function useAddPlayerToRoom() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const addPlayerToRoom = async (playerName, roomId) => {
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

      const data = await response.json();
      setIsLoading(false);
      return data;
    } catch (err) {
      setError(err.message);
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
