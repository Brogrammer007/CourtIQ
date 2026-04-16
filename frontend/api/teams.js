import { cached } from './_lib/cache.js';
import { getAllTeams } from './_lib/balldontlie.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const data = await cached('teams', 300, () => getAllTeams());
    res.json({ data });
  } catch (err) {
    console.error('[courtiq/teams]', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}
