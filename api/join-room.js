import { createClient } from '@supabase/supabase-js';
import Ably from 'ably';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ably = new Ably.Rest({ key: process.env.ABLY_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { roomID, username } = req.body;

  // Check room exists
  const { data: room } = await supabase.from('rooms').select().eq('id', roomID).single();
  if (!room) return res.status(404).json({ error: 'Room not found' });

  // Add player to DB
  await supabase.from('players').insert({ room_id: roomID, username });

  // Notify room
  ably.channels.get(`room-${roomID}`).publish('player-joined', { username });

  res.status(200).json({ success: true });
}
