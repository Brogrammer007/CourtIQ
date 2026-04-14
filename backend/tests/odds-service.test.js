import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Helpers
function makeEventsResponse(events) {
  return { ok: true, json: async () => events };
}

function makeOddsResponse(playerName, ptsLine, ptsOverOdds, ptsUnderOdds) {
  return {
    ok: true,
    json: async () => ({
      bookmakers: [{
        key: 'draftkings',
        markets: [
          {
            key: 'player_points',
            outcomes: [
              { name: 'Over',  description: playerName, point: ptsLine, price: ptsOverOdds  },
              { name: 'Under', description: playerName, point: ptsLine, price: ptsUnderOdds },
            ],
          },
          {
            key: 'player_rebounds',
            outcomes: [
              { name: 'Over',  description: playerName, point: 12.5, price: -110 },
              { name: 'Under', description: playerName, point: 12.5, price: -110 },
            ],
          },
        ],
      }],
    }),
  };
}

describe('getPlayerProps', () => {
  let callCount;

  beforeEach(() => {
    callCount = 0;
    process.env.ODDS_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.ODDS_API_KEY;
  });

  it('returns correct line and odds when player found', async () => {
    global.fetch = async (url) => {
      callCount++;
      if (url.includes('/events?')) return makeEventsResponse([{ id: 'evt1' }]);
      return makeOddsResponse('Nikola Jokic', 28.5, -115, -105);
    };

    const { getPlayerProps } = await import('../services/odds.js');
    const result = await getPlayerProps('Nikola Jokić'); // diacritic in input

    assert.equal(result.points.line, 28.5);
    assert.equal(result.points.over_odds, -115);
    assert.equal(result.points.under_odds, -105);
    assert.equal(result.points.odds_available, true);
    assert.equal(result.rebounds.line, 12.5);
    assert.equal(result.rebounds.odds_available, true);
  });

  it('returns odds_available: false when player not in feed', async () => {
    global.fetch = async (url) => {
      if (url.includes('/events?')) return makeEventsResponse([{ id: 'evt1' }]);
      return makeOddsResponse('Someone Else', 20.5, -110, -110);
    };

    const { getPlayerProps } = await import('../services/odds.js');
    const result = await getPlayerProps('Nikola Jokic');

    assert.equal(result.points.odds_available, false);
    assert.equal(result.points.line, null);
  });

  it('returns odds_available: false without making HTTP calls when API key missing', async () => {
    delete process.env.ODDS_API_KEY;
    global.fetch = async () => { callCount++; return { ok: true, json: async () => [] }; };

    const { getPlayerProps } = await import('../services/odds.js');
    const result = await getPlayerProps('Nikola Jokic');

    assert.equal(result.points.odds_available, false);
    assert.equal(callCount, 0); // no HTTP calls made
  });

  it('returns odds_available: false gracefully when API call fails', async () => {
    global.fetch = async () => { throw new Error('network error'); };

    const { getPlayerProps } = await import('../services/odds.js');
    const result = await getPlayerProps('Nikola Jokic');

    assert.equal(result.points.odds_available, false);
    assert.doesNotThrow(() => result);
  });
});
