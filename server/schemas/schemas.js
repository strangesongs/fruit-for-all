// Clean DynamoDB schema for Loquat 2.0 - matching table structure
import { 
  DynamoDBClient, 
  GetItemCommand, 
  PutItemCommand, 
  ScanCommand, 
  QueryCommand,
  DeleteItemCommand,
  UpdateItemCommand
} from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Zone detection for seasonal indicators
// Tries phzmapi.com first; falls back to local heuristic on timeout/error.
async function detectZone(lat, lng) {
  try {
    const url = `https://phzmapi.com/${lat}/${lng}.json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      // phzmapi returns e.g. "9b" — strip the sub-zone letter
      const z = parseInt(data.zone);
      if (z >= 1 && z <= 13) return z;
    }
  } catch (_) {
    // timeout, network error, or unexpected response — fall through to heuristic
  }
  return detectZoneFallback(lat, lng);
}

// Local heuristic fallback (used when phzmapi is unreachable)
function detectZoneFallback(lat, lng) {
  // Outside continental US: rough latitude-only fallback
  if (lat < 24 || lat > 49 || lng < -125 || lng > -66) {
    if (lat > 40) return 6;
    if (lat > 30) return 8;
    if (lat > 15) return 10;
    return 11;
  }

  // --- South Florida (Zone 10-11) ---
  if (lat < 25.5) return 11;  // Florida Keys / southernmost tip
  if (lat < 28 && lng > -82) return 10;

  // --- Southern California coast (Zone 10) ---
  if (lat < 33 && lng < -117) return 10;

  // --- Low Sonoran desert (Zone 10): Yuma / low-elevation SW Arizona ---
  if (lat < 33 && lng >= -115 && lng < -109) return 10;

  // --- Interior desert Southwest (Zone 9): Phoenix, Tucson, Las Vegas ---
  if (lat < 37 && lng >= -117 && lng < -109) return 9;

  // --- Pacific Coast + Puget Sound / Willamette Valley (maritime climate) ---
  if (lng < -122) {
    if (lat < 34) return 10;
    if (lat < 39) return 9;   // Bay Area, Northern CA coast, Napa/Sonoma
    if (lat < 49) return 8;   // Oregon coast, WA coast, Portland, Seattle
  }

  // --- California Central and Sacramento Valleys (Zone 9) ---
  if (lat < 39 && lng >= -122 && lng < -118) return 9;

  // --- Gulf Coast (Zone 9): Florida north of 28°, Gulf states coastline ---
  if (lat < 31 && lng > -85) return 9;
  if (lat < 32 && lng > -97) return 9;

  // --- Southeast, Deep South, Mid-South (Zone 8) ---
  if (lat < 36 && lng > -100) return 8;
  if (lat < 38 && lng > -95) return 8;
  if (lat < 38 && lng > -78) return 8;

  // --- SW high desert (Zone 7): Albuquerque, Santa Fe, El Paso area ---
  if (lat < 37 && lng > -109 && lng < -100) return 7;

  // --- Great Basin and Intermountain West (Zone 7): Reno, Salt Lake City ---
  if (lat < 42 && lng > -120 && lng < -109) return 7;

  // --- Mid-Atlantic and Southern Appalachia (Zone 7) ---
  if (lat < 37 && lng > -100 && lng < -75) return 7;
  if (lat < 40 && lng > -80) return 7;

  // --- NY / NE coastal corridor (Zone 7) ---
  if (lat < 42 && lng > -76) return 7;

  // --- Upper Midwest, Great Plains (Zone 6) ---
  if (lat < 42 && lng > -95) return 6;
  if (lat < 44 && lng > -75) return 6;
  if (lat < 48 && lng > -118 && lng < -113) return 6; // Western ID / Spokane corridor

  // --- Northern tier ---
  if (lat < 45) return 5;
  if (lat < 47) return 4;
  return 3;
}

const REGION = process.env.AWS_REGION || 'us-west-2';
const USERS_TABLE = process.env.DYNAMODB_USERS_TABLE || 'LoquatUsers';
const PINS_TABLE = process.env.PINS_TABLE || 'LoquatPins';
const client = new DynamoDBClient({ region: REGION });

// Utility functions
function sanitizeString(str, maxLength = 1000) {
  if (typeof str !== 'string') return '';
  return str.trim().substring(0, maxLength);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function generateGeoHash(lat, lng) {
  return `${Math.round(lat * 10000)}_${Math.round(lng * 10000)}`;
}

// Convert a DynamoDB item's attributes back to a plain JS pin object
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
    zone: item.zone?.N ? parseInt(item.zone.N) : null
  };
}

// Validate coordinates are within valid ranges
function validateCoordinates(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { valid: false, message: 'Coordinates must be numbers' };
  }
  
  if (lat < -90 || lat > 90) {
    return { valid: false, message: 'Latitude must be between -90 and 90' };
  }
  
  if (lng < -180 || lng > 180) {
    return { valid: false, message: 'Longitude must be between -180 and 180' };
  }
  
  if (isNaN(lat) || isNaN(lng)) {
    return { valid: false, message: 'Coordinates cannot be NaN' };
  }
  
  return { valid: true };
}

// Password validation function
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }
  
  if (password.length < 10) {
    return { valid: false, message: 'Password must be at least 10 characters long' };
  }
  
  if (!/\d/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one symbol' };
  }
  
  return { valid: true };
}

// Email validation function  
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, message: 'Email is required' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Please enter a valid email address' };
  }
  
  return { valid: true };
}

// USER FUNCTIONS
async function getUser(userName) {
  const params = {
    TableName: USERS_TABLE,
    Key: {
      userName: { S: userName }
    }
  };
  
  try {
    const data = await client.send(new GetItemCommand(params));
    if (!data.Item) return null;
    return {
      userName: data.Item.userName.S,
      passwordHash: data.Item.passwordHash?.S || null,
      email: data.Item.email?.S || null,
      createdAt: data.Item.createdAt?.S || null,
      lastLogin: data.Item.lastLogin?.S || null,
      isAdmin: data.Item.isAdmin?.BOOL || false,
      resetToken: data.Item.resetToken?.S || null,
      resetTokenExpiry: data.Item.resetTokenExpiry?.S || null,
      // Keep legacy field for migration
      savedPins: data.Item.savedPins ? JSON.parse(data.Item.savedPins.S) : []
    };
  } catch (err) {
    console.error('Error getting user:', err);
    return null;
  }
}

async function saveUser(user) {
  const item = {
    userName: { S: user.userName }
  };

  // Add optional fields if they exist
  if (user.passwordHash) item.passwordHash = { S: user.passwordHash };
  if (user.email) item.email = { S: user.email };
  if (user.createdAt) item.createdAt = { S: user.createdAt };
  if (user.lastLogin) item.lastLogin = { S: user.lastLogin };
  if (user.isAdmin !== undefined) item.isAdmin = { BOOL: !!user.isAdmin };
  if (user.resetToken) item.resetToken = { S: user.resetToken };
  if (user.resetTokenExpiry) item.resetTokenExpiry = { S: user.resetTokenExpiry };
  
  // Keep legacy field for migration
  if (user.savedPins) item.savedPins = { S: JSON.stringify(user.savedPins) };

  const params = {
    TableName: USERS_TABLE,
    Item: item
  };
  
  try {
    await client.send(new PutItemCommand(params));
    return true;
  } catch (err) {
    console.error('Error saving user:', err);
    return false;
  }
}

// PIN FUNCTIONS
async function createPin(pinData) {
  // Validation
  if (!pinData || !pinData.coordinates || !pinData.fruitType || !pinData.submittedBy) {
    throw new Error('Missing required pin data');
  }
  
  if (typeof pinData.coordinates.lat !== 'number' || typeof pinData.coordinates.lng !== 'number') {
    throw new Error('Invalid coordinates');
  }
  
  // Validate coordinate bounds
  const coordValidation = validateCoordinates(pinData.coordinates.lat, pinData.coordinates.lng);
  if (!coordValidation.valid) {
    throw new Error(coordValidation.message);
  }

  const now = new Date().toISOString();
  const pinId = uuidv4();
  const lat = parseFloat(pinData.coordinates.lat);
  const lng = parseFloat(pinData.coordinates.lng);
  
  // Detect USDA hardiness zone from coordinates
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
    zone: zone
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
      zone: { N: pin.zone.toString() }
    }
  };

  try {
    await client.send(new PutItemCommand(params));
    return pin;
  } catch (err) {
    console.error('Error creating pin:', err);
    throw new Error('Failed to create pin');
  }
}

async function getAllPins(options = {}) {
  const { limit = 1000, cursor, submittedBy, bounds } = options;

  let data;

  if (submittedBy) {
    // Use submittedBy-index GSI to avoid full table scan
    const params = {
      TableName: PINS_TABLE,
      IndexName: 'submittedBy-index',
      KeyConditionExpression: 'submittedBy = :user',
      ExpressionAttributeValues: { ':user': { S: submittedBy } },
      Limit: limit
    };
    if (cursor) {
      try { params.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')); }
      catch (err) { console.error('Invalid cursor:', err); }
    }
    data = await client.send(new QueryCommand(params));
  } else {
    // Use status-index GSI — all active pins, no full table scan
    const params = {
      TableName: PINS_TABLE,
      IndexName: 'status-index',
      KeyConditionExpression: '#s = :active',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':active': { S: 'active' } },
      Limit: limit
    };
    if (cursor) {
      try { params.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')); }
      catch (err) { console.error('Invalid cursor:', err); }
    }
    data = await client.send(new QueryCommand(params));
  }

  try {
    let pins = (data.Items || []).map(convertDynamoDBItem);

    // Filter by bounds in application if provided
    if (bounds) {
      pins = pins.filter(pin => {
        if (!pin.coordinates) return false;
        const { lat, lng } = pin.coordinates;
        return lat >= bounds.minLat && lat <= bounds.maxLat &&
               lng >= bounds.minLng && lng <= bounds.maxLng;
      });
    }

    let nextCursor = null;
    if (data.LastEvaluatedKey) {
      nextCursor = Buffer.from(JSON.stringify(data.LastEvaluatedKey)).toString('base64');
    }

    return { pins, cursor: nextCursor, hasMore: !!data.LastEvaluatedKey };
  } catch (err) {
    console.error('Error processing pins:', err);
    return { pins: [], cursor: null, hasMore: false };
  }
}

async function getPinById(pinId) {
  // Scan with filter since pinId is not the sole partition key
  const params = {
    TableName: PINS_TABLE,
    FilterExpression: 'pinId = :pinId',
    ExpressionAttributeValues: { ':pinId': { S: pinId } }
  };
  try {
    const data = await client.send(new ScanCommand(params));
    if (!data.Items || data.Items.length === 0) return null;
    return convertDynamoDBItem(data.Items[0]);
  } catch (err) {
    console.error('Error getting pin:', err);
    return null;
  }
}

// Create new user with password hashing
async function createUser(userData) {
  const { userName, password, email } = userData;
  
  // Validation
  if (!userName || typeof userName !== 'string' || userName.trim().length < 3) {
    throw new Error('Username must be at least 3 characters long');
  }
  
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required');
  }
  
  if (!password || typeof password !== 'string') {
    throw new Error('Password is required');
  }
  
  // Validate email format
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    throw new Error(emailValidation.message);
  }
  
  // Validate password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.message);
  }
  
  // Check if username already exists
  const existingUser = await getUser(userName.trim());
  if (existingUser && existingUser.passwordHash) {
    throw new Error('Username already registered');
  }

  // Check if email already exists
  const existingEmail = await getUserByEmail(email.trim().toLowerCase());
  if (existingEmail) {
    throw new Error('Email already registered');
  }
  
  // Hash password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);
  
  // Create user object
  const now = new Date().toISOString();
  const user = {
    userName: userName.trim(),
    passwordHash,
    email: email.trim().toLowerCase(),
    createdAt: now,
    lastLogin: now,
    isAdmin: userName.trim().toLowerCase() === 'admin', // Admin privileges only for 'admin' user
    savedPins: [] // Keep for migration compatibility
  };
  
  const success = await saveUser(user);
  if (!success) {
    throw new Error('Failed to create user');
  }
  
  // Return user without password hash
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

// Verify user login
async function verifyUser(userName, password) {
  if (!userName || !password) {
    throw new Error('Username and password are required');
  }
  
  const user = await getUser(userName);
  if (!user || !user.passwordHash) {
    throw new Error('Invalid username or password');
  }
  
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new Error('Invalid username or password');
  }
  
  // Update last login
  user.lastLogin = new Date().toISOString();
  await saveUser(user);
  
  // Return user without password hash
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

// Delete a pin by ID
async function deletePin(pinId) {
  if (!pinId || typeof pinId !== 'string') {
    throw new Error('Valid pin ID is required');
  }
  
  // First get the pin to find its createdAt (needed for delete since it's part of the key)
  const pin = await getPinById(pinId);
  if (!pin) {
    throw new Error('Pin not found');
  }
  
  const params = {
    TableName: PINS_TABLE,
    Key: {
      pinId: { S: pinId },
      createdAt: { S: pin.createdAt }
    }
  };
  
  try {
    await client.send(new DeleteItemCommand(params));
    return true;
  } catch (err) {
    console.error('Error deleting pin:', err);
    throw new Error('Failed to delete pin');
  }
}

// Update pin (e.g., edit notes)
async function updatePin(pinId, updates) {
  if (!pinId || typeof pinId !== 'string') {
    throw new Error('Valid pin ID is required');
  }
  
  // Get the pin to find its createdAt (needed for update since it's part of the key)
  const pin = await getPinById(pinId);
  if (!pin) {
    throw new Error('Pin not found');
  }
  
  // Build update expression and attribute values
  const updateExpressions = [];
  const attributeValues = {};
  
  if (updates.notes !== undefined) {
    updateExpressions.push('notes = :notes');
    attributeValues[':notes'] = { S: String(updates.notes || '') };
  }
  
  if (updateExpressions.length === 0) {
    return pin; // No updates to make
  }
  
  const params = {
    TableName: PINS_TABLE,
    Key: {
      pinId: { S: pinId },
      createdAt: { S: pin.createdAt }
    },
    UpdateExpression: 'SET ' + updateExpressions.join(', ') + ', updatedAt = :now',
    ExpressionAttributeValues: {
      ...attributeValues,
      ':now': { S: new Date().toISOString() }
    },
    ReturnValues: 'ALL_NEW'
  };
  
  try {
    const response = await client.send(new UpdateItemCommand(params));
    // Convert DynamoDB response back to normal object
    return convertDynamoDBItem(response.Attributes);
  } catch (err) {
    console.error('Error updating pin:', err);
    throw new Error('Failed to update pin');
  }
}

// Find user by email address (scans LoquatUsers — small table)
async function getUserByEmail(email) {
  if (!email) return null;
  const params = {
    TableName: USERS_TABLE,
    FilterExpression: 'email = :email',
    ExpressionAttributeValues: { ':email': { S: email.trim().toLowerCase() } }
  };
  try {
    const data = await client.send(new ScanCommand(params));
    if (!data.Items || data.Items.length === 0) return null;
    const item = data.Items[0];
    return {
      userName: item.userName.S,
      passwordHash: item.passwordHash?.S || null,
      email: item.email?.S || null,
      createdAt: item.createdAt?.S || null,
      lastLogin: item.lastLogin?.S || null,
      isAdmin: item.isAdmin?.BOOL || false,
      resetToken: item.resetToken?.S || null,
      resetTokenExpiry: item.resetTokenExpiry?.S || null,
      savedPins: item.savedPins ? JSON.parse(item.savedPins.S) : []
    };
  } catch (err) {
    console.error('Error finding user by email:', err);
    return null;
  }
}

// Generate and store a password reset token for a given email
// Returns { userName, email, token } or throws
async function requestPasswordReset(email) {
  const user = await getUserByEmail(email);
  if (!user) throw new Error('No account found with that email address');

  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  user.resetToken = token;
  user.resetTokenExpiry = expiry;
  await saveUser(user);

  return { userName: user.userName, email: user.email, token };
}

// Validate reset token and update password
async function resetPassword(token, newPassword) {
  if (!token) throw new Error('Reset token is required');

  // Find user by reset token (scan — small table)
  const params = {
    TableName: USERS_TABLE,
    FilterExpression: 'resetToken = :token',
    ExpressionAttributeValues: { ':token': { S: token } }
  };

  const data = await client.send(new ScanCommand(params));
  if (!data.Items || data.Items.length === 0) throw new Error('Invalid or expired reset link');

  const item = data.Items[0];
  const expiry = item.resetTokenExpiry?.S;
  if (!expiry || new Date(expiry) < new Date()) throw new Error('Reset link has expired');

  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) throw new Error(passwordValidation.message);

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const user = {
    userName: item.userName.S,
    passwordHash,
    email: item.email?.S || null,
    createdAt: item.createdAt?.S || null,
    lastLogin: item.lastLogin?.S || null,
    isAdmin: item.isAdmin?.BOOL || false,
    resetToken: null,
    resetTokenExpiry: null,
    savedPins: item.savedPins ? JSON.parse(item.savedPins.S) : []
  };

  // Remove token fields from DB by omitting them (saveUser skips null values)
  await saveUser(user);
  return { userName: user.userName };
}

export { 
  getUser,
  getUserByEmail,
  saveUser, 
  createUser, 
  verifyUser,
  requestPasswordReset,
  resetPassword,
  createPin, 
  getAllPins, 
  getPinById,
  deletePin,
  updatePin,
  validatePassword,
  validateEmail 
};
