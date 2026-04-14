import { motion } from 'framer-motion';

const TIER_COLORS = {
  high:    { arc: '#22c55e', badge: 'text-emerald-300', bg: 'bg-emerald-400/10 border-emerald-400/30' },
  medium:  { arc: '#eab308', badge: 'text-yellow-300',  bg: 'bg-yellow-400/10 border-yellow-400/30'  },
  low:     { arc: '#f97316', badge: 'text-orange-300',  bg: 'bg-orange-400/10 border-orange-400/30'  },
  against: { arc: '#ef4444', badge: 'text-rose-300',    bg: 'bg-rose-400/10 border-rose-400/30'      },
};

const FACTOR_LABELS = {
  hit_rate:  'Hit Rate',
  form:      'Form',
  home_away: 'Home / Away',
  matchup:   'Matchup',
};

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function CircleArc({ score, color }) {
  const offset = CIRCUMFERENCE * (1 - score / 100);
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="block mx-auto">
      {/* Track */}
      <circle
        cx="60" cy="60" r={RADIUS}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="10"
      />
      {/* Animated arc */}
      <motion.circle
        cx="60" cy="60" r={RADIUS}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        initial={{ strokeDashoffset: CIRCUMFERENCE }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: 'easeOut' }}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '60px 60px' }}
      />
    </svg>
  );
}

function FactorRow({ label, score, color }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs text-slate-300 w-7 text-right tabular-nums">{score}</span>
    </div>
  );
}

export default function ConfidenceMeter({ score, tier, factors }) {
  const colors = TIER_COLORS[tier] ?? TIER_COLORS.low;
  const tierLabel = tier
    ? tier.charAt(0).toUpperCase() + tier.slice(1)
    : 'N/A';

  return (
    <div className="space-y-4">
      {/* Circle + score */}
      <div className="relative">
        <CircleArc score={score ?? 50} color={colors.arc} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums">{score ?? '—'}%</span>
          <span className={`text-[10px] uppercase tracking-widest mt-0.5 ${colors.badge}`}>
            {tierLabel}
          </span>
        </div>
      </div>

      {/* Factor rows */}
      {factors && (
        <div className="space-y-2.5">
          {Object.entries(FACTOR_LABELS).map(([key, label]) => {
            const f = factors[key];
            if (!f) return null;
            return (
              <div key={key} className="space-y-1">
                <FactorRow label={label} score={f.score} color={colors.arc} />
                <p className="text-[10px] text-slate-500 pl-[calc(6rem+0.75rem)]">{f.label}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
