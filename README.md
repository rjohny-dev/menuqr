# MenuQR — Cardápio Digital com QR Code

MenuQR é uma plataforma SaaS que permite donos de restaurantes, lanchonetes e qualquer estabelecimento alimentício criarem um **cardápio digital acessível via QR Code** — sem app para baixar, sem mensalidade por item.

O cliente escaneia o QR Code, vê o cardápio no celular, monta o pedido e envia direto pelo WhatsApp.

---

## Como o sistema funciona, do começo ao fim

```
Dono cadastra conta
    → Configura o restaurante (nome, slug, logo, WhatsApp)
        → Cria categorias (Lanches, Bebidas, Sobremesas...)
            → Adiciona itens em cada categoria (foto, descrição, preço)
                → Sistema gera link e QR Code únicos
                    → Cliente acessa /menu/nome-do-restaurante
                        → Monta o pedido e envia pelo WhatsApp
```

---

## Tecnologias usadas

| Camada | Tecnologia | Para que serve |
|--------|-----------|----------------|
| Frontend | React 18 + Vite | Interface do painel do dono e do cardápio público |
| Roteamento | React Router v6 | Navegar entre as telas sem recarregar a página |
| HTTP client | Axios | Fazer chamadas para a API do backend |
| QR Code | qrcode.react | Gerar o QR Code no navegador |
| Backend | Node.js + Express | Servidor que recebe e processa todas as requisições |
| Banco de dados | PostgreSQL (Supabase) | Guardar usuários, restaurantes, categorias e itens |
| Autenticação | JWT em cookie HttpOnly | Token de sessão que o JavaScript não consegue ler (seguro contra XSS) |
| Senhas | bcrypt (12 rounds) | As senhas nunca são salvas — só o hash. 12 rounds = lento por design |
| Imagens | Cloudflare R2 | CDN para armazenar fotos dos itens |
| Deploy backend | Render | Hospedagem do servidor Node.js |
| Deploy frontend | Vercel | Hospedagem da aplicação React |

---

## Estrutura de pastas explicada

```
SaaS/
│
├── server/                  ← Tudo do servidor (API REST)
│   ├── server.js            ← Ponto de entrada: inicia o servidor na porta 3001
│   └── src/
│       ├── app.js           ← Configura o Express: CORS, segurança, rotas
│       ├── db/
│       │   ├── index.js     ← Conexão com o banco (singleton — uma Pool para todo o app)
│       │   └── schema.sql   ← Estrutura completa do banco de dados
│       ├── middleware/
│       │   ├── auth.js      ← Verifica o JWT antes de deixar passar nas rotas protegidas
│       │   ├── validate.js  ← Valida os dados recebidos com Zod (impede lixo no banco)
│       │   ├── rateLimiter.js ← Limita tentativas de login e requisições (anti-brute force)
│       │   ├── upload.js    ← Recebe arquivos de imagem na memória (sem salvar no disco)
│       │   └── securityLogger.js ← Registra eventos de segurança em JSON estruturado
│       ├── controllers/
│       │   ├── auth.js      ← Cadastro, login e logout
│       │   ├── restaurant.js ← CRUD do restaurante do usuário logado
│       │   ├── categories.js ← CRUD de categorias do cardápio
│       │   ├── items.js     ← CRUD de itens do cardápio
│       │   ├── public.js    ← Retorna o cardápio para o cliente final (sem login)
│       │   └── upload.js    ← Envia a imagem para o Cloudflare R2
│       └── routes/
│           ├── auth.js      ← POST /register, /login, /logout
│           ├── restaurant.js ← GET/POST/PUT /api/restaurant
│           ├── categories.js ← GET/POST/PUT/DELETE /api/categories
│           ├── items.js     ← GET/POST/PUT/DELETE /api/items
│           ├── public.js    ← GET /api/menu/:slug (sem autenticação)
│           └── upload.js    ← POST /api/upload/image
│
└── client/                  ← Tudo do frontend (SPA React)
    └── src/
        ├── api/
        │   └── index.js     ← Instância do Axios com interceptor de 401 (redireciona para /login)
        ├── context/
        │   └── AuthContext.jsx ← Estado global do usuário logado (login/logout)
        ├── components/
        │   ├── Navbar.jsx        ← Barra de navegação do painel
        │   ├── ProtectedRoute.jsx ← Redireciona para /login se não estiver logado
        │   └── ImageUploadField.jsx ← Campo de upload de imagem (arquivo ou URL)
        └── pages/
            ├── Login.jsx         ← Tela de login
            ├── Register.jsx      ← Tela de cadastro
            ├── Dashboard.jsx     ← Painel com QR Code e ações rápidas
            ├── Categories.jsx    ← Gerenciar categorias do cardápio
            ├── Items.jsx         ← Gerenciar itens de uma categoria
            ├── Settings.jsx      ← Configurar nome, slug, logo e WhatsApp
            └── PublicMenu.jsx    ← Cardápio público + carrinho + pedido via WhatsApp
```

---

## Como rodar localmente

### Pré-requisitos

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **PostgreSQL** — Pode usar uma conta gratuita no [Supabase](https://supabase.com) ou instalar localmente
- **Cloudflare R2** — Só é necessário se quiser testar o upload de imagens

---

### Passo 1: Configurar o banco de dados

**Opção A — Supabase (mais fácil):**
1. Crie um projeto gratuito em [supabase.com](https://supabase.com)
2. Vá em **SQL Editor** e cole o conteúdo de `server/src/db/schema.sql`
3. Copie a **Connection String** em **Project Settings → Database → Connection string → URI**

**Opção B — PostgreSQL local:**
```bash
createdb menuqr
psql menuqr < server/src/db/schema.sql
# Connection string: postgresql://localhost/menuqr
```

---

### Passo 2: Configurar o backend

```bash
cd server
npm install
cp .env.example .env
```

Abra o arquivo `.env` e preencha:

```env
# String de conexão com o PostgreSQL
DATABASE_URL=postgresql://postgres:suasenha@host:5432/postgres

# Segredo para assinar os tokens JWT
# Gere um com: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=coloque_aqui_um_segredo_longo_e_aleatorio

# Porta do servidor (deixe 3001 para desenvolvimento)
PORT=3001

# URL do frontend — necessário para o CORS funcionar
CLIENT_URL=http://localhost:5173

# Ambiente
NODE_ENV=development

# Cloudflare R2 — preencha só se quiser testar upload de imagens
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

Inicie o servidor:

```bash
npm run dev
# Servidor rodando em http://localhost:3001
```

---

### Passo 3: Configurar o frontend

```bash
cd client
npm install
cp .env.example .env
```

O arquivo `.env` do cliente é simples:

```env
VITE_API_URL=http://localhost:3001/api
```

Inicie o frontend:

```bash
npm run dev
# Acessível em http://localhost:5173
```

---

### Passo 4: Acessar o sistema

Abra `http://localhost:5173` no navegador, crie uma conta e configure seu restaurante.

---

## Como o banco de dados está organizado

```
users (usuários que têm conta no sistema)
  └── restaurants (cada usuário tem exatamente um restaurante)
        ├── categories (categorias do cardápio: Lanches, Bebidas...)
        │     └── items (itens de cada categoria: X-Burguer, Coca-Cola...)
```

**Campos importantes:**

| Campo | Onde | Descrição |
|-------|------|-----------|
| `slug` | restaurants | Identificador único da URL. Ex: `lanche-do-joao` → `/menu/lanche-do-joao` |
| `whatsapp` | restaurants | Número só com dígitos (ex: `11999998888`). Se vazio, o cardápio fica só para visualização |
| `active` | items | Um item pode ser desativado sem precisar apagar |
| `order` | categories, items | Número inteiro que define a ordem de exibição |
| `password_hash` | users | A senha nunca é salva — só o hash gerado pelo bcrypt |

---

## Como funciona a autenticação

1. O usuário faz login com email e senha
2. O servidor valida as credenciais e gera um **token JWT**
3. O token é enviado em um **cookie HttpOnly** — o JavaScript do navegador não consegue lê-lo (proteção contra XSS)
4. A cada requisição, o navegador envia o cookie automaticamente
5. O middleware `auth.js` verifica o token antes de qualquer rota protegida
6. Ao fazer logout, o token é adicionado a uma blocklist no banco — fica inválido imediatamente, mesmo antes de expirar
7. Se houver 5 tentativas de login com senha errada, a conta fica bloqueada por 15 minutos

---

## Rotas da API

### Autenticação — `/api/auth`

| Método | Rota | Precisa de login? | O que faz |
|--------|------|:-----------------:|-----------|
| POST | `/register` | Não | Cria uma nova conta |
| POST | `/login` | Não | Faz login e define o cookie com o token |
| POST | `/logout` | Sim | Invalida o token e remove o cookie |

### Restaurante — `/api/restaurant`

| Método | Rota | Precisa de login? | O que faz |
|--------|------|:-----------------:|-----------|
| GET | `/` | Sim | Retorna os dados do restaurante do usuário logado |
| POST | `/` | Sim | Cria o restaurante (só um por usuário) |
| PUT | `/` | Sim | Atualiza os dados do restaurante |

### Categorias — `/api/categories`

| Método | Rota | Precisa de login? | O que faz |
|--------|------|:-----------------:|-----------|
| GET | `/` | Sim | Lista todas as categorias |
| POST | `/` | Sim | Cria uma nova categoria |
| PUT | `/:id` | Sim | Edita nome ou ordem da categoria |
| DELETE | `/:id` | Sim | Apaga a categoria e todos os itens dela |

### Itens — `/api/items`

| Método | Rota | Precisa de login? | O que faz |
|--------|------|:-----------------:|-----------|
| GET | `/category/:id` | Sim | Lista os itens de uma categoria |
| POST | `/category/:id` | Sim | Cria um novo item |
| PUT | `/:id` | Sim | Edita nome, preço, descrição, foto ou status |
| DELETE | `/:id` | Sim | Apaga o item permanentemente |

### Cardápio público — `/api/menu`

| Método | Rota | Precisa de login? | O que faz |
|--------|------|:-----------------:|-----------|
| GET | `/:slug` | Não | Retorna restaurante + categorias + itens ativos |

### Upload de imagens — `/api/upload`

| Método | Rota | Precisa de login? | O que faz |
|--------|------|:-----------------:|-----------|
| POST | `/image` | Sim | Envia uma imagem para o Cloudflare R2 e retorna a URL |

---

## Segurança implementada

| Proteção | Como funciona |
|----------|--------------|
| Rate limiting | Login: 5 tentativas/15min. Geral: 120 req/min. Cardápio público: 60 req/min |
| Helmet | Define headers HTTP de segurança e Content Security Policy restritiva |
| CORS | Só aceita requisições da URL do frontend configurada em `CLIENT_URL` |
| Validação com Zod | Todos os campos recebidos são validados antes de tocar no banco |
| Bcrypt (12 rounds) | Senhas nunca são salvas em texto puro, só o hash |
| Timing attack | O tempo de resposta é o mesmo para email válido ou inválido (usa hash fictício) |
| Bloqueio por tentativas | 5 logins errados bloqueiam a conta por 15 minutos |
| Token blocklist | Logout invalida o token imediatamente via JTI no banco |
| Cookie HttpOnly | O token JWT não é acessível por JavaScript do navegador |

---

## Como fazer o deploy

### Backend no Render

1. Crie um **Web Service** em [render.com](https://render.com)
2. Conecte ao repositório do GitHub
3. Configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. Em **Environment**, adicione todas as variáveis do `server/.env`
5. Copie a URL do serviço (ex: `https://menuqr-api.onrender.com`)

### Frontend no Vercel

1. Importe o repositório em [vercel.com](https://vercel.com)
2. Configure:
   - **Root Directory**: `client`
   - **Framework Preset**: Vite
3. Em **Environment Variables**, adicione:
   - `VITE_API_URL` → URL do backend no Render (ex: `https://menuqr-api.onrender.com/api`)

---

## Como adicionar uma nova funcionalidade

Exemplo: adicionar um campo **"tempo de preparo"** nos itens.

**1. Banco de dados** — adicione a coluna:

```bash
cd server && node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query('ALTER TABLE items ADD COLUMN IF NOT EXISTS tempo_preparo_minutos INTEGER').then(() => {
  console.log('Coluna adicionada!');
  pool.end();
});
"
```

**2. Validação** — em `server/src/middleware/validate.js`, adicione o campo no schema:

```js
// Dentro de itemCreateSchema:
tempo_preparo_minutos: z.number().int().min(1).max(300).optional(),
```

**3. Controller** — em `server/src/controllers/items.js`, inclua o campo nas queries de `createItem` e `updateItem`.

**4. Frontend** — em `client/src/pages/Items.jsx`, adicione o campo no formulário.

**5. Cardápio público** — se quiser exibir no cardápio, atualize `client/src/pages/PublicMenu.jsx`.

---

## Variáveis de ambiente — referência completa

### `server/.env`

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `DATABASE_URL` | Sim | String de conexão PostgreSQL |
| `JWT_SECRET` | Sim | Segredo para assinar tokens (mínimo 64 bytes) |
| `PORT` | Não | Porta do servidor (padrão: `3001`) |
| `CLIENT_URL` | Sim | URL do frontend (configura o CORS) |
| `NODE_ENV` | Não | `development` ou `production` |
| `R2_ACCOUNT_ID` | Para upload | ID da conta Cloudflare |
| `R2_ACCESS_KEY_ID` | Para upload | Chave de acesso R2 |
| `R2_SECRET_ACCESS_KEY` | Para upload | Chave secreta R2 |
| `R2_BUCKET_NAME` | Para upload | Nome do bucket R2 |
| `R2_PUBLIC_URL` | Para upload | URL pública do bucket (ex: `https://pub-xxx.r2.dev`) |

### `client/.env`

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `VITE_API_URL` | Sim | URL base da API (ex: `http://localhost:3001/api`) |

---

## Problemas comuns

**"CORS error" ao chamar a API**
→ Verifique se `CLIENT_URL` no `server/.env` bate com a URL exata do frontend (incluindo porta).

**Login retorna erro mas as credenciais estão certas**
→ A conta pode estar bloqueada por excesso de tentativas. Aguarde 15 minutos ou atualize `locked_until = NULL` diretamente no banco.

**Upload de imagem não funciona**
→ Confira se as variáveis `R2_*` estão preenchidas corretamente e se o bucket tem acesso público habilitado.

**QR Code abre página em branco**
→ Verifique se o `slug` está cadastrado e se o frontend está acessível na URL que o QR Code aponta.

**Banco de dados: "relation does not exist"**
→ O schema não foi aplicado. Execute o conteúdo de `server/src/db/schema.sql` no banco.
