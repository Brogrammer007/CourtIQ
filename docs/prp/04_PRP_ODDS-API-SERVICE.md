# PRP-04 — The Odds API Service

## Goal
Create `backend/services/odds.js` that fetches live NBA player prop lines from The Odds API and returns structured `{ points, rebounds }` prop objects with American-format odds.

## Why
The props endpoint (PRP-07) needs real betting lines to populate `line`, `over_odds`, `under_odds`, and `odds_available` in the response. Without this service all odds fields are `null` and the hit-rate confidence factor cannot be anchored to a real line.

---

## Codebase Context

| File | Relevant detail |
|------|-----------------|
| `backend/services/espn.js` | Reference for pattern: fetch → parse → return; error caught with try/catch returning null |
| `backend/services/balldontlie.js` | Reference for env-var-gated service pattern (`API_KEY` check at top) |

**The Odds API endpoints used:**
```
GET https://api.the-odds-api.com/v4/sports/basketball_nba/events
    ?dateFormat=iso&apiKey={KEY}
→ [{ id, home_team, away_team, commence_time }]

GET https://api.the-odds-api.com/v4/sports/basketball_nba/events/{eventId}/odds
    ?regions=us&markets=player_points,player_rebounds&oddsFormat=american&apiKey={KEY}
→ { bookmakers: [{ markets: [{ key, outcomes: [{ name, description, point, price }] }] }] }
```

**Odds outcome shape for player props:**
```json
{ "name": "Over", "description": "Nikola Jokic", "point": 28.5, "price": -115 }
{ "name": "Under", "description": "Nikola Jokic", "point": 28.5, "price": -105 }
```
`description` = player full name. `name` = "Over" | "Under". `point` = the line. `price` = American odds.

**Gotcha — event iteration cost:** The Odds API charges per request. Only fetch event odds until we find the player — stop iterating after first hit.

**Gotcha — player name mismatches:** Diacritics (Jokić → Jokic), suffixes (Jr., III), hyphenated names. Always normalize both sides.

**Gotcha — no events today:** NBA offseason or API returns empty array. Return `odds_available: false`, never throw.

**Gotcha — `player_points` market may not exist** for every bookmaker. Inner loop must guard against missing markets.

**Env var:** `ODDS_API_KEY` — if absent, return empty result immediately without any HTTP call.

---

## Dependencies
None — can be developed in parallel with PRP-01, 02, 03.

---

## Files to Create

| File | Change type |
|------|-------------|
| `backend/services/odds.js` | NEW |
| `backend/tests/odds-service.test.js` | NEW |

---

## TDD Cycle

### Step 1 — RED: Create `backend/tests/odds-service.test.js`

```js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Helpers
function makeEventsResponse(events) {
  return { ok: true, json: async () => events };
}

function makeOddsResponse(playerName, ptsLine, ptsOverOdds, ptsUnderOdds) {
  return {
    ok: true,
    json: async () => ({
      bookmakers: [{
        key: 'draftkings',
        markets: [
          {
            key: 'player_points',
            outcomes: [
              { name: 'Over',  description: playerName, point: ptsLine, price: ptsOverOdds  },
              { name: 'Under', description: playerName, point: ptsLine, price: ptsUnderOdds },
            ],
          },
          {
            key: 'player_rebounds',
            outcomes: [
              { name: 'Over',  description: playerName, point: 12.5, price: -110 },
              { name: 'Under', description: playerName, point: 12.5, price: -110 },
            ],
          },
        ],
      }],
    }),
  };
}

describe('getPlayerProps', () => {
  let callCount;

  beforeEach(() => {
    callCount = 0;
    process.env.ODDS_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.ODDS_API_KEY;
  });

  it('returns correct line and odds when player found', async () => {
    global.fetch = async (url) => {
      callCount++;
      if (url.includes('/events?')) return makeEventsResponse([{ id: 'evt1' }]);
      return makeOddsResponse('Nikola Jokic', 28.5, -115, -105);
    };

    const { getPlayerProps } = await import('../services/odds.js');
    const result = await getPlayerProps('Nikola Jokić'); // diacritic in input

    assert.equal(result.points.line, 28.5);
    assert.equal(result.points.over_odds, -115);
    assert.equal(result.points.under_odds, -105);
    assert.equal(result.points.odds_available, true);
    assert.equal(result.rebounds.line, 12.5);
    assert.equal(result.rebounds.odds_available, true);
  });

  it('returns odds_available: false when player not in feed', async () => {
    global.fetch = async (url) => {
      if (url.includes('/events?')) return makeEventsResponse([{ id: 'evt1' }]);
      return makeOddsResponse('Someone Else', 20.5, -110, -110);
    };

    const { getPlayerProps } = await import('../services/odds.js');
    const result = await getPlayerProps('Nikola Jokic');

    assert.equal(result.points.odds_available, false);
    assert.equal(result.points.line, null);
  });

  it('returns odds_available: false without making HTTP calls when API key missing', async () => {
    delete process.env.ODDS_API_KEY;
    global.fetch = async () => { callCount++; return { ok: true, json: async () => [] }; };

    const { getPlayerProps } = await import('../services/odds.js');
    const result = await getPlayerProps('Nikola Jokic');

    assert.equal(result.points.odds_available, false);
    assert.equal(callCount, 0); // no HTTP calls made
  });

  it('returns odds_available: false gracefully when API call fails', async () => {
    global.fetch = async () => { throw new Error('network error'); };

    const { getPlayerProps } = await import('../services/odds.js');
    const result = await getPlayerProps('Nikola Jokic');

    assert.equal(result.points.odds_available, false);
    assert.doesNotThrow(() => result);
  });
});
```

### Step 2 — Verify RED
```bash
cd backend && npm test tests/odds-service.test.js
```
**Expected failure:**
```
Error: Cannot find module '../services/odds.js'
```

### Step 3 — GREEN: Create `backend/services/odds.js`

```js
const ODDS_BASE = 'https://api.the-odds-api.com/v4';

// Normalize player name: strip diacritics, lowercase, remove name suffixes
export function normName(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s*\b(jr|sr|ii|iii|iv)\b\.?\s*/gi, ' ')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

const EMPTY = { line: null, over_odds: null, under_odds: null, odds_available: false };

async function oddsGet(path) {
  const key = process.env.ODDS_API_KEY;
  const res = await fetch(`${ODDS_BASE}${path}&apiKey=${key}`);
  if (!res.ok) throw new Error(`OddsAPI ${res.status}`);
  return res.json();
}

// Scan bookmakers for a player's Over/Under outcomes in a given market
function extractProp(bookmakers, playerNorm, marketKey) {
  for (const bm of bookmakers) {
    for (const market of (bm.markets || [])) {
      if (market.key !== marketKey) continue;
      const outcomes = market.outcomes || [];
      const over  = outcomes.find((o) => o.name === 'Over'  && normName(o.description) === playerNorm);
      const under = outcomes.find((o) => o.name === 'Under' && normName(o.description) === playerNorm);
      if (over && under) {
        return { line: over.point, over_odds: over.price, under_odds: under.price, odds_available: true };
      }
    }
  }
  return null;
}

// Main export: returns { points, rebounds } prop objects for a player by name.
export async function getPlayerProps(playerName) {
  if (!process.env.ODDS_API_KEY) {
    return { points: { ...EMPTY }, rebounds: { ...EMPTY } };
  }

  let events;
  try {
    events = await oddsGet('/sports/basketball_nba/events?dateFormat=iso');
  } catch {
    return { points: { ...EMPTY }, rebounds: { ...EMPTY } };
  }

  const playerNorm = normName(playerName);

  for (const event of (events || [])) {
    let eventData;
    try {
      eventData = await oddsGet(
        `/sports/basketball_nba/events/${event.id}/odds` +
        `?regions=us&markets=player_points,player_rebounds&oddsFormat=american`
      );
    } catch {
      continue;
    }

    const bookmakers = eventData.bookmakers || [];
    const pts = extractProp(bookmakers, playerNorm, 'player_points');
    const reb = extractProp(bookmakers, playerNorm, 'player_rebounds');

    if (pts || reb) {
      return {
        points:   pts  ?? { ...EMPTY },
        rebounds: reb  ?? { ...EMPTY },
      };
    }
  }

  return { points: { ...EMPTY }, rebounds: { ...EMPTY } };
}
```

### Step 4 — Verify GREEN
```bash
cd backend && npm test tests/odds-service.test.js
```
**Expected — all 4 tests pass.**

### Step 5 — REFACTOR
`EMPTY` spread is clean. `normName` is exported so PRP-05 can reuse it without duplication.

---

## Full Validation (requires real API key)
```bash
cd backend && ODDS_API_KEY=your_real_key node -e "
import('./services/odds.js').then(async m => {
  const result = await m.getPlayerProps('Nikola Jokic');
  console.log(JSON.stringify(result, null, 2));
});
"
```
During active NBA season: `odds_available: true`, real `line` and odds values.
Offseason or no key: `odds_available: false`, all null.

---

## Error Patterns

| Error | Cause | Fix |
|-------|-------|-----|
| `normName` returns empty string | Input is `null` or `undefined` | Guard: `(s || '')` at top of normName — already handled |
| Player always `odds_available: false` | Name normalization mismatch | `console.log(normName(apiName), normName(espnName))` side by side |
| `429 Too Many Requests` | Too many event requests per minute | Add 100ms delay between event requests; check API plan limits |
| `401 Unauthorized` | Invalid or expired API key | Verify `ODDS_API_KEY` env var is set and correct |

---

## Acceptance Criteria
- [ ] `getPlayerProps("Nikola Jokić")` matches "Nikola Jokic" in odds feed (diacritic normalization works)
- [ ] Returns `{ points: { line, over_odds, under_odds, odds_available: true }, rebounds: {...} }` when player found
- [ ] Returns `odds_available: false` when player not in feed — no exception thrown
- [ ] Returns `odds_available: false` with **zero HTTP calls** when `ODDS_API_KEY` not set
- [ ] Returns `odds_available: false` gracefully on network error
- [ ] `normName` exported so PRP-05 can import it without duplication
- [ ] All 4 unit tests pass
