import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  NUDGE_LIMIT_M, distanceMeters, clampToRange, withinNudge, compassWord, formatFeet,
  describeOffset, nearbySameKind, saveErrorMessage,
} from '../../client/utils/findPlacement.js';

const here = { lat: 34.0614, lng: -118.2940 };
// ~0.0009° of latitude ≈ 100 m
const north = (m) => ({ lat: here.lat + m / 111195, lng: here.lng });
const east = (m) => ({ lat: here.lat, lng: here.lng + m / (111195 * Math.cos((here.lat * Math.PI) / 180)) });

describe('distanceMeters', () => {
  test('measures short hops in metres', () => {
    assert.ok(Math.abs(distanceMeters(here, north(100)) - 100) < 0.5);
    assert.ok(Math.abs(distanceMeters(here, east(40)) - 40) < 0.5);
    assert.equal(distanceMeters(here, here), 0);
  });
  test('null for missing or broken points', () => {
    assert.equal(distanceMeters(null, here), null);
    assert.equal(distanceMeters(here, { lat: 'x', lng: 1 }), null);
  });
});

describe('clampToRange', () => {
  test('leaves a spot inside the range alone', () => {
    const p = north(60);
    assert.deepEqual(clampToRange(here, p, NUDGE_LIMIT_M), { ...p, clamped: false });
  });
  test('pulls a spot outside the range back onto its edge, same direction', () => {
    const c = clampToRange(here, east(250), NUDGE_LIMIT_M);
    assert.equal(c.clamped, true);
    assert.ok(Math.abs(distanceMeters(here, c) - NUDGE_LIMIT_M) < 1);
    assert.equal(compassWord(here, c), 'east');
  });
  test('no limit (admin) never clamps', () => {
    const far = north(5000);
    assert.equal(clampToRange(here, far, null).clamped, false);
  });
});

describe('withinNudge', () => {
  test('allows the limit plus a little slack, not more', () => {
    assert.equal(withinNudge(here, north(100)), true);
    assert.equal(withinNudge(here, north(108)), true);
    assert.equal(withinNudge(here, north(130)), false);
    assert.equal(withinNudge(here, { lat: NaN, lng: 0 }), false);
  });
});

describe('words for the spot', () => {
  test('compass directions', () => {
    assert.equal(compassWord(here, north(50)), 'north');
    assert.equal(compassWord(here, east(50)), 'east');
    assert.equal(compassWord(north(50), here), 'south');
  });
  test('feet, rounded to 5, then miles', () => {
    assert.equal(formatFeet(12.2), '40 ft');
    assert.equal(formatFeet(0.4), '5 ft');
    assert.equal(formatFeet(100), '330 ft');
    assert.equal(formatFeet(800), '0.5 mi');
    assert.equal(formatFeet(undefined), '');
  });
  test('describeOffset', () => {
    assert.equal(describeOffset(here, north(1)), 'right where you are');
    assert.equal(describeOffset(here, north(12.2)), '40 ft north of you');
    assert.equal(describeOffset(here, east(30), { from: 'pin' }), '100 ft east of where it was');
    assert.equal(describeOffset(here, here, { from: 'pin' }), 'as before');
  });
});

describe('nearbySameKind', () => {
  const pins = [
    { pinId: 'a', fruitType: 'fig', coordinates: north(8) },
    { pinId: 'b', fruitType: 'Fig', coordinates: north(3) },
    { pinId: 'c', fruitType: 'lemon', coordinates: north(2) },
    { pinId: 'd', fruitType: 'fig', coordinates: north(40) },
    { pinId: 'e', fruitType: 'fig', coordinates: null },
  ];
  test('same kind within 15 m, nearest first, case-insensitive', () => {
    assert.deepEqual(nearbySameKind(pins, here, 'fig').map((p) => p.pinId), ['b', 'a']);
  });
  test('skips the find being edited', () => {
    assert.deepEqual(nearbySameKind(pins, here, 'fig', { excludeId: 'b' }).map((p) => p.pinId), ['a']);
  });
  test('nothing for no kind or bad input', () => {
    assert.deepEqual(nearbySameKind(pins, here, ''), []);
    assert.deepEqual(nearbySameKind(null, here, 'fig'), []);
  });
});

describe('saveErrorMessage', () => {
  test('lowercase, in-app messages for each failure', () => {
    assert.match(saveErrorMessage(0), /connection/);
    assert.match(saveErrorMessage(401), /sign in/);
    assert.match(saveErrorMessage(400, 'Please keep notes family-friendly.'), /family-friendly/);
    assert.match(saveErrorMessage(400, 'A find can only move about 100 m. Delete it…'), /330 ft/);
    assert.match(saveErrorMessage(400, 'Invalid fruit type. Please select from the approved list.'), /from the list/);
    assert.match(saveErrorMessage(500, 'Internal server error'), /something went wrong/);
    for (const s of [0, 400, 401, 403, 404, 429, 500, 503]) {
      const m = saveErrorMessage(s);
      assert.equal(m, m.toLowerCase());
    }
  });
});
