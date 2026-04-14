// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../lib/api.js', () => ({
  api: {
    player: vi.fn(),
    stats:  vi.fn(),
    teams:  vi.fn().mockResolvedValue({ data: [] }),
    vsTeam: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

import { api } from '../lib/api.js';
import PlayerPage from './PlayerPage.jsx';

const MOCK_PLAYER = {
  data: {
    id: 3112335, first_name: 'Nikola', last_name: 'Jokic',
    position: 'C', height: '6\'11"', weight: '284',
    team: { id: 7, full_name: 'Denver Nuggets', abbreviation: 'DEN' },
  },
};

const MOCK_STATS = {
  data: [],
  averages: { pts: 29.1, reb: 13.1, ast: 8.3, fg_pct: 0.583, fg3_pct: 0.359 },
  trend: { direction: 'up', delta: 2.1, form: 78 },
  prediction: { expected_points: 30.2, line: 25.5, over_probability: 72, under_probability: 28 },
};

function renderPlayerPage(id = '3112335') {
  return render(
    <MemoryRouter initialEntries={[`/player/${id}`]}>
      <Routes>
        <Route path="/player/:id" element={<PlayerPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PlayerPage — props button', () => {
  beforeEach(() => {
    api.player.mockResolvedValue(MOCK_PLAYER);
    api.stats.mockResolvedValue(MOCK_STATS);
  });

  it('renders a "Props & Confidence" link button', async () => {
    renderPlayerPage();
    await waitFor(() => screen.getByText('Nikola Jokic'));
    const link = screen.getByRole('link', { name: /props/i });
    expect(link).toBeInTheDocument();
  });

  it('the props link points to /player/:id/props', async () => {
    renderPlayerPage();
    await waitFor(() => screen.getByText('Nikola Jokic'));
    const link = screen.getByRole('link', { name: /props/i });
    expect(link).toHaveAttribute('href', '/player/3112335/props');
  });
});
