# PRP-02 — Home/Away Split Utility

## Goal
Add a pure `homeAwaySplit(stats, statKey)` function to `analytics.js` that separates normalized stat rows into home and away buckets and returns per-bucket averages and game counts.

## Why
The props endpoint (PRP-07) and confidence engine (PRP-06) both need home vs. away average for a given stat (`pts` or `reb`) to compute the Home/Away factor and populate the response shape fields `home_avg`, `away_avg`, `home_games`, `away_games`.

---

## Codebase Context

| File | Relevant detail |
|------|-----------------|
| `backend/utils/analytics.js` | Already exports `averages()`, `trend()`, `predictPoints()`. Adds `homeAwaySplit()` at bottom. |
| `backend/tests/espn-home-away.test.js` | Created in PRP-01 — can add more `describe` blocks to same file |

**Existing `averages()` helper** — uses the same `num()` helper already defined at top of file. Reuse `num()` in the new function.

**Stat keys in a normalized row:** `pts`, `reb`, `ast`, `stl`, `blk`, `fg_pct`, `fg3_pct`. The new function must handle any of these, not just `pts`.

**Gotcha — `is_home: null` rows** must be excluded from both buckets. Do not count them as home or away.

**Gotcha — empty bucket** (e.g., player only has home games in the sample) should return `null` for that bucket's average and `0` for its count, never throw.

---

## Dependencies
- **PRP-01 complete** — `is_home` field must exist on stat rows before this utility is meaningful.

---

## Files to Modify

| File | Change type |
|------|-------------|
| `backend/utils/analytics.js` | Additive — export new function at bottom of file |
| `backend/tests/espn-home-away.test.js` | Additive — new `describe` block for split utility |

---

## TDD Cycle

### Step 1 — RED: Add tests to `backend/tests/espn-home-away.test.js`

Append this `describe` block:

```js
import { homeAwaySplit } from '../utils/analytics.js';

describe('homeAwaySplit', () => {
  const stats = [
    { is_home: true,  pts: 30, reb: 14 },
    { is_home: true,  pts: 26, reb: 12 },
    { is_home: false, pts: 24, reb: 10 },
    { is_home: false, pts: 28, reb: 13 },
    { is_home: null,  pts: 20, reb: 8  },
  ];

  it('calculates correct home average for pts', () => {
    const split = homeAwaySplit(stats, 'pts');
    assert.equal(split.home_avg, 28.0);
  });

  it('calculates correct away average for pts', () => {
    const split = homeAwaySplit(stats, 'pts');
    assert.equal(split.away_avg, 26.0);
  });

  it('counts home and away games correctly', () => {
    const split = homeAwaySplit(stats, 'pts');
    assert.equal(split.home_games, 2);
    assert.equal(split.away_games, 2);
  });

  it('excludes null is_home rows from both buckets', () => {
    const split = homeAwaySplit(stats, 'pts');
    // 5 rows total, 1 null — only 4 should count
    assert.equal(split.home_games + split.away_games, 4);
  });

  it('works for reb stat key', () => {
    const split = homeAwaySplit(stats, 'reb');
    assert.equal(split.home_avg, 13.0);
    assert.equal(split.away_avg, 11.5);
  });

  it('returns null avg and 0 count when bucket is empty', () => {
    const homeOnly = [
      { is_home: true, pts: 25, reb: 10 },
      { is_home: true, pts: 27, reb: 12 },
    ];
    const split = homeAwaySplit(homeOnly, 'pts');
    assert.equal(split.away_avg, null);
    assert.equal(split.away_games, 0);
  });

  it('returns nulls for both when all rows have is_home: null', () => {
    const noContext = [
      { is_home: null, pts: 25, reb: 10 },
    ];
    const split = homeAwaySplit(noContext, 'pts');
    assert.equal(split.home_avg, null);
    assert.equal(split.away_avg, null);
  });
});
```

### Step 2 — Verify RED
```bash
cd backend && npm test tests/espn-home-away.test.js
```
**Expected failure:**
```
SyntaxError: The requested module '../utils/analytics.js' does not provide an export named 'homeAwaySplit'
```

### Step 3 — GREEN: Implement in `analytics.js`

Add at the end of `backend/utils/analytics.js`:

```js
// Returns home/away averages and game counts for a single stat key.
// Rows with is_home: null are excluded from both buckets.
export function homeAwaySplit(stats, statKey = 'pts') {
  const homeGames = stats.filter((s) => s.is_home === true);
  const awayGames = stats.filter((s) => s.is_home === false);

  const avg = (games) => {
    if (!games.length) return null;
    const total = games.reduce((acc, s) => acc + num(s[statKey] ?? 0), 0);
    return +(total / games.length).toFixed(1);
  };

  return {
    home_avg:   avg(homeGames),
    away_avg:   avg(awayGames),
    home_games: homeGames.length,
    away_games: awayGames.length,
  };
}
```

`num` is already defined at the top of the same file — no import needed.

### Step 4 — Verify GREEN
```bash
cd backend && npm test tests/espn-home-away.test.js
```
**Expected — all tests pass including PRP-01 tests.**

### Step 5 — REFACTOR
`avg()` is an inner function — clean, no duplication. No changes needed.

---

## Full Validation

```bash
cd backend && node -e "
import('./utils/analytics.js').then(m => {
  const stats = [
    { is_home: true, pts: 30 }, { is_home: true, pts: 26 },
    { is_home: false, pts: 24 }, { is_home: false, pts: 28 },
    { is_home: null, pts: 20 },
  ];
  console.log(m.homeAwaySplit(stats, 'pts'));
  // Expected: { home_avg: 28.0, away_avg: 26.0, home_games: 2, away_games: 2 }
});
"
```

---

## Error Patterns

| Error | Cause | Fix |
|-------|-------|-----|
| `home_avg` includes `null` rows | Filter uses `=== true` but rows have `1` (number) | Ensure ESPN data normalization sets Boolean, not integer |
| `NaN` in average | `statKey` not present on rows | Confirm `statKey` matches actual field name; `num()` returns 0 for undefined |
| All games in one bucket | ESPN not providing `homeAway` in meta | Run PRP-01 smoke test first to confirm `is_home` is populated |

---

## Acceptance Criteria
- [ ] `homeAwaySplit(stats, 'pts')` returns `{ home_avg, away_avg, home_games, away_games }`
- [ ] Rows with `is_home: null` are excluded from both buckets
- [ ] Empty bucket → `avg: null`, `games: 0`
- [ ] Works for `statKey = 'reb'`
- [ ] All 7 unit tests pass
- [ ] No changes to existing `analytics.js` exports — purely additive
