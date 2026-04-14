import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import ConfidenceMeter from '../components/ConfidenceMeter.jsx';
import { SkeletonCard, SkeletonLine } from '../components/Skeleton.jsx';

function formatOdds(odds) {
  if (odds == null) return '—';
  return odds > 0 ? `+${odds}` : String(odds);
}

function oddsColor(odds) {
  if (odds == null) return 'text-slate-400';
  return odds > 0 ? 'text-emerald-300' : 'text-white';
}

function HitRateBar({ hitRate, sample }) {
  if (hitRate == null) return <span className="text-slate-500 text-xs">No data</span>;
  const hits = Math.round((hitRate / 100) * sample);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-400">
        <span>Hit rate (last {sample}g)</span>
        <span>{hits}/{sample} ({hitRate}%)</span>
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
    <div className="glass p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm uppercase tracking-widest text-slate-400">{title}</h3>
        {!prop.odds_available && (
          <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full border border-white/10">
            No live odds
          </span>
        )}
      </div>

      {/* Line + odds */}
      <div className="flex items-baseline gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Line</div>
          <div className="text-3xl font-bold">{prop.line ?? '—'}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Over</div>
          <div className={`text-lg font-semibold ${oddsColor(prop.over_odds)}`}>
            {formatOdds(prop.over_odds)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Under</div>
          <div className={`text-lg font-semibold ${oddsColor(prop.under_odds)}`}>
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
      <HitRateBar hitRate={prop.hit_rate_over} sample={prop.hit_rate_sample} />

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

  if (err) return (
    <div className="mx-auto max-w-5xl px-6 py-10 text-rose-300">⚠ {err}</div>
  );

  if (!data) return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <SkeletonLine className="w-40" />
      <div className="grid lg:grid-cols-2 gap-5">
        <SkeletonCard lines={6} />
        <SkeletonCard lines={6} />
      </div>
    </div>
  );

  const { player, next_game, props } = data;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      {/* Back link */}
      <Link
        to={`/player/${id}`}
        className="text-sm text-slate-400 hover:text-white inline-flex items-center gap-1.5"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to player
      </Link>

      {/* Header */}
      <div className="glass p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{player.name}</h1>
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
      <div className="grid lg:grid-cols-2 gap-5">
        <PropCard title="Points" prop={props?.points} />
        <PropCard title="Rebounds" prop={props?.rebounds} />
      </div>
    </div>
  );
}
