// ESPN's public NBA API — no auth required. Great free source for complete rosters.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROSTER_CACHE_FILE = resolve(__dir, '../data/espn-roster.json');
const ROSTER_CACHE_TTL  = 24 * 60 * 60 * 1000; // 24 hours

const TEAMS_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams';
const ROSTER_URL = (id) =>
  `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${id}/roster`;

// In-memory singleton
let allPlayersPromise = null;
let idIndex = null;

// Load roster from disk if available and fresh
function loadRosterFromDisk() {
  try {
    if (!existsSync(ROSTER_CACHE_FILE)) return null;
    const raw  = JSON.parse(readFileSync(ROSTER_CACHE_FILE, 'utf8'));
    if (!raw.savedAt || Date.now() - raw.savedAt > ROSTER_CACHE_TTL) return null;
    return raw.players || null;
  } catch { return null; }
}

function saveRosterToDisk(players) {
  try {
    writeFileSync(ROSTER_CACHE_FILE, JSON.stringify({ savedAt: Date.now(), players }));
  } catch { /* non-fatal */ }
}

function normalizeAthlete(a, team) {
  return {
    id: Number(a.id),
    first_name: a.firstName || '',
    last_name: a.lastName || '',
    position: a.position?.abbreviation || '',
    height: a.displayHeight || '',
    weight: a.weight ? String(a.weight) : '',
    team: {
      id: Number(team.id),
      abbreviation: team.abbreviation,
      city: team.location,
      full_name: team.displayName,
      conference: '',
      division: '',
    },
  };
}

async function fetchTeams() {
  const res = await fetch(TEAMS_URL);
  if (!res.ok) throw new Error(`ESPN teams ${res.status}`);
  const j = await res.json();
  return j.sports[0].leagues[0].teams.map((t) => t.team);
}

async function fetchRoster(teamId) {
  const res = await fetch(ROSTER_URL(teamId));
  if (!res.ok) throw new Error(`ESPN roster ${teamId} ${res.status}`);
  return res.json();
}

export async function loadAllEspnPlayers() {
  if (allPlayersPromise) return allPlayersPromise;

  // Try disk cache first (instant load, no HTTP)
  const cached = loadRosterFromDisk();
  if (cached) {
    idIndex = new Map(cached.map((p) => [String(p.id), p]));
    allPlayersPromise = Promise.resolve(cached);
    return allPlayersPromise;
  }

  // Fetch from ESPN with per-request timeout (10s per team)
  allPlayersPromise = (async () => {
    const teams = await fetchTeams();
    const rosters = await Promise.all(
      teams.map(async (t) => {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 10_000);
          const res = await fetch(ROSTER_URL(t.id), { signal: ctrl.signal });
          clearTimeout(timer);
          if (!res.ok) return [];
          const r = await res.json();
          const athletes = Array.isArray(r.athletes) ? r.athletes : [];
          const flat = athletes.flatMap((a) => (a.items ? a.items : [a]));
          return flat.map((a) => normalizeAthlete(a, t));
        } catch {
          return [];
        }
      })
    );
    const players = rosters.flat().filter((p) => p.id && p.first_name);
    players.sort((a, b) => a.last_name.localeCompare(b.last_name));
    idIndex = new Map(players.map((p) => [String(p.id), p]));
    saveRosterToDisk(players); // persist for next startup
    return players;
  })().catch((err) => {
    allPlayersPromise = null;
    throw err;
  });

  return allPlayersPromise;
}

export async function espnSearchPlayers({ search = '', per_page = 100, cursor } = {}) {
  const all = await loadAllEspnPlayers();
  const q = search.trim().toLowerCase();
  const filtered = q
    ? all.filter(
        (p) =>
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
          (p.team?.full_name || '').toLowerCase().includes(q) ||
          (p.team?.abbreviation || '').toLowerCase().includes(q)
      )
    : all;
  const start = Number(cursor) || 0;
  const page = filtered.slice(start, start + per_page);
  const next = start + per_page < filtered.length ? start + per_page : null;
  return { data: page, next_cursor: next, total: filtered.length };
}

export async function espnGetPlayer(id) {
  await loadAllEspnPlayers();
  return idIndex?.get(String(id)) ?? null;
}

const normName = (s) =>
  (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export async function espnFindByName(firstName, lastName) {
  const all = await loadAllEspnPlayers();
  const f = normName(firstName);
  const l = normName(lastName);
  return all.find((p) => normName(p.first_name) === f && normName(p.last_name) === l) ?? null;
}

const SCHEDULE_URL = (teamId) =>
  `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/schedule`;

// --- Real per-game stats (gamelog) -----------------------------------------
// ESPN labels: MIN, FG, FG%, 3PT, 3P%, FT, FT%, REB, AST, BLK, STL, PF, TO, PTS
const GAMELOG_URL = (id) =>
  `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}/gamelog`;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function espnGetPlayerStats(id) {
  const res = await fetch(GAMELOG_URL(id));
  if (!res.ok) throw new Error(`ESPN gamelog ${id} ${res.status}`);
  const j = await res.json();
  const eventMeta = j.events || {};
  const rows = [];
  for (const st of j.seasonTypes || []) {
    for (const cat of st.categories || []) {
      for (const e of cat.events || []) {
        const meta = eventMeta[e.eventId];
        if (!meta || !Array.isArray(e.stats) || e.stats.length < 14) continue;
        const s = e.stats;
        // Skip DNPs (MIN 0 and PTS 0 with no attempts)
        if (num(s[0]) === 0 && num(s[13]) === 0) continue;
        const oppId = meta.opponent?.id ? Number(meta.opponent.id) : null;
        const isHome = meta.atVs === 'vs' ? true
                     : meta.atVs === '@' ? false
                     : meta.team?.id != null
                       ? String(meta.team.id) === String(meta.homeTeamId)
                       : null;
        rows.push({
          event_id: e.eventId,
          game_date: meta.gameDate ? meta.gameDate.slice(0, 10) : null,
          opponent_id: oppId,
          is_home: isHome,
          min: String(s[0] ?? ''),
          pts: num(s[13]),
          reb: num(s[7]),
          ast: num(s[8]),
          blk: num(s[9]),
          stl: num(s[10]),
          fg_pct: +(num(s[2]) / 100).toFixed(3),
          fg3_pct: +(num(s[4]) / 100).toFixed(3),
        });
      }
    }
  }
  // Newest first; only keep recent seasons (2024 onwards = current + last season)
  rows.sort((a, b) => (b.game_date || '').localeCompare(a.game_date || ''));
  const cutoff = '2024-01-01';
  return rows.filter((r) => (r.game_date || '') >= cutoff);
}

// Returns the next unplayed game for a given ESPN team ID.
// Returns { opponent_id, opponent_name, is_home, date } or null.
// Tries regular season (2), playoffs (3), and play-in (5) in that order.
export async function getNextGame(teamId) {
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

  for (const seasontype of [2, 3, 5]) {
    let j;
    try {
      const res = await fetch(`${SCHEDULE_URL(teamId)}?seasontype=${seasontype}`);
      if (!res.ok) continue;
      j = await res.json();
    } catch { continue; }

    for (const event of (j.events || [])) {
      const dateStr = event.date ? event.date.slice(0, 10) : null;
      if (!dateStr || dateStr < today) continue;

      for (const comp of (event.competitions || [])) {
        const competitors = comp.competitors || [];
        const us   = competitors.find((c) => String(c.team?.id) === String(teamId));
        const them = competitors.find((c) => String(c.team?.id) !== String(teamId));
        if (!us || !them) continue;

        return {
          opponent_id:   Number(them.team.id),
          opponent_name: them.team.displayName || them.team.name || '',
          is_home:       us.homeAway?.trim() === 'home',
          date:          dateStr,
        };
      }
    }
  }

  return null;
}
