import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStat, homeAwaySplit } from '../utils/analytics.js';

describe('normalizeStat — is_home field', () => {
  it('passes is_home: true through when row has is_home: true', () => {
    const row = {
      event_id: '1', game_date: '2024-11-01', opponent_id: 5,
      is_home: true, pts: 30, reb: 10, ast: 8,
      stl: 1, blk: 1, fg_pct: 0.55, fg3_pct: 0.40, min: '35',
    };
    const result = normalizeStat(row, null);
    assert.equal(result.is_home, true);
  });

  it('passes is_home: false through when row has is_home: false', () => {
    const row = {
      event_id: '2', game_date: '2024-11-02', opponent_id: 7,
      is_home: false, pts: 22, reb: 8, ast: 5,
      stl: 0, blk: 2, fg_pct: 0.48, fg3_pct: 0.35, min: '32',
    };
    const result = normalizeStat(row, null);
    assert.equal(result.is_home, false);
  });

  it('defaults is_home to null when field is absent', () => {
    const row = {
      event_id: '3', game_date: '2024-11-03', opponent_id: 9,
      pts: 18, reb: 6, ast: 3,
      stl: 1, blk: 0, fg_pct: 0.44, fg3_pct: 0.33, min: '28',
    };
    const result = normalizeStat(row, null);
    assert.equal(result.is_home, null);
  });
});

describe('homeAwaySplit', () => {
  const stats = [
    { is_home: true,  pts: 30, reb: 14 },
    { is_home: true,  pts: 26, reb: 12 },
    { is_home: false, pts: 24, reb: 10 },
    { is_home: false, pts: 28, reb: 13 },
    { is_home: null,  pts: 20, reb: 8  },
  ];

  it('calculates correct home average for pts', () => {
    const split = homeAwaySplit(stats, 'pts');
    assert.equal(split.home_avg, 28.0);
  });

  it('calculates correct away average for pts', () => {
    const split = homeAwaySplit(stats, 'pts');
    assert.equal(split.away_avg, 26.0);
  });

  it('counts home and away games correctly', () => {
    const split = homeAwaySplit(stats, 'pts');
    assert.equal(split.home_games, 2);
    assert.equal(split.away_games, 2);
  });

  it('excludes null is_home rows from both buckets', () => {
    const split = homeAwaySplit(stats, 'pts');
    // 5 rows total, 1 null — only 4 should count
    assert.equal(split.home_games + split.away_games, 4);
  });

  it('works for reb stat key', () => {
    const split = homeAwaySplit(stats, 'reb');
    assert.equal(split.home_avg, 13.0);
    assert.equal(split.away_avg, 11.5);
  });

  it('returns null avg and 0 count when bucket is empty', () => {
    const homeOnly = [
      { is_home: true, pts: 25, reb: 10 },
      { is_home: true, pts: 27, reb: 12 },
    ];
    const split = homeAwaySplit(homeOnly, 'pts');
    assert.equal(split.away_avg, null);
    assert.equal(split.away_games, 0);
  });

  it('returns nulls for both when all rows have is_home: null', () => {
    const noContext = [
      { is_home: null, pts: 25, reb: 10 },
    ];
    const split = homeAwaySplit(noContext, 'pts');
    assert.equal(split.home_avg, null);
    assert.equal(split.away_avg, null);
  });
});
