import { cached } from '../../_lib/cache.js';
import { getPlayer, getPlayerStats } from '../../_lib/balldontlie.js';
import { averages, trend, predictPoints, normalizeStat } from '../../_lib/analytics.js';
import { renderPlayerOG } from '../../_lib/og.js';

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
    const png = await cached(`og:${id}`, 1800, async () => {
      const { player, stats } = await loadPlayerStatPack(id);
      if (!player) throw Object.assign(new Error('Player not found'), { status: 404 });
      return renderPlayerOG({
        player,
        averages: stats.length ? averages(stats) : null,
        trend: stats.length ? trend(stats) : null,
        prediction: stats.length ? predictPoints(stats) : null,
      });
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.send(png);
  } catch (err) {
    if (err.status === 404) return res.status(404).end();
    console.error('[courtiq/player/[id]/og.png]', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}
