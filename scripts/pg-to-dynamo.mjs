#!/usr/bin/env node
// Rollback helper (docs/POSTGRES_CUTOVER.md): makes DynamoDB match Postgres, so
// DATA_STORE=dynamo can take over again without losing what people did since
// the cutover.
//
//   node --env-file=.env scripts/pg-to-dynamo.mjs            dry run: lists what would change
//   node --env-file=.env scripts/pg-to-dynamo.mjs --write    does it
//
// Writes every user and find from Postgres into the DynamoDB tables (PutItem,
// same shapes the DynamoDB code writes) and deletes DynamoDB finds that are no
// longer in Postgres (deleted since the cutover). Users are never deleted
// (skipped accounts like testuser stay as they were). Reset links don't carry over.
import { DeleteItemCommand, PutItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { dynamoClient, REGION, USERS_TABLE, PINS_TABLE } from '../server/db/dynamo.js';
import { userItem, pinItem } from '../server/db/pgExport.js';
import { describeDatabaseUrl, query, closePool } from '../server/db/postgres.js';

const write = process.argv.includes('--write');

try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  console.log(`[pg-to-dynamo] from ${describeDatabaseUrl(process.env.DATABASE_URL)} to ${REGION} ${USERS_TABLE}, ${PINS_TABLE}${write ? '' : ' (dry run)'}`);

  const users = (await query('select * from users order by user_name')).rows;
  const pins = (await query(
    `select p.pin_id::text, p.created_at, p.updated_at, st_y(p.location::geometry) as lat, st_x(p.location::geometry) as lng,
            p.fruit_type, p.fruit_type_display, p.notes, p.submitted_by, p.status, p.zone,
            coalesce((select array_agg(c.confirmed_at order by c.confirmed_at) from pin_confirmations c where c.pin_id = p.pin_id), '{}') as confirmations,
            coalesce((select json_agg(json_build_object('reason', r.reason, 'note', r.note, 'created_at', r.created_at) order by r.created_at)
                        from pin_reports r where r.pin_id = p.pin_id), '[]') as reports
       from pins p`,
  )).rows;

  // DynamoDB finds that are gone from Postgres: deleted since the cutover.
  const existing = [];
  let key;
  do {
    const page = await dynamoClient.send(
      new ScanCommand({ TableName: PINS_TABLE, ProjectionExpression: 'pinId, createdAt', ExclusiveStartKey: key }),
    );
    existing.push(...(page.Items || []));
    key = page.LastEvaluatedKey;
  } while (key);
  const keep = new Set(pins.map((p) => p.pin_id));
  const gone = existing.filter((i) => !keep.has(i.pinId.S));

  console.log(`[pg-to-dynamo] put ${users.length} users, put ${pins.length} finds, delete ${gone.length} finds`);
  for (const g of gone) console.log(`  - delete ${g.pinId.S}`);
  if (!write) {
    console.log('[pg-to-dynamo] dry run: nothing written. Add --write to do it.');
  } else {
    for (const u of users) await dynamoClient.send(new PutItemCommand({ TableName: USERS_TABLE, Item: userItem(u) }));
    for (const p of pins) await dynamoClient.send(new PutItemCommand({ TableName: PINS_TABLE, Item: pinItem(p) }));
    for (const g of gone) {
      await dynamoClient.send(new DeleteItemCommand({ TableName: PINS_TABLE, Key: { pinId: g.pinId, createdAt: g.createdAt } }));
    }
    console.log('[pg-to-dynamo] done. DynamoDB now matches Postgres.');
  }
} catch (err) {
  console.error(`[pg-to-dynamo] ${err.message}`);
  process.exitCode = 1;
} finally {
  await closePool();
}
