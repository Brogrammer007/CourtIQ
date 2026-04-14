# PRP-06 — Confidence Engine

## Goal
Create `backend/utils/confidence.js` — a pure function `computeConfidence()` that takes player stats and context, runs four Z-score-based factors, and returns a composite 0–100 score with tier label and per-factor breakdown.

## Why
This is the analytical heart of the feature. Every prop card on the frontend displays a confidence score. Getting this right — with a tested, deterministic baseline — is what separates the feature from a simple stats display.

---

## Codebase Context

| File | Relevant detail |
|------|-----------------|
| `backend/utils/analytics.js` | Already exports `trend()`, `homeAwaySplit()`, `teamDefensiveProfile()`, `classifyPlayer()`. Import all of them — do not reimplement. |

**`trend()` returns:** `{ direction: 'up'|'down'|'flat', delta: number, form: number }` — `form` is already 0–100.

**`homeAwaySplit(stats, statKey)` returns:** `{ home_avg, away_avg, home_games, away_games }` — added in PRP-02.

**`teamDefensiveProfile(teamId)` returns:** `{ vs_scorer, vs_playmaker, vs_big, vs_balanced }` — multipliers around 1.0.

**Four factors and their weights:**

| Factor | Weight | Input | Formula |
|--------|--------|-------|---------|
| Hit Rate | 35% | last 15 games, line | `count(stat > line) / n * 100` |
| Form Trend | 25% | `trend()` output | `form ± 5 for direction`, clamped |
| Home/Away | 20% | `homeAwaySplit()`, `is_home`, line | `normalCDF((avg - line) / max(stddev, floor)) * 100` |
| Matchup | 20% | `matchupRow` or fallback | nba.com FG% allowed z-score OR archetype multiplier |

**Composite:** `round(0.35*F1 + 0.25*F2 + 0.20*F3 + 0.20*F4)`, clamped 0–100.

**Gotcha — `line` may be `null`:** When odds unavailable, hit rate and home/away factors must degrade gracefully to neutral 50, not crash.

**Gotcha — empty `stats` array:** Return a safe "no-data" response (all scores 50, tier `'low'`), never throw.

**Gotcha — stddev floor:** `pts` floor = 4.0 (NBA scoring noise). `reb` floor = 2.0. Prevents division-by-zero on tiny samples.

**Gotcha — pure function:** `computeConfidence` takes all inputs as arguments. It does not call any async functions or fetch anything. Async data is resolved by the caller (PRP-07).

---

## Dependencies
- **PRP-01** — `is_home` field on stat rows
- **PRP-02** — `homeAwaySplit()` exported from `analytics.js`

---

## Files to Create

| File | Change type |
|------|-------------|
| `backend/utils/confidence.js` | NEW |
| `backend/tests/confidence.test.js` | NEW |

---

## TDD Cycle

### Step 1 — RED: Create `backend/tests/confidence.test.js`

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeConfidence } from '../utils/confidence.js';

// 20 mock games: 12 over 28.5, 8 under; alternating home/away
const makeStats = (n = 20) =>
  Array.from({ length: n }, (_, i) => ({
    pts: 25 + (i % 5),     // 25, 26, 27, 28, 29 cycling
    reb: 10 + (i % 4),
    is_home: i % 2 === 0,
  }));

describe('computeConfidence', () => {
  it('returns score between 0 and 100', () => {
    const result = computeConfidence({ stats: makeStats(), statKey: 'pts', line: 27.5, isHome: true });
    assert.ok(result.score >= 0 && result.score <= 100, `score out of range: ${result.score}`);
  });

  it('returns all four factors', () => {
    const result = computeConfidence({ stats: makeStats(), statKey: 'pts', line: 27.5, isHome: true });
    assert.ok('hit_rate'  in result.factors);
    assert.ok('form'      in result.factors);
    assert.ok('home_away' in result.factors);
    assert.ok('matchup'   in result.factors);
  });

  it('returns valid tier string', () => {
    const result = computeConfidence({ stats: makeStats(), statKey: 'pts', line: 27.5, isHome: true });
    assert.ok(['high','medium','low','against'].includes(result.tier));
  });

  it('returns tier: high when score >= 80', () => {
    // Easy line — player always exceeds it
    const highStats = Array.from({ length: 15 }, () => ({ pts: 35, reb: 15, is_home: true }));
    const result = computeConfidence({ stats: highStats, statKey: 'pts', line: 10, isHome: true, opponentId: 7, archetype: 'big' });
    assert.equal(result.tier, 'high');
  });

  it('returns tier: against when score < 40', () => {
    // Impossible line — player never exceeds it
    const lowStats = Array.from({ length: 15 }, () => ({ pts: 5, reb: 2, is_home: false }));
    const result = computeConfidence({ stats: lowStats, statKey: 'pts', line: 50, isHome: false, opponentId: 7, archetype: 'big' });
    assert.equal(result.tier, 'against');
  });

  it('returns neutral result for empty stats — never throws', () => {
    const result = computeConfidence({ stats: [], statKey: 'pts', line: 28.5, isHome: true });
    assert.equal(result.score, 50);
    assert.equal(result.tier, 'low');
  });

  it('handles null line gracefully — hit_rate factor returns score 50', () => {
    const result = computeConfidence({ stats: makeStats(), statKey: 'pts', line: null, isHome: true });
    assert.equal(result.factors.hit_rate.score, 50);
    assert.doesNotThrow(() => result);
  });

  it('handles null isHome gracefully — home_away factor returns score 50', () => {
    const result = computeConfidence({ stats: makeStats(), statKey: 'pts', line: 27.5, isHome: null });
    assert.equal(result.factors.home_away.score, 50);
  });

  it('each factor score is between 0 and 100', () => {
    const result = computeConfidence({ stats: makeStats(), statKey: 'pts', line: 27.5, isHome: true, opponentId: 7, archetype: 'scorer' });
    for (const [key, factor] of Object.entries(result.factors)) {
      assert.ok(factor.score >= 0 && factor.score <= 100, `${key} out of range: ${factor.score}`);
    }
  });
});
```

### Step 2 — Verify RED
```bash
cd backend && npm test tests/confidence.test.js
```
**Expected failure:**
```
Error: Cannot find module '../utils/confidence.js'
```

### Step 3 — GREEN: Create `backend/utils/confidence.js`

```js
import { trend, homeAwaySplit, teamDefensiveProfile } from './analytics.js';

// ── Math helpers ────────────────────────────────────────────────────────────

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

// ── Factors ──────────────────────────────────────────────────────────────────

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
  const adj = t.direction === 'up' ? 5 : t.direction === 'down' ? -5 : 0;
  const score = clamp(t.form + adj);
  const sign = t.delta > 0 ? '+' : '';
  const label = t.direction === 'flat'
    ? `Form ${t.form}/100, trending flat`
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

  if (opponentId && archetype) {
    const profile = teamDefensiveProfile(opponentId);
    const keyMap = { scorer: 'vs_scorer', playmaker: 'vs_playmaker', big: 'vs_big', balanced: 'vs_balanced' };
    const mult = profile[keyMap[archetype] ?? 'vs_balanced'] ?? 1.0;
    const score = clamp((mult - 0.85) / 0.30 * 100);
    return { score, label: 'Avg matchup difficulty (no possession data)' };
  }

  return { score: 50, label: 'Matchup data unavailable' };
}

// ── Tier ────────────────────────────────────────────────────────────────────

function toTier(score) {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'low';
  return 'against';
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute a confidence score for a player prop.
 *
 * @param {object} opts
 * @param {Array}   opts.stats       - Normalized stat rows from loadPlayerStatPack
 * @param {string}  opts.statKey     - 'pts' | 'reb'
 * @param {number|null} opts.line    - Betting line (null if unavailable)
 * @param {boolean|null} opts.isHome - Is the next game at home? (null if unknown)
 * @param {object|null} opts.matchupRow - Row from getMatchup() or null
 * @param {string}  opts.archetype   - 'scorer'|'playmaker'|'big'|'balanced'
 * @param {number|null} opts.opponentId - ESPN team ID for fallback matchup
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
    return { score: 50, tier: 'low', factors: { hit_rate: noData, form: noData, home_away: noData, matchup: noData } };
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
```

### Step 4 — Verify GREEN
```bash
cd backend && npm test tests/confidence.test.js
```
**Expected — all 9 tests pass.**

### Step 5 — REFACTOR
Factor functions are clean private helpers. `clamp` and `normalCDF` are reusable math utilities. No duplication.

---

## Full Validation
```bash
cd backend && node -e "
import('./utils/confidence.js').then(m => {
  const stats = Array.from({ length: 20 }, (_, i) => ({
    pts: 25 + (i % 5), reb: 10 + (i % 4), is_home: i % 2 === 0,
  }));
  const result = m.computeConfidence({ stats, statKey: 'pts', line: 27.5, isHome: true, opponentId: 7, archetype: 'big' });
  console.log(JSON.stringify(result, null, 2));
});
"
```

---

## Error Patterns

| Error | Cause | Fix |
|-------|-------|-----|
| `trend is not a function` | `analytics.js` export name mismatch | Check export spelling in `analytics.js` |
| `homeAwaySplit is not a function` | PRP-02 not yet complete | Complete PRP-02 first |
| All factors return 50 | `stats` array has no `is_home` field | Complete PRP-01 first |
| `NaN` in composite | One factor returned `NaN` | Check `sampleStddev` with single-element arrays |

---

## Acceptance Criteria
- [ ] `computeConfidence({ stats, statKey: 'pts', line: 10, isHome: true })` returns `tier: 'high'` for easy line
- [ ] `computeConfidence({ stats, statKey: 'pts', line: 50, isHome: false })` returns `tier: 'against'` for impossible line
- [ ] Empty `stats` → `score: 50`, `tier: 'low'`, no throw
- [ ] `line: null` → `hit_rate.score === 50`
- [ ] `isHome: null` → `home_away.score === 50`
- [ ] All factor scores are always in range 0–100
- [ ] Function is synchronous/pure — no async, no fetch calls
- [ ] All 9 unit tests pass
