import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { api } from '../lib/api.js';
import PlayerCard from '../components/PlayerCard.jsx';
import { SkeletonCard } from '../components/Skeleton.jsx';
import StatTile from '../components/StatTile.jsx';
import Seo from '../components/Seo.jsx';
import { motion } from 'framer-motion';

const REFRESH_MS = 15000;

export default function Dashboard() {
  const [trending, setTrending] = useState(null);
  const [avgPpg, setAvgPpg] = useState(null);
  const [players, setPlayers] = useState(null);      // paginated list
  const [cursor, setCursor] = useState(null);        // next cursor
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [err, setErr] = useState(null);
  const [tick, setTick] = useState(0);

  const searchRef = useRef(null);

  // Real-time refresh (only refreshes trending list)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  // Keyboard shortcuts: "/" focuses search, "Esc" clears & blurs
  useEffect(() => {
    function onKey(e) {
      const target = e.target;
      const typingElsewhere =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (e.key === '/' && !typingElsewhere) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === 'Escape' && target === searchRef.current) {
        setSearch('');
        searchRef.current?.blur();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  // Trending row + avg PPG computation
  useEffect(() => {
    let cancel = false;
    api.top()
      .then((r) => {
        if (cancel) return;
        const players = r.data || [];
        setTrending(players);
        // Compute real avg PPG from top players' stats (parallel, cached on backend)
        Promise.all(players.map((p) => api.stats(p.id).catch(() => null)))
          .then((results) => {
            if (cancel) return;
            const ppgs = results
              .map((s) => s?.averages?.pts)
              .filter((v) => v != null);
            if (ppgs.length) {
              setAvgPpg(+(ppgs.reduce((a, b) => a + b, 0) / ppgs.length).toFixed(1));
            }
          });
      })
      .catch((e) => !cancel && setErr(e.message));
    return () => { cancel = true; };
  }, [tick]);

  // Reset + load first page whenever query changes
  useEffect(() => {
    let cancel = false;
    setPlayers(null);
    setCursor(null);
    api.search(query, '')
      .then((r) => {
        if (cancel) return;
        setPlayers(r.data || []);
        setCursor(r.next_cursor ?? null);
        setErr(null);
      })
      .catch((e) => !cancel && setErr(e.message));
    return () => { cancel = true; };
  }, [query]);

  const loadMore = useCallback(async () => {
    if (cursor == null || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await api.search(query, cursor);
      setPlayers((prev) => [...(prev || []), ...(r.data || [])]);
      setCursor(r.next_cursor ?? null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, query]);

  const totalShown = players?.length ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10">
      <Seo
        title="NBA Player Dashboard — Search Stats & Trends | CourtIQ"
        description="Search any NBA player and explore live averages, recent form, and trending players — powered by ESPN data."
        path="/app"
      />
      <div className="flex flex-wrap items-end justify-between gap-4 sm:gap-6">
        <div className="min-w-0">
          <span className="chip">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulseGlow" /> Live
          </span>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Browse every player · auto-refreshing trending every {REFRESH_MS / 1000}s
          </p>
        </div>
        <div className="relative w-full sm:w-auto">
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players or teams…"
            className="glass w-full sm:w-72 pl-10 pr-10 py-2.5 text-sm bg-transparent border-white/10 focus:border-primary/60 outline-none transition-colors"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" /></svg>
          <kbd className="hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 items-center rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 pointer-events-none">/</kbd>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Shown" value={totalShown || '—'} />
        <StatTile label="Avg PPG (Top 10)" value={avgPpg ?? '—'} accent="secondary" />
        <StatTile label="Teams" value="30" />
        <StatTile label="Live" value="ON" accent="secondary" />
      </div>

      {err && (
        <div className="mt-6 glass p-4 text-rose-300 border-rose-500/30">
          ⚠ {err} — showing cached or mock data.
        </div>
      )}

      {/* Trending */}
      {!query && (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">🔥 Trending</h2>
            <span className="text-xs text-slate-400">Curated · league-wide</span>
          </div>
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {trending
              ? trending.slice(0, 4).map((p, i) => <PlayerCard key={p.id} player={p} index={i} />)
              : Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </section>
      )}

      {/* All / search results */}
      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {query ? `Search: “${query}”` : 'All players'}
          </h2>
          {players && <span className="text-xs text-slate-400">{totalShown} shown</span>}
        </div>
        <motion.div layout className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {players
            ? players.map((p, i) => <PlayerCard key={p.id} player={p} index={i} />)
            : Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </motion.div>

        {players && players.length === 0 && (
          <p className="text-slate-400 text-sm mt-4">No players found for “{query}”.</p>
        )}

        {/* Load more */}
        {players && cursor != null && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="btn-ghost disabled:opacity-60"
            >
              {loadingMore ? 'Loading…' : 'Load more players'}
              {!loadingMore && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
