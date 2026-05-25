# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development (run each in its own terminal)

```bash
# Backend — http://localhost:3001
cd server && npm run dev

# Frontend — http://localhost:5173
cd client && npm run dev
```

### Production build

```bash
cd client && npm run build   # outputs to client/dist/
cd server && npm start       # runs server.js directly (no nodemon)
```

### Apply schema to database

```bash
cd server && node -e "
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query(fs.readFileSync('./src/db/schema.sql', 'utf8')).then(() => { console.log('ok'); pool.end(); });
"
```

### Run ad-hoc migrations

```bash
cd server && node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query('ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS ...').then(() => { pool.end(); });
"
```

### Health check

```bash
curl http://localhost:3001/api/health   # → {"status":"ok"}
```

## Architecture

### Data model

One user → one restaurant (enforced server-side). The restaurant has a `slug` (unique) that becomes the public URL. Data flows: `users → restaurants → categories → items`.

The `restaurants` table carries `whatsapp` (VARCHAR 20, digits only) used by the public menu to generate a WhatsApp order link (`wa.me/55{whatsapp}?text=...`).

### Backend (`server/`)

Plain Express with no ORM — raw `pg` Pool queries in controllers. Entry point is `server.js` → `src/app.js`.

All authenticated routes use `src/middleware/auth.js`, which verifies the JWT and attaches `req.user.userId`.

Route → controller mapping:
- `/api/auth` → `controllers/auth.js` (register/login, bcrypt + JWT)
- `/api/restaurant` → `controllers/restaurant.js` (one restaurant per user)
- `/api/categories` → `controllers/categories.js` (scoped to the authenticated user's restaurant)
- `/api/items` → `controllers/items.js` (scoped via `category_id`, ownership checked via JOIN)
- `/api/menu/:slug` → `controllers/public.js` (unauthenticated, returns restaurant + categories + active items)

The database pool is a singleton exported from `src/db/index.js`. SSL is required for Supabase (`rejectUnauthorized: false`).

### Frontend (`client/`)

React SPA (Vite). Token is stored in `localStorage` and injected into the axios instance (`src/api/index.js`) as a default header. `AuthContext` (`src/context/AuthContext.jsx`) syncs auth state on mount from localStorage and exposes `login` / `logout`.

`ProtectedRoute` redirects unauthenticated users to `/login`.

Public route `/menu/:slug` is completely unauthenticated. It conditionally renders the cart UI only when `restaurant.whatsapp` is set — if the field is empty, the menu is view-only.

All styles live in `src/index.css` as a single file using CSS custom properties (`--primary`, `--border`, etc.). No CSS modules or Tailwind.

### Environment variables

`server/.env`:
- `DATABASE_URL` — PostgreSQL connection string (Supabase URI format)
- `JWT_SECRET` — token signing secret
- `PORT` — default `3001`
- `CLIENT_URL` — CORS allowed origin, default `http://localhost:5173`

`client/.env`:
- `VITE_API_URL` — API base URL, default `http://localhost:3001/api`

### Deploy targets

- **Backend → Render**: root dir `server`, build `npm install`, start `node server.js`
- **Frontend → Vercel**: root dir `client`, framework preset Vite; set `VITE_API_URL` to the Render service URL
