const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');
const securityLogger = require('../middleware/securityLogger');

const BCRYPT_ROUNDS = 12;
const TOKEN_EXPIRY = '2h';

// Hash real pré-computado (60 chars válidos) para prevenir timing attack
// quando o email não existe — garante que bcrypt.compare() leva o mesmo tempo
const DUMMY_HASH = '$2a$12$dpON0CCVF2PN9oeX8o1icOWjSaCaSKJIHew7Ava5a3ZliH7jjFlEe';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  // 'none' obrigatório em prod: frontend (Vercel) e backend (Render) são origens diferentes.
  // sameSite:'none' requer secure:true — funciona porque ambos têm HTTPS em prod.
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 2 * 60 * 60 * 1000,
  path: '/',
};

const signToken = (userId) =>
  jwt.sign(
    { userId, jti: crypto.randomUUID() },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY, algorithm: 'HS256' }
  );

const register = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      // Mensagem genérica — evita confirmar qual email já existe (user enumeration)
      return res.status(400).json({ error: 'Não foi possível criar a conta com este email' });
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, password_hash]
    );
    const user = result.rows[0];
    const token = signToken(user.id);

    securityLogger.registerSuccess(req, user.id, email);

    res.cookie('token', token, cookieOptions);
    // Token NÃO retornado no body — apenas no HttpOnly cookie
    // Clientes de API devem usar o cookie ou fluxo OAuth separado
    res.status(201).json({ user });
  } catch (err) {
    console.error('register error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT id, name, email, password_hash, failed_attempts, locked_until FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];

    // Verificar lockout por email antes de qualquer compare
    if (user?.locked_until && new Date(user.locked_until) > new Date()) {
      securityLogger.loginFailed(req, email);
      return res.status(429).json({
        error: 'Conta temporariamente bloqueada. Tente novamente em 15 minutos.',
      });
    }

    // Constant-time compare — executa mesmo se usuário não existe (anti-timing)
    const hashToCompare = user ? user.password_hash : DUMMY_HASH;
    const valid = await bcrypt.compare(password, hashToCompare);

    if (!user || !valid) {
      securityLogger.loginFailed(req, email);

      // Incrementar contador de falhas e bloquear após 5 tentativas
      if (user) {
        const newAttempts = (user.failed_attempts || 0) + 1;
        const lockQuery = newAttempts >= 5
          ? `UPDATE users SET failed_attempts = $1, locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $2`
          : `UPDATE users SET failed_attempts = $1 WHERE id = $2`;
        await pool.query(lockQuery, [newAttempts, user.id]);
      }

      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Login bem-sucedido — resetar contador de falhas
    await pool.query(
      'UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1',
      [user.id]
    );

    const token = signToken(user.id);
    securityLogger.loginSuccess(req, user.id);

    res.cookie('token', token, cookieOptions);
    // Token NÃO retornado no body
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('login error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const logout = async (req, res) => {
  const userId = req.user?.userId;
  const jti = req.user?.jti;

  if (userId && jti) {
    securityLogger.logoutSuccess(req, userId);
    // Inserir JTI na blocklist para invalidar o token mesmo antes de expirar
    // A limpeza de tokens expirados ocorre via query periódica (ver migration manual)
    try {
      const decoded = jwt.decode(req.cookies?.token || '');
      if (decoded?.exp) {
        await pool.query(
          `INSERT INTO token_blocklist (jti, expires_at)
           VALUES ($1, to_timestamp($2))
           ON CONFLICT (jti) DO NOTHING`,
          [jti, decoded.exp]
        );
      }
    } catch {
      // Falha silenciosa — o cookie já será removido mesmo assim
    }
  }

  res.clearCookie('token', { path: '/' });
  res.json({ success: true });
};

module.exports = { register, login, logout };
