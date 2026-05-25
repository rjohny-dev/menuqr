# Tutorial de Correções Manuais de Segurança — MenuQR

Este arquivo contém as correções que **não podem ser feitas automaticamente** porque exigem
acesso ao painel do Supabase, variáveis de ambiente no Render, ou configuração de serviços externos.

Execute cada seção **em ordem** antes de fazer o deploy em produção.

---

## PASSO 1 — Migrations do Supabase (CRÍTICO — fazer primeiro)

Acesse: **Supabase → seu projeto → SQL Editor → New Query**

Execute o SQL abaixo inteiro de uma vez:

```sql
-- ════════════════════════════════════════════════════════════
-- MIGRATION DE SEGURANÇA — MenuQR
-- Execute no SQL Editor do Supabase antes do deploy
-- ════════════════════════════════════════════════════════════

-- ─── CRIT-02: Garantir que cada usuário só possa ter 1 restaurante ───────────
-- Se já existirem usuários com mais de 1 restaurante (race condition anterior),
-- o comando abaixo vai falhar. Nesse caso, limpe os duplicados primeiro (ver nota).
ALTER TABLE restaurants
  ADD CONSTRAINT restaurants_user_id_unique UNIQUE (user_id);

-- ─── MED-05: Colunas para lockout de conta por email ─────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

-- ─── HIGH-04: Tabela para revogar tokens (token blocklist) ───────────────────
CREATE TABLE IF NOT EXISTS token_blocklist (
  jti        TEXT PRIMARY KEY,
  expires_at TIMESTAMP NOT NULL
);

-- Index para a query de verificação de revogação (executada em todo request autenticado)
CREATE INDEX IF NOT EXISTS idx_token_blocklist_expires
  ON token_blocklist (expires_at);

-- ─── Limpeza automática de tokens expirados (executar periodicamente) ─────────
-- Opcional: criar uma função que pode ser chamada via cron ou no startup do servidor
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM token_blocklist WHERE expires_at < NOW();
$$;

-- ════════════════════════════════════════════════════════════
-- FIM DA MIGRATION
-- ════════════════════════════════════════════════════════════
```

### Nota sobre duplicatas no CRIT-02

Se o `ALTER TABLE ADD CONSTRAINT` falhar com "could not create unique index", é porque
já existem usuários com múltiplos restaurantes. Para limpar:

```sql
-- Ver duplicatas
SELECT user_id, COUNT(*) FROM restaurants GROUP BY user_id HAVING COUNT(*) > 1;

-- Manter apenas o restaurante mais antigo de cada usuário
DELETE FROM restaurants
WHERE id NOT IN (
  SELECT MIN(id)
  FROM restaurants
  GROUP BY user_id
);

-- Agora aplicar a constraint
ALTER TABLE restaurants ADD CONSTRAINT restaurants_user_id_unique UNIQUE (user_id);
```

---

## PASSO 2 — Certificado SSL do Supabase (HIGH-05)

Isso faz a conexão com o banco usar TLS verificado, prevenindo MITM.

### 2.1 Baixar o certificado

1. Abra o painel do Supabase → seu projeto
2. Vá em **Settings → Database**
3. Role até a seção **SSL**
4. Clique em **Download certificate** → salva como `supabase-ca.crt`

### 2.2 Configurar no Render

1. Abra o painel do **Render → seu Web Service (backend)**
2. Vá em **Environment → Environment Variables**
3. Adicione a variável:
   - **Key:** `SUPABASE_SSL_CERT`
   - **Value:** abra o arquivo `supabase-ca.crt` em um editor de texto e cole o conteúdo inteiro
     (começa com `-----BEGIN CERTIFICATE-----` e termina com `-----END CERTIFICATE-----`)

4. Salve. O Render vai reiniciar o serviço automaticamente.

O código em `server/src/db/index.js` já foi atualizado para usar esta variável:
```javascript
// já corrigido automaticamente:
rejectUnauthorized: process.env.SUPABASE_SSL_CERT ? true : false,
ca: process.env.SUPABASE_SSL_CERT || undefined,
```

---

## PASSO 3 — Variáveis de Ambiente no Render (verificação geral)

Acesse **Render → seu Web Service → Environment**.

Confirme que estas variáveis estão corretas:

| Variável | Valor esperado | Observação |
|----------|---------------|------------|
| `NODE_ENV` | `production` | Ativa cookies Secure + SameSite=Strict |
| `JWT_SECRET` | string de 64+ chars aleatórios | Gerar: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `DATABASE_URL` | URL completa do Supabase | Copiar de Supabase → Settings → Database → URI |
| `CLIENT_URL` | URL do seu frontend no Vercel | Ex: `https://menuqr.vercel.app` |
| `PORT` | `3001` (ou deixar vazio para Render default) | |
| `SUPABASE_SSL_CERT` | Conteúdo do cert (passo 2) | Opcional mas recomendado |

**Atenção ao JWT_SECRET:** Se o valor atual for fraco (menos de 32 chars, ou string óbvia),
troque AGORA antes do deploy. Isso vai invalidar todos os tokens existentes — todos os usuários
precisarão fazer login novamente.

---

## PASSO 4 — CSP e imgSrc (para imagens de outros CDNs)

O código já foi atualizado para restringir `imgSrc` aos CDNs: Cloudinary, Imgur e Unsplash.

Se você ou seus usuários usam outros serviços de hospedagem de imagem, adicione em
`server/src/app.js` dentro do array `imgSrc`:

```javascript
imgSrc: [
  "'self'",
  'data:',
  'https://res.cloudinary.com',    // já incluído
  'https://i.imgur.com',           // já incluído
  'https://images.unsplash.com',   // já incluído
  'https://seu-cdn-extra.com',     // adicionar aqui se necessário
],
```

---

## PASSO 5 — Limpeza periódica da token_blocklist (operacional)

A tabela `token_blocklist` acumula tokens expirados com o tempo. Para limpá-los,
há duas opções:

### Opção A — Adicionar ao startup do servidor (simples)

Edite `server/server.js`:

```javascript
require('dotenv').config();
const app = require('./src/app');
const pool = require('./src/db');

const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  console.log(`MenuQR server running on port ${PORT}`);
  // Limpar tokens expirados ao iniciar
  try {
    await pool.query('DELETE FROM token_blocklist WHERE expires_at < NOW()');
    console.log('Token blocklist cleaned up');
  } catch (err) {
    console.error('Blocklist cleanup error:', err.message);
  }
});
```

### Opção B — pg_cron no Supabase (recomendado para produção)

No SQL Editor do Supabase:

```sql
-- Requer extensão pg_cron (disponível no Supabase Pro)
SELECT cron.schedule(
  'cleanup-token-blocklist',
  '0 * * * *',  -- todo início de hora
  'SELECT cleanup_expired_tokens()'
);
```

---

## PASSO 6 — Monitoramento com Sentry (MED-06 — recomendado)

Sentry captura erros e eventos de segurança em tempo real. Gratuito até 50k eventos/mês.

### 6.1 Criar conta e projeto

1. Acesse [sentry.io](https://sentry.io) → criar conta gratuita
2. Crie um novo projeto → selecione **Node.js**
3. Copie o **DSN** (parece `https://xxx@yyy.ingest.sentry.io/zzz`)

### 6.2 Instalar no backend

```bash
cd server
npm install @sentry/node
```

### 6.3 Inicializar no server.js

```javascript
// server/server.js — adicionar no topo, antes de qualquer require de app
require('dotenv').config();
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% das transações
});

const app = require('./src/app');
// ... resto do arquivo
```

### 6.4 Adicionar a variável no Render

| Variável | Valor |
|----------|-------|
| `SENTRY_DSN` | DSN copiado do passo 6.1 |

---

## PASSO 7 — Verificação final antes do deploy

Execute este checklist:

```
[ ] Migration do Supabase executada com sucesso (Passo 1)
[ ] UNIQUE constraint em restaurants.user_id confirmada
[ ] Colunas failed_attempts e locked_until em users confirmadas
[ ] Tabela token_blocklist criada
[ ] NODE_ENV=production configurado no Render
[ ] JWT_SECRET com 64+ chars configurado
[ ] CLIENT_URL apontando para URL real do Vercel
[ ] SUPABASE_SSL_CERT configurado (opcional mas recomendado)
[ ] Testar login/logout no ambiente de staging
[ ] Testar que após logout o token antigo é rejeitado
[ ] Testar que 5 logins errados bloqueiam a conta por 15 min
[ ] Testar que imagem com http:// é rejeitada na validação
```

---

## Resumo do que foi corrigido automaticamente no código

| ID | Correção | Arquivo |
|----|---------|---------|
| CRIT-01 | `trust proxy` + `keyGenerator` no rate limiter | `app.js`, `rateLimiter.js` |
| CRIT-02 | `ON CONFLICT (user_id) DO NOTHING` no createRestaurant | `controllers/restaurant.js` |
| CRIT-03 | Token removido do response body | `controllers/auth.js` |
| HIGH-01 | Mensagem genérica no register (user enumeration) | `controllers/auth.js` |
| HIGH-02 | URL validator: só HTTPS + bloqueio de IPs privados | `middleware/validate.js` |
| HIGH-03 | DUMMY_HASH substituído por hash bcrypt real | `controllers/auth.js` |
| HIGH-04 | JTI no JWT + token blocklist no logout/auth | `controllers/auth.js`, `middleware/auth.js` |
| MED-01 | `req.ip` no security logger (anti-spoofing) | `middleware/securityLogger.js` |
| MED-02 | CSP: `unsafe-inline` removido, `imgSrc` restrito | `app.js` |
| MED-03 | `urlOrNull` força `https://` | `middleware/validate.js` |
| MED-04 | Limites de conexão no pg.Pool | `db/index.js` |
| MED-05 | Lockout por email (código) | `controllers/auth.js` |
| MED-08 | `healthLimiter` no `/api/health` | `app.js`, `rateLimiter.js` |
| MED-09 | Preview de logo valida `https://` no frontend | `pages/Settings.jsx` |
