// Plans the one-off zone fix for saved finds (scripts/rezone-finds.mjs).
// Pure: rows in, changes out, so it's tested without a database.
import { zoneFromTable } from '../schemas/zone.js';

/**
 * @param {Array<{pin_id, fruit_type, zone, lat, lng}>} rows every find (any status)
 * @param {(lat, lng) => ({zone, subzone, km} | null)} lookup defaults to the ZIP table
 * @returns {{ changes: Array, same: number, unknown: Array }}
 *   changes: finds whose zone differs ({ pinId, kind, from, to, subzone, km });
 *   unknown: finds with no ZIP centre within range (left as they are).
 */
export function planRezone(rows, lookup = zoneFromTable) {
  const changes = [];
  const unknown = [];
  let same = 0;
  for (const r of rows) {
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    const hit = lookup(lat, lng);
    const from = r.zone === null || r.zone === undefined ? null : Number(r.zone);
    if (!hit) {
      unknown.push({ pinId: r.pin_id, kind: r.fruit_type, from });
      continue;
    }
    if (hit.zone === from) {
      same += 1;
      continue;
    }
    changes.push({ pinId: r.pin_id, kind: r.fruit_type, from, to: hit.zone, subzone: hit.subzone, km: Math.round(hit.km * 10) / 10 });
  }
  return { changes, same, unknown };
}
