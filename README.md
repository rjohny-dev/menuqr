# MenuQR — Cardápio Digital com QR Code

SaaS para criação de cardápios digitais acessíveis via QR Code. Donos de restaurantes gerenciam seu cardápio online e compartilham via link ou QR Code impresso.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Banco de dados | PostgreSQL (Supabase) |
| Autenticação | JWT (email + senha) |
| Deploy frontend | Vercel |
| Deploy backend | Render |

## Rodando localmente

### Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com) (ou PostgreSQL local)

### 1. Banco de dados

No painel do Supabase, vá em **SQL Editor** e execute o conteúdo de `server/src/db/schema.sql`.

### 2. Backend

```bash
cd server
npm install
cp .env.example .env
# Edite o .env com suas variáveis (veja abaixo)
npm run dev
```

### 3. Frontend

```bash
cd client
npm install
cp .env.example .env
# Edite: VITE_API_URL=http://localhost:3001/api
npm run dev
```

Acesse `http://localhost:5173`.

## Variáveis de ambiente

### `server/.env`

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Segredo para assinar tokens | `uma-string-aleatoria-longa` |
| `PORT` | Porta do servidor | `3001` |
| `CLIENT_URL` | URL do frontend (CORS) | `http://localhost:5173` |

### `client/.env`

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `VITE_API_URL` | URL base da API | `http://localhost:3001/api` |

## Deploy

### Backend no Render

1. Crie um **Web Service** no [Render](https://render.com)
2. Conecte ao repositório GitHub
3. Configure:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. Adicione as variáveis de ambiente (`DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`)

### Frontend no Vercel

1. Crie um projeto no [Vercel](https://vercel.com)
2. Conecte ao repositório GitHub
3. Configure:
   - **Root Directory:** `client`
   - **Framework Preset:** Vite
4. Adicione a variável `VITE_API_URL` apontando para a URL do Render

## Estrutura de pastas

```
menuqr/
├── client/                  # React + Vite
│   └── src/
│       ├── api/             # Instância axios
│       ├── components/      # Navbar, ProtectedRoute
│       ├── context/         # AuthContext (JWT)
│       └── pages/
│           ├── Login.jsx
│           ├── Register.jsx
│           ├── Dashboard.jsx    # QR Code + ações rápidas
│           ├── Categories.jsx   # CRUD de categorias
│           ├── Items.jsx        # CRUD de itens
│           ├── Settings.jsx     # Config do restaurante
│           └── PublicMenu.jsx   # Cardápio público /menu/:slug
└── server/
    └── src/
        ├── controllers/     # Lógica de negócio
        ├── db/              # Pool pg + schema.sql
        ├── middleware/      # JWT auth
        └── routes/          # Express routers
```

## Rotas da API

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/auth/register` | — | Criar conta |
| POST | `/api/auth/login` | — | Login |
| GET | `/api/restaurant` | JWT | Dados do restaurante |
| POST | `/api/restaurant` | JWT | Criar restaurante |
| PUT | `/api/restaurant` | JWT | Atualizar restaurante |
| GET | `/api/categories` | JWT | Listar categorias |
| POST | `/api/categories` | JWT | Criar categoria |
| PUT | `/api/categories/:id` | JWT | Editar categoria |
| DELETE | `/api/categories/:id` | JWT | Deletar categoria |
| GET | `/api/items/category/:id` | JWT | Listar itens |
| POST | `/api/items/category/:id` | JWT | Criar item |
| PUT | `/api/items/:id` | JWT | Editar item |
| DELETE | `/api/items/:id` | JWT | Deletar item |
| GET | `/api/menu/:slug` | — | Cardápio público |
