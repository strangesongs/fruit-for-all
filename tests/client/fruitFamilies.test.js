import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { FRUIT_LIST } from '../../client/utils/fruitList.js';
import { FRUIT_SEASONS } from '../../client/utils/fruitSeasons.js';
import { FAMILIES, familyOf, familyLabel, markSvg, blockInk, _members, _blocks } from '../../client/utils/fruitFamilies.js';

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

  test('medicinal plants have their own family', () => {
    assert.equal(familyOf("St. John's Wort"), 'medicinal');
    assert.equal(familyOf('yarrow'), 'medicinal');
    assert.equal(familyLabel('medicinal'), 'medicinal');
  });

  test('there are 9 families, each with a mark', () => {
    assert.equal(FAMILIES.length, 9);
    for (const f of FAMILIES) assert.match(markSvg(f.id), /^<svg[^>]*viewBox="0 0 24 24".*<\/svg>$/);
  });

  test('every family (and the seed fallback) has a colour block in one of the four block inks', () => {
    const inks = new Set(['--persimmon', '--citron', '--fig', '--sage']);
    for (const id of [...FAMILIES.map((f) => f.id), 'seed']) {
      assert.ok(_blocks[id], `${id} has no colour block`);
      assert.ok(inks.has(blockInk(id)), `${id} uses ${blockInk(id)}`);
    }
    assert.equal(blockInk('plutonium'), '--citron');
  });

  test('block marks print the colour under the linework; plain marks have none', () => {
    const plain = markSvg('tree');
    const block = markSvg('tree', { block: true });
    assert.ok(!plain.includes('var(--persimmon)'));
    assert.ok(block.includes('style="fill:var(--persimmon)"'));
    assert.ok(block.indexOf('var(--persimmon)') < block.indexOf('<circle cx="12" cy="14.5" r="6.5"/>'),
      'colour block comes before (under) the ink');
    assert.match(block, /^<svg[^>]*viewBox="0 0 24 24".*<\/svg>$/);
  });

  test('white sage is not listed (over-harvested, culturally sensitive)', () => {
    assert.ok(!FRUIT_LIST.includes('white sage'));
  });

  test('every medicinal plant has harvest-season data', () => {
    for (const n of _members.medicinal) assert.ok(FRUIT_SEASONS[n], `${n} has no season data`);
  });
});
