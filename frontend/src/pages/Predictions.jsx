import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api.js';
import { SkeletonCard } from '../components/Skeleton.jsx';

// ---- Small, reusable player-search typeahead ------------------------------

function PlayerSearch({ onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  // Debounced remote search against /api/players?search=
  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.search(term);
        setResults((r.data || []).slice(0, 12));
      } catch { setResults([]); }
      setLoading(false);
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  // Click-away to close
  useEffect(() => {
    function onDoc(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search any NBA player…"
          className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-10 pr-10 py-3 text-sm outline-none focus:border-primary/60 placeholder-slate-500"
        />
        {q && (
          <button
            onClick={() => { setQ(''); setResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
            aria-label="Clear"
          >✕</button>
        )}
      </div>

      <AnimatePresence>
        {open && q.trim() && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 left-0 right-0 mt-2 glass p-1.5 max-h-80 overflow-y-auto"
          >
            {loading && (
              <div className="px-3 py-2 text-xs text-slate-400">Searching…</div>
            )}
            {!loading && results.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400">No players found.</div>
            )}
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => { onPick(p); setOpen(false); setQ(''); }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/[0.05] transition flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-grad-primary flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {p.first_name?.[0]}{p.last_name?.[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.first_name} {p.last_name}</div>
                  <div className="text-[11px] text-slate-400">{p.team?.full_name} · {p.position || '—'}</div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- Prediction card building blocks --------------------------------------

function ProbBar({ overPct }) {
  return (
    <div className="w-full h-2 rounded-full bg-white/[0.05] overflow-hidden flex">
      <div className="bg-emerald-400/70" style={{ width: `${overPct}%` }} />
      <div className="bg-rose-400/70" style={{ width: `${100 - overPct}%` }} />
    </div>
  );
}

function PredictionCard({ player, prediction, trend, averages, featured = false }) {
  if (!prediction) return null;
  return (
    <div className={`glass ${featured ? 'p-6 bg-gradient-to-br from-primary/10 to-secondary/5 border-primary/20' : 'glass-hover p-5'}`}>
      <Link to={`/app/player/${player.id}`} className="block">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`${featured ? 'w-12 h-12 text-base' : 'w-9 h-9 text-xs'} rounded-xl bg-grad-primary flex items-center justify-center font-bold text-white shrink-0`}>
              {player.first_name?.[0]}{player.last_name?.[0]}
            </div>
            <div className="min-w-0">
              <div className={`${featured ? 'text-lg' : 'text-sm'} font-semibold truncate`}>
                {player.first_name} {player.last_name}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {player.team?.full_name || player.team?.abbreviation} · {player.position || '—'}
              </div>
            </div>
          </div>
          {trend && (
            <span className={`text-xs shrink-0 ${trend.direction === 'up' ? 'text-emerald-300' : trend.direction === 'down' ? 'text-rose-300' : 'text-slate-400'}`}>
              {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '•'} Form {trend.form}
            </span>
          )}
        </div>
      </Link>

      <div className={`mt-4 grid grid-cols-3 gap-2 text-center`}>
        <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Expected</div>
          <div className={`${featured ? 'text-3xl' : 'text-xl'} font-bold gradient-text`}>{prediction.expected_points}</div>
        </div>
        <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Over {prediction.line}</div>
          <div className={`${featured ? 'text-3xl' : 'text-xl'} font-bold text-emerald-300`}>{prediction.over_probability}%</div>
        </div>
        <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Under</div>
          <div className={`${featured ? 'text-3xl' : 'text-xl'} font-bold text-rose-300`}>{prediction.under_probability}%</div>
        </div>
      </div>

      {featured && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
            <span>Over {prediction.line}</span><span>Under</span>
          </div>
          <ProbBar overPct={prediction.over_probability} />
        </div>
      )}

      {averages && (
        <div className={`${featured ? 'mt-5' : 'mt-3'} text-xs text-slate-400`}>
          Season avg · <span className="text-slate-200">{averages.pts}</span> pts ·
          <span className="text-slate-200"> {averages.reb}</span> reb ·
          <span className="text-slate-200"> {averages.ast}</span> ast
        </div>
      )}
    </div>
  );
}

// ---- Page -----------------------------------------------------------------

export default function Predictions() {
  const [rows, setRows] = useState(null);
  const [selected, setSelected] = useState(null); // { player, prediction, trend, averages }
  const [loadingSel, setLoadingSel] = useState(false);
  const [selErr, setSelErr] = useState(null);

  // Load top-N default cards
  useEffect(() => {
    let cancel = false;
    async function run() {
      const top = await api.top().then((r) => r.data).catch(() => []);
      const withStats = await Promise.all(
        top.slice(0, 10).map(async (p) => {
          try {
            const s = await api.stats(p.id);
            return { player: p, prediction: s.prediction, trend: s.trend, averages: s.averages };
          } catch { return { player: p, prediction: null }; }
        })
      );
      if (!cancel) setRows(withStats.filter((r) => r.prediction));
    }
    run();
    return () => { cancel = true; };
  }, []);

  async function pickPlayer(p) {
    setSelErr(null);
    setLoadingSel(true);
    setSelected({ player: p, prediction: null, trend: null, averages: null });
    try {
      const s = await api.stats(p.id);
      setSelected({ player: p, prediction: s.prediction, trend: s.trend, averages: s.averages });
    } catch (e) {
      setSelErr(e.message || 'Failed to load prediction');
    } finally {
      setLoadingSel(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10">
      <span className="chip">Model v1</span>
      <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Predictions</h1>
      <p className="text-slate-400 mt-1 text-sm">
        Pick any NBA player to see expected points and over/under probability for their next game.
      </p>

      {/* Search any player */}
      <div className="mt-8 glass p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Custom Prediction</div>
            <div className="text-sm font-semibold mt-0.5">Generate a prediction for any player</div>
          </div>
          {selected && (
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
        <PlayerSearch onPick={pickPlayer} />

        <AnimatePresence mode="wait">
          {loadingSel && (
            <motion.div
              key="sel-loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="mt-5"
            >
              <SkeletonCard lines={3} />
            </motion.div>
          )}
          {!loadingSel && selErr && (
            <motion.div key="sel-err" className="mt-5 text-sm text-rose-300">⚠ {selErr}</motion.div>
          )}
          {!loadingSel && selected?.prediction && (
            <motion.div
              key="sel-card"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-5"
            >
              <PredictionCard {...selected} featured />
            </motion.div>
          )}
          {!loadingSel && selected && !selected.prediction && !selErr && (
            <motion.div
              key="sel-empty"
              className="mt-5 glass p-5 text-sm text-slate-400"
            >
              No prediction available for this player yet.
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Top picks grid */}
      <div className="mt-10 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Top picks</h2>
        <span className="text-xs text-slate-400">Trending players · live model</span>
      </div>

      {!rows ? (
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r) => (
            <PredictionCard key={r.player.id} {...r} />
          ))}
        </div>
      )}
    </div>
  );
}
