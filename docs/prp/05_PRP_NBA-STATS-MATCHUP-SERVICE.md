# PRP-05 — NBA.com Matchup Service

## Goal
Create `backend/services/nbaStats.js` that fetches the full-season defensive matchup dataset from `stats.nba.com`, caches it for 24 hours, and exposes `getMatchup(espnOffPlayer, espnDefPlayer)` returning possession-level stats.

## Why
The matchup endpoint (PRP-08) and confidence Factor 4 (PRP-06) both need real possession-level data — specifically `fg_pct_allowed`, `partial_possessions`, `player_pts` — to give accurate per-defender analysis. This is the data source that makes the "Jokic when guarded by Wembanyama" feature possible.

---

## Codebase Context

| File | Relevant detail |
|------|-----------------|
| `backend/services/odds.js` | Exports `normName()` — reuse it for player name cross-reference matching. Do not redefine. |
| `backend/utils/cache.js` | TTL cache already in use. For this service use an in-memory module-level singleton instead (dataset is large, TTL-aware per-module is simpler). |

**NBA.com API response shape:**
```json
{
  "resultSets": [{
    "name": "LeagueHustleStatsPlayer",
    "headers": ["OFF_PLAYER_ID", "OFF_PLAYER_NAME", "DEF_PLAYER_ID", "DEF_PLAYER_NAME",
                "GP", "PARTIAL_POSS", "PLAYER_PTS", "FG_PCT", "DEF_REB"],
    "rowSet": [[203999, "Nikola Jokic", 1631104, "Victor Wembanyama", 3, 42, 87, 0.461, 8], ...]
  }]
}
```

**Gotcha — TLS fingerprinting:** `stats.nba.com` blocks Node's native `fetch` regardless of headers. Must use `undici`'s `fetch` with a full browser-like header set. Attempt `import('undici')` at runtime; fall back to native fetch with a warning if unavailable.

**Gotcha — column names change:** NBA.com has historically renamed columns without notice. The parser must dynamically map by column name, not by array index. Build an `idx` object: `{ COL_NAME: position }`.

**Gotcha — `DEF_REB` vs `TEAM_REB`:** Earlier seasons used `TEAM_REB`. Support both. Try `DEF_REB` first, then `TEAM_REB`, then `null`.

**Gotcha — `OFF_PLAYER_NAME` is not in the name index** (we index only defenders). For offense lookup, scan data values.

**ID namespaces:** ESPN athlete IDs ≠ nba.com player IDs. Cross-reference via normalized player name. Build two indexes on load: `offNameIndex` and `defNameIndex`.

---

## Dependencies
- **PRP-04 complete** — `normName()` must be importable from `./odds.js`

---

## Files to Create

| File | Change type |
|------|-------------|
| `backend/services/nbaStats.js` | NEW |
| `backend/tests/nba-stats.test.js` | NEW |

---

## TDD Cycle

### Step 1 — RED: Create `backend/tests/nba-stats.test.js`

```js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Minimal dataset matching the real NBA.com shape
const MOCK_DATASET = {
  resultSets: [{
    headers: ['OFF_PLAYER_ID', 'OFF_PLAYER_NAME', 'DEF_PLAYER_ID', 'DEF_PLAYER_NAME',
              'GP', 'PARTIAL_POSS', 'PLAYER_PTS', 'FG_PCT', 'DEF_REB'],
    rowSet: [
      [203999, 'Nikola Jokic',   1631104, 'Victor Wembanyama', 3, 42, 87,  0.461, 8 ],
      [203999, 'Nikola Jokic',   1629029, 'Bam Adebayo',       5, 60, 130, 0.500, 10],
      [1629029, 'Bam Adebayo',   203999,  'Nikola Jokic',      5, 55, 90,  0.430, 12],
    ],
  }],
};

beforeEach(() => {
  // Mock fetch to return our dataset
  global.fetch = async () => ({
    ok: true,
    json: async () => MOCK_DATASET,
  });
});

describe('getMatchup', () => {
  it('returns matchup row when both players have shared data', async () => {
    const { getMatchup } = await import('../services/nbaStats.js');
    const jokic = { first_name: 'Nikola', last_name: 'Jokic' };
    const wemb  = { first_name: 'Victor', last_name: 'Wembanyama' };

    const row = await getMatchup(jokic, wemb);

    assert.equal(row.games_played, 3);
    assert.equal(row.partial_possessions, 42);
    assert.equal(row.fg_pct, 0.461);
    assert.equal(row.def_reb, 8);
  });

  it('returns null when no matchup exists between these players', async () => {
    const { getMatchup } = await import('../services/nbaStats.js');
    const jokic   = { first_name: 'Nikola', last_name: 'Jokic' };
    const unknown = { first_name: 'Unknown', last_name: 'Player' };

    const row = await getMatchup(jokic, unknown);
    assert.equal(row, null);
  });

  it('handles diacritics in player names', async () => {
    const { getMatchup } = await import('../services/nbaStats.js');
    const jokic = { first_name: 'Nikola', last_name: 'Jokić' }; // diacritic
    const wemb  = { first_name: 'Victor', last_name: 'Wembanyama' };

    const row = await getMatchup(jokic, wemb);
    assert.ok(row !== null, 'Should match despite diacritic');
  });

  it('throws MATCHUP_UNAVAILABLE when NBA.com fetch fails', async () => {
    global.fetch = async () => { throw new Error('TLS blocked'); };

    const { getMatchup } = await import('../services/nbaStats.js');
    const jokic = { first_name: 'Nikola', last_name: 'Jokic' };
    const wemb  = { first_name: 'Victor', last_name: 'Wembanyama' };

    await assert.rejects(
      () => getMatchup(jokic, wemb),
      (err) => err.message === 'MATCHUP_UNAVAILABLE'
    );
  });
});
```

### Step 2 — Verify RED
```bash
cd backend && npm test tests/nba-stats.test.js
```
**Expected failure:**
```
Error: Cannot find module '../services/nbaStats.js'
```

### Step 3 — GREEN: Create `backend/services/nbaStats.js`

```js
import { normName } from './odds.js';

const MATCHUP_URL =
  'https://stats.nba.com/stats/matchupsrollup' +
  '?LeagueID=00&PerMode=PerGame&Season=2024-25&SeasonType=Regular+Season';

const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer':    'https://www.nba.com/',
  'Origin':     'https://www.nba.com',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token':  'true',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

const TTL_MS = 86_400_000; // 24 hours

let cache = null;     // { rows: Map, offIdx: Map, defIdx: Map, loadedAt: number }
let loading = null;   // in-flight promise

async function doFetch() {
  let fetchFn = fetch; // native fetch as default
  try {
    const undici = await import('undici');
    fetchFn = undici.fetch;
  } catch {
    // undici not available — native fetch may fail on stats.nba.com
    console.warn('[nbaStats] undici unavailable; falling back to native fetch');
  }

  const res = await fetchFn(MATCHUP_URL, { headers: NBA_HEADERS });
  if (!res.ok) throw new Error(`nba.com ${res.status}`);
  return res.json();
}

function buildCache(json) {
  const rs = json.resultSets?.[0];
  if (!rs) throw new Error('nba.com: unexpected shape');

  const headers = rs.headers;
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));

  // Validate required columns
  for (const col of ['OFF_PLAYER_ID','OFF_PLAYER_NAME','DEF_PLAYER_ID','DEF_PLAYER_NAME','GP','PARTIAL_POSS','PLAYER_PTS','FG_PCT']) {
    if (idx[col] == null) throw new Error(`nba.com: missing column ${col}`);
  }
  const rebCol = idx['DEF_REB'] != null ? 'DEF_REB' : idx['TEAM_REB'] != null ? 'TEAM_REB' : null;

  const rows    = new Map(); // "offId:defId" → row object
  const offIdx  = new Map(); // normName → nba.com offPlayerId (string)
  const defIdx  = new Map(); // normName → nba.com defPlayerId (string)

  for (const row of rs.rowSet) {
    const offId   = String(row[idx['OFF_PLAYER_ID']]);
    const offName = row[idx['OFF_PLAYER_NAME']];
    const defId   = String(row[idx['DEF_PLAYER_ID']]);
    const defName = row[idx['DEF_PLAYER_NAME']];

    if (!offIdx.has(normName(offName))) offIdx.set(normName(offName), offId);
    if (!defIdx.has(normName(defName))) defIdx.set(normName(defName), defId);

    rows.set(`${offId}:${defId}`, {
      nba_off_id:          offId,
      nba_def_id:          defId,
      off_name:            offName,
      def_name:            defName,
      games_played:        row[idx['GP']],
      partial_possessions: row[idx['PARTIAL_POSS']],
      player_pts:          row[idx['PLAYER_PTS']],
      fg_pct:              row[idx['FG_PCT']],
      def_reb:             rebCol ? row[idx[rebCol]] : null,
    });
  }

  return { rows, offIdx, defIdx, loadedAt: Date.now() };
}

async function ensureCache() {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache;
  if (!loading) {
    loading = doFetch()
      .then((json) => { cache = buildCache(json); loading = null; return cache; })
      .catch((err) => { loading = null; throw err; });
  }
  return loading;
}

// espnOffPlayer / espnDefPlayer: { first_name, last_name }
// Returns matchup row object or null. Throws Error('MATCHUP_UNAVAILABLE') on fetch failure.
export async function getMatchup(espnOffPlayer, espnDefPlayer) {
  let dataset;
  try {
    dataset = await ensureCache();
  } catch {
    throw new Error('MATCHUP_UNAVAILABLE');
  }

  const offNorm = normName(`${espnOffPlayer.first_name} ${espnOffPlayer.last_name}`);
  const defNorm = normName(`${espnDefPlayer.first_name} ${espnDefPlayer.last_name}`);

  const offId = dataset.offIdx.get(offNorm);
  const defId = dataset.defIdx.get(defNorm);

  if (!offId || !defId) return null;
  return dataset.rows.get(`${offId}:${defId}`) ?? null;
}
```

### Step 4 — Verify GREEN
```bash
cd backend && npm test tests/nba-stats.test.js
```
**Expected — all 4 tests pass.**

### Step 5 — REFACTOR
`buildCache` is pure (no side effects) — could be extracted for unit testing separately if needed. `ensureCache` singleton pattern is correct.

---

## Full Validation (requires network access to stats.nba.com)
```bash
cd backend && node -e "
import('./services/espn.js').then(async espn => {
  const { getMatchup } = await import('./services/nbaStats.js');
  const jokic = await espn.espnGetPlayer(3112335);
  const wemb  = await espn.espnGetPlayer(1631104);
  const row = await getMatchup(jokic, wemb);
  console.log('Jokic vs Wemb:', row);
});
"
```
Expected: row object with real possession data, or `null` if no shared games this season.

---

## Error Patterns

| Error | Cause | Fix |
|-------|-------|-----|
| `nba.com 403` | TLS fingerprint blocked native fetch | Install undici: `cd backend && npm install undici` |
| `nba.com: missing column DEF_REB` | NBA.com renamed column mid-season | Add new name to `rebCol` fallback chain |
| `getMatchup` always returns `null` | Name normalization mismatch | `console.log(normName(off), normName(def))` vs keys in `offIdx`/`defIdx` |
| Cache never expires | Server running 24+ hours, no restart | TTL checked on every call — correctly expires after 24h |

---

## Acceptance Criteria
- [ ] `getMatchup(jokicEspnObj, wembEspnObj)` returns row with `games_played`, `fg_pct`, `partial_possessions`, `def_reb`
- [ ] Returns `null` when players have no shared matchup this season
- [ ] Throws `Error('MATCHUP_UNAVAILABLE')` when `stats.nba.com` is unreachable
- [ ] Name matching handles diacritics (Jokić → Jokic)
- [ ] Dataset is fetched only once per 24h — subsequent calls use cache
- [ ] `normName` is imported from `./odds.js`, not redefined
- [ ] All 4 unit tests pass
