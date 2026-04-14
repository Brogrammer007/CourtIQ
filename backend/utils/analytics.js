// Pure helpers: averages, trends, predictions. Works on either balldontlie
// stat rows (nested game.date, fg_pct numeric) or our mock rows (flat).

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeStat(row, ownTeamId) {
  // Opponent resolution: synth rows carry opponent_id; balldontlie rows carry
  // game.home_team_id / game.visitor_team_id — opponent is whichever is not us.
  let opponent_id = row.opponent_id ?? null;
  if (opponent_id == null && row.game && ownTeamId != null) {
    const home = row.game.home_team_id ?? row.game.home_team?.id;
    const away = row.game.visitor_team_id ?? row.game.visitor_team?.id;
    if (home != null && away != null) {
      opponent_id = String(home) === String(ownTeamId) ? away : home;
    }
  }
  return {
    event_id: row.event_id ?? null,
    date: row.game?.date || row.game_date || null,
    opponent_id,
    is_home: row.is_home ?? null,
    pts: num(row.pts),
    reb: num(row.reb),
    ast: num(row.ast),
    stl: num(row.stl),
    blk: num(row.blk),
    fg_pct: num(row.fg_pct),
    fg3_pct: num(row.fg3_pct),
    min: row.min ?? '',
  };
}

export function averages(stats) {
  if (!stats.length) return null;
  const sum = stats.reduce(
    (acc, s) => ({
      pts: acc.pts + s.pts,
      reb: acc.reb + s.reb,
      ast: acc.ast + s.ast,
      stl: acc.stl + s.stl,
      blk: acc.blk + s.blk,
      fg_pct: acc.fg_pct + s.fg_pct,
      fg3_pct: acc.fg3_pct + s.fg3_pct,
    }),
    { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fg_pct: 0, fg3_pct: 0 }
  );
  const n = stats.length;
  return {
    pts: +(sum.pts / n).toFixed(1),
    reb: +(sum.reb / n).toFixed(1),
    ast: +(sum.ast / n).toFixed(1),
    stl: +(sum.stl / n).toFixed(2),
    blk: +(sum.blk / n).toFixed(2),
    fg_pct: +(sum.fg_pct / n).toFixed(3),
    fg3_pct: +(sum.fg3_pct / n).toFixed(3),
  };
}

// Compare last-N average against prior-N average.
export function trend(stats, window = 5) {
  if (stats.length < 2) return { direction: 'flat', delta: 0, form: 50 };
  const recent = stats.slice(0, Math.min(window, stats.length));
  const prior = stats.slice(window, window * 2);
  const r = averages(recent);
  if (!prior.length) return { direction: 'flat', delta: 0, form: clampForm(r.pts * 2) };
  const p = averages(prior);
  const delta = +(r.pts - p.pts).toFixed(1);
  const direction = delta > 1 ? 'up' : delta < -1 ? 'down' : 'flat';
  // "Form score" 0–100 derived from recent pts, ast, reb and shooting.
  const form = clampForm(r.pts * 1.5 + r.ast * 2 + r.reb * 1 + r.fg_pct * 30);
  return { direction, delta, form };
}

function clampForm(x) {
  return Math.max(0, Math.min(100, Math.round(x)));
}

// Predict next-game points using a weighted recent average + small momentum term.
export function predictPoints(stats) {
  if (!stats.length) return null;
  const recent = stats.slice(0, 5);
  const weights = [0.3, 0.25, 0.2, 0.15, 0.1].slice(0, recent.length);
  const wsum = weights.reduce((a, b) => a + b, 0);
  const expected =
    recent.reduce((acc, s, i) => acc + s.pts * (weights[i] ?? 0), 0) / wsum;
  const prior = stats.slice(5, 10);
  const priorAvg = prior.length ? averages(prior).pts : expected;
  const momentum = expected - priorAvg;
  const projected = +(expected + momentum * 0.3).toFixed(1);

  // Over/under 25.5 probability (demo). Derived from distribution around projected.
  const spread = 6; // points
  const line = 25.5;
  const z = (projected - line) / spread;
  const overProb = Math.round(100 * sigmoid(z));
  return {
    expected_points: projected,
    line,
    over_probability: overProb,
    under_probability: 100 - overProb,
  };
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

// ---------------------------------------------------------------------------
// Matchup & archetype logic
// ---------------------------------------------------------------------------

export function classifyPlayer(avg) {
  if (!avg) return 'balanced';
  if (avg.pts >= 22) return 'scorer';
  if (avg.ast >= 6) return 'playmaker';
  if (avg.reb >= 8) return 'big';
  return 'balanced';
}

export function percentDiff(value, baseline) {
  if (!baseline) return 0;
  return +(((value - baseline) / baseline) * 100).toFixed(1);
}

export function matchupLabel(diffPercent) {
  if (diffPercent >= 10) return { label: 'Strong matchup', emoji: '🔥', tone: 'up' };
  if (diffPercent <= -10) return { label: 'Weak matchup', emoji: '🧊', tone: 'down' };
  return { label: 'Neutral', emoji: '⚖️', tone: 'flat' };
}

// Given a team defensive profile (multipliers), surface the archetype the
// team is weakest against with a human-readable insight.
export function teamWeaknessInsight(profile) {
  const entries = [
    { key: 'vs_scorer', label: 'high-scoring players', mult: profile.vs_scorer },
    { key: 'vs_playmaker', label: 'playmakers', mult: profile.vs_playmaker },
    { key: 'vs_big', label: 'big men', mult: profile.vs_big },
  ];
  const weakest = entries.reduce((a, b) => (b.mult > a.mult ? b : a));
  const strongest = entries.reduce((a, b) => (b.mult < a.mult ? b : a));
  const asDelta = (m) => +((m - 1) * 100).toFixed(1);
  return {
    allowed_vs: entries.map((e) => ({
      archetype: e.key.replace('vs_', ''),
      label: e.label,
      multiplier: e.mult,
      delta_percent: asDelta(e.mult),
    })),
    weakest_against: {
      archetype: weakest.key.replace('vs_', ''),
      label: weakest.label,
      delta_percent: asDelta(weakest.mult),
    },
    strongest_against: {
      archetype: strongest.key.replace('vs_', ''),
      label: strongest.label,
      delta_percent: asDelta(strongest.mult),
    },
    narrative:
      asDelta(weakest.mult) > 5
        ? `Opposing team struggles against ${weakest.label} (+${asDelta(weakest.mult)}% points allowed)`
        : asDelta(strongest.mult) < -5
          ? `Opposing team defends ${strongest.label} well (${asDelta(strongest.mult)}% below league average)`
          : 'Opposing team defends all archetypes near league average',
  };
}

// Combined "smart" insight blending player-vs-team deltas with team weakness.
export function combinedInsight({ playerName, vsTeamAvg, seasonAvg, diffPct, label, archetype, weakness }) {
  const lines = [];
  if (vsTeamAvg && seasonAvg) {
    const sign = diffPct >= 0 ? '+' : '';
    lines.push(
      `${playerName} averages ${vsTeamAvg.pts} PPG vs this team (${sign}${diffPct}% vs season average).`
    );
  }
  const archLabel = {
    scorer: 'high-scoring players',
    playmaker: 'playmakers',
    big: 'big men',
    balanced: 'balanced scorers',
  }[archetype] || 'balanced scorers';
  if (weakness) {
    const match = weakness.allowed_vs.find((w) => w.archetype === archetype);
    if (match && match.delta_percent > 5) {
      lines.push(`Opponent allows +${match.delta_percent}% more to ${archLabel} — favorable matchup signal.`);
    } else if (match && match.delta_percent < -5) {
      lines.push(`Opponent holds ${archLabel} to ${match.delta_percent}% below league average.`);
    }
  }
  lines.push(`${label.emoji} ${label.label} expected.`);
  return lines;
}
