// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock api module
vi.mock('../lib/api.js', () => ({
  api: {
    props:            vi.fn(),
    search:           vi.fn(),
    defensiveMatchup: vi.fn(),
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

describe('PropsPage — matchup section', () => {
  beforeEach(() => {
    api.props.mockResolvedValue(MOCK_PROPS_RESPONSE);
    api.search.mockReset();
    api.defensiveMatchup.mockReset();
  });

  it('renders the defensive matchup section heading', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Nikola Jokic')).toBeInTheDocument());
    expect(screen.getByText(/defensive matchup/i)).toBeInTheDocument();
  });

  it('shows search results when typing a defender name', async () => {
    api.search.mockResolvedValue({
      data: [{ id: 1631104, first_name: 'Victor', last_name: 'Wembanyama', team: { full_name: 'Spurs' } }],
    });

    renderPage();
    await waitFor(() => screen.getByText('Nikola Jokic'));

    const input = screen.getByPlaceholderText(/search defender/i);
    fireEvent.change(input, { target: { value: 'Wemb' } });

    await waitFor(() =>
      expect(screen.getByText('Victor Wembanyama')).toBeInTheDocument()
    );
  });

  it('shows matchup data when Analyze is clicked', async () => {
    api.search.mockResolvedValue({
      data: [{ id: 1631104, first_name: 'Victor', last_name: 'Wembanyama', team: { full_name: 'Spurs' } }],
    });
    api.defensiveMatchup.mockResolvedValue({
      offender: { id: 3112335, name: 'Nikola Jokic' },
      defender: { id: 1631104, name: 'Victor Wembanyama' },
      matchup_data: {
        games_played: 3, partial_possessions: 42,
        pts_per_possession: 0.87, fg_pct_allowed: 0.461,
        def_reb_in_matchup: 8,
        sample_note: '42 possessions across 3 games',
      },
      vs_season_avg: { pts_diff_pct: -12.4, fg_pct_diff_pct: -8.7 },
      verdict: { label: 'Tough matchup', tone: 'down', emoji: '🧊' },
    });

    renderPage();
    await waitFor(() => screen.getByText('Nikola Jokic'));

    const input = screen.getByPlaceholderText(/search defender/i);
    fireEvent.change(input, { target: { value: 'Wemb' } });
    await waitFor(() => screen.getByText('Victor Wembanyama'));

    fireEvent.click(screen.getByText('Victor Wembanyama'));
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));

    await waitFor(() => expect(screen.getByText(/tough matchup/i)).toBeInTheDocument());
    expect(screen.getByText('42 possessions across 3 games')).toBeInTheDocument();
  });
});
