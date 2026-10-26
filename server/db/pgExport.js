/**
 * Postgres rows → DynamoDB items, for a rollback after cutover
 * (scripts/pg-to-dynamo.mjs). The item shapes match what server/schemas/users.js
 * and pins.js write, so DATA_STORE=dynamo reads them as if nothing happened.
 * Pure; tested in tests/server/pgExport.test.js.
 */
const iso = (d) => (d ? new Date(d).toISOString() : null);
const S = (v) => ({ S: String(v) });

export function generateGeoHash(lat, lng) {
  return `${Math.round(lat * 10000)}_${Math.round(lng * 10000)}`;
}

/** A users row → a LoquatUsers item (no reset token: links don't survive a rollback). */
export function userItem(u) {
  const item = { userName: S(u.user_name), isAdmin: { BOOL: !!u.is_admin } };
  if (u.email) item.email = S(u.email);
  if (u.password_hash) item.passwordHash = S(u.password_hash);
  if (u.created_at) item.createdAt = S(iso(u.created_at));
  if (u.last_login) item.lastLogin = S(iso(u.last_login));
  return item;
}

/**
 * A pins row (with lat, lng, confirmations: Date[], reports: [{reason, note, created_at}])
 * → a LoquatPins item.
 */
export function pinItem(p) {
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  const item = {
    pinId: S(p.pin_id),
    createdAt: S(iso(p.created_at)),
    coordinates: S(JSON.stringify({ lat, lng })),
    fruitType: S(p.fruit_type),
    fruitTypeDisplay: S(p.fruit_type_display || p.fruit_type),
    notes: S(p.notes || ''),
    submittedBy: S(p.submitted_by),
    geoHash: S(generateGeoHash(lat, lng)),
    status: S(p.status || 'active'),
    zone: { N: String(p.zone) },
  };
  if (p.updated_at) item.updatedAt = S(iso(p.updated_at));
  if (p.confirmations?.length) {
    item.confirmations = {
      L: p.confirmations.map((t) => ({ M: { timestamp: S(iso(t)), anonymous: { BOOL: true } } })),
    };
  }
  if (p.reports?.length) {
    item.reports = {
      L: p.reports.map((r) => ({ M: { reason: S(r.reason), note: S(r.note || ''), at: S(iso(r.created_at)) } })),
    };
    item.reportCount = { N: String(p.reports.length) };
  }
  return item;
}
