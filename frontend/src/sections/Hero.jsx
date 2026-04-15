import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer, AreaChart, Area } from 'recharts';

const float1 = [
  { x: 0, y: 12 }, { x: 1, y: 18 }, { x: 2, y: 14 }, { x: 3, y: 22 },
  { x: 4, y: 28 }, { x: 5, y: 24 }, { x: 6, y: 32 }, { x: 7, y: 30 },
];
const float2 = [
  { x: 0, y: 40 }, { x: 1, y: 36 }, { x: 2, y: 48 }, { x: 3, y: 44 },
  { x: 4, y: 52 }, { x: 5, y: 60 }, { x: 6, y: 56 }, { x: 7, y: 64 },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* animated gradient orbs */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-20 left-1/4 w-[520px] h-[520px] rounded-full bg-primary/20 blur-[120px] animate-pulseGlow" />
        <div className="absolute top-40 right-1/4 w-[440px] h-[440px] rounded-full bg-secondary/20 blur-[120px] animate-pulseGlow" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-20 pb-28 grid lg:grid-cols-2 gap-12 items-center">
        {/* Left: copy */}
        <div>
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="chip"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulseGlow" />
            Live NBA Analytics
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mt-5 text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]"
          >
            Unlock the <span className="gradient-text">Game</span> Behind the Game
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="mt-5 text-lg text-slate-300 max-w-xl"
          >
            Analyze NBA players with powerful insights, real-time trends, and smart
            predictions — all in one platform.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link to="/app" className="btn-primary">
              Get Started
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
            <Link to="/app" className="btn-ghost">View Demo</Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-10 flex items-center gap-6 text-xs text-slate-400"
          >
            <div><span className="text-white font-semibold">500+</span> active players tracked</div>
            <div className="w-px h-4 bg-white/10" />
            <div><span className="text-white font-semibold">30</span> NBA franchises</div>
            <div className="w-px h-4 bg-white/10" />
            <div><span className="text-white font-semibold">Live</span> data refresh</div>
          </motion.div>
        </div>

        {/* Right: floating dashboard preview */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative"
        >
          <div className="glass p-6 shadow-glow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Player · Last 7 Games</div>
                <div className="mt-1 font-semibold text-lg">Luka Dončić <span className="text-secondary-soft text-sm">DAL · G</span></div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold gradient-text tabular-nums">31.8</div>
                <div className="text-[11px] text-slate-400">PPG · trending ▲</div>
              </div>
            </div>
            <div className="mt-5 h-40">
              <ResponsiveContainer>
                <AreaChart data={float2}>
                  <defs>
                    <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#22D3EE" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="y" stroke="#22D3EE" strokeWidth={2.5} fill="url(#heroGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { k: 'PTS', v: '31.8' },
                { k: 'AST', v: '8.4' },
                { k: 'REB', v: '7.0' },
              ].map((s) => (
                <div key={s.k} className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 text-center">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{s.k}</div>
                  <div className="mt-0.5 text-xl font-bold">{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* floating mini cards */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -left-6 -bottom-16 glass p-4 w-52 shadow-glowCyan"
          >
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Form Index</div>
            <div className="text-2xl font-bold gradient-text mt-1">92 / 100</div>
            <div className="mt-2 h-8">
              <ResponsiveContainer>
                <LineChart data={float1}>
                  <Line type="monotone" dataKey="y" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -right-4 -top-4 glass p-4 w-44"
          >
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Over 25.5 PTS</div>
            <div className="text-2xl font-bold text-emerald-300 mt-1">74%</div>
            <div className="text-[11px] text-slate-400 mt-1">Next game probability</div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
