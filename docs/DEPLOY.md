# Deploying CourtIQ

Two services:
- **Frontend** → Vercel (React + Vite static build)
- **Backend** → Railway (Node/Express API)

## 1. Backend on Railway

1. Push latest `main` to GitHub.
2. [railway.com](https://railway.com) → **New Project** → **Deploy from GitHub repo** → select `CourtIQ`.
3. Railway detects Node. In **Settings**:
   - **Root Directory**: `backend`
   - **Start Command**: `node server.js` (already in `railway.json`)
   - **Health Check Path**: `/api/health`
4. **Variables** tab — add:
   ```
   PORT=4000
   CACHE_TTL_SECONDS=60
   RATE_LIMIT_MAX=60
   CORS_ORIGIN=https://courtiq.app        # replace with your real frontend domain
   BALLDONTLIE_API_KEY=                   # optional
   ```
5. **Settings → Networking → Generate Domain** to get a public URL, e.g. `courtiq-api.up.railway.app`.
6. Verify: `curl https://<your-railway-domain>/api/health` → should return `{"ok": true, ...}`.

## 2. Frontend on Vercel

1. [vercel.com](https://vercel.com) → **New Project** → **Import** the GitHub repo.
2. In import screen:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite (auto-detected via `vercel.json`)
3. **Environment Variables**:
   ```
   VITE_API_BASE=https://<your-railway-domain>/api
   API_BASE=https://<your-railway-domain>/api
   ```
   `VITE_API_BASE` is baked into the client bundle at build time. `API_BASE`
   is read at runtime by the Edge middleware / `api/og-meta.js` function that
   serves per-player social cards. Set both.
4. Deploy. Vercel will build → `dist/` → serve.

## 3. Wire the domain

1. Buy the domain (Namecheap, Porkbun, Cloudflare Registrar — all fine).
2. In Vercel → **Project Settings → Domains** → add your domain. Vercel shows the DNS records to set at the registrar.
3. Once DNS resolves, update these files with your real domain (search for `courtiq.app`):
   - `frontend/index.html` (canonical, OG, Twitter, JSON-LD)
   - `frontend/public/robots.txt` (Sitemap line)
   - `frontend/public/sitemap.xml` (all `<loc>` tags)
   - Railway env `CORS_ORIGIN`
4. Redeploy both after updating.

## 4. Post-deploy checks

- Open `https://<domain>/` → landing page loads, Vite Analytics should light up after first visit.
- Open `https://<domain>/app` → dashboard shows trending players.
- Open DevTools Network tab, verify API calls go to Railway domain (not localhost).
- Test a share: paste `https://<domain>/` into Twitter/iMessage — should show OG preview once `og-image.png` is added.
- Check `https://<domain>/robots.txt` and `https://<domain>/sitemap.xml` resolve.

## 5. Observability

- Vercel Analytics → Project → Analytics tab → **Enable Web Analytics**.
- Railway → Project → **Metrics** tab shows request counts, memory, CPU.
- Logs: `railway logs` CLI, or Vercel deployment logs page.

## Cost

- Vercel Hobby: free for personal projects, 100 GB bandwidth/mo.
- Railway: ~$5/mo credit on free tier, backend with light traffic fits.
- Domain: $10–15/yr.

Total: ~$15–20/yr for a production-grade deploy.
