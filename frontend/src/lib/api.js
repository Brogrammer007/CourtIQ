const BASE = import.meta.env.VITE_API_BASE || '/api';

async function j(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  top: () => j('/top'),
  search: (q, cursor) =>
    j(`/players?search=${encodeURIComponent(q || '')}${cursor != null && cursor !== '' ? `&cursor=${cursor}` : ''}`),
  player: (id) => j(`/player/${id}`),
  stats: (id) => j(`/player/${id}/stats`),
  compare: (a, b) => j(`/compare?a=${a}&b=${b}`),
  teams: () => j('/teams'),
  vsTeam: (id, teamId) => j(`/player/${id}/vs-team/${teamId}`),
  weakness: (teamId) => j(`/team/${teamId}/weakness`),
  props: (id) => j(`/player/${id}/props`),
  defensiveMatchup: (offId, defId) => j(`/player/${offId}/matchup/${defId}`),
};
