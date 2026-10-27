/**
 * Barrel: database + validation for tests and `import * as db` in controllers.
 * New code can import from `users.js`, `pins.js`, or `validation.js` directly.
 */
import { DATA_STORE } from '../db/store.js';
import * as dynamoUsers from './users.js';
import * as pgUsers from './pg/users.js';
import * as dynamoPins from './pins.js';
import * as pgPins from './pg/pins.js';
import * as pgAdmin from './pg/admin.js';
import { AdminUnavailableError } from './errors.js';

// Users and pins follow DATA_STORE (server/db/store.js).
const users = DATA_STORE === 'postgres' ? pgUsers : dynamoUsers;
const pins = DATA_STORE === 'postgres' ? pgPins : dynamoPins;
export const getUser = (...a) => users.getUser(...a);
export const getUserByEmail = (...a) => users.getUserByEmail(...a);
export const saveUser = (...a) => users.saveUser(...a);
export const createUser = (...a) => users.createUser(...a);
export const verifyUser = (...a) => users.verifyUser(...a);
export const requestPasswordReset = (...a) => users.requestPasswordReset(...a);
export const resetPassword = (...a) => users.resetPassword(...a);
export const createPin = (...a) => pins.createPin(...a);
export const getAllPins = (...a) => pins.getAllPins(...a);
export const getPinById = (...a) => pins.getPinById(...a);
export const deletePin = (...a) => pins.deletePin(...a);
export const updatePin = (...a) => pins.updatePin(...a);
export const confirmPin = (...a) => pins.confirmPin(...a);
export const reportPin = (...a) => pins.reportPin(...a);

// The command center: Postgres only (no DynamoDB twin; that code goes in late Nov 2026).
const admin = (name) => (...a) => {
  if (DATA_STORE !== 'postgres') throw new AdminUnavailableError();
  return pgAdmin[name](...a);
};
export const getAdminSummary = admin('getSummary');
export const getAdminOverview = admin('getOverview');
export const handleReport = admin('handleReport');
export const hidePin = admin('hidePin');
export const restorePin = admin('restorePin');
export const markStillThere = admin('markStillThere');
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
export { PinsQueryError, UserError, UsersQueryError, AdminUnavailableError } from './errors.js';
