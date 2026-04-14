# PRP-14 — Backtest Framework

## Goal
Create `backend/scripts/backtest.js` — a standalone script that runs all candidate confidence algorithms against historical ESPN gamelog data, computes Brier scores and calibration stats, and prints a comparison table to decide whether to replace the Z-score baseline.

## Why
The spec requires that algorithm replacement only happens when a candidate beats the baseline by > 0.02 Brier score on a held-out set. This script is the evidence-gathering tool that produces that measurement. It is not part of the app — it runs manually by a developer.

---

## Codebase Context

| File | Relevant detail |
|------|-----------------|
| `backend/services/espn.js` | `espnGetPlayerStats(id)` — source of historical data |
| `backend/utils/analytics.js` | `homeAwaySplit()`, `trend()` — reuse for feature extraction |
| `backend/utils/confidence.js` | `computeConfidence()` — baseline to compare against |

**What the script does:**
1. Load historical games for a set of reference players (top 20 NBA players by volume)
2. For each player and each game, treat that game as the "next game" and all prior games as history
3. Compute predicted probability of exceeding a synthetic line (season average as of that game)
4. Compare predicted probability to actual outcome (1 if exceeded line, 0 if not)
5. Compute **Brier score** for each algorithm: `mean((predicted_prob - actual)²)` — lower is better
6. Print calibration table and winner recommendation

**Candidate algorithms to implement and test:**

| Algorithm | Key idea |
|-----------|----------|
| **Z-score Baseline** | Current `computeConfidence()` — Factor 1 only for a single comparable metric |
| **KDE** | Gaussian kernel over last 15 game scores → P(score > line) |
| **EWMA** | Exponentially weighted moving average with λ=0.3; P(ewma > line) via normal CDF |
| **Bayesian** | Beta prior from season hit rate, update with last 5 games |
| **Poisson** | Model pts as Poisson(λ=ewma), P(X > line) = 1 - CDF(floor(line)) |

**Held-out split:** Last 20% of each player's games (chronologically) are the test set. Training uses everything before.

**Activation gate output:** Script prints:
```
Algorithm       Brier Score    Calibration    vs Baseline
Z-score         0.2130         ±0.023         —
KDE             0.1987         ±0.019         -0.0143 ✗ (< 0.02 threshold)
EWMA            0.1901         ±0.017         -0.0229 ✓ REPLACE
Bayesian        0.1945         ±0.020         -0.0185 ✗
Poisson         0.2045         ±0.022         -0.0085 ✗
```

**Gotcha — synthetic line = season average at time of game**, not a fixed number. Recompute the "prior season average" excluding the current game for each prediction.

**Gotcha — minimum sample requirement:** Skip predictions when fewer than 10 prior games exist (too noisy).

**Gotcha — KDE bandwidth:** Use Silverman's rule: `h = 1.06 × stddev × n^(-1/5)`.

---

## Dependencies
- **PRP-01** — `is_home` in stat rows (available via `espnGetPlayerStats`)
- **PRP-06** — `computeConfidence()` importable for baseline comparison

---

## Files to Create

| File | Change type |
|------|-------------|
| `backend/scripts/backtest.js` | NEW — standalone Node script |
| `backend/tests/backtest-algorithms.test.js` | NEW — unit tests for each algorithm function |

---

## TDD Cycle

### Step 1 — RED: Create `backend/tests/backtest-algorithms.test.js`

Test each algorithm function in isolation before wiring them into the script:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probKDE, probEWMA, probBayesian, probPoisson, brierScore, calibrationBins,
} from '../scripts/backtest.js';

// Helper: make n game scores
const scores = (n, val = 25) => Array.from({ length: n }, (_, i) => val + (i % 3));

describe('probKDE', () => {
  it('returns value between 0 and 1', () => {
    const p = probKDE(scores(15), 26);
    assert.ok(p >= 0 && p <= 1, `KDE out of range: ${p}`);
  });

  it('returns > 0.5 when line is below most scores', () => {
    const p = probKDE(scores(15, 30), 20); // all scores ~30, line 20
    assert.ok(p > 0.5, `Expected > 0.5, got ${p}`);
  });

  it('returns < 0.5 when line is above most scores', () => {
    const p = probKDE(scores(15, 15), 30); // all scores ~15, line 30
    assert.ok(p < 0.5, `Expected < 0.5, got ${p}`);
  });
});

describe('probEWMA', () => {
  it('returns value between 0 and 1', () => {
    const p = probEWMA(scores(15), 26);
    assert.ok(p >= 0 && p <= 1);
  });

  it('returns high probability when EWMA well above line', () => {
    const p = probEWMA(scores(15, 35), 20);
    assert.ok(p > 0.7);
  });
});

describe('probBayesian', () => {
  it('returns value between 0 and 1', () => {
    const p = probBayesian(scores(15), 26);
    assert.ok(p >= 0 && p <= 1);
  });
});

describe('probPoisson', () => {
  it('returns value between 0 and 1', () => {
    const p = probPoisson(scores(15), 26);
    assert.ok(p >= 0 && p <= 1);
  });

  it('returns near 0 when line far exceeds mean', () => {
    const p = probPoisson(scores(15, 5), 50);
    assert.ok(p < 0.05);
  });
});

describe('brierScore', () => {
  it('returns 0 for perfect predictions', () => {
    const predictions = [{ prob: 1, actual: 1 }, { prob: 0, actual: 0 }];
    assert.equal(brierScore(predictions), 0);
  });

  it('returns 0.25 for all-0.5 predictions', () => {
    const predictions = [
      { prob: 0.5, actual: 1 }, { prob: 0.5, actual: 0 },
      { prob: 0.5, actual: 1 }, { prob: 0.5, actual: 0 },
    ];
    assert.equal(brierScore(predictions), 0.25);
  });
});

describe('calibrationBins', () => {
  it('returns 10 bins', () => {
    const predictions = Array.from({ length: 100 }, (_, i) => ({
      prob: (i % 10) / 10 + 0.05, actual: i % 2,
    }));
    const bins = calibrationBins(predictions);
    assert.equal(bins.length, 10);
  });
});
```

### Step 2 — Verify RED
```bash
cd backend && npm test tests/backtest-algorithms.test.js
```
**Expected failure:**
```
Error: Cannot find module '../scripts/backtest.js'
```

### Step 3 — GREEN: Create `backend/scripts/backtest.js`

```js
#!/usr/bin/env node
// Backtest script — run with: node backend/scripts/backtest.js
// Compares confidence algorithm candidates against Z-score baseline.

import { espnGetPlayerStats } from '../services/espn.js';
import { normalizeStat } from '../utils/analytics.js';

// ── Probability functions ────────────────────────────────────────────────────

// Gaussian kernel function
function gaussianKernel(u) { return Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI); }

// KDE: estimate P(X > line) using Gaussian kernels
export function probKDE(values, line) {
  if (values.length < 3) return 0.5;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1);
  const std = Math.sqrt(variance) || 1;
  // Silverman's rule
  const h = 1.06 * std * Math.pow(values.length, -0.2);
  // Estimate CDF at line using kernel sum
  let cdf = 0;
  for (const x of values) {
    // Integral of Gaussian from -inf to (line - x) / h
    const z = (line - x) / h;
    cdf += 0.5 * (1 + erf(z / Math.SQRT2));
  }
  cdf /= values.length;
  return Math.max(0, Math.min(1, 1 - cdf));
}

function erf(x) {
  // Abramowitz & Stegun 7.1.26 approximation
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const result = 1 - poly * Math.exp(-x * x);
  return x >= 0 ? result : -result;
}

// EWMA: exponentially weighted mean → normal CDF
export function probEWMA(values, line, lambda = 0.3) {
  if (!values.length) return 0.5;
  let ewma = values[values.length - 1]; // start from oldest
  for (let i = values.length - 2; i >= 0; i--) {
    ewma = lambda * values[i] + (1 - lambda) * ewma;
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length) || 4;
  const z = (ewma - line) / std;
  return Math.max(0, Math.min(1, 0.5 * (1 + erf(z / Math.SQRT2))));
}

// Bayesian: Beta prior from season hit rate, updated with last 5 games
export function probBayesian(values, line, priorStrength = 10) {
  if (!values.length) return 0.5;
  const seasonHits  = values.filter((v) => v > line).length;
  const seasonTotal = values.length;
  const alpha0 = (seasonHits / seasonTotal) * priorStrength;
  const beta0  = priorStrength - alpha0;

  const recent = values.slice(0, 5);
  const recentHits = recent.filter((v) => v > line).length;
  const alpha = alpha0 + recentHits;
  const beta  = beta0 + (recent.length - recentHits);

  return Math.max(0, Math.min(1, alpha / (alpha + beta)));
}

// Poisson: model pts as Poisson(λ=ewma), P(X > floor(line))
export function probPoisson(values, line) {
  if (!values.length) return 0.5;
  const lambda = probEWMA(values, 0, 0.3); // reuse EWMA mean trick: use mean directly
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const k = Math.floor(line);
  // P(X <= k) = sum_{i=0}^{k} e^{-lambda} * lambda^i / i!
  let cdf = 0;
  let term = Math.exp(-mean);
  for (let i = 0; i <= k; i++) {
    cdf += term;
    term *= mean / (i + 1);
    if (cdf >= 1) break;
  }
  return Math.max(0, Math.min(1, 1 - cdf));
}

// ── Metrics ──────────────────────────────────────────────────────────────────

export function brierScore(predictions) {
  if (!predictions.length) return 0;
  const sum = predictions.reduce((acc, { prob, actual }) => acc + (prob - actual) ** 2, 0);
  return +(sum / predictions.length).toFixed(4);
}

export function calibrationBins(predictions, nBins = 10) {
  const bins = Array.from({ length: nBins }, (_, i) => ({
    range: [i / nBins, (i + 1) / nBins],
    count: 0, hits: 0,
  }));
  for (const { prob, actual } of predictions) {
    const idx = Math.min(Math.floor(prob * nBins), nBins - 1);
    bins[idx].count++;
    bins[idx].hits += actual;
  }
  return bins.map((b) => ({
    ...b,
    hit_rate: b.count > 0 ? +(b.hits / b.count).toFixed(3) : null,
  }));
}

// ── Main ─────────────────────────────────────────────────────────────────────

const PLAYERS = [
  3112335, 1966268, 3032977, 6450, 4066648,   // Jokic, Curry, LeBron, Durant, Luka
  3136195, 4277956, 2490155, 4395725, 3134907, // Tatum, SGA, Embiid, Booker, Giannis
];

async function main() {
  console.log('\n🏀 CourtIQ Confidence Algorithm Backtest\n');
  console.log('Loading player gamelogs...\n');

  const algorithms = {
    'Z-score (baseline)': (hist, line) => {
      const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
      const std  = Math.max(Math.sqrt(hist.reduce((a, v) => a + (v - mean) ** 2, 0) / hist.length), 4);
      return 0.5 * (1 + erf((mean - line) / (std * Math.SQRT2)));
    },
    'KDE':      (hist, line) => probKDE(hist, line),
    'EWMA':     (hist, line) => probEWMA(hist, line),
    'Bayesian': (hist, line) => probBayesian(hist, line),
    'Poisson':  (hist, line) => probPoisson(hist, line),
  };

  const allPredictions = Object.fromEntries(Object.keys(algorithms).map((k) => [k, []]));
  let totalGames = 0;

  for (const playerId of PLAYERS) {
    let raw;
    try {
      raw = await espnGetPlayerStats(playerId);
    } catch {
      console.warn(`  ⚠ Failed to load player ${playerId}`);
      continue;
    }

    const stats = raw.map((r) => normalizeStat(r, null));
    const ptsSeries = stats.map((s) => s.pts).reverse(); // chronological order

    // 80/20 split
    const splitIdx = Math.floor(ptsSeries.length * 0.8);
    const testSet  = ptsSeries.slice(splitIdx);

    for (let i = 0; i < testSet.length; i++) {
      const histIdx = splitIdx + i;
      const history = ptsSeries.slice(0, histIdx);
      if (history.length < 10) continue; // skip low-sample games

      const line   = +(history.reduce((a, b) => a + b, 0) / history.length).toFixed(1);
      const actual = testSet[i] > line ? 1 : 0;

      for (const [name, fn] of Object.entries(algorithms)) {
        const prob = fn(history, line);
        allPredictions[name].push({ prob, actual });
      }
      totalGames++;
    }
  }

  if (totalGames < 50) {
    console.warn('⚠ Fewer than 50 test predictions — results may not be reliable.\n');
  }

  console.log(`Test predictions: ${totalGames} games across ${PLAYERS.length} players\n`);

  const baselineBrier = brierScore(allPredictions['Z-score (baseline)']);
  const THRESHOLD = 0.02;

  console.log(
    'Algorithm'.padEnd(22) + 'Brier'.padEnd(10) + 'vs Baseline'.padEnd(16) + 'Decision'
  );
  console.log('─'.repeat(60));

  for (const [name, preds] of Object.entries(allPredictions)) {
    const bs    = brierScore(preds);
    const delta = +(bs - baselineBrier).toFixed(4);
    const isBaseline = name.includes('baseline');
    const decision = isBaseline
      ? '—'
      : delta < -THRESHOLD
      ? `✅ REPLACE (Δ ${delta})`
      : `✗ keep baseline (Δ ${delta})`;
    console.log(
      name.padEnd(22) +
      String(bs).padEnd(10) +
      (isBaseline ? '—' : String(delta)).padEnd(16) +
      decision
    );
  }

  console.log('\nActivation threshold: Δ Brier < -0.02 on held-out 20% set');
  console.log('Replace baseline factor formulas only for algorithms marked ✅\n');
}

// Only run main() when executed directly (not when imported in tests)
if (process.argv[1]?.endsWith('backtest.js')) {
  main().catch(console.error);
}
```

### Step 4 — Verify GREEN
```bash
cd backend && npm test tests/backtest-algorithms.test.js
```
**Expected — all 12 unit tests pass.**

### Step 5 — REFACTOR
`erf` is duplicated from `confidence.js`. Extract to a shared `backend/utils/math.js` if used in 3+ places. For now it's acceptable in 2.

---

## Full Validation (live data run — takes ~30s)
```bash
cd backend && node scripts/backtest.js
```
Expected output: table with Brier scores. Z-score baseline typically scores around 0.20–0.23 for NBA player props.

---

## Error Patterns

| Error | Cause | Fix |
|-------|-------|-----|
| `Failed to load player X` | ESPN API rate limit | Add 200ms delay between player fetches: `await new Promise(r => setTimeout(r, 200))` |
| All Brier scores identical | `line` computation is wrong | Log `line` for first player — should vary game to game |
| `probPoisson` always 0.5 | Lambda computation bug | Log `mean` value — should equal player's EWMA |
| `totalGames < 50` warning | Not enough historical data | Use more players or broaden ESPN date cutoff |

---

## Acceptance Criteria
- [ ] `probKDE`, `probEWMA`, `probBayesian`, `probPoisson` all return values in [0, 1]
- [ ] `brierScore([{prob:1,actual:1},{prob:0,actual:0}])` returns 0
- [ ] `brierScore` returns 0.25 for all-0.5 predictions
- [ ] `calibrationBins` returns exactly 10 bins
- [ ] `node scripts/backtest.js` runs without errors and prints a comparison table
- [ ] Script exits cleanly — no hanging async operations
- [ ] All 12 unit tests pass
