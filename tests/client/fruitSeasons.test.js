import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { FRUIT_SEASONS, getSeasonForZone } from '../../client/utils/fruitSeasons.js';

describe('getSeasonForZone', () => {
  test('a listed zone gives its own months', () => {
    assert.deepEqual(getSeasonForZone('loquat', 10), FRUIT_SEASONS.loquat.zones[10]);
    assert.deepEqual(getSeasonForZone('Loquat', 9), FRUIT_SEASONS.loquat.zones[9]);
  });
  test('an unlisted zone borrows the nearest listed one', () => {
    // loquat lists zones 7–10
    assert.deepEqual(getSeasonForZone('loquat', 11), FRUIT_SEASONS.loquat.zones[10]);
    assert.deepEqual(getSeasonForZone('loquat', 5), FRUIT_SEASONS.loquat.zones[7]);
  });
  test('a zone given as a string still works', () => {
    assert.deepEqual(getSeasonForZone('loquat', '10'), FRUIT_SEASONS.loquat.zones[10]);
  });
  test('no data or bad input is null, never a throw', () => {
    assert.equal(getSeasonForZone('plutonium', 10), null);
    assert.equal(getSeasonForZone(undefined, 10), null);
    assert.equal(getSeasonForZone(42, 10), null);
    assert.equal(getSeasonForZone('loquat', null), null);
    assert.equal(getSeasonForZone('loquat', 'ten'), null);
  });
  test('every entry is months per zone and nothing else', () => {
    for (const [kind, entry] of Object.entries(FRUIT_SEASONS)) {
      assert.deepEqual(Object.keys(entry), ['zones'], kind);
      for (const [zone, months] of Object.entries(entry.zones)) {
        assert.ok(Number(zone) >= 1 && Number(zone) <= 13, `${kind} zone ${zone}`);
        assert.ok(months.every((m) => Number.isInteger(m) && m >= 1 && m <= 12), `${kind} zone ${zone}`);
      }
    }
  });
});
