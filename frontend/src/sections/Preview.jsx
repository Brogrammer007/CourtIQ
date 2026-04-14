import { motion } from 'framer-motion';
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';

const bars = [
  { g: 'G1', pts: 24 }, { g: 'G2', pts: 31 }, { g: 'G3', pts: 28 },
  { g: 'G4', pts: 35 }, { g: 'G5', pts: 22 }, { g: 'G6', pts: 33 }, { g: 'G7', pts: 29 },
];
const radar = [
  { stat: 'PTS', A: 90, B: 78 },
  { stat: 'AST', A: 80, B: 65 },
  { stat: 'REB', A: 60, B: 88 },
  { stat: 'STL', A: 70, B: 62 },
  { stat: 'BLK', A: 45, B: 92 },
  { stat: 'FG%', A: 82, B: 75 },
];

export default function Preview() {
  return (
    <section id="preview" className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl mb-12">
          <span className="chip">Dashboard</span>
          <h2 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight">
            Your <span className="gradient-text">analytics cockpit</span>
          </h2>
          <p className="mt-4 text-slate-300">A premium, real-time view of players, trends, and predictions.</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="glass p-6 md:p-8 relative overflow-hidden"
        >
          {/* Mock toolbar */}
          <div className="flex items-center gap-2 mb-6">
            <span className="w-3 h-3 rounded-full bg-rose-400/70" />
            <span className="w-3 h-3 rounded-full bg-amber-400/70" />
            <span className="w-3 h-3 rounded-full bg-emerald-400/70" />
            <span className="ml-4 text-xs text-slate-400 font-mono">courtiq.app/dashboard</span>
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <div className="glass p-5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Points · Last 7 games</div>
                  <div className="mt-1 text-2xl font-bold">Stephen Curry</div>
                </div>
                <div className="chip">GSW · G</div>
              </div>
              <div className="mt-4 h-60">
                <ResponsiveContainer>
                  <BarChart data={bars}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8B5CF6" />
                        <stop offset="100%" stopColor="#22D3EE" />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="g" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={{ background: '#0B0F1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                    />
                    <Bar dataKey="pts" fill="url(#barGrad)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Comparison</div>
              <div className="mt-1 font-semibold">Curry vs Jokić</div>
              <div className="mt-2 h-56">
                <ResponsiveContainer>
                  <RadarChart data={radar}>
                    <PolarGrid stroke="rgba(255,255,255,0.12)" />
                    <PolarAngleAxis dataKey="stat" stroke="#94A3B8" fontSize={11} />
                    <PolarRadiusAxis stroke="transparent" />
                    <Radar dataKey="A" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.35} />
                    <Radar dataKey="B" stroke="#22D3EE" fill="#22D3EE" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {[
              { k: 'Avg PTS', v: '29.4', t: '+2.1' },
              { k: 'Avg AST', v: '6.8', t: '+0.5' },
              { k: 'FG%', v: '51.2%', t: '+1.3' },
              { k: 'Form', v: '92/100', t: '▲' },
            ].map((s) => (
              <div key={s.k} className="glass p-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{s.k}</div>
                <div className="mt-1 text-2xl font-bold">{s.v}</div>
                <div className="text-xs text-emerald-300 mt-1">{s.t}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
