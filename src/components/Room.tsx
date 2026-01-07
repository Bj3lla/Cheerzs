import { useEffect, useState } from "react";
import Ably from "ably";

export default function Room({ roomID }: { roomID?: string }) {
  const [players, setPlayers] = useState<string[]>([]);

  useEffect(() => {
    const normalizedRoomID = typeof roomID === "string" ? roomID.trim().toUpperCase() : "";
    const username = localStorage.getItem("playerName") || "";
    const playerId = localStorage.getItem("playerId") || "";

    if (!normalizedRoomID || !username) return;

    const ably = new Ably.Realtime({
      authUrl: `/api/ably-auth?roomID=${encodeURIComponent(normalizedRoomID)}&username=${encodeURIComponent(username)}&playerId=${encodeURIComponent(playerId)}`,
    });
    const channel = ably.channels.get(`room-${normalizedRoomID}`);

    channel.subscribe("player-joined", (msg: any) => {
      setPlayers((prev) => [...prev, msg?.data?.username]);
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
  }, [roomID]);

  return (
    <div>
      <h2>Room: {roomID}</h2>
      <ul>
        {players.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </div>
  );
}
