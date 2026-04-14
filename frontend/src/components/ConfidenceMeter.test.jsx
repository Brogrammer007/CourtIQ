// @vitest-environment jsdom
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
