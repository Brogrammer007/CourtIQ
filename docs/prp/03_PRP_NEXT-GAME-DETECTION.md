# PRP-03 — Next Game Detection

## Goal
Add `getNextGame(teamId)` to `espn.js` that fetches the ESPN team schedule and returns the next unplayed game with opponent and home/away context.

## Why
The props endpoint (PRP-07) needs to know who the player's team plays next — specifically `opponent_id`, `opponent_name`, and `is_home` — to contextualize the Home/Away confidence factor and populate the `next_game` field of the `/api/player/:id/props` response.

---

## Codebase Context

| File | Relevant detail |
|------|-----------------|
| `backend/services/espn.js` | All ESPN API calls live here. New function follows the same `fetch → parse → return` pattern as existing ones. |

**ESPN Schedule endpoint shape:**
```
GET https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{teamId}/schedule

Response (relevant fields):
{
  "events": [
    {
      "date": "2025-04-15T00:00Z",
      "competitions": [
        {
          "competitors": [
            { "homeAway": "home", "team": { "id": "7", "displayName": "Denver Nuggets" } },
            { "homeAway": "away", "team": { "id": "21", "displayName": "San Antonio Spurs" } }
          ]
        }
      ]
    }
  ]
}
```

**Gotcha — date comparison:** `event.date` is ISO 8601 with time (`"2025-04-15T00:00Z"`). Compare only the date portion (`slice(0,10)`) against today's date string in `YYYY-MM-DD` format.

**Gotcha — already-played games appear first** in `events` array. Iterate forward and skip any game whose date is before today.

**Gotcha — `event.date` may be missing** on some bye/rest entries. Skip those.

**Gotcha — offseason:** Schedule may have no future games. Return `null`, don't throw.

**Existing pattern to follow:** `fetchTeams()` in the same file uses a plain `fetch` → `.json()` → parse chain. Do the same.

---

## Dependencies
None — independent of PRP-01 and PRP-02.

---

## Files to Modify

| File | Change type |
|------|-------------|
| `backend/services/espn.js` | Additive — new constant + new exported function |
| `backend/tests/next-game.test.js` | NEW — unit tests using a mocked fetch |

---

## TDD Cycle

### Step 1 — RED: Create `backend/tests/next-game.test.js`

```js
import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';

// We mock global fetch before importing the module under test
const futureDate = new Date(Date.now() + 86400 * 1000).toISOString(); // tomorrow
const pastDate   = new Date(Date.now() - 86400 * 1000).toISOString(); // yesterday

function makeMockSchedule(events) {
  return JSON.stringify({ events });
}

function mockFetch(body) {
  return async () => ({ ok: true, json: async () => JSON.parse(body) });
}

describe('getNextGame', () => {
  it('returns the next upcoming game with correct opponent and is_home', async () => {
    global.fetch = mockFetch(makeMockSchedule([
      {
        date: futureDate,
        competitions: [{
          competitors: [
            { homeAway: 'home', team: { id: '7',  displayName: 'Denver Nuggets' } },
            { homeAway: 'away', team: { id: '21', displayName: 'San Antonio Spurs' } },
          ],
        }],
      },
    ]));

    const { getNextGame } = await import('../services/espn.js');
    const result = await getNextGame('7');

    assert.equal(result.opponent_id, 21);
    assert.equal(result.opponent_name, 'San Antonio Spurs');
    assert.equal(result.is_home, true);
    assert.ok(result.date);
  });

  it('skips past games and returns null when no future games exist', async () => {
    global.fetch = mockFetch(makeMockSchedule([
      {
        date: pastDate,
        competitions: [{
          competitors: [
            { homeAway: 'home', team: { id: '7',  displayName: 'Denver Nuggets' } },
            { homeAway: 'away', team: { id: '21', displayName: 'San Antonio Spurs' } },
          ],
        }],
      },
    ]));

    const { getNextGame } = await import('../services/espn.js');
    const result = await getNextGame('7');
    assert.equal(result, null);
  });

  it('returns null when ESPN schedule fetch fails', async () => {
    global.fetch = async () => ({ ok: false, status: 404 });

    const { getNextGame } = await import('../services/espn.js');
    const result = await getNextGame('7');
    assert.equal(result, null);
  });
});
```

### Step 2 — Verify RED
```bash
cd backend && npm test tests/next-game.test.js
```
**Expected failure:**
```
SyntaxError: The requested module '../services/espn.js' does not provide an export named 'getNextGame'
```

### Step 3 — GREEN: Implement in `espn.js`

Add constant near the top of `espn.js` (with other URL constants):
```js
const SCHEDULE_URL = (teamId) =>
  `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/schedule`;
```

Add exported function at the end of `espn.js`:
```js
// Returns the next unplayed game for a given ESPN team ID.
// Returns { opponent_id, opponent_name, is_home, date } or null.
export async function getNextGame(teamId) {
  let res;
  try {
    res = await fetch(SCHEDULE_URL(teamId));
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const j = await res.json();
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  const events = j.events || [];

  for (const event of events) {
    const dateStr = event.date ? event.date.slice(0, 10) : null;
    if (!dateStr || dateStr < today) continue;

    const competitions = event.competitions || [];
    for (const comp of competitions) {
      const competitors = comp.competitors || [];
      const us   = competitors.find((c) => String(c.team?.id) === String(teamId));
      const them = competitors.find((c) => String(c.team?.id) !== String(teamId));
      if (!us || !them) continue;

      return {
        opponent_id:   Number(them.team.id),
        opponent_name: them.team.displayName || them.team.name || '',
        is_home:       us.homeAway === 'home',
        date:          dateStr,
      };
    }
  }

  return null;
}
```

### Step 4 — Verify GREEN
```bash
cd backend && npm test tests/next-game.test.js
```
**Expected — all 3 tests pass.**

### Step 5 — REFACTOR
Extract `today` string into a helper if reused elsewhere. For now it's a single-use local — fine as-is.

---

## Full Validation

Live smoke test (requires running backend or standalone node):
```bash
cd backend && node -e "
import('./services/espn.js').then(async m => {
  const next = await m.getNextGame(7); // Denver Nuggets
  console.log('Next game:', next);
  // During season: { opponent_id: N, opponent_name: '...', is_home: bool, date: 'YYYY-MM-DD' }
  // Offseason: null
});
"
```

---

## Error Patterns

| Error | Cause | Fix |
|-------|-------|-----|
| Returns `null` during active season | `event.date < today` string comparison broken | Log `dateStr` and `today` — check timezone offset; ESPN dates may be UTC midnight |
| `opponent_id` is `NaN` | `them.team.id` is a string like `"007"` | `Number()` coercion handles leading zeros — check value isn't undefined |
| All games return `is_home: false` | `us.homeAway` is `"home "` with trailing space | Trim: `us.homeAway?.trim() === 'home'` |
| Module caching breaks mock fetch | Node caches module on first import in test | Use `--experimental-test-isolation=none` or restructure mock before import |

---

## Acceptance Criteria
- [ ] `getNextGame('7')` returns `{ opponent_id, opponent_name, is_home, date }` for a team with upcoming games
- [ ] Returns `null` when no future games exist in schedule (offseason)
- [ ] Returns `null` when ESPN returns non-200
- [ ] `is_home: true` when player's team is home team, `false` when away
- [ ] All 3 unit tests pass
