import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import playersRouter from './routes/players.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(morgan('tiny'));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'courtiq-api', time: new Date().toISOString() });
});

app.use('/api', playersRouter);

// Centralized error handler — never leaks stack in prod.
app.use((err, _req, res, _next) => {
  console.error('[courtiq]', err);
  res.status(500).json({ error: err.message || 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`🏀 CourtIQ API listening on :${PORT}`);
});
