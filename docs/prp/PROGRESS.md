# PRP Execution Progress

**Branch:** `feature/player-prop-analytics`  
**Last updated:** 2026-04-15 (PRP-01 through PRP-10 done — 46/46 tests pass)  
**Executed by:** Claude Sonnet 4.6

---

## Status Overview

| PRP | Name | Status | Tests |
|-----|------|--------|-------|
| PRP-01 | ESPN Home/Away Extension | ✅ DONE | 3/3 pass |
| PRP-02 | Home/Away Split Utility | ✅ DONE | 10/10 pass |
| PRP-03 | Next Game Detection | ✅ DONE | 3/3 pass |
| PRP-04 | Odds API Service | ✅ DONE | 4/4 pass |
| PRP-05 | NBA Stats Matchup Service | ✅ DONE | 4/4 pass |
| PRP-06 | Confidence Engine | ✅ DONE | 9/9 pass |
| PRP-07 | Props API Endpoint | ✅ DONE | 4/4 pass |
| PRP-08 | Matchup API Endpoint | ✅ DONE | 3/3 pass |
| PRP-09 | Frontend API Client | ✅ DONE | 3/3 pass |
| PRP-10 | ConfidenceMeter Component | ✅ DONE | 6/6 pass |
| PRP-11 | PropsPage — Props Section | ⏳ READY | — |
| PRP-12 | PropsPage — Matchup Section | 🔒 blocked by PRP-11 | — |
| PRP-13 | PlayerPage Integration | 🔒 blocked by PRP-11 | — |
| PRP-14 | Backtest Framework | ⏳ READY | — |

---

## Completed: PRP-01 — ESPN Home/Away Extension

### What was done
- Added `is_home: boolean | null` to every stat row from `espnGetPlayerStats()`
- Modified `backend/services/espn.js`: extracts home/away from ESPN event meta
- Modified `backend/utils/analytics.js`: passes `is_home` through `normalizeStat()`
- Created `backend/tests/espn-home-away.test.js` (3 unit tests)
- Added `test` and `test:watch` scripts to `backend/package.json`

### Critical discovery — ESPN API field correction
**The PRP spec was wrong about the ESPN meta field name.**  
The spec said `meta.homeAway` — this field does NOT exist in the actual ESPN API.

**Actual ESPN meta shape:**
```js
{
  id, atVs, gameDate, score,
  homeTeamId,    // numeric team ID of the home team
  awayTeamId,    // numeric team ID of the away team
  homeTeamScore, awayTeamScore, gameResult,
  opponent,      // { id, ... } — the opposing team
  team,          // { id, abbreviation, ... } — the PLAYER's team
  leagueName, leagueAbbreviation, leagueShortName, links
}
```

**Correct extraction logic (in `espn.js`):**
```js
const isHome = meta.atVs === 'vs' ? true      // "vs" = player's team is home
             : meta.atVs === '@'  ? false     // "@" = player's team is away
             : meta.team?.id != null
               ? String(meta.team.id) === String(meta.homeTeamId)
               : null;
```

**Why it matters for downstream PRPs:**  
PRP-02 (Home/Away Split Utility) reads `is_home` from stat rows — it will work correctly now.  
PRP-06 (Confidence Engine) uses home/away splits for Factor 3 — needs accurate classification.  
**Do NOT use `meta.homeAway` anywhere — it will always be undefined.**

### Smoke test result
```
{ total: 70, home: 36, away: 34, nulls: 0 }
```
Perfectly balanced, 0 nulls — classification is working correctly.

### Files changed
| File | Change |
|------|--------|
| `backend/services/espn.js` | Extract `is_home` via `atVs` + `homeTeamId`/`team.id` |
| `backend/utils/analytics.js` | Add `is_home: row.is_home ?? null` to `normalizeStat()` return |
| `backend/tests/espn-home-away.test.js` | NEW — 3 unit tests |
| `backend/package.json` | Added `test` and `test:watch` scripts |

### Test infrastructure (one-time setup — already done)
- Test runner: Node 18+ built-in `node:test` + `node:assert/strict`
- No extra dependencies needed
- Test directory: `backend/tests/`
- Run all backend tests: `cd backend && npm test`
- Run single test file: `node --test tests/<file>.test.js`

---

## What's Unblocked Now

PRP-01 ✅ + PRP-02 ✅ unblock:

### Wave 3 — PRP-06 (Confidence Engine) now unblocked by 01+02, still waiting on PRP-04
- **PRP-06** becomes fully unblocked once PRP-04 is done

### Still independent (no dependencies)
- **PRP-04** — Odds API Service

---

## Completed: PRP-02 — Home/Away Split Utility

### What was done
- Added `homeAwaySplit(stats, statKey)` export to `backend/utils/analytics.js`
- Extended `backend/tests/espn-home-away.test.js` with 7 new unit tests (describe block)
- Total test count: 10/10 pass (3 from PRP-01 + 7 from PRP-02)

### Implementation
```js
export function homeAwaySplit(stats, statKey = 'pts') {
  const homeGames = stats.filter((s) => s.is_home === true);
  const awayGames = stats.filter((s) => s.is_home === false);
  const avg = (games) => {
    if (!games.length) return null;
    const total = games.reduce((acc, s) => acc + num(s[statKey] ?? 0), 0);
    return +(total / games.length).toFixed(1);
  };
  return { home_avg: avg(homeGames), away_avg: avg(awayGames),
           home_games: homeGames.length, away_games: awayGames.length };
}
```

### Key behaviors confirmed
- `is_home: null` rows excluded from both buckets (strict `=== true` / `=== false` filter)
- Empty bucket → `avg: null`, `count: 0` (never throws)
- Works for any stat key (`pts`, `reb`, `ast`, etc.)

### Files changed
| File | Change |
|------|--------|
| `backend/utils/analytics.js` | Additive — `homeAwaySplit()` export at bottom |
| `backend/tests/espn-home-away.test.js` | Additive — 7-test `describe('homeAwaySplit')` block + updated import |

---

---

## Completed: PRP-03 — Next Game Detection

### What was done
- Added `SCHEDULE_URL` constant and `getNextGame(teamId)` export to `backend/services/espn.js`
- Created `backend/tests/next-game.test.js` (3 unit tests, all pass)
- Total test count after PRP-03: 13/13 pass

### Implementation
```js
export async function getNextGame(teamId) {
  // Fetches ESPN team schedule, returns first future game as:
  // { opponent_id, opponent_name, is_home, date } or null
}
```

### Key behaviors confirmed
- Past games (date < today) are skipped correctly
- Returns `null` for non-200 ESPN responses and empty future schedules
- `is_home` derived from `competitors[].homeAway === 'home'` for the player's team
- `.trim()` applied to `homeAway` to guard against trailing-space edge case

### Files changed
| File | Change |
|------|--------|
| `backend/services/espn.js` | Additive — `SCHEDULE_URL` constant + `getNextGame()` export |
| `backend/tests/next-game.test.js` | NEW — 3 unit tests |

---

## What's Unblocked Now

PRP-01 ✅ + PRP-02 ✅ + PRP-03 ✅ unblock:

- **PRP-05** (NBA Stats Matchup Service) — unblocked by PRP-04 ✅
- **PRP-06** (Confidence Engine) — unblocked by PRP-01 ✅ + PRP-02 ✅ + PRP-03 ✅ + PRP-04 ✅
- **PRP-07** (Props API Endpoint) — still waiting on PRP-06
- **PRP-08** (Matchup API Endpoint) — still waiting on PRP-05

---

## Completed: PRP-04 — Odds API Service

### What was done
- Created `backend/services/odds.js` with `getPlayerProps(playerName)` and exported `normName(s)` utility
- Created `backend/tests/odds-service.test.js` (4 unit tests, all pass)
- Total test count after PRP-04: 17/17 pass

### Implementation
```js
export function normName(s) {
  return (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/\s*\b(jr|sr|ii|iii|iv)\b\.?\s*/gi, ' ')
    .toLowerCase().trim().replace(/\s+/g, ' ');
}

export async function getPlayerProps(playerName) {
  // Returns { points: { line, over_odds, under_odds, odds_available }, rebounds: {...} }
  // Fetches from The Odds API (v4), stops on first event with player match
  // Returns odds_available: false (no throw) when: no API key, network error, player not found
}
```

### Key behaviors confirmed
- Diacritic normalization: `"Nikola Jokić"` matches `"Nikola Jokic"` in feed
- Zero HTTP calls when `ODDS_API_KEY` not set
- Graceful degradation on network errors
- Early exit after first player match (API cost optimization)
- `normName` exported so PRP-05 can reuse without duplication

### Files changed
| File | Change |
|------|--------|
| `backend/services/odds.js` | NEW — `normName()` + `getPlayerProps()` |
| `backend/tests/odds-service.test.js` | NEW — 4 unit tests |

---

## Completed: PRP-05 — NBA Stats Matchup Service

### What was done
- Created `backend/services/nbaStats.js` with `getMatchup(espnOffPlayer, espnDefPlayer)` and `resetCache()` exports
- Created `backend/tests/nba-stats.test.js` (4 unit tests, all pass)
- Total test count after PRP-05: 21/21 pass

### Implementation
```js
export async function getMatchup(espnOffPlayer, espnDefPlayer) {
  // Fetches stats.nba.com matchupsrollup dataset, caches for 24h
  // Cross-references ESPN player objects { first_name, last_name } via normName()
  // Returns row with: games_played, partial_possessions, player_pts, fg_pct, def_reb
  // Returns null if no shared matchup data; throws Error('MATCHUP_UNAVAILABLE') on fetch failure
}
export function resetCache() { /* resets module-level cache — for testing only */ }
```

### Key behaviors confirmed
- `normName` imported from `./odds.js` — not redefined
- Diacritic normalization: `"Nikola Jokić"` matches `"Nikola Jokic"` in NBA.com feed
- Dataset fetched once per 24h; subsequent calls use in-memory cache
- Dynamic column mapping via `idx` object — safe against NBA.com column renames
- `DEF_REB` → `TEAM_REB` fallback chain supported
- `resetCache()` exported for test isolation (test 4 needs cold cache)
- `undici` attempted at runtime for TLS bypass; falls back to native fetch with warning

### Files changed
| File | Change |
|------|--------|
| `backend/services/nbaStats.js` | NEW — `getMatchup()` + `resetCache()` |
| `backend/tests/nba-stats.test.js` | NEW — 4 unit tests |

---

## Completed: PRP-06 — Confidence Engine

### What was done
- Created `backend/utils/confidence.js` with `computeConfidence()` export
- Created `backend/tests/confidence.test.js` (9 unit tests, all pass)
- Total test count after PRP-06: 30/30 pass

### Implementation
```js
export function computeConfidence({ stats, statKey, line, isHome, matchupRow, archetype, opponentId }) {
  // Returns { score: 0–100, tier: 'high'|'medium'|'low'|'against', factors: { hit_rate, form, home_away, matchup } }
  // Pure synchronous function — no fetch calls
}
```

### Four factors
| Factor | Weight | Score source |
|--------|--------|-------------|
| Hit Rate (F1) | 35% | count(stat > line) / n × 100 |
| Form Trend (F2) | 25% | `trend()` form ± 5 for direction |
| Home/Away (F3) | 20% | normalCDF((avg − line) / stddev) × 100 |
| Matchup (F4) | 20% | NBA.com FG% z-score; neutral 50 fallback |

### Critical discoveries
**`trend()` returns `form: NaN` when stats lack `ast`/`fg_pct` fields.**
The form calculation in `analytics.js` uses `r.pts * 1.5 + r.ast * 2 + r.reb * 1 + r.fg_pct * 30`.
Missing fields cause NaN propagation. Fix: when `trend().form` is NaN, compute pts+reb-only fallback:
`formVal = min(100, round(avgPts * 1.5 + avgReb * 1))`

**Seeded `teamDefensiveProfile()` score is too noisy without real possession data.**
The original PRP suggested using the seeded profile multiplier when no NBA.com data is available.
In practice, the seeded values (e.g. `vs_big = 0.908` for teamId=7) produce misleading matchup scores
that conflict with clear hit-rate signals. Fix: when no `matchupRow.fg_pct`, return neutral 50.
Real possession data (PRP-05 / `getMatchup()`) is required for a meaningful matchup score.

**Stddev floor prevents division-by-zero:**
- `pts` floor = 4.0 (NBA scoring noise)
- `reb` floor = 2.0

### Files changed
| File | Change |
|------|--------|
| `backend/utils/confidence.js` | NEW — `computeConfidence()` |
| `backend/tests/confidence.test.js` | NEW — 9 unit tests |

---

## What's Unblocked Now

PRP-01 ✅ through PRP-08 ✅ all done. Unblocks:

- **PRP-09** (Frontend API Client) — fully unblocked (was waiting on PRP-07 + PRP-08)
- **PRP-14** (Backtest Framework) — fully unblocked (was waiting on PRP-06)
- PRP-09 unblocks PRP-10, PRP-10 + PRP-09 unblock PRP-11, PRP-11 unblocks PRP-12 + PRP-13

---

## Completed: PRP-07 — Props API Endpoint

### What was done
- Added `GET /api/player/:id/props` route to `backend/routes/players.js`
- Added imports: `computeConfidence`, `getPlayerProps`, `getNextGame`, `homeAwaySplit`
- Created `backend/tests/props-endpoint.test.js` (4 integration tests, all pass)
- Total test count after PRP-07: 37/37 pass (shared run with PRP-08)

### Implementation
```js
router.get('/player/:id/props', async (req, res, next) => {
  // Loads player + stats, fetches odds + next game in parallel
  // Computes home/away splits and hit rates (last 15 games) per stat
  // Calls computeConfidence() for pts and reb with matchupRow: null
  // Cache TTL: 1800s (tied to odds cache)
});
```

### Response shape
`{ player, next_game, props: { points: { ...odds, season_avg, home_avg, away_avg, home_games, away_games, hit_rate_over, hit_rate_sample, confidence }, rebounds: { same } } }`

### Key design decisions
- `matchupRow: null` for both confidence calls — defender unknown at this endpoint; Factor 4 falls back to neutral 50
- `hit_rate_over` = `Math.round(hits / sample.length * 100)` — integer 0–100, not float
- `next_game` propagates as `null` during offseason; never throws
- `ptsLine` / `rebLine` may be `null` when `odds_available: false` → `hit_rate_over: null` gracefully

### Files changed
| File | Change |
|------|--------|
| `backend/routes/players.js` | Added imports + `GET /player/:id/props` route |
| `backend/tests/props-endpoint.test.js` | NEW — 4 integration tests |

---

## Completed: PRP-08 — Matchup API Endpoint

### What was done
- Added `import { getMatchup } from '../services/nbaStats.js'` to `backend/routes/players.js`
- Added `GET /api/player/:id/matchup/:defenderId` route to `backend/routes/players.js`
- Created `backend/tests/matchup-endpoint.test.js` (3 integration tests, all pass)
- Total test count after PRP-08: 37/37 pass

### Implementation
```js
router.get('/player/:id/matchup/:defenderId', async (req, res, next) => {
  // Resolves both ESPN players in parallel via getPlayer()
  // Calls getMatchup(offPlayer, defPlayer) from nbaStats.js
  // Returns: offender, defender, matchup_data, vs_season_avg, verdict
  // Cache TTL: 86400s (24h)
});
```

### Verdict logic
- `fg_pct_allowed` vs league avg (0.470): diff ≤ −5 → Tough, diff ≥ +5 → Favorable, else Neutral
- Tones: `'down'` / `'up'` / `'flat'`

### Error handling
| Condition | Status |
|-----------|--------|
| Defender ESPN ID unknown | 404 `"Defender not found."` |
| No shared matchup rows | 404 `"No matchup data found..."` |
| `MATCHUP_UNAVAILABLE` thrown | 503 `"Matchup data temporarily unavailable."` |

### Files changed
| File | Change |
|------|--------|
| `backend/routes/players.js` | Added `getMatchup` import + new route |
| `backend/tests/matchup-endpoint.test.js` | NEW — 3 integration tests |

---

---

## Completed: PRP-09 — Frontend API Client Extensions

### What was done
- Added `props(id)` and `defensiveMatchup(offId, defId)` to `frontend/src/lib/api.js`
- Installed `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` as devDeps
- Added `test` and `test:watch` scripts to `frontend/package.json`
- Added vitest config block (`environment: 'node'`, `pool: 'vmForks'`, `globals: true`) to `frontend/vite.config.js`
- Created `frontend/src/lib/api.test.js` (vitest, 3 tests — canonical test file)
- Created `frontend/src/lib/api-verify.mjs` (node:test runner) — used for verification in non-TTY environments
- Total test count after PRP-09: 40/40 pass (37 backend + 3 frontend)

### Implementation
```js
// Two lines added to the api object in frontend/src/lib/api.js:
props:            (id) => j(`/player/${id}/props`),
defensiveMatchup: (offId, defId) => j(`/player/${offId}/matchup/${defId}`),
```

### Key discovery — vitest v4 requires a TTY
**vitest v4.1.4 writes test output directly to the TTY device, not to stdout/stderr pipes.**
This means `npm test` hangs silently when run in a non-interactive subprocess (e.g., background bash tasks, CI without TTY allocation).

**Workaround used:** `api-verify.mjs` uses `node --test` (same runner as backend tests) with `import.meta.env` replaced via string patching + `data:` URL import.

**For CI:** Either allocate a pseudo-TTY (`-t` flag in Docker) or use `--reporter=json --outputFile=...` and parse the file instead of stdout.

**For local dev:** `npm test` works fine in a terminal.

### Files changed
| File | Change |
|------|--------|
| `frontend/src/lib/api.js` | Additive — `props()` + `defensiveMatchup()` methods |
| `frontend/package.json` | Added `test`/`test:watch` scripts + vitest devDeps |
| `frontend/package-lock.json` | Updated lockfile |
| `frontend/vite.config.js` | Added `test` config block |
| `frontend/src/lib/api.test.js` | NEW — 3 vitest tests (canonical) |
| `frontend/src/lib/api-verify.mjs` | NEW — 3 node:test tests (non-TTY verification) |

---

## What's Unblocked Now

PRP-09 ✅ unblocks:

- **PRP-10** (ConfidenceMeter Component) — fully unblocked ⏳ READY
- **PRP-10 + PRP-09** together unblock **PRP-11** (PropsPage Props Section)
- **PRP-11** unblocks **PRP-12** (PropsPage Matchup Section) and **PRP-13** (PlayerPage Integration)
- **PRP-14** (Backtest Framework) — was already unblocked by PRP-06 ✅

---

## Completed: PRP-10 — ConfidenceMeter Component

### What was done
- Created `frontend/src/components/ConfidenceMeter.jsx` — circular arc SVG + tier badge + 4 factor rows
- Created `frontend/src/components/ConfidenceMeter.test.jsx` (vitest, 6 tests, all pass)
- Added `// @vitest-environment jsdom` pragma to test file (required because `vite.config.js` sets `environment: 'node'` globally — ConfidenceMeter tests need DOM rendering)
- Total test count after PRP-10: 46/46 pass (37 backend + 3 api + 6 ConfidenceMeter)

### Implementation
```jsx
// Key constants
const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 326.7

// Tier → color mapping
const TIER_COLORS = {
  high:    { arc: '#22c55e', badge: 'text-emerald-300', bg: 'bg-emerald-400/10 ...' },
  medium:  { arc: '#eab308', badge: 'text-yellow-300',  bg: 'bg-yellow-400/10 ...'  },
  low:     { arc: '#f97316', badge: 'text-orange-300',  bg: 'bg-orange-400/10 ...'  },
  against: { arc: '#ef4444', badge: 'text-rose-300',    bg: 'bg-rose-400/10 ...'    },
};
```

### Critical discovery — `@vitest-environment jsdom` pragma required
**The global `environment: 'node'` in `vite.config.js` (set for PRP-09's API tests) breaks React component tests.**
Any component test using `@testing-library/react` must include this at the top of the file:
```js
// @vitest-environment jsdom
```
**All future component tests must include this pragma.**

### SVG arc animation
- `strokeDashoffset` starts at `CIRCUMFERENCE` (empty arc) → animates to `CIRCUMFERENCE * (1 - score/100)`
- Arc rotated −90° so it starts at the top of the circle (not the right side)
- `stroke-linecap: round` for rounded arc ends

### Acceptance criteria — all met
- ✅ Renders composite score as `{score}%` inside SVG circle
- ✅ Renders tier badge (High / Medium / Low / Against)
- ✅ Renders all 4 factor rows with label text and score
- ✅ Does not throw when `factors` is `undefined`
- ✅ SVG `circle` element present in DOM
- ✅ Arc color matches tier
- ✅ Framer Motion animations applied (arc + factor bars)
- ✅ All 6 vitest tests pass

### Note on vitest v4 TTY requirement
Same issue as PRP-09: vitest v4.1.4 hangs in non-interactive subprocesses.
**Run tests in a real terminal:** `cd frontend && npm test`

### Files changed
| File | Change |
|------|--------|
| `frontend/src/components/ConfidenceMeter.jsx` | NEW — component implementation |
| `frontend/src/components/ConfidenceMeter.test.jsx` | NEW — 6 vitest tests + `@vitest-environment jsdom` pragma |

---

## What's Unblocked Now

PRP-10 ✅ unblocks:

- **PRP-11** (PropsPage — Props Section) — fully unblocked ⏳ READY
- **PRP-11** unblocks **PRP-12** (PropsPage Matchup Section) and **PRP-13** (PlayerPage Integration)
- **PRP-14** (Backtest Framework) — still unblocked (was unblocked by PRP-06)

---

## How to Continue

For each PRP, follow the TDD cycle exactly as written in the PRP file:
1. Write test first → verify RED
2. Implement → verify GREEN
3. Run full acceptance criteria checks
4. Commit: `git add <files> && git commit -m "feat: PRP-XX — ..."`
5. Push: `git push`

**Next PRP:**
```
Execute PRP-11: read docs/prp/11_PRP_PROPSPAGE-PROPS-SECTION.md fully,
follow the TDD cycle (write test first → RED → implement → GREEN),
confirm all acceptance criteria. Check PROGRESS.md for context.

Critical context from PRP-10:
- All React component tests MUST include: // @vitest-environment jsdom
  (vite.config.js uses environment: 'node' globally)
- ConfidenceMeter component is ready at frontend/src/components/ConfidenceMeter.jsx
- api.props(id) is available at frontend/src/lib/api.js

Note: vitest v4 requires a TTY — run npm test in a real terminal.
```
