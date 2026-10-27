/**
 * The admin command center's reads and writes. Postgres only: there is no
 * DynamoDB twin (that code goes in late Nov 2026), and the barrel answers
 * AdminUnavailableError on DATA_STORE=dynamo. Plan: "Admin command center plan".
 *
 * - Everything here may name who added a find (public responses never do);
 *   nothing here returns an email.
 * - Writes record a pin_events row in the same transaction as the change.
 * - Database failures throw PinsQueryError (the controller answers 503).
 */
import { query, withTransaction } from '../../db/postgres.js';
import { PinsQueryError } from '../errors.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (id) => typeof id === 'string' && UUID_RE.test(id);

/** Lists are capped; at today's size (tens of finds) nothing pages. */
export const LIST_LIMIT = 50;

/** The map's "stale" (dashed ring): no add or "still good" for 6 months (client/utils/timeAgo.js). */
export const STALE_DAYS = 6 * 30.44;

const iso = (d) => (d ? new Date(d).toISOString() : null);
const BY_USER = (p) => `(select user_name from users where lower(user_name) = lower(${p}))`;

async function read(text, params, what) {
  try {
    return await query(text, params);
  } catch (err) {
    console.error(`Error ${what}:`, err.message);
    throw new PinsQueryError(`Failed to ${what}`, err);
  }
}

async function write(fn, what) {
  try {
    return await withTransaction(fn);
  } catch (err) {
    console.error(`Error ${what}:`, err.message);
    throw new PinsQueryError(`Failed to ${what}`, err);
  }
}

const COUNTS = `
  select (select count(*) from pin_reports where handled_at is null)::int as open_reports,
         (select count(*) from pins where status = 'active')::int as finds,
         (select count(*) from pins where status = 'removed')::int as hidden,
         (select count(*) from users)::int as people`;

const toCounts = (r) => ({ openReports: r.open_reports, finds: r.finds, hidden: r.hidden, people: r.people });

/** The counts for the sidebar link and the page's running head. */
export async function getSummary() {
  const { rows } = await read(COUNTS, [], 'read the admin counts');
  return toCounts(rows[0]);
}

/** Everything the command center shows, in one read. */
export async function getOverview({ now = new Date() } = {}) {
  const at = now.toISOString();
  const [counts, open, handled, activity, stale, hidden] = await Promise.all([
    read(COUNTS, [], 'read the admin counts'),
    read(
      `select r.id, r.pin_id, r.reason, r.note, r.created_at,
              p.fruit_type, p.submitted_by, p.created_at as pin_created_at, p.status,
              (select count(*) from pin_reports r2 where r2.pin_id = r.pin_id)::int as reports_on_find
         from pin_reports r join pins p on p.pin_id = r.pin_id
        where r.handled_at is null
        order by r.created_at desc, r.id desc
        limit $1`,
      [LIST_LIMIT],
      'read open reports',
    ),
    read(
      `select r.id, r.pin_id, r.reason, r.outcome, r.handled_at, r.handled_by, p.fruit_type,
              count(*) over ()::int as total
         from pin_reports r join pins p on p.pin_id = r.pin_id
        where r.handled_at is not null
        order by r.handled_at desc, r.id desc
        limit 10`,
      [],
      'read handled reports',
    ),
    // History, plus what it can't hold: adds from before it began, and visitors' "still good" taps.
    read(
      `select * from (
         select e.at, e.kind, e.pin_id, e.fruit_type, e.fields, e.by_user, p.status
           from pin_events e left join pins p on p.pin_id = e.pin_id
         union all
         select p.created_at, 'added', p.pin_id, p.fruit_type, '{}', p.submitted_by, p.status
           from pins p
          where not exists (select 1 from pin_events e where e.pin_id = p.pin_id and e.kind = 'added')
         union all
         select c.confirmed_at, 'still-good', c.pin_id, p.fruit_type, '{}', null, p.status
           from pin_confirmations c join pins p on p.pin_id = c.pin_id
          where not exists (select 1 from pin_events e
                             where e.pin_id = c.pin_id and e.kind = 'still-there' and e.at = c.confirmed_at)
       ) a
       order by at desc
       limit $1`,
      [LIST_LIMIT],
      'read recent activity',
    ),
    read(
      `select p.pin_id, p.fruit_type, p.submitted_by, p.created_at, s.last_sign
         from pins p
         cross join lateral (
           select greatest(p.created_at, (select max(c.confirmed_at) from pin_confirmations c where c.pin_id = p.pin_id)) as last_sign
         ) s
        where p.status = 'active' and s.last_sign < $1::timestamptz - make_interval(secs => $2)
        order by s.last_sign asc
        limit $3`,
      [at, STALE_DAYS * 86400, LIST_LIMIT],
      'read finds to review',
    ),
    read(
      `select p.pin_id, p.fruit_type, p.submitted_by,
              (select max(e.at) from pin_events e where e.pin_id = p.pin_id and e.kind = 'hidden') as hidden_at,
              (select r.reason from pin_reports r where r.pin_id = p.pin_id and r.outcome = 'hidden'
                order by r.handled_at desc, r.id desc limit 1) as reason
         from pins p
        where p.status = 'removed'
        order by hidden_at desc nulls last
        limit $1`,
      [LIST_LIMIT],
      'read hidden finds',
    ),
  ]);
  return {
    counts: toCounts(counts.rows[0]),
    reports: open.rows.map((r) => ({
      id: Number(r.id),
      pinId: r.pin_id,
      fruitType: r.fruit_type,
      reason: r.reason,
      note: r.note || '',
      createdAt: iso(r.created_at),
      addedBy: r.submitted_by,
      findAddedAt: iso(r.pin_created_at),
      reportsOnFind: r.reports_on_find,
    })),
    handled: {
      count: handled.rows[0]?.total ?? 0,
      recent: handled.rows.map((r) => ({
        id: Number(r.id),
        pinId: r.pin_id,
        fruitType: r.fruit_type,
        reason: r.reason,
        outcome: r.outcome,
        handledAt: iso(r.handled_at),
        handledBy: r.handled_by,
      })),
    },
    activity: activity.rows.map((r) => ({
      at: iso(r.at),
      kind: r.kind,
      pinId: r.pin_id,
      fruitType: r.fruit_type,
      fields: r.fields || [],
      by: r.by_user,
      // Only a find that's still on the map can be opened there.
      onMap: r.status === 'active',
    })),
    stale: stale.rows.map((r) => ({
      pinId: r.pin_id,
      fruitType: r.fruit_type,
      addedBy: r.submitted_by,
      lastSign: iso(r.last_sign),
    })),
    hidden: hidden.rows.map((r) => ({
      pinId: r.pin_id,
      fruitType: r.fruit_type,
      addedBy: r.submitted_by,
      hiddenAt: iso(r.hidden_at),
      reason: r.reason || null,
    })),
  };
}

/** Marks one open report handled, find kept. @returns {Promise<boolean>} false: no such open report */
export async function handleReport(reportId, { by } = {}) {
  const id = Number(reportId);
  if (!Number.isSafeInteger(id) || id <= 0) return false;
  return write(async (client) => {
    const { rows } = await client.query(
      `update pin_reports r set handled_at = now(), handled_by = ${BY_USER('$2')}, outcome = 'kept'
        from pins p
       where r.id = $1 and r.handled_at is null and p.pin_id = r.pin_id
       returning r.pin_id, p.fruit_type`,
      [id, by ?? null],
    );
    if (rows.length === 0) return false;
    await client.query(
      `insert into pin_events (pin_id, kind, by_user, fruit_type) values ($1, 'report-handled', ${BY_USER('$2')}, $3)`,
      [rows[0].pin_id, by ?? null, rows[0].fruit_type],
    );
    return true;
  }, 'handle the report');
}

/**
 * Hides a find (status 'removed'): off the map and its link, reversible.
 * Its open reports are handled as 'hidden'. @returns {Promise<boolean>} false: no such visible find
 */
export async function hidePin(pinId, { by } = {}) {
  if (!isUuid(pinId)) return false;
  return write(async (client) => {
    const { rows } = await client.query(
      `update pins set status = 'removed' where pin_id = $1 and status = 'active' returning fruit_type`,
      [pinId],
    );
    if (rows.length === 0) return false;
    await client.query(
      `update pin_reports set handled_at = now(), handled_by = ${BY_USER('$2')}, outcome = 'hidden'
        where pin_id = $1 and handled_at is null`,
      [pinId, by ?? null],
    );
    await client.query(
      `insert into pin_events (pin_id, kind, by_user, fruit_type) values ($1, 'hidden', ${BY_USER('$2')}, $3)`,
      [pinId, by ?? null, rows[0].fruit_type],
    );
    return true;
  }, 'hide the find');
}

/** Puts a hidden find back. @returns {Promise<boolean>} false: no such hidden find */
export async function restorePin(pinId, { by } = {}) {
  if (!isUuid(pinId)) return false;
  return write(async (client) => {
    const { rows } = await client.query(
      `update pins set status = 'active' where pin_id = $1 and status = 'removed' returning fruit_type`,
      [pinId],
    );
    if (rows.length === 0) return false;
    await client.query(
      `insert into pin_events (pin_id, kind, by_user, fruit_type) values ($1, 'restored', ${BY_USER('$2')}, $3)`,
      [pinId, by ?? null, rows[0].fruit_type],
    );
    return true;
  }, 'put the find back');
}

/** "still there": a "still good" from the admin, so the find leaves the review list. */
export async function markStillThere(pinId, { by } = {}) {
  if (!isUuid(pinId)) return false;
  const at = new Date().toISOString();
  return write(async (client) => {
    const { rows } = await client.query(
      `insert into pin_confirmations (pin_id, confirmed_at)
       select pin_id, $2 from pins where pin_id = $1 and status = 'active'
       returning (select fruit_type from pins where pin_id = $1) as fruit_type`,
      [pinId, at],
    );
    if (rows.length === 0) return false;
    // Same time as the confirmation, so recent activity shows one line, not two.
    await client.query(
      `insert into pin_events (pin_id, kind, by_user, fruit_type, at) values ($1, 'still-there', ${BY_USER('$2')}, $3, $4)`,
      [pinId, by ?? null, rows[0].fruit_type, at],
    );
    return true;
  }, 'mark the find still there');
}
