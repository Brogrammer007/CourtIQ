import { cached } from './_lib/cache.js';
import { getPlayer, getPlayerStats } from './_lib/balldontlie.js';
import { averages, trend, predictPoints, normalizeStat } from './_lib/analytics.js';

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
    const { a, b } = req.query;
    if (!a || !b) return res.status(400).json({ error: 'Provide ?a= and ?b= player ids' });

    const [packA, packB] = await Promise.all([loadPlayerStatPack(a), loadPlayerStatPack(b)]);

    res.json({
      a: { player: packA.player, averages: averages(packA.stats), trend: trend(packA.stats), prediction: predictPoints(packA.stats) },
      b: { player: packB.player, averages: averages(packB.stats), trend: trend(packB.stats), prediction: predictPoints(packB.stats) },
    });
  } catch (err) {
    console.error('[courtiq/compare]', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}
