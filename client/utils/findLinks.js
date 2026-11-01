// A link per find (/find/<pinId>) and reports about a find. Shared by the client
// (popup, map) and the server (the page's preview tags, the report route), so it
// stays dependency-free apart from the pure season helpers. Unit-tested.
import { seasonInfoFor, seasonRangeText, zoneOf } from './pinSummary.js';

export const FIND_PATH_PREFIX = '/find/';
const PIN_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pin ids are v4 UUIDs (server/schemas/pins.js). */
export function isPinId(id) {
  return typeof id === 'string' && PIN_ID_RE.test(id);
}

export function findPath(pinId) {
  return `${FIND_PATH_PREFIX}${pinId}`;
}

export function findUrl(origin, pinId) {
  return `${String(origin || '').replace(/\/+$/, '')}${findPath(pinId)}`;
}

/** The pin id in a /find/<id> path (a trailing slash is fine), else null. */
export function pinIdFromPath(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith(FIND_PATH_PREFIX)) return null;
  const id = pathname.slice(FIND_PATH_PREFIX.length).replace(/\/+$/, '');
  return isPinId(id) ? id.toLowerCase() : null;
}

// ── Reports ─────────────────────────────────────────────────────────────────

export const REPORT_REASONS = [
  { id: 'gone', label: 'it’s gone', hint: 'cut down, died, or never there' },
  { id: 'private', label: 'it’s on private property', hint: 'you’d have to go in to reach it' },
  { id: 'unsafe', label: 'it’s unsafe to pick', hint: 'traffic, spraying, pollution' },
  { id: 'wrong-kind', label: 'it’s a different plant', hint: '' },
  { id: 'other', label: 'something else', hint: '' },
];
const REASON_IDS = new Set(REPORT_REASONS.map((r) => r.id));
export const REPORT_NOTE_MAX = 300;

export function reportReasonLabel(id) {
  const r = REPORT_REASONS.find((x) => x.id === id);
  return r ? r.label : id;
}

/**
 * POST /api/pins/:id/report body: { reason, note? }. Never throws.
 * "something else" needs a few words, or the report says nothing.
 */
export function validateReport(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, message: 'Choose what’s wrong.' };
  }
  const { reason, note } = body;
  if (typeof reason !== 'string' || !REASON_IDS.has(reason)) {
    return { valid: false, message: 'Choose what’s wrong.' };
  }
  if (note !== undefined && note !== null && typeof note !== 'string') {
    return { valid: false, message: 'The note must be text.' };
  }
  const text = typeof note === 'string' ? note.trim() : '';
  if (text.length > REPORT_NOTE_MAX) {
    return { valid: false, message: `Keep the note under ${REPORT_NOTE_MAX} characters.` };
  }
  if (reason === 'other' && !text) {
    return { valid: false, message: 'Say a few words about what’s wrong.' };
  }
  return { valid: true, report: { reason, note: text } };
}

// ── What a shared link says ─────────────────────────────────────────────────

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#039;': "'", '&#39;': "'" };

/** Kind names are stored HTML-escaped (createPin); undo that for display. */
export function plainText(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/&(?:amp|lt|gt|quot|#0?39);/g, (m) => ENTITIES[m] || m);
}

function kindOf(pin) {
  return plainText(pin.fruitTypeDisplay || pin.fruitType || '').toLowerCase() || 'a find';
}

function clip(text, max) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s.,;:–—-]+$/, '')}…`;
}

/**
 * Title and description for a find's link preview and the share sheet.
 * Lowercase, like the rest of the site. Never includes who added it.
 */
export function findSummary(pin, month) {
  if (!pin) return null;
  const kind = kindOf(pin);
  const zone = zoneOf(pin);
  const info = seasonInfoFor(plainText(pin.fruitType || ''), zone);
  const months = info ? info.months : null;
  let season;
  if (months && months.length) {
    const range = seasonRangeText(months);
    // Borrowed months are a neighbouring zone's: say whose, never "here".
    const timing = `zone ${info.zone} timing`;
    if (months.includes(month)) season = info.borrowed ? `in season now (${range}, ${timing})` : `in season now (${range} here)`;
    else season = info.borrowed ? `in season ${range} (${timing})` : `in season ${range} here`;
  } else {
    season = 'season varies';
  }
  const notes = pin.notes ? `“${clip(pin.notes, 120)}”` : 'a find on the map of free fruit growing in public.';
  return {
    title: `${kind} · fruit for all`,
    description: `${kind}, ${season}. ${notes}`,
  };
}
