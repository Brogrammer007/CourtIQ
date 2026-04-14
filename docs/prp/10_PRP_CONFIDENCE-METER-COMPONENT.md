# PRP-10 — ConfidenceMeter Component

## Goal
Create `frontend/src/components/ConfidenceMeter.jsx` — a reusable React component that renders a circular progress arc animating to the confidence score, a tier badge, and 4 factor rows with labels and mini progress bars.

## Why
This is the visual core of the props feature. Every prop card on `PropsPage` uses it. Building it as a standalone component with well-defined props makes it testable in isolation and reusable if confidence scores appear elsewhere.

---

## Codebase Context

| File | Relevant detail |
|------|-----------------|
| `frontend/src/components/StatTile.jsx` | Reference for glassmorphism card pattern. Uses `.glass` class and Tailwind. |
| `frontend/src/components/Skeleton.jsx` | Reference for loading states. |
| Design system | Background: `#0B0F1A`. Cards: `.glass`. Primary: `#8B5CF6`. Secondary: `#22D3EE`. Font: Inter. |
| Animations | Framer Motion already installed. Use `motion` components + `animate` prop. |

**Component API:**
```jsx
<ConfidenceMeter
  score={74}
  tier="medium"
  factors={{
    hit_rate:  { score: 80, label: "Hit 12/15 games over line" },
    form:      { score: 85, label: "Trending up +3.2 PTS" },
    home_away: { score: 65, label: "Away game, avg 27.8 vs line 28.5" },
    matchup:   { score: 58, label: "Avg matchup difficulty" },
  }}
/>
```

**Tier → color mapping:**
| Tier | Arc color | Badge color |
|------|-----------|-------------|
| `high` | `#22c55e` (green-500) | `text-emerald-300` |
| `medium` | `#eab308` (yellow-500) | `text-yellow-300` |
| `low` | `#f97316` (orange-500) | `text-orange-300` |
| `against` | `#ef4444` (red-500) | `text-rose-300` |

**SVG arc formula:**
- Circle: `cx=60 cy=60 r=52`, circumference = `2π × 52 ≈ 326.7`
- Arc fill = `(score / 100) × circumference`
- `strokeDasharray={circumference}`, `strokeDashoffset` animates from `circumference` to `circumference - fill`
- Use `stroke-linecap: round`

**Gotcha — `strokeDashoffset` animation direction:** Start at full offset (empty circle), animate to `circumference * (1 - score/100)`.

**Gotcha — factor label key names:** `hit_rate`, `form`, `home_away`, `matchup` — display as "Hit Rate", "Form", "Home/Away", "Matchup".

**Gotcha — `factors` may be undefined** during loading. Guard with optional chaining.

---

## Dependencies
- **PRP-09** complete (vitest setup for frontend)

---

## Files to Create

| File | Change type |
|------|-------------|
| `frontend/src/components/ConfidenceMeter.jsx` | NEW |
| `frontend/src/components/ConfidenceMeter.test.jsx` | NEW |

---

## TDD Cycle

### Step 1 — RED: Create `frontend/src/components/ConfidenceMeter.test.jsx`

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConfidenceMeter from './ConfidenceMeter.jsx';

const mockFactors = {
  hit_rate:  { score: 80, label: 'Hit 12/15 games over line' },
  form:      { score: 85, label: 'Trending up +3.2 PTS' },
  home_away: { score: 65, label: 'Away game, avg 27.8 vs line 28.5' },
  matchup:   { score: 58, label: 'Avg matchup difficulty' },
};

describe('ConfidenceMeter', () => {
  it('renders the composite score', () => {
    render(<ConfidenceMeter score={74} tier="medium" factors={mockFactors} />);
    expect(screen.getByText('74%')).toBeInTheDocument();
  });

  it('renders all four factor labels', () => {
    render(<ConfidenceMeter score={74} tier="medium" factors={mockFactors} />);
    expect(screen.getByText('Hit 12/15 games over line')).toBeInTheDocument();
    expect(screen.getByText('Trending up +3.2 PTS')).toBeInTheDocument();
    expect(screen.getByText('Away game, avg 27.8 vs line 28.5')).toBeInTheDocument();
    expect(screen.getByText('Avg matchup difficulty')).toBeInTheDocument();
  });

  it('renders tier badge text', () => {
    render(<ConfidenceMeter score={74} tier="medium" factors={mockFactors} />);
    expect(screen.getByText(/medium/i)).toBeInTheDocument();
  });

  it('renders "High" tier badge for score >= 80', () => {
    render(<ConfidenceMeter score={85} tier="high" factors={mockFactors} />);
    expect(screen.getByText(/high/i)).toBeInTheDocument();
  });

  it('does not crash when factors is undefined', () => {
    expect(() =>
      render(<ConfidenceMeter score={50} tier="low" factors={undefined} />)
    ).not.toThrow();
  });

  it('renders SVG circle element', () => {
    const { container } = render(<ConfidenceMeter score={74} tier="medium" factors={mockFactors} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('circle')).toBeInTheDocument();
  });
});
```

### Step 2 — Verify RED
```bash
cd frontend && npm test
```
**Expected failure:**
```
Cannot find module './ConfidenceMeter.jsx'
```

### Step 3 — GREEN: Create `frontend/src/components/ConfidenceMeter.jsx`

```jsx
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
```

### Step 4 — Verify GREEN
```bash
cd frontend && npm test
```
**Expected — all 6 tests pass.**

### Step 5 — REFACTOR
`CircleArc` and `FactorRow` are clean subcomponents. Extract to separate files only if they grow larger.

---

## Full Validation
Start dev server and navigate to a page that renders `<ConfidenceMeter>`:
```bash
cd frontend && npm run dev
```
Visual checks:
- Arc fills from empty to score on mount
- Color matches tier
- All 4 factor bars animate in
- Score centered in circle

---

## Error Patterns

| Error | Cause | Fix |
|-------|-------|-----|
| `framer-motion` animation not working in tests | jsdom doesn't support CSS animations | Tests check DOM presence, not animation values — correct behavior |
| `CIRCUMFERENCE * (1 - undefined / 100)` = NaN | `score` prop is undefined | Guard: `score ?? 50` in `CircleArc` call |
| Factor rows not rendering | `Object.entries(FACTOR_LABELS)` key not in `factors` | `if (!f) return null` guard handles this |

---

## Acceptance Criteria
- [ ] Renders composite score as `{score}%` inside SVG circle
- [ ] Renders tier badge (High / Medium / Low / Against)
- [ ] Renders all 4 factor rows with label text and score
- [ ] Does not throw when `factors` is `undefined`
- [ ] SVG `circle` element is present in DOM
- [ ] Arc color matches tier (green/yellow/orange/red)
- [ ] Framer Motion animations applied (arc + bars)
- [ ] All 6 vitest tests pass
