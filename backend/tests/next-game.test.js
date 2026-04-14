import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// We mock global fetch before importing the module under test
const futureDate = new Date(Date.now() + 86400 * 1000).toISOString(); // tomorrow
const pastDate   = new Date(Date.now() - 86400 * 1000).toISOString(); // yesterday

function makeMockSchedule(events) {
  return JSON.stringify({ events });
}

function mockFetch(body) {
  return async () => ({ ok: true, json: async () => JSON.parse(body) });
}

describe('getNextGame', () => {
  it('returns the next upcoming game with correct opponent and is_home', async () => {
    global.fetch = mockFetch(makeMockSchedule([
      {
        date: futureDate,
        competitions: [{
          competitors: [
            { homeAway: 'home', team: { id: '7',  displayName: 'Denver Nuggets' } },
            { homeAway: 'away', team: { id: '21', displayName: 'San Antonio Spurs' } },
          ],
        }],
      },
    ]));

    const { getNextGame } = await import('../services/espn.js');
    const result = await getNextGame('7');

    assert.equal(result.opponent_id, 21);
    assert.equal(result.opponent_name, 'San Antonio Spurs');
    assert.equal(result.is_home, true);
    assert.ok(result.date);
  });

  it('skips past games and returns null when no future games exist', async () => {
    global.fetch = mockFetch(makeMockSchedule([
      {
        date: pastDate,
        competitions: [{
          competitors: [
            { homeAway: 'home', team: { id: '7',  displayName: 'Denver Nuggets' } },
            { homeAway: 'away', team: { id: '21', displayName: 'San Antonio Spurs' } },
          ],
        }],
      },
    ]));

    const { getNextGame } = await import('../services/espn.js');
    const result = await getNextGame('7');
    assert.equal(result, null);
  });

  it('returns null when ESPN schedule fetch fails', async () => {
    global.fetch = async () => ({ ok: false, status: 404 });

    const { getNextGame } = await import('../services/espn.js');
    const result = await getNextGame('7');
    assert.equal(result, null);
  });
});
