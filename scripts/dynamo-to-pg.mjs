#!/usr/bin/env node
// DynamoDB → Postgres move. This PR has the read-only pre-flight only:
//
//   node --env-file=.env scripts/dynamo-to-pg.mjs --check
//
// Reads every item of the users and pins tables (paginated Scan; nothing is
// written anywhere) and prints counts plus anything that would stop a load:
// usernames that clash ignoring case, shared emails, finds without an account,
// bad coordinates… Uses the AWS credentials from the environment or ~/.aws and
// the table names from .env (DYNAMODB_USERS_TABLE, PINS_TABLE).
// --load and --verify come with the cutover PR.
import { ScanCommand } from '@aws-sdk/client-dynamodb';
import { dynamoClient, REGION, USERS_TABLE, PINS_TABLE } from '../server/db/dynamo.js';
import { userRow, pinRow, checkData, formatReport } from '../server/db/dynamoImport.js';
import { FRUIT_LIST } from '../client/utils/fruitList.js';

const args = new Set(process.argv.slice(2));
if (!args.has('--check')) {
  console.error('usage: node --env-file=.env scripts/dynamo-to-pg.mjs --check');
  console.error('(--load and --verify arrive with the cutover PR)');
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
  console.log(`[check] ${table}: ${items.length} items in ${pages} page${pages === 1 ? '' : 's'}`);
  return items;
}

try {
  console.log(`[check] read-only scan · region ${REGION} · tables ${USERS_TABLE}, ${PINS_TABLE}`);
  const [rawUsers, rawPins] = await Promise.all([scanAll(USERS_TABLE), scanAll(PINS_TABLE)]);
  const report = checkData(
    { users: rawUsers.map(userRow), pins: rawPins.map(pinRow) },
    { fruitSet: new Set(FRUIT_LIST.map((f) => f.toLowerCase())) },
  );
  console.log('');
  for (const line of formatReport(report)) console.log(line);
  process.exitCode = report.ok ? 0 : 1;
} catch (err) {
  console.error(`[check] failed: ${err.name || 'Error'}: ${err.message}`);
  process.exitCode = 2;
}
