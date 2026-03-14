import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { containsProfanity } from '../../server/utils/profanity.js';

describe('containsProfanity', () => {
  test('returns false for clean text', () => {
    assert.equal(containsProfanity('fresh lemon tree on the corner'), false);
    assert.equal(containsProfanity('beautiful avocado picking season'), false);
  });

  test('returns false for empty/null input', () => {
    assert.equal(containsProfanity(''), false);
    assert.equal(containsProfanity(null), false);
    assert.equal(containsProfanity(undefined), false);
  });

  test('returns true for clear profanity', () => {
    assert.equal(containsProfanity('what the fuck'), true);
    assert.equal(containsProfanity('this is bullshit'), true);
  });

  test('returns true for slurs', () => {
    assert.equal(containsProfanity('go fuck yourself nigger'), true);
    assert.equal(containsProfanity('you faggot'), true);
  });

  test('detects leet-speak substitutions', () => {
    assert.equal(containsProfanity('fvck this tree'), false); // 'v' not substituted
    assert.equal(containsProfanity('sh1t load of fruit'), true); // 1→i
    assert.equal(containsProfanity('fu(k'), false); // ( not substituted
  });

  test('does not flag fruit names as profanity', () => {
    assert.equal(containsProfanity('ripe kumquat on maple'), false);
    assert.equal(containsProfanity('plum and crabapple tree nearby'), false);
  });

  test('returns false for non-string input', () => {
    assert.equal(containsProfanity(42), false);
    assert.equal(containsProfanity({}), false);
  });
});
