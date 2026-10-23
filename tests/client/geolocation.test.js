import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAppleMobile, locateErrorMessage, parseLastLocation, LOCATE_OPTIONS } from '../../client/utils/geolocation.js';

test('isAppleMobile detects iPhone and iPadOS, not Android or desktop Mac', () => {
    assert.equal(isAppleMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5), true);
    assert.equal(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5), true);
    assert.equal(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0), false);
    assert.equal(isAppleMobile('Mozilla/5.0 (Linux; Android 14)', 5), false);
});

test('locateErrorMessage gives iPhone settings path when permission is denied', () => {
    assert.match(locateErrorMessage(1, { apple: true }), /safari websites/);
    assert.doesNotMatch(locateErrorMessage(1, { apple: false }), /iphone/);
});

test('locateErrorMessage mentions the fallback only when there is one', () => {
    assert.match(locateErrorMessage(2, { hasFallback: true }), /last known area/);
    assert.doesNotMatch(locateErrorMessage(3, { hasFallback: false }), /last known area/);
});

test('messages are lowercase', () => {
    for (const code of [1, 2, 3]) {
        for (const apple of [true, false]) {
            const m = locateErrorMessage(code, { apple, hasFallback: true });
            assert.equal(m, m.toLowerCase());
        }
    }
});

test('parseLastLocation accepts valid coords and rejects junk', () => {
    assert.deepEqual(parseLastLocation('{"lat":34.05,"lng":-118.24}'), { lat: 34.05, lng: -118.24 });
    assert.equal(parseLastLocation(null), null);
    assert.equal(parseLastLocation('not json'), null);
    assert.equal(parseLastLocation('{"lat":"x","lng":1}'), null);
});

test('locate options do not reuse an old fix for long', () => {
    assert.ok(LOCATE_OPTIONS.maximumAge <= 60 * 1000);
});
