import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TINY_MAX, MOBILE_MAX, TINY_SCREEN_QUERY, MOBILE_QUERY, getBottomChromePx } from '../../client/utils/breakpoints.js';

describe('breakpoints', () => {
  test('match the CSS breakpoints (360 / 768)', () => {
    assert.equal(TINY_MAX, 360);
    assert.equal(MOBILE_MAX, 768);
    assert.equal(TINY_SCREEN_QUERY, '(max-width: 360px)');
    assert.equal(MOBILE_QUERY, '(max-width: 768px)');
  });

  test('getBottomChromePx is 0 outside the browser', () => {
    assert.equal(getBottomChromePx(), 0);
  });
});
