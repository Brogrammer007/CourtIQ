// Vercel Edge Middleware — routes social-media crawlers hitting player pages
// to the /api/og-meta function so they see per-player OG tags. Humans (and
// bots we don't recognize) pass through to the normal SPA.

export const config = {
  matcher: '/app/player/:path*',
};

const BOT_UA = /bot|crawler|spider|facebookexternalhit|twitterbot|slackbot|discordbot|linkedinbot|whatsapp|telegrambot|preview|embed/i;

export default function middleware(request) {
  const ua = request.headers.get('user-agent') || '';
  if (!BOT_UA.test(ua)) return; // humans → SPA as normal

  const url = new URL(request.url);
  // /app/player/:id or /app/player/:id/props → extract id
  const match = url.pathname.match(/^\/app\/player\/([^/]+)/);
  if (!match) return;

  const rewriteUrl = new URL('/api/og-meta', url.origin);
  rewriteUrl.searchParams.set('id', match[1]);
  return Response.redirect(rewriteUrl, 302);
}
