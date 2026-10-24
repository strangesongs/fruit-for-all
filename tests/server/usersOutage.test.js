import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { dynamoClient } from '../../server/db/dynamo.js';
import {
  getUser,
  getUserByEmail,
  saveUser,
  verifyUser,
  createUser,
  requestPasswordReset,
} from '../../server/schemas/users.js';
import { UserError, UsersQueryError, publicMessage } from '../../server/schemas/errors.js';

// Stub the shared DynamoDB client: `answer(command)` returns a result or throws.
// No request ever leaves the process.
const realSend = dynamoClient.send;
const realError = console.error;
let answer;
const outage = () => {
  throw new Error('connect ECONNREFUSED 127.0.0.1:9');
};

beforeEach(() => {
  answer = outage;
  dynamoClient.send = async (command) => answer(command);
  console.error = () => {}; // the schema layer logs each failure; expected here
});
afterEach(() => {
  dynamoClient.send = realSend;
  console.error = realError;
});

const name = (command) => command.constructor.name;

describe('users table outage', () => {
  test('getUser, getUserByEmail and saveUser throw UsersQueryError', async () => {
    await assert.rejects(getUser('someone'), UsersQueryError);
    await assert.rejects(getUserByEmail('a@example.com'), UsersQueryError);
    await assert.rejects(saveUser({ userName: 'someone' }), UsersQueryError);
  });

  test('a missing user is still null, not an error', async () => {
    answer = () => ({});
    assert.equal(await getUser('nobody'), null);
    answer = () => ({ Items: [] });
    assert.equal(await getUserByEmail('nobody@example.com'), null);
  });

  test('login during an outage is not reported as a wrong password', async () => {
    const err = await verifyUser('someone', 'Longenough1!').catch((e) => e);
    assert.ok(err instanceof UsersQueryError);
    assert.ok(!(err instanceof UserError));
    assert.equal(publicMessage(err, 'Could not sign you in.'), 'Could not sign you in.');
  });

  test('login still succeeds when only the last-login save fails', async () => {
    const passwordHash = await bcrypt.hash('Longenough1!', 4);
    answer = (command) => {
      if (name(command) === 'GetItemCommand') {
        return { Item: { userName: { S: 'someone' }, passwordHash: { S: passwordHash } } };
      }
      return outage();
    };
    const user = await verifyUser('someone', 'Longenough1!');
    assert.equal(user.userName, 'someone');
    assert.equal(user.passwordHash, undefined);
  });

  test('registration stops if the duplicate-email check cannot run', async () => {
    answer = (command) => (name(command) === 'GetItemCommand' ? {} : outage());
    await assert.rejects(
      createUser({ userName: 'newperson', email: 'new@example.com', password: 'Longenough1!' }),
      UsersQueryError,
    );
  });

  test('a reset token that cannot be saved is an error, not a sent link', async () => {
    answer = (command) =>
      name(command) === 'ScanCommand'
        ? { Items: [{ userName: { S: 'someone' }, email: { S: 'a@example.com' } }] }
        : outage();
    await assert.rejects(requestPasswordReset('a@example.com'), UsersQueryError);
  });
});
