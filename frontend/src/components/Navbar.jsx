import { Link, NavLink, useLocation } from 'react-router-dom';
import Logo from './Logo.jsx';

const appLinks = [
  { to: '/app', label: 'Dashboard', end: true },
  { to: '/app/favorites', label: 'Favorites' },
  { to: '/app/compare', label: 'Compare' },
  { to: '/app/predictions', label: 'Predictions' },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const inApp = pathname.startsWith('/app');

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-bg/60 border-b border-white/[0.06]">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Logo />
        </Link>

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
            <>
              <a href="#features" className="px-3.5 py-2 rounded-xl text-sm text-slate-300 hover:text-white">Features</a>
              <a href="#preview" className="px-3.5 py-2 rounded-xl text-sm text-slate-300 hover:text-white">Preview</a>
              <a href="#cta" className="px-3.5 py-2 rounded-xl text-sm text-slate-300 hover:text-white">Get Started</a>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {inApp ? (
            <Link to="/" className="btn-ghost hidden sm:inline-flex">Landing</Link>
          ) : (
            <>
              <Link to="/app" className="btn-ghost hidden sm:inline-flex">View Demo</Link>
              <Link to="/app" className="btn-primary">Get Started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
