import { motion } from 'framer-motion';

export default function StatTile({ label, value, accent = 'primary', suffix = '', trend }) {
  const accentCls =
    accent === 'secondary'
      ? 'from-secondary/30 to-secondary/5 text-secondary-soft'
      : 'from-primary/30 to-primary/5 text-primary-soft';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`glass p-4 bg-gradient-to-br ${accentCls} relative overflow-hidden`}
    >
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300/80">{label}</div>
      <div className="mt-1 text-3xl font-bold text-white tabular-nums">
        {value}
        {suffix && <span className="text-base font-medium text-slate-400 ml-1">{suffix}</span>}
      </div>
      {trend !== undefined && (
        <div className={`mt-1 text-xs ${trend > 0 ? 'text-emerald-300' : trend < 0 ? 'text-rose-300' : 'text-slate-400'}`}>
          {trend > 0 ? '▲' : trend < 0 ? '▼' : '•'} {Math.abs(trend).toFixed(1)} vs prev
        </div>
      )}
    </motion.div>
  );
}
