import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { FRUIT_LIST } from '../../client/utils/fruitList.js';

describe('FRUIT_LIST', () => {
  test('is a non-empty array', () => {
    assert.ok(Array.isArray(FRUIT_LIST));
    assert.ok(FRUIT_LIST.length > 0);
  });

  test('contains expected common fruits', () => {
    const required = ['apple', 'lemon', 'fig', 'loquat', 'mango', 'avocado', 'orange'];
    for (const fruit of required) {
      assert.ok(FRUIT_LIST.includes(fruit), `missing expected fruit: ${fruit}`);
    }
  });

  test('all entries are lowercase strings', () => {
    for (const fruit of FRUIT_LIST) {
      assert.equal(typeof fruit, 'string', `entry is not a string: ${fruit}`);
      assert.equal(fruit, fruit.toLowerCase(), `entry is not lowercase: ${fruit}`);
    }
  });

  test('has no duplicate entries', () => {
    const seen = new Set();
    for (const fruit of FRUIT_LIST) {
      assert.ok(!seen.has(fruit), `duplicate entry: ${fruit}`);
      seen.add(fruit);
    }
  });

  test('has no empty strings', () => {
    for (const fruit of FRUIT_LIST) {
      assert.ok(fruit.trim().length > 0, 'found empty or whitespace-only entry');
    }
  });
});
