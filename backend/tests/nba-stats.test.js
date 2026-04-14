import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Minimal dataset matching the real NBA.com shape
const MOCK_DATASET = {
  resultSets: [{
    headers: ['OFF_PLAYER_ID', 'OFF_PLAYER_NAME', 'DEF_PLAYER_ID', 'DEF_PLAYER_NAME',
              'GP', 'PARTIAL_POSS', 'PLAYER_PTS', 'FG_PCT', 'DEF_REB'],
    rowSet: [
      [203999, 'Nikola Jokic',   1631104, 'Victor Wembanyama', 3, 42, 87,  0.461, 8 ],
      [203999, 'Nikola Jokic',   1629029, 'Bam Adebayo',       5, 60, 130, 0.500, 10],
      [1629029, 'Bam Adebayo',   203999,  'Nikola Jokic',      5, 55, 90,  0.430, 12],
    ],
  }],
};

beforeEach(() => {
  // Mock fetch to return our dataset
  global.fetch = async () => ({
    ok: true,
    json: async () => MOCK_DATASET,
  });
});

describe('getMatchup', () => {
  it('returns matchup row when both players have shared data', async () => {
    const { getMatchup } = await import('../services/nbaStats.js');
    const jokic = { first_name: 'Nikola', last_name: 'Jokic' };
    const wemb  = { first_name: 'Victor', last_name: 'Wembanyama' };

    const row = await getMatchup(jokic, wemb);

    assert.equal(row.games_played, 3);
    assert.equal(row.partial_possessions, 42);
    assert.equal(row.fg_pct, 0.461);
    assert.equal(row.def_reb, 8);
  });

  it('returns null when no matchup exists between these players', async () => {
    const { getMatchup } = await import('../services/nbaStats.js');
    const jokic   = { first_name: 'Nikola', last_name: 'Jokic' };
    const unknown = { first_name: 'Unknown', last_name: 'Player' };

    const row = await getMatchup(jokic, unknown);
    assert.equal(row, null);
  });

  it('handles diacritics in player names', async () => {
    const { getMatchup } = await import('../services/nbaStats.js');
    const jokic = { first_name: 'Nikola', last_name: 'Jokić' }; // diacritic
    const wemb  = { first_name: 'Victor', last_name: 'Wembanyama' };

    const row = await getMatchup(jokic, wemb);
    assert.ok(row !== null, 'Should match despite diacritic');
  });

  it('throws MATCHUP_UNAVAILABLE when NBA.com fetch fails', async () => {
    global.fetch = async () => { throw new Error('TLS blocked'); };

    const { getMatchup, resetCache } = await import('../services/nbaStats.js');
    resetCache(); // reset module-level cache so fetch is re-attempted

    const jokic = { first_name: 'Nikola', last_name: 'Jokic' };
    const wemb  = { first_name: 'Victor', last_name: 'Wembanyama' };

    await assert.rejects(
      () => getMatchup(jokic, wemb),
      (err) => err.message === 'MATCHUP_UNAVAILABLE'
    );
  });
});
