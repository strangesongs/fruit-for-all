// The season shelf (landing b2): what's in season near a person, nearest first.
// Pure helpers, no DOM — unit-tested in tests/client/seasonShelf.test.js.
//
// Rules (product map, Oct 23 2026; "shelf rules" board on the design canvas):
//   - up to 5 entries, one per kind of fruit, in season only, nearest first
//   - a walk first (~1 mi); if that finds fewer than 5 kinds, widen once to a
//     bike ride (~3 mi) and say so; if nothing is in season within 3 mi, show the
//     nearest in-season finds anywhere (among the finds loaded) with distances
//   - anchored to the person, not the map: the caller passes the anchor
import { ripenessOf, distanceMiles, noteSnippet } from './pinSummary.js';
import { familyOf } from './fruitFamilies.js';

export const SHELF_SIZE = 5;
export const WALK_MI = 1;
export const BIKE_MI = 3;

const EXCLUDE = ['test', 'tests', 'demo', 'testing', 'user'];

/**
 * @param {Array} pins      every pin loaded (not only the ones in view)
 * @param {{lat,lng}} anchor  where the shelf is measured from
 * @param {number} month    1–12
 * @returns {{ tier: 'walk'|'bike'|'anywhere'|'none'|'nowhere', walkCount: number, entries: Array }}
 *   tier 'walk': everything shown is within a walk; 'bike': some are by bike;
 *   'anywhere': nothing within 3 mi, these are the nearest in season;
 *   'none': no finds in season loaded at all; 'nowhere': no anchor yet.
 *   Each entry: { fruitType, family, count, distanceMi, nearest, note, noteBy, walk }.
 */
export function buildShelf(pins, anchor, month, { size = SHELF_SIZE, walkMi = WALK_MI, bikeMi = BIKE_MI } = {}) {
  if (!anchor || !Number.isFinite(anchor.lat) || !Number.isFinite(anchor.lng)) {
    return { tier: 'nowhere', walkCount: 0, entries: [] };
  }

  // One group per kind of fruit in season, with its nearest find and how many are close.
  const byKind = new Map();
  for (const pin of pins || []) {
    if (!pin || pin.cluster || !pin.fruitType || !pin.coordinates) continue;
    const key = String(pin.fruitType).toLowerCase();
    if (EXCLUDE.some((w) => key.includes(w))) continue;
    if (ripenessOf(pin, month) !== 'ripe') continue;
    const d = distanceMiles(anchor, pin.coordinates);
    if (d == null || !Number.isFinite(d)) continue;
    let g = byKind.get(key);
    if (!g) {
      g = { fruitType: key, family: familyOf(key), count: 0, countNear: 0, distanceMi: Infinity, nearest: null, note: '', noteBy: null };
      byKind.set(key, g);
    }
    g.count += 1;
    if (d <= bikeMi) g.countNear += 1;
    if (d < g.distanceMi) {
      g.distanceMi = d;
      g.nearest = { lat: pin.coordinates.lat, lng: pin.coordinates.lng };
      // The note shown is the nearest find's, so it describes the tree you'd walk to.
      g.note = pin.notes ? noteSnippet(pin.notes) : '';
      g.noteBy = pin.notes ? pin.submittedBy || null : null;
    }
  }

  const kinds = [...byKind.values()].sort((a, b) => a.distanceMi - b.distanceMi || a.fruitType.localeCompare(b.fruitType));
  if (kinds.length === 0) return { tier: 'none', walkCount: 0, entries: [] };

  const toEntry = (g, near) => ({
    fruitType: g.fruitType,
    family: g.family,
    count: near ? g.countNear : g.count,
    distanceMi: g.distanceMi,
    nearest: g.nearest,
    note: g.note,
    noteBy: g.noteBy,
    walk: g.distanceMi <= walkMi,
  });

  const walk = kinds.filter((g) => g.distanceMi <= walkMi);
  if (walk.length >= size) {
    return { tier: 'walk', walkCount: walk.length, entries: walk.slice(0, size).map((g) => toEntry(g, true)) };
  }
  const bike = kinds.filter((g) => g.distanceMi <= bikeMi);
  if (bike.length > 0) {
    const tier = bike.length > walk.length ? 'bike' : 'walk';
    return { tier, walkCount: walk.length, entries: bike.slice(0, size).map((g) => toEntry(g, true)) };
  }
  return { tier: 'anywhere', walkCount: 0, entries: kinds.slice(0, size).map((g) => toEntry(g, false)) };
}

/** The line under the entries that says how far the shelf reaches, or ''. */
export function shelfReachText(shelf) {
  if (!shelf) return '';
  const n = shelf.entries.length;
  if (shelf.tier === 'walk') return n === 1 ? 'within a walk' : `all ${n} within a walk`;
  if (shelf.tier === 'bike') {
    const more = n - shelf.walkCount;
    return shelf.walkCount === 0
      ? `none within a walk · ${more} by bike`
      : `${shelf.walkCount} within a walk · ${more} more by bike`;
  }
  if (shelf.tier === 'anywhere') return 'nothing in season within 3 miles · nearest first';
  return '';
}

/**
 * The running head's second line.
 * @param {{kind: 'precise'|'approx'|'area'|'none', city?: string|null}} anchor
 * @param {string} monthName  e.g. 'october'
 */
export function shelfHeadText(anchor, monthName) {
  const kind = anchor && anchor.kind;
  if (kind === 'precise') return `in season near you · ${monthName}`;
  if (kind === 'area') return `in season near here · ${monthName}`;
  if (kind === 'approx') return anchor.city ? `near ${String(anchor.city).toLowerCase()} (approx.)` : 'near you (approx.)';
  return `in season this ${monthName}`;
}

// ── The flag: ?landing=shelf turns the shelf on (and remembers it on this device);
// ?landing=bar turns it back off. Signed-out visitors only.
export const SHELF_FLAG_KEY = 'ffa_landing';

export function readShelfFlag(search, storage) {
  let param = null;
  try { param = new URLSearchParams(search || '').get('landing'); } catch { /* bad query */ }
  if (param === 'shelf' || param === 'bar') {
    try {
      if (param === 'shelf') storage && storage.setItem(SHELF_FLAG_KEY, 'shelf');
      else storage && storage.removeItem(SHELF_FLAG_KEY);
    } catch { /* private mode */ }
    return param === 'shelf';
  }
  try { return !!storage && storage.getItem(SHELF_FLAG_KEY) === 'shelf'; } catch { return false; }
}

let cachedFlag = null;
/** The flag for this page load (reads the URL and localStorage once). */
export function shelfEnabled() {
  if (cachedFlag !== null) return cachedFlag;
  if (typeof window === 'undefined') return false;
  let storage = null;
  try { storage = window.localStorage; } catch { /* blocked */ }
  cachedFlag = readShelfFlag(window.location.search, storage);
  return cachedFlag;
}

/** Show "search this area" once the map centre is this far from the anchor. */
export const SEARCH_AREA_MI = 1.5;
