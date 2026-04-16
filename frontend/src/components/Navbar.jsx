import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Logo from './Logo.jsx';

const appLinks = [
  { to: '/app', label: 'Dashboard', end: true },
  { to: '/app/favorites', label: 'Favorites' },
  { to: '/app/compare', label: 'Compare' },
  { to: '/app/predictions', label: 'Predictions' },
];

const landingLinks = [
  { href: '#features', label: 'Features' },
  { href: '#preview', label: 'Preview' },
  { href: '#cta', label: 'Get Started' },
];

export default function Navbar() {
  const { pathname, hash } = useLocation();
  const inApp = pathname.startsWith('/app');
  const [open, setOpen] = useState(false);

  // Close menu on route change
  useEffect(() => { setOpen(false); }, [pathname, hash]);

  // Prevent background scroll while menu is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-bg/60 border-b border-white/[0.06]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <Logo />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {inApp ? (
            appLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-white bg-white/[0.08]'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))
          ) : (
            landingLinks.map((l) => (
              <a key={l.href} href={l.href} className="px-3.5 py-2 rounded-xl text-sm text-slate-300 hover:text-white">
                {l.label}
              </a>
            ))
          )}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          {inApp ? (
            <Link to="/" className="btn-ghost">Landing</Link>
          ) : (
            <>
              <Link to="/app" className="btn-ghost">View Demo</Link>
              <Link to="/app" className="btn-primary">Get Started</Link>
            </>
          )}
        </div>

        {/* Mobile: primary CTA (compact) + hamburger */}
        <div className="md:hidden flex items-center gap-2">
          {!inApp && (
            <Link to="/app" className="btn-primary !px-4 !py-2 text-xs">Get Started</Link>
          )}
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="w-10 h-10 rounded-xl border border-white/10 bg-white/[0.04] flex items-center justify-center text-slate-200 hover:bg-white/[0.08]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {open ? (
                <path d="M6 6l12 12M6 18L18 6" />
              ) : (
                <>
                  <path d="M3 6h18" />
                  <path d="M3 12h18" />
                  <path d="M3 18h18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="md:hidden border-t border-white/[0.06] bg-bg/95 backdrop-blur-xl"
          >
            <nav className="mx-auto max-w-7xl px-4 py-4 flex flex-col gap-1">
              {inApp
                ? appLinks.map((l) => (
                    <NavLink
                      key={l.to}
                      to={l.to}
                      end={l.end}
                      className={({ isActive }) =>
                        `px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                          isActive
                            ? 'text-white bg-white/[0.08]'
                            : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                        }`
                      }
                    >
                      {l.label}
                    </NavLink>
                  ))
                : landingLinks.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      className="px-4 py-3 rounded-xl text-sm text-slate-300 hover:text-white hover:bg-white/[0.04]"
                    >
                      {l.label}
                    </a>
                  ))}

              <div className="mt-2 pt-3 border-t border-white/[0.06] flex items-center gap-2">
                {inApp ? (
                  <Link to="/" className="btn-ghost w-full">Landing</Link>
                ) : (
                  <>
                    <Link to="/app" className="btn-ghost flex-1">View Demo</Link>
                    <Link to="/app" className="btn-primary flex-1">Get Started</Link>
                  </>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
