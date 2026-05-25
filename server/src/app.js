const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const restaurantRoutes = require('./routes/restaurant');
const categoriesRoutes = require('./routes/categories');
const itemsRoutes = require('./routes/items');
const publicRoutes = require('./routes/public');
const uploadRoutes = require('./routes/upload');
const { apiLimiter, healthLimiter } = require('./middleware/rateLimiter');

const app = express();

// ─── Trust proxy (Render / Heroku / qualquer reverse proxy de 1 nível) ───────
// Sem isso, req.ip = '127.0.0.1' para todos, quebrando o rate limiter em prod
app.set('trust proxy', 1);

// ─── Security headers (Helmet) ─────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // unsafe-inline removido — usar arquivos CSS externos
      styleSrc: ["'self'"],
      // imgSrc restrito a CDNs conhecidos + data URIs; remover 'https:' genérico
      imgSrc: [
        "'self'",
        'data:',
        'https://res.cloudinary.com',
        'https://i.imgur.com',
        'https://images.unsplash.com',
        // R2 public URL (custom domain ou *.r2.dev)
        ...(process.env.R2_PUBLIC_URL
          ? [new URL(process.env.R2_PUBLIC_URL).origin]
          : []),
      ],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ─── CORS ──────────────────────────────────────────────────────────────────────
// CLIENT_URL aceita múltiplas origens separadas por vírgula
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean);

// CORS_ORIGIN_REGEX permite padrões extras (ex: preview deployments do Vercel)
const originRegex = process.env.CORS_ORIGIN_REGEX
  ? new RegExp(process.env.CORS_ORIGIN_REGEX)
  : null;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Playwright driver)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (originRegex && originRegex.test(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' não permitida`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body parsing with size limits ────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ─── Global rate limit ────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/menu', publicRoutes);

app.get('/api/health', healthLimiter, (req, res) => res.json({ status: 'ok' }));

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message });
  }
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

module.exports = app;
