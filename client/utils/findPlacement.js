// Placing a find: how far the pin may be nudged from where you're standing, and the
// words for where it ended up. Pure and dependency-free: the server imports it too
// (an edit may only move a find within the same range).

// A find goes where you are, nudged at most about a city block to the actual tree.
export const NUDGE_LIMIT_M = 100;
// The server allows a little over the limit (rounding, a re-check of the same spot).
export const NUDGE_SLACK_M = 10;
// Same kind this close to the spot: probably the same tree, so the form says so.
export const SAME_TREE_M = 15;

const R = 6371000; // metres
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

function isPoint(p) {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

/** Great-circle distance in metres (null if either point is missing). */
export function distanceMeters(a, b) {
  if (!isPoint(a) || !isPoint(b)) return null;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * `point`, pulled back onto the circle of `limitM` around `origin` if it's outside.
 * `limitM` null/0 = no limit (admin). Returns { lat, lng, clamped }.
 */
export function clampToRange(origin, point, limitM) {
  if (!isPoint(point)) return null;
  if (!isPoint(origin) || !limitM) return { lat: point.lat, lng: point.lng, clamped: false };
  const d = distanceMeters(origin, point);
  if (d <= limitM) return { lat: point.lat, lng: point.lng, clamped: false };
  // Over ~100 m a flat approximation is plenty.
  const k = limitM / d;
  return {
    lat: origin.lat + (point.lat - origin.lat) * k,
    lng: origin.lng + (point.lng - origin.lng) * k,
    clamped: true,
  };
}

/** Within the nudge range (plus the server's slack)? */
export function withinNudge(origin, point, limitM = NUDGE_LIMIT_M, slackM = NUDGE_SLACK_M) {
  const d = distanceMeters(origin, point);
  return d !== null && d <= limitM + slackM;
}

const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

/** Compass word from a to b ("north", "southwest", …). */
export function compassWord(a, b) {
  if (!isPoint(a) || !isPoint(b)) return '';
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat))
    - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return COMPASS[Math.round(bearing / 45) % 8];
}

/** "40 ft", "0.3 mi": feet up to a tenth of a mile, rounded to 5 ft. */
export function formatFeet(m) {
  if (m == null || !Number.isFinite(m)) return '';
  const ft = m * 3.28084;
  if (ft < 528) return `${Math.max(5, Math.round(ft / 5) * 5)} ft`;
  const mi = ft / 5280;
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
}

/**
 * Where the pin is, relative to a reference point, in words:
 * "right where you are" / "40 ft north of you" (or "of where it was", for an edit).
 */
export function describeOffset(origin, point, { from = 'you' } = {}) {
  const d = distanceMeters(origin, point);
  if (d === null) return '';
  const of = from === 'you' ? 'you' : 'where it was';
  if (d < 3) return from === 'you' ? 'right where you are' : 'as before';
  return `${formatFeet(d)} ${compassWord(origin, point)} of ${of}`;
}

/**
 * Finds of the same kind within `radiusM` of `spot`, nearest first. `excludeId` skips
 * the find being edited. Returns [{ pinId, fruitType, distanceM, coordinates }].
 */
export function nearbySameKind(pins, spot, fruitType, { radiusM = SAME_TREE_M, excludeId = null } = {}) {
  if (!Array.isArray(pins) || !isPoint(spot) || typeof fruitType !== 'string' || !fruitType.trim()) return [];
  const kind = fruitType.trim().toLowerCase();
  const out = [];
  for (const p of pins) {
    if (!p || p.pinId === excludeId || String(p.fruitType || '').toLowerCase() !== kind) continue;
    const d = distanceMeters(spot, p.coordinates);
    if (d !== null && d <= radiusM) out.push({ pinId: p.pinId, fruitType: kind, distanceM: d, coordinates: p.coordinates });
  }
  return out.sort((a, b) => a.distanceM - b.distanceM);
}

/**
 * A short, lowercase message for a failed save. `status` is the HTTP status (0 for a
 * network failure); `serverMessage` is what the API said, if anything.
 */
export function saveErrorMessage(status, serverMessage = '') {
  const msg = String(serverMessage || '').toLowerCase();
  if (status === 0) return 'couldn’t reach fruit for all. check your connection and try again; your find is still here.';
  if (status === 401) return 'your session expired. sign in again to add this find.';
  if (status === 403) return 'only the person who added this find can change it.';
  if (status === 404) return 'this find isn’t on the map any more.';
  if (status === 429) return 'that’s a lot of finds at once. wait a minute and try again.';
  if (status === 400) {
    if (msg.includes('family-friendly')) return 'please keep notes family-friendly.';
    if (msg.includes('fruit type')) return 'choose what’s there from the list.';
    if (msg.includes('notes cannot exceed')) return 'that note is too long. keep it under 1,000 characters.';
    if (msg.includes('move')) return 'a find can only move about a block (330 ft). to move it further, delete it and add it again.';
    if (msg.includes('coordinates')) return 'that spot didn’t come through. place the pin again.';
  }
  return 'something went wrong saving your find. try again in a moment.';
}
