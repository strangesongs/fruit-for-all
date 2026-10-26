/**
 * Barrel: database + validation for tests and `import * as db` in controllers.
 * New code can import from `users.js`, `pins.js`, or `validation.js` directly.
 */
import { DATA_STORE } from '../db/store.js';
import * as dynamoUsers from './users.js';
import * as pgUsers from './pg/users.js';

// Users follow DATA_STORE (server/db/store.js). Pins stay on DynamoDB until
// their Postgres twin lands (PR 3 of the move).
const users = DATA_STORE === 'postgres' ? pgUsers : dynamoUsers;
export const getUser = (...a) => users.getUser(...a);
export const getUserByEmail = (...a) => users.getUserByEmail(...a);
export const saveUser = (...a) => users.saveUser(...a);
export const createUser = (...a) => users.createUser(...a);
export const verifyUser = (...a) => users.verifyUser(...a);
export const requestPasswordReset = (...a) => users.requestPasswordReset(...a);
export const resetPassword = (...a) => users.resetPassword(...a);
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
