import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { FRUIT_LIST } from '../../client/utils/fruitList.js';
import { FAMILIES, familyOf, familyLabel, markSvg, _members } from '../../client/utils/fruitFamilies.js';

describe('fruit families', () => {
  test('every item on the add-a-find list belongs to a real family (no fallbacks)', () => {
    const unsorted = FRUIT_LIST.filter((f) => familyOf(f) === 'seed');
    assert.deepEqual(unsorted, []);
  });

  test('no fruit is listed in two families', () => {
    const seen = new Map();
    for (const [family, names] of Object.entries(_members)) {
      for (const n of names) {
        assert.ok(!seen.has(n), `${n} is in both ${seen.get(n)} and ${family}`);
        seen.set(n, family);
      }
    }
  });

  test('every family member is on the fruit list (no typos)', () => {
    const list = new Set(FRUIT_LIST);
    for (const names of Object.values(_members)) {
      for (const n of names) assert.ok(list.has(n), `${n} is not in FRUIT_LIST`);
    }
  });

  test('lookups are case-insensitive and unknowns fall back to seed', () => {
    assert.equal(familyOf('Rosemary'), 'herbs');
    assert.equal(familyOf(' lemon '), 'citrus');
    assert.equal(familyOf('plutonium'), 'seed');
    assert.equal(familyOf(undefined), 'seed');
    assert.equal(familyLabel('berries'), 'berries & vines');
    assert.equal(familyLabel('nope'), 'find');
  });

  test('there are 8 families, each with a mark', () => {
    assert.equal(FAMILIES.length, 8);
    for (const f of FAMILIES) assert.match(markSvg(f.id), /^<svg[^>]*viewBox="0 0 24 24".*<\/svg>$/);
  });
});
