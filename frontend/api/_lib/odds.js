const ODDS_BASE = 'https://api.the-odds-api.com/v4';

export function normName(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s*\b(jr|sr|ii|iii|iv)\b\.?\s*/gi, ' ')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

const EMPTY = { line: null, over_odds: null, under_odds: null, odds_available: false };

async function oddsGet(path) {
  const key = process.env.ODDS_API_KEY;
  const res = await fetch(`${ODDS_BASE}${path}&apiKey=${key}`);
  if (!res.ok) throw new Error(`OddsAPI ${res.status}`);
  return res.json();
}

function extractProp(bookmakers, playerNorm, marketKey) {
  for (const bm of bookmakers) {
    for (const market of (bm.markets || [])) {
      if (market.key !== marketKey) continue;
      const outcomes = market.outcomes || [];
      const over  = outcomes.find((o) => o.name === 'Over'  && normName(o.description) === playerNorm);
      const under = outcomes.find((o) => o.name === 'Under' && normName(o.description) === playerNorm);
      if (over && under) {
        return { line: over.point, over_odds: over.price, under_odds: under.price, odds_available: true };
      }
    }
  }
  return null;
}

export async function getPlayerProps(playerName) {
  if (!process.env.ODDS_API_KEY) {
    return { points: { ...EMPTY }, rebounds: { ...EMPTY }, assists: { ...EMPTY } };
  }

  let events;
  try {
    events = await oddsGet('/sports/basketball_nba/events?dateFormat=iso');
  } catch {
    return { points: { ...EMPTY }, rebounds: { ...EMPTY }, assists: { ...EMPTY } };
  }

  const playerNorm = normName(playerName);

  for (const event of (events || [])) {
    let eventData;
    try {
      eventData = await oddsGet(
        `/sports/basketball_nba/events/${event.id}/odds` +
        `?regions=us&markets=player_points,player_rebounds,player_assists&oddsFormat=american`
      );
    } catch {
      continue;
    }

    const bookmakers = eventData.bookmakers || [];
    const pts = extractProp(bookmakers, playerNorm, 'player_points');
    const reb = extractProp(bookmakers, playerNorm, 'player_rebounds');
    const ast = extractProp(bookmakers, playerNorm, 'player_assists');

    if (pts || reb || ast) {
      return {
        points:   pts ?? { ...EMPTY },
        rebounds: reb ?? { ...EMPTY },
        assists:  ast ?? { ...EMPTY },
      };
    }
  }

  return { points: { ...EMPTY }, rebounds: { ...EMPTY }, assists: { ...EMPTY } };
}
