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
  for (const col of ['OFF_PLAYER_ID', 'OFF_PLAYER_NAME', 'DEF_PLAYER_ID', 'DEF_PLAYER_NAME', 'GP', 'PARTIAL_POSS', 'PLAYER_PTS', 'FG_PCT']) {
    if (idx[col] == null) throw new Error(`nba.com: missing column ${col}`);
  }
  const rebCol = idx['DEF_REB'] != null ? 'DEF_REB' : idx['TEAM_REB'] != null ? 'TEAM_REB' : null;

  const rows   = new Map(); // "offId:defId" → row object
  const offIdx = new Map(); // normName → nba.com offPlayerId (string)
  const defIdx = new Map(); // normName → nba.com defPlayerId (string)

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

// Exported for testing only — resets module-level cache so fetch is re-attempted
export function resetCache() {
  cache = null;
  loading = null;
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
