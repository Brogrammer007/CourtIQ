import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar,
} from 'recharts';
import { api } from '../lib/api.js';
import { useStore } from '../store/useStore.js';
import StatTile from '../components/StatTile.jsx';
import { SkeletonCard, SkeletonLine } from '../components/Skeleton.jsx';
import VsTeamSection from '../components/VsTeamSection.jsx';

function InjuryBanner({ availability }) {
  const injury = availability?.injury;
  if (!injury) return null;

  const isOut = availability.out_for_next_game;
  const tone = isOut
    ? 'border-rose-400/30 bg-rose-400/10 text-rose-200'
    : 'border-amber-400/30 bg-amber-400/10 text-amber-200';

  // Normalize status: "Day-To-Day" → "Day-to-Day"
  const statusLabel = injury.status
    ? injury.status.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('-')
    : isOut ? 'Out' : 'Injury update';

  const fmtDate = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d) ? null : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  const retDate = fmtDate(injury.return_date);

  return (
    <div className={`mt-4 glass border ${tone} p-4 sm:p-5 flex items-start gap-3`}>
      <div className="text-xl shrink-0 leading-none pt-0.5">{isOut ? '🚫' : '⚠️'}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-sm sm:text-base">
            {isOut ? 'Out for next game' : statusLabel}
          </span>
          {injury.type && (
            <span className="text-[11px] uppercase tracking-wider opacity-80">· {injury.type}</span>
          )}
          {retDate && (
            <span className="text-[11px] uppercase tracking-wider opacity-80">· Est. return {retDate}</span>
          )}
          {injury.fantasy_status && injury.fantasy_status !== 'OUT' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-white/20 opacity-90">
              {injury.fantasy_status}
            </span>
          )}
        </div>
        {injury.short_comment && (
          <p className="text-xs sm:text-sm opacity-90 mt-1 leading-relaxed">{injury.short_comment}</p>
        )}
      </div>
    </div>
  );
}

function PlayerHeadshot({ player }) {
  const [imgError, setImgError] = useState(false);
  const headshotUrl = `https://a.espncdn.com/i/headshots/nba/players/full/${player.id}.png`;

  if (!imgError) {
    return (
      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-grad-primary shadow-glow shrink-0">
        <img
          src={headshotUrl}
          alt={`${player.first_name} ${player.last_name}`}
          className="w-full h-full object-cover object-top"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className="w-20 h-20 rounded-2xl bg-grad-primary flex items-center justify-center text-2xl font-extrabold text-white shadow-glow shrink-0">
      {player.first_name?.[0]}{player.last_name?.[0]}
    </div>
  );
}

export default function PlayerPage() {
  const { id } = useParams();
  const { isFavorite, toggleFavorite } = useStore();
  const fav = isFavorite(Number(id)) || isFavorite(id);

  const [player, setPlayer] = useState(null);
  const [statsRes, setStatsRes] = useState(null);
  const [teamMap, setTeamMap] = useState({});
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.teams().then((r) => {
      const map = {};
      (r.data || []).forEach((t) => { map[String(t.id)] = t.abbreviation || t.city; });
      setTeamMap(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let cancel = false;
    setPlayer(null); setStatsRes(null); setErr(null);
    Promise.all([api.player(id), api.stats(id)])
      .then(([p, s]) => {
        if (cancel) return;
        setPlayer(p.data); setStatsRes(s);
      })
      .catch((e) => !cancel && setErr(e.message));
    const iv = setInterval(() => {
      api.stats(id).then((s) => !cancel && setStatsRes(s)).catch(() => {});
    }, 10000);
    return () => { cancel = true; clearInterval(iv); };
  }, [id]);

  if (err) {
    const is404 = /^404\b/.test(err);
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <div className="glass p-8 text-center space-y-4">
          <div className="text-5xl">{is404 ? '🔍' : '⚠️'}</div>
          <h2 className="text-2xl font-bold gradient-text">
            {is404 ? 'Player not found' : 'Something went wrong'}
          </h2>
          <p className="text-slate-400 text-sm">
            {is404
              ? `We couldn't find a player with ID ${id}. They may be retired or the link is wrong.`
              : err}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link to="/app" className="btn-primary">Back to dashboard</Link>
            <Link to="/" className="btn-ghost">Go home</Link>
          </div>
        </div>
      </div>
    );
  }
  if (!player) return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <SkeletonCard lines={2} />
      <div className="grid grid-cols-4 gap-4"><SkeletonCard/><SkeletonCard/><SkeletonCard/><SkeletonCard/></div>
    </div>
  );

  const stats = statsRes?.data ?? [];
  const avgs = statsRes?.averages;
  const trend = statsRes?.trend;
  const pred = statsRes?.prediction;

  // Chronological for charts
  const chartData = [...stats].reverse().map((s, i) => ({
    g: s.date ? s.date.slice(5) : `G${i + 1}`,
    pts: s.pts, ast: s.ast, reb: s.reb,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10">
      <Link to="/app" className="text-sm text-slate-400 hover:text-white inline-flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Back to dashboard
      </Link>

      <div className="mt-6 glass p-5 sm:p-6 md:p-8 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-4 sm:gap-5 min-w-0">
          <PlayerHeadshot player={player} />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
              {player.first_name} {player.last_name}
            </h1>
            <div className="text-slate-400 mt-1 text-sm sm:text-base">
              {player.team?.full_name} · {player.position || '—'} · {player.height || '—'} · {player.weight || '—'} lbs
            </div>
            {trend && (
              <div className="mt-3 inline-flex items-center gap-2 chip">
                <span className={trend.direction === 'up' ? 'text-emerald-300' : trend.direction === 'down' ? 'text-rose-300' : 'text-slate-300'}>
                  {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '•'} {trend.direction.toUpperCase()}
                </span>
                <span>Form {trend.form}/100</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3 sm:ml-auto">
          <button
            onClick={() => toggleFavorite(Number(id))}
            className={`btn-ghost flex-1 sm:flex-initial ${fav ? 'text-yellow-300 border-yellow-400/40 bg-yellow-400/10' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"><path d="M12 3l2.8 6.1 6.7.8-5 4.7 1.4 6.7L12 17.9 6.1 21.3l1.4-6.7-5-4.7 6.7-.8L12 3z" strokeLinejoin="round"/></svg>
            <span className="truncate">{fav ? 'Favorited' : 'Favorite'}</span>
          </button>
          <Link
            to={`/app/player/${id}/props`}
            className="btn-ghost flex-1 sm:flex-initial"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="truncate">Props</span>
          </Link>
        </div>
      </div>

      {/* Injury / availability banner */}
      <InjuryBanner availability={statsRes?.availability} />

      {/* Stat tiles */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="PPG" value={avgs?.pts ?? '—'} trend={trend?.delta} />
        <StatTile label="APG" value={avgs?.ast ?? '—'} accent="secondary" />
        <StatTile label="RPG" value={avgs?.reb ?? '—'} />
        <StatTile label="FG%" value={avgs ? (avgs.fg_pct * 100).toFixed(1) : '—'} suffix="%" accent="secondary" />
      </div>

      {/* Charts */}
      <div className="mt-6 grid lg:grid-cols-2 gap-5">
        <div className="glass p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Points trend</h3>
            <span className="text-xs text-slate-400">Last {stats.length} games</span>
          </div>
          <div className="h-64 mt-3">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="g" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0B0F1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                <Line type="monotone" dataKey="pts" stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 3, fill: '#8B5CF6' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass p-5">
          <h3 className="font-semibold">Assists & Rebounds</h3>
          <div className="h-64 mt-3">
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="g" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0B0F1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                <Bar dataKey="ast" fill="#22D3EE" radius={[6,6,0,0]} />
                <Bar dataKey="reb" fill="#8B5CF6" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Insights + Prediction */}
      <div className="mt-6 grid lg:grid-cols-2 gap-5">
        <div className="glass p-5">
          <h3 className="font-semibold">Smart Insights</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {trend && (
              <li>
                • Current form is <b className="text-white">{trend.form}/100</b>, trending <b className="text-white">{trend.direction}</b>
                {trend.delta !== 0 && <> ({trend.delta > 0 ? '+' : ''}{trend.delta} PTS vs prior 5)</>}.
              </li>
            )}
            {avgs && (
              <li>• Averaging <b>{avgs.pts} / {avgs.reb} / {avgs.ast}</b> on <b>{(avgs.fg_pct*100).toFixed(1)}%</b> FG.</li>
            )}
            {pred && (
              <li>• Model projects <b className="gradient-text">{pred.expected_points}</b> points next game.</li>
            )}
          </ul>
        </div>

        <div className="glass p-5">
          <h3 className="font-semibold">Prediction</h3>
          {pred ? (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2.5 sm:p-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Expected</div>
                <div className="text-xl sm:text-2xl font-bold gradient-text mt-1">{pred.expected_points}</div>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2.5 sm:p-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Over {pred.line}</div>
                <div className="text-xl sm:text-2xl font-bold text-emerald-300 mt-1">{pred.over_probability}%</div>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2.5 sm:p-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Under {pred.line}</div>
                <div className="text-xl sm:text-2xl font-bold text-rose-300 mt-1">{pred.under_probability}%</div>
              </div>
            </div>
          ) : (
            <SkeletonLine className="w-1/2 mt-3" />
          )}
        </div>
      </div>

      {/* Matchup analytics: player vs team + team weakness */}
      <VsTeamSection playerId={id} player={player} />

      {/* Recent game log */}
      <div className="mt-6 glass p-5">
        <h3 className="font-semibold">Recent games</h3>
        <p className="text-[11px] text-slate-500 mt-1 sm:hidden">Scroll horizontally for more stats →</p>
        <div className="mt-3 overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm min-w-[520px]">
            <thead className="text-left text-slate-400 text-xs uppercase tracking-wider">
              <tr className="border-b border-white/10">
                <th className="py-2 pr-3">Date</th>
                <th className="pr-3">Opp</th>
                <th>PTS</th><th>REB</th><th>AST</th>
                <th className="hidden sm:table-cell">TO</th>
                <th className="hidden sm:table-cell">STL</th>
                <th className="hidden sm:table-cell">BLK</th>
                <th className="hidden md:table-cell">FG%</th>
                <th className="hidden md:table-cell">3P%</th>
                <th className="hidden md:table-cell">FT%</th>
                <th className="hidden sm:table-cell">MIN</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => {
                const oppAbbr = s.opponent_id != null ? (teamMap[String(s.opponent_id)] || '—') : '—';
                const oppLabel = s.is_home === true ? `vs ${oppAbbr}` : s.is_home === false ? `@ ${oppAbbr}` : oppAbbr;
                return (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="py-2 pr-3 text-slate-300 whitespace-nowrap">{s.date || '—'}</td>
                    <td className="pr-3 text-slate-300 whitespace-nowrap">{oppLabel}</td>
                    <td className="font-semibold">{s.pts}</td>
                    <td>{s.reb}</td><td>{s.ast}</td>
                    <td className="hidden sm:table-cell text-rose-300">{s.to ?? '—'}</td>
                    <td className="hidden sm:table-cell">{s.stl}</td>
                    <td className="hidden sm:table-cell">{s.blk}</td>
                    <td className="hidden md:table-cell">{s.fg_pct != null ? (s.fg_pct * 100).toFixed(1) + '%' : '—'}</td>
                    <td className="hidden md:table-cell">{s.fg3_pct != null ? (s.fg3_pct * 100).toFixed(1) + '%' : '—'}</td>
                    <td className="hidden md:table-cell">{s.ft_pct != null ? (s.ft_pct * 100).toFixed(1) + '%' : '—'}</td>
                    <td className="hidden sm:table-cell">{s.min}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
