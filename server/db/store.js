/**
 * Which database the server reads and writes: DATA_STORE=dynamo (default) or
 * postgres. Read once at boot; the barrel (server/schemas/schemas.js) routes
 * each function to that store. Cutover and rollback are this one env var.
 */
export const STORES = ['dynamo', 'postgres'];

export function parseStore(value) {
  const v = (value || 'dynamo').trim().toLowerCase();
  if (!STORES.includes(v)) {
    throw new Error(`DATA_STORE must be one of ${STORES.join(', ')} (got "${value}")`);
  }
  return v;
}

export const DATA_STORE = parseStore(process.env.DATA_STORE);
