import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import playersRouter from './routes/players.js';
import { loadAllEspnPlayers } from './services/espn.js';

const app  = express();
const PORT = process.env.PORT || 4000;

// Trust the first proxy (Railway / Render / Vercel edge) so req.ip is the real client IP
app.set('trust proxy', 1);

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(morgan('tiny'));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'courtiq-api', time: new Date().toISOString() });
});

// Rate limit /api/* — 60 req/min per IP. Health check is intentionally above and unlimited.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

app.use('/api', apiLimiter, playersRouter);

app.use((err, _req, res, _next) => {
  console.error('[courtiq]', err);
  res.status(500).json({ error: err.message || 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`🏀 CourtIQ API listening on :${PORT}`);
  // Pre-warm ESPN roster cache in background — first request will be instant
  loadAllEspnPlayers()
    .then((p) => console.log(`✓ ESPN roster ready (${p.length} players)`))
    .catch(() => console.warn('⚠ ESPN roster pre-warm failed — will retry on first request'));
});
