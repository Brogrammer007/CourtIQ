# PRP-11 — PropsPage: Props Section

## Goal
Create `frontend/src/pages/PropsPage.jsx` with the route `/player/:id/props`, rendering two prop cards (Points and Rebounds) each with live odds, splits, hit-rate bar, and a `ConfidenceMeter`.

## Why
This is the primary user-facing page for the feature. It brings together everything built in PRP-01 through PRP-10 into a complete visual experience.

---

## Codebase Context

| File | Relevant detail |
|------|-----------------|
| `frontend/src/pages/PlayerPage.jsx` | Reference for page layout, `useParams`, `useEffect` data fetching, error/loading state pattern. Mirror the structure. |
| `frontend/src/components/Skeleton.jsx` | Exports `SkeletonCard`, `SkeletonLine` — use during loading. |
| `frontend/src/components/StatTile.jsx` | Reference for `.glass` card style. |
| `frontend/src/components/ConfidenceMeter.jsx` | Import from PRP-10. |
| `frontend/src/lib/api.js` | `api.props(id)` from PRP-09. |
| `frontend/src/App.jsx` | Must add `<Route>` for this page — handled in **PRP-13**. |

**Page data source:** `api.props(id)` — response shape from PRP-07.

**Loading states:**
- Initial load: show 2 `SkeletonCard` placeholders
- Error: show rose-colored error message
- No odds: show `"—"` for line/odds fields + "No live odds" badge

**Odds formatting — American odds:**
- `+120` → green text (`text-emerald-300`)
- `-115` → white text
- `null` → `"—"`

**Hit rate bar:** Simple inline progress bar, not a Recharts chart. `width: ${hit_rate_over}%` as inline style.

**Gotcha — `confidence` may be partial during load:** Always guard `prop?.confidence?.score`.

**Gotcha — `next_game` may be `null`:** Show "Schedule unavailable" badge instead of opponent context.

---

## Dependencies
- **PRP-09** — `api.props(id)` must exist
- **PRP-10** — `ConfidenceMeter` must exist

---

## Files to Create

| File | Change type |
|------|-------------|
| `frontend/src/pages/PropsPage.jsx` | NEW |
| `frontend/src/pages/PropsPage.test.jsx` | NEW |

---

## TDD Cycle

### Step 1 — RED: Create `frontend/src/pages/PropsPage.test.jsx`

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock api module
vi.mock('../lib/api.js', () => ({
  api: {
    props: vi.fn(),
  },
}));

import { api } from '../lib/api.js';
import PropsPage from './PropsPage.jsx';

const MOCK_PROPS_RESPONSE = {
  player: { id: 3112335, name: 'Nikola Jokic', archetype: 'big' },
  next_game: { opponent_id: 21, opponent_name: 'San Antonio Spurs', is_home: false },
  props: {
    points: {
      line: 28.5, over_odds: -115, under_odds: -105, odds_available: true,
      season_avg: 29.1, home_avg: 30.4, away_avg: 27.8,
      home_games: 18, away_games: 17,
      hit_rate_over: 67, hit_rate_sample: 15,
      confidence: {
        score: 74, tier: 'medium',
        factors: {
          hit_rate:  { score: 80, label: 'Hit 12/15 games over line' },
          form:      { score: 85, label: 'Trending up +3.2 PTS' },
          home_away: { score: 65, label: 'Away game, avg 27.8 vs line 28.5' },
          matchup:   { score: 58, label: 'Avg matchup difficulty' },
        },
      },
    },
    rebounds: {
      line: 12.5, over_odds: -110, under_odds: -110, odds_available: true,
      season_avg: 13.1, home_avg: 13.8, away_avg: 12.4,
      home_games: 18, away_games: 17,
      hit_rate_over: 60, hit_rate_sample: 15,
      confidence: {
        score: 58, tier: 'low',
        factors: {
          hit_rate:  { score: 60, label: 'Hit 9/15 games over line' },
          form:      { score: 70, label: 'Trending flat, form 65/100' },
          home_away: { score: 50, label: 'Away game, avg 12.4 vs line 12.5' },
          matchup:   { score: 48, label: 'Avg matchup difficulty' },
        },
      },
    },
  },
};

function renderPage(id = '3112335') {
  return render(
    <MemoryRouter initialEntries={[`/player/${id}/props`]}>
      <Routes>
        <Route path="/player/:id/props" element={<PropsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PropsPage', () => {
  beforeEach(() => api.props.mockReset());

  it('renders player name after data loads', async () => {
    api.props.mockResolvedValue(MOCK_PROPS_RESPONSE);
    renderPage();
    await waitFor(() => expect(screen.getByText('Nikola Jokic')).toBeInTheDocument());
  });

  it('renders POINTS prop card with line and odds', async () => {
    api.props.mockResolvedValue(MOCK_PROPS_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('28.5')).toBeInTheDocument();
      expect(screen.getByText('-115')).toBeInTheDocument();
    });
  });

  it('renders REBOUNDS prop card', async () => {
    api.props.mockResolvedValue(MOCK_PROPS_RESPONSE);
    renderPage();
    await waitFor(() => expect(screen.getByText('12.5')).toBeInTheDocument());
  });

  it('shows "No live odds" badge when odds_available is false', async () => {
    const noOdds = JSON.parse(JSON.stringify(MOCK_PROPS_RESPONSE));
    noOdds.props.points.odds_available = false;
    noOdds.props.points.line = null;
    api.props.mockResolvedValue(noOdds);
    renderPage();
    await waitFor(() => expect(screen.getByText(/no live odds/i)).toBeInTheDocument());
  });

  it('shows error message when API fails', async () => {
    api.props.mockRejectedValue(new Error('404 Not Found'));
    renderPage();
    await waitFor(() => expect(screen.getByText(/404/i)).toBeInTheDocument());
  });

  it('renders a back link to the player page', async () => {
    api.props.mockResolvedValue(MOCK_PROPS_RESPONSE);
    renderPage();
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /back/i });
      expect(link).toHaveAttribute('href', '/player/3112335');
    });
  });
});
```

### Step 2 — Verify RED
```bash
cd frontend && npm test
```
**Expected failure:**
```
Cannot find module './PropsPage.jsx'
```

### Step 3 — GREEN: Create `frontend/src/pages/PropsPage.jsx`

```jsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import ConfidenceMeter from '../components/ConfidenceMeter.jsx';
import { SkeletonCard, SkeletonLine } from '../components/Skeleton.jsx';

function formatOdds(odds) {
  if (odds == null) return '—';
  return odds > 0 ? `+${odds}` : String(odds);
}

function oddsColor(odds) {
  if (odds == null) return 'text-slate-400';
  return odds > 0 ? 'text-emerald-300' : 'text-white';
}

function HitRateBar({ hitRate, sample }) {
  if (hitRate == null) return <span className="text-slate-500 text-xs">No data</span>;
  const hits = Math.round((hitRate / 100) * sample);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-400">
        <span>Hit rate (last {sample}g)</span>
        <span>{hits}/{sample} ({hitRate}%)</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-violet-500"
          style={{ width: `${hitRate}%` }}
        />
      </div>
    </div>
  );
}

function PropCard({ title, prop }) {
  if (!prop) return null;

  return (
    <div className="glass p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm uppercase tracking-widest text-slate-400">{title}</h3>
        {!prop.odds_available && (
          <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full border border-white/10">
            No live odds
          </span>
        )}
      </div>

      {/* Line + odds */}
      <div className="flex items-baseline gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Line</div>
          <div className="text-3xl font-bold">{prop.line ?? '—'}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Over</div>
          <div className={`text-lg font-semibold ${oddsColor(prop.over_odds)}`}>
            {formatOdds(prop.over_odds)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Under</div>
          <div className={`text-lg font-semibold ${oddsColor(prop.under_odds)}`}>
            {formatOdds(prop.under_odds)}
          </div>
        </div>
      </div>

      {/* Season / Home / Away split */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Season', value: prop.season_avg },
          { label: `Home (${prop.home_games ?? 0}g)`, value: prop.home_avg },
          { label: `Away (${prop.away_games ?? 0}g)`, value: prop.away_avg },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-white/[0.04] border border-white/10 p-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
            <div className="text-lg font-bold mt-0.5">{value ?? '—'}</div>
          </div>
        ))}
      </div>

      {/* Hit rate bar */}
      <HitRateBar hitRate={prop.hit_rate_over} sample={prop.hit_rate_sample} />

      {/* Confidence meter */}
      {prop.confidence && (
        <div className="pt-2 border-t border-white/10">
          <ConfidenceMeter
            score={prop.confidence.score}
            tier={prop.confidence.tier}
            factors={prop.confidence.factors}
          />
        </div>
      )}
    </div>
  );
}

export default function PropsPage() {
  const { id } = useParams();
  const [data, setData]   = useState(null);
  const [err, setErr]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null); setErr(null);
    api.props(id)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, [id]);

  if (err) return (
    <div className="mx-auto max-w-5xl px-6 py-10 text-rose-300">⚠ {err}</div>
  );

  if (!data) return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <SkeletonLine className="w-40" />
      <div className="grid lg:grid-cols-2 gap-5">
        <SkeletonCard lines={6} />
        <SkeletonCard lines={6} />
      </div>
    </div>
  );

  const { player, next_game, props } = data;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      {/* Back link */}
      <Link
        to={`/player/${id}`}
        className="text-sm text-slate-400 hover:text-white inline-flex items-center gap-1.5"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to player
      </Link>

      {/* Header */}
      <div className="glass p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{player.name}</h1>
          <p className="text-slate-400 text-sm mt-0.5">Props & Confidence Analysis</p>
        </div>
        {next_game ? (
          <div className="text-sm text-slate-400">
            Next: <span className="text-white font-medium">{next_game.opponent_name}</span>
            <span className="ml-2 text-slate-500">{next_game.is_home ? 'HOME' : 'AWAY'}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-500">Schedule unavailable</span>
        )}
      </div>

      {/* Prop cards */}
      <div className="grid lg:grid-cols-2 gap-5">
        <PropCard title="Points" prop={props?.points} />
        <PropCard title="Rebounds" prop={props?.rebounds} />
      </div>
    </div>
  );
}
```

### Step 4 — Verify GREEN
```bash
cd frontend && npm test
```
**Expected — all 6 tests pass.**

### Step 5 — REFACTOR
`PropCard` and `HitRateBar` are clean subcomponents. No duplication.

---

## Full Validation
```bash
cd frontend && npm run dev
# Navigate to http://localhost:5173/player/3112335/props
```
Visual checks:
- Two prop cards render side by side (lg) or stacked (sm)
- ConfidenceMeter animates on mount
- "No live odds" badge shows when `ODDS_API_KEY` not set

---

## Error Patterns

| Error | Cause | Fix |
|-------|-------|-----|
| Page shows loading forever | Route not registered in `App.jsx` | Complete PRP-13 |
| `ConfidenceMeter` not found | PRP-10 not complete | Complete PRP-10 first |
| `SkeletonCard` undefined | Wrong import path | Check `../components/Skeleton.jsx` exports |

---

## Acceptance Criteria
- [ ] Renders player name once data loads
- [ ] Points prop card shows line, over/under odds, season/home/away avgs, hit rate bar, `ConfidenceMeter`
- [ ] Rebounds prop card shows same structure
- [ ] "No live odds" badge visible when `odds_available: false`
- [ ] Error state shown on API failure
- [ ] "Back to player" link points to `/player/:id`
- [ ] Loading skeletons shown before data arrives
- [ ] All 6 vitest tests pass
