import { cached } from '../../_lib/cache.js';
import { getPlayer, getPlayerStats } from '../../_lib/balldontlie.js';
import { getNextGame, getPlayerInjury, isOutForNextGame } from '../../_lib/espn.js';
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
    const { player, stats } = await loadPlayerStatPack(id);
    if (!stats.length) {
      return res.status(404).json({ error: 'No stats available for this player.' });
    }

    // Parallel fetch: next game + injury status (both may fail independently)
    const [nextGame, injury] = await Promise.all([
      player?.team?.id ? getNextGame(player.team.id).catch(() => null) : Promise.resolve(null),
      getPlayerInjury(id).catch(() => null),
    ]);

    const availability = {
      injury,                                          // null when healthy
      next_game: nextGame,                             // null when no scheduled game
      out_for_next_game: isOutForNextGame(injury, nextGame),
    };

    res.json({
      data: stats,
      averages: averages(stats),
      trend: trend(stats),
      prediction: predictPoints(stats),
      availability,
    });
  } catch (err) {
    console.error('[courtiq/player/[id]/stats]', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}
