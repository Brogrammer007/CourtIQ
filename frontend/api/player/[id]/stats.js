import { cached } from '../../_lib/cache.js';
import { getPlayer, getPlayerStats } from '../../_lib/balldontlie.js';
import { averages, trend, predictPoints, normalizeStat } from '../../_lib/analytics.js';

const TTL = Number(process.env.CACHE_TTL_SECONDS || 60);

async function loadPlayerStatPack(id) {
  const player = await cached(`player:${id}`, TTL, () => getPlayer(id));
  const raw = await cached(`stats:${id}`, TTL, () => getPlayerStats(id));
  const stats = raw.map((r) => normalizeStat(r, player?.team?.id));
  return { player, stats };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { id } = req.query;
    const { stats } = await loadPlayerStatPack(id);
    if (!stats.length) {
      return res.status(404).json({ error: 'No stats available for this player.' });
    }
    res.json({
      data: stats,
      averages: averages(stats),
      trend: trend(stats),
      prediction: predictPoints(stats),
    });
  } catch (err) {
    console.error('[courtiq/player/[id]/stats]', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}
