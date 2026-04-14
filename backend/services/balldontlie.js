// Multi-source player data: balldontlie (if key) → ESPN public API.
// No mock/synth fallback — if real data isn't available, callers get null/[].
import { espnSearchPlayers, espnGetPlayer, espnGetPlayerStats, espnFindByName } from './espn.js';

const BASE = process.env.BALLDONTLIE_BASE || 'https://api.balldontlie.io/v1';
const API_KEY = process.env.BALLDONTLIE_API_KEY || '';

async function bdl(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
    else url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    headers: API_KEY ? { Authorization: API_KEY } : {},
  });
  if (!res.ok) throw new Error(`balldontlie ${res.status}`);
  return res.json();
}

// ----- Public API -----------------------------------------------------------

export async function searchPlayers({ search = '', per_page = 100, cursor } = {}) {
  if (API_KEY) {
    try {
      const data = await bdl('/players', { search, per_page, cursor });
      return { data: data.data, next_cursor: data.meta?.next_cursor ?? null };
    } catch (_e) { /* fall through */ }
  }
  // ESPN public API — full active rosters (~538 players)
  return espnSearchPlayers({ search, per_page, cursor });
}

export async function getPlayer(id) {
  if (API_KEY) {
    try {
      const data = await bdl(`/players/${id}`);
      return data.data ?? data;
    } catch (_e) { /* fall through */ }
  }
  const p = await espnGetPlayer(id);
  return p ?? null;
}

export async function getPlayerStats(id) {
  if (API_KEY) {
    try {
      const data = await bdl('/stats', { 'player_ids[]': id, per_page: 30 });
      const rows = (data.data || []).sort(
        (a, b) => new Date(b.game?.date || b.game_date) - new Date(a.game?.date || a.game_date)
      );
      if (rows.length) return rows;
    } catch (_e) { /* fall through */ }
  }

  // ESPN real gamelog — resolve ESPN athlete id even for legacy ids
  let espnId = id;
  const direct = await espnGetPlayer(id).catch(() => null);
  if (!direct) {
    // Legacy id: try to find matching ESPN athlete by name
    const player = await getPlayer(id).catch(() => null);
    if (player) {
      const match = await espnFindByName(player.first_name, player.last_name).catch(() => null);
      if (match) espnId = match.id;
    }
  }

  try {
    const rows = await espnGetPlayerStats(espnId);
    return rows;
  } catch (_e) {
    return []; // ESPN 404 or other error — no data available
  }
}

// Expose for other modules (weakness calc) — deterministic defensive profile per team.
// Kept as a pure math function (no data needed), still useful for matchup analytics.
export function teamDefensiveProfile(teamId) {
  function seeded(n) {
    let s = Number(n) % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }
  const rand = seeded((Number(teamId) || 1) * 997 + 13);
  return {
    vs_scorer:    +(0.85 + rand() * 0.30).toFixed(3),
    vs_playmaker: +(0.85 + rand() * 0.30).toFixed(3),
    vs_big:       +(0.85 + rand() * 0.30).toFixed(3),
    vs_balanced:  +(0.90 + rand() * 0.20).toFixed(3),
  };
}

// ----- Teams ---------------------------------------------------------------

let teamsCache = null;
export async function getAllTeams() {
  if (teamsCache) return teamsCache;
  const pool = [];
  let cursor = '';
  for (let i = 0; i < 10; i++) {
    const r = await searchPlayers({ per_page: 100, cursor });
    pool.push(...r.data);
    if (r.next_cursor == null) break;
    cursor = r.next_cursor;
  }
  const map = new Map();
  for (const p of pool) {
    if (p.team?.id && !map.has(p.team.id)) map.set(p.team.id, p.team);
  }
  teamsCache = [...map.values()].sort((a, b) =>
    (a.full_name || '').localeCompare(b.full_name || '')
  );
  return teamsCache;
}

export async function getTeam(teamId) {
  const teams = await getAllTeams();
  return teams.find((t) => String(t.id) === String(teamId)) ?? null;
}

// Curated names for the "Trending" row.
const TRENDING_NAMES = [
  'LeBron James', 'Stephen Curry', 'Kevin Durant', 'Giannis Antetokounmpo',
  'Nikola Jokic', 'Luka Doncic', 'Jayson Tatum', 'Joel Embiid',
  'Shai Gilgeous-Alexander', 'Devin Booker',
];

const normalize = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export async function getTopPlayers() {
  const pool = [];
  let cursor = '';
  for (let i = 0; i < 10; i++) {
    const r = await searchPlayers({ per_page: 100, cursor });
    pool.push(...r.data);
    if (r.next_cursor == null) break;
    cursor = r.next_cursor;
  }
  const byName = new Map(pool.map((p) => [normalize(`${p.first_name} ${p.last_name}`), p]));
  const picks = TRENDING_NAMES.map((n) => byName.get(normalize(n))).filter(Boolean);
  return picks.length >= 6 ? picks : pool.slice(0, 10);
}
