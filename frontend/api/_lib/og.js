import sharp from 'sharp';

// Escape for use inside SVG text content / attributes.
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function initials(first, last) {
  return `${(first || '').slice(0, 1)}${(last || '').slice(0, 1)}`.toUpperCase() || '?';
}

/**
 * Build a 1200x630 SVG OG card for a player and rasterize to PNG.
 * No external fonts — uses system-ui stack which renders fine across crawlers.
 */
export async function renderPlayerOG({ player, averages: avgs, trend, prediction }) {
  const name = esc(`${player.first_name ?? ''} ${player.last_name ?? ''}`.trim() || 'Player');
  const team = esc(player.team?.full_name || player.team?.abbreviation || '—');
  const position = esc(player.position || '—');

  const pts = avgs?.pts ?? '—';
  const reb = avgs?.reb ?? '—';
  const ast = avgs?.ast ?? '—';
  const fg  = avgs?.fg_pct != null ? `${(avgs.fg_pct * 100).toFixed(1)}%` : '—';

  const form = trend?.form ?? null;
  const dir  = trend?.direction || null;
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '•';
  const trendColor = dir === 'up' ? '#34D399' : dir === 'down' ? '#FB7185' : '#94A3B8';

  const proj = prediction?.expected_points ?? null;

  const inits = esc(initials(player.first_name, player.last_name));

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B0F1A"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#22D3EE"/>
    </linearGradient>
    <linearGradient id="avatar" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#22D3EE"/>
    </linearGradient>
  </defs>

  <!-- background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1000" cy="120" r="240" fill="#8B5CF6" opacity="0.12"/>
  <circle cx="180"  cy="540" r="200" fill="#22D3EE" opacity="0.08"/>

  <!-- top bar: brand -->
  <g transform="translate(60, 60)">
    <text x="0" y="0" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      font-size="28" font-weight="700" fill="url(#brand)" letter-spacing="4">COURTIQ</text>
    <text x="0" y="30" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      font-size="16" fill="#94A3B8">Where Data Meets the Game</text>
  </g>

  <!-- player card -->
  <g transform="translate(60, 180)">
    <!-- avatar -->
    <rect x="0" y="0" width="140" height="140" rx="28" fill="url(#avatar)"/>
    <text x="70" y="92" text-anchor="middle"
      font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      font-size="56" font-weight="800" fill="#ffffff">${inits}</text>

    <!-- name + team -->
    <text x="170" y="50" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      font-size="56" font-weight="800" fill="#ffffff">${name}</text>
    <text x="170" y="92" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      font-size="22" fill="#CBD5E1">${team} · ${position}</text>
    ${form != null ? `
    <g transform="translate(170, 110)">
      <rect x="0" y="0" width="180" height="36" rx="18" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)"/>
      <text x="16" y="24" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="16" fill="${trendColor}" font-weight="700">${arrow}</text>
      <text x="40" y="24" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="16" fill="#E2E8F0">Form ${form}/100</text>
    </g>` : ''}
  </g>

  <!-- stat tiles -->
  <g transform="translate(60, 380)">
    ${statTile(0,   'PPG', pts)}
    ${statTile(270, 'RPG', reb, '#22D3EE')}
    ${statTile(540, 'APG', ast)}
    ${statTile(810, 'FG%', fg,  '#22D3EE')}
  </g>

  ${proj != null ? `
  <g transform="translate(60, 555)">
    <rect x="0" y="0" width="1080" height="44" rx="22" fill="rgba(139,92,246,0.14)" stroke="rgba(139,92,246,0.35)"/>
    <text x="24" y="28" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      font-size="18" fill="#E9D5FF">MODEL PROJECTION</text>
    <text x="260" y="29" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      font-size="20" font-weight="800" fill="#ffffff">${proj} PTS next game</text>
  </g>` : ''}
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

function statTile(x, label, value, accent = '#ffffff') {
  return `
    <g transform="translate(${x}, 0)">
      <rect x="0" y="0" width="250" height="140" rx="24" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)"/>
      <text x="24" y="36" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="14" fill="#94A3B8" letter-spacing="3">${esc(label)}</text>
      <text x="24" y="104" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="64" font-weight="800" fill="${accent}">${esc(value)}</text>
    </g>`;
}
