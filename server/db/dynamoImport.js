/**
 * DynamoDB → Postgres: turning raw items into rows, and the pre-flight check.
 * Pure (no AWS SDK, no pg) so it's unit-tested without packages:
 * tests/server/dynamoImport.test.js. Used by scripts/dynamo-to-pg.mjs.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const REPORT_REASON_IDS = ['gone', 'private', 'unsafe', 'wrong-kind', 'other'];

/**
 * Accounts left out of the move, by the owner's decision (they stay in DynamoDB).
 * testuser: an old test account with no email or password (Oct 25, 2026).
 * A skipped account that owns finds blocks the load: decide about those first.
 */
export const SKIPPED_USERS = ['testuser'];

/** One DynamoDB AttributeValue → a plain JS value. */
export function fromAttr(av) {
  if (av === undefined || av === null) return undefined;
  if ('S' in av) return av.S;
  if ('N' in av) return Number(av.N);
  if ('BOOL' in av) return av.BOOL;
  if ('NULL' in av) return null;
  if ('L' in av) return av.L.map(fromAttr);
  if ('M' in av) return fromItem(av.M);
  if ('SS' in av) return [...av.SS];
  if ('NS' in av) return av.NS.map(Number);
  return undefined;
}

/** A raw DynamoDB item (`{ field: { S: … } }`) → a plain object. */
export function fromItem(item) {
  const out = {};
  for (const [k, v] of Object.entries(item || {})) out[k] = fromAttr(v);
  return out;
}

/** The inverse of server/utils/html.js escapeHtml (kind names were stored escaped). */
export function unescapeHtml(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&');
}

const hasEntity = (s) => typeof s === 'string' && /&(amp|lt|gt|quot|#0?39);/.test(s);

function isoOrNull(v) {
  if (typeof v !== 'string' || !v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString(); // undefined = unparseable
}

function parseJson(v) {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return undefined;
  }
}

/** A LoquatUsers item → the `users` row, plus what the check needs to know. */
export function userRow(raw) {
  const u = fromItem(raw);
  const saved = parseJson(u.savedPins);
  return {
    user_name: typeof u.userName === 'string' ? u.userName.trim() : u.userName,
    email: typeof u.email === 'string' ? u.email.trim().toLowerCase() : null,
    password_hash: u.passwordHash || null,
    is_admin: u.isAdmin === true,
    created_at: isoOrNull(u.createdAt),
    last_login: isoOrNull(u.lastLogin),
    _savedPins: Array.isArray(saved) ? saved.length : 0,
    _hasResetToken: !!u.resetToken,
  };
}

/** A LoquatPins item → the `pins` row, its confirmation times and its reports. */
export function pinRow(raw) {
  const p = fromItem(raw);
  const coords = parseJson(p.coordinates);
  const lat = coords && typeof coords.lat === 'number' ? coords.lat : Number(coords?.lat);
  const lng = coords && typeof coords.lng === 'number' ? coords.lng : Number(coords?.lng);
  const kind = unescapeHtml(p.fruitType || '');
  const display = unescapeHtml(p.fruitTypeDisplay || p.fruitType || '');
  return {
    pin_id: typeof p.pinId === 'string' ? p.pinId.toLowerCase() : p.pinId,
    created_at: isoOrNull(p.createdAt),
    updated_at: isoOrNull(p.updatedAt),
    lat,
    lng,
    fruit_type: kind.trim().toLowerCase(),
    fruit_type_display: display.trim(),
    notes: typeof p.notes === 'string' ? p.notes : '',
    submitted_by: p.submittedBy,
    status: p.status || 'active',
    zone: Number.isInteger(p.zone) ? p.zone : null,
    confirmations: (Array.isArray(p.confirmations) ? p.confirmations : []).map((c) => isoOrNull(c?.timestamp)),
    reports: (Array.isArray(p.reports) ? p.reports : []).map((r) => ({
      reason: r?.reason,
      note: typeof r?.note === 'string' ? r.note : '',
      at: isoOrNull(r?.at),
    })),
    _escapedKind: hasEntity(p.fruitType) || hasEntity(p.fruitTypeDisplay),
    _escapedNotes: hasEntity(p.notes),
  };
}

function groupBy(items, key) {
  const m = new Map();
  for (const it of items) {
    const k = key(it);
    if (k == null) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  return m;
}

/**
 * The pre-flight report. `problems` block a load until resolved; `notes` don't.
 * Lists name users (the owner resolves them) and pin ids, never emails or hashes.
 * @param {{ users: object[], pins: object[] }} rows from userRow / pinRow
 * @param {{ fruitSet: Set<string> }} opts the FRUIT_LIST names
 */
export function checkData({ users: allUsers, pins }, { fruitSet, skipUsers = SKIPPED_USERS }) {
  const problems = {};
  const notes = {};
  const add = (bucket, key, value) => {
    (bucket[key] ||= []).push(value);
  };
  const skip = new Set(skipUsers);
  const users = allUsers.filter((u) => !skip.has(u.user_name));
  for (const u of allUsers) {
    if (skip.has(u.user_name)) add(notes, 'accounts left out of the move (SKIPPED_USERS)', u.user_name);
  }

  for (const u of users) {
    if (typeof u.user_name !== 'string' || !u.user_name) add(problems, 'users without a name', '(blank)');
    if (!u.email) add(problems, 'users without an email', u.user_name);
    if (u.created_at === undefined || u.last_login === undefined) add(problems, 'users with an unreadable date', u.user_name);
    if (!u.password_hash) add(notes, 'users with no password (legacy; they cannot sign in)', u.user_name);
    if (u._savedPins > 0) add(notes, 'users with savedPins (dropped)', `${u.user_name} (${u._savedPins})`);
    if (u.is_admin) add(notes, 'admins', u.user_name);
  }
  for (const [, group] of groupBy(users, (u) => (typeof u.user_name === 'string' ? u.user_name.toLowerCase() : null))) {
    if (group.length > 1) add(problems, 'usernames that clash ignoring case', group.map((u) => u.user_name).join(' / '));
  }
  for (const [, group] of groupBy(users, (u) => u.email)) {
    if (group.length > 1) add(problems, 'emails shared by more than one account', group.map((u) => u.user_name).join(' / '));
  }

  const userNames = new Set(users.map((u) => u.user_name));
  const seenPins = new Set();
  let confirmations = 0;
  let reports = 0;
  for (const p of pins) {
    const id = String(p.pin_id);
    if (!UUID_RE.test(id)) add(problems, 'finds with an id that is not a UUID', id);
    if (seenPins.has(id)) add(problems, 'finds with a duplicate id', id);
    seenPins.add(id);
    if (!p.created_at) add(problems, 'finds with a missing or unreadable createdAt', id);
    if (p.updated_at === undefined) add(problems, 'finds with an unreadable updatedAt', id);
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) {
      add(problems, 'finds with missing or out-of-range coordinates', id);
    }
    if (skip.has(p.submitted_by)) add(problems, 'finds owned by a skipped account', `${id} (${p.submitted_by})`);
    else if (!userNames.has(p.submitted_by)) add(problems, 'finds whose submittedBy has no account', `${id} (${p.submitted_by ?? 'none'})`);
    if (!p.fruit_type) add(problems, 'finds with no kind', id);
    else if (!fruitSet.has(p.fruit_type)) add(notes, 'kinds no longer in FRUIT_LIST (kept as they are)', `${p.fruit_type} (${id})`);
    if (p.status !== 'active' && p.status !== 'removed') add(problems, 'finds with an unknown status', `${id} (${p.status})`);
    if (p.zone === null) add(notes, 'finds with no zone (re-detected on load)', id);
    else if (p.zone < 1 || p.zone > 13) add(problems, 'finds with a zone outside 1–13', `${id} (${p.zone})`);
    if (p._escapedKind) add(notes, 'kind names stored HTML-escaped (unescaped on load)', `${p.fruit_type} (${id})`);
    if (p._escapedNotes) add(notes, 'notes containing HTML entities (left as they are)', id);
    for (const c of p.confirmations) {
      confirmations += 1;
      if (!c) add(problems, 'confirmations with an unreadable time', id);
    }
    for (const r of p.reports) {
      reports += 1;
      if (!REPORT_REASON_IDS.includes(r.reason)) add(problems, 'reports with an unknown reason', `${id} (${r.reason})`);
      if (!r.at) add(problems, 'reports with an unreadable time', id);
    }
  }

  return {
    counts: {
      users: users.length,
      finds: pins.length,
      activeFinds: pins.filter((p) => p.status === 'active').length,
      confirmations,
      reports,
      outstandingResetTokens: users.filter((u) => u._hasResetToken).length,
    },
    problems,
    notes,
    ok: Object.keys(problems).length === 0,
  };
}

/** The report as lines for the terminal. Long lists are cut to `limit` entries. */
export function formatReport(report, { limit = 20 } = {}) {
  const lines = [];
  const c = report.counts;
  lines.push(
    `users ${c.users} · finds ${c.finds} (${c.activeFinds} active) · confirmations ${c.confirmations} · reports ${c.reports}`,
  );
  lines.push(`outstanding reset tokens: ${c.outstandingResetTokens} (not carried over)`);
  const section = (title, bucket) => {
    const keys = Object.keys(bucket);
    lines.push('', `${title}: ${keys.length ? '' : 'none'}`);
    for (const k of keys) {
      const list = bucket[k];
      lines.push(`  ${k}: ${list.length}`);
      for (const v of list.slice(0, limit)) lines.push(`    - ${v}`);
      if (list.length > limit) lines.push(`    … and ${list.length - limit} more`);
    }
  };
  section('problems (must be resolved before a load)', report.problems);
  section('notes', report.notes);
  lines.push('', report.ok ? 'ok: nothing blocks a load.' : 'not ok: resolve the problems above first.');
  return lines;
}
