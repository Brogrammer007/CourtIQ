import { motion } from 'framer-motion';

const features = [
  {
    title: 'Player Analytics',
    desc: 'Track performance across every game with detailed stats and visual trends.',
    icon: (
      <path d="M4 19V5m0 14h16M8 15V9m4 6V7m4 8v-4" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    title: 'Smart Insights',
    desc: 'Understand player form with AI-style insights and performance indicators.',
    icon: (
      <path d="M12 3l1.9 4.4L18 9l-3.5 2.8L16 17l-4-2.5L8 17l1.5-5.2L6 9l4.1-1.6L12 3z" strokeLinejoin="round" />
    ),
  },
  {
    title: 'Player Comparison',
    desc: 'Compare players side-by-side with advanced metrics and radar breakdowns.',
    icon: (
      <path d="M7 4v16m10-16v16M4 8h6m4 8h6M4 16h6m4-8h6" strokeLinecap="round" />
    ),
  },
  {
    title: 'Predictions',
    desc: 'Get estimated performance and probability-based over/under insights.',
    icon: (
      <path d="M3 12a9 9 0 1018 0 9 9 0 00-18 0zm6 0l2 2 4-5" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
];

export default function Features() {
  return (
    <section id="features" className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <span className="chip">Platform</span>
          <h2 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight">
            Everything you need to <span className="gradient-text">decode the game</span>
          </h2>
          <p className="mt-4 text-slate-300">
            Purpose-built analytics that turn raw box scores into the kind of insight
            coaches, analysts, and fans actually use.
          </p>
        </div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="glass glass-hover p-6 relative overflow-hidden"
            >
              <div className="w-11 h-11 rounded-xl bg-grad-primary flex items-center justify-center shadow-glow">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" strokeWidth="2">
                  {f.icon}
                </svg>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              <div className="absolute -bottom-10 -right-10 w-28 h-28 rounded-full bg-secondary/20 blur-2xl opacity-60" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
