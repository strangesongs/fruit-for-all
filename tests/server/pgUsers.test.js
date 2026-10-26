// Users on Postgres (server/schemas/pg/users.js), against a real database.
// Skipped without TEST_DATABASE_URL (see pgTestDb.js). The shape checks at the
// bottom run everywhere.
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as pgUsers from '../../server/schemas/pg/users.js';
import * as dynamoUsers from '../../server/schemas/users.js';
import { UserError, UsersQueryError } from '../../server/schemas/errors.js';
import { parseStore } from '../../server/db/store.js';
import { openTestSchema, skipReason } from './pgTestDb.js';

const PW = 'Longenough1!';
const quiet = async (fn) => {
  const realError = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = realError;
  }
};

describe('users on postgres', { skip: skipReason }, () => {
  let t;
  before(async () => {
    t = await openTestSchema('users');
  });
  after(async () => {
    await t?.close();
  });
  beforeEach(async () => {
    await t.reset();
  });

  test('createUser stores the typed case, a lower-case email and a bcrypt hash', async () => {
    const u = await pgUsers.createUser({ userName: ' Alice ', email: 'Alice@Example.com', password: PW });
    assert.equal(u.userName, 'Alice');
    assert.equal(u.email, 'alice@example.com');
    assert.equal(u.isAdmin, false);
    assert.equal('passwordHash' in u, false);
    const { rows } = await t.db.query('select user_name, email, password_hash, is_admin from users');
    assert.equal(rows.length, 1);
    assert.match(rows[0].password_hash, /^\$2[aby]\$12\$/);
  });

  test('names are unique ignoring case; emails too', async () => {
    await pgUsers.createUser({ userName: 'alice', email: 'alice@example.com', password: PW });
    await assert.rejects(
      pgUsers.createUser({ userName: 'ALICE', email: 'other@example.com', password: PW }),
      (e) => e instanceof UserError && e.message === 'Username already registered',
    );
    await assert.rejects(
      pgUsers.createUser({ userName: 'bob', email: 'ALICE@example.com', password: PW }),
      (e) => e instanceof UserError && e.message === 'Email already registered',
    );
  });

  test('two sign-ups racing for one name: exactly one wins', async () => {
    const results = await Promise.allSettled([
      pgUsers.createUser({ userName: 'race', email: 'a@example.com', password: PW }),
      pgUsers.createUser({ userName: 'Race', email: 'b@example.com', password: PW }),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(results.find((r) => r.status === 'rejected').reason.message, 'Username already registered');
  });

  test('validation errors are UserErrors, before anything is written', async () => {
    await assert.rejects(pgUsers.createUser({ userName: 'ab', email: 'a@example.com', password: PW }), UserError);
    await assert.rejects(pgUsers.createUser({ userName: 'admin', email: 'a@example.com', password: PW }), UserError);
    await assert.rejects(pgUsers.createUser({ userName: 'okname', email: 'nope', password: PW }), UserError);
    const { rows } = await t.db.query('select count(*)::int as n from users');
    assert.equal(rows[0].n, 0);
  });

  test('getUser and verifyUser ignore case and return the stored case', async () => {
    await pgUsers.createUser({ userName: 'Alice', email: 'alice@example.com', password: PW });
    assert.equal((await pgUsers.getUser('alice')).userName, 'Alice');
    const u = await pgUsers.verifyUser('ALICE', PW);
    assert.equal(u.userName, 'Alice');
    assert.equal('passwordHash' in u, false);
    assert.ok(u.lastLogin);
    assert.equal(await pgUsers.getUser('nobody'), null);
  });

  test('a wrong password or unknown name is the same UserError', async () => {
    await pgUsers.createUser({ userName: 'alice', email: 'alice@example.com', password: PW });
    for (const [name, pw] of [['alice', 'Wrongpass1!'], ['nobody', PW]]) {
      await assert.rejects(pgUsers.verifyUser(name, pw), (e) => e instanceof UserError && e.message === 'Invalid username or password');
    }
    await assert.rejects(pgUsers.verifyUser('alice', ''), UserError);
  });

  test('passwords are not trimmed', async () => {
    await pgUsers.createUser({ userName: 'alice', email: 'alice@example.com', password: ` ${PW} ` });
    await assert.rejects(pgUsers.verifyUser('alice', PW), UserError);
    assert.equal((await pgUsers.verifyUser('alice', ` ${PW} `)).userName, 'alice');
  });

  test('getUserByEmail ignores case and spaces', async () => {
    await pgUsers.createUser({ userName: 'alice', email: 'alice@example.com', password: PW });
    assert.equal((await pgUsers.getUserByEmail('  ALICE@example.COM ')).userName, 'alice');
    assert.equal(await pgUsers.getUserByEmail('nobody@example.com'), null);
  });

  test('reset: only the hash is stored, the link works once, and a new request replaces the old', async () => {
    await pgUsers.createUser({ userName: 'Alice', email: 'alice@example.com', password: PW });
    const first = await pgUsers.requestPasswordReset('alice@example.com');
    const second = await pgUsers.requestPasswordReset('ALICE@example.com');
    assert.equal(second.userName, 'Alice');
    const { rows } = await t.db.query('select token_hash from password_resets');
    assert.deepEqual(rows.map((r) => r.token_hash), [pgUsers.hashToken(second.token)]);
    assert.equal(JSON.stringify(rows).includes(second.token), false);

    await assert.rejects(pgUsers.resetPassword(first.token, 'Newpassword1!'), /Invalid or expired/);
    assert.deepEqual(await pgUsers.resetPassword(second.token, 'Newpassword1!'), { userName: 'Alice' });
    assert.equal((await pgUsers.verifyUser('alice', 'Newpassword1!')).userName, 'Alice');
    await assert.rejects(pgUsers.resetPassword(second.token, 'Another1pass!'), /Invalid or expired/);
  });

  test('reset: an expired link, a weak password, no account', async () => {
    await pgUsers.createUser({ userName: 'alice', email: 'alice@example.com', password: PW });
    const { token } = await pgUsers.requestPasswordReset('alice@example.com');
    await assert.rejects(pgUsers.resetPassword(token, 'short'), UserError);
    await t.db.query("update password_resets set expires_at = now() - interval '1 minute'");
    await assert.rejects(pgUsers.resetPassword(token, 'Newpassword1!'), /has expired/);
    await assert.rejects(pgUsers.requestPasswordReset('nobody@example.com'), /No account found/);
    await assert.rejects(pgUsers.resetPassword('', 'Newpassword1!'), /token is required/);
  });

  test('saveUser updates only the given fields, ignoring case', async () => {
    await pgUsers.createUser({ userName: 'Alice', email: 'alice@example.com', password: PW });
    await pgUsers.saveUser({ userName: 'alice', isAdmin: true });
    const u = await pgUsers.getUser('Alice');
    assert.equal(u.isAdmin, true);
    assert.equal(u.email, 'alice@example.com');
    await pgUsers.saveUser({ userName: 'carol', email: 'Carol@example.com' });
    assert.equal((await pgUsers.getUser('carol')).email, 'carol@example.com');
  });

  test('a database failure is UsersQueryError, never "no such user"', async () => {
    await t.db.query('alter table users rename to users_gone');
    try {
      await quiet(async () => {
        await assert.rejects(pgUsers.getUser('alice'), UsersQueryError);
        await assert.rejects(pgUsers.getUserByEmail('a@example.com'), UsersQueryError);
        const err = await pgUsers.verifyUser('alice', PW).catch((e) => e);
        assert.ok(err instanceof UsersQueryError && !(err instanceof UserError));
      });
    } finally {
      await t.db.query('alter table users_gone rename to users');
    }
  });
});

describe('users store contract', () => {
  test('postgres exports every function the dynamo module does', () => {
    const fns = (m) => Object.keys(m).filter((k) => typeof m[k] === 'function').sort();
    for (const name of fns(dynamoUsers)) {
      assert.equal(typeof pgUsers[name], 'function', `pg/users.js is missing ${name}`);
    }
  });
  test('DATA_STORE accepts dynamo and postgres only (default dynamo)', () => {
    assert.equal(parseStore(undefined), 'dynamo');
    assert.equal(parseStore(' Postgres '), 'postgres');
    assert.throws(() => parseStore('mysql'), /DATA_STORE/);
  });
});
