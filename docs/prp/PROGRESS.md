# PRP Execution Progress

**Branch:** `feature/player-prop-analytics`  
**Last updated:** 2026-04-14 (PRP-02 done)  
**Executed by:** Claude Sonnet 4.6

---

## Status Overview

| PRP | Name | Status | Tests |
|-----|------|--------|-------|
| PRP-01 | ESPN Home/Away Extension | ✅ DONE | 3/3 pass |
| PRP-02 | Home/Away Split Utility | ✅ DONE | 10/10 pass |
| PRP-03 | Next Game Detection | ⏳ READY | — |
| PRP-04 | Odds API Service | ⏳ READY | — |
| PRP-05 | NBA Stats Matchup Service | 🔒 blocked by PRP-04 | — |
| PRP-06 | Confidence Engine | 🔒 blocked by PRP-03, PRP-04 | — |
| PRP-07 | Props API Endpoint | 🔒 blocked by PRP-03, PRP-04, PRP-06 | — |
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

### Wave 3 — PRP-06 (Confidence Engine) now unblocked by 01+02, still waiting on PRP-03 + PRP-04
- **PRP-06** becomes fully unblocked once PRP-03 and PRP-04 are done

### Still in Wave 1 / independent (run in parallel)
- **PRP-03** — Next Game Detection (no dependencies)
- **PRP-04** — Odds API Service (no dependencies)

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

## How to Continue

For each PRP, follow the TDD cycle exactly as written in the PRP file:
1. Write test first → verify RED
2. Implement → verify GREEN
3. Run full acceptance criteria checks
4. Commit: `git add <files> && git commit -m "feat: PRP-XX — ..."`
5. Push: `git push`

**Next PRPs (both independent — can run in parallel):**
```
Execute PRP-03: read docs/prp/03_PRP_NEXT-GAME-DETECTION.md fully,
follow the TDD cycle (write test first → RED → implement → GREEN),
confirm all acceptance criteria. Check PROGRESS.md for context.
```
```
Execute PRP-04: read docs/prp/04_PRP_ODDS-API-SERVICE.md fully,
follow the TDD cycle (write test first → RED → implement → GREEN),
confirm all acceptance criteria. Check PROGRESS.md for context.
```
