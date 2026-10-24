import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { groupedKinds, searchKinds, exactKind } from '../../client/utils/kindSearch.js';
import { FRUIT_LIST, FRUIT_ALIASES } from '../../client/utils/fruitList.js';

describe('groupedKinds', () => {
  test('every kind appears exactly once, under its family, A–Z', () => {
    const groups = groupedKinds();
    const all = groups.flatMap((g) => g.kinds);
    assert.equal(all.length, FRUIT_LIST.length);
    assert.equal(new Set(all).size, FRUIT_LIST.length);
    for (const g of groups) assert.deepEqual(g.kinds, [...g.kinds].sort((a, b) => a.localeCompare(b)));
    assert.equal(groups[0].family, 'tree');
  });
});

describe('searchKinds', () => {
  test('names that start with the text come first', () => {
    const r = searchKinds('lem').map((x) => x.kind);
    assert.equal(r[0], 'lemon');
    assert.ok(r.includes('lemon balm') && r.includes('lemongrass'));
  });
  test('matches a later word too', () => {
    assert.ok(searchKinds('cherry').map((x) => x.kind).includes('surinam cherry'));
  });
  test('other names find the kind and say which name matched', () => {
    assert.deepEqual(searchKinds('pineapple guava')[0], { kind: 'feijoa', alias: 'pineapple guava' });
    assert.deepEqual(searchKinds('nispero')[0], { kind: 'loquat', alias: 'nispero' });
  });
  test("an alias doesn't hide the kind's own name", () => {
    assert.deepEqual(searchKinds('fig')[0], { kind: 'fig', alias: null });
  });
  test('ignores case, accents and curly apostrophes', () => {
    assert.equal(searchKinds('MINER’S')[0].kind, "miner's lettuce");
    assert.equal(searchKinds('níspero')[0].kind, 'loquat');
  });
  test('empty text, no results; nonsense, none', () => {
    assert.deepEqual(searchKinds('  '), []);
    assert.deepEqual(searchKinds('plutonium'), []);
  });
});

describe('exactKind', () => {
  test('a kind or another name for one', () => {
    assert.equal(exactKind(' Fig '), 'fig');
    assert.equal(exactKind('carambola'), 'starfruit');
    assert.equal(exactKind('fi'), null);
  });
});

describe('FRUIT_ALIASES', () => {
  test('every other name points at a kind on the list and is not itself a kind', () => {
    const list = new Set(FRUIT_LIST);
    for (const [alias, kind] of Object.entries(FRUIT_ALIASES)) {
      assert.ok(list.has(kind), `${alias} → ${kind} is not on the list`);
      assert.ok(!list.has(alias), `${alias} is already a kind`);
      assert.equal(alias, alias.toLowerCase());
    }
  });
});
