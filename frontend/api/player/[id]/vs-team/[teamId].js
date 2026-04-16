import { cached } from '../../../_lib/cache.js';
import { getPlayer, getPlayerStats, getTeam, teamDefensiveProfile } from '../../../_lib/balldontlie.js';
import {
  averages, normalizeStat, classifyPlayer,
  percentDiff, matchupLabel, teamWeaknessInsight, combinedInsight,
} from '../../../_lib/analytics.js';

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
    const { id, teamId } = req.query;
    const cacheKey = `vs:${id}:${teamId}`;

    const result = await cached(cacheKey, TTL, async () => {
      const [{ player, stats }, team] = await Promise.all([
        loadPlayerStatPack(id),
        cached(`team:${teamId}`, TTL, () => getTeam(teamId)),
      ]);
      if (!player) return { error: 'player_not_found' };
      if (!team) return { error: 'team_not_found' };

      const vsTeamGames = stats.filter(
        (s) => s.opponent_id != null && String(s.opponent_id) === String(teamId)
      );

      const seasonAvg = averages(stats);
      const vsTeamAvg = averages(vsTeamGames);
      const archetype = classifyPlayer(seasonAvg);
      const profile = teamDefensiveProfile(teamId);
      const weakness = teamWeaknessInsight(profile);

      let diff = null, label = null, insights = null;
      if (vsTeamAvg) {
        diff = {
          pts: percentDiff(vsTeamAvg.pts, seasonAvg.pts),
          ast: percentDiff(vsTeamAvg.ast, seasonAvg.ast),
          reb: percentDiff(vsTeamAvg.reb, seasonAvg.reb),
        };
        label = matchupLabel(diff.pts);
        insights = combinedInsight({
          playerName: `${player.first_name} ${player.last_name}`,
          vsTeamAvg, seasonAvg, diffPct: diff.pts, label, archetype, weakness,
        });
      }

      return {
        player: {
          id: player.id,
          name: `${player.first_name} ${player.last_name}`,
          archetype,
        },
        team,
        games: vsTeamGames,
        sample_size: vsTeamGames.length,
        season_averages: seasonAvg,
        vs_team_averages: vsTeamAvg,
        diff_percent: diff,
        matchup: label,
        weakness,
        insights,
      };
    });

    if (result?.error === 'player_not_found') return res.status(404).json({ error: 'Player not found' });
    if (result?.error === 'team_not_found') return res.status(404).json({ error: 'Team not found' });
    res.json(result);
  } catch (err) {
    console.error('[courtiq/player/[id]/vs-team/[teamId]]', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}
