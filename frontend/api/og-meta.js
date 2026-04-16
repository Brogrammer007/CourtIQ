// Vercel serverless function — serves a minimal HTML page with per-player
// OG/Twitter meta tags for social-media crawlers (Twitter, Facebook, Slack,
// iMessage, LinkedIn, Discord). Humans never hit this: middleware.js only
// routes known bot UAs here.

export const config = { runtime: 'edge' };

// API_BASE is set as a Vercel environment variable (NOT the Vite one —
// that's baked at build time and not available at runtime in edge).
// For same-origin Vercel deployments (backend migrated to api/ functions),
// set API_BASE to your Vercel domain, e.g. https://courtiq.vercel.app/api
// The og.png route is served from the same deployment at /api/player/:id/og.png
const API_BASE = process.env.API_BASE || process.env.VITE_API_BASE || '';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response('Missing id', { status: 400 });

  const pageUrl = `${url.origin}/app/player/${encodeURIComponent(id)}`;
  const imageUrl = `${API_BASE}/player/${encodeURIComponent(id)}/og.png`;

  // Best-effort name lookup for title/description. If it fails we still ship
  // a generic card rather than a 500 — crawlers re-fetch rarely.
  let title = 'CourtIQ — NBA Player Analytics';
  let desc = 'Where Data Meets the Game. Real-time NBA player stats, trends & predictions.';
  try {
    const res = await fetch(`${API_BASE}/player/${encodeURIComponent(id)}`, {
      headers: { 'User-Agent': 'CourtIQ-OG/1.0' },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const { data } = await res.json();
      if (data) {
        const name = `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim();
        title = `${name} — CourtIQ`;
        desc = `${name} · ${data.team?.full_name ?? '—'} · ${data.position ?? '—'}. Stats, trends & next-game projection.`;
      }
    }
  } catch { /* fallthrough to generic meta */ }

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${esc(pageUrl)}" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="CourtIQ" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${esc(pageUrl)}" />
  <meta property="og:image" content="${esc(imageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="${esc(imageUrl)}" />

  <meta http-equiv="refresh" content="0;url=${esc(pageUrl)}" />
</head>
<body>
  <p>Redirecting to <a href="${esc(pageUrl)}">${esc(title)}</a>…</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
