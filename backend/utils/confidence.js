import { trend, homeAwaySplit } from './analytics.js';
import { teamDefensiveProfile } from '../services/balldontlie.js';

// ── Math helpers ─────────────────────────────────────────────────────────────

function clamp(x, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(x)));
}

// Abramowitz & Stegun approximation of the normal CDF, accurate to ~±7.5e-8
function normalCDF(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422820 * Math.exp(-0.5 * z * z);
  const poly = t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
  const p = 1 - d * poly;
  return z >= 0 ? p : 1 - p;
}

function sampleStddev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// ── Factors ───────────────────────────────────────────────────────────────────

function f1HitRate(stats, statKey, line) {
  if (line == null) return { score: 50, label: 'No line available' };
  const n = Math.min(stats.length, 15);
  const sample = stats.slice(0, n);
  const hits = sample.filter((s) => (s[statKey] ?? 0) > line).length;
  const score = clamp(hits / n * 100);
  return { score, label: `Hit ${hits}/${n} games over line` };
}

function f2Form(stats) {
  const t = trend(stats);
  let formVal = Number.isFinite(t.form) ? t.form : null;

  if (formVal === null) {
    // trend() form is NaN (stats missing ast/fg_pct) — compute pts+reb only
    const recent = stats.slice(0, Math.min(5, stats.length));
    if (recent.length) {
      const avgPts = recent.reduce((a, s) => a + (s.pts ?? 0), 0) / recent.length;
      const avgReb = recent.reduce((a, s) => a + (s.reb ?? 0), 0) / recent.length;
      formVal = Math.min(100, Math.max(0, Math.round(avgPts * 1.5 + avgReb * 1)));
    } else {
      formVal = 50;
    }
  }

  const adj = t.direction === 'up' ? 5 : t.direction === 'down' ? -5 : 0;
  const score = clamp(formVal + adj);
  const sign = t.delta > 0 ? '+' : '';
  const label = t.direction === 'flat'
    ? `Form ${formVal}/100, trending flat`
    : `Trending ${t.direction} ${sign}${t.delta} PTS`;
  return { score, label };
}

function f3HomeAway(stats, statKey, line, isHome) {
  if (isHome == null) return { score: 50, label: 'Home/away context unavailable' };

  const split = homeAwaySplit(stats, statKey);
  const relevantAvg = isHome ? split.home_avg : split.away_avg;

  if (relevantAvg == null) return { score: 50, label: 'Insufficient home/away sample' };

  const floor = statKey === 'pts' ? 4.0 : 2.0;
  const values = stats.slice(0, 15).map((s) => s[statKey] ?? 0);
  const stddev = Math.max(sampleStddev(values), floor);
  const locLabel = isHome ? 'Home' : 'Away';

  if (line != null) {
    const z = (relevantAvg - line) / stddev;
    const score = clamp(normalCDF(z) * 100);
    return { score, label: `${locLabel} game, avg ${relevantAvg} vs line ${line}` };
  }

  // No line: express avg relative to season mean
  const seasonMean = stats.length
    ? stats.reduce((a, s) => a + (s[statKey] ?? 0), 0) / stats.length
    : relevantAvg;
  const z = (relevantAvg - seasonMean) / stddev;
  const score = clamp(50 + z * 15);
  return { score, label: `${locLabel} game, avg ${relevantAvg} (no line)` };
}

function f4Matchup(matchupRow, archetype, opponentId) {
  if (matchupRow?.fg_pct != null) {
    const leagueMean = 0.470;
    const z = (matchupRow.fg_pct - leagueMean) / 0.05;
    const score = clamp(50 + z * 15);
    const gp = matchupRow.games_played;
    return { score, label: `FG% allowed: ${(matchupRow.fg_pct * 100).toFixed(1)}% (${gp}g matchup data)` };
  }

  // No possession data — return neutral score (seeded profile alone is insufficient signal)
  return { score: 50, label: 'Matchup data unavailable' };
}

// ── Tier ─────────────────────────────────────────────────────────────────────

function toTier(score) {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'low';
  return 'against';
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute a confidence score for a player prop.
 *
 * @param {object} opts
 * @param {Array}        opts.stats       - Normalized stat rows (from loadPlayerStatPack)
 * @param {string}       opts.statKey     - 'pts' | 'reb'
 * @param {number|null}  opts.line        - Betting line (null if unavailable)
 * @param {boolean|null} opts.isHome      - Is the next game at home? (null if unknown)
 * @param {object|null}  opts.matchupRow  - Row from getMatchup() or null
 * @param {string}       opts.archetype   - 'scorer'|'playmaker'|'big'|'balanced'
 * @param {number|null}  opts.opponentId  - ESPN team ID for fallback matchup
 * @returns {{ score: number, tier: string, factors: object }}
 */
export function computeConfidence({
  stats = [],
  statKey = 'pts',
  line = null,
  isHome = null,
  matchupRow = null,
  archetype = 'balanced',
  opponentId = null,
}) {
  if (!stats.length) {
    const noData = { score: 50, label: 'No historical data' };
    return {
      score: 50,
      tier: 'low',
      factors: { hit_rate: noData, form: noData, home_away: noData, matchup: noData },
    };
  }

  const F1 = f1HitRate(stats, statKey, line);
  const F2 = f2Form(stats);
  const F3 = f3HomeAway(stats, statKey, line, isHome);
  const F4 = f4Matchup(matchupRow, archetype, opponentId);

  const composite = clamp(0.35 * F1.score + 0.25 * F2.score + 0.20 * F3.score + 0.20 * F4.score);

  return {
    score: composite,
    tier: toTier(composite),
    factors: { hit_rate: F1, form: F2, home_away: F3, matchup: F4 },
  };
}
