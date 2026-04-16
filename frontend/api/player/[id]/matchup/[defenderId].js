import { cached } from '../../../_lib/cache.js';
import { getPlayer, getPlayerStats } from '../../../_lib/balldontlie.js';
import { averages, normalizeStat, percentDiff } from '../../../_lib/analytics.js';

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
    const { id, defenderId } = req.query;

    const result = await cached(`matchup:${id}:${defenderId}`, TTL * 30, async () => {
      const [{ player, stats }, defPlayer] = await Promise.all([
        loadPlayerStatPack(id),
        cached(`player:${defenderId}`, TTL, () => getPlayer(defenderId)),
      ]);

      if (!defPlayer) return { error: 'defender_not_found' };
      if (!player)    return { error: 'offender_not_found' };

      const defTeamId = defPlayer.team?.id;
      if (!defTeamId) return { error: 'no_matchup_data' };

      const vsGames = stats.filter(
        (s) => s.opponent_id != null && String(s.opponent_id) === String(defTeamId)
      );

      if (!vsGames.length) return { error: 'no_matchup_data' };

      const seasonAvg = averages(stats);
      const vsAvg     = averages(vsGames);

      const ptsDiff = percentDiff(vsAvg.pts, seasonAvg.pts);
      const fgDiff  = percentDiff(vsAvg.fg_pct, seasonAvg.fg_pct);

      const verdict = ptsDiff <= -10
        ? { label: 'Tough matchup',     tone: 'down', emoji: '🧊' }
        : ptsDiff >= 10
        ? { label: 'Favorable matchup', tone: 'up',   emoji: '🔥' }
        : { label: 'Neutral matchup',   tone: 'flat', emoji: '⚖️' };

      return {
        offender: { id: player.id,    name: `${player.first_name} ${player.last_name}` },
        defender: { id: defPlayer.id, name: `${defPlayer.first_name} ${defPlayer.last_name}` },
        matchup_data: {
          games_played:        vsGames.length,
          partial_possessions: vsGames.length,
          pts_per_possession:  vsAvg.pts,
          fg_pct_allowed:      vsAvg.fg_pct,
          def_reb_in_matchup:  vsAvg.reb,
          sample_note: `${vsGames.length} game${vsGames.length !== 1 ? 's' : ''} vs ${defPlayer.team?.full_name || 'their team'} this season`,
        },
        vs_season_avg: {
          pts_diff_pct:    ptsDiff,
          fg_pct_diff_pct: fgDiff,
        },
        verdict,
      };
    });

    if (result?.error === 'defender_not_found') return res.status(404).json({ error: 'Defender not found.' });
    if (result?.error === 'offender_not_found') return res.status(404).json({ error: 'Player not found.' });
    if (result?.error === 'no_matchup_data')    return res.status(404).json({ error: 'No matchup data found between these players this season.' });

    res.json(result);
  } catch (err) {
    console.error('[courtiq/player/[id]/matchup/[defenderId]]', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}
