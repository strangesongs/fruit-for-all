// Regression tests for the Oct 2026 hotfixes. Imports only dependency-free modules
// so they run anywhere `node --test` does.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUserName,
  isReservedUserName,
  validateNotes,
  validatePinInput,
  MAX_NOTES_CHARS,
} from '../../server/schemas/validation.js';
import { wrap } from '../../server/utils/wrap.js';
import { createMemoryDedupStore, isDuplicateConfirm, markConfirmed } from '../../server/utils/confirmDedup.js';
import { FRUIT_LIST } from '../../client/utils/fruitList.js';

const FRUIT = new Set(FRUIT_LIST);
const goodPin = { coordinates: { lat: 34.06, lng: -118.29 }, fruitType: 'fig', notes: 'by the bus stop' };

describe('username rules (admin escalation fix)', () => {
  test('every case variant of admin is reserved', () => {
    for (const name of ['admin', 'Admin', 'ADMIN', 'aDmIn', ' admin ']) {
      assert.equal(isReservedUserName(name), true, name);
      assert.equal(validateUserName(name).valid, false, name);
    }
  });

  test('other staff-looking names are reserved', () => {
    for (const name of ['Root', 'support', 'FruitForAll', 'Moderator']) {
      assert.equal(validateUserName(name).valid, false, name);
    }
  });

  test('accepts ordinary names', () => {
    for (const name of ['jcrtll', 'fig_fan', 'Ana.M', 'tree-hugger', 'abc']) {
      assert.equal(validateUserName(name).valid, true, name);
    }
  });

  test('rejects spaces, HTML, too short/long and non-strings', () => {
    for (const name of ['ab', 'a'.repeat(25), 'two words', '<b>hi</b>', 'émile', '', null, 42, {}]) {
      assert.equal(validateUserName(name).valid, false, String(name));
    }
  });
});

describe('validatePinInput (crash fix)', () => {
  test('accepts a normal pin', () => {
    assert.deepEqual(validatePinInput(goodPin, FRUIT), { valid: true });
  });

  test('accepts latitude/longitude of exactly 0', () => {
    const pin = { ...goodPin, coordinates: { lat: 0, lng: 0 } };
    assert.equal(validatePinInput(pin, FRUIT).valid, true);
  });

  test('rejects (never throws on) wrong types that used to crash the server', () => {
    const bad = [
      { ...goodPin, fruitType: 1 },
      { ...goodPin, fruitType: ['fig'] },
      { ...goodPin, fruitType: { toString: 'x' } },
      { ...goodPin, notes: {} },
      { ...goodPin, notes: ['a', 'b'] },
      { ...goodPin, notes: 12 },
      { ...goodPin, coordinates: 'here' },
      { ...goodPin, coordinates: { lat: '34', lng: '-118' } },
      { ...goodPin, coordinates: { lat: 91, lng: 0 } },
      { ...goodPin, coordinates: { lat: 0, lng: 181 } },
      { ...goodPin, coordinates: null },
      null,
      'string body',
    ];
    for (const body of bad) {
      let result;
      assert.doesNotThrow(() => { result = validatePinInput(body, FRUIT); }, JSON.stringify(body));
      assert.equal(result.valid, false, JSON.stringify(body));
    }
  });

  test('rejects fruit not on the list', () => {
    assert.equal(validatePinInput({ ...goodPin, fruitType: 'plutonium' }, FRUIT).valid, false);
  });
});

describe('validateNotes (update length fix)', () => {
  test('notes are optional', () => {
    for (const n of [undefined, null, '']) assert.equal(validateNotes(n).valid, true);
  });

  test('caps length at MAX_NOTES_CHARS', () => {
    assert.equal(validateNotes('a'.repeat(MAX_NOTES_CHARS)).valid, true);
    assert.equal(validateNotes('a'.repeat(MAX_NOTES_CHARS + 1)).valid, false);
  });

  test('rejects non-strings', () => {
    for (const n of [{}, [], 5, true]) assert.equal(validateNotes(n).valid, false);
  });
});

describe('wrap (async errors reach the error handler)', () => {
  test('forwards a rejected promise to next', async () => {
    let received;
    const handler = wrap(async () => { throw new Error('boom'); });
    await handler({}, {}, (err) => { received = err; });
    assert.equal(received?.message, 'boom');
  });

  test('forwards a synchronous throw to next', async () => {
    let received;
    const handler = wrap(() => { throw new TypeError('sync'); });
    await handler({}, {}, (err) => { received = err; });
    assert.equal(received?.message, 'sync');
  });

  test('does not call next when the handler succeeds', async () => {
    let called = false;
    const handler = wrap(async (_req, res) => { res.ok = true; });
    const res = {};
    await handler({}, res, () => { called = true; });
    assert.equal(called, false);
    assert.equal(res.ok, true);
  });
});

describe('createMemoryDedupStore (dedup without Redis)', () => {
  test('dedups a confirmation from the same IP', async () => {
    const store = createMemoryDedupStore();
    assert.equal(await isDuplicateConfirm(store, 'pin-1', '1.2.3.4'), false);
    await markConfirmed(store, 'pin-1', '1.2.3.4');
    assert.equal(await isDuplicateConfirm(store, 'pin-1', '1.2.3.4'), true);
    assert.equal(await isDuplicateConfirm(store, 'pin-1', '5.6.7.8'), false);
    assert.equal(await isDuplicateConfirm(store, 'pin-2', '1.2.3.4'), false);
  });

  test('entries expire after the TTL', async () => {
    let t = 1_000_000;
    const store = createMemoryDedupStore({ now: () => t });
    await markConfirmed(store, 'pin-1', '1.2.3.4');
    t += 86_400_000 - 1;
    assert.equal(await isDuplicateConfirm(store, 'pin-1', '1.2.3.4'), true);
    t += 2;
    assert.equal(await isDuplicateConfirm(store, 'pin-1', '1.2.3.4'), false);
  });

  test('never grows past maxEntries', async () => {
    const store = createMemoryDedupStore({ maxEntries: 100 });
    for (let i = 0; i < 1000; i += 1) await markConfirmed(store, `pin-${i}`, '1.1.1.1');
    assert.ok(store.size <= 100, `size ${store.size}`);
  });
});
