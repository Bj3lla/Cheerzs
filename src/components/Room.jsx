import { useEffect, useState } from 'react';
import Ably from 'ably';

export default function Room({ roomID }) {
  const [players, setPlayers] = useState([]);
  
  useEffect(() => {
    const ably = new Ably.Realtime({ authUrl: '/api/ably-auth' });
    const channel = ably.channels.get(`room-${roomID}`);

    channel.subscribe('player-joined', (msg) => {
      setPlayers(prev => [...prev, msg.data.username]);
    });

    return () => channel.unsubscribe();
  }, [roomID]);

  return (
    <div>
      <h2>Room: {roomID}</h2>
      <ul>
        {players.map((p, i) => <li key={i}>{p}</li>)}
      </ul>
    </div>
  );
}
