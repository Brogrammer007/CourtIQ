// Dynamic imports so we can pinpoint any hang during loading
const start = Date.now();

console.log('[boot] starting...');

const { default: dotenv } = await import('dotenv');
dotenv.config();
console.log('[boot] dotenv OK', Date.now() - start, 'ms');

const { default: express } = await import('express');
console.log('[boot] express OK', Date.now() - start, 'ms');

const { default: cors }   = await import('cors');
const { default: morgan } = await import('morgan');
console.log('[boot] cors+morgan OK', Date.now() - start, 'ms');

const { default: playersRouter } = await import('./routes/players.js');
console.log('[boot] routes OK', Date.now() - start, 'ms');

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(morgan('tiny'));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'courtiq-api', time: new Date().toISOString() });
});

app.use('/api', playersRouter);

app.use((err, _req, res, _next) => {
  console.error('[courtiq]', err);
  res.status(500).json({ error: err.message || 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`🏀 CourtIQ API listening on :${PORT}`);
});
