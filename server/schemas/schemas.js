/**
 * Barrel: database + validation for tests and `import * as db` in controllers.
 * New code can import from `users.js`, `pins.js`, or `validation.js` directly.
 */
export {
  getUser,
  getUserByEmail,
  saveUser,
  createUser,
  verifyUser,
  requestPasswordReset,
  resetPassword,
} from './users.js';
export {
  createPin,
  getAllPins,
  getPinById,
  deletePin,
  updatePin,
  confirmPin,
  reportPin,
} from './pins.js';
export {
  validatePassword,
  validateEmail,
  sanitizeString,
  validateCoordinates,
  validateUserName,
  isReservedUserName,
  validateNotes,
  validatePinInput,
  validatePinUpdate,
} from './validation.js';
export { detectZone, detectZoneFallback } from './zone.js';
export { escapeHtml } from '../utils/html.js';
export { PinsQueryError, UserError, UsersQueryError } from './errors.js';
