import { useEffect, useState } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api.js';
import { SkeletonCard } from '../components/Skeleton.jsx';
import Seo from '../components/Seo.jsx';

function PlayerPicker({ label, value, onChange, options }) {
  return (
    <div className="glass p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="mt-3 w-full bg-transparent border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary/60"
      >
        <option value="" className="bg-bg">Select a player…</option>
        {options.map((p) => (
          <option key={p.id} value={p.id} className="bg-bg">
            {p.first_name} {p.last_name} — {p.team?.abbreviation}
          </option>
        ))}
      </select>
    </div>
  );
}

function scoreRadar(a) {
  // Scale averages to 0–100 for radar
  const s = (v, max) => Math.round(Math.min(100, (v / max) * 100));
  return [
    { stat: 'PTS', v: s(a.pts, 40) },
    { stat: 'AST', v: s(a.ast, 12) },
    { stat: 'REB', v: s(a.reb, 15) },
    { stat: 'STL', v: s(a.stl, 3) },
    { stat: 'BLK', v: s(a.blk, 3) },
    { stat: 'FG%', v: Math.round(a.fg_pct * 100) },
  ];
}

export default function Compare() {
  const [allPlayers, setAllPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [a, setA] = useState(null);
  const [b, setB] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    // Load all players (paginate through cursor) for the dropdowns
    let cancel = false;
    async function loadAll() {
      let cursor = '';
      const acc = [];
      for (let i = 0; i < 20 && !cancel; i++) {
        const r = await api.search('', cursor).catch(() => null);
        if (!r) break;
        acc.push(...(r.data || []));
        if (r.next_cursor == null) break;
        cursor = r.next_cursor;
      }
      if (!cancel) {
        setAllPlayers(acc);
        setLoadingPlayers(false);
      }
    }
    loadAll();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    if (!a || !b) { setResult(null); setErr(null); return; }
    setLoading(true);
    setErr(null);
    api.compare(a, b)
      .then(setResult)
      .catch((e) => setErr(e.message || 'Failed to load comparison'))
      .finally(() => setLoading(false));
  }, [a, b]);

  const radarData =
    result && result.a.averages && result.b.averages
      ? scoreRadar(result.a.averages).map((row, i) => ({
          stat: row.stat,
          A: row.v,
          B: scoreRadar(result.b.averages)[i].v,
        }))
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10">
      <Seo
        title="Compare NBA Players Head-to-Head — Stats & Predictions | CourtIQ"
        description="Side-by-side comparison of any two NBA players — averages, form, shooting splits, and next-game predictions."
        path="/app/compare"
      />
      <span className="chip">Compare</span>
      <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Side-by-side breakdown</h1>
      <p className="text-slate-400 mt-1 text-sm">Pick two players. See averages, form, and predictions head-to-head.</p>

      {loadingPlayers ? (
        <div className="mt-8 grid md:grid-cols-2 gap-5">
          <SkeletonCard lines={2} /><SkeletonCard lines={2} />
        </div>
      ) : (
        <div className="mt-8 grid md:grid-cols-2 gap-5">
          <PlayerPicker label="Player A" value={a} onChange={setA} options={allPlayers} />
          <PlayerPicker label="Player B" value={b} onChange={setB} options={allPlayers} />
        </div>
      )}

      {loading && (
        <div className="mt-8 grid md:grid-cols-2 gap-5">
          <SkeletonCard /><SkeletonCard />
        </div>
      )}

      {err && !loading && (
        <div className="mt-8 glass p-6 text-sm text-rose-300">⚠ {err}</div>
      )}

      {result && radarData && (
        <>
          <div className="mt-8 glass p-4 sm:p-6">
            <h3 className="font-semibold">Radar</h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-1 text-slate-400">
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" />{result.a.player?.first_name} {result.a.player?.last_name}</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-secondary" />{result.b.player?.first_name} {result.b.player?.last_name}</span>
            </div>
            <div className="h-64 sm:h-80 mt-3">
              <ResponsiveContainer>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.12)" />
                  <PolarAngleAxis dataKey="stat" stroke="#94A3B8" fontSize={12} />
                  <Radar dataKey="A" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.4} />
                  <Radar dataKey="B" stroke="#22D3EE" fill="#22D3EE" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-6 grid md:grid-cols-2 gap-5">
            {['a', 'b'].map((key) => {
              const side = result[key];
              const accent = key === 'a' ? 'text-primary-soft' : 'text-secondary-soft';
              return (
                <div key={key} className="glass p-4 sm:p-5">
                  <div className={`text-sm font-semibold ${accent} truncate`}>
                    {side.player?.first_name} {side.player?.last_name}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{side.player?.team?.full_name}</div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {side.averages && Object.entries({ PTS: side.averages.pts, REB: side.averages.reb, AST: side.averages.ast, STL: side.averages.stl, BLK: side.averages.blk, 'FG%': (side.averages.fg_pct*100).toFixed(1) + '%' }).map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-2">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{k}</div>
                        <div className="text-base sm:text-lg font-bold tabular-nums">{v}</div>
                      </div>
                    ))}
                  </div>
                  {side.prediction && (
                    <div className="mt-4 text-sm text-slate-300">
                      Projected: <b className="text-white">{side.prediction.expected_points}</b> PTS ·
                      Over {side.prediction.line}: <b className="text-emerald-300">{side.prediction.over_probability}%</b>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {!loadingPlayers && !loading && (!a || !b) && !result && !err ? (
        <div className="mt-10 glass p-10 text-center text-slate-400">
          Pick two players above to generate the comparison.
        </div>
      ) : null}
    </div>
  );
}
