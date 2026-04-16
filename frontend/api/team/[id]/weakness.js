import { cached } from '../../_lib/cache.js';
import { getTeam, teamDefensiveProfile } from '../../_lib/balldontlie.js';
import { teamWeaknessInsight } from '../../_lib/analytics.js';

const TTL = Number(process.env.CACHE_TTL_SECONDS || 60);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { id } = req.query;
    const result = await cached(`weakness:${id}`, TTL, async () => {
      const team = await getTeam(id);
      if (!team) return { error: 'team_not_found' };
      const profile = teamDefensiveProfile(id);
      const weakness = teamWeaknessInsight(profile);
      return { team, profile, weakness };
    });
    if (result?.error) return res.status(404).json({ error: 'Team not found' });
    res.json(result);
  } catch (err) {
    console.error('[courtiq/team/[id]/weakness]', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}
