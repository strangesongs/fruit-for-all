// Preview server: the built app (dist/) with a fake, in-memory API.
//
//   npm run build && npm run preview          → http://localhost:4173
//
// For trying a branch on a phone without touching production: no DynamoDB, no email,
// no JWT secret. Everything lives in memory and is gone when you stop it (Ctrl-C).
//   - Any username + password signs you in (or registers). A name starting with
//     "admin" signs in as admin (no nudge limit, can edit anyone's finds).
//   - The first time the map asks for an area, a few sample finds appear near its
//     centre (where you are), so there's something to look at and a "same tree" to hit.
//   - Validation is the real one (fruit list, notes, profanity, the edit range).
//
// On an iPhone, Safari only shares your location over https, so open it through a
// tunnel, e.g. `cloudflared tunnel --url http://localhost:4173` (brew install cloudflared).
// Map tiles go through this server: Stadia with STADIA_API_KEY (npm run preview loads
// .env when it exists), falling back to OpenStreetMap's tiles if Stadia refuses.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FRUIT_LIST } from '../client/utils/fruitList.js';
import { withinNudge, NUDGE_LIMIT_M } from '../client/utils/findPlacement.js';
import { validatePinInput, validatePinUpdate } from '../server/schemas/validation.js';
import { containsProfanity } from '../server/utils/profanity.js';
import { detectZoneFallback } from '../client/utils/zoneFallback.js';
import { isPinId, validateReport, reportReasonLabel } from '../client/utils/findLinks.js';
import { findPageHtml } from '../server/utils/findPage.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(here, '..', 'dist');
const PORT = Number(process.env.PREVIEW_PORT) || 4173;
const STADIA_KEY = process.env.STADIA_API_KEY || '';
const FRUIT = new Set(FRUIT_LIST);
const TILE_HOST = 'https://tiles.stadiamaps.com/tiles/';

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('[preview] no dist/index.html: run `npm run build` first.');
  process.exit(1);
}

// ── fake data ────────────────────────────────────────────────────────────────
const pins = new Map(); // pinId → pin (with submittedBy)
const users = new Map(); // token → { userName, isAdmin }
let seeded = false;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function makeToken(userName) {
  // The app only decodes the payload to check `exp`; nothing here verifies it.
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ userName, exp: Math.floor(Date.now() / 1000) + 7 * 86400 })}.preview`;
}
function userFor(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  return m ? users.get(m[1]) || null : null;
}
function offset(c, northM, eastM) {
  return {
    lat: c.lat + northM / 111195,
    lng: c.lng + eastM / (111195 * Math.cos((c.lat * Math.PI) / 180)),
  };
}
function addPin(data) {
  const now = new Date().toISOString();
  const pin = {
    pinId: crypto.randomUUID(),
    createdAt: data.createdAt || now,
    updatedAt: null,
    coordinates: data.coordinates,
    fruitType: data.fruitType,
    fruitTypeDisplay: data.fruitType,
    notes: data.notes || '',
    submittedBy: data.submittedBy,
    geoHash: '',
    status: 'active',
    zone: detectZoneFallback(data.coordinates.lat, data.coordinates.lng),
    confirmations: data.confirmations || [],
  };
  pins.set(pin.pinId, pin);
  return pin;
}
// A handful of finds around the first area the map asks for (≈ where you are).
function seedAround(c) {
  if (seeded) return;
  seeded = true;
  const monthsAgo = (n) => new Date(Date.now() - n * 30 * 86400000).toISOString();
  const s = [
    { n: 10, e: 4, fruitType: 'fig', notes: 'sample find: over the alley fence, low branches', submittedBy: 'ana' },
    { n: -60, e: 45, fruitType: 'lemon', notes: 'sample find: parkway tree, ask at the house', submittedBy: 'ana' },
    { n: 120, e: -80, fruitType: 'loquat', notes: 'sample find: two trees by the bus stop', submittedBy: 'ben' },
    { n: -150, e: -140, fruitType: 'rosemary', notes: 'sample find: hedge along the school wall', submittedBy: 'ben' },
    { n: 260, e: 200, fruitType: 'persimmon', notes: 'sample find: hachiya, ripens soft', submittedBy: 'ana', createdAt: monthsAgo(8) },
    { n: 40, e: -30, fruitType: 'mulberry', notes: '', submittedBy: 'ben' },
  ];
  for (const p of s) addPin({ ...p, coordinates: offset(c, p.n, p.e) });
  console.log(`[preview] seeded ${s.length} sample finds near ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`);
}
function boundsOf(q) {
  const b = ['minLat', 'maxLat', 'minLng', 'maxLng'].map((k) => parseFloat(q[k]));
  return b.every(Number.isFinite) ? { minLat: b[0], maxLat: b[1], minLng: b[2], maxLng: b[3] } : null;
}
function listPins(q) {
  const b = boundsOf(q);
  if (b) seedAround({ lat: (b.minLat + b.maxLat) / 2, lng: (b.minLng + b.maxLng) / 2 });
  return [...pins.values()].filter((p) => !b || (
    p.coordinates.lat >= b.minLat && p.coordinates.lat <= b.maxLat
    && p.coordinates.lng >= b.minLng && p.coordinates.lng <= b.maxLng));
}
const strip = ({ submittedBy, reports, ...pin }) => pin;

// ── app ──────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '50kb' }));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store'); // always the latest build
  next();
});

app.get('/health', (req, res) => res.json({ ok: true, preview: true }));
// Network guess: LA (the map then asks for precise location when you add a find).
app.get('/api/locate', (req, res) => res.json({ lat: 34.0614, lng: -118.294, city: 'los angeles (preview)' }));

function signIn(req, res) {
  const { userName, password } = req.body || {};
  if (typeof userName !== 'string' || !userName.trim() || typeof password !== 'string' || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required' });
  }
  const name = userName.trim();
  const user = { userName: name, isAdmin: /^admin/i.test(name) };
  const token = makeToken(name);
  users.set(token, user);
  console.log(`[preview] signed in as ${name}${user.isAdmin ? ' (admin)' : ''}`);
  return res.json({ success: true, token, user: { userName: name, email: `${name}@preview.local`, isAdmin: user.isAdmin } });
}
app.post('/api/auth/login', signIn);
app.post('/api/auth/register', signIn);
app.post('/api/auth/forgot-password', (req, res) => res.json({ success: true, message: 'preview: no email sent' }));
app.post('/api/auth/reset-password', (req, res) => res.status(400).json({ success: false, message: 'Not available in preview' }));

app.get('/api/pins/public', (req, res) => res.json({ success: true, pins: listPins(req.query).map(strip), cursor: null, hasMore: false }));
app.get('/api/pins', (req, res) => {
  if (!userFor(req)) return res.status(401).json({ success: false, message: 'Sign in again (the preview restarted?)' });
  return res.json({ success: true, pins: listPins(req.query), cursor: null, hasMore: false });
});

// One find, for a shared link (/find/<id>).
app.get('/api/pins/:pinId', (req, res) => {
  const pin = pins.get(String(req.params.pinId).toLowerCase());
  if (!pin) return res.status(404).json({ success: false, message: 'No such find' });
  return res.json({ success: true, pin: strip(pin) });
});

// "report a problem": the real validation; logged here instead of emailed.
const reported = new Set(); // `${pinId}|${ip}`, for the once-a-day rule
app.post('/api/pins/:pinId/report', (req, res) => {
  const check = validateReport(req.body);
  if (!check.valid) return res.status(400).json({ success: false, message: check.message });
  const pin = pins.get(String(req.params.pinId).toLowerCase());
  if (!pin) return res.status(404).json({ success: false, message: 'No such find' });
  const key = `${pin.pinId}|${req.ip}`;
  if (reported.has(key)) return res.status(409).json({ success: false, message: 'You already reported this find today. Thank you.' });
  reported.add(key);
  (pin.reports ||= []).push({ ...check.report, at: new Date().toISOString() });
  console.log(`[preview] report on ${pin.fruitType}: ${reportReasonLabel(check.report.reason)}${check.report.note ? ` (“${check.report.note}”)` : ''}`);
  return res.json({ success: true });
});

app.post('/api/pins', (req, res) => {
  const user = userFor(req);
  if (!user) return res.status(401).json({ success: false, message: 'Sign in again' });
  const check = validatePinInput(req.body, FRUIT);
  if (!check.valid) return res.status(400).json({ success: false, message: check.message });
  if (containsProfanity(req.body.notes)) return res.status(400).json({ success: false, message: 'Please keep notes family-friendly.' });
  const { coordinates, fruitType, notes } = req.body;
  const pin = addPin({ coordinates: { lat: coordinates.lat, lng: coordinates.lng }, fruitType: fruitType.trim().toLowerCase(), notes: (notes || '').trim(), submittedBy: user.userName });
  console.log(`[preview] added ${pin.fruitType} by ${user.userName}`);
  return res.json({ success: true, pin });
});

app.patch('/api/pins/:pinId', (req, res) => {
  const user = userFor(req);
  if (!user) return res.status(401).json({ success: false, message: 'Sign in again' });
  const check = validatePinUpdate(req.body, FRUIT);
  if (!check.valid) return res.status(400).json({ success: false, message: check.message });
  const pin = pins.get(req.params.pinId);
  if (!pin) return res.status(404).json({ success: false, message: 'Pin not found' });
  if (pin.submittedBy !== user.userName && !user.isAdmin) {
    return res.status(403).json({ success: false, message: 'Only admin or pin owner can edit this pin' });
  }
  const { notes, fruitType, coordinates } = req.body;
  if (notes !== undefined && containsProfanity(notes)) return res.status(400).json({ success: false, message: 'Please keep notes family-friendly.' });
  if (coordinates !== undefined && !withinNudge(pin.coordinates, coordinates) && !user.isAdmin) {
    return res.status(400).json({ success: false, message: `A find can only move about ${NUDGE_LIMIT_M} m. Delete it and add it again to move it further.` });
  }
  if (notes !== undefined) pin.notes = String(notes || '').trim();
  if (fruitType !== undefined) { pin.fruitType = fruitType.trim().toLowerCase(); pin.fruitTypeDisplay = pin.fruitType; }
  if (coordinates !== undefined) {
    pin.coordinates = { lat: coordinates.lat, lng: coordinates.lng };
    pin.zone = detectZoneFallback(coordinates.lat, coordinates.lng);
  }
  pin.updatedAt = new Date().toISOString();
  console.log(`[preview] edited ${pin.fruitType} (${Object.keys(req.body).join(', ')})`);
  return res.json({ success: true, message: 'Pin updated successfully', pin });
});

app.delete('/api/pins/:pinId', (req, res) => {
  const user = userFor(req);
  if (!user) return res.status(401).json({ success: false, message: 'Sign in again' });
  const pin = pins.get(req.params.pinId);
  if (!pin) return res.status(404).json({ success: false, message: 'Pin not found' });
  if (pin.submittedBy !== user.userName && !user.isAdmin) return res.status(403).json({ success: false, message: 'Only admin or pin owner can delete this pin' });
  pins.delete(pin.pinId);
  console.log(`[preview] deleted ${pin.fruitType}`);
  return res.json({ success: true, message: 'Pin deleted successfully' });
});

app.post('/api/pins/:pinId/confirm', (req, res) => {
  const pin = pins.get(req.params.pinId);
  if (!pin) return res.status(404).json({ success: false, message: 'Pin not found' });
  pin.confirmations.push({ timestamp: new Date().toISOString(), anonymous: true });
  return res.json({ success: true, confirmations: pin.confirmations });
});

app.all('/api/*', (req, res) => res.status(404).json({ success: false, message: 'Not in the preview API' }));

// Map tiles, always through this server: Stadia with the key when there is one,
// else (or when Stadia refuses, e.g. a 401 for an unregistered domain or a bad key)
// OpenStreetMap's standard tiles, which need no key. The tunnel's domain isn't
// registered with Stadia, so without this the map is a wall of 401 tiles.
let stadiaNoted = false;
async function fetchTile(url, headers = {}) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  return { status: r.status, type: r.headers.get('content-type') || 'image/png', body: Buffer.from(await r.arrayBuffer()) };
}
app.get('/__tiles/*', async (req, res) => {
  const rest = req.params[0]; // stamen_terrain/{z}/{x}/{y}.png
  const m = /(\d+)\/(\d+)\/(\d+)(?:@2x)?\.png$/.exec(rest);
  try {
    if (STADIA_KEY) {
      let status;
      try {
        const t = await fetchTile(`${TILE_HOST}${rest}?api_key=${encodeURIComponent(STADIA_KEY)}`);
        if (t.status === 200) return res.type(t.type).set('Cache-Control', 'public, max-age=86400').send(t.body);
        status = t.status;
      } catch (e) {
        status = 'no answer';
      }
      if (!stadiaNoted) {
        stadiaNoted = true;
        console.log(`[preview] Stadia answered ${status} with STADIA_API_KEY (check the key at client.stadiamaps.com); using OpenStreetMap tiles instead`);
      }
    }
    if (!m) return res.status(404).end();
    const t = await fetchTile(`https://tile.openstreetmap.org/${m[1]}/${m[2]}/${m[3]}.png`, {
      'User-Agent': 'fruit-for-all-preview/1.0 (local development preview)',
    });
    return res.status(t.status).type(t.type).set('Cache-Control', 'public, max-age=86400').send(t.body);
  } catch (e) {
    return res.status(502).end();
  }
});

// No service worker in preview: it would cache this build on localhost.
app.get('/sw.js', (req, res) => res.status(404).end());

// The app's JS, with the tile host pointed at the tile route above.
app.get(/\.js$/, (req, res, next) => {
  const file = path.join(DIST, path.normalize(req.path).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(DIST) || !fs.existsSync(file)) return next();
  const src = fs.readFileSync(file, 'utf8').split(TILE_HOST).join('/__tiles/');
  res.type('application/javascript').send(src);
});
app.use(express.static(DIST, { index: false }));
// A link to one find: the app with its preview tags, as the real server does.
app.get('/find/:pinId', (req, res) => {
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const pin = isPinId(req.params.pinId) ? pins.get(req.params.pinId.toLowerCase()) : null;
  if (!pin) return res.status(404).type('html').send(html);
  const base = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers.host}`;
  return res.type('html').send(findPageHtml(html, strip(pin), { baseUrl: base }));
});
app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));

app.listen(PORT, () => {
  console.log(`[preview] fruit for all (fake API, in memory) → http://localhost:${PORT}`);
  console.log(`[preview] map tiles: ${STADIA_KEY ? 'Stadia with STADIA_API_KEY, OpenStreetMap if Stadia refuses' : 'OpenStreetMap (no STADIA_API_KEY)'}`);
});
