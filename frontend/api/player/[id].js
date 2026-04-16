import { cached } from '../_lib/cache.js';
import { getPlayer } from '../_lib/balldontlie.js';

const TTL = Number(process.env.CACHE_TTL_SECONDS || 60);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { id } = req.query;
    const data = await cached(`player:${id}`, TTL, () => getPlayer(id));
    if (!data) return res.status(404).json({ error: 'Player not found' });
    res.json({ data });
  } catch (err) {
    console.error('[courtiq/player/[id]]', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}
