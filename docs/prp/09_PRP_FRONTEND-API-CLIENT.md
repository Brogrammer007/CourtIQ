# PRP-09 — Frontend API Client Extensions

## Goal
Add `props(id)` and `defensiveMatchup(offId, defId)` methods to `frontend/src/lib/api.js` so React components can call the two new backend endpoints without scattering raw `fetch` calls.

## Why
`api.js` is the single source of truth for all backend calls (per project rules). Any component that calls a new endpoint must go through this file. Adding the methods here keeps the pattern consistent and makes future mocking/testing trivial.

---

## Codebase Context

| File | Relevant detail |
|------|-----------------|
| `frontend/src/lib/api.js` | 19 lines. Single `j(path)` helper wraps `fetch`. All methods call `j(...)`. Extend by adding to the `api` object. |

**Existing pattern:**
```js
const BASE = import.meta.env.VITE_API_BASE || '/api';
async function j(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
export const api = {
  top:      () => j('/top'),
  player:   (id) => j(`/player/${id}`),
  stats:    (id) => j(`/player/${id}/stats`),
  // ...
};
```

**Gotcha — no test framework on frontend yet.** Add `vitest` for the first time.

**Gotcha — `api.js` uses `import.meta.env`** which is Vite-specific. Tests need to mock it. Use `vi.stubEnv` or just set `VITE_API_BASE` in test setup.

---

## Dependencies
- **PRP-07** deployed (props endpoint must exist for integration tests to pass)
- **PRP-08** deployed (matchup endpoint must exist)

---

## Files to Modify

| File | Change type |
|------|-------------|
| `frontend/src/lib/api.js` | Additive — 2 new methods |
| `frontend/package.json` | Add vitest + @testing-library/react as devDeps |
| `frontend/vite.config.js` | Add vitest config block |
| `frontend/src/lib/api.test.js` | NEW |

---

## Test Setup (one-time for frontend)

```bash
cd frontend && npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom
```

Add to `frontend/vite.config.js`:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

Add to `frontend/package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

---

## TDD Cycle

### Step 1 — RED: Create `frontend/src/lib/api.test.js`

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock global fetch before importing api
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Stub Vite env
vi.stubEnv('VITE_API_BASE', '/api');

describe('api.props', () => {
  beforeEach(() => mockFetch.mockReset());

  it('calls the correct props endpoint', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ player: {}, props: {} }),
    });

    const { api } = await import('./api.js');
    await api.props(3112335);

    expect(mockFetch).toHaveBeenCalledWith('/api/player/3112335/props');
  });

  it('throws when the endpoint returns a non-2xx status', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });

    const { api } = await import('./api.js');
    await expect(api.props(999999)).rejects.toThrow('404');
  });
});

describe('api.defensiveMatchup', () => {
  beforeEach(() => mockFetch.mockReset());

  it('calls the correct matchup endpoint with both IDs', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ offender: {}, defender: {}, matchup_data: {} }),
    });

    const { api } = await import('./api.js');
    await api.defensiveMatchup(3112335, 1631104);

    expect(mockFetch).toHaveBeenCalledWith('/api/player/3112335/matchup/1631104');
  });
});
```

### Step 2 — Verify RED
```bash
cd frontend && npm test
```
**Expected failure:**
```
TypeError: api.props is not a function
TypeError: api.defensiveMatchup is not a function
```

### Step 3 — GREEN: Update `frontend/src/lib/api.js`

Add two lines to the `api` object:
```js
export const api = {
  top:              () => j('/top'),
  search:           (q, cursor) => j(`/players?search=${encodeURIComponent(q || '')}${cursor != null && cursor !== '' ? `&cursor=${cursor}` : ''}`),
  player:           (id) => j(`/player/${id}`),
  stats:            (id) => j(`/player/${id}/stats`),
  compare:          (a, b) => j(`/compare?a=${a}&b=${b}`),
  teams:            () => j('/teams'),
  vsTeam:           (id, teamId) => j(`/player/${id}/vs-team/${teamId}`),
  weakness:         (teamId) => j(`/team/${teamId}/weakness`),
  props:            (id) => j(`/player/${id}/props`),                        // ← NEW
  defensiveMatchup: (offId, defId) => j(`/player/${offId}/matchup/${defId}`), // ← NEW
};
```

### Step 4 — Verify GREEN
```bash
cd frontend && npm test
```
**Expected — all 3 tests pass.**

### Step 5 — REFACTOR
No cleanup needed. The additions follow the established one-liner pattern.

---

## Full Validation
```bash
# Start backend, then from browser console:
# import { api } from '/src/lib/api.js'
# api.props(3112335).then(console.log)

# Or curl the proxy:
curl http://localhost:5173/api/player/3112335/props | jq .player.name
```

---

## Error Patterns

| Error | Cause | Fix |
|-------|-------|-----|
| `import.meta.env` is undefined in tests | Vitest not configured for Vite env | Add `vi.stubEnv('VITE_API_BASE', '/api')` before import |
| `Cannot find module './api.js'` | Test file path wrong | Confirm test is in `frontend/src/lib/` |
| Vitest not found | Package not installed | Run `npm install --save-dev vitest` in `frontend/` |

---

## Acceptance Criteria
- [ ] `api.props(id)` calls `GET /api/player/{id}/props`
- [ ] `api.defensiveMatchup(offId, defId)` calls `GET /api/player/{offId}/matchup/{defId}`
- [ ] Both methods throw on non-2xx responses
- [ ] No other methods in `api.js` are changed
- [ ] All 3 vitest tests pass
