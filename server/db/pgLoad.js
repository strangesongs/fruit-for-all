/**
 * Loading DynamoDB rows (from dynamoImport.js userRow / pinRow) into Postgres,
 * and comparing the two afterwards. Used by scripts/dynamo-to-pg.mjs --load /
 * --verify; tested against a real database in tests/server/pgLoad.test.js.
 */
import { SKIPPED_USERS } from './dynamoImport.js';

const TABLES = 'pin_events, pin_reports, pin_confirmations, pins, password_resets, users';

/**
 * Everything in one transaction: all of it lands, or none of it.
 * Refuses a database that already has users or finds unless `replace`.
 * @param client a pg client (not a pool: the transaction needs one connection)
 * @param {{ zoneFor: (lat, lng) => Promise<number> }} opts for finds with no saved zone
 * @returns counts of what was written
 */
export async function loadRows(client, { users, pins }, { replace = false, skipUsers = SKIPPED_USERS, zoneFor }) {
  const skip = new Set(skipUsers);
  const counts = { users: 0, finds: 0, confirmations: 0, reports: 0, zonesDetected: 0 };
  await client.query('begin');
  try {
    const { rows: [have] } = await client.query(
      'select (select count(*) from users)::int as users, (select count(*) from pins)::int as finds',
    );
    if (have.users || have.finds) {
      if (!replace) {
        throw new Error(
          `The database already has ${have.users} users and ${have.finds} finds. Pass --replace to wipe them and load again.`,
        );
      }
      await client.query(`truncate ${TABLES} restart identity cascade`);
    }
    for (const u of users) {
      if (skip.has(u.user_name)) continue;
      await client.query(
        `insert into users (user_name, email, password_hash, is_admin, created_at, last_login)
         values ($1, $2, $3, $4, coalesce($5::timestamptz, now()), $6)`,
        [u.user_name, u.email, u.password_hash, u.is_admin, u.created_at, u.last_login],
      );
      counts.users += 1;
    }
    for (const p of pins) {
      let zone = p.zone;
      if (zone === null || zone === undefined) {
        zone = await zoneFor(p.lat, p.lng);
        counts.zonesDetected += 1;
      }
      await client.query(
        `insert into pins (pin_id, created_at, updated_at, location, fruit_type, fruit_type_display, notes, submitted_by, status, zone)
         values ($1, $2, $3, st_setsrid(st_makepoint($5, $4), 4326)::geography, $6, $7, $8, $9, $10, $11)`,
        [p.pin_id, p.created_at, p.updated_at, p.lat, p.lng, p.fruit_type, p.fruit_type_display || p.fruit_type,
          p.notes, p.submitted_by, p.status, zone],
      );
      counts.finds += 1;
      for (const at of p.confirmations) {
        await client.query('insert into pin_confirmations (pin_id, confirmed_at) values ($1, $2)', [p.pin_id, at]);
        counts.confirmations += 1;
      }
      for (const r of p.reports) {
        await client.query('insert into pin_reports (pin_id, reason, note, created_at) values ($1, $2, $3, $4)', [
          p.pin_id, r.reason, r.note, r.at,
        ]);
        counts.reports += 1;
      }
    }
    await client.query('commit');
    return counts;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  }
}

/** What Postgres holds, in the same row shapes as dynamoImport.js, for compareStores. */
export async function readRows(client) {
  const users = (await client.query(
    'select user_name, email, password_hash, is_admin, created_at, last_login from users order by user_name',
  )).rows.map((u) => ({ ...u, created_at: iso(u.created_at), last_login: iso(u.last_login) }));
  const pins = (await client.query(
    `select p.pin_id::text, p.created_at, p.updated_at, st_y(p.location::geometry) as lat, st_x(p.location::geometry) as lng,
            p.fruit_type, p.fruit_type_display, p.notes, p.submitted_by, p.status, p.zone,
            coalesce((select array_agg(c.confirmed_at order by c.confirmed_at) from pin_confirmations c where c.pin_id = p.pin_id), '{}') as confirmations,
            (select count(*) from pin_reports r where r.pin_id = p.pin_id)::int as report_count
       from pins p order by p.pin_id`,
  )).rows.map((p) => ({
    ...p,
    created_at: iso(p.created_at),
    updated_at: iso(p.updated_at),
    confirmations: p.confirmations.map(iso),
  }));
  return { users, pins };
}

const iso = (d) => (d ? new Date(d).toISOString() : null);

/**
 * Field-by-field differences between the DynamoDB rows and what Postgres holds.
 * Zones only count when DynamoDB had one (missing ones were detected on load).
 * @returns {string[]} empty when they match
 */
export function compareStores(source, loaded, { skipUsers = SKIPPED_USERS } = {}) {
  const diffs = [];
  const skip = new Set(skipUsers);
  const byName = new Map(loaded.users.map((u) => [u.user_name, u]));
  const srcUsers = source.users.filter((u) => !skip.has(u.user_name));
  if (srcUsers.length !== loaded.users.length) diffs.push(`users: ${srcUsers.length} in DynamoDB, ${loaded.users.length} in Postgres`);
  for (const u of srcUsers) {
    const got = byName.get(u.user_name);
    if (!got) {
      diffs.push(`user ${u.user_name}: missing`);
      continue;
    }
    for (const f of ['email', 'password_hash', 'is_admin', 'last_login']) {
      if ((u[f] ?? null) !== (got[f] ?? null)) diffs.push(`user ${u.user_name}: ${f} differs`);
    }
    if (u.created_at && u.created_at !== got.created_at) diffs.push(`user ${u.user_name}: created_at differs`);
  }
  const byId = new Map(loaded.pins.map((p) => [p.pin_id, p]));
  if (source.pins.length !== loaded.pins.length) diffs.push(`finds: ${source.pins.length} in DynamoDB, ${loaded.pins.length} in Postgres`);
  for (const p of source.pins) {
    const got = byId.get(p.pin_id);
    if (!got) {
      diffs.push(`find ${p.pin_id}: missing`);
      continue;
    }
    for (const f of ['created_at', 'updated_at', 'lat', 'lng', 'fruit_type', 'notes', 'submitted_by', 'status']) {
      if ((p[f] ?? null) !== (got[f] ?? null)) diffs.push(`find ${p.pin_id}: ${f} differs (${p[f]} → ${got[f]})`);
    }
    if ((p.fruit_type_display || p.fruit_type) !== got.fruit_type_display) diffs.push(`find ${p.pin_id}: fruit_type_display differs`);
    if (p.zone !== null && p.zone !== got.zone) diffs.push(`find ${p.pin_id}: zone differs (${p.zone} → ${got.zone})`);
    if (JSON.stringify([...p.confirmations].sort()) !== JSON.stringify(got.confirmations)) diffs.push(`find ${p.pin_id}: confirmations differ`);
    if (p.reports.length !== got.report_count) diffs.push(`find ${p.pin_id}: ${p.reports.length} reports → ${got.report_count}`);
  }
  return diffs;
}
