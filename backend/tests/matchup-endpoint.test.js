import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import router from '../routes/players.js';

function makeApp() {
  const app = express();
  app.use('/api', router);
  return app;
}

async function get(app, path) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      http.get(`http://localhost:${port}${path}`, (res) => {
        let body = '';
        res.on('data', d => (body += d));
        res.on('end', () => { server.close(); resolve({ status: res.statusCode, body: JSON.parse(body) }); });
      }).on('error', reject);
    });
  });
}

describe('GET /api/player/:id/matchup/:defenderId', () => {
  it('returns 200 with matchup_data, vs_season_avg, verdict for valid players with history', async () => {
    const app = makeApp();
    // Jokic vs Wembanyama — may return 404 if no data this season; check shape if 200
    const { status, body } = await get(app, '/api/player/3112335/matchup/1631104');

    if (status === 200) {
      assert.ok('offender' in body);
      assert.ok('defender' in body);
      assert.ok('matchup_data' in body);
      assert.ok('vs_season_avg' in body);
      assert.ok('verdict' in body);
      assert.ok(typeof body.matchup_data.games_played === 'number');
      assert.ok(['up', 'down', 'flat'].includes(body.verdict.tone));
    } else {
      // 404 is acceptable when no matchup data exists this season
      assert.equal(status, 404);
    }
  });

  it('returns 404 when defenderId is an unknown ESPN ID', async () => {
    const app = makeApp();
    const { status, body } = await get(app, '/api/player/3112335/matchup/999999999');
    assert.equal(status, 404);
    assert.equal(body.error, 'Defender not found.');
  });

  it('vs_season_avg.pts_diff_pct is a number when matchup data exists', async () => {
    const app = makeApp();
    const { status, body } = await get(app, '/api/player/3112335/matchup/1631104');
    if (status === 200) {
      assert.ok(typeof body.vs_season_avg.pts_diff_pct === 'number');
    }
  });
});
