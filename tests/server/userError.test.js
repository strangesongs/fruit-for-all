import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { UserError, publicMessage } from '../../server/schemas/errors.js';

describe('publicMessage', () => {
  test('passes a UserError message through', () => {
    const e = new UserError('Invalid or expired reset link');
    assert.ok(e instanceof Error);
    assert.equal(e.name, 'UserError');
    assert.equal(publicMessage(e, 'generic'), 'Invalid or expired reset link');
  });

  test('hides internal errors behind the fallback', () => {
    const e = new Error('connect ECONNREFUSED 127.0.0.1:9');
    assert.equal(publicMessage(e, 'Could not reset your password.'), 'Could not reset your password.');
  });

  test('handles non-Error values', () => {
    assert.equal(publicMessage(undefined, 'generic'), 'generic');
    assert.equal(publicMessage('boom', 'generic'), 'generic');
  });
});
