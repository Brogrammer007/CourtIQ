import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import ConfidenceMeter from '../components/ConfidenceMeter.jsx';
import { SkeletonCard, SkeletonLine } from '../components/Skeleton.jsx';
import Seo from '../components/Seo.jsx';

// American odds (+150 / -110) → European decimal odds (2.50 / 1.91)
function americanToDecimal(odds) {
  if (odds == null) return null;
  if (odds > 0)  return 1 + odds / 100;
  if (odds < 0)  return 1 + 100 / Math.abs(odds);
  return null;
}

function formatOdds(odds) {
  const d = americanToDecimal(odds);
  return d == null ? '—' : d.toFixed(2);
}

// Highlight value bets — anything above 2.00 is "plus money" in decimal.
function oddsColor(odds) {
  const d = americanToDecimal(odds);
  if (d == null) return 'text-slate-400';
  return d >= 2 ? 'text-emerald-300' : 'text-white';
}

function HitRateBar({ hitRate, sample, line }) {
  if (hitRate == null) return <span className="text-slate-500 text-xs">No data</span>;
  const hits = Math.round((hitRate / 100) * sample);
  const tooltip = `Hit rate: how often this player exceeded the ${line != null ? line + ' line' : 'projected line'} in the last ${sample} games. ${hits} out of ${sample} games went OVER.`;
  return (
    <div className="space-y-1 group/hr relative">
      <div className="flex justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1 cursor-help" title={tooltip}>
          Hit rate (last {sample}g)
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01" strokeLinecap="round"/>
          </svg>
        </span>
        <span>{hits}/{sample} ({hitRate}%)</span>
      </div>
      {/* Hover tooltip */}
      <div className="absolute bottom-full left-0 mb-2 hidden group-hover/hr:block z-20 w-64 rounded-xl bg-[#0B0F1A] border border-white/10 p-3 text-xs text-slate-300 shadow-xl pointer-events-none">
        {tooltip}
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-violet-500"
          style={{ width: `${hitRate}%` }}
        />
      </div>
    </div>
  );
}

function PropCard({ title, prop }) {
  if (!prop) return null;

  return (
    <div className="glass p-4 sm:p-5 space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm uppercase tracking-widest text-slate-400">{title}</h3>
        {!prop.odds_available && (
          <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full border border-white/10">
            Projected line
          </span>
        )}
      </div>

      {/* Line + odds */}
      <div className="grid grid-cols-3 gap-3 items-end">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Line</div>
          <div className="text-2xl sm:text-3xl font-bold tabular-nums">{prop.line ?? '—'}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Over</div>
          <div className={`text-base sm:text-lg font-semibold tabular-nums ${oddsColor(prop.over_odds)}`}>
            {formatOdds(prop.over_odds)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Under</div>
          <div className={`text-base sm:text-lg font-semibold tabular-nums ${oddsColor(prop.under_odds)}`}>
            {formatOdds(prop.under_odds)}
          </div>
        </div>
      </div>

      {/* Season / Home / Away split */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Season', value: prop.season_avg },
          { label: `Home (${prop.home_games ?? 0}g)`, value: prop.home_avg },
          { label: `Away (${prop.away_games ?? 0}g)`, value: prop.away_avg },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-white/[0.04] border border-white/10 p-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
            <div className="text-lg font-bold mt-0.5">{value ?? '—'}</div>
          </div>
        ))}
      </div>

      {/* Hit rate bar */}
      <HitRateBar hitRate={prop.hit_rate_over} sample={prop.hit_rate_sample} line={prop.line} />

      {/* Confidence meter */}
      {prop.confidence && (
        <div className="pt-2 border-t border-white/10">
          <ConfidenceMeter
            score={prop.confidence.score}
            tier={prop.confidence.tier}
            factors={prop.confidence.factors}
          />
        </div>
      )}
    </div>
  );
}

// Group positions so PG matches PG+SG+G, SF matches SF+PF+F, C matches C
function samePositionGroup(posA, posB) {
  if (!posA || !posB) return true; // unknown — show all
  const guards   = ['PG', 'SG', 'G'];
  const forwards = ['SF', 'PF', 'F'];
  const centers  = ['C'];
  const group = (p) =>
    guards.includes(p)   ? 'G' :
    forwards.includes(p) ? 'F' :
    centers.includes(p)  ? 'C' : null;
  const ga = group(posA.toUpperCase());
  const gb = group(posB.toUpperCase());
  if (!ga || !gb) return true;
  return ga === gb;
}

function MatchupSection({ offenderId, playerPosition }) {
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState([]);
  const [selected, setSelected] = useState(null);
  const [matchup,  setMatchup]  = useState(null);
  const [status,   setStatus]   = useState('idle'); // idle|searching|loading|data|no_data|error

  // Debounced search — filter by same position group
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setStatus('searching');
    const timer = setTimeout(() => {
      api.search(query)
        .then((r) => {
          const all = r.data || [];
          const filtered = playerPosition
            ? all.filter((p) => samePositionGroup(playerPosition, p.position))
            : all;
          setResults(filtered);
          setStatus('idle');
        })
        .catch(() => { setResults([]); setStatus('idle'); });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, playerPosition]);

  function handleAnalyze() {
    if (!selected) return;
    setStatus('loading');
    setMatchup(null);
    api.defensiveMatchup(offenderId, selected.id)
      .then((d) => { setMatchup(d); setStatus('data'); })
      .catch((e) => {
        setStatus(e.message.includes('503') || e.message.includes('unavailable') ? 'error' : 'no_data');
      });
  }

  const diffColor = (pct) => {
    if (pct == null) return 'text-slate-400';
    return pct >= 0 ? 'text-rose-300' : 'text-emerald-300';
  };

  return (
    <div className="glass p-4 sm:p-5 space-y-4 sm:space-y-5">
      <div className="flex items-center gap-3">
        <h3 className="font-semibold text-sm uppercase tracking-widest text-slate-400">
          Defensive Matchup
        </h3>
        {playerPosition && (
          <span className="text-[10px] bg-violet-500/10 border border-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">
            {playerPosition} defenders
          </span>
        )}
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search defender..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); setMatchup(null); }}
            className="w-full rounded-xl bg-white/[0.06] border border-white/10 px-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500/50"
          />
          {/* Dropdown */}
          {results.length > 0 && !selected && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#111827] border border-white/10 rounded-xl overflow-hidden z-10 max-h-48 overflow-y-auto">
              {results.slice(0, 8).map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelected(p); setQuery(`${p.first_name} ${p.last_name}`); setResults([]); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/[0.08] transition-colors"
                >
                  {p.first_name} {p.last_name}
                  <span className="ml-2 text-slate-500 text-xs">{p.team?.full_name}</span>
                  {p.position && <span className="ml-1 text-slate-600 text-xs">· {p.position}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleAnalyze}
          disabled={!selected || status === 'loading'}
          className="btn-ghost disabled:opacity-40"
        >
          Analyze
        </button>
      </div>

      {/* Result states */}
      {status === 'idle' && !matchup && (
        <p className="text-sm text-slate-500">Search for a defender to analyze the matchup.</p>
      )}

      {status === 'loading' && <div className="space-y-2"><SkeletonLine /><SkeletonLine /></div>}

      {status === 'no_data' && (
        <p className="text-sm text-slate-400">No matchup data found between these players this season.</p>
      )}

      {status === 'error' && (
        <p className="text-sm text-rose-300">Matchup data temporarily unavailable.</p>
      )}

      {status === 'data' && matchup && (
        <div className="space-y-4">
          {/* Verdict badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${
            matchup.verdict.tone === 'down'
              ? 'bg-cyan-400/10 border-cyan-400/30 text-cyan-300'
              : matchup.verdict.tone === 'up'
              ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-300'
              : 'bg-slate-700 border-white/10 text-slate-300'
          }`}>
            {matchup.verdict.emoji} {matchup.verdict.label}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Games',    value: matchup.matchup_data.games_played },
              { label: 'PTS/Game', value: matchup.matchup_data.pts_per_possession != null
                  ? matchup.matchup_data.pts_per_possession.toFixed(1) : '—' },
              { label: 'FG%',      value: matchup.matchup_data.fg_pct_allowed != null
                  ? `${(matchup.matchup_data.fg_pct_allowed * 100).toFixed(1)}%` : '—' },
              { label: 'REB',      value: matchup.matchup_data.def_reb_in_matchup != null
                  ? matchup.matchup_data.def_reb_in_matchup.toFixed(1) : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-white/[0.04] border border-white/10 p-3 text-center">
                <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
                <div className="text-lg font-bold mt-1">{value}</div>
              </div>
            ))}
          </div>

          {/* vs season avg */}
          <div className="text-xs text-slate-400 space-x-4">
            {matchup.vs_season_avg.pts_diff_pct != null && (
              <span>
                PTS vs season avg:{' '}
                <span className={diffColor(matchup.vs_season_avg.pts_diff_pct)}>
                  {matchup.vs_season_avg.pts_diff_pct > 0 ? '+' : ''}{matchup.vs_season_avg.pts_diff_pct}%
                </span>
              </span>
            )}
            {matchup.vs_season_avg.fg_pct_diff_pct != null && (
              <span>
                FG% vs season avg:{' '}
                <span className={diffColor(matchup.vs_season_avg.fg_pct_diff_pct)}>
                  {matchup.vs_season_avg.fg_pct_diff_pct > 0 ? '+' : ''}{matchup.vs_season_avg.fg_pct_diff_pct}%
                </span>
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600">{matchup.matchup_data.sample_note}</p>
        </div>
      )}
    </div>
  );
}

export default function PropsPage() {
  const { id } = useParams();
  const [data, setData]   = useState(null);
  const [err, setErr]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null); setErr(null);
    api.props(id)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, [id]);

  if (err) {
    const is404 = /^404\b/.test(err);
    return (
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-16">
        <div className="glass p-8 text-center space-y-4">
          <div className="text-5xl">{is404 ? '🔍' : '⚠️'}</div>
          <h2 className="text-2xl font-bold gradient-text">
            {is404 ? 'Props unavailable' : 'Something went wrong'}
          </h2>
          <p className="text-slate-400 text-sm">
            {is404
              ? "We don't have prop lines for this player right now. Check back before their next game."
              : err}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link to={`/app/player/${id}`} className="btn-primary">Back to player</Link>
            <Link to="/app" className="btn-ghost">Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 space-y-6">
      <SkeletonLine className="w-40" />
      <div className="grid lg:grid-cols-2 gap-5">
        <SkeletonCard lines={6} />
        <SkeletonCard lines={6} />
      </div>
    </div>
  );

  const { player, next_game, props } = data;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <Seo
        title={`${player.name} Props — Points, Rebounds, Assists Lines | CourtIQ`}
        description={`Live prop lines, over/under odds, hit rates and confidence scores for ${player.name}'s next NBA game.`}
        path={`/app/player/${id}/props`}
      />
      {/* Back link */}
      <Link
        to={`/app/player/${id}`}
        className="text-sm text-slate-400 hover:text-white inline-flex items-center gap-1.5"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to player
      </Link>

      {/* Header */}
      <div className="glass p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">{player.name}</h1>
          <p className="text-slate-400 text-sm mt-0.5">Props & Confidence Analysis</p>
        </div>
        {next_game ? (
          <div className="text-sm text-slate-400">
            Next: <span className="text-white font-medium">{next_game.opponent_name}</span>
            <span className="ml-2 text-slate-500">{next_game.is_home ? 'HOME' : 'AWAY'}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-500">Schedule unavailable</span>
        )}
      </div>

      {/* Prop cards */}
      <div className="grid lg:grid-cols-3 gap-5">
        <PropCard title="Points"   prop={props?.points} />
        <PropCard title="Rebounds" prop={props?.rebounds} />
        <PropCard title="Assists"  prop={props?.assists} />
      </div>

      {/* Defensive Matchup */}
      <MatchupSection offenderId={id} playerPosition={player.position} />
    </div>
  );
}
