export default function Logo({ className = 'h-8 w-auto', showWordmark = true }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden="true">
        <defs>
          <linearGradient id="lg-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
          <filter id="lg-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#lg-glow)">
          <circle cx="22" cy="22" r="16" fill="none" stroke="url(#lg-grad)" strokeWidth="2.5" />
          <path d="M22 6 V38" stroke="url(#lg-grad)" strokeWidth="2" strokeLinecap="round" />
          <path d="M6 22 H38" stroke="url(#lg-grad)" strokeWidth="2" strokeLinecap="round" />
          <path d="M9 9 Q22 22 35 35" stroke="url(#lg-grad)" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.7" />
          <path d="M32 32 L44 44" stroke="url(#lg-grad)" strokeWidth="3.5" strokeLinecap="round" />
        </g>
      </svg>
      {showWordmark && (
        <span className="text-xl font-extrabold tracking-tight text-slate-100">
          Court<span className="gradient-text">IQ</span>
        </span>
      )}
    </div>
  );
}
