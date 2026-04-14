# PRP Execution Progress

**Branch:** `feature/player-prop-analytics`  
**Last updated:** 2026-04-14  
**Executed by:** Claude Sonnet 4.6

---

## Status Overview

| PRP | Name | Status | Tests |
|-----|------|--------|-------|
| PRP-01 | ESPN Home/Away Extension | ✅ DONE | 3/3 pass |
| PRP-02 | Home/Away Split Utility | ⏳ NEXT | — |
| PRP-03 | Next Game Detection | ⏳ READY | — |
| PRP-04 | Odds API Service | ⏳ READY | — |
| PRP-05 | NBA Stats Matchup Service | 🔒 blocked by PRP-04 | — |
| PRP-06 | Confidence Engine | 🔒 blocked by PRP-01 ✅, PRP-02 | — |
| PRP-07 | Props API Endpoint | 🔒 blocked by PRP-01 ✅, PRP-02, PRP-03, PRP-04, PRP-06 | — |
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

Per `docs/prp/00_EXECUTION-PLAN.md`, PRP-01 ✅ unblocks:

### Wave 2 (can start immediately)
- **PRP-02** — Home/Away Split Utility (`backend/utils/homeAwaySplit.js`)
  - Pure utility, no network calls
  - Reads `is_home` from normalized stat rows (now populated)
  - Est. ~20 min

### Still in Wave 1 (can run in parallel with PRP-02)
- **PRP-03** — Next Game Detection (no dependencies)
- **PRP-04** — Odds API Service (no dependencies)

---

## How to Continue

For each PRP, follow the TDD cycle exactly as written in the PRP file:
1. Write test first → verify RED
2. Implement → verify GREEN
3. Run full acceptance criteria checks
4. Commit: `git add <files> && git commit -m "feat: PRP-XX — ..."`
5. Push: `git push`

**Command to give Claude for next PRP:**
```
Execute PRP-02: read docs/prp/02_PRP_HOME-AWAY-SPLIT-UTILITY.md fully,
follow the TDD cycle exactly (write test first, verify RED,
implement, verify GREEN, refactor), then confirm all
acceptance criteria are met. Check PROGRESS.md for context on PRP-01.
```
