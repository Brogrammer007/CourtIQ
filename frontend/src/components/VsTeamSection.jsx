import { useEffect, useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api.js';
import { SkeletonCard } from './Skeleton.jsx';

function DiffBadge({ value }) {
  if (value == null || isNaN(value)) return null;
  const up = value > 0;
  const neutral = Math.abs(value) < 1;
  const cls = neutral
    ? 'text-slate-400 bg-white/[0.04] border-white/10'
    : up
      ? 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30'
      : 'text-rose-300 bg-rose-400/10 border-rose-400/30';
  const sign = value > 0 ? '+' : '';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {up ? '▲' : value < 0 ? '▼' : '•'} {sign}{value.toFixed(1)}%
    </span>
  );
}

function StatRow({ label, vsTeam, season, diff, emoji }) {
  const up = diff > 0;
  const neutral = Math.abs(diff ?? 0) < 1;
  const color = neutral ? 'text-white' : up ? 'text-emerald-300' : 'text-rose-300';
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-slate-300 truncate">{label}</span>
        {emoji && <span className="text-base">{emoji}</span>}
      </div>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <span className={`text-lg sm:text-xl font-bold tabular-nums ${color}`}>{vsTeam ?? '—'}</span>
        <span className="hidden sm:inline text-xs text-slate-500 tabular-nums">/ {season ?? '—'} avg</span>
        <DiffBadge value={diff} />
      </div>
    </div>
  );
}

function MatchupLabel({ matchup }) {
  if (!matchup) return null;
  const map = {
    up: 'from-emerald-500/30 to-emerald-400/5 border-emerald-400/30 text-emerald-200',
    flat: 'from-slate-500/20 to-slate-400/5 border-white/10 text-slate-200',
    down: 'from-rose-500/30 to-rose-400/5 border-rose-400/30 text-rose-200',
  };
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${map[matchup.tone]} border text-sm font-semibold`}>
      <span className="text-base">{matchup.emoji}</span>
      {matchup.label}
    </div>
  );
}

export default function VsTeamSection({ playerId, player }) {
  const [teams, setTeams] = useState(null);
  const [teamId, setTeamId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // Load teams once, exclude player's own team
  useEffect(() => {
    api.teams().then((r) => {
      const own = player?.team?.id;
      setTeams((r.data || []).filter((t) => String(t.id) !== String(own)));
    }).catch(() => setTeams([]));
  }, [player?.team?.id]);

  useEffect(() => {
    if (!teamId) { setData(null); return; }
    setLoading(true); setErr(null);
    api.vsTeam(playerId, teamId)
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [playerId, teamId]);

  // Last 5 games vs team (chronological for chart)
  const chartData = useMemo(() => {
    if (!data?.games) return [];
    const last5 = data.games.slice(0, 5).reverse();
    return last5.map((g, i) => ({
      g: g.date ? g.date.slice(5) : `G${i + 1}`,
      pts: g.pts,
    }));
  }, [data]);

  return (
    <section className="mt-6">
      <div className="glass p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="chip">Matchup Analytics</div>
            <h3 className="mt-2 text-xl font-semibold">Performance vs Teams</h3>
            <p className="text-sm text-slate-400 mt-0.5">
              Filter games by opponent, compare to season averages, and surface matchup signals.
            </p>
          </div>
          <div className="relative w-full sm:w-auto">
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="appearance-none w-full sm:w-auto bg-transparent border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-sm outline-none focus:border-primary/60 sm:min-w-[220px]"
            >
              <option value="" className="bg-bg">Select opponent team…</option>
              {teams?.map((t) => (
                <option key={t.id} value={t.id} className="bg-bg">
                  {t.full_name}
                </option>
              ))}
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!teamId && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="mt-6 py-10 text-center text-sm text-slate-500"
            >
              Pick a team to see this player's performance against them.
            </motion.div>
          )}

          {teamId && loading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 grid md:grid-cols-2 gap-4">
              <SkeletonCard /><SkeletonCard />
            </motion.div>
          )}

          {teamId && !loading && err && (
            <motion.div key="err" className="mt-6 text-rose-300 text-sm">⚠ {err}</motion.div>
          )}

          {teamId && !loading && data && !err && (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="mt-6 grid lg:grid-cols-5 gap-5"
            >
              {/* Left: Headline + stats */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">vs</div>
                    <div className="text-lg font-bold">{data.team?.full_name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {data.sample_size} game{data.sample_size === 1 ? '' : 's'} sampled
                    </div>
                  </div>
                  <MatchupLabel matchup={data.matchup} />
                </div>

                {data.vs_team_averages ? (
                  <div className="glass p-4 bg-white/[0.02]">
                    <StatRow
                      label="Points"
                      vsTeam={data.vs_team_averages.pts}
                      season={data.season_averages?.pts}
                      diff={data.diff_percent?.pts}
                      emoji={data.diff_percent?.pts > 10 ? '🔥' : data.diff_percent?.pts < -10 ? '🧊' : null}
                    />
                    <StatRow
                      label="Assists"
                      vsTeam={data.vs_team_averages.ast}
                      season={data.season_averages?.ast}
                      diff={data.diff_percent?.ast}
                    />
                    <StatRow
                      label="Rebounds"
                      vsTeam={data.vs_team_averages.reb}
                      season={data.season_averages?.reb}
                      diff={data.diff_percent?.reb}
                    />
                  </div>
                ) : (
                  <div className="glass p-4 text-sm text-slate-400">
                    No sampled games against this opponent yet.
                  </div>
                )}
              </div>

              {/* Right: Chart + insights + weakness */}
              <div className="lg:col-span-3 space-y-4">
                <div className="glass p-4 bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Last {chartData.length} games vs {data.team?.abbreviation}</div>
                    <div className="text-xs text-slate-500">Points trend</div>
                  </div>
                  <div className="h-40 mt-3">
                    <ResponsiveContainer>
                      <LineChart data={chartData}>
                        <defs>
                          <linearGradient id="vsTeamStroke" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#8B5CF6" />
                            <stop offset="100%" stopColor="#22D3EE" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="g" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ background: '#0B0F1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                        {data.season_averages && (
                          <ReferenceLine
                            y={data.season_averages.pts}
                            stroke="#64748B"
                            strokeDasharray="4 4"
                            label={{ value: `Season avg ${data.season_averages.pts}`, position: 'insideTopRight', fill: '#94A3B8', fontSize: 10 }}
                          />
                        )}
                        <Line type="monotone" dataKey="pts" stroke="url(#vsTeamStroke)" strokeWidth={2.5} dot={{ r: 3, fill: '#8B5CF6' }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Smart insights */}
                {data.insights?.length > 0 && (
                  <div className="glass p-4 bg-gradient-to-br from-primary/10 to-secondary/5 border-primary/20">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-primary-soft">Smart Insight</div>
                    <ul className="mt-2 space-y-1.5 text-sm text-slate-200">
                      {data.insights.map((line, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-secondary-soft mt-0.5">•</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Team weakness */}
                {data.weakness && (
                  <div className="glass p-4 bg-white/[0.02]">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Team Weakness</div>
                      <div className="text-xs text-slate-500">{data.team?.abbreviation} defense</div>
                    </div>
                    <p className="mt-2 text-sm text-slate-200">{data.weakness.narrative}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {data.weakness.allowed_vs.map((w) => (
                        <div key={w.archetype} className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-2 text-center">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{w.archetype}</div>
                          <div className={`mt-1 text-sm font-bold ${w.delta_percent > 5 ? 'text-rose-300' : w.delta_percent < -5 ? 'text-emerald-300' : 'text-slate-200'}`}>
                            {w.delta_percent > 0 ? '+' : ''}{w.delta_percent}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
