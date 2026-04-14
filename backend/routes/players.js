import { Router } from 'express';
import { cached } from '../utils/cache.js';
import {
  searchPlayers,
  getPlayer,
  getPlayerStats,
  getTopPlayers,
  getAllTeams,
  getTeam,
  teamDefensiveProfile,
} from '../services/balldontlie.js';
import {
  averages, trend, predictPoints, normalizeStat,
  classifyPlayer, percentDiff, matchupLabel,
  teamWeaknessInsight, combinedInsight,
} from '../utils/analytics.js';

const TTL = Number(process.env.CACHE_TTL_SECONDS || 60);
const router = Router();

// ---- Players --------------------------------------------------------------

router.get('/players', async (req, res, next) => {
  try {
    const search = req.query.search || '';
    const cursor = req.query.cursor || '';
    const per_page = Math.min(Number(req.query.per_page) || 100, 100);
    const key = `players:${search}:${cursor}:${per_page}`;
    const result = await cached(key, TTL, () => searchPlayers({ search, cursor, per_page }));
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/top', async (_req, res, next) => {
  try {
    const data = await cached('top', TTL, () => getTopPlayers());
    res.json({ data });
  } catch (err) { next(err); }
});

router.get('/player/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await cached(`player:${id}`, TTL, () => getPlayer(id));
    if (!data) return res.status(404).json({ error: 'Player not found' });
    res.json({ data });
  } catch (err) { next(err); }
});

// Helper: load normalized stats + player (cached).
async function loadPlayerStatPack(id) {
  const player = await cached(`player:${id}`, TTL, () => getPlayer(id));
  const raw = await cached(`stats:${id}`, TTL, () => getPlayerStats(id));
  const stats = raw.map((r) => normalizeStat(r, player?.team?.id));
  return { player, stats };
}

router.get('/player/:id/stats', async (req, res, next) => {
  try {
    const { id } = req.params;
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
  } catch (err) { next(err); }
});

// ---- NEW: Player vs specific Team ----------------------------------------

router.get('/player/:id/vs-team/:teamId', async (req, res, next) => {
  try {
    const { id, teamId } = req.params;
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
        games: vsTeamGames, // chronological-newest-first; UI reverses for chart
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
  } catch (err) { next(err); }
});

// ---- NEW: Team weakness ---------------------------------------------------

router.get('/team/:id/weakness', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await cached(`weakness:${id}`, TTL, async () => {
      const team = await getTeam(id);
      if (!team) return { error: 'team_not_found' };
      const profile = teamDefensiveProfile(id);
      const weakness = teamWeaknessInsight(profile);
      return { team, profile, weakness };
    });
    if (result?.error) return res.status(404).json({ error: 'Team not found' });
    res.json(result);
  } catch (err) { next(err); }
});

// ---- Teams list -----------------------------------------------------------

router.get('/teams', async (_req, res, next) => {
  try {
    const data = await cached('teams', 300, () => getAllTeams());
    res.json({ data });
  } catch (err) { next(err); }
});

// ---- Compare --------------------------------------------------------------

router.get('/compare', async (req, res, next) => {
  try {
    const { a, b } = req.query;
    if (!a || !b) return res.status(400).json({ error: 'Provide ?a= and ?b= player ids' });

    const [packA, packB] = await Promise.all([loadPlayerStatPack(a), loadPlayerStatPack(b)]);

    res.json({
      a: { player: packA.player, averages: averages(packA.stats), trend: trend(packA.stats), prediction: predictPoints(packA.stats) },
      b: { player: packB.player, averages: averages(packB.stats), trend: trend(packB.stats), prediction: predictPoints(packB.stats) },
    });
  } catch (err) { next(err); }
});

export default router;
