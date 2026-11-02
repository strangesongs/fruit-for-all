// The width matrix: the built app in headless Chromium at the four sizes CLAUDE.md
// says to test (240×427 Jelly, 375×667 iPhone SE, 393×852 modern phone, 1280×800
// desktop), against the preview server's fake API (no database, real validation).
//
//   npm run build && npm run test:widths
//   npm run test:widths -- --out shots/   (screenshots of every step land there)
//
// Per width, three visits, and for each one:
//   - the layout tree that width should render is there (shelf strip / shelf bar /
//     sidebar signed out; FAB / auth bar / signed-in sidebar signed in),
//   - nothing scrolls sideways (documentElement.scrollWidth ≤ the viewport),
//   - no console errors and no uncaught exceptions.
// Plus:
//   - a find opened from its link (/find/<id>): the popup card is inside the
//     viewport and above the bottom bar, no map control sits on it, and its × is
//     the element under a tap,
//   - signed in, "add a find": the form's card is inside the viewport.
//
// Needs Chromium for Playwright (CI: `npx playwright install --with-deps chromium`).
// Exits 1 if anything failed, after printing every failure.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const PORT = Number(process.env.PREVIEW_PORT) || 4174;
const BASE = `http://localhost:${PORT}`;
const HOME = { latitude: 34.07, longitude: -118.27 };   // where the sample finds appear

const outIdx = process.argv.indexOf('--out');
const OUT = outIdx > 0 ? path.resolve(process.argv[outIdx + 1]) : null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });

export const SIZES = [
  { name: 'jelly', width: 240, height: 427, signedOut: '.shelf-strip', signedIn: '.mobile-fab' },
  { name: 'se', width: 375, height: 667, signedOut: '.guest-bar.shelf', signedIn: '.guest-bar.auth-bar' },
  { name: 'phone', width: 393, height: 852, signedOut: '.guest-bar.shelf', signedIn: '.guest-bar.auth-bar' },
  { name: 'desktop', width: 1280, height: 800, signedOut: '.sidebar', signedIn: '.sidebar.sidebar--authenticated' },
];

// A blank 1×1 PNG for every map tile: no network, nothing to wait for, no load errors.
const BLANK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

const failures = [];
let checks = 0;
function check(where, ok, what) {
  checks++;
  if (!ok) failures.push(`${where}: ${what}`);
}

function startPreview() {
  if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
    console.error('[widths] no dist/index.html: run `npm run build` first.');
    process.exit(1);
  }
  const env = { ...process.env, PREVIEW_PORT: String(PORT) };
  delete env.STADIA_API_KEY;   // tiles are stubbed anyway
  const child = spawn(process.execPath, [path.join(root, 'scripts', 'preview-server.mjs')], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('preview server did not start')), 15000);
    child.stdout.on('data', (buf) => {
      if (String(buf).includes(`localhost:${PORT}`)) { clearTimeout(timer); resolve(child); }
    });
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`preview server exited (${code})`)); });
  });
}

async function newPage(browser, size) {
  const phone = size.width <= 768;
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    geolocation: HOME,
    permissions: ['geolocation'],
    isMobile: phone,
    hasTouch: phone,
    deviceScaleFactor: 1,
    serviceWorkers: 'block',   // the preview server has none (it answers /sw.js with 404)
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`uncaught: ${e.message}`));
  await page.route(/\/__tiles\/|\/tiles\/|tile\.openstreetmap\.org|stadiamaps\.com/, (r) =>
    r.fulfill({ status: 200, contentType: 'image/png', body: BLANK_PNG }));
  // Fonts: no network either; the fallback faces are fine for measuring.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) =>
    r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  return { context, page, errors };
}

// Measured in the page: sideways overflow, and a box for each selector.
async function measure(page, selectors) {
  return page.evaluate((sels) => {
    const box = (s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height,
        shown: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' };
    };
    const chrome = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bottom-chrome')) || 0;
    const out = { scrollW: document.documentElement.scrollWidth, innerW: innerWidth, innerH: innerHeight, chrome, boxes: {} };
    for (const s of sels) out.boxes[s] = box(s);
    return out;
  }, selectors);
}

async function shot(page, size, step) {
  if (OUT) await page.screenshot({ path: path.join(OUT, `${size.width}x${size.height}-${step}.png`) });
}

function noOverflow(where, m) {
  check(where, m.scrollW <= m.innerW, `scrolls sideways (scrollWidth ${m.scrollW} > ${m.innerW})`);
}

function inside(where, label, b, m, { bottomInset = 0 } = {}) {
  if (!b) return check(where, false, `${label} missing`);
  const tol = 1;
  check(where, b.left >= -tol && b.right <= m.innerW + tol, `${label} off screen sideways (${Math.round(b.left)}…${Math.round(b.right)} of ${m.innerW})`);
  check(where, b.top >= -tol, `${label} top off screen (${Math.round(b.top)})`);
  check(where, b.bottom <= m.innerH - bottomInset + tol, `${label} bottom below ${m.innerH - bottomInset}px (${Math.round(b.bottom)})`);
}

// Map controls that must never sit on an open popup (hidden is fine).
const CONTROLS = ['.locate-me-btn', '.leaflet-control-zoom'];
function overlaps(a, b) {
  return a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
}

function noErrors(where, errors) {
  check(where, errors.length === 0, `console errors:\n    ${errors.join('\n    ')}`);
  errors.length = 0;
}

async function firstFindId(page) {
  // The preview server makes its sample finds the first time an area is asked for.
  const d = 0.05;
  const url = `/api/pins/public?minLat=${HOME.latitude - d}&maxLat=${HOME.latitude + d}&minLng=${HOME.longitude - d}&maxLng=${HOME.longitude + d}`;
  const res = await page.evaluate((u) => fetch(u).then((r) => r.json()), url);
  const pins = res.pins || [];
  // The longest note makes the tallest card: the hardest one to fit.
  pins.sort((a, b) => (b.notes || '').length - (a.notes || '').length);
  return pins[0] && pins[0].pinId;
}

async function runSize(browser, size) {
  const tag = `${size.width}×${size.height}`;

  // 1. Signed out, first visit.
  {
    const { context, page, errors } = await newPage(browser, size);
    const where = `${tag} signed out`;
    await page.goto(BASE + '/');
    await page.waitForSelector(size.signedOut, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const m = await measure(page, [size.signedOut]);
    check(where, m.boxes[size.signedOut] && m.boxes[size.signedOut].shown, `expected ${size.signedOut}`);
    noOverflow(where, m);
    await shot(page, size, 'landing');

    // 2. A find opened from its link.
    const id = await firstFindId(page);
    const w2 = `${tag} /find/<id>`;
    check(w2, !!id, 'no sample find to open');
    if (id) {
      await page.goto(`${BASE}/find/${id}`);
      await page.waitForSelector('.leaflet-popup-content-wrapper', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2000);   // PanToPin's fit + its 500 ms re-check
      const sel = ['.leaflet-popup-content-wrapper', '.leaflet-popup-close-button', ...CONTROLS];
      const pm = await measure(page, sel);
      const card = pm.boxes[sel[0]];
      inside(w2, 'popup card', card, pm, { bottomInset: size.width <= 360 ? 0 : pm.chrome });
      const x = pm.boxes[sel[1]];
      if (x) {
        const hit = await page.evaluate(([cx, cy]) => {
          const el = document.elementFromPoint(cx, cy);
          return !!(el && el.closest('.leaflet-popup-close-button'));
        }, [(x.left + x.right) / 2, (x.top + x.bottom) / 2]);
        check(w2, hit, 'the popup × is covered by something else');
      } else check(w2, false, 'popup × missing');
      for (const c of CONTROLS) {
        const b = pm.boxes[c];
        if (card && b && b.shown) check(w2, !overlaps(card, b), `a map control (${c}) sits on the popup card`);
      }
      noOverflow(w2, pm);
      await shot(page, size, 'find-link');
    }
    noErrors(where, errors);
    await context.close();
  }

  // 3. Signed in, then "add a find".
  {
    const { context, page, errors } = await newPage(browser, size);
    const where = `${tag} signed in`;
    await page.goto(BASE + '/');
    await page.evaluate(async () => {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: 'widths', password: 'preview' }) }).then((x) => x.json());
      localStorage.setItem('ffa_auth_token', r.token);
      localStorage.setItem('ffa_user', JSON.stringify(r.user));
    });
    await page.reload();
    await page.waitForSelector(size.signedIn, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const m = await measure(page, [size.signedIn]);
    check(where, m.boxes[size.signedIn] && m.boxes[size.signedIn].shown, `expected ${size.signedIn}`);
    noOverflow(where, m);
    await shot(page, size, 'signed-in');

    const w2 = `${tag} add a find`;
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('ffa:add-find')));
    await page.waitForSelector('.add-find-card', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const am = await measure(page, ['.add-find-card']);
    inside(w2, 'add-a-find card', am.boxes['.add-find-card'], am);
    noOverflow(w2, am);
    await shot(page, size, 'add-find');
    noErrors(where, errors);
    await context.close();
  }
}

async function main() {
  const server = await startPreview();
  const browser = await chromium.launch();
  try {
    for (const size of SIZES) {
      await runSize(browser, size);
      console.log(`[widths] ${size.width}×${size.height} done`);
    }
  } finally {
    await browser.close();
    server.kill();
  }
  if (failures.length) {
    console.error(`\n[widths] ${failures.length} of ${checks} checks failed:`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    if (process.env.GITHUB_ACTIONS) {
      for (const f of failures) console.log(`::error title=width matrix::${f.replace(/\n/g, '%0A')}`);
    }
    process.exit(1);
  }
  console.log(`[widths] all ${checks} checks passed${OUT ? ` (screenshots in ${path.relative(root, OUT)})` : ''}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
