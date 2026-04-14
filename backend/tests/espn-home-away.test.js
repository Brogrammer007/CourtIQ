import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStat } from '../utils/analytics.js';

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
