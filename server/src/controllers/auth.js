const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');
const securityLogger = require('../middleware/securityLogger');

// Número de rounds do bcrypt — quanto maior, mais lento e mais seguro.
// 12 rounds é o equilíbrio recomendado entre segurança e performance.
const RODADAS_DO_HASH = 12;

// Tempo de validade do token JWT — o usuário precisa logar novamente após 2 horas
const VALIDADE_DO_TOKEN = '2h';

// Hash fictício pré-computado para prevenir timing attack:
// quando o email não existe no banco, ainda executamos o bcrypt.compare()
// com esse hash para que o tempo de resposta seja idêntico ao de um login normal.
const HASH_FICTICIO = '$2a$12$dpON0CCVF2PN9oeX8o1icOWjSaCaSKJIHew7Ava5a3ZliH7jjFlEe';

// Configurações do cookie que guarda o token JWT
const opcoesDoCookie = {
  httpOnly: true,                                                    // JavaScript do navegador não consegue ler
  secure: process.env.NODE_ENV === 'production',                     // só HTTPS em produção
  // 'none' é obrigatório em prod: frontend (Vercel) e backend (Render) são origens diferentes.
  // sameSite:'none' só funciona com secure:true — válido porque ambos têm HTTPS em prod.
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 2 * 60 * 60 * 1000,                                       // 2 horas em milissegundos
  path: '/',
};

// Gera um token JWT assinado com o ID do usuário e um ID único (jti)
// O jti permite revogar o token no logout antes de ele expirar
const gerarToken = (idDoUsuario) =>
  jwt.sign(
    { userId: idDoUsuario, jti: crypto.randomUUID() },
    process.env.JWT_SECRET,
    { expiresIn: VALIDADE_DO_TOKEN, algorithm: 'HS256' }
  );

const register = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const usuarioExistente = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (usuarioExistente.rows.length > 0) {
      // Mensagem genérica — evita confirmar qual email já está cadastrado (user enumeration)
      return res.status(400).json({ error: 'Não foi possível criar a conta com este email' });
    }

    const password_hash = await bcrypt.hash(password, RODADAS_DO_HASH);
    const resultado = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, password_hash]
    );
    const usuario = resultado.rows[0];
    const token = gerarToken(usuario.id);

    securityLogger.registerSuccess(req, usuario.id, email);

    res.cookie('token', token, opcoesDoCookie);
    // Token NÃO retornado no body — apenas no HttpOnly cookie
    res.status(201).json({ user: usuario });
  } catch (err) {
    console.error('register error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const resultado = await pool.query(
      'SELECT id, name, email, password_hash, failed_attempts, locked_until FROM users WHERE email = $1',
      [email]
    );

    const usuario = resultado.rows[0];

    // Se a conta está bloqueada por excesso de tentativas, nega acesso imediatamente
    if (usuario?.locked_until && new Date(usuario.locked_until) > new Date()) {
      securityLogger.loginFailed(req, email);
      return res.status(429).json({
        error: 'Conta temporariamente bloqueada. Tente novamente em 15 minutos.',
      });
    }

    // Executa o compare mesmo quando o usuário não existe (anti-timing attack)
    const hashParaComparar = usuario ? usuario.password_hash : HASH_FICTICIO;
    const senhaCorreta = await bcrypt.compare(password, hashParaComparar);

    if (!usuario || !senhaCorreta) {
      securityLogger.loginFailed(req, email);

      // Incrementa o contador de tentativas e bloqueia após 5 falhas
      if (usuario) {
        const novasTentativas = (usuario.failed_attempts || 0) + 1;
        const queryBloqueio = novasTentativas >= 5
          ? `UPDATE users SET failed_attempts = $1, locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $2`
          : `UPDATE users SET failed_attempts = $1 WHERE id = $2`;
        await pool.query(queryBloqueio, [novasTentativas, usuario.id]);
      }

      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Login bem-sucedido — zera o contador de tentativas falhas
    await pool.query(
      'UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1',
      [usuario.id]
    );

    const token = gerarToken(usuario.id);
    securityLogger.loginSuccess(req, usuario.id);

    res.cookie('token', token, opcoesDoCookie);
    res.json({ user: { id: usuario.id, name: usuario.name, email: usuario.email } });
  } catch (err) {
    console.error('login error:', err.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const logout = async (req, res) => {
  const idDoUsuario = req.user?.userId;
  const idUnicoDoToken = req.user?.jti;

  if (idDoUsuario && idUnicoDoToken) {
    securityLogger.logoutSuccess(req, idDoUsuario);
    // Adiciona o JTI à blocklist para que o token fique inválido imediatamente,
    // mesmo antes de seu tempo de expiração natural
    try {
      const tokenDecodificado = jwt.decode(req.cookies?.token || '');
      if (tokenDecodificado?.exp) {
        await pool.query(
          `INSERT INTO token_blocklist (jti, expires_at)
           VALUES ($1, to_timestamp($2))
           ON CONFLICT (jti) DO NOTHING`,
          [idUnicoDoToken, tokenDecodificado.exp]
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
