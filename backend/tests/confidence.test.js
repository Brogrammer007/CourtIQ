import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeConfidence } from '../utils/confidence.js';

// 20 mock games: cycling pts 25–29, alternating home/away
const makeStats = (n = 20) =>
  Array.from({ length: n }, (_, i) => ({
    pts: 25 + (i % 5),     // 25, 26, 27, 28, 29 cycling
    reb: 10 + (i % 4),
    is_home: i % 2 === 0,
  }));

describe('computeConfidence', () => {
  it('returns score between 0 and 100', () => {
    const result = computeConfidence({ stats: makeStats(), statKey: 'pts', line: 27.5, isHome: true });
    assert.ok(result.score >= 0 && result.score <= 100, `score out of range: ${result.score}`);
  });

  it('returns all four factors', () => {
    const result = computeConfidence({ stats: makeStats(), statKey: 'pts', line: 27.5, isHome: true });
    assert.ok('hit_rate'  in result.factors);
    assert.ok('form'      in result.factors);
    assert.ok('home_away' in result.factors);
    assert.ok('matchup'   in result.factors);
  });

  it('returns valid tier string', () => {
    const result = computeConfidence({ stats: makeStats(), statKey: 'pts', line: 27.5, isHome: true });
    assert.ok(['high','medium','low','against'].includes(result.tier));
  });

  it('returns tier: high when score >= 80', () => {
    // Easy line — player always exceeds it
    const highStats = Array.from({ length: 15 }, () => ({ pts: 35, reb: 15, is_home: true }));
    const result = computeConfidence({ stats: highStats, statKey: 'pts', line: 10, isHome: true, opponentId: 7, archetype: 'big' });
    assert.equal(result.tier, 'high');
  });

  it('returns tier: against when score < 40', () => {
    // Impossible line — player never exceeds it
    const lowStats = Array.from({ length: 15 }, () => ({ pts: 5, reb: 2, is_home: false }));
    const result = computeConfidence({ stats: lowStats, statKey: 'pts', line: 50, isHome: false, opponentId: 7, archetype: 'big' });
    assert.equal(result.tier, 'against');
  });

  it('returns neutral result for empty stats — never throws', () => {
    const result = computeConfidence({ stats: [], statKey: 'pts', line: 28.5, isHome: true });
    assert.equal(result.score, 50);
    assert.equal(result.tier, 'low');
  });

  it('handles null line gracefully — hit_rate factor returns score 50', () => {
    const result = computeConfidence({ stats: makeStats(), statKey: 'pts', line: null, isHome: true });
    assert.equal(result.factors.hit_rate.score, 50);
    assert.doesNotThrow(() => result);
  });

  it('handles null isHome gracefully — home_away factor returns score 50', () => {
    const result = computeConfidence({ stats: makeStats(), statKey: 'pts', line: 27.5, isHome: null });
    assert.equal(result.factors.home_away.score, 50);
  });

  it('each factor score is between 0 and 100', () => {
    const result = computeConfidence({ stats: makeStats(), statKey: 'pts', line: 27.5, isHome: true, opponentId: 7, archetype: 'scorer' });
    for (const [key, factor] of Object.entries(result.factors)) {
      assert.ok(factor.score >= 0 && factor.score <= 100, `${key} out of range: ${factor.score}`);
    }
  });
});
