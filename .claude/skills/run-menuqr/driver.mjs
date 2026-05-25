#!/usr/bin/env node
/**
 * MenuQR driver — Playwright-based harness for the web app.
 *
 * Usage:
 *   node driver.mjs [command] [args...]
 *
 * Commands:
 *   smoke        — run golden-path flow (API + browser), take screenshots
 *   screenshot   — take a screenshot of a URL: screenshot <url> <outfile>
 *   api-smoke    — test API endpoints (no browser needed)
 *   help         — show this help
 *
 * Both servers must already be running before calling the driver.
 *
 * Env overrides:
 *   BACKEND_URL  — default http://localhost:3001
 *   FRONTEND_URL — default http://localhost:5173
 *   SS_DIR       — screenshot output dir, default .claude/skills/run-menuqr/screenshots
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const SS_DIR = resolve(process.env.SS_DIR || `${__dirname}/screenshots`);

function ensureDir(d) { if (!existsSync(d)) mkdirSync(d, { recursive: true }); }

let sessionCookie = '';

async function apiFetch(path, { method = 'GET', headers = {}, body } = {}) {
  const url = `${BACKEND_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/token=([^;]+)/);
    if (match) sessionCookie = `token=${match[1]}`;
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function takeScreenshot(page, name) {
  ensureDir(SS_DIR);
  const out = resolve(SS_DIR, name.endsWith('.png') ? name : `${name}.png`);
  await page.screenshot({ path: out, fullPage: false });
  console.log(`  Screenshot: ${out}`);
  return out;
}

async function smokeTest() {
  console.log('=== MenuQR smoke test ===');

  // 1. Backend health
  console.log('\n[1] Backend health...');
  const health = await apiFetch('/api/health');
  console.log('  ', JSON.stringify(health));

  // 2. Frontend up
  console.log('[2] Frontend check...');
  const fRes = await fetch(FRONTEND_URL);
  if (!fRes.ok) throw new Error(`Frontend not OK: ${fRes.status}`);
  console.log('  status:', fRes.status);

  // 3. Register
  const email = `driver_${Date.now()}@test.com`;
  const password = 'Test1234!';
  console.log(`\n[3] Register: ${email}`);
  const reg = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: { name: 'Driver Test', email, password },
  });
  console.log('  userId:', reg.user?.id);

  // 4. Login (verify, refreshes cookie)
  console.log('[4] Login check...');
  await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  console.log('  Login OK, cookie:', sessionCookie.slice(0, 30) + '...');

  // 5. Create restaurant
  const slug = `driver-${Date.now()}`;
  console.log(`[5] Create restaurant slug=${slug}`);
  const rest = await apiFetch('/api/restaurant', {
    method: 'POST',
    body: { name: 'Driver Test Resto', slug },
  });
  console.log('  Restaurant:', rest.name, 'id:', rest.id);

  // 6. Create category
  console.log('[6] Create category...');
  const cat = await apiFetch('/api/categories', {
    method: 'POST',
    body: { name: 'Drinks' },
  });
  console.log('  Category:', cat.name, 'id:', cat.id);

  // 7. Create item
  console.log('[7] Create item...');
  const item = await apiFetch(`/api/items/category/${cat.id}`, {
    method: 'POST',
    body: { name: 'Water', description: 'Cold water', price: 2.50, active: true },
  });
  console.log('  Item:', item.name, 'price:', item.price);

  // 8. Public menu
  console.log('[8] Public menu...');
  const menu = await apiFetch(`/api/menu/${slug}`);
  console.log(`  Menu: "${menu.restaurant?.name}", categories: ${menu.categories?.length}`);

  // 9. Screenshots
  console.log('\n[9] Browser screenshots...');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Login page
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 20000 });
  await takeScreenshot(page, '01-login');

  // Register page
  await page.goto(`${FRONTEND_URL}/register`, { waitUntil: 'networkidle', timeout: 20000 });
  await takeScreenshot(page, '02-register');

  // Login via UI → dashboard
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await takeScreenshot(page, '03-dashboard');

  // Categories page
  await page.goto(`${FRONTEND_URL}/categories`, { waitUntil: 'networkidle', timeout: 20000 });
  await takeScreenshot(page, '04-categories');

  // Public menu
  await page.goto(`${FRONTEND_URL}/menu/${slug}`, { waitUntil: 'networkidle', timeout: 20000 });
  await takeScreenshot(page, '05-public-menu');

  await browser.close();
  console.log('\n=== Smoke test PASSED ===');
  console.log(`Screenshots in: ${SS_DIR}`);
}

async function singleScreenshot(url, name) {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
  await takeScreenshot(page, name);
  await browser.close();
}

async function apiSmoke() {
  console.log('=== MenuQR API smoke ===');
  const h = await apiFetch('/api/health');
  console.log('Health:', JSON.stringify(h));

  const email = `api_${Date.now()}@test.com`;
  const reg = await apiFetch('/api/auth/register', {
    method: 'POST', body: { name: 'API Smoke', email, password: 'Test1234!' },
  });
  console.log('Register: OK, userId:', reg.user?.id);

  await apiFetch('/api/auth/login', {
    method: 'POST', body: { email, password: 'Test1234!' },
  });
  console.log('Login: OK, cookie:', sessionCookie.slice(0, 30) + '...');
  console.log('=== API smoke PASSED ===');
}

const [,, cmd = 'help', ...args] = process.argv;

const handlers = {
  smoke: smokeTest,
  'api-smoke': apiSmoke,
  screenshot: () => {
    const [url, name = 'screenshot'] = args;
    if (!url) { console.error('Usage: screenshot <url> [name]'); process.exit(1); }
    return singleScreenshot(url, name);
  },
  help: async () => console.log(`
MenuQR Driver

Commands:
  node driver.mjs smoke                     Full golden-path + screenshots
  node driver.mjs api-smoke                 API-only smoke (no browser)
  node driver.mjs screenshot <url> [name]   Single screenshot

Servers must be running first:
  cd server && npm run dev    # port 3001
  cd client && npm run dev    # port 5173
`),
};

const fn = handlers[cmd];
if (!fn) { console.error(`Unknown command: ${cmd}`); process.exit(1); }
fn().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
