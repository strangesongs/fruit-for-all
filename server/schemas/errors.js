/**
 * Thrown when a DynamoDB query for pins fails (e.g. network, throttling, misconfiguration).
 * Callers can distinguish this from an empty result and return HTTP 5xx to the client.
 */
export class PinsQueryError extends Error {
  /**
   * @param {string} message
   * @param {unknown} [cause]
   */
  constructor(message = 'Failed to load pins from the database', cause) {
    super(message);
    this.name = 'PinsQueryError';
    this.cause = cause;
  }
}

/**
 * Thrown when a read or write on the users table fails (network, throttling,
 * misconfiguration). It is not a UserError, so auth handlers log it and answer
 * a generic 500 instead of "Invalid username or password" or "User not found".
 */
export class UsersQueryError extends Error {
  /**
   * @param {string} message
   * @param {unknown} [cause]
   */
  constructor(message = 'Failed to reach the users table', cause) {
    super(message);
    this.name = 'UsersQueryError';
    this.cause = cause;
  }
}

/**
 * An error whose message is written for the person using the app
 * ("Invalid username or password"). Anything else (a database or network
 * failure) is logged and replaced with a generic message; see publicMessage.
 */
export class UserError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'UserError';
  }
}

/**
 * The message that is safe to send to the browser for `error`.
 * @param {unknown} error
 * @param {string} fallback shown when the error is not a UserError
 */
export function publicMessage(error, fallback) {
  return error instanceof UserError ? error.message : fallback;
}
