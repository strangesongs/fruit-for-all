# DynamoDB Global Secondary Index (GSI) Setup Guide

This document provides instructions for adding Global Secondary Indexes to the LoquatPins DynamoDB table to improve query performance.

## Why GSIs Are Needed

Currently, the application uses `Scan` operations which are inefficient for large datasets:
- **Scan** reads every item in the table (expensive and slow)
- **Query** with GSI reads only matching items (fast and cost-effective)

## Required GSIs

### 1. Status Index (Primary Use Case: Filter Active Pins)

**Purpose:** Efficiently query pins by status (active/inactive/deleted)

**Configuration:**
- **Index Name:** `status-index`
- **Partition Key:** `status` (String)
- **Sort Key:** `createdAt` (String)
- **Projected Attributes:** ALL
- **Read/Write Capacity:** On-demand (or match table settings)

**Use Case:** `GET /api/pins?status=active`

### 2. SubmittedBy Index (Primary Use Case: User's Pins)

**Purpose:** Efficiently query all pins created by a specific user

**Configuration:**
- **Index Name:** `submittedBy-index`
- **Partition Key:** `submittedBy` (String)
- **Sort Key:** `createdAt` (String)
- **Projected Attributes:** ALL
- **Read/Write Capacity:** On-demand (or match table settings)

**Use Case:** `GET /api/pins/my` (current user's pins)

### 3. GeoHash Index (Primary Use Case: Location-Based Queries)

**Purpose:** Efficiently query pins within a geographic area

**Configuration:**
- **Index Name:** `geoHash-index`
- **Partition Key:** `geoHash` (String)
- **Sort Key:** `createdAt` (String)
- **Projected Attributes:** ALL
- **Read/Write Capacity:** On-demand (or match table settings)

**Use Case:** Future feature - "Show pins near me" or "Pins in neighborhood X"

## AWS Console Setup Steps

### Step 1: Navigate to DynamoDB Table
1. Log into AWS Console
2. Go to **DynamoDB** service
3. Select **Tables** from left sidebar
4. Click on **LoquatPins** table

### Step 2: Create Status Index
1. Click **Indexes** tab
2. Click **Create index** button
3. Fill in the form:
   - **Partition key:** `status` (String)
   - **Sort key:** `createdAt` (String)
   - **Index name:** `status-index`
   - **Attribute projections:** All
   - **Capacity mode:** On-demand (recommended) or match table
4. Click **Create index**
5. Wait for index status to become **Active** (~5-10 minutes)

### Step 3: Create SubmittedBy Index
1. Click **Create index** button again
2. Fill in the form:
   - **Partition key:** `submittedBy` (String)
   - **Sort key:** `createdAt` (String)
   - **Index name:** `submittedBy-index`
   - **Attribute projections:** All
   - **Capacity mode:** On-demand
3. Click **Create index**
4. Wait for index status to become **Active**

### Step 4: Create GeoHash Index
1. Click **Create index** button again
2. Fill in the form:
   - **Partition key:** `geoHash` (String)
   - **Sort key:** `createdAt` (String)
   - **Index name:** `geoHash-index`
   - **Attribute projections:** All
   - **Capacity mode:** On-demand
3. Click **Create index**
4. Wait for index status to become **Active**

## Updating Application Code

After GSIs are created, update `server/schemas/schemas.js` to use Query instead of Scan:

### Example: Query by SubmittedBy
```javascript
import { QueryCommand } from '@aws-sdk/client-dynamodb';

async function getPinsByUser(userName, options = {}) {
  const { limit = 100, cursor } = options;
  
  const params = {
    TableName: PINS_TABLE,
    IndexName: 'submittedBy-index',
    KeyConditionExpression: 'submittedBy = :userName',
    ExpressionAttributeValues: {
      ':userName': { S: userName }
    },
    Limit: limit,
    ScanIndexForward: false // Most recent first
  };
  
  if (cursor) {
    params.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
  }
  
  const data = await client.send(new QueryCommand(params));
  // ... process results
}
```

### Example: Query by Status
```javascript
async function getActivePins(options = {}) {
  const { limit = 100, cursor } = options;
  
  const params = {
    TableName: PINS_TABLE,
    IndexName: 'status-index',
    KeyConditionExpression: 'status = :status',
    ExpressionAttributeValues: {
      ':status': { S: 'active' }
    },
    Limit: limit,
    ScanIndexForward: false
  };
  
  if (cursor) {
    params.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
  }
  
  const data = await client.send(new QueryCommand(params));
  // ... process results
}
```

## Performance Impact

**Before (Scan):**
- Cost: ~$0.25 per million reads (scans entire table)
- Speed: 50-100ms for 1000 items, slower as table grows
- Scalability: Degrades linearly with table size

**After (Query with GSI):**
- Cost: ~$0.25 per million reads (only reads matching items)
- Speed: 5-20ms for typical queries
- Scalability: Consistent performance regardless of table size

## Cost Considerations

- **On-Demand Pricing:** Pay per request (recommended for development/low traffic)
- **Provisioned Pricing:** Set read/write capacity units (better for predictable traffic)
- **Storage:** Each GSI costs additional storage (~same as base table)

## Monitoring

After creating GSIs, monitor in AWS Console:
1. Go to **Metrics** tab
2. Watch **ConsumedReadCapacityUnits** and **ConsumedWriteCapacityUnits**
3. Adjust capacity if using provisioned mode

## Rollback Plan

If issues occur:
1. GSIs can be deleted without affecting base table
2. Application will fall back to Scan operations
3. No data loss risk

## Next Steps

1. Create the three GSIs in AWS Console
2. Update `getAllPins` to use `status-index` for active pins query
3. Update `getMyPins` to use `submittedBy-index` instead of FilterExpression
4. Implement location-based queries using `geoHash-index` (future feature)
5. Monitor query performance improvements in CloudWatch
