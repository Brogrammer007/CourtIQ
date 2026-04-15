import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip,
} from 'recharts';
import { api } from '../lib/api.js';
import { SkeletonLine } from '../components/Skeleton.jsx';

function initials(p) {
  return `${p?.first_name?.[0] ?? ''}${p?.last_name?.[0] ?? ''}`.toUpperCase();
}

export default function Preview() {
  const [topPlayers, setTopPlayers] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [statsData, setStatsData]     = useState(null);
  const [loading, setLoading]         = useState(false);

  // Load top players once
  useEffect(() => {
    api.top()
      .then((r) => { if (r.data?.length) setTopPlayers(r.data.slice(0, 5)); })
      .catch(() => {});
  }, []);

  // Load stats whenever selected player changes
  useEffect(() => {
    const player = topPlayers[selectedIdx];
    if (!player) return;
    let cancelled = false;
    setStatsData(null);
    setLoading(true);
    api.stats(player.id)
      .then((r) => { if (!cancelled) { setStatsData(r); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [topPlayers, selectedIdx]);

  const player  = topPlayers[selectedIdx] ?? null;
  const avgs    = statsData?.averages ?? null;

  // Last 7 games bar data (newest-first from API → reverse for chart)
  const barData = (statsData?.data ?? [])
    .slice(0, 7)
    .reverse()
    .map((g, i) => ({ g: `G${i + 1}`, pts: g.pts ?? 0 }));

  // Season stat tiles
  const tiles = [
    { k: 'Avg PTS', v: avgs?.pts != null ? avgs.pts.toFixed(1) : '—' },
    { k: 'Avg AST', v: avgs?.ast != null ? avgs.ast.toFixed(1) : '—' },
    { k: 'Avg REB', v: avgs?.reb != null ? avgs.reb.toFixed(1) : '—' },
    { k: 'FG%',     v: avgs?.fg_pct != null ? `${(avgs.fg_pct * 100).toFixed(1)}%` : '—' },
  ];

  return (
    <section id="preview" className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl mb-12">
          <span className="chip">Dashboard</span>
          <h2 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight">
            Your <span className="gradient-text">analytics cockpit</span>
          </h2>
          <p className="mt-4 text-slate-300">
            A premium, real-time view of players, trends, and predictions.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="glass p-6 md:p-8 relative overflow-hidden"
        >
          {/* Mock toolbar */}
          <div className="flex items-center gap-2 mb-5">
            <span className="w-3 h-3 rounded-full bg-rose-400/70" />
            <span className="w-3 h-3 rounded-full bg-amber-400/70" />
            <span className="w-3 h-3 rounded-full bg-emerald-400/70" />
            <span className="ml-4 text-xs text-slate-400 font-mono">courtiq.app/dashboard</span>
          </div>

          {/* Player slider tabs */}
          {topPlayers.length > 0 && (
            <div className="flex gap-2 mb-6 flex-wrap">
              {topPlayers.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedIdx(i)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    i === selectedIdx
                      ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                      : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center ${
                    i === selectedIdx ? 'bg-violet-500/40' : 'bg-white/10'
                  }`}>
                    {initials(p)}
                  </span>
                  {p.first_name} {p.last_name}
                </button>
              ))}
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-5">
            {/* Bar chart — last 7 games */}
            <div className="glass p-5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Points · Last 7 games
                  </div>
                  <div className="mt-1 text-2xl font-bold">
                    {player ? `${player.first_name} ${player.last_name}` : '—'}
                  </div>
                </div>
                {player && (
                  <div className="chip">
                    {player.team?.abbreviation ?? '?'} · {player.position || 'N/A'}
                  </div>
                )}
              </div>

              <div className="mt-4 h-60">
                {loading ? (
                  <div className="h-full flex flex-col justify-center gap-2 px-4">
                    <SkeletonLine />
                    <SkeletonLine />
                    <SkeletonLine />
                  </div>
                ) : barData.length > 0 ? (
                  <ResponsiveContainer>
                    <BarChart data={barData}>
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8B5CF6" />
                          <stop offset="100%" stopColor="#22D3EE" />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="g"
                        stroke="#64748B"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#64748B"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 'auto']}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        contentStyle={{
                          background: '#0B0F1A',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 12,
                        }}
                        formatter={(v) => [`${v} PTS`, '']}
                      />
                      <Bar dataKey="pts" fill="url(#barGrad)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                    No game data available
                  </div>
                )}
              </div>
            </div>

            {/* Season averages panel */}
            <div className="glass p-5 flex flex-col justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-3">
                  Season Averages
                </div>
                {loading ? (
                  <div className="space-y-3">
                    <SkeletonLine />
                    <SkeletonLine />
                    <SkeletonLine />
                  </div>
                ) : avgs ? (
                  <div className="space-y-3">
                    {[
                      { label: 'Points',   value: avgs.pts?.toFixed(1),   color: 'text-violet-300' },
                      { label: 'Assists',  value: avgs.ast?.toFixed(1),   color: 'text-cyan-300' },
                      { label: 'Rebounds', value: avgs.reb?.toFixed(1),   color: 'text-emerald-300' },
                      { label: 'FG%',      value: avgs.fg_pct != null ? `${(avgs.fg_pct * 100).toFixed(1)}%` : null, color: 'text-amber-300' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">{label}</span>
                        <span className={`text-xl font-bold ${color}`}>{value ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm">No data</div>
                )}
              </div>

              {statsData?.trend && (
                <div className={`mt-4 pt-4 border-t border-white/10 text-xs font-medium ${
                  statsData.trend === 'up'   ? 'text-emerald-300' :
                  statsData.trend === 'down' ? 'text-rose-300'    : 'text-slate-400'
                }`}>
                  {statsData.trend === 'up'   ? '▲ Trending up'   :
                   statsData.trend === 'down' ? '▼ Trending down' : '— Stable form'}
                </div>
              )}
            </div>

            {/* Stat tiles */}
            {tiles.map((s) => (
              <div key={s.k} className="glass p-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{s.k}</div>
                <div className="mt-1 text-2xl font-bold">
                  {loading ? <span className="text-slate-600">…</span> : s.v}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
