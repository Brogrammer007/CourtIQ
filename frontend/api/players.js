import { cached } from './_lib/cache.js';
import { searchPlayers } from './_lib/balldontlie.js';

const TTL = Number(process.env.CACHE_TTL_SECONDS || 60);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const search = req.query.search || '';
    const cursor = req.query.cursor || '';
    const per_page = Math.min(Number(req.query.per_page) || 100, 100);
    const key = `players:${search}:${cursor}:${per_page}`;
    const result = await cached(key, TTL, () => searchPlayers({ search, cursor, per_page }));
    res.json(result);
  } catch (err) {
    console.error('[courtiq/players]', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}
