# MenuQR — Cardápio Digital com QR Code

![React](https://img.shields.io/badge/React_18-20232A?style=flat&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=flat&logo=render&logoColor=white)

Plataforma SaaS multi-tenant que permite donos de restaurantes publicarem um **cardápio digital acessível via QR Code** em menos de 5 minutos — sem app, sem mensalidade por item, com pedido direto pelo WhatsApp.

**[→ Acessar demo ao vivo](https://menuqr-lemon.vercel.app)**

---

## Funcionalidades

### Para o dono do restaurante
- Cadastro com verificação de email e recuperação de senha
- Painel de gerenciamento com QR Code gerado automaticamente
- CRUD completo de categorias e itens (nome, descrição, preço, foto, ativo/inativo)
- Upload de imagens direto para Cloudflare R2 (CDN)
- Configuração de slug único que vira a URL pública do cardápio
- Logo do restaurante

### Para o cliente final
- Cardápio público mobile-first, sem login, acessível via QR Code
- Carrinho de compras com controle de quantidade
- Geração automática de mensagem de pedido e envio direto pelo WhatsApp
- Modo somente visualização quando WhatsApp não estiver configurado

---

## Stack

| Camada | Tecnologia | Decisão técnica |
|--------|-----------|-----------------|
| Frontend | React 18 + Vite | SPA com roteamento client-side |
| Estilização | CSS puro com custom properties | Sem dependência de UI library — design system próprio |
| HTTP client | Axios | Interceptor de 401 para renovação de sessão |
| QR Code | qrcode.react | Geração client-side do SVG |
| Backend | Node.js + Express | API REST sem ORM — SQL puro com `pg` |
| Banco de dados | PostgreSQL (Supabase) | Dados relacionais com constraints e índices |
| Autenticação | JWT + cookie HttpOnly + refresh token | Access token 2h + refresh 7 dias com rotação |
| Senhas | bcrypt 12 rounds | Resistente a brute force por design |
| Validação | Zod | Schema em runtime no servidor |
| Imagens | Cloudflare R2 + AWS SDK v3 | Object storage com URL pública via CDN |
| Email | Brevo HTTP API | Verificação de conta e recuperação de senha |
| Deploy frontend | Vercel | CI/CD automático via GitHub |
| Deploy backend | Render | Web service com variáveis de ambiente gerenciadas |

---

## Arquitetura

```
┌─────────────────────────────────┐
│   Browser (React SPA — Vercel)  │
│   HttpOnly cookies (JWT)        │
└────────────┬────────────────────┘
             │ HTTPS
┌────────────▼────────────────────┐
│   API REST (Express — Render)   │
│   CORS · Helmet · Rate Limit    │
│   Zod validation · Auth JWT     │
└────┬──────────────┬─────────────┘
     │              │
┌────▼──────┐  ┌────▼──────────┐
│PostgreSQL │  │ Cloudflare R2 │
│(Supabase) │  │  (imagens)    │
└───────────┘  └───────────────┘
```

**Modelo de dados:**

```
users
 └── restaurants   (1:1 — um usuário, um restaurante)
       ├── categories
       │     └── items
       ├── token_blocklist   (revogação de JWT por JTI)
       └── refresh_tokens    (sessões ativas por dispositivo)
```

---

## Autenticação — fluxo completo

O sistema implementa um fluxo de autenticação com dois tokens, revogação imediata e verificação de identidade:

```
Cadastro → Email de verificação (Brevo) → Confirmação de conta
Login    → Access token (2h, HttpOnly) + Refresh token (7 dias, HttpOnly)
Refresh  → Rotação atômica: revoga token anterior, emite novo (detecção de roubo)
Logout   → JTI adicionado à blocklist + refresh token deletado
```

**Proteções implementadas:**

| Mecanismo | Detalhe |
|-----------|---------|
| Access token | JWT HS256, 2h, cookie HttpOnly — invisível para o JS |
| Refresh token | 48 bytes aleatórios, armazenado como SHA-256 no banco |
| Rotação de sessão | Cada `/refresh` deleta o token anterior e emite um novo — em transação atômica |
| Revogação por JTI | Logout invalida o access token imediatamente via blocklist no banco |
| Verificação de email | Token SHA-256 de 32 bytes, expira em 24h |
| Recuperação de senha | Token SHA-256 de 32 bytes, expira em 1h |
| Lockout | 5 tentativas erradas → bloqueio de 15 minutos |
| Anti-timing attack | Hash fictício garante tempo de resposta idêntico para emails inexistentes |
| Anti-user-enumeration | Respostas genéricas em forgot-password e resend-verification |
| Cookie seguro | `httpOnly`, `secure`, `sameSite: none` (cross-origin Vercel ↔ Render) |
| Senha | bcrypt 12 rounds — armazenada somente como hash |

---

## API Reference

### Auth — `/api/auth`

| Método | Rota | Auth | Descrição |
|--------|------|:----:|-----------|
| POST | `/register` | — | Cria conta e envia email de verificação |
| POST | `/login` | — | Autentica e define cookies de sessão |
| POST | `/logout` | ✓ | Revoga access token (JTI) e deleta refresh token |
| POST | `/refresh` | — | Renova access token via refresh token (com rotação) |
| GET  | `/verify-email?token=` | — | Confirma o email via link enviado |
| POST | `/resend-verification` | — | Reenvia o email de confirmação |
| POST | `/forgot-password` | — | Envia link de recuperação de senha |
| POST | `/reset-password` | — | Redefine senha e invalida todas as sessões ativas |

### Restaurante — `/api/restaurant`

| Método | Rota | Auth | Descrição |
|--------|------|:----:|-----------|
| GET | `/` | ✓ | Retorna os dados do restaurante do usuário |
| POST | `/` | ✓ | Cria o restaurante (máximo um por usuário) |
| PUT | `/` | ✓ | Atualiza nome, slug, logo, WhatsApp ou descrição |

### Categorias — `/api/categories`

| Método | Rota | Auth | Descrição |
|--------|------|:----:|-----------|
| GET | `/` | ✓ | Lista categorias do restaurante |
| POST | `/` | ✓ | Cria categoria |
| PUT | `/:id` | ✓ | Edita nome ou ordem |
| DELETE | `/:id` | ✓ | Remove categoria e todos os itens (cascade) |

### Itens — `/api/items`

| Método | Rota | Auth | Descrição |
|--------|------|:----:|-----------|
| GET | `/category/:id` | ✓ | Lista itens de uma categoria |
| POST | `/category/:id` | ✓ | Cria item com foto, preço e descrição |
| PUT | `/:id` | ✓ | Edita qualquer campo, incluindo status ativo/inativo |
| DELETE | `/:id` | ✓ | Remove item permanentemente |

### Cardápio público — `/api/menu`

| Método | Rota | Auth | Descrição |
|--------|------|:----:|-----------|
| GET | `/:slug` | — | Retorna restaurante + categorias + itens ativos |

### Upload — `/api/upload`

| Método | Rota | Auth | Descrição |
|--------|------|:----:|-----------|
| POST | `/image` | ✓ | Envia imagem para Cloudflare R2 e retorna URL pública |

---

## Segurança da API

| Camada | Configuração |
|--------|-------------|
| Rate limit — login | 5 req / 15 min por IP |
| Rate limit — auth geral | 10 req / 15 min por IP |
| Rate limit — API | 120 req / min por IP |
| Rate limit — cardápio público | 60 req / min por IP |
| CORS | Allowlist explícita por variável de ambiente |
| Body limit | 10 KB por requisição |
| Helmet | CSP restritiva + headers de segurança |
| Zod | Validação de schema em todos os endpoints |
| SQL | Queries parametrizadas — zero interpolação de string |
| Limpeza automática | pg_cron remove tokens expirados da blocklist a cada hora |

---

## Como rodar localmente

### Pré-requisitos

- Node.js 18+
- PostgreSQL — conta gratuita no [Supabase](https://supabase.com) ou instalação local
- Cloudflare R2 — necessário apenas para testar upload de imagens
- Brevo — necessário para o fluxo de email (verificação e recuperação de senha)

### 1. Banco de dados

**Supabase:**
1. Crie um projeto em [supabase.com](https://supabase.com)
2. Vá em **SQL Editor** e execute o conteúdo de `server/src/db/schema.sql`
3. Copie a Connection String em **Project Settings → Database → URI**

**PostgreSQL local:**
```bash
createdb menuqr
psql menuqr < server/src/db/schema.sql
```

### 2. Backend

```bash
cd server
npm install
cp .env.example .env
```

Preencha o `.env`:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=<64 bytes hex — node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
PORT=3001
CLIENT_URL=http://localhost:5173
NODE_ENV=development

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# Brevo
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
```

```bash
npm run dev   # http://localhost:3001
```

### 3. Frontend

```bash
cd client
npm install
cp .env.example .env  # VITE_API_URL=http://localhost:3001/api
npm run dev           # http://localhost:5173
```

---

## Deploy

### Backend — Render

| Campo | Valor |
|-------|-------|
| Root Directory | `server` |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Environment | todas as variáveis do `server/.env` |

### Frontend — Vercel

| Campo | Valor |
|-------|-------|
| Root Directory | `client` |
| Framework Preset | Vite |
| `VITE_API_URL` | URL do serviço no Render + `/api` |

---

## Variáveis de ambiente

### `server/.env`

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `DATABASE_URL` | Sim | String de conexão PostgreSQL |
| `JWT_SECRET` | Sim | Segredo para assinar tokens (mínimo 64 bytes) |
| `CLIENT_URL` | Sim | URL do frontend — define o CORS |
| `PORT` | Não | Padrão `3001` |
| `NODE_ENV` | Não | `development` ou `production` |
| `R2_ACCOUNT_ID` | Upload | ID da conta Cloudflare |
| `R2_ACCESS_KEY_ID` | Upload | Chave de acesso R2 |
| `R2_SECRET_ACCESS_KEY` | Upload | Chave secreta R2 |
| `R2_BUCKET_NAME` | Upload | Nome do bucket |
| `R2_PUBLIC_URL` | Upload | URL pública do bucket |
| `BREVO_API_KEY` | Email | API key do Brevo |
| `BREVO_SENDER_EMAIL` | Email | Email remetente verificado no Brevo |

### `client/.env`

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `VITE_API_URL` | Sim | URL base da API (ex: `http://localhost:3001/api`) |

---

## Problemas comuns

**CORS error ao chamar a API**
→ `CLIENT_URL` no `server/.env` deve ser a URL exata do frontend (incluindo protocolo e porta).

**Conta bloqueada após tentativas erradas**
→ Aguarde 15 minutos ou execute `UPDATE users SET locked_until = NULL WHERE email = '...'` no banco.

**Upload de imagem não funciona**
→ Verifique as variáveis `R2_*` e confirme que o bucket tem acesso público habilitado.

**"relation does not exist"**
→ O schema não foi aplicado. Execute `server/src/db/schema.sql` no banco.

**Email de verificação não chega**
→ Verifique `BREVO_API_KEY` e se o `BREVO_SENDER_EMAIL` está verificado no painel do Brevo.
