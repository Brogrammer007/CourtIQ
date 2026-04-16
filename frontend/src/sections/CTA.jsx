import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function CTA() {
  return (
    <section id="cta" className="relative py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative rounded-2xl overflow-hidden p-8 sm:p-10 md:p-16 text-center border border-white/10 shadow-glow"
          style={{
            background:
              'radial-gradient(600px 300px at 20% 0%, rgba(139,92,246,0.35), transparent 60%), radial-gradient(600px 300px at 100% 100%, rgba(34,211,238,0.30), transparent 60%), #0D1220',
          }}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Start analyzing <span className="gradient-text">like a pro</span>
          </h2>
          <p className="mt-4 text-slate-300 max-w-2xl mx-auto">
            Join CourtIQ and turn raw stats into winning insights.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/app" className="btn-primary text-base px-7 py-3">
              Launch App
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
