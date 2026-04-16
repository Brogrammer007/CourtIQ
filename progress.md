# CourtIQ — Progress

_Last updated: 2026-04-16_

Running log of what's been shipped and what's pending. Group by theme, newest
on top within each section.

## ✅ Done

### Deploy + viral OG + mobile sweep (Apr 16)
- `frontend/vercel.json` rewritten: Vite preset, SPA rewrites that exclude file extensions (no more broken asset serving), immutable `Cache-Control` on PNG/SVG/webmanifest/ico/assets, 1h cache on robots/sitemap.
- `backend/railway.json` + `.env.example` refresh — `RATE_LIMIT_MAX` surfaced, dev vs prod grouped, health check path documented.
- `docs/DEPLOY.md` — step-by-step Railway backend + Vercel frontend guide, env var reference (`VITE_API_BASE` build-time + `API_BASE` runtime for edge), domain-wiring checklist, post-deploy smoke tests, cost breakdown (~$15–20/yr).
- **Per-player OG images** (viral lever): `GET /api/player/:id/og.png` renders a 1200×630 PNG card (avatar initials, name/team/position, form trend, PPG/RPG/APG/FG% tiles, model projection banner) via `sharp` from a hand-crafted SVG template — no external fonts, 30 min in-process cache + 24h downstream.
- **Crawler routing**: `frontend/middleware.js` (Vercel Edge) detects bot UAs hitting `/app/player/*` and 302s them to `frontend/api/og-meta.js` (Edge function) which returns minimal HTML with per-player OG/Twitter meta + `<meta refresh>` back to the SPA URL. Humans pass through untouched.
- Mobile polish on Compare / Predictions / PropsPage: `px-4 sm:px-6`, hero headings scale `text-3xl sm:text-4xl`, top-picks header flex-wraps.

### Production hardening (Apr 16)
- Rate limit on `/api/*` — 60 req/min per IP, configurable via `RATE_LIMIT_MAX`, health check stays unlimited. `trust proxy` set for Railway/Vercel edge.
- ErrorBoundary at app + route level with glass fallback, "Try again" reset, dev-only stack message.
- Friendly 404 UI on PlayerPage and PropsPage (distinguishes 404 from generic errors, offers "Back to dashboard" / "Back to player" escape routes).
- Loading + error states on Compare page (dropdown skeleton during the 10+ second paginated player fetch, error surfacing on `api.compare` failure).
- Mobile responsive fix on Recent Games table (hide TO/STL/BLK/FG%/3P%/FT%/MIN below sm/md, keep Date/Opp/PTS/REB/AST core visible, horizontal scroll hint).

### SEO & discoverability (Apr 15–16)
- Full meta tag suite in `index.html`: expanded title + description, keywords, canonical, Open Graph (FB/LinkedIn/iMessage), Twitter `summary_large_image`, JSON-LD `WebApplication` schema.
- `public/robots.txt` — allow all, disallow `/api/`, sitemap link.
- `public/sitemap.xml` — 5 main routes with priority + changefreq.
- Favicon set: PNG 32/180/192/512 generated from `favicon.svg` via sharp, `apple-touch-icon`, `site.webmanifest` for PWA/Android install.

### Analytics & monitoring (Apr 16)
- `@vercel/analytics` wired in `main.jsx` (no-op outside Vercel, activates on deploy).

### UX polish (Apr 16)
- Keyboard shortcut: `/` focuses dashboard search, `Esc` clears & blurs. Visible `⌨ /` kbd hint in the input.

### Product features (Apr 15)
- Recent Games table expanded: Opp (home/away), TO, FT%, 3P% all surfaced.
- Props page route fixed (`/app/player/:id/props` was 404).
- Real Avg PPG (Top 10) on Dashboard — replaced hardcoded 28.7 with computed average over live top-10 stats.
- Form Index floating card positioned so PTS value is fully visible on Hero.

### Infrastructure (Apr 15)
- Fresh `npm install` resolved corrupted `node_modules` that was hanging Vite's esbuild dep-scanner.
- Split Vitest config into `vitest.config.js` (was bleeding through `vite.config.js`).
- `feature/player-prop-analytics` merged to `main` (49 files, props + defensive matchup feature shipped).

## 🟡 Pending (ordered by impact)

### Must-have before launch
1. **Ship to Railway + Vercel** — follow `docs/DEPLOY.md`. Configs are committed; what's left is the actual clicks + setting `VITE_API_BASE`, `API_BASE`, `CORS_ORIGIN`.
2. **Domain** — purchase + wire DNS. Then replace `https://courtiq.app/` in `index.html`, `robots.txt`, `sitemap.xml` with the real domain and redeploy.
3. **Generic `og-image.png` (1200×630)** — fallback card used on landing + non-player routes. Per-player cards already work via `/api/player/:id/og.png`.

### High value, moderate effort
4. **Analytics dashboard hookup** — verify Vercel Analytics events fire after deploy; optionally add custom events (favorite toggle, props view).
5. **Smoke-test OG previews** — paste a player URL into Twitter / iMessage / Slack after deploy, confirm the per-player card renders (tests middleware + edge fn + `/og.png` end-to-end).

### Nice-to-have
6. **Favorites empty state** — current state not verified; confirm it shows helpful CTA when no favorites yet.
7. **Skeleton → data transition** with `AnimatePresence` fade-in for smoother perceived loading.
8. **Error telemetry** — pipe `ErrorBoundary.componentDidCatch` + API errors to Sentry (or just Vercel logs).
9. **Schedule / game-day indicator** — show next game time on PlayerPage header.

### Explicitly skipped (not worth the effort)
- Light/dark toggle — design is dark-first, a light mode would look weak.
- Account system — zustand + localStorage favorites are enough for single-device use.
- PWA offline — live NBA data has no meaningful offline story.

## 🗂 Known follow-ups / tech debt
- `backend/data/espn-roster.json` is gitignored-like (untracked) — confirm it's safe or document cache behavior.
- `.claude/` directory untracked (editor metadata, fine).
- Rate limit is memory-based; if we scale to multi-instance, move to Redis store.
