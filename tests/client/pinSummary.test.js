import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ripenessOf,
  seasonRangeText,
  distanceMiles,
  formatMiles,
  noteSnippet,
  buildViewSummary,
  lookForHints,
} from '../../client/utils/pinSummary.js';

const pin = (fruitType, lat, lng, extra = {}) => ({
  pinId: `${fruitType}-${lat}`, fruitType, coordinates: { lat, lng }, zone: 10, ...extra,
});

describe('ripenessOf', () => {
  test('uses the pin zone', () => {
    assert.equal(ripenessOf(pin('pomegranate', 34, -118), 10), 'ripe');
    assert.equal(ripenessOf(pin('pomegranate', 34, -118), 4), 'quiet');
  });
  test('fruit without season data is unknown, not quiet', () => {
    assert.equal(ripenessOf(pin('plutonium', 34, -118), 10), 'unknown');
  });
});

describe('seasonRangeText', () => {
  test('simple and wraparound ranges', () => {
    assert.equal(seasonRangeText([9, 10, 11]), 'sep – nov');
    assert.equal(seasonRangeText([11, 12, 1, 2]), 'nov – feb');
    assert.equal(seasonRangeText([6]), 'jun');
    assert.equal(seasonRangeText([1, 2, 3, 4, 5, 6, 7, 8]), 'most of the year');
    assert.equal(seasonRangeText([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 'all year');
    assert.equal(seasonRangeText([]), '');
  });
});

describe('distance helpers', () => {
  test('distanceMiles is roughly right', () => {
    const d = distanceMiles({ lat: 34.0, lng: -118.0 }, { lat: 34.01, lng: -118.0 });
    assert.ok(d > 0.68 && d < 0.7, String(d));
  });
  test('formatMiles', () => {
    assert.equal(formatMiles(0.05), 'right here');
    assert.equal(formatMiles(0.43), '0.4 mi');
    assert.equal(formatMiles(12.6), '13 mi');
    assert.equal(formatMiles(null), '');
  });
  test('noteSnippet trims long notes at a word', () => {
    assert.equal(noteSnippet('short note'), 'short note');
    const s = noteSnippet('three trees on the parkway with branches hanging over the sidewalk, splitting now', 40);
    assert.ok(s.endsWith('…') && s.length <= 41, s);
  });
});

describe('buildViewSummary', () => {
  const center = { lat: 34.06, lng: -118.29 };
  const pins = [
    pin('pomegranate', 34.061, -118.29, { notes: 'splitting now', submittedBy: 'mr' }),
    pin('pomegranate', 34.07, -118.29),
    pin('guava', 34.065, -118.29),
    pin('loquat', 34.062, -118.29),
    pin('rosemary', 34.063, -118.29),
  ];
  const s = buildViewSummary(pins, center, 10);

  test('counts and zone', () => {
    assert.equal(s.pinCount, 5);
    assert.equal(s.zone, 10);
    assert.equal(s.ripeCount, 3); // 2 pomegranate + guava; loquat quiet; rosemary unknown
  });
  test('ripe groups are per fruit, nearest first, with notes', () => {
    assert.deepEqual(s.ripe.map((g) => g.fruitType), ['pomegranate', 'guava']);
    assert.equal(s.ripe[0].count, 2);
    assert.equal(s.ripe[0].note, 'splitting now');
    assert.equal(s.nearest.fruitType, 'pomegranate');
  });
  test('almanac lists ripe kinds first and only kinds with data', () => {
    assert.equal(s.almanac[0].fruitType, 'pomegranate');
    assert.ok(!s.almanac.some((r) => r.fruitType === 'rosemary'));
  });
  test('empty view', () => {
    const e = buildViewSummary([], center, 10);
    assert.equal(e.pinCount, 0);
    assert.equal(e.nearest, null);
  });
});

describe('lookForHints', () => {
  test('suggests in-season street fruit for a zone', () => {
    const hints = lookForHints(10, 10);
    assert.ok(hints.length > 0 && hints.length <= 2);
  });
});
