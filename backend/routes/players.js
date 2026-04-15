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
  homeAwaySplit,
} from '../utils/analytics.js';
import { computeConfidence } from '../utils/confidence.js';
import { getPlayerProps } from '../services/odds.js';
import { getNextGame } from '../services/espn.js';
import { getMatchup } from '../services/nbaStats.js';

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

// ---- Props: live odds + confidence ----------------------------------------

router.get('/player/:id/props', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await cached(`props:${id}`, 1800, async () => {
      const { player, stats } = await loadPlayerStatPack(id);
      if (!player) return { error: 'player_not_found' };
      if (!stats.length) return { error: 'no_stats' };

      const playerName = `${player.first_name} ${player.last_name}`;
      const teamId     = player.team?.id;
      const seasonAvg  = averages(stats);
      const archetype  = classifyPlayer(seasonAvg);

      // Parallel fetch: odds + next game
      const [oddsResult, nextGame] = await Promise.all([
        getPlayerProps(playerName),
        teamId ? getNextGame(teamId) : Promise.resolve(null),
      ]);

      // Home/Away splits
      const ptsSplit = homeAwaySplit(stats, 'pts');
      const rebSplit = homeAwaySplit(stats, 'reb');
      const astSplit = homeAwaySplit(stats, 'ast');

      // Hit rates (last 15 games)
      const ptsLine = oddsResult.points.line;
      const rebLine = oddsResult.rebounds.line;
      const astLine = oddsResult.assists?.line ?? null;
      const sample  = stats.slice(0, 15);
      const ptsHits = ptsLine != null ? sample.filter((s) => s.pts > ptsLine).length : null;
      const rebHits = rebLine != null ? sample.filter((s) => s.reb > rebLine).length : null;
      const astHits = astLine != null ? sample.filter((s) => s.ast > astLine).length : null;

      const isHome = nextGame?.is_home ?? null;
      const oppId  = nextGame?.opponent_id ?? null;

      // Confidence
      const ptsConf = computeConfidence({ stats, statKey: 'pts', line: ptsLine, isHome, matchupRow: null, archetype, opponentId: oppId });
      const rebConf = computeConfidence({ stats, statKey: 'reb', line: rebLine, isHome, matchupRow: null, archetype, opponentId: oppId });
      const astConf = computeConfidence({ stats, statKey: 'ast', line: astLine, isHome, matchupRow: null, archetype, opponentId: oppId });

      return {
        player: { id: player.id, name: playerName, archetype },
        next_game: nextGame
          ? { opponent_id: nextGame.opponent_id, opponent_name: nextGame.opponent_name, is_home: nextGame.is_home }
          : null,
        props: {
          points: {
            ...oddsResult.points,
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

// ---- Defensive matchup: player vs specific defender -----------------------

router.get('/player/:id/matchup/:defenderId', async (req, res, next) => {
  try {
    const { id, defenderId } = req.params;

    const result = await cached(`matchup:${id}:${defenderId}`, 86400, async () => {
      // Resolve both ESPN players in parallel
      const [offPlayer, defPlayer] = await Promise.all([
        cached(`player:${id}`, TTL, () => getPlayer(id)),
        cached(`player:${defenderId}`, TTL, () => getPlayer(defenderId)),
      ]);

      if (!defPlayer) return { error: 'defender_not_found' };
      if (!offPlayer) return { error: 'offender_not_found' };

      let row;
      try {
        row = await getMatchup(offPlayer, defPlayer);
      } catch (err) {
        if (err.message === 'MATCHUP_UNAVAILABLE') return { error: 'matchup_unavailable' };
        throw err;
      }

      if (!row) return { error: 'no_matchup_data' };

      // Compute vs_season_avg
      const { stats } = await loadPlayerStatPack(id);
      const seasonAvg = averages(stats);
      const ptsPerPoss = row.partial_possessions > 0
        ? +(row.player_pts / row.partial_possessions).toFixed(2)
        : null;

      // Verdict: compare FG% allowed vs league average (0.470)
      const fgDiff  = +(((row.fg_pct ?? 0.470) - 0.470) * 100).toFixed(1);
      const verdict = fgDiff <= -5
        ? { label: 'Tough matchup',     tone: 'down', emoji: '🧊' }
        : fgDiff >= 5
        ? { label: 'Favorable matchup', tone: 'up',   emoji: '🔥' }
        : { label: 'Neutral matchup',   tone: 'flat',  emoji: '⚖️' };

      return {
        offender: { id: offPlayer.id, name: `${offPlayer.first_name} ${offPlayer.last_name}` },
        defender: { id: defPlayer.id, name: `${defPlayer.first_name} ${defPlayer.last_name}` },
        matchup_data: {
          games_played:        row.games_played,
          partial_possessions: row.partial_possessions,
          pts_per_possession:  ptsPerPoss,
          fg_pct_allowed:      row.fg_pct,
          def_reb_in_matchup:  row.def_reb,
          sample_note:         `${row.partial_possessions} possessions across ${row.games_played} game${row.games_played !== 1 ? 's' : ''}`,
        },
        vs_season_avg: {
          pts_diff_pct:    seasonAvg ? percentDiff(ptsPerPoss ?? 0, seasonAvg.pts / 36) : null,
          fg_pct_diff_pct: seasonAvg ? percentDiff(row.fg_pct ?? 0, seasonAvg.fg_pct)  : null,
        },
        verdict,
      };
    });

    if (result?.error === 'defender_not_found')  return res.status(404).json({ error: 'Defender not found.' });
    if (result?.error === 'offender_not_found')  return res.status(404).json({ error: 'Player not found.' });
    if (result?.error === 'no_matchup_data')     return res.status(404).json({ error: 'No matchup data found between these players this season.' });
    if (result?.error === 'matchup_unavailable') return res.status(503).json({ error: 'Matchup data temporarily unavailable.' });

    res.json(result);
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
