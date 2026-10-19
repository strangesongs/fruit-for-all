import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { logEmailResult } from '../../server/utils/email.js';

describe('logEmailResult', () => {
  test('logs when Resend returns an error object instead of throwing', () => {
    const logged = [];
    const orig = console.error;
    console.error = (...args) => logged.push(args.join(' '));
    try {
      const result = { data: null, error: { message: 'domain not verified' } };
      assert.equal(logEmailResult('Password reset')(result), result);
    } finally {
      console.error = orig;
    }
    assert.equal(logged.length, 1);
    assert.match(logged[0], /Password reset rejected by Resend: domain not verified/);
  });

  test('stays quiet on success', () => {
    const logged = [];
    const orig = console.error;
    console.error = (...args) => logged.push(args);
    try {
      logEmailResult('Welcome')({ data: { id: 'abc' }, error: null });
      logEmailResult('Welcome')(undefined);
    } finally {
      console.error = orig;
    }
    assert.equal(logged.length, 0);
  });
});
