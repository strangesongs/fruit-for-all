/**
 * Users on Postgres: the same functions, arguments, return shapes and errors as
 * server/schemas/users.js (DynamoDB). Contract: tests/server/pgUsers.test.js.
 *
 * - Names keep the case they were registered with; every lookup ignores case,
 *   and what's returned (and so what goes in the JWT) is the stored case.
 * - Emails are stored lower case; one account per email (unique index).
 * - Reset links: only a SHA-256 of the token is stored, in password_resets;
 *   single use, one live link per account, 1 hour.
 * - Database failures throw UsersQueryError, never null ("no such user").
 */
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query, withTransaction } from '../../db/postgres.js';
import { UserError, UsersQueryError } from '../errors.js';
import { validateEmail, validatePassword, validateUserName } from '../validation.js';

const SALT_ROUNDS = 12;
const RESET_TTL_MS = 60 * 60 * 1000;

const COLUMNS = 'user_name, email, password_hash, is_admin, created_at, last_login';

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const iso = (d) => (d ? new Date(d).toISOString() : null);

/** A row → the shape users.js returns (reset fields are never read from users any more). */
export function toUser(row) {
  if (!row) return null;
  return {
    userName: row.user_name,
    passwordHash: row.password_hash || null,
    email: row.email || null,
    createdAt: iso(row.created_at),
    lastLogin: iso(row.last_login),
    isAdmin: row.is_admin === true,
    resetToken: null,
    resetTokenExpiry: null,
    savedPins: [],
  };
}

async function run(text, params, what) {
  try {
    return await query(text, params);
  } catch (err) {
    console.error(`Error ${what}:`, err.message);
    throw new UsersQueryError(`Failed to ${what}`, err);
  }
}

export async function getUser(userName) {
  if (typeof userName !== 'string' || !userName) return null;
  const { rows } = await run(
    `select ${COLUMNS} from users where lower(user_name) = lower($1)`,
    [userName.trim()],
    'read user',
  );
  return toUser(rows[0]);
}

export async function getUserByEmail(email) {
  if (typeof email !== 'string' || !email) return null;
  const { rows } = await run(
    `select ${COLUMNS} from users where email = $1`,
    [email.trim().toLowerCase()],
    'look up user by email',
  );
  return toUser(rows[0]);
}

/**
 * Insert or update by name, writing only the fields given (as users.js does).
 * The flows below use their own statements; this stays for callers of the barrel.
 */
export async function saveUser(user) {
  if (!user || typeof user.userName !== 'string') throw new UsersQueryError('Failed to save user');
  const fields = {
    email: user.email ? user.email.trim().toLowerCase() : undefined,
    password_hash: user.passwordHash || undefined,
    is_admin: user.isAdmin === undefined ? undefined : !!user.isAdmin,
    created_at: user.createdAt || undefined,
    last_login: user.lastLogin || undefined,
  };
  const cols = Object.keys(fields).filter((k) => fields[k] !== undefined);
  const values = cols.map((k) => fields[k]);
  const existing = await getUser(user.userName);
  if (existing) {
    if (cols.length === 0) return true;
    const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
    await run(`update users set ${sets} where user_name = $1`, [existing.userName, ...values], 'save user');
    return true;
  }
  const allCols = ['user_name', ...cols];
  const params = allCols.map((_, i) => `$${i + 1}`).join(', ');
  await run(`insert into users (${allCols.join(', ')}) values (${params})`, [user.userName.trim(), ...values], 'save user');
  return true;
}

/** Postgres unique violations → the messages people see. */
function duplicateMessage(err) {
  if (err?.code !== '23505') return null;
  if (err.constraint === 'users_email_ci') return 'Email already registered';
  return 'Username already registered';
}

export async function createUser(userData) {
  const { userName, password, email } = userData || {};
  const userNameValidation = validateUserName(userName);
  if (!userNameValidation.valid) throw new UserError(userNameValidation.message);
  if (!email || typeof email !== 'string') throw new UserError('Email is required');
  if (!password || typeof password !== 'string') throw new UserError('Password is required');
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) throw new UserError(emailValidation.message);
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) throw new UserError(passwordValidation.message);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  let row;
  try {
    // Admin is granted only by editing the row, never by choice of name.
    ({ rows: [row] } = await query(
      `insert into users (user_name, email, password_hash, is_admin, created_at, last_login)
       values ($1, $2, $3, false, now(), now())
       returning ${COLUMNS}`,
      [userName.trim(), email.trim().toLowerCase(), passwordHash],
    ));
  } catch (err) {
    // The unique indexes decide, so two sign-ups racing for a name can't both win.
    const message = duplicateMessage(err);
    if (message) throw new UserError(message);
    console.error('Error creating user:', err.message);
    throw new UsersQueryError('Failed to save user', err);
  }
  const { passwordHash: _, ...safeUser } = toUser(row);
  return safeUser;
}

export async function verifyUser(userName, password) {
  if (!userName || !password) throw new UserError('Username and password are required');
  if (typeof userName !== 'string' || typeof password !== 'string') {
    throw new UserError('Invalid username or password');
  }
  const user = await getUser(userName);
  if (!user || !user.passwordHash) throw new UserError('Invalid username or password');
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) throw new UserError('Invalid username or password');
  user.lastLogin = new Date().toISOString();
  // Recording the login time is best-effort: the password already checked out.
  try {
    await query('update users set last_login = $2 where user_name = $1', [user.userName, user.lastLogin]);
  } catch (err) {
    console.error('Error saving last login:', err.message);
  }
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

export async function requestPasswordReset(email) {
  const user = await getUserByEmail(email);
  if (!user) throw new UserError('No account found with that email address');
  const token = crypto.randomBytes(32).toString('hex');
  try {
    await withTransaction(async (client) => {
      // One live link per account: asking again replaces the last one.
      await client.query('delete from password_resets where user_name = $1', [user.userName]);
      await client.query(
        'insert into password_resets (token_hash, user_name, expires_at) values ($1, $2, $3)',
        [hashToken(token), user.userName, new Date(Date.now() + RESET_TTL_MS).toISOString()],
      );
    });
  } catch (err) {
    console.error('Error storing reset token:', err.message);
    throw new UsersQueryError('Failed to save user', err);
  }
  return { userName: user.userName, email: user.email, token };
}

export async function resetPassword(token, newPassword) {
  if (!token || typeof token !== 'string') throw new UserError('Reset token is required');
  const { rows } = await run(
    'select user_name, expires_at, used_at from password_resets where token_hash = $1',
    [hashToken(token)],
    'read reset token',
  );
  const reset = rows[0];
  if (!reset || reset.used_at) throw new UserError('Invalid or expired reset link');
  if (new Date(reset.expires_at) < new Date()) throw new UserError('Reset link has expired');
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) throw new UserError(passwordValidation.message);
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  let userName;
  try {
    userName = await withTransaction(async (client) => {
      // Claiming the token and changing the password happen together, once.
      const claimed = await client.query(
        `update password_resets set used_at = now()
         where token_hash = $1 and used_at is null and expires_at > now()
         returning user_name`,
        [hashToken(token)],
      );
      if (claimed.rowCount === 0) return null;
      const name = claimed.rows[0].user_name;
      await client.query('update users set password_hash = $2 where user_name = $1', [name, passwordHash]);
      await client.query('delete from password_resets where user_name = $1 and used_at is null', [name]);
      return name;
    });
  } catch (err) {
    console.error('Error resetting password:', err.message);
    throw new UsersQueryError('Failed to save user', err);
  }
  if (!userName) throw new UserError('Invalid or expired reset link');
  return { userName };
}
