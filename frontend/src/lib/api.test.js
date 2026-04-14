import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './api.js';

// Mock global fetch with vi.stubGlobal so it's active before module load
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('api.props', () => {
  beforeEach(() => mockFetch.mockReset());

  it('calls the correct props endpoint', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ player: {}, props: {} }),
    });

    await api.props(3112335);

    expect(mockFetch).toHaveBeenCalledWith('/api/player/3112335/props');
  });

  it('throws when the endpoint returns a non-2xx status', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });

    await expect(api.props(999999)).rejects.toThrow('404');
  });
});

describe('api.defensiveMatchup', () => {
  beforeEach(() => mockFetch.mockReset());

  it('calls the correct matchup endpoint with both IDs', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ offender: {}, defender: {}, matchup_data: {} }),
    });

    await api.defensiveMatchup(3112335, 1631104);

    expect(mockFetch).toHaveBeenCalledWith('/api/player/3112335/matchup/1631104');
  });
});
