import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShelf,
  shelfReachText,
  shelfHeadText,
  readShelfFlag,
  SHELF_FLAG_KEY,
} from '../../client/utils/seasonShelf.js';

// One degree of latitude ≈ 69.09 miles, so 0.01° ≈ 0.69 mi.
const HOME = { lat: 34.0, lng: -118.3 };
const OCT = 10;
const at = (mi) => HOME.lat + mi / 69.09;
let n = 0;
const pin = (fruitType, mi, extra = {}) => ({
  pinId: `p${n++}`, fruitType, coordinates: { lat: at(mi), lng: HOME.lng }, zone: 10, ...extra,
});

describe('buildShelf', () => {
  test('no anchor → nowhere', () => {
    assert.equal(buildShelf([pin('lemon', 0.2)], null, OCT).tier, 'nowhere');
  });

  test('nothing in season → none', () => {
    // loquat is spring in zone 10
    assert.equal(buildShelf([pin('loquat', 0.2)], HOME, OCT).tier, 'none');
  });

  test('one entry per kind, nearest first, in season only', () => {
    const s = buildShelf([
      pin('persimmon', 0.9), pin('lemon', 0.4), pin('lemon', 0.6), pin('lemon', 0.5),
      pin('loquat', 0.1), pin('kumquat', 0.7),
    ], HOME, OCT);
    assert.deepEqual(s.entries.map((e) => e.fruitType), ['lemon', 'kumquat', 'persimmon']);
    assert.equal(s.entries[0].count, 3);
    assert.ok(Math.abs(s.entries[0].distanceMi - 0.4) < 0.01);
    assert.equal(s.tier, 'walk');
    assert.equal(s.walkCount, 3);
  });

  test('five kinds within a walk: stops at five and stays a walk', () => {
    const kinds = ['lemon', 'persimmon', 'kumquat', 'pomegranate', 'feijoa', 'guava'];
    const s = buildShelf([...kinds.map((k, i) => pin(k, 0.1 * (i + 1))), pin('fig', 2)], HOME, OCT);
    assert.equal(s.entries.length, 5);
    assert.equal(s.tier, 'walk');
    assert.ok(!s.entries.some((e) => e.fruitType === 'fig'));
  });

  test('fewer than five on foot → widens to a bike ride and says so', () => {
    const s = buildShelf([pin('lemon', 0.3), pin('persimmon', 0.8), pin('kumquat', 2.1), pin('feijoa', 2.9), pin('guava', 3.5)], HOME, OCT);
    assert.equal(s.tier, 'bike');
    assert.deepEqual(s.entries.map((e) => e.fruitType), ['lemon', 'persimmon', 'kumquat', 'feijoa']);
    assert.deepEqual(s.entries.map((e) => e.walk), [true, true, false, false]);
    assert.equal(shelfReachText(s), '2 within a walk · 2 more by bike');
  });

  test('nothing within 3 mi → nearest anywhere, with total counts', () => {
    const s = buildShelf([pin('lemon', 12), pin('lemon', 14), pin('persimmon', 30)], HOME, OCT);
    assert.equal(s.tier, 'anywhere');
    assert.deepEqual(s.entries.map((e) => e.fruitType), ['lemon', 'persimmon']);
    assert.equal(s.entries[0].count, 2);
    assert.match(shelfReachText(s), /nothing in season within 3 miles/);
  });

  test('counts only finds within reach when the shelf is near', () => {
    const s = buildShelf([pin('lemon', 0.2), pin('lemon', 0.4), pin('lemon', 20)], HOME, OCT);
    assert.equal(s.entries[0].count, 2);
  });

  test('note comes from the nearest find; test pins and clusters are skipped', () => {
    const s = buildShelf([
      pin('lemon', 0.9, { notes: 'far one' }),
      pin('lemon', 0.2, { notes: 'hangs over the street', submittedBy: 'jo' }),
      pin('test lemon', 0.1),
      { cluster: true, fruitType: 'lemon', coordinates: { lat: HOME.lat, lng: HOME.lng } },
    ], HOME, OCT);
    assert.equal(s.entries.length, 1);
    assert.equal(s.entries[0].note, 'hangs over the street');
    assert.equal(s.entries[0].noteBy, 'jo');
  });
});

describe('shelf text', () => {
  test('reach line', () => {
    assert.equal(shelfReachText({ tier: 'walk', walkCount: 3, entries: [1, 2, 3] }), 'all 3 within a walk');
    assert.equal(shelfReachText({ tier: 'bike', walkCount: 0, entries: [1, 2] }), 'none within a walk · 2 by bike');
    assert.equal(shelfReachText({ tier: 'none', walkCount: 0, entries: [] }), '');
  });

  test('head line follows the anchor', () => {
    assert.equal(shelfHeadText({ kind: 'precise' }, 'october'), 'in season near you · october');
    assert.equal(shelfHeadText({ kind: 'approx', city: 'Los Angeles' }, 'october'), 'near los angeles (approx.)');
    assert.equal(shelfHeadText({ kind: 'approx', city: null }, 'october'), 'near you (approx.)');
    assert.equal(shelfHeadText({ kind: 'area' }, 'october'), 'in season near here · october');
    assert.equal(shelfHeadText({ kind: 'none' }, 'october'), 'in season this october');
  });
});

describe('readShelfFlag', () => {
  const mem = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  };
  test('?landing=shelf turns it on and remembers; ?landing=bar turns it off', () => {
    const s = mem();
    assert.equal(readShelfFlag('', s), false);
    assert.equal(readShelfFlag('?landing=shelf', s), true);
    assert.equal(s.getItem(SHELF_FLAG_KEY), 'shelf');
    assert.equal(readShelfFlag('', s), true);
    assert.equal(readShelfFlag('?landing=bar', s), false);
    assert.equal(readShelfFlag('', s), false);
  });
  test('works without storage', () => {
    assert.equal(readShelfFlag('?landing=shelf', null), true);
    assert.equal(readShelfFlag('', null), false);
    const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() {} };
    assert.equal(readShelfFlag('?landing=shelf', throwing), true);
    assert.equal(readShelfFlag('', throwing), false);
  });
});
