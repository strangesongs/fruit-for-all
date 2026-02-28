import { DynamoDBClient, UpdateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-west-2' });
const TABLE = process.env.PINS_TABLE || 'LoquatPins';

async function waitForGSI(indexName) {
  process.stdout.write(`  Waiting for ${indexName} to become ACTIVE`);
  while (true) {
    await new Promise(r => setTimeout(r, 8000));
    const desc = await client.send(new DescribeTableCommand({ TableName: TABLE }));
    const idx = (desc.Table.GlobalSecondaryIndexes || []).find(i => i.IndexName === indexName);
    if (idx?.IndexStatus === 'ACTIVE') { console.log(' ✓'); return; }
    process.stdout.write('.');
  }
}

async function createGSI(indexName, hashKey, rangeKey, extraAttrs = []) {
  console.log(`Creating ${indexName}...`);
  await client.send(new UpdateTableCommand({
    TableName: TABLE,
    AttributeDefinitions: [
      { AttributeName: hashKey,  AttributeType: 'S' },
      { AttributeName: rangeKey, AttributeType: 'S' },
      ...extraAttrs
    ],
    GlobalSecondaryIndexUpdates: [{ Create: {
      IndexName: indexName,
      KeySchema: [
        { AttributeName: hashKey,  KeyType: 'HASH' },
        { AttributeName: rangeKey, KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' }
    }}]
  }));
  await waitForGSI(indexName);
}

await createGSI('submittedBy-index', 'submittedBy', 'createdAt');
await createGSI('status-index', 'status', 'createdAt');
console.log('All GSIs created successfully.');
