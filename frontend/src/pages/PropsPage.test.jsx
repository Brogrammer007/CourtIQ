// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock api module
vi.mock('../lib/api.js', () => ({
  api: {
    props: vi.fn(),
  },
}));

import { api } from '../lib/api.js';
import PropsPage from './PropsPage.jsx';

const MOCK_PROPS_RESPONSE = {
  player: { id: 3112335, name: 'Nikola Jokic', archetype: 'big' },
  next_game: { opponent_id: 21, opponent_name: 'San Antonio Spurs', is_home: false },
  props: {
    points: {
      line: 28.5, over_odds: -115, under_odds: -105, odds_available: true,
      season_avg: 29.1, home_avg: 30.4, away_avg: 27.8,
      home_games: 18, away_games: 17,
      hit_rate_over: 67, hit_rate_sample: 15,
      confidence: {
        score: 74, tier: 'medium',
        factors: {
          hit_rate:  { score: 80, label: 'Hit 12/15 games over line' },
          form:      { score: 85, label: 'Trending up +3.2 PTS' },
          home_away: { score: 65, label: 'Away game, avg 27.8 vs line 28.5' },
          matchup:   { score: 58, label: 'Avg matchup difficulty' },
        },
      },
    },
    rebounds: {
      line: 12.5, over_odds: -110, under_odds: -110, odds_available: true,
      season_avg: 13.1, home_avg: 13.8, away_avg: 12.4,
      home_games: 18, away_games: 17,
      hit_rate_over: 60, hit_rate_sample: 15,
      confidence: {
        score: 58, tier: 'low',
        factors: {
          hit_rate:  { score: 60, label: 'Hit 9/15 games over line' },
          form:      { score: 70, label: 'Trending flat, form 65/100' },
          home_away: { score: 50, label: 'Away game, avg 12.4 vs line 12.5' },
          matchup:   { score: 48, label: 'Avg matchup difficulty' },
        },
      },
    },
  },
};

function renderPage(id = '3112335') {
  return render(
    <MemoryRouter initialEntries={[`/player/${id}/props`]}>
      <Routes>
        <Route path="/player/:id/props" element={<PropsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PropsPage', () => {
  beforeEach(() => api.props.mockReset());

  it('renders player name after data loads', async () => {
    api.props.mockResolvedValue(MOCK_PROPS_RESPONSE);
    renderPage();
    await waitFor(() => expect(screen.getByText('Nikola Jokic')).toBeInTheDocument());
  });

  it('renders POINTS prop card with line and odds', async () => {
    api.props.mockResolvedValue(MOCK_PROPS_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('28.5')).toBeInTheDocument();
      expect(screen.getByText('-115')).toBeInTheDocument();
    });
  });

  it('renders REBOUNDS prop card', async () => {
    api.props.mockResolvedValue(MOCK_PROPS_RESPONSE);
    renderPage();
    await waitFor(() => expect(screen.getByText('12.5')).toBeInTheDocument());
  });

  it('shows "No live odds" badge when odds_available is false', async () => {
    const noOdds = JSON.parse(JSON.stringify(MOCK_PROPS_RESPONSE));
    noOdds.props.points.odds_available = false;
    noOdds.props.points.line = null;
    api.props.mockResolvedValue(noOdds);
    renderPage();
    await waitFor(() => expect(screen.getByText(/no live odds/i)).toBeInTheDocument());
  });

  it('shows error message when API fails', async () => {
    api.props.mockRejectedValue(new Error('404 Not Found'));
    renderPage();
    await waitFor(() => expect(screen.getByText(/404/i)).toBeInTheDocument());
  });

  it('renders a back link to the player page', async () => {
    api.props.mockResolvedValue(MOCK_PROPS_RESPONSE);
    renderPage();
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /back/i });
      expect(link).toHaveAttribute('href', '/player/3112335');
    });
  });
});
