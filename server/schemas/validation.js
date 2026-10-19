export function sanitizeString(str, maxLength = 1000) {
  if (typeof str !== 'string') return '';
  return str.trim().substring(0, maxLength);
}

export function validateCoordinates(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { valid: false, message: 'Coordinates must be numbers' };
  }
  if (lat < -90 || lat > 90) {
    return { valid: false, message: 'Latitude must be between -90 and 90' };
  }
  if (lng < -180 || lng > 180) {
    return { valid: false, message: 'Longitude must be between -180 and 180' };
  }
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return { valid: false, message: 'Coordinates cannot be NaN' };
  }
  return { valid: true };
}

export function validatePassword(password) {
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

// Names that could be mistaken for staff accounts. Compared case-insensitively.
const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'system', 'support', 'moderator', 'mod',
  'staff', 'fruitforall', 'fruit-for-all', 'fruit_for_all', 'loquat', 'null', 'undefined',
]);

export const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,24}$/;

export function isReservedUserName(userName) {
  if (typeof userName !== 'string') return false;
  return RESERVED_USERNAMES.has(userName.trim().toLowerCase());
}

export function validateUserName(userName) {
  if (typeof userName !== 'string' || !userName.trim()) {
    return { valid: false, message: 'Username is required' };
  }
  const name = userName.trim();
  if (!USERNAME_PATTERN.test(name)) {
    return {
      valid: false,
      message: 'Username must be 3–24 characters: letters, numbers, dot, dash or underscore',
    };
  }
  if (isReservedUserName(name)) {
    return { valid: false, message: 'That username is reserved' };
  }
  return { valid: true };
}

export const MAX_NOTES_CHARS = 1000;
export const MAX_NOTES_WORDS = 500;

/** Notes are optional: undefined/null/'' are fine; anything else must be a short string. */
export function validateNotes(notes) {
  if (notes === undefined || notes === null || notes === '') return { valid: true };
  if (typeof notes !== 'string') return { valid: false, message: 'Notes must be text' };
  if (notes.length > MAX_NOTES_CHARS) {
    return { valid: false, message: `Notes cannot exceed ${MAX_NOTES_CHARS} characters` };
  }
  if (notes.trim().split(/\s+/).length > MAX_NOTES_WORDS) {
    return { valid: false, message: `Notes cannot exceed ${MAX_NOTES_WORDS} words` };
  }
  return { valid: true };
}

/**
 * Validates the body of POST /api/pins before any string methods are called on it.
 * `allowedFruit` is a Set of lowercase fruit names.
 */
export function validatePinInput(body, allowedFruit) {
  if (!body || typeof body !== 'object') {
    return { valid: false, message: 'Request body must be JSON' };
  }
  const { coordinates, fruitType, notes } = body;
  if (!coordinates || typeof coordinates !== 'object') {
    return { valid: false, message: 'Missing required fields: coordinates and fruitType are required' };
  }
  const { lat, lng } = coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { valid: false, message: 'Coordinates must be numbers' };
  }
  const coordCheck = validateCoordinates(lat, lng);
  if (!coordCheck.valid) return coordCheck;
  if (typeof fruitType !== 'string' || !fruitType.trim()) {
    return { valid: false, message: 'Missing required fields: coordinates and fruitType are required' };
  }
  if (allowedFruit && !allowedFruit.has(fruitType.trim().toLowerCase())) {
    return { valid: false, message: 'Invalid fruit type. Please select from the approved list.' };
  }
  return validateNotes(notes);
}

export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, message: 'Email is required' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Please enter a valid email address' };
  }
  return { valid: true };
}
