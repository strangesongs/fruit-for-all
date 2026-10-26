#!/usr/bin/env node
// DynamoDB → Postgres move. Runbook: docs/POSTGRES_CUTOVER.md.
//
//   npm run db:check                                   read-only pre-flight
//   node --env-file=.env scripts/dynamo-to-pg.mjs --load --to <host:port/db> [--replace]
//   node --env-file=.env scripts/dynamo-to-pg.mjs --verify
//
// --check  reads every item of both tables (paginated Scan; writes nothing) and
//          prints counts plus anything that would block a load.
// --load   runs the check, applies migrations, then copies everything into
//          DATABASE_URL in one transaction. --to must repeat the target exactly
//          as the script prints it (host:port/db), so a load can't go to the
//          wrong database by accident. Refuses a non-empty database without --replace.
// --verify compares DynamoDB and Postgres field by field; exit 1 on any difference.
//
// DynamoDB is only ever read. AWS credentials from the environment or ~/.aws;
// table names from .env (DYNAMODB_USERS_TABLE, PINS_TABLE).
import { ScanCommand } from '@aws-sdk/client-dynamodb';
import { dynamoClient, REGION, USERS_TABLE, PINS_TABLE } from '../server/db/dynamo.js';
import { userRow, pinRow, checkData, formatReport } from '../server/db/dynamoImport.js';
import { loadRows, readRows, compareStores } from '../server/db/pgLoad.js';
import { describeDatabaseUrl, getPool, closePool } from '../server/db/postgres.js';
import { migrate } from '../server/db/migrate.js';
import { detectZone } from '../server/schemas/zone.js';
import { FRUIT_LIST } from '../client/utils/fruitList.js';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valueOf = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};
const mode = ['--check', '--load', '--verify'].filter(has);
if (mode.length !== 1) {
  console.error('usage: scripts/dynamo-to-pg.mjs --check | --load --to <host:port/db> [--replace] | --verify');
  process.exit(2);
}

async function scanAll(table) {
  const items = [];
  let key;
  let pages = 0;
  do {
    const page = await dynamoClient.send(
      new ScanCommand({ TableName: table, ExclusiveStartKey: key, ConsistentRead: true }),
    );
    items.push(...(page.Items || []));
    key = page.LastEvaluatedKey;
    pages += 1;
  } while (key);
  console.log(`[dynamo] ${table}: ${items.length} items in ${pages} page${pages === 1 ? '' : 's'}`);
  return items;
}

async function readDynamo() {
  console.log(`[dynamo] read-only scan · region ${REGION} · tables ${USERS_TABLE}, ${PINS_TABLE}`);
  const [rawUsers, rawPins] = await Promise.all([scanAll(USERS_TABLE), scanAll(PINS_TABLE)]);
  const rows = { users: rawUsers.map(userRow), pins: rawPins.map(pinRow) };
  const report = checkData(rows, { fruitSet: new Set(FRUIT_LIST.map((f) => f.toLowerCase())) });
  return { rows, report };
}

async function withClient(fn) {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

try {
  const { rows, report } = await readDynamo();
  console.log('');
  for (const line of formatReport(report)) console.log(line);
  console.log('');

  if (has('--check')) {
    process.exitCode = report.ok ? 0 : 1;
  } else {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    const target = describeDatabaseUrl(url);
    console.log(`[postgres] ${target}`);

    if (has('--load')) {
      if (!report.ok) throw new Error('the check found problems (above); nothing was loaded');
      if (valueOf('--to') !== target) {
        throw new Error(`--to must be exactly "${target}" (the database this would load into); nothing was loaded`);
      }
      const counts = await withClient(async (client) => {
        const applied = await migrate(client, { log: (m) => console.log(`[migrate] ${m}`) });
        if (!applied.length) console.log('[migrate] up to date');
        return loadRows(client, rows, { replace: has('--replace'), zoneFor: detectZone });
      });
      console.log(
        `[load] done: ${counts.users} users, ${counts.finds} finds, ${counts.confirmations} confirmations, ` +
          `${counts.reports} reports (${counts.zonesDetected} zones detected)`,
      );
    }

    // --load verifies straight after; --verify on its own does only this.
    const diffs = compareStores(rows, await withClient(readRows));
    if (diffs.length) {
      console.log(`[verify] ${diffs.length} difference${diffs.length === 1 ? '' : 's'}:`);
      for (const d of diffs.slice(0, 50)) console.log(`  - ${d}`);
      process.exitCode = 1;
    } else {
      console.log('[verify] DynamoDB and Postgres match.');
    }
  }
} catch (err) {
  console.error(`[dynamo-to-pg] ${err.message}`);
  process.exitCode = 2;
} finally {
  await closePool();
}
