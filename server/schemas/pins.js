import {
  DeleteItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { escapeHtml } from '../utils/html.js';
import { dynamoClient, PINS_TABLE } from '../db/dynamo.js';
import { detectZone } from './zone.js';
import { sanitizeString, validateCoordinates } from './validation.js';
import { PinsQueryError } from './errors.js';

function generateGeoHash(lat, lng) {
  return `${Math.round(lat * 10000)}_${Math.round(lng * 10000)}`;
}

function convertDynamoDBItem(item) {
  if (!item) return null;
  return {
    pinId: item.pinId?.S,
    createdAt: item.createdAt?.S,
    updatedAt: item.updatedAt?.S || null,
    coordinates: item.coordinates?.S ? JSON.parse(item.coordinates.S) : null,
    fruitType: item.fruitType?.S,
    fruitTypeDisplay: item.fruitTypeDisplay?.S || item.fruitType?.S,
    notes: item.notes?.S || '',
    submittedBy: item.submittedBy?.S,
    geoHash: item.geoHash?.S || '',
    status: item.status?.S || 'active',
    zone: item.zone?.N ? parseInt(item.zone.N, 10) : null,
    confirmations: (item.confirmations?.L || []).map((c) => ({
      timestamp: c.M?.timestamp?.S,
      anonymous: true,
    })),
  };
}

export async function createPin(pinData) {
  if (!pinData || !pinData.coordinates || !pinData.fruitType || !pinData.submittedBy) {
    throw new Error('Missing required pin data');
  }
  if (typeof pinData.coordinates.lat !== 'number' || typeof pinData.coordinates.lng !== 'number') {
    throw new Error('Invalid coordinates');
  }
  const coordValidation = validateCoordinates(pinData.coordinates.lat, pinData.coordinates.lng);
  if (!coordValidation.valid) {
    throw new Error(coordValidation.message);
  }
  const now = new Date().toISOString();
  const pinId = uuidv4();
  const lat = parseFloat(pinData.coordinates.lat);
  const lng = parseFloat(pinData.coordinates.lng);
  const zone = await detectZone(lat, lng);
  const pin = {
    pinId,
    createdAt: now,
    coordinates: { lat, lng },
    fruitType: escapeHtml(sanitizeString(pinData.fruitType)).toLowerCase(),
    fruitTypeDisplay: escapeHtml(sanitizeString(pinData.fruitType)),
    notes: sanitizeString(pinData.notes || ''),
    submittedBy: sanitizeString(pinData.submittedBy),
    geoHash: generateGeoHash(lat, lng),
    status: 'active',
    zone,
  };
  const params = {
    TableName: PINS_TABLE,
    Item: {
      pinId: { S: pin.pinId },
      createdAt: { S: pin.createdAt },
      coordinates: { S: JSON.stringify(pin.coordinates) },
      fruitType: { S: pin.fruitType },
      fruitTypeDisplay: { S: pin.fruitTypeDisplay },
      notes: { S: pin.notes },
      submittedBy: { S: pin.submittedBy },
      geoHash: { S: pin.geoHash },
      status: { S: pin.status },
      zone: { N: pin.zone.toString() },
    },
  };
  try {
    await dynamoClient.send(new PutItemCommand(params));
    return pin;
  } catch (err) {
    console.error('Error creating pin:', err);
    throw new Error('Failed to create pin');
  }
}

/**
 * @returns {Promise<{ pins: array, cursor: string | null, hasMore: boolean }>}
 * @throws {PinsQueryError} On DynamoDB failure (caller should return 5xx)
 */
export async function getAllPins(options = {}) {
  const { limit = 1000, cursor, submittedBy, bounds } = options;
  let exclusiveStartKey = null;
  if (cursor) {
    try {
      exclusiveStartKey = JSON.parse(
        Buffer.from(cursor, 'base64').toString('utf-8'),
      );
    } catch (err) {
      console.error('Invalid cursor:', err);
    }
  }
  const matchesBounds = (pin) => {
    if (!bounds) return true;
    if (!pin.coordinates) return false;
    const { lat, lng } = pin.coordinates;
    return (
      lat >= bounds.minLat &&
      lat <= bounds.maxLat &&
      lng >= bounds.minLng &&
      lng <= bounds.maxLng
    );
  };
  const makeParams = (queryLimit, startKey) => {
    if (submittedBy) {
      const p = {
        TableName: PINS_TABLE,
        IndexName: 'submittedBy-index',
        KeyConditionExpression: 'submittedBy = :user',
        ExpressionAttributeValues: { ':user': { S: submittedBy } },
        ScanIndexForward: false, // newest first
        Limit: queryLimit,
      };
      if (startKey) p.ExclusiveStartKey = startKey;
      return p;
    }
    const p = {
      TableName: PINS_TABLE,
      IndexName: 'status-index',
      KeyConditionExpression: '#s = :active',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':active': { S: 'active' } },
      // Newest first: when a limit cuts the list short, keep recent finds,
      // not the oldest pins in the table.
      ScanIndexForward: false,
      Limit: queryLimit,
    };
    if (startKey) p.ExclusiveStartKey = startKey;
    return p;
  };
  try {
    if (!bounds) {
      const data = await dynamoClient.send(
        new QueryCommand(makeParams(limit, exclusiveStartKey)),
      );
      const pins = (data.Items || []).map(convertDynamoDBItem);
      const nextCursor = data.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(data.LastEvaluatedKey)).toString('base64')
        : null;
      return { pins, cursor: nextCursor, hasMore: !!data.LastEvaluatedKey };
    }
    const pins = [];
    let lastEvaluatedKey = exclusiveStartKey || null;
    let hasMore = true;
    while (pins.length < limit && hasMore) {
      const remaining = limit - pins.length;
      const pageLimit = Math.max(remaining, 1);
      const page = await dynamoClient.send(
        new QueryCommand(makeParams(pageLimit, lastEvaluatedKey)),
      );
      const pagePins = (page.Items || [])
        .map(convertDynamoDBItem)
        .filter(matchesBounds);
      pins.push(...pagePins);
      lastEvaluatedKey = page.LastEvaluatedKey || null;
      hasMore = !!page.LastEvaluatedKey;
    }
    const nextCursor = lastEvaluatedKey
      ? Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64')
      : null;
    return { pins, cursor: nextCursor, hasMore };
  } catch (err) {
    console.error('Error processing pins:', err);
    throw new PinsQueryError('Failed to load pins from the database', err);
  }
}

export async function getPinById(pinId) {
  if (!pinId || typeof pinId !== 'string') return null;
  const params = {
    TableName: PINS_TABLE,
    KeyConditionExpression: 'pinId = :pid',
    ExpressionAttributeValues: { ':pid': { S: pinId } },
    Limit: 1,
  };
  try {
    const data = await dynamoClient.send(new QueryCommand(params));
    if (!data.Items || data.Items.length === 0) return null;
    return convertDynamoDBItem(data.Items[0]);
  } catch (err) {
    console.error('Error getting pin:', err);
    return null;
  }
}

export async function deletePin(pinId) {
  if (!pinId || typeof pinId !== 'string') {
    throw new Error('Valid pin ID is required');
  }
  const pin = await getPinById(pinId);
  if (!pin) {
    throw new Error('Pin not found');
  }
  try {
    await dynamoClient.send(
      new DeleteItemCommand({
        TableName: PINS_TABLE,
        Key: {
          pinId: { S: pinId },
          createdAt: { S: pin.createdAt },
        },
      }),
    );
    return true;
  } catch (err) {
    console.error('Error deleting pin:', err);
    throw new Error('Failed to delete pin');
  }
}

export async function confirmPin(pinId) {
  if (!pinId || typeof pinId !== 'string') {
    throw new Error('Valid pin ID is required');
  }
  const pin = await getPinById(pinId);
  if (!pin) return null;
  const now = new Date().toISOString();
  try {
    const response = await dynamoClient.send(
      new UpdateItemCommand({
        TableName: PINS_TABLE,
        Key: {
          pinId: { S: pinId },
          createdAt: { S: pin.createdAt },
        },
        UpdateExpression:
          'SET confirmations = list_append(if_not_exists(confirmations, :empty), :new)',
        ExpressionAttributeValues: {
          ':empty': { L: [] },
          ':new': {
            L: [{ M: { timestamp: { S: now }, anonymous: { BOOL: true } } }],
          },
        },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return convertDynamoDBItem(response.Attributes);
  } catch (err) {
    console.error('Error confirming pin:', err);
    throw new Error('Failed to confirm pin');
  }
}

export async function updatePin(pinId, updates) {
  if (!pinId || typeof pinId !== 'string') {
    throw new Error('Valid pin ID is required');
  }
  const pin = await getPinById(pinId);
  if (!pin) {
    throw new Error('Pin not found');
  }
  const updateExpressions = [];
  const attributeValues = {};
  if (updates.notes !== undefined) {
    updateExpressions.push('notes = :notes');
    attributeValues[':notes'] = { S: String(updates.notes || '') };
  }
  if (updates.fruitType !== undefined) {
    const name = escapeHtml(sanitizeString(updates.fruitType));
    updateExpressions.push('fruitType = :fruitType', 'fruitTypeDisplay = :fruitTypeDisplay');
    attributeValues[':fruitType'] = { S: name.toLowerCase() };
    attributeValues[':fruitTypeDisplay'] = { S: name };
  }
  if (updates.coordinates !== undefined) {
    const lat = parseFloat(updates.coordinates.lat);
    const lng = parseFloat(updates.coordinates.lng);
    const coordValidation = validateCoordinates(lat, lng);
    if (!coordValidation.valid) throw new Error(coordValidation.message);
    // The season follows the find's spot, so a moved find gets its zone again.
    const zone = await detectZone(lat, lng);
    updateExpressions.push('coordinates = :coordinates', 'geoHash = :geoHash', '#zone = :zone');
    attributeValues[':coordinates'] = { S: JSON.stringify({ lat, lng }) };
    attributeValues[':geoHash'] = { S: generateGeoHash(lat, lng) };
    attributeValues[':zone'] = { N: String(zone) };
  }
  if (updateExpressions.length === 0) {
    return pin;
  }
  try {
    const response = await dynamoClient.send(
      new UpdateItemCommand({
        TableName: PINS_TABLE,
        Key: {
          pinId: { S: pinId },
          createdAt: { S: pin.createdAt },
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}, updatedAt = :now`,
        ExpressionAttributeValues: {
          ...attributeValues,
          ':now': { S: new Date().toISOString() },
        },
        // "zone" is a DynamoDB reserved word
        ...(updates.coordinates !== undefined ? { ExpressionAttributeNames: { '#zone': 'zone' } } : {}),
        ReturnValues: 'ALL_NEW',
      }),
    );
    return convertDynamoDBItem(response.Attributes);
  } catch (err) {
    console.error('Error updating pin:', err);
    throw new Error('Failed to update pin');
  }
}
