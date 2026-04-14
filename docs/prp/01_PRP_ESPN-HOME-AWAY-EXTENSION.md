# PRP-01 — ESPN Home/Away Extension

## Goal
Add `is_home: boolean | null` to every stat row returned by `espnGetPlayerStats()` so downstream modules can split performance by home vs. away games.

## Why
The Odds API confidence engine (PRP-06) requires home/away context to compute Factor 3 accurately. Without this field the home/away split utility (PRP-02) has nothing to split on, and Factor 3 silently degrades to a neutral 50.

---

## Codebase Context

| File | What it does | What we touch |
|------|--------------|---------------|
| `backend/services/espn.js` | Fetches ESPN gamelog per athlete | Extract `homeAway` from event meta inside `espnGetPlayerStats()` |
| `backend/utils/analytics.js` | Normalizes raw stat rows | Thread `is_home` through `normalizeStat()` return shape |

**Existing row shape (lines 129–143 in `espn.js`):**
```js
rows.push({
  event_id: e.eventId,
  game_date: ...,
  opponent_id: oppId,
  min: ..., pts: ..., reb: ..., // etc.
});
```

**ESPN event meta shape** — the `meta` object already has:
```js
meta.homeAway  // "home" | "away" | undefined
meta.opponent  // { id, ... }
meta.gameDate  // ISO string
```

**Gotcha — `homeAway` is the athlete's team's status**, not the opponent's. `"home"` means our player's team is hosting.

**Gotcha — `homeAway` can be absent** for playoff play-in games or exhibition data. Default to `null`, never assume.

**Non-breaking change:** `is_home` is additive. Every existing caller of `normalizeStat()` receives the field transparently and ignores it.

---

## Dependencies
None. This is the first change in the dependency chain.

---

## Files to Modify

| File | Change type |
|------|-------------|
| `backend/services/espn.js` | Modify — extract `is_home` in `espnGetPlayerStats()` |
| `backend/utils/analytics.js` | Modify — pass through `is_home` in `normalizeStat()` |

---

## Test Setup (one-time for whole project)

Add test script to `backend/package.json`:
```json
"scripts": {
  "test": "node --test tests/**/*.test.js",
  "test:watch": "node --test --watch tests/**/*.test.js"
}
```

Create directory:
```bash
mkdir -p backend/tests
```

No new dependencies needed — uses Node 18+ built-in `node:test` and `node:assert`.

---

## TDD Cycle

### Step 1 — RED: Write the test first

Create `backend/tests/espn-home-away.test.js`:

```js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStat } from '../utils/analytics.js';

describe('normalizeStat — is_home field', () => {
  it('passes is_home: true through when row has is_home: true', () => {
    const row = {
      event_id: '1', game_date: '2024-11-01', opponent_id: 5,
      is_home: true, pts: 30, reb: 10, ast: 8,
      stl: 1, blk: 1, fg_pct: 0.55, fg3_pct: 0.40, min: '35',
    };
    const result = normalizeStat(row, null);
    assert.equal(result.is_home, true);
  });

  it('passes is_home: false through when row has is_home: false', () => {
    const row = {
      event_id: '2', game_date: '2024-11-02', opponent_id: 7,
      is_home: false, pts: 22, reb: 8, ast: 5,
      stl: 0, blk: 2, fg_pct: 0.48, fg3_pct: 0.35, min: '32',
    };
    const result = normalizeStat(row, null);
    assert.equal(result.is_home, false);
  });

  it('defaults is_home to null when field is absent', () => {
    const row = {
      event_id: '3', game_date: '2024-11-03', opponent_id: 9,
      pts: 18, reb: 6, ast: 3,
      stl: 1, blk: 0, fg_pct: 0.44, fg3_pct: 0.33, min: '28',
    };
    const result = normalizeStat(row, null);
    assert.equal(result.is_home, null);
  });
});
```

### Step 2 — Verify RED
```bash
cd backend && npm test tests/espn-home-away.test.js
```
**Expected failure:**
```
AssertionError: undefined == true
```
`is_home` is currently not in the return shape, so it comes back `undefined`.

### Step 3 — GREEN: Implement in `analytics.js`

In `normalizeStat()`, add `is_home` to the return object:

```js
export function normalizeStat(row, ownTeamId) {
  // ... existing opponent_id resolution logic unchanged ...

  return {
    event_id: row.event_id ?? null,
    date: row.game?.date || row.game_date || null,
    opponent_id,
    is_home: row.is_home ?? null,   // ← ADD THIS LINE
    pts: num(row.pts),
    reb: num(row.reb),
    ast: num(row.ast),
    stl: num(row.stl),
    blk: num(row.blk),
    fg_pct: num(row.fg_pct),
    fg3_pct: num(row.fg3_pct),
    min: row.min ?? '',
  };
}
```

Then in `espn.js`, extract `is_home` from event meta before pushing the row:

```js
// Inside espnGetPlayerStats(), in the rows-building loop:
const oppId = meta.opponent?.id ? Number(meta.opponent.id) : null;

// ADD these two lines:
const isHome = meta.homeAway === 'home' ? true
             : meta.homeAway === 'away' ? false
             : null;

rows.push({
  event_id: e.eventId,
  game_date: meta.gameDate ? meta.gameDate.slice(0, 10) : null,
  opponent_id: oppId,
  is_home: isHome,        // ← ADD THIS
  min: String(s[0] ?? ''),
  pts: num(s[13]),
  reb: num(s[7]),
  ast: num(s[8]),
  blk: num(s[9]),
  stl: num(s[10]),
  fg_pct: +(num(s[2]) / 100).toFixed(3),
  fg3_pct: +(num(s[4]) / 100).toFixed(3),
});
```

### Step 4 — Verify GREEN
```bash
cd backend && npm test tests/espn-home-away.test.js
```
**Expected:**
```
▶ normalizeStat — is_home field
  ✔ passes is_home: true through when row has is_home: true
  ✔ passes is_home: false through when row has is_home: false
  ✔ defaults is_home to null when field is absent
```

### Step 5 — REFACTOR
No duplication to remove. Change is minimal and correct.

---

## Full Validation

Smoke-test against live ESPN data:
```bash
cd backend && node -e "
import('./services/espn.js').then(async m => {
  const rows = await m.espnGetPlayerStats(3112335);
  const home = rows.filter(r => r.is_home === true).length;
  const away = rows.filter(r => r.is_home === false).length;
  const nulls = rows.filter(r => r.is_home === null).length;
  console.log({ total: rows.length, home, away, nulls });
  console.assert(home + away > 0, 'Expected at least some home/away classification');
});
"
```
Expected: `home` ≈ `away` (roughly equal splits), `nulls` should be 0 or very small.

---

## Error Patterns

| Error | Cause | Fix |
|-------|-------|-----|
| `is_home` is always `null` even for dated games | ESPN changed `homeAway` key name | Log `Object.keys(meta)` for a real event and find new key |
| `AssertionError: undefined == true` | `normalizeStat` still missing the field | Confirm `analytics.js` edit was saved |
| `SyntaxError: Cannot use import statement` | Test runner not in ESM mode | Ensure `backend/package.json` has `"type": "module"` — it already does |

---

## Acceptance Criteria
- [ ] `normalizeStat()` returns `is_home: true` when row has `is_home: true`
- [ ] `normalizeStat()` returns `is_home: false` when row has `is_home: false`
- [ ] `normalizeStat()` returns `is_home: null` when field is missing
- [ ] `espnGetPlayerStats(3112335)` returns rows where `home + away > 0`
- [ ] All existing endpoints (`/api/player/:id/stats`, `/compare`, etc.) still respond correctly — `is_home` is silently additive
- [ ] All 3 unit tests pass
