import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import router from '../routes/players.js';

// Build a minimal Express app for testing
function makeApp() {
  const app = express();
  app.use('/api', router);
  return app;
}

async function get(app, path) {
  const http = await import('node:http');
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      http.get(`http://localhost:${port}${path}`, (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        });
      }).on('error', reject);
    });
  });
}

describe('GET /api/player/:id/props', () => {
  it('returns 200 with correct top-level shape for a valid player', async () => {
    const app = makeApp();
    const { status, body } = await get(app, '/api/player/3112335/props');

    assert.equal(status, 200);
    assert.ok('player' in body);
    assert.ok('props' in body);
    assert.ok('points' in body.props);
    assert.ok('rebounds' in body.props);
  });

  it('props.points contains required fields', async () => {
    const app = makeApp();
    const { body } = await get(app, '/api/player/3112335/props');
    const pts = body.props.points;

    assert.ok('odds_available' in pts);
    assert.ok('season_avg' in pts);
    assert.ok('home_avg' in pts);
    assert.ok('away_avg' in pts);
    assert.ok('hit_rate_over' in pts);
    assert.ok('confidence' in pts);
    assert.ok('score' in pts.confidence);
    assert.ok('tier' in pts.confidence);
    assert.ok('factors' in pts.confidence);
  });

  it('confidence score is a number between 0 and 100', async () => {
    const app = makeApp();
    const { body } = await get(app, '/api/player/3112335/props');
    const score = body.props.points.confidence.score;
    assert.ok(typeof score === 'number');
    assert.ok(score >= 0 && score <= 100);
  });

  it('returns 404 for unknown player id', async () => {
    const app = makeApp();
    const { status } = await get(app, '/api/player/999999999/props');
    assert.equal(status, 404);
  });
});
