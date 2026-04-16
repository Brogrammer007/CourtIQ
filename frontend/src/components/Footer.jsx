import Logo from './Logo.jsx';

export default function Footer() {
  return (
    <footer className="mt-16 sm:mt-24 border-t border-white/[0.06]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10 flex flex-col md:flex-row items-center justify-between gap-5 md:gap-6 text-center md:text-left">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-xs text-slate-500">Where Data Meets the Game</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:gap-6 text-sm text-slate-400">
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#preview" className="hover:text-white">Preview</a>
          <a href="https://www.balldontlie.io/" target="_blank" rel="noreferrer" className="hover:text-white">Data</a>
          <a href="#cta" className="hover:text-white">Launch</a>
        </nav>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} CourtIQ. All rights reserved.</p>
      </div>
    </footer>
  );
}
