import { cached } from '../../_lib/cache.js';
import { getPlayer, getPlayerStats } from '../../_lib/balldontlie.js';
import { getNextGame } from '../../_lib/espn.js';
import {
  averages, normalizeStat, classifyPlayer, homeAwaySplit,
} from '../../_lib/analytics.js';
import { computeConfidence } from '../../_lib/confidence.js';
import { getPlayerProps } from '../../_lib/odds.js';

const TTL = Number(process.env.CACHE_TTL_SECONDS || 60);

async function loadPlayerStatPack(id) {
  const player = await cached(`player:${id}`, TTL, () => getPlayer(id));
  const raw = await cached(`stats:${id}`, TTL, () => getPlayerStats(id));
  const stats = raw.map((r) => normalizeStat(r, player?.team?.id));
  return { player, stats };
}

// Round to nearest 0.5 — standard prop line format
function projectedLine(stats, key, n = 10) {
  const slice = stats.slice(0, n).filter((s) => s[key] != null);
  if (!slice.length) return null;
  const avg = slice.reduce((sum, s) => sum + s[key], 0) / slice.length;
  return Math.round(avg * 2) / 2;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { id } = req.query;

    const result = await cached(`props:${id}`, 1800, async () => {
      const { player, stats } = await loadPlayerStatPack(id);
      if (!player) return { error: 'player_not_found' };
      if (!stats.length) return { error: 'no_stats' };

      const playerName = `${player.first_name} ${player.last_name}`;
      const teamId     = player.team?.id;
      const seasonAvg  = averages(stats);
      const archetype  = classifyPlayer(seasonAvg);

      const [oddsResult, nextGame] = await Promise.all([
        getPlayerProps(playerName),
        teamId ? getNextGame(teamId) : Promise.resolve(null),
      ]);

      const ptsSplit = homeAwaySplit(stats, 'pts');
      const rebSplit = homeAwaySplit(stats, 'reb');
      const astSplit = homeAwaySplit(stats, 'ast');

      const ptsLine = oddsResult.points.line   ?? projectedLine(stats, 'pts');
      const rebLine = oddsResult.rebounds.line ?? projectedLine(stats, 'reb');
      const astLine = oddsResult.assists?.line ?? projectedLine(stats, 'ast');
      const sample  = stats.slice(0, 15);
      const ptsHits = ptsLine != null ? sample.filter((s) => s.pts > ptsLine).length : null;
      const rebHits = rebLine != null ? sample.filter((s) => s.reb > rebLine).length : null;
      const astHits = astLine != null ? sample.filter((s) => s.ast > astLine).length : null;

      const isHome = nextGame?.is_home ?? null;

      const ptsConf = computeConfidence({ stats, statKey: 'pts', line: ptsLine, isHome });
      const rebConf = computeConfidence({ stats, statKey: 'reb', line: rebLine, isHome });
      const astConf = computeConfidence({ stats, statKey: 'ast', line: astLine, isHome });

      return {
        player: { id: player.id, name: playerName, archetype, position: player.position || '' },
        next_game: nextGame
          ? { opponent_id: nextGame.opponent_id, opponent_name: nextGame.opponent_name, is_home: nextGame.is_home }
          : null,
        props: {
          points: {
            ...oddsResult.points,
            line:            ptsLine,
            season_avg:      seasonAvg?.pts ?? null,
            home_avg:        ptsSplit.home_avg,
            away_avg:        ptsSplit.away_avg,
            home_games:      ptsSplit.home_games,
            away_games:      ptsSplit.away_games,
            hit_rate_over:   ptsHits != null ? Math.round(ptsHits / sample.length * 100) : null,
            hit_rate_sample: sample.length,
            confidence:      ptsConf,
          },
          rebounds: {
            ...oddsResult.rebounds,
            line:            rebLine,
            season_avg:      seasonAvg?.reb ?? null,
            home_avg:        rebSplit.home_avg,
            away_avg:        rebSplit.away_avg,
            home_games:      rebSplit.home_games,
            away_games:      rebSplit.away_games,
            hit_rate_over:   rebHits != null ? Math.round(rebHits / sample.length * 100) : null,
            hit_rate_sample: sample.length,
            confidence:      rebConf,
          },
          assists: {
            line:            astLine,
            over_odds:       oddsResult.assists?.over_odds ?? null,
            under_odds:      oddsResult.assists?.under_odds ?? null,
            odds_available:  oddsResult.assists?.odds_available ?? false,
            season_avg:      seasonAvg?.ast ?? null,
            home_avg:        astSplit.home_avg,
            away_avg:        astSplit.away_avg,
            home_games:      astSplit.home_games,
            away_games:      astSplit.away_games,
            hit_rate_over:   astHits != null ? Math.round(astHits / sample.length * 100) : null,
            hit_rate_sample: sample.length,
            confidence:      astConf,
          },
        },
      };
    });

    if (result?.error === 'player_not_found') return res.status(404).json({ error: 'Player not found' });
    if (result?.error === 'no_stats')         return res.status(404).json({ error: 'No stats available for this player.' });
    res.json(result);
  } catch (err) {
    console.error('[courtiq/player/[id]/props]', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}
