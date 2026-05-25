const rateLimit = require('express-rate-limit');

// Strict limiter for login — 5 attempts per 15 min, blocks brute force
// keyGenerator explícito: usa req.ip que respeita o 'trust proxy' configurado em app.js
// Sem isso, em produção atrás de proxy, todos os usuários compartilham o mesmo bucket
const keyGenerator = (req) => req.ip;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator,
  message: { error: 'Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// Limiter for register — 10 attempts per 15 min, stops account creation abuse
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter — 120 req/min, prevents scraping/DoS
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator,
  message: { error: 'Muitas requisições. Tente novamente em breve.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public menu endpoint — 60 req/min
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator,
  message: { error: 'Muitas requisições ao cardápio. Tente novamente em breve.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check — 30 req/min, evita fingerprinting/abuso
const healthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator,
  message: { error: 'Muitas requisições.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, loginLimiter, apiLimiter, publicLimiter, healthLimiter };
