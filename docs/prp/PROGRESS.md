# PRP Execution Progress

**Branch:** `feature/player-prop-analytics`  
**Last updated:** 2026-04-14 (PRP-03 done, PRP-04 done)  
**Executed by:** Claude Sonnet 4.6

---

## Status Overview

| PRP | Name | Status | Tests |
|-----|------|--------|-------|
| PRP-01 | ESPN Home/Away Extension | ✅ DONE | 3/3 pass |
| PRP-02 | Home/Away Split Utility | ✅ DONE | 10/10 pass |
| PRP-03 | Next Game Detection | ✅ DONE | 3/3 pass |
| PRP-04 | Odds API Service | ✅ DONE | 4/4 pass |
| PRP-05 | NBA Stats Matchup Service | ⏳ READY | — |
| PRP-06 | Confidence Engine | ⏳ READY | — |
| PRP-07 | Props API Endpoint | 🔒 blocked by PRP-04, PRP-06 | — |
| PRP-08 | Matchup API Endpoint | 🔒 blocked by PRP-05 | — |
| PRP-09 | Frontend API Client | 🔒 blocked by PRP-07, PRP-08 | — |
| PRP-10 | ConfidenceMeter Component | 🔒 blocked by PRP-09 | — |
| PRP-11 | PropsPage — Props Section | 🔒 blocked by PRP-09, PRP-10 | — |
| PRP-12 | PropsPage — Matchup Section | 🔒 blocked by PRP-11 | — |
| PRP-13 | PlayerPage Integration | 🔒 blocked by PRP-11 | — |
| PRP-14 | Backtest Framework | 🔒 blocked by PRP-06 | — |

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

## What's Unblocked Now

PRP-01 ✅ + PRP-02 ✅ + PRP-03 ✅ + PRP-04 ✅ unblock:

- **PRP-05** (NBA Stats Matchup Service) — ready to run
- **PRP-06** (Confidence Engine) — ready to run
- Both can run in parallel (independent of each other)

---

## How to Continue

For each PRP, follow the TDD cycle exactly as written in the PRP file:
1. Write test first → verify RED
2. Implement → verify GREEN
3. Run full acceptance criteria checks
4. Commit: `git add <files> && git commit -m "feat: PRP-XX — ..."`
5. Push: `git push`

**Next PRPs (both independent — can run in parallel):**
```
Execute PRP-05: read docs/prp/05_PRP_NBA-STATS-MATCHUP-SERVICE.md fully,
follow the TDD cycle (write test first → RED → implement → GREEN),
confirm all acceptance criteria. Check PROGRESS.md for context.
```
```
Execute PRP-06: read docs/prp/06_PRP_CONFIDENCE-ENGINE.md fully,
follow the TDD cycle (write test first → RED → implement → GREEN),
confirm all acceptance criteria. Check PROGRESS.md for context.
```
