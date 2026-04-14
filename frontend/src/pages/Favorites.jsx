import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useStore } from '../store/useStore.js';
import PlayerCard from '../components/PlayerCard.jsx';
import { SkeletonCard } from '../components/Skeleton.jsx';

export default function Favorites() {
  const favorites = useStore((s) => s.favorites);
  const [players, setPlayers] = useState(null);

  useEffect(() => {
    let cancel = false;
    if (!favorites.length) { setPlayers([]); return; }
    Promise.all(favorites.map((id) => api.player(id).then((r) => r.data).catch(() => null)))
      .then((res) => { if (!cancel) setPlayers(res.filter(Boolean)); });
    return () => { cancel = true; };
  }, [favorites]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div>
        <span className="chip">Saved</span>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">⭐ Favorites</h1>
        <p className="text-slate-400 mt-1 text-sm">Stored locally · persists across sessions</p>
      </div>

      {!players ? (
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : players.length === 0 ? (
        <div className="mt-10 glass p-10 text-center">
          <p className="text-slate-300">No favorites yet.</p>
          <p className="text-sm text-slate-500 mt-1">Star players from the dashboard to add them here.</p>
          <Link to="/app" className="btn-primary mt-6 inline-flex">Browse players</Link>
        </div>
      ) : (
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {players.map((p, i) => <PlayerCard key={p.id} player={p} index={i} />)}
        </div>
      )}
    </div>
  );
}
