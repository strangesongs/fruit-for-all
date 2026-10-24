import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { appUrl, LIVE_URL } from '../../server/utils/appUrl.js';

describe('appUrl (links in emails)', () => {
  test('APP_URL wins, without a trailing slash', () => {
    assert.equal(appUrl({ APP_URL: 'https://example.test/', NODE_ENV: 'production' }), 'https://example.test');
    assert.equal(appUrl({ APP_URL: '  https://staging.example.test  ' }), 'https://staging.example.test');
  });
  test('production without APP_URL points at the live site, never localhost', () => {
    assert.equal(appUrl({ NODE_ENV: 'production' }), LIVE_URL);
    assert.equal(appUrl({ NODE_ENV: 'production', APP_URL: '' }), LIVE_URL);
  });
  test('development falls back to the local dev server', () => {
    assert.equal(appUrl({}), 'http://localhost:3000');
  });
});
