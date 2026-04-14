/**
 * Standalone verification script for PRP-09.
 * Uses node:test (same as backend) to avoid vitest TTY issues in non-interactive environments.
 * The vitest api.test.js is the canonical test — this script just verifies the logic.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = readFileSync(path.join(__dirname, 'api.js'), 'utf8')
  // Replace import.meta.env with a plain object so it runs in Node without Vite
  .replace(/import\.meta\.env/g, '({ VITE_API_BASE: undefined })');

// ---- mock fetch ----
let capturedUrl = null;
let mockOk = true;

globalThis.fetch = async (url) => {
  capturedUrl = url;
  if (!mockOk) return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) };
  return { ok: true, json: async () => ({}) };
};

// Load the patched module via data: URL (Node 18+ supports this)
const encoded = encodeURIComponent(apiSrc);
const { api } = await import(`data:text/javascript;charset=utf-8,${encoded}`);

// ---- tests ----
test('api.props — calls correct endpoint', async () => {
  mockOk = true;
  capturedUrl = null;
  await api.props(3112335);
  assert.equal(capturedUrl, '/api/player/3112335/props');
});

test('api.props — throws on non-2xx', async () => {
  mockOk = false;
  await assert.rejects(() => api.props(999999), /404/);
  mockOk = true;
});

test('api.defensiveMatchup — calls correct endpoint', async () => {
  capturedUrl = null;
  await api.defensiveMatchup(3112335, 1631104);
  assert.equal(capturedUrl, '/api/player/3112335/matchup/1631104');
});
