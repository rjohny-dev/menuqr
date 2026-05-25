---
name: run-menuqr
description: Run, start, build, test, screenshot, verify, or drive the MenuQR web app (React frontend + Express backend). Use this skill when asked to run the app, take a screenshot, check a feature, or verify a change works.
---

MenuQR is a React + Express SaaS web app. The frontend (Vite, port 5173) and backend (Express, port 3001) must both be running. The driver is `.claude/skills/run-menuqr/driver.mjs` — a Playwright-based harness that exercises the full golden path via API and takes browser screenshots without any manual interaction.

## Prerequisites

Node.js 18+ (already installed). Playwright chromium browser:

```bash
cd e:/SaaS
npm install          # installs playwright at root
npx playwright install chromium
```

Both `.env` files must exist (they do — already committed):
- `server/.env` — `DATABASE_URL`, `JWT_SECRET`, `PORT=3001`, `CLIENT_URL`
- `client/.env` — `VITE_API_URL=http://localhost:3001/api`

## Start both servers

Run each in a separate terminal and leave them running:

```bash
# Terminal 1 — backend on http://localhost:3001
cd server && npm run dev

# Terminal 2 — frontend on http://localhost:5173
cd client && npm run dev
```

Verify backend is up: `curl http://localhost:3001/api/health` → `{"status":"ok"}`

## Run (agent path)

### Full golden-path smoke test + screenshots

```bash
cd e:/SaaS
node .claude/skills/run-menuqr/driver.mjs smoke
```

This registers a fresh test user, creates a restaurant, category, and item via API, then launches Chromium headless and screenshots:
- `01-login.png` — login page
- `02-register.png` — register page
- `03-dashboard.png` — authenticated dashboard with QR code
- `04-categories.png` — categories management page
- `05-public-menu.png` — public menu (`/menu/:slug`)

Screenshots land in `.claude/skills/run-menuqr/screenshots/`.

### Single screenshot

```bash
node .claude/skills/run-menuqr/driver.mjs screenshot http://localhost:5173/login my-shot
# → .claude/skills/run-menuqr/screenshots/my-shot.png
```

### API-only smoke (no browser)

```bash
node .claude/skills/run-menuqr/driver.mjs api-smoke
```

Tests register + login only. Useful when verifying backend changes without Playwright.

### Environment overrides

```bash
BACKEND_URL=http://localhost:3001 FRONTEND_URL=http://localhost:5173 SS_DIR=./tmp/ss \
  node .claude/skills/run-menuqr/driver.mjs smoke
```

## Run (human path)

Start both servers as above, then open `http://localhost:5173` in a browser. Register an account, create a restaurant, add categories and items. The public menu is at `http://localhost:5173/menu/<your-slug>`.

## Test

No automated test suite. The driver's `smoke` command is the functional test. Run it after any backend or frontend change.

## Gotchas

- **`register` requires `name`** — not just `email`+`password`. The README doesn't say so. The controller returns `400: "Todos os campos são obrigatórios"` if `name` is omitted.
- **`apiFetch` header merging bug (fixed in driver)** — spreading `opts` after building the merged headers object overwrites `Content-Type`, causing the body to arrive un-parsed. The driver uses explicit destructuring to avoid this.
- **curl argument escaping on Windows** — backlash-escaped JSON in `execSync` shell args breaks silently on Windows PowerShell/CMD. The driver uses Node's built-in `fetch` for all API calls instead.
- **`/api/restaurant POST` returns 400 if restaurant already exists** — each test run creates a new user so slugs don't collide. Don't reuse users across smoke runs.
- **Frontend route after login** — the app redirects to `/dashboard` after login. Playwright waits with `waitForURL(/dashboard/)` then `waitForTimeout(1500)` to let React hydrate.
- **`whatsapp` field controls cart UI** — if `whatsapp` is null/empty, the public menu renders view-only (no cart). Set it via PUT `/api/restaurant` to test the cart flow.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `FAILED: Backend not responding` | `cd server && npm run dev` — check for port conflict on 3001 |
| `FAILED: Frontend not responding` | `cd client && npm run dev` — check for port conflict on 5173 |
| `400: "Todos os campos são obrigatórios"` on register | Pass `name` in the body |
| `400: "Esse slug já está em uso"` | Driver generates `driver-<timestamp>` slugs — shouldn't collide unless clock is frozen |
| Playwright launch fails | `npx playwright install chromium` — browser binaries not installed |
| Screenshot is blank white page | Frontend not running or Vite still compiling — wait 3s and retry |
