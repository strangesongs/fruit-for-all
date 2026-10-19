// Pure helpers behind the bar's "in season / almanac / nearest" tabs, the pin rings
// and the catalog-entry popup. No DOM, no React — unit-tested in tests/client.
import { FRUIT_SEASONS, getSeasonForZone } from './fruitSeasons.js';
import { familyOf } from './fruitFamilies.js';
import { detectZoneFallback } from './zoneFallback.js';

const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** Season months (1–12) for a pin: its zone's months, else null. */
export function seasonMonthsFor(fruitType, zone) {
  if (!fruitType || !zone) return null;
  const key = String(fruitType).toLowerCase();
  if (!FRUIT_SEASONS[key]) return null;
  return getSeasonForZone(key, zone);
}

/**
 * USDA zone for a pin: the one saved when it was added (phzmapi.com), else an
 * estimate from where it is. Seasons follow the plant's location, not the viewer's.
 */
export function zoneOf(pin) {
  if (pin && pin.zone) return pin.zone;
  const c = pin && pin.coordinates;
  if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) return detectZoneFallback(c.lat, c.lng);
  return null;
}

/**
 * 'ripe' (in season) | 'quiet' | 'unknown' for a pin this month, using zoneOf(pin).
 * Kinds with no season data (many herbs and greens) are 'unknown' and drawn like
 * in season — we don't know they aren't.
 */
export function ripenessOf(pin, month) {
  const key = String(pin?.fruitType || '').toLowerCase();
  const data = FRUIT_SEASONS[key];
  if (!data) return 'unknown';
  const zone = zoneOf(pin);
  const months = zone ? getSeasonForZone(key, zone) : null;
  if (months) return months.includes(month) ? 'ripe' : 'quiet';
  const anyZone = Object.values(data.zones || {}).some((m) => m.includes(month));
  return anyZone ? 'ripe' : 'quiet';
}

/** "sep – nov", "nov – feb", "most of the year", or '' for a list of months. */
export function seasonRangeText(months) {
  if (!Array.isArray(months) || months.length === 0) return '';
  if (months.length >= 10) return 'all year';
  if (months.length > 6) return 'most of the year';
  const set = new Set(months);
  // Start = a month whose predecessor isn't in season (handles nov–feb wraparound).
  const start = months.find((m) => !set.has(m === 1 ? 12 : m - 1)) ?? months[0];
  let end = start;
  while (set.has(end === 12 ? 1 : end + 1) && (end === 12 ? 1 : end + 1) !== start) {
    end = end === 12 ? 1 : end + 1;
  }
  return start === end ? MONTH_ABBR[start - 1] : `${MONTH_ABBR[start - 1]} – ${MONTH_ABBR[end - 1]}`;
}

/** Great-circle distance in miles. */
export function distanceMiles(a, b) {
  if (!a || !b) return null;
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatMiles(mi) {
  if (mi == null || !Number.isFinite(mi)) return '';
  if (mi < 0.1) return 'right here';
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
}

/** First sentence-ish of a note, for one-line previews. */
export function noteSnippet(notes, max = 72) {
  if (typeof notes !== 'string') return '';
  const t = notes.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 12)).trim()}…`;
}

function mostCommon(values) {
  const counts = new Map();
  for (const v of values) if (v != null) counts.set(v, (counts.get(v) || 0) + 1);
  let best = null;
  let n = 0;
  for (const [v, c] of counts) if (c > n) { best = v; n = c; }
  return best;
}

/**
 * Everything the bar shows about the pins in view.
 * @param {Array} pins     pins inside the current viewport
 * @param {{lat,lng}} center  map centre (distances are measured from here)
 * @param {number} month   1–12
 */
export function buildViewSummary(pins, center, month) {
  const list = (pins || []).filter((p) => p && p.coordinates && p.fruitType);
  // The view's zone: what most finds here were saved with, else an estimate for the map centre.
  const zone = mostCommon(list.map((p) => p.zone))
    || (center && Number.isFinite(center.lat) ? detectZoneFallback(center.lat, center.lng) : null);

  const byFruit = new Map();
  for (const pin of list) {
    const key = pin.fruitType.toLowerCase();
    const ripeness = ripenessOf(pin, month);
    const d = distanceMiles(center, pin.coordinates);
    let g = byFruit.get(key);
    if (!g) {
      g = { fruitType: key, family: familyOf(key), count: 0, ripe: ripeness === 'ripe', nearest: null, distanceMi: Infinity, note: '', noteBy: null };
      byFruit.set(key, g);
    }
    g.count += 1;
    if (ripeness === 'ripe') g.ripe = true;
    if (d != null && d < g.distanceMi) {
      g.distanceMi = d;
      g.nearest = pin.coordinates;
    }
    if (!g.note && pin.notes) {
      g.note = noteSnippet(pin.notes);
      g.noteBy = pin.submittedBy || null;
    }
  }

  const groups = [...byFruit.values()].sort((a, b) => a.distanceMi - b.distanceMi);
  const ripe = groups.filter((g) => g.ripe);
  const ripeCount = list.filter((p) => ripenessOf(p, month) === 'ripe').length;

  // Almanac rows: in-season kinds first, then others; only kinds with season data.
  const almanac = [...ripe, ...groups.filter((g) => !g.ripe)]
    .map((g) => ({ fruitType: g.fruitType, family: g.family, months: seasonMonthsFor(g.fruitType, zone) }))
    .filter((r) => r.months && r.months.length)
    .slice(0, 5);

  return {
    pinCount: list.length,
    ripeCount,
    zone,
    fruitTypes: groups.map((g) => g.fruitType).sort(),
    ripe: ripe.slice(0, 6),
    nearest: ripe[0] || null,
    almanac,
  };
}

// Fruit people commonly find on streets, for "look for…" hints in empty areas.
const STREET_FRUIT = [
  'loquat', 'fig', 'lemon', 'orange', 'persimmon', 'pomegranate', 'plum', 'apricot', 'mulberry',
  'avocado', 'guava', 'blackberry', 'apple', 'pear', 'cherry', 'grapefruit', 'kumquat', 'feijoa',
];

/** Up to `n` common street fruits in season this month for a zone. */
export function lookForHints(zone, month, n = 2) {
  return STREET_FRUIT.filter((f) => {
    const m = seasonMonthsFor(f, zone);
    return m && m.includes(month);
  }).slice(0, n);
}
