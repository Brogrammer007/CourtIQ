# PRP-07 — Props API Endpoint

## Goal
Add `GET /api/player/:id/props` to `backend/routes/players.js` that orchestrates stats, odds, home/away split, next game, and confidence computation into the full props response shape.

## Why
This is the primary backend endpoint the `PropsPage` frontend calls. It glues together all backend services built in PRP-01 through PRP-06 into a single cacheable response.

---

## Codebase Context

| File | Relevant detail |
|------|-----------------|
| `backend/routes/players.js` | All routes defined here. New route follows the existing `cached()` + `loadPlayerStatPack()` pattern. |
| `backend/utils/cache.js` | `cached(key, ttl, fn)` — wrap async computation with TTL keyed cache. |
| `backend/utils/analytics.js` | `averages()`, `classifyPlayer()` — already imported in this file. |
| `backend/utils/confidence.js` | NEW from PRP-06 — import `computeConfidence`. |
| `backend/services/odds.js` | NEW from PRP-04 — import `getPlayerProps`. |
| `backend/services/espn.js` | NEW from PRP-03 — import `getNextGame`. |

**Existing `loadPlayerStatPack(id)` helper** (already in `players.js`) returns `{ player, stats }` where `stats` are fully normalized (with `is_home` after PRP-01).

**Response shape (from spec):**
```json
{
  "player": { "id", "name", "archetype" },
  "next_game": { "opponent_id", "opponent_name", "is_home" },
  "props": {
    "points":   { "line", "over_odds", "under_odds", "odds_available", "season_avg", "home_avg", "away_avg", "home_games", "away_games", "hit_rate_over", "hit_rate_sample", "confidence": {...} },
    "rebounds": { same structure }
  }
}
```

**Gotcha — TTL:** Props endpoint TTL = 1800s (tied to odds cache). Use `cached('props:${id}', 1800, ...)`.

**Gotcha — `next_game` may be `null`:** Offseason or ESPN schedule gap. Propagate `null` to response; do not throw.

**Gotcha — `hit_rate_over`** is a percentage (0–100 integer), not a float. `Math.round(hits / n * 100)`.

**Gotcha — `matchupRow` for confidence Factor 4:** At this endpoint we don't know the specific defender, so `matchupRow` is always `null` here. Factor 4 uses the `teamDefensiveProfile` fallback automatically (handled inside `computeConfidence`).

---

## Dependencies
- **PRP-01** — `is_home` in stat rows
- **PRP-02** — `homeAwaySplit()` in `analytics.js`
- **PRP-03** — `getNextGame()` in `espn.js`
- **PRP-04** — `getPlayerProps()` in `odds.js`
- **PRP-06** — `computeConfidence()` in `confidence.js`

---

## Files to Modify

| File | Change type |
|------|-------------|
| `backend/routes/players.js` | Add imports + new route handler |
| `backend/tests/props-endpoint.test.js` | NEW |

---

## TDD Cycle

### Step 1 — RED: Create `backend/tests/props-endpoint.test.js`

```js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import router from '../routes/players.js';

// Build a minimal Express app for testing
function makeApp() {
  const app = express();
  app.use('/api', router);
  return app;
}

async function get(app, path) {
  // Use Node's built-in http to make a request to the app
  const http = await import('node:http');
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      http.get(`http://localhost:${port}${path}`, (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        });
      }).on('error', reject);
    });
  });
}

describe('GET /api/player/:id/props', () => {
  it('returns 200 with correct top-level shape for a valid player', async () => {
    const app = makeApp();
    const { status, body } = await get(app, '/api/player/3112335/props');

    assert.equal(status, 200);
    assert.ok('player' in body);
    assert.ok('props' in body);
    assert.ok('points' in body.props);
    assert.ok('rebounds' in body.props);
  });

  it('props.points contains required fields', async () => {
    const app = makeApp();
    const { body } = await get(app, '/api/player/3112335/props');
    const pts = body.props.points;

    assert.ok('odds_available' in pts);
    assert.ok('season_avg' in pts);
    assert.ok('home_avg' in pts);
    assert.ok('away_avg' in pts);
    assert.ok('hit_rate_over' in pts);
    assert.ok('confidence' in pts);
    assert.ok('score' in pts.confidence);
    assert.ok('tier' in pts.confidence);
    assert.ok('factors' in pts.confidence);
  });

  it('confidence score is a number between 0 and 100', async () => {
    const app = makeApp();
    const { body } = await get(app, '/api/player/3112335/props');
    const score = body.props.points.confidence.score;
    assert.ok(typeof score === 'number');
    assert.ok(score >= 0 && score <= 100);
  });

  it('returns 404 for unknown player id', async () => {
    const app = makeApp();
    const { status } = await get(app, '/api/player/999999999/props');
    assert.equal(status, 404);
  });
});
```

### Step 2 — Verify RED
```bash
cd backend && npm test tests/props-endpoint.test.js
```
**Expected failure:**
```
AssertionError: Expected 404, got 404
-- or --
AssertionError: 'props' in {} === false
```
The route does not exist yet, so `router` will return 404 for the props path.

### Step 3 — GREEN: Add to `backend/routes/players.js`

**New imports** (add to existing import block at top):
```js
import { computeConfidence } from '../utils/confidence.js';
import { getPlayerProps } from '../services/odds.js';
import { getNextGame } from '../services/espn.js';
import { homeAwaySplit } from '../utils/analytics.js';
```

**New route** (add after existing `/player/:id/stats` route):
```js
// ---- Props: live odds + confidence ----------------------------------------

router.get('/player/:id/props', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await cached(`props:${id}`, 1800, async () => {
      const { player, stats } = await loadPlayerStatPack(id);
      if (!player) return { error: 'player_not_found' };
      if (!stats.length) return { error: 'no_stats' };

      const playerName = `${player.first_name} ${player.last_name}`;
      const teamId     = player.team?.id;
      const seasonAvg  = averages(stats);
      const archetype  = classifyPlayer(seasonAvg);

      // Parallel fetch: odds + next game
      const [oddsResult, nextGame] = await Promise.all([
        getPlayerProps(playerName),
        teamId ? getNextGame(teamId) : Promise.resolve(null),
      ]);

      // Home/Away splits
      const ptsSplit = homeAwaySplit(stats, 'pts');
      const rebSplit = homeAwaySplit(stats, 'reb');

      // Hit rates (last 15 games)
      const ptsLine = oddsResult.points.line;
      const rebLine = oddsResult.rebounds.line;
      const sample  = stats.slice(0, 15);
      const ptsHits = ptsLine != null ? sample.filter((s) => s.pts > ptsLine).length : null;
      const rebHits = rebLine != null ? sample.filter((s) => s.reb > rebLine).length : null;

      const isHome    = nextGame?.is_home ?? null;
      const oppId     = nextGame?.opponent_id ?? null;

      // Confidence
      const ptsConf = computeConfidence({ stats, statKey: 'pts', line: ptsLine, isHome, matchupRow: null, archetype, opponentId: oppId });
      const rebConf = computeConfidence({ stats, statKey: 'reb', line: rebLine, isHome, matchupRow: null, archetype, opponentId: oppId });

      return {
        player: { id: player.id, name: playerName, archetype },
        next_game: nextGame
          ? { opponent_id: nextGame.opponent_id, opponent_name: nextGame.opponent_name, is_home: nextGame.is_home }
          : null,
        props: {
          points: {
            ...oddsResult.points,
            season_avg:       seasonAvg?.pts ?? null,
            home_avg:         ptsSplit.home_avg,
            away_avg:         ptsSplit.away_avg,
            home_games:       ptsSplit.home_games,
            away_games:       ptsSplit.away_games,
            hit_rate_over:    ptsHits != null ? Math.round(ptsHits / sample.length * 100) : null,
            hit_rate_sample:  sample.length,
            confidence:       ptsConf,
          },
          rebounds: {
            ...oddsResult.rebounds,
            season_avg:       seasonAvg?.reb ?? null,
            home_avg:         rebSplit.home_avg,
            away_avg:         rebSplit.away_avg,
            home_games:       rebSplit.home_games,
            away_games:       rebSplit.away_games,
            hit_rate_over:    rebHits != null ? Math.round(rebHits / sample.length * 100) : null,
            hit_rate_sample:  sample.length,
            confidence:       rebConf,
          },
        },
      };
    });

    if (result?.error === 'player_not_found') return res.status(404).json({ error: 'Player not found' });
    if (result?.error === 'no_stats')         return res.status(404).json({ error: 'No stats available for this player.' });
    res.json(result);
  } catch (err) { next(err); }
});
```

### Step 4 — Verify GREEN
```bash
cd backend && npm test tests/props-endpoint.test.js
```
**Expected — all 4 tests pass.**

### Step 5 — REFACTOR
Extract hit-rate calculation into a helper if used in more than one place. For now it's localized — fine.

---

## Full Validation
```bash
curl http://localhost:4000/api/player/3112335/props | jq '{player, next_game, pts_line: .props.points.line, pts_conf: .props.points.confidence.score}'
```
Expected: `player.name = "Nikola Jokic"`, `pts_conf` between 0–100.

---

## Error Patterns

| Error | Cause | Fix |
|-------|-------|-----|
| `homeAwaySplit is not a function` | PRP-02 not merged yet | Complete PRP-02 first |
| `computeConfidence is not a function` | PRP-06 not merged yet | Complete PRP-06 first |
| `confidence.score` is `NaN` | One factor produced NaN | Check each factor with console.log in confidence.js |
| Endpoint returns stale odds | Cache key `props:${id}` hit old data | TTL is 1800s — wait or restart server |

---

## Acceptance Criteria
- [ ] `GET /api/player/3112335/props` returns 200 with `player`, `props.points`, `props.rebounds`
- [ ] `props.points` contains: `line`, `over_odds`, `under_odds`, `odds_available`, `season_avg`, `home_avg`, `away_avg`, `home_games`, `away_games`, `hit_rate_over`, `hit_rate_sample`, `confidence`
- [ ] `confidence` contains `score` (0–100), `tier`, and `factors` with all 4 keys
- [ ] `GET /api/player/999999999/props` returns 404
- [ ] All existing endpoints still respond correctly (no regression)
- [ ] All 4 integration tests pass
