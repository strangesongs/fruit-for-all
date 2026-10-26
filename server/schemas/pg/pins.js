/**
 * Finds on Postgres: the same functions, arguments, return shapes and errors as
 * server/schemas/pins.js (DynamoDB). Contract: tests/server/pgPins.test.js.
 *
 * - A pin comes back exactly as before: coordinates { lat, lng }, ISO times,
 *   confirmations [{ timestamp, anonymous: true }], geoHash (derived, not stored).
 * - Map boxes use the planar index (002_pins_box_index.sql), newest first, with
 *   an opaque cursor over (created_at, pin_id).
 * - An id that isn't a UUID is "no such find", as in DynamoDB, not a database error.
 * - Kind names are stored as typed (lower case); nothing is HTML-escaped on the
 *   way in. React escapes on render; emails and the share page escape their own output.
 * - Database failures throw PinsQueryError.
 */
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../db/postgres.js';
import { detectZone } from '../zone.js';
import { sanitizeString, validateCoordinates } from '../validation.js';
import { PinsQueryError } from '../errors.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (id) => typeof id === 'string' && UUID_RE.test(id);

// Tests swap this to keep phzmapi.com out of them.
let zoneFor = detectZone;
export function setZoneDetectorForTests(fn) {
  zoneFor = fn || detectZone;
}

// Same as pins.js; kept in the API shape, derived from the coordinates.
export function generateGeoHash(lat, lng) {
  return `${Math.round(lat * 10000)}_${Math.round(lng * 10000)}`;
}

const iso = (d) => (d ? new Date(d).toISOString() : null);

const SELECT = `
  select p.pin_id, p.created_at, p.updated_at, p.fruit_type, p.fruit_type_display, p.notes,
         p.submitted_by, p.status, p.zone,
         st_y(p.location::geometry) as lat, st_x(p.location::geometry) as lng,
         coalesce((select array_agg(c.confirmed_at order by c.confirmed_at)
                     from pin_confirmations c where c.pin_id = p.pin_id), '{}') as confirmed
    from pins p`;

/** A row → the shape pins.js returns. */
export function toPin(row) {
  if (!row) return null;
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  const pin = {
    pinId: row.pin_id,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    coordinates: { lat, lng },
    fruitType: row.fruit_type,
    fruitTypeDisplay: row.fruit_type_display || row.fruit_type,
    notes: row.notes || '',
    submittedBy: row.submitted_by,
    geoHash: generateGeoHash(lat, lng),
    status: row.status || 'active',
    zone: row.zone === null || row.zone === undefined ? null : Number(row.zone),
    confirmations: (row.confirmed || []).map((t) => ({ timestamp: iso(t), anonymous: true })),
  };
  if (row.report_count !== undefined) pin.reportCount = Number(row.report_count);
  return pin;
}

async function run(text, params, what) {
  try {
    return await query(text, params);
  } catch (err) {
    console.error(`Error ${what}:`, err.message);
    throw new PinsQueryError(`Failed to ${what}`, err);
  }
}

export function encodeCursor(pin) {
  return Buffer.from(JSON.stringify({ c: pin.createdAt, id: pin.pinId })).toString('base64');
}

/** null for anything that isn't a cursor this module made (the list starts over, as in pins.js). */
export function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') return null;
  try {
    const { c, id } = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    if (typeof c !== 'string' || Number.isNaN(Date.parse(c)) || !isUuid(id)) return null;
    return { createdAt: new Date(c).toISOString(), pinId: id };
  } catch {
    return null;
  }
}

/** A usable box, or false when it can't match anything (the DynamoDB filter matched nothing then). */
function cleanBounds(bounds) {
  if (!bounds) return null;
  const { minLat, maxLat, minLng, maxLng } = bounds;
  if (![minLat, maxLat, minLng, maxLng].every(Number.isFinite)) return false;
  if (minLat > maxLat || minLng > maxLng) return false;
  return { minLat, maxLat, minLng, maxLng };
}

export async function createPin(pinData) {
  if (!pinData || !pinData.coordinates || !pinData.fruitType || !pinData.submittedBy) {
    throw new Error('Missing required pin data');
  }
  if (typeof pinData.coordinates.lat !== 'number' || typeof pinData.coordinates.lng !== 'number') {
    throw new Error('Invalid coordinates');
  }
  const coordValidation = validateCoordinates(pinData.coordinates.lat, pinData.coordinates.lng);
  if (!coordValidation.valid) throw new Error(coordValidation.message);
  const lat = pinData.coordinates.lat;
  const lng = pinData.coordinates.lng;
  const name = sanitizeString(pinData.fruitType);
  const zone = await zoneFor(lat, lng);
  // Millisecond times (as ISO strings) keep the paging cursor exact.
  const { rows } = await run(
    `with ins as (
       insert into pins (pin_id, created_at, location, fruit_type, fruit_type_display, notes, submitted_by, status, zone)
       values ($1, $2, st_setsrid(st_makepoint($4, $3), 4326)::geography, $5, $6, $7, $8, 'active', $9)
       returning *)
     select ins.pin_id, ins.created_at, ins.updated_at, ins.fruit_type, ins.fruit_type_display, ins.notes,
            ins.submitted_by, ins.status, ins.zone,
            st_y(ins.location::geometry) as lat, st_x(ins.location::geometry) as lng, '{}'::timestamptz[] as confirmed
       from ins`,
    [uuidv4(), new Date().toISOString(), lat, lng, name.toLowerCase(), name, sanitizeString(pinData.notes || ''),
      sanitizeString(pinData.submittedBy), zone],
    'create pin',
  );
  return toPin(rows[0]);
}

/**
 * @returns {Promise<{ pins: array, cursor: string | null, hasMore: boolean }>}
 * @throws {PinsQueryError}
 */
export async function getAllPins(options = {}) {
  const { limit = 1000, cursor, submittedBy, bounds } = options;
  const n = Math.max(1, Number.parseInt(limit, 10) || 1000);
  const box = cleanBounds(bounds);
  if (box === false) return { pins: [], cursor: null, hasMore: false };
  const where = [];
  const params = [];
  const param = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  // Your finds: all of them, as the submittedBy index returned. The map: active ones.
  if (submittedBy) where.push(`p.submitted_by = ${param(String(submittedBy))}`);
  else where.push("p.status = 'active'");
  if (box) {
    where.push(
      `p.location::geometry && st_makeenvelope(${param(box.minLng)}, ${param(box.minLat)}, ${param(box.maxLng)}, ${param(box.maxLat)}, 4326)`,
    );
  }
  const after = decodeCursor(cursor);
  if (after) where.push(`(p.created_at, p.pin_id) < (${param(after.createdAt)}::timestamptz, ${param(after.pinId)}::uuid)`);
  const { rows } = await run(
    `${SELECT} where ${where.join(' and ')} order by p.created_at desc, p.pin_id desc limit ${param(n + 1)}`,
    params,
    'load pins',
  );
  const hasMore = rows.length > n;
  const pins = rows.slice(0, n).map(toPin);
  return { pins, cursor: hasMore ? encodeCursor(pins[pins.length - 1]) : null, hasMore };
}

/**
 * One pin, or null when there's no such pin. `withReports` adds `reportCount`.
 * @throws {PinsQueryError}
 */
export async function getPinById(pinId, { withReports = false } = {}) {
  if (!isUuid(pinId)) return null;
  const count = withReports
    ? ', (select count(*) from pin_reports r where r.pin_id = p.pin_id) as report_count'
    : '';
  const { rows } = await run(
    `${SELECT.replace('from pins p', `${count} from pins p`)} where p.pin_id = $1`,
    [pinId],
    'read the pin',
  );
  return toPin(rows[0]);
}

// No cap now: the cap kept a DynamoDB item under 400 KB. The once-per-IP-per-day
// limit in the controller still holds. Exported for the barrel's shape.
export const MAX_STORED_REPORTS = Infinity;

/** @returns {Promise<{ stored: boolean }>} stored=false when the find is gone */
export async function reportPin(pin, report) {
  if (!pin || !pin.pinId) throw new Error('A pin is required');
  try {
    await query('insert into pin_reports (pin_id, reason, note) values ($1, $2, $3)', [
      pin.pinId,
      String(report.reason),
      String(report.note || ''),
    ]);
    return { stored: true };
  } catch (err) {
    if (err?.code === '23503') return { stored: false }; // deleted meanwhile
    throw new PinsQueryError('Failed to store the report', err);
  }
}

export async function deletePin(pinId) {
  if (!pinId || typeof pinId !== 'string') throw new Error('Valid pin ID is required');
  const pin = await getPinById(pinId);
  if (!pin) throw new Error('Pin not found');
  try {
    // Its confirmations and reports go with it (on delete cascade).
    await query('delete from pins where pin_id = $1', [pinId]);
    return true;
  } catch (err) {
    console.error('Error deleting pin:', err.message);
    throw new Error('Failed to delete pin');
  }
}

export async function confirmPin(pinId) {
  if (!pinId || typeof pinId !== 'string') throw new Error('Valid pin ID is required');
  if (!isUuid(pinId)) return null;
  try {
    await query('insert into pin_confirmations (pin_id, confirmed_at) values ($1, $2)', [pinId, new Date().toISOString()]);
  } catch (err) {
    if (err?.code === '23503') return null; // no such find
    console.error('Error confirming pin:', err.message);
    throw new Error('Failed to confirm pin');
  }
  return getPinById(pinId);
}

export async function updatePin(pinId, updates) {
  if (!pinId || typeof pinId !== 'string') throw new Error('Valid pin ID is required');
  const pin = await getPinById(pinId);
  if (!pin) throw new Error('Pin not found');
  const sets = [];
  const params = [pinId];
  const param = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (updates.notes !== undefined) sets.push(`notes = ${param(String(updates.notes || ''))}`);
  if (updates.fruitType !== undefined) {
    const name = sanitizeString(updates.fruitType);
    sets.push(`fruit_type = ${param(name.toLowerCase())}`, `fruit_type_display = ${param(name)}`);
  }
  if (updates.coordinates !== undefined) {
    const lat = parseFloat(updates.coordinates.lat);
    const lng = parseFloat(updates.coordinates.lng);
    const coordValidation = validateCoordinates(lat, lng);
    if (!coordValidation.valid) throw new Error(coordValidation.message);
    // The season follows the find's spot, so a moved find gets its zone again.
    const zone = await zoneFor(lat, lng);
    sets.push(`location = st_setsrid(st_makepoint(${param(lng)}, ${param(lat)}), 4326)::geography`, `zone = ${param(zone)}`);
  }
  if (sets.length === 0) return pin;
  try {
    await withTransaction((client) =>
      client.query(`update pins set ${sets.join(', ')}, updated_at = ${param(new Date().toISOString())} where pin_id = $1`, params),
    );
  } catch (err) {
    console.error('Error updating pin:', err.message);
    throw new Error('Failed to update pin');
  }
  return getPinById(pinId);
}
