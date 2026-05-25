// req.ip já resolve o IP real quando 'trust proxy' está configurado em app.js
// Não ler X-Forwarded-For diretamente — pode ser spoofado pelo cliente
const getIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

const log = (event, data = {}) => {
  const entry = { timestamp: new Date().toISOString(), event, ...data };
  console.log('[SECURITY]', JSON.stringify(entry));
};

const securityLogger = {
  loginFailed: (req, email) =>
    log('LOGIN_FAILED', { email: email?.toLowerCase(), ip: getIp(req), ua: req.headers['user-agent'] }),

  loginSuccess: (req, userId) =>
    log('LOGIN_SUCCESS', { userId, ip: getIp(req) }),

  registerSuccess: (req, userId, email) =>
    log('REGISTER_SUCCESS', { userId, email: email?.toLowerCase(), ip: getIp(req) }),

  authFailed: (req, reason) =>
    log('AUTH_FAILED', { reason, ip: getIp(req), path: req.originalUrl }),

  suspiciousActivity: (req, description, extra = {}) =>
    log('SUSPICIOUS', { description, ip: getIp(req), path: req.originalUrl, ...extra }),

  logoutSuccess: (req, userId) =>
    log('LOGOUT', { userId, ip: getIp(req) }),
};

module.exports = securityLogger;
