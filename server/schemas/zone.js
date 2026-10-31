// USDA hardiness zone (1–13) for a find, from the 2023 USDA map.
//
// server/data/zip-zones.csv holds every ZIP code's centre point and zone
// (PRISM Climate Group's 2023 data, via frostline / phzmapi.org, MIT; regenerate
// with scripts/build-zip-zones.mjs). A find gets the zone of the nearest ZIP
// centre within MAX_KM. Further than that (open water, outside the US) or with
// no table, it falls back to the rough estimate in client/utils/zoneFallback.js.
// No network: the old phzmapi.com lookup never answered, so every zone saved
// before Nov 2026 is that estimate.
import { readFileSync } from 'node:fs';
import { detectZoneFallback } from '../../client/utils/zoneFallback.js';

export { detectZoneFallback };

export const ZIP_ZONES_FILE = new URL('../data/zip-zones.csv', import.meta.url);
export const MAX_KM = 50;

let table = null; // { lat: Float64Array, lng: Float64Array, zone: string[], cells: Map }
let loadFailed = false;

const cellKey = (lat, lng) => `${Math.floor(lat)},${Math.floor(lng)}`;

/** Parse the CSV (comment lines start with #; header lat,lng,zone). Exported for tests. */
export function parseZipZones(text) {
  const rows = text.split('\n').filter((l) => l && !l.startsWith('#') && !l.startsWith('lat,'));
  const lat = new Float64Array(rows.length);
  const lng = new Float64Array(rows.length);
  const zone = new Array(rows.length);
  const cells = new Map();
  rows.forEach((line, i) => {
    const [a, b, z] = line.split(',');
    lat[i] = Number(a);
    lng[i] = Number(b);
    zone[i] = z.trim();
    const k = cellKey(lat[i], lng[i]);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(i);
  });
  return { lat, lng, zone, cells };
}

function loadTable() {
  if (table || loadFailed) return table;
  try {
    table = parseZipZones(readFileSync(ZIP_ZONES_FILE, 'utf8'));
  } catch (err) {
    loadFailed = true;
    console.warn(`[zone] ${ZIP_ZONES_FILE.pathname} unreadable (${err.code || err.message}); using the rough estimate`);
  }
  return table;
}

/** Use a given table (or null to reload the file). Tests only. */
export function setZipZonesForTests(t) {
  table = t;
  loadFailed = false;
}

function km(lat1, lng1, lat2, lng2) {
  const toRad = Math.PI / 180;
  const x = (lng2 - lng1) * toRad * Math.cos(((lat1 + lat2) / 2) * toRad);
  const y = (lat2 - lat1) * toRad;
  return Math.sqrt(x * x + y * y) * 6371;
}

/**
 * The nearest ZIP centre's zone: { zone: 10, subzone: '10b', km } or null when
 * there's no table or nothing within MAX_KM.
 */
export function zoneFromTable(lat, lng, t = loadTable()) {
  if (!t || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const la = Math.floor(lat);
  const lo = Math.floor(lng);
  let best = -1;
  let bestKm = Infinity;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      for (const i of t.cells.get(`${la + dy},${lo + dx}`) || []) {
        const d = km(lat, lng, t.lat[i], t.lng[i]);
        if (d < bestKm) { bestKm = d; best = i; }
      }
    }
  }
  if (best < 0 || bestKm > MAX_KM) return null;
  const subzone = t.zone[best];
  const zone = parseInt(subzone, 10);
  if (!(zone >= 1 && zone <= 13)) return null;
  return { zone, subzone, km: bestKm };
}

/** Whole-number zone for a point: the table, else the rough estimate. */
export function zoneAt(lat, lng) {
  const hit = zoneFromTable(lat, lng);
  return hit ? hit.zone : detectZoneFallback(lat, lng);
}

/** Kept async for its callers (pins.js, pg/pins.js, the import); no network any more. */
export async function detectZone(lat, lng) {
  return zoneAt(lat, lng);
}
