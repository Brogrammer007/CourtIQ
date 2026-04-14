# PRP-08 — Matchup API Endpoint

## Goal
Add `GET /api/player/:id/matchup/:defenderId` to `backend/routes/players.js` that returns NBA.com possession-level matchup data between an offensive player and a named defender.

## Why
This is the dedicated endpoint for the "Jokic guarded by Wembanyama" feature. It exposes raw possession data, a `vs_season_avg` diff, and a `verdict` label — used by the Defensive Matchup section of `PropsPage`.

---

## Codebase Context

| File | Relevant detail |
|------|-----------------|
| `backend/routes/players.js` | Add after PRP-07's route. Uses same `cached()` wrapper. |
| `backend/services/nbaStats.js` | `getMatchup(espnOff, espnDef)` — from PRP-05. Returns row or null. Throws `Error('MATCHUP_UNAVAILABLE')` on fetch failure. |
| `backend/services/espn.js` | `espnGetPlayer(id)` — resolve ESPN athlete ID to player object with `first_name`, `last_name`. |
| `backend/utils/analytics.js` | `averages()`, `percentDiff()` — already imported. |

**Both `:id` and `:defenderId` are ESPN athlete IDs.**

**Response shape:**
```json
{
  "offender": { "id": 3112335, "name": "Nikola Jokic" },
  "defender":  { "id": 1631104, "name": "Victor Wembanyama" },
  "matchup_data": {
    "games_played": 3,
    "partial_possessions": 42,
    "pts_per_possession": 0.87,
    "fg_pct_allowed": 0.461,
    "def_reb_in_matchup": 8,
    "sample_note": "42 possessions across 3 games"
  },
  "vs_season_avg": { "pts_diff_pct": -12.4, "fg_pct_diff_pct": -8.7 },
  "verdict": { "label": "Tough matchup", "tone": "down", "emoji": "🧊" }
}
```

**Error table:**

| Condition | Status | Body |
|-----------|--------|------|
| `defenderId` not a valid ESPN ID | 404 | `{ "error": "Defender not found." }` |
| Both valid, no shared matchup rows | 404 | `{ "error": "No matchup data found between these players this season." }` |
| `nbaStats.getMatchup` throws `MATCHUP_UNAVAILABLE` | 503 | `{ "error": "Matchup data temporarily unavailable." }` |

**Gotcha — `pts_per_possession`:** `player_pts / partial_possessions`. Guard against division by zero (zero possessions → `null`).

**Gotcha — cache key:** `matchup:${id}:${defenderId}` — TTL 86400s.

**Gotcha — `getMatchup` throws, not returns null:** Catch `Error('MATCHUP_UNAVAILABLE')` specifically (check `err.message`) and return 503. Other errors propagate to `next(err)`.

---

## Dependencies
- **PRP-05** — `getMatchup()` in `nbaStats.js`

---

## Files to Modify

| File | Change type |
|------|-------------|
| `backend/routes/players.js` | Add import + new route handler |
| `backend/tests/matchup-endpoint.test.js` | NEW |

---

## TDD Cycle

### Step 1 — RED: Create `backend/tests/matchup-endpoint.test.js`

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import router from '../routes/players.js';

function makeApp() {
  const app = express();
  app.use('/api', router);
  return app;
}

async function get(app, path) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      http.get(`http://localhost:${port}${path}`, (res) => {
        let body = '';
        res.on('data', d => (body += d));
        res.on('end', () => { server.close(); resolve({ status: res.statusCode, body: JSON.parse(body) }); });
      }).on('error', reject);
    });
  });
}

describe('GET /api/player/:id/matchup/:defenderId', () => {
  it('returns 200 with matchup_data, vs_season_avg, verdict for valid players with history', async () => {
    const app = makeApp();
    // Jokic vs Wembanyama — may return 404 if no data this season; check shape if 200
    const { status, body } = await get(app, '/api/player/3112335/matchup/1631104');

    if (status === 200) {
      assert.ok('offender' in body);
      assert.ok('defender' in body);
      assert.ok('matchup_data' in body);
      assert.ok('vs_season_avg' in body);
      assert.ok('verdict' in body);
      assert.ok(typeof body.matchup_data.games_played === 'number');
      assert.ok(['up', 'down', 'flat'].includes(body.verdict.tone));
    } else {
      // 404 is acceptable when no matchup data exists this season
      assert.equal(status, 404);
    }
  });

  it('returns 404 when defenderId is an unknown ESPN ID', async () => {
    const app = makeApp();
    const { status, body } = await get(app, '/api/player/3112335/matchup/999999999');
    assert.equal(status, 404);
    assert.equal(body.error, 'Defender not found.');
  });

  it('vs_season_avg.pts_diff_pct is a number when matchup data exists', async () => {
    const app = makeApp();
    const { status, body } = await get(app, '/api/player/3112335/matchup/1631104');
    if (status === 200) {
      assert.ok(typeof body.vs_season_avg.pts_diff_pct === 'number');
    }
  });
});
```

### Step 2 — Verify RED
```bash
cd backend && npm test tests/matchup-endpoint.test.js
```
**Expected failure:** 404 returned for the route path (not for the "defender not found" test — for the shape test the route itself returns 404 because it doesn't exist).

### Step 3 — GREEN: Add to `backend/routes/players.js`

**New import** (add to existing import block):
```js
import { getMatchup } from '../services/nbaStats.js';
```

**New route** (add after the props route from PRP-07):
```js
// ---- Defensive matchup: player vs specific defender -----------------------

router.get('/player/:id/matchup/:defenderId', async (req, res, next) => {
  try {
    const { id, defenderId } = req.params;

    const result = await cached(`matchup:${id}:${defenderId}`, 86400, async () => {
      // Resolve both ESPN players in parallel
      const [offPlayer, defPlayer] = await Promise.all([
        cached(`player:${id}`, TTL, () => getPlayer(id)),
        cached(`player:${defenderId}`, TTL, () => getPlayer(defenderId)),
      ]);

      if (!defPlayer) return { error: 'defender_not_found' };
      if (!offPlayer) return { error: 'offender_not_found' };

      let row;
      try {
        row = await getMatchup(offPlayer, defPlayer);
      } catch (err) {
        if (err.message === 'MATCHUP_UNAVAILABLE') return { error: 'matchup_unavailable' };
        throw err;
      }

      if (!row) return { error: 'no_matchup_data' };

      // Compute vs_season_avg
      const { stats } = await loadPlayerStatPack(id);
      const seasonAvg = averages(stats);
      const ptsPerPoss = row.partial_possessions > 0
        ? +(row.player_pts / row.partial_possessions).toFixed(2)
        : null;

      // Verdict: compare FG% allowed vs league average (0.470)
      const fgDiff  = +(((row.fg_pct ?? 0.470) - 0.470) * 100).toFixed(1);
      const verdict = fgDiff <= -5
        ? { label: 'Tough matchup',    tone: 'down', emoji: '🧊' }
        : fgDiff >= 5
        ? { label: 'Favorable matchup', tone: 'up',  emoji: '🔥' }
        : { label: 'Neutral matchup',   tone: 'flat', emoji: '⚖️' };

      return {
        offender: { id: offPlayer.id, name: `${offPlayer.first_name} ${offPlayer.last_name}` },
        defender: { id: defPlayer.id, name: `${defPlayer.first_name} ${defPlayer.last_name}` },
        matchup_data: {
          games_played:        row.games_played,
          partial_possessions: row.partial_possessions,
          pts_per_possession:  ptsPerPoss,
          fg_pct_allowed:      row.fg_pct,
          def_reb_in_matchup:  row.def_reb,
          sample_note:         `${row.partial_possessions} possessions across ${row.games_played} game${row.games_played !== 1 ? 's' : ''}`,
        },
        vs_season_avg: {
          pts_diff_pct:    seasonAvg ? percentDiff(ptsPerPoss ?? 0, seasonAvg.pts / 36) : null,
          fg_pct_diff_pct: seasonAvg ? percentDiff(row.fg_pct ?? 0, seasonAvg.fg_pct)  : null,
        },
        verdict,
      };
    });

    if (result?.error === 'defender_not_found') return res.status(404).json({ error: 'Defender not found.' });
    if (result?.error === 'offender_not_found') return res.status(404).json({ error: 'Player not found.' });
    if (result?.error === 'no_matchup_data')    return res.status(404).json({ error: 'No matchup data found between these players this season.' });
    if (result?.error === 'matchup_unavailable') return res.status(503).json({ error: 'Matchup data temporarily unavailable.' });

    res.json(result);
  } catch (err) { next(err); }
});
```

**Also add `percentDiff` to the existing analytics import** in `players.js` if not already there — it's already imported.

### Step 4 — Verify GREEN
```bash
cd backend && npm test tests/matchup-endpoint.test.js
```
**Expected — all 3 tests pass.**

### Step 5 — REFACTOR
`verdict` computation could live in `analytics.js` as `matchupVerdictFromFgPct()`. Leave in route for now — refactor if reused.

---

## Full Validation
```bash
# Valid matchup (if data exists this season)
curl http://localhost:4000/api/player/3112335/matchup/1631104 | jq .

# Unknown defender
curl http://localhost:4000/api/player/3112335/matchup/999999 | jq .error
# Expected: "Defender not found."
```

---

## Error Patterns

| Error | Cause | Fix |
|-------|-------|-----|
| `getMatchup is not a function` | PRP-05 not merged | Complete PRP-05 first |
| Always 503 | `stats.nba.com` TLS block | Install undici: `cd backend && npm install undici` |
| `pts_diff_pct` is `NaN` | Division by zero in `percentDiff` | Guard: `if (!seasonAvg) return null` |
| Cache serves stale 404 | `no_matchup_data` error cached for 86400s | Change error sentinel to not cache: return without `cached()` wrapper on 404 path |

---

## Acceptance Criteria
- [ ] `GET /api/player/3112335/matchup/1631104` returns 200 with correct shape OR 404 if no data
- [ ] `GET /api/player/3112335/matchup/999999999` returns 404 `"Defender not found."`
- [ ] `matchup_data` contains: `games_played`, `partial_possessions`, `pts_per_possession`, `fg_pct_allowed`, `def_reb_in_matchup`, `sample_note`
- [ ] `verdict.tone` is one of `'up'`, `'down'`, `'flat'`
- [ ] `stats.nba.com` unavailable → 503, not 500
- [ ] Cache TTL is 86400s
- [ ] All 3 integration tests pass
