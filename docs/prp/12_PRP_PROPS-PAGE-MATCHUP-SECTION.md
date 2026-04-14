# PRP-12 — PropsPage: Defensive Matchup Section

## Goal
Add a "Defensive Matchup" section to the bottom of `PropsPage.jsx` — a player search input that lets the user pick a defender, triggers `api.defensiveMatchup()`, and displays possession-level stats with a verdict badge.

## Why
The matchup section is the most differentiated feature of the page. It gives users the "Jokic when guarded by Wembanyama" breakdown that no standard stats page provides. It is built as an additive section to keep PRP-11 stable.

---

## Codebase Context

| File | Relevant detail |
|------|-----------------|
| `frontend/src/pages/PropsPage.jsx` | This section is appended after the prop cards grid. Import `api.defensiveMatchup`. |
| `frontend/src/pages/Dashboard.jsx` | Reference for player search UX — search input + debounce + results list pattern. Mirror the input style. |
| `frontend/src/lib/api.js` | `api.search(q)` for defender search. `api.defensiveMatchup(offId, defId)` for matchup data. |

**Section layout:**
```
┌──────────────────────────────────────────────────────┐
│  DEFENSIVE MATCHUP                                    │
│  Search defender: [________________] [Analyze]        │
│                                                       │
│  [Results state: idle / loading / data / error]       │
└──────────────────────────────────────────────────────┘
```

**States:**
- `idle` — "Search for a defender to analyze the matchup"
- `loading` — spinner or `SkeletonLine`
- `data` — matchup stats + verdict
- `no_data` — "No matchup data found between these players this season."
- `error` — "Matchup data temporarily unavailable."

**Verdict → badge:**
| Tone | Badge |
|------|-------|
| `up` | `🔥 Favorable matchup` (emerald) |
| `down` | `🧊 Tough matchup` (cyan) |
| `flat` | `⚖️ Neutral matchup` (slate) |

**Gotcha — search debounce:** Use 300ms debounce on the search input to avoid flooding `api.search`. A simple `setTimeout`/`clearTimeout` in `useEffect` is sufficient.

**Gotcha — `defensiveMatchup` is triggered on button click**, not on search. User picks a player from the dropdown, then clicks "Analyze".

**Gotcha — `pts_per_possession` may be null** when `partial_possessions === 0`. Display "—".

**Gotcha — `vs_season_avg.pts_diff_pct` can be negative.** Show `+5.2%` or `-12.4%` with appropriate color.

---

## Dependencies
- **PRP-11** complete — `PropsPage.jsx` must already exist (this PRP extends it)
- **PRP-09** — `api.defensiveMatchup` must exist

---

## Files to Modify

| File | Change type |
|------|-------------|
| `frontend/src/pages/PropsPage.jsx` | Additive — new `MatchupSection` component + import + render at bottom |
| `frontend/src/pages/PropsPage.test.jsx` | Additive — new `describe` block for matchup section |

---

## TDD Cycle

### Step 1 — RED: Add tests to `frontend/src/pages/PropsPage.test.jsx`

Append this `describe` block to the existing test file. Also add `api.search` and `api.defensiveMatchup` to the mock at the top:

```js
// Update the vi.mock at top of PropsPage.test.jsx:
vi.mock('../lib/api.js', () => ({
  api: {
    props:            vi.fn(),
    search:           vi.fn(),
    defensiveMatchup: vi.fn(),
  },
}));
```

Then append the new describe block:
```jsx
import { fireEvent } from '@testing-library/react';

describe('PropsPage — matchup section', () => {
  beforeEach(() => {
    api.props.mockResolvedValue(MOCK_PROPS_RESPONSE);
    api.search.mockReset();
    api.defensiveMatchup.mockReset();
  });

  it('renders the defensive matchup section heading', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Nikola Jokic')).toBeInTheDocument());
    expect(screen.getByText(/defensive matchup/i)).toBeInTheDocument();
  });

  it('shows search results when typing a defender name', async () => {
    api.search.mockResolvedValue({
      data: [{ id: 1631104, first_name: 'Victor', last_name: 'Wembanyama', team: { full_name: 'Spurs' } }],
    });

    renderPage();
    await waitFor(() => screen.getByText('Nikola Jokic'));

    const input = screen.getByPlaceholderText(/search defender/i);
    fireEvent.change(input, { target: { value: 'Wemb' } });

    await waitFor(() =>
      expect(screen.getByText('Victor Wembanyama')).toBeInTheDocument()
    );
  });

  it('shows matchup data when Analyze is clicked', async () => {
    api.search.mockResolvedValue({
      data: [{ id: 1631104, first_name: 'Victor', last_name: 'Wembanyama', team: { full_name: 'Spurs' } }],
    });
    api.defensiveMatchup.mockResolvedValue({
      offender: { id: 3112335, name: 'Nikola Jokic' },
      defender: { id: 1631104, name: 'Victor Wembanyama' },
      matchup_data: {
        games_played: 3, partial_possessions: 42,
        pts_per_possession: 0.87, fg_pct_allowed: 0.461,
        def_reb_in_matchup: 8,
        sample_note: '42 possessions across 3 games',
      },
      vs_season_avg: { pts_diff_pct: -12.4, fg_pct_diff_pct: -8.7 },
      verdict: { label: 'Tough matchup', tone: 'down', emoji: '🧊' },
    });

    renderPage();
    await waitFor(() => screen.getByText('Nikola Jokic'));

    const input = screen.getByPlaceholderText(/search defender/i);
    fireEvent.change(input, { target: { value: 'Wemb' } });
    await waitFor(() => screen.getByText('Victor Wembanyama'));

    fireEvent.click(screen.getByText('Victor Wembanyama'));
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));

    await waitFor(() => expect(screen.getByText(/tough matchup/i)).toBeInTheDocument());
    expect(screen.getByText('42 possessions across 3 games')).toBeInTheDocument();
  });
});
```

### Step 2 — Verify RED
```bash
cd frontend && npm test
```
**Expected failure:** Tests that reference the matchup section find no such elements.

### Step 3 — GREEN: Add `MatchupSection` to `PropsPage.jsx`

Add the following component definition before `export default function PropsPage`:

```jsx
function MatchupSection({ offenderId }) {
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [matchup,     setMatchup]     = useState(null);
  const [status,      setStatus]      = useState('idle'); // idle|searching|loading|data|no_data|error

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setStatus('searching');
    const timer = setTimeout(() => {
      api.search(query)
        .then((r) => { setResults(r.data || []); setStatus('idle'); })
        .catch(() => { setResults([]); setStatus('idle'); });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function handleAnalyze() {
    if (!selected) return;
    setStatus('loading');
    setMatchup(null);
    api.defensiveMatchup(offenderId, selected.id)
      .then((d) => { setMatchup(d); setStatus('data'); })
      .catch((e) => {
        setStatus(e.message.includes('503') || e.message.includes('unavailable') ? 'error' : 'no_data');
      });
  }

  const diffColor = (pct) => {
    if (pct == null) return 'text-slate-400';
    return pct >= 0 ? 'text-rose-300' : 'text-emerald-300'; // negative = defender wins
  };

  return (
    <div className="glass p-5 space-y-5">
      <h3 className="font-semibold text-sm uppercase tracking-widest text-slate-400">
        Defensive Matchup
      </h3>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search defender..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); setMatchup(null); }}
            className="w-full rounded-xl bg-white/[0.06] border border-white/10 px-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500/50"
          />
          {/* Dropdown */}
          {results.length > 0 && !selected && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#111827] border border-white/10 rounded-xl overflow-hidden z-10 max-h-48 overflow-y-auto">
              {results.slice(0, 8).map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelected(p); setQuery(`${p.first_name} ${p.last_name}`); setResults([]); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/[0.08] transition-colors"
                >
                  {p.first_name} {p.last_name}
                  <span className="ml-2 text-slate-500 text-xs">{p.team?.full_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleAnalyze}
          disabled={!selected || status === 'loading'}
          className="btn-ghost disabled:opacity-40"
        >
          Analyze
        </button>
      </div>

      {/* Result states */}
      {status === 'idle' && !matchup && (
        <p className="text-sm text-slate-500">Search for a defender to analyze the matchup.</p>
      )}

      {status === 'loading' && <div className="space-y-2"><SkeletonLine /><SkeletonLine /></div>}

      {status === 'no_data' && (
        <p className="text-sm text-slate-400">No matchup data found between these players this season.</p>
      )}

      {status === 'error' && (
        <p className="text-sm text-rose-300">Matchup data temporarily unavailable.</p>
      )}

      {status === 'data' && matchup && (
        <div className="space-y-4">
          {/* Verdict badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${
            matchup.verdict.tone === 'down'
              ? 'bg-cyan-400/10 border-cyan-400/30 text-cyan-300'
              : matchup.verdict.tone === 'up'
              ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-300'
              : 'bg-slate-700 border-white/10 text-slate-300'
          }`}>
            {matchup.verdict.emoji} {matchup.verdict.label}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Possessions', value: matchup.matchup_data.partial_possessions },
              { label: 'PTS/Poss',    value: matchup.matchup_data.pts_per_possession ?? '—' },
              { label: 'FG% Allowed', value: matchup.matchup_data.fg_pct_allowed != null
                  ? `${(matchup.matchup_data.fg_pct_allowed * 100).toFixed(1)}%` : '—' },
              { label: 'DEF REB',     value: matchup.matchup_data.def_reb_in_matchup ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-white/[0.04] border border-white/10 p-3 text-center">
                <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
                <div className="text-lg font-bold mt-1">{value}</div>
              </div>
            ))}
          </div>

          {/* vs season avg */}
          <div className="text-xs text-slate-400 space-x-4">
            {matchup.vs_season_avg.pts_diff_pct != null && (
              <span>
                PTS vs season avg:{' '}
                <span className={diffColor(matchup.vs_season_avg.pts_diff_pct)}>
                  {matchup.vs_season_avg.pts_diff_pct > 0 ? '+' : ''}{matchup.vs_season_avg.pts_diff_pct}%
                </span>
              </span>
            )}
            {matchup.vs_season_avg.fg_pct_diff_pct != null && (
              <span>
                FG% vs season avg:{' '}
                <span className={diffColor(matchup.vs_season_avg.fg_pct_diff_pct)}>
                  {matchup.vs_season_avg.fg_pct_diff_pct > 0 ? '+' : ''}{matchup.vs_season_avg.fg_pct_diff_pct}%
                </span>
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600">{matchup.matchup_data.sample_note}</p>
        </div>
      )}
    </div>
  );
}
```

Then at the bottom of `PropsPage`'s return JSX, after the prop cards grid:
```jsx
{/* Defensive Matchup */}
<MatchupSection offenderId={id} />
```

### Step 4 — Verify GREEN
```bash
cd frontend && npm test
```
**Expected — all 9 tests pass (6 from PRP-11 + 3 new).**

### Step 5 — REFACTOR
`MatchupSection` is self-contained. Could be moved to `components/MatchupSection.jsx` — defer until it grows larger.

---

## Full Validation
```bash
cd frontend && npm run dev
# Navigate to http://localhost:5173/player/3112335/props
# Type "Wembanyama" in search, select, click Analyze
```
Visual checks:
- Dropdown shows player results while typing
- Selecting a player locks in the name
- "Analyze" triggers loading state
- Stats grid and verdict badge render on success
- "Tough matchup" badge is cyan; "Favorable" is emerald

---

## Error Patterns

| Error | Cause | Fix |
|-------|-------|-----|
| Dropdown doesn't appear | `api.search` not mocked or returns wrong shape | Confirm `r.data` not `r.players` |
| "Analyze" button stays disabled | `selected` state never set | Check `fireEvent.click` on dropdown item sets `selected` |
| `matchup.verdict` undefined | Backend returned unexpected shape | Ensure PRP-08 complete and returns `verdict` key |

---

## Acceptance Criteria
- [ ] "Defensive Matchup" heading renders on `PropsPage`
- [ ] Typing in search input triggers `api.search` after 300ms debounce
- [ ] Selecting a player from dropdown populates the input and enables "Analyze"
- [ ] Clicking "Analyze" calls `api.defensiveMatchup(offenderId, defenderId)`
- [ ] Matchup stats grid and verdict badge render on success
- [ ] "No matchup data" message shown on 404 response
- [ ] "Temporarily unavailable" message shown on 503 response
- [ ] All 9 tests pass (6 from PRP-11 + 3 new)
