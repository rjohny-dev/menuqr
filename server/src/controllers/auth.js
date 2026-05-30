const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');
const securityLogger = require('../middleware/securityLogger');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email');

const RODADAS_DO_HASH = 12;
const HASH_FICTICIO = '$2a$12$dpON0CCVF2PN9oeX8o1icOWjSaCaSKJIHew7Ava5a3ZliH7jjFlEe';

const cookieOpts = (maxAgeMs) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: maxAgeMs,
  path: '/',
});

const ACCESS_TTL  = '2h';
const REFRESH_DAYS = 7;

const gerarAccessToken = (userId) =>
  jwt.sign(
    { userId, jti: crypto.randomUUID() },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL, algorithm: 'HS256' }
  );

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

// ─── Register ─────────────────────────────────────────────────────────────────

const register = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existe = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existe.rows.length > 0) {
      return res.status(400).json({ error: 'Não foi possível criar a conta com este email' });
    }

    const password_hash = await bcrypt.hash(password, RODADAS_DO_HASH);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const resultado = await pool.query(
      `INSERT INTO users (name, email, password_hash, verification_token_hash, verification_token_expires)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email`,
      [name, email, password_hash, hashToken(verificationToken), verificationExpires]
    );
    const usuario = resultado.rows[0];

    securityLogger.registerSuccess(req, usuario.id, email);

    try {
      await sendVerificationEmail(email, name, verificationToken);
    } catch (emailErr) {
      console.error('email send error:', emailErr.message);
    }

    res.status(201).json({
      message: 'Conta criada! Verifique seu email para ativar o acesso.',
      email,
    });
  } catch (err) {
    console.error('register error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const resultado = await pool.query(
      'SELECT id, name, email, password_hash, email_verified, failed_attempts, locked_until FROM users WHERE email = $1',
      [email]
    );
    const usuario = resultado.rows[0];

    if (usuario?.locked_until && new Date(usuario.locked_until) > new Date()) {
      securityLogger.loginFailed(req, email);
      return res.status(429).json({ error: 'Conta temporariamente bloqueada. Tente novamente em 15 minutos.' });
    }

    const hashParaComparar = usuario ? usuario.password_hash : HASH_FICTICIO;
    const senhaCorreta = await bcrypt.compare(password, hashParaComparar);

    if (!usuario || !senhaCorreta) {
      securityLogger.loginFailed(req, email);
      if (usuario) {
        const novasTentativas = (usuario.failed_attempts || 0) + 1;
        const query = novasTentativas >= 5
          ? `UPDATE users SET failed_attempts = $1, locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $2`
          : `UPDATE users SET failed_attempts = $1 WHERE id = $2`;
        await pool.query(query, [novasTentativas, usuario.id]);
      }
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    if (!usuario.email_verified) {
      return res.status(403).json({
        error: 'Email não confirmado. Verifique sua caixa de entrada.',
        code: 'EMAIL_NOT_VERIFIED',
        email: usuario.email,
      });
    }

    await pool.query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [usuario.id]);

    const accessToken = gerarAccessToken(usuario.id);

    const refreshToken = crypto.randomBytes(48).toString('hex');
    const refreshExpires = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [usuario.id, hashToken(refreshToken), refreshExpires]
    );

    securityLogger.loginSuccess(req, usuario.id);

    res.cookie('token', accessToken, cookieOpts(2 * 60 * 60 * 1000));
    res.cookie('refresh_token', refreshToken, cookieOpts(REFRESH_DAYS * 24 * 60 * 60 * 1000));
    res.json({ user: { id: usuario.id, name: usuario.name, email: usuario.email } });
  } catch (err) {
    console.error('login error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// ─── Refresh ──────────────────────────────────────────────────────────────────

const refresh = async (req, res) => {
  const oldRefreshToken = req.cookies?.refresh_token;
  if (!oldRefreshToken) return res.status(401).json({ error: 'Refresh token ausente' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const resultado = await client.query(
      `DELETE FROM refresh_tokens
       WHERE token_hash = $1 AND expires_at > NOW()
       RETURNING user_id`,
      [hashToken(oldRefreshToken)]
    );

    if (resultado.rows.length === 0) {
      await client.query('ROLLBACK');
      res.clearCookie('refresh_token', { path: '/' });
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }

    const { user_id } = resultado.rows[0];

    const userResult = await client.query('SELECT name, email FROM users WHERE id = $1', [user_id]);
    const { name, email } = userResult.rows[0];

    const newAccessToken = gerarAccessToken(user_id);
    const newRefreshToken = crypto.randomBytes(48).toString('hex');
    const refreshExpires = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);

    await client.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user_id, hashToken(newRefreshToken), refreshExpires]
    );

    await client.query('COMMIT');

    res.cookie('token', newAccessToken, cookieOpts(2 * 60 * 60 * 1000));
    res.cookie('refresh_token', newRefreshToken, cookieOpts(REFRESH_DAYS * 24 * 60 * 60 * 1000));
    res.json({ user: { id: user_id, name, email } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('refresh error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    client.release();
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────

const logout = async (req, res) => {
  const idDoUsuario = req.user?.userId;
  const idUnicoDoToken = req.user?.jti;
  const refreshToken = req.cookies?.refresh_token;

  if (idDoUsuario && idUnicoDoToken) {
    securityLogger.logoutSuccess(req, idDoUsuario);
    try {
      const tokenDecodificado = jwt.decode(req.cookies?.token || '');
      if (tokenDecodificado?.exp) {
        await pool.query(
          `INSERT INTO token_blocklist (jti, expires_at) VALUES ($1, to_timestamp($2)) ON CONFLICT (jti) DO NOTHING`,
          [idUnicoDoToken, tokenDecodificado.exp]
        );
      }
    } catch { /* falha silenciosa */ }
  }

  if (refreshToken) {
    try {
      await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hashToken(refreshToken)]);
    } catch { /* falha silenciosa */ }
  }

  res.clearCookie('token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/' });
  res.json({ success: true });
};

// ─── Verify Email ─────────────────────────────────────────────────────────────

const verifyEmail = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token inválido' });

  try {
    const resultado = await pool.query(
      `UPDATE users
       SET email_verified = true, verification_token_hash = NULL, verification_token_expires = NULL
       WHERE verification_token_hash = $1 AND verification_token_expires > NOW()
       RETURNING id, email`,
      [hashToken(token)]
    );

    if (resultado.rows.length === 0) {
      return res.status(400).json({ error: 'Link inválido ou expirado. Solicite um novo.' });
    }

    res.json({ message: 'Email confirmado com sucesso! Faça login para continuar.' });
  } catch (err) {
    console.error('verifyEmail error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// ─── Resend Verification ──────────────────────────────────────────────────────

const resendVerification = async (req, res) => {
  const { email } = req.body;
  try {
    const resultado = await pool.query(
      'SELECT id, name, email_verified FROM users WHERE email = $1',
      [email]
    );
    const usuario = resultado.rows[0];

    // Sempre retorna 200 para não revelar se o email existe
    if (!usuario || usuario.email_verified) {
      return res.json({ message: 'Se o email existir e não estiver confirmado, você receberá um novo link.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      'UPDATE users SET verification_token_hash = $1, verification_token_expires = $2 WHERE id = $3',
      [hashToken(token), expires, usuario.id]
    );

    await sendVerificationEmail(email, usuario.name, token);

    res.json({ message: 'Se o email existir e não estiver confirmado, você receberá um novo link.' });
  } catch (err) {
    console.error('resendVerification error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// ─── Forgot Password ──────────────────────────────────────────────────────────

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const MSG = 'Se este email estiver cadastrado, você receberá as instruções em breve.';

  try {
    const resultado = await pool.query(
      'SELECT id, name FROM users WHERE email = $1 AND email_verified = true',
      [email]
    );
    const usuario = resultado.rows[0];

    if (usuario) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h

      await pool.query(
        'UPDATE users SET reset_token_hash = $1, reset_token_expires = $2 WHERE id = $3',
        [hashToken(resetToken), expires, usuario.id]
      );

      await sendPasswordResetEmail(email, usuario.name, resetToken);
    }

    res.json({ message: MSG });
  } catch (err) {
    console.error('forgotPassword error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// ─── Reset Password ───────────────────────────────────────────────────────────

const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  try {
    const resultado = await pool.query(
      'SELECT id FROM users WHERE reset_token_hash = $1 AND reset_token_expires > NOW()',
      [hashToken(token)]
    );

    if (resultado.rows.length === 0) {
      return res.status(400).json({ error: 'Link inválido ou expirado. Solicite um novo.' });
    }

    const password_hash = await bcrypt.hash(password, RODADAS_DO_HASH);
    await pool.query(
      `UPDATE users
       SET password_hash = $1, reset_token_hash = NULL, reset_token_expires = NULL,
           failed_attempts = 0, locked_until = NULL
       WHERE id = $2`,
      [password_hash, resultado.rows[0].id]
    );

    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [resultado.rows[0].id]);

    res.json({ message: 'Senha redefinida com sucesso. Faça login com a nova senha.' });
  } catch (err) {
    console.error('resetPassword error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = { register, login, logout, refresh, verifyEmail, resendVerification, forgotPassword, resetPassword };
