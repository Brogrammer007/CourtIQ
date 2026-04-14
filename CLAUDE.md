# CourtIQ — Claude Instructions

## Project Overview

CourtIQ is a production-ready NBA Player Analytics SaaS built with React + Vite (frontend) and Node + Express (backend). It provides real-time player stats, predictions, matchup analytics, and team comparisons powered by the ESPN public API.

## Architecture

```
CourtIQ/
├── frontend/          # React + Vite + Tailwind + Framer Motion + Recharts
│   └── src/
│       ├── components/    # Reusable UI components
│       ├── pages/         # Route-level pages
│       ├── sections/      # Landing page sections
│       ├── store/         # Zustand global state (favorites)
│       └── lib/api.js     # All API calls — single source of truth
└── backend/           # Node + Express REST API
    ├── routes/players.js      # All API endpoints
    ├── services/
    │   ├── espn.js            # ESPN public API integration
    │   └── balldontlie.js     # Data orchestration + fallback chain
    └── utils/
        ├── analytics.js       # Stats calculations (averages, trend, prediction)
        └── cache.js           # In-memory TTL cache
```

## Running Locally

```bash
# Backend (port 4000)
cd backend && node server.js

# Frontend (port 5173)
cd frontend && npm run dev
```

Both servers must be running. Frontend proxies `/api/*` to backend via Vite config.

## Data Layer

**Fallback chain (in order):**
1. **balldontlie API** — only if `BALLDONTLIE_API_KEY` env var is set
2. **ESPN public API** — no auth required, covers all 538 active NBA players
3. **Nothing** — returns 404 with a clear error message. No mock/synth data.

**No fake data policy:** If real stats are unavailable, the API returns `404 { error: "No stats available for this player." }`. Mock and synthetic data were intentionally removed.

**ESPN gamelog cutoff:** Only games from `2024-01-01` onwards are shown (current + last season).

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/players?search=&cursor=&per_page=` | Search players with cursor pagination |
| `GET` | `/api/top` | Top 10 trending players |
| `GET` | `/api/player/:id` | Player profile |
| `GET` | `/api/player/:id/stats` | Stats + averages + trend + prediction |
| `GET` | `/api/player/:id/vs-team/:teamId` | Player performance vs specific team |
| `GET` | `/api/team/:id/weakness` | Team defensive profile by archetype |
| `GET` | `/api/teams` | All 30 NBA teams |
| `GET` | `/api/compare?a=&b=` | Head-to-head player comparison |

## Frontend API Client

All backend calls go through `frontend/src/lib/api.js`. Always add new methods there — never call `fetch` directly in components.

## Key Design Decisions

- **ESPN IDs** — All active players use ESPN athlete IDs (e.g., Jokić = `3112335`). Legacy IDs from old mock data are resolved by name lookup against the ESPN roster.
- **Cursor pagination** — Player search uses cursor-based pagination, not page numbers.
- **In-memory cache** — Backend caches all responses with a configurable TTL (`CACHE_TTL_SECONDS`, default 60s). Teams are cached for 300s.
- **Seeded team defensive profile** — `teamDefensiveProfile(teamId)` uses a deterministic PRNG to generate consistent defensive multipliers per team for matchup analytics. This is math-only, no fake player stats.
- **Player archetype classification** — scorer (PPG ≥ 22), playmaker (APG ≥ 6), big (RPG ≥ 8), balanced (default).

## Design System

- **Colors:** `#0B0F1A` bg, `#111827` cards, `#8B5CF6` primary (purple), `#22D3EE` secondary (cyan)
- **Font:** Inter
- **Style:** Glassmorphism — use `.glass` and `.glass-hover` utility classes
- **Animations:** Framer Motion for all transitions. Use `AnimatePresence` for mount/unmount.
- **Charts:** Recharts only. Keep chart styles consistent with existing gradient strokes.

## Coding Rules

- **No mock/synth data** — never reintroduce fake stats as fallback.
- **No new dependencies** without a strong reason — the stack is already complete.
- **Don't add error handling for impossible scenarios** — trust ESPN API shape, validate only at boundaries.
- **Reuse existing components** — `SkeletonCard`, `StatTile`, `DiffBadge` etc. before creating new ones.
- **Keep ESPN fetch calls in `espn.js`** — don't scatter `fetch('site.api.espn.com/...')` calls into routes.

## Git Workflow

Every change must follow this flow:

```bash
git checkout -b feature/<short-description>
git add <relevant files>
git commit -m "feat: description of what was done"
git push -u origin <branch-name>
```

Remote: `https://github.com/Brogrammer007/CourtIQ`

Commit prefixes: `feat:` `fix:` `refactor:` `chore:`
