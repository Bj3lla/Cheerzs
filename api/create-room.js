import { createClient } from '@supabase/supabase-js';
import Ably from 'ably';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ably = new Ably.Rest({ key: process.env.ABLY_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { username } = req.body;
  const roomID = Math.random().toString(36).substring(2, 8);

  // Create room in Supabase
  await supabase.from('rooms').insert({ id: roomID, host: username });

  // Add host as first player
  await supabase.from('players').insert({ room_id: roomID, username });

  // Notify realtime channel
  ably.channels.get(`room-${roomID}`).publish('player-joined', { username });

  res.status(200).json({ roomID });
}
