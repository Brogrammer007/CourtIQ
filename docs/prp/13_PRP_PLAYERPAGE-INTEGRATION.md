# PRP-13 — PlayerPage Integration & Route Registration

## Goal
Register the `/player/:id/props` route in `App.jsx` and add a "View Props & Confidence" button to the player header in `PlayerPage.jsx` that links to the new page.

## Why
The `PropsPage` built in PRP-11 is inaccessible until its route is registered. This is the final wiring step that makes the feature discoverable from the existing player detail page.

---

## Codebase Context

| File | Relevant detail |
|------|-----------------|
| `frontend/src/App.jsx` | All routes defined here with `<Routes>` + `<Route>`. Add new `<Route>` for `/player/:id/props`. |
| `frontend/src/pages/PlayerPage.jsx` | Player header section (lines ~63–90). Add button after the favorites button. |

**Existing route pattern in `App.jsx`:**
```jsx
<Routes>
  <Route path="/"              element={<Landing />} />
  <Route path="/app"           element={<Dashboard />} />
  <Route path="/player/:id"    element={<PlayerPage />} />
  <Route path="/compare"       element={<Compare />} />
  <Route path="/predictions"   element={<Predictions />} />
  <Route path="/favorites"     element={<Favorites />} />
</Routes>
```

**Button placement** — in `PlayerPage.jsx`, the header flex row contains the avatar, player info, and a favorites button. Add the props button **after** the favorites button.

**Button style:** Use existing `.btn-ghost` class. Add a chart emoji or arrow icon. Link using React Router `<Link>` component, not `<a>`.

---

## Dependencies
- **PRP-11** complete — `PropsPage.jsx` must exist to be imported

---

## Files to Modify

| File | Change type |
|------|-------------|
| `frontend/src/App.jsx` | Additive — 1 new import + 1 new `<Route>` |
| `frontend/src/pages/PlayerPage.jsx` | Additive — 1 new import + 1 `<Link>` button in header |
| `frontend/src/pages/PlayerPage.test.jsx` | NEW — test for the button |

---

## TDD Cycle

### Step 1 — RED: Create `frontend/src/pages/PlayerPage.test.jsx`

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../lib/api.js', () => ({
  api: {
    player: vi.fn(),
    stats:  vi.fn(),
  },
}));

import { api } from '../lib/api.js';
import PlayerPage from './PlayerPage.jsx';

const MOCK_PLAYER = {
  data: {
    id: 3112335, first_name: 'Nikola', last_name: 'Jokic',
    position: 'C', height: '6\'11"', weight: '284',
    team: { id: 7, full_name: 'Denver Nuggets', abbreviation: 'DEN' },
  },
};

const MOCK_STATS = {
  data: [],
  averages: { pts: 29.1, reb: 13.1, ast: 8.3, fg_pct: 0.583, fg3_pct: 0.359 },
  trend: { direction: 'up', delta: 2.1, form: 78 },
  prediction: { expected_points: 30.2, line: 25.5, over_probability: 72, under_probability: 28 },
};

function renderPlayerPage(id = '3112335') {
  return render(
    <MemoryRouter initialEntries={[`/player/${id}`]}>
      <Routes>
        <Route path="/player/:id" element={<PlayerPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PlayerPage — props button', () => {
  beforeEach(() => {
    api.player.mockResolvedValue(MOCK_PLAYER);
    api.stats.mockResolvedValue(MOCK_STATS);
  });

  it('renders a "Props & Confidence" link button', async () => {
    renderPlayerPage();
    await waitFor(() => screen.getByText('Nikola Jokic'));
    const link = screen.getByRole('link', { name: /props/i });
    expect(link).toBeInTheDocument();
  });

  it('the props link points to /player/:id/props', async () => {
    renderPlayerPage();
    await waitFor(() => screen.getByText('Nikola Jokic'));
    const link = screen.getByRole('link', { name: /props/i });
    expect(link).toHaveAttribute('href', '/player/3112335/props');
  });
});
```

### Step 2 — Verify RED
```bash
cd frontend && npm test src/pages/PlayerPage.test.jsx
```
**Expected failure:**
```
Unable to find role="link" with name /props/i
```

### Step 3 — GREEN

#### `frontend/src/App.jsx` — add import and route

Add import near the top:
```jsx
import PropsPage from './pages/PropsPage.jsx';
```

Add route inside `<Routes>`:
```jsx
<Route path="/player/:id/props" element={<PropsPage />} />
```

Full routes block after change:
```jsx
<Routes>
  <Route path="/"                  element={<Landing />} />
  <Route path="/app"               element={<Dashboard />} />
  <Route path="/player/:id"        element={<PlayerPage />} />
  <Route path="/player/:id/props"  element={<PropsPage />} />   {/* ← NEW */}
  <Route path="/compare"           element={<Compare />} />
  <Route path="/predictions"       element={<Predictions />} />
  <Route path="/favorites"         element={<Favorites />} />
</Routes>
```

#### `frontend/src/pages/PlayerPage.jsx` — add props button

In `PlayerPage.jsx`, the `Link` component is already imported from `react-router-dom`.

Find the favorites button (around line 83–89):
```jsx
<button
  onClick={() => toggleFavorite(Number(id))}
  className={`btn-ghost ${fav ? 'text-yellow-300 ...' : ''}`}
>
  ...{fav ? 'Favorited' : 'Add to Favorites'}
</button>
```

Add this `<Link>` button directly after the favorites `<button>`:
```jsx
<Link
  to={`/player/${id}/props`}
  className="btn-ghost"
>
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
  Props & Confidence
</Link>
```

### Step 4 — Verify GREEN
```bash
cd frontend && npm test
```
**Expected — all tests pass including 2 new PlayerPage tests.**

### Step 5 — REFACTOR
No cleanup needed. Single button addition.

---

## Full Validation
```bash
cd frontend && npm run dev
# Navigate to http://localhost:5173/player/3112335
# Verify "Props & Confidence" button visible in player header
# Click it — should navigate to /player/3112335/props
# Press back — returns to /player/3112335
```

---

## Error Patterns

| Error | Cause | Fix |
|-------|-------|-----|
| `PropsPage` import error in `App.jsx` | PRP-11 file not created | Complete PRP-11 first |
| Button renders but clicking goes to 404 | Route not registered in `App.jsx` | Confirm `<Route path="/player/:id/props">` added |
| `btn-ghost` class not applying styles | Class not in Tailwind config | Check `tailwind.config.js` content paths include `src/**/*.jsx` |

---

## Acceptance Criteria
- [ ] Route `/player/:id/props` renders `PropsPage`
- [ ] `PlayerPage` header shows "Props & Confidence" link button
- [ ] Link href is `/player/{id}/props`
- [ ] Clicking the button navigates to `PropsPage` without full page reload
- [ ] All existing routes still work (no regression)
- [ ] All 2 unit tests pass
