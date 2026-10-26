// Rollback items (Postgres → DynamoDB) must read back as the same rows the
// import made, so a find survives DynamoDB → Postgres → DynamoDB unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { userItem, pinItem } from '../../server/db/pgExport.js';
import { userRow, pinRow } from '../../server/db/dynamoImport.js';

test('a user survives the round trip', () => {
  const pg = { user_name: 'Alice', email: 'alice@example.com', password_hash: '$2b$12$h', is_admin: true, created_at: new Date('2025-01-02T03:04:05.000Z'), last_login: new Date('2026-10-01T00:00:00.000Z') };
  const back = userRow(userItem(pg));
  assert.deepEqual(
    { user_name: back.user_name, email: back.email, password_hash: back.password_hash, is_admin: back.is_admin, created_at: back.created_at, last_login: back.last_login },
    { ...pg, created_at: '2025-01-02T03:04:05.000Z', last_login: '2026-10-01T00:00:00.000Z' },
  );
});

test('a find survives the round trip, with confirmations and reports', () => {
  const pg = {
    pin_id: '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90',
    created_at: new Date('2026-05-01T12:00:00.000Z'),
    updated_at: new Date('2026-06-01T12:00:00.000Z'),
    lat: 34.06, lng: -118.29,
    fruit_type: "st. john's wort", fruit_type_display: "st. john's wort", notes: 'gate', submitted_by: 'alice', status: 'active', zone: 10,
    confirmations: [new Date('2026-07-01T00:00:00.000Z')],
    reports: [{ reason: 'gone', note: '', created_at: '2026-08-01T00:00:00.000Z' }],
  };
  const item = pinItem(pg);
  assert.equal(item.reportCount.N, '1');
  assert.equal(item.geoHash.S, '340600_-1182900');
  const back = pinRow(item);
  assert.equal(back.pin_id, pg.pin_id);
  assert.equal(back.created_at, '2026-05-01T12:00:00.000Z');
  assert.equal(back.updated_at, '2026-06-01T12:00:00.000Z');
  assert.equal(back.lat, 34.06);
  assert.equal(back.lng, -118.29);
  assert.equal(back.fruit_type, "st. john's wort");
  assert.equal(back.zone, 10);
  assert.deepEqual(back.confirmations, ['2026-07-01T00:00:00.000Z']);
  assert.deepEqual(back.reports, [{ reason: 'gone', note: '', at: '2026-08-01T00:00:00.000Z' }]);
  assert.equal('updatedAt' in pinItem({ ...pg, updated_at: null }), false);
});
