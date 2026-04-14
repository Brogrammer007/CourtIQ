# 🏀 CourtIQ — Where Data Meets the Game

A modern NBA player analytics SaaS platform. Track performance, analyze trends, compare players, and surface smart predictions — all in one polished, real‑time dashboard.

```
CourtIQ/
├── backend/     Node + Express API (balldontlie proxy, caching, fallback mock data)
└── frontend/    Vite + React + Tailwind + Framer Motion + Recharts + Zustand
```

---

## 🚀 Quickstart

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev          # → http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev          # → http://localhost:5173
```

The frontend proxies `/api/*` → `http://localhost:4000` during development (see `vite.config.js`).

---

## 🧩 Backend Endpoints

| Method | Route                     | Description                          |
|--------|---------------------------|--------------------------------------|
| GET    | `/api/health`             | Health probe                         |
| GET    | `/api/players?search=`    | Search / list players                |
| GET    | `/api/player/:id`         | Player profile                       |
| GET    | `/api/player/:id/stats`   | Per-game stats + averages + trends   |
| GET    | `/api/compare?a=&b=`      | Side-by-side comparison              |
| GET    | `/api/top`                | Top / trending players (for landing) |

In-memory TTL cache (60 s by default). If balldontlie is unreachable, the API transparently falls back to `backend/data/mockPlayers.json` so the app never breaks.

---

## 🎨 Design System

- **Background** `#0B0F1A` · **Cards** `#111827`
- **Primary** `#8B5CF6` (violet) · **Secondary** `#22D3EE` (cyan)
- **Font** Inter
- Glassmorphism, 2xl radii, soft shadows, Framer Motion transitions.

The logo lives in `frontend/public/logo.svg` (plus `favicon.svg`) and is rendered as a React component in `src/components/Logo.jsx`.

---

## 🌐 Deployment

### Frontend → Vercel

```bash
cd frontend
vercel --prod
```

Set env var `VITE_API_BASE` to your deployed backend URL (e.g. `https://courtiq-api.onrender.com/api`).

### Backend → Render / Railway

- **Build command:** `npm install`
- **Start command:** `npm start`
- **Env vars:** `PORT`, `BALLDONTLIE_BASE` (optional), `CACHE_TTL_SECONDS` (optional), `CORS_ORIGIN`

A `render.yaml` and `Procfile` are provided in `backend/`.

---

## 🗺️ Routes (frontend)

- `/`                → Landing page
- `/app`             → Dashboard
- `/app/player/:id`  → Player profile
- `/app/favorites`   → Saved players (localStorage)
- `/app/compare`     → Compare two players
- `/app/predictions` → Predictions view

---

## 📦 Data Source

Primary: [balldontlie.io](https://www.balldontlie.io/) free API.
Fallback: local `mockPlayers.json` — app stays fully functional offline.
