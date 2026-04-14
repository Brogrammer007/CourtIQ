import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore.js';

function initials(p) {
  return `${p.first_name?.[0] ?? ''}${p.last_name?.[0] ?? ''}`.toUpperCase();
}

export default function PlayerCard({ player, index = 0 }) {
  const { isFavorite, toggleFavorite } = useStore();
  const fav = isFavorite(player.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.03 }}
      className="glass glass-hover p-5 relative overflow-hidden group"
    >
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-grad-primary opacity-[0.15] blur-2xl group-hover:opacity-30 transition-opacity" />
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-grad-primary flex items-center justify-center font-bold text-white shadow-glow">
          {initials(player)}
        </div>
        <div className="min-w-0 flex-1">
          <Link to={`/app/player/${player.id}`} className="block">
            <div className="font-semibold truncate hover:text-primary-soft transition-colors">
              {player.first_name} {player.last_name}
            </div>
            <div className="text-xs text-slate-400 truncate">
              {player.team?.full_name || '—'} · {player.position || 'N/A'}
            </div>
          </Link>
        </div>
        <button
          onClick={() => toggleFavorite(player.id)}
          aria-label={fav ? 'Remove favorite' : 'Add favorite'}
          className={`p-2 rounded-xl border transition-all ${
            fav
              ? 'bg-yellow-400/10 border-yellow-400/40 text-yellow-300 shadow-[0_0_25px_-8px_rgba(250,204,21,0.7)]'
              : 'border-white/10 text-slate-400 hover:text-yellow-300 hover:border-yellow-400/40'
          }`}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
            <path d="M12 3l2.8 6.1 6.7.8-5 4.7 1.4 6.7L12 17.9 6.1 21.3l1.4-6.7-5-4.7 6.7-.8L12 3z" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}
