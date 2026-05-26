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
    } catch (err) {
      // 42P01 = "undefined_table" — tabela ainda não foi criada (ambiente dev sem migration)
      // Qualquer outro erro de banco (timeout, pool esgotado, etc.) falha de forma segura:
      // rejeita a requisição em vez de deixar um token revogado passar.
      if (err.code !== '42P01') {
        securityLogger.authFailed(req, 'blocklist_check_failed');
        return res.status(503).json({ error: 'Serviço temporariamente indisponível. Tente novamente.' });
      }
    }
  }

  req.user = decoded;
  next();
};
