import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectZoneFallback,
  escapeHtml,
  sanitizeString,
  validateCoordinates,
  validatePassword,
  validateEmail,
} from '../../server/schemas/schemas.js';

// ── detectZoneFallback ─────────────────────────────────────────────────────────

describe('detectZoneFallback', () => {
  test('returns zone 10 for coastal Southern California', () => {
    // San Diego (lat 32.7, lng -117.1) — lat < 33 && lng < -117 → Zone 10
    assert.equal(detectZoneFallback(32.7, -117.1), 10);
  });

  test('returns zone 9 for Bay Area', () => {
    // San Francisco (lat ~37.7, lng ~-122.4)
    assert.equal(detectZoneFallback(37.7, -122.4), 9);
  });

  test('returns zone 8 for Pacific Northwest', () => {
    // Portland, OR (lat ~45.5, lng ~-122.7)
    assert.equal(detectZoneFallback(45.5, -122.7), 8);
  });

  test('returns a numeric zone', () => {
    const zone = detectZoneFallback(40.7, -74.0); // New York City
    assert.equal(typeof zone, 'number');
    assert.ok(zone >= 3 && zone <= 11);
  });

  test('handles tropical latitude', () => {
    const zone = detectZoneFallback(20, -156); // Hawaii-ish
    assert.ok(zone >= 10);
  });

  test('handles northern Canada latitude', () => {
    // lat 55 is outside continental US (> 49) — heuristic returns zone 6
    const zone = detectZoneFallback(55, -100);
    assert.ok(zone >= 3 && zone <= 7, `unexpected zone ${zone} for northern Canada`);
  });
});

// ── escapeHtml ─────────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  test('escapes angle brackets', () => {
    assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('escapes ampersands', () => {
    assert.equal(escapeHtml('fig & loquat'), 'fig &amp; loquat');
  });

  test('escapes double quotes', () => {
    assert.equal(escapeHtml('"quoted"'), '&quot;quoted&quot;');
  });

  test('escapes single quotes', () => {
    assert.equal(escapeHtml("it's a tree"), 'it&#039;s a tree');
  });

  test('returns empty string for non-string input', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
    assert.equal(escapeHtml(42), '');
  });

  test('passes through clean text unchanged', () => {
    assert.equal(escapeHtml('ripe lemon tree'), 'ripe lemon tree');
  });
});

// ── sanitizeString ─────────────────────────────────────────────────────────────

describe('sanitizeString', () => {
  test('trims leading and trailing whitespace', () => {
    assert.equal(sanitizeString('  hello  '), 'hello');
  });

  test('truncates to maxLength', () => {
    assert.equal(sanitizeString('abcdef', 3), 'abc');
  });

  test('returns empty string for non-string input', () => {
    assert.equal(sanitizeString(null), '');
    assert.equal(sanitizeString(42), '');
  });

  test('default maxLength is 1000', () => {
    const long = 'a'.repeat(1200);
    assert.equal(sanitizeString(long).length, 1000);
  });
});

// ── validateCoordinates ────────────────────────────────────────────────────────

describe('validateCoordinates', () => {
  test('accepts valid coordinates', () => {
    assert.equal(validateCoordinates(34.05, -118.25).valid, true);
    assert.equal(validateCoordinates(0, 0).valid, true);
    assert.equal(validateCoordinates(-90, -180).valid, true);
    assert.equal(validateCoordinates(90, 180).valid, true);
  });

  test('rejects latitude out of range', () => {
    assert.equal(validateCoordinates(91, 0).valid, false);
    assert.equal(validateCoordinates(-91, 0).valid, false);
  });

  test('rejects longitude out of range', () => {
    assert.equal(validateCoordinates(0, 181).valid, false);
    assert.equal(validateCoordinates(0, -181).valid, false);
  });

  test('rejects non-number inputs', () => {
    assert.equal(validateCoordinates('34', -118).valid, false);
    assert.equal(validateCoordinates(34, null).valid, false);
  });

  test('rejects NaN', () => {
    assert.equal(validateCoordinates(NaN, 0).valid, false);
  });
});

// ── validatePassword ───────────────────────────────────────────────────────────

describe('validatePassword', () => {
  test('accepts a strong password', () => {
    assert.equal(validatePassword('Str0ng!Pass#').valid, true);
    assert.equal(validatePassword('p4ssw0rd!xyz').valid, true);
  });

  test('rejects passwords shorter than 10 characters', () => {
    assert.equal(validatePassword('Ab1!').valid, false);
  });

  test('rejects passwords without a number', () => {
    assert.equal(validatePassword('NoNumber!!pass').valid, false);
  });

  test('rejects passwords without a symbol', () => {
    assert.equal(validatePassword('NoSymbol1234x').valid, false);
  });

  test('rejects null/empty input', () => {
    assert.equal(validatePassword(null).valid, false);
    assert.equal(validatePassword('').valid, false);
  });
});

// ── validateEmail ──────────────────────────────────────────────────────────────

describe('validateEmail', () => {
  test('accepts valid email addresses', () => {
    assert.equal(validateEmail('user@example.com').valid, true);
    assert.equal(validateEmail('a+tag@sub.domain.org').valid, true);
  });

  test('rejects addresses missing @', () => {
    assert.equal(validateEmail('userexample.com').valid, false);
  });

  test('rejects addresses with no domain part', () => {
    assert.equal(validateEmail('user@').valid, false);
  });

  test('rejects null/empty input', () => {
    assert.equal(validateEmail(null).valid, false);
    assert.equal(validateEmail('').valid, false);
  });
});
