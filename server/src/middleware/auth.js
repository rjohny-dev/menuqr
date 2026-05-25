const jwt = require('jsonwebtoken');
const pool = require('../db');
const securityLogger = require('./securityLogger');

module.exports = async (req, res, next) => {
  let token = req.cookies?.token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    securityLogger.authFailed(req, 'no_token');
    return res.status(401).json({ error: 'Autenticação necessária' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    securityLogger.authFailed(req, err.name === 'TokenExpiredError' ? 'token_expired' : 'token_invalid');
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  // Verificar se o token foi revogado via logout (blocklist por JTI)
  // Requer tabela token_blocklist — ver migration manual
  if (decoded.jti) {
    try {
      const blocked = await pool.query(
        'SELECT 1 FROM token_blocklist WHERE jti = $1 AND expires_at > NOW()',
        [decoded.jti]
      );
      if (blocked.rows.length > 0) {
        securityLogger.authFailed(req, 'token_revoked');
        return res.status(401).json({ error: 'Sessão encerrada. Faça login novamente.' });
      }
    } catch {
      // Se a tabela ainda não existe (ambiente dev sem migration), continuar sem bloquear
      // Em produção, a migration deve ser aplicada antes do deploy
    }
  }

  req.user = decoded;
  next();
};
