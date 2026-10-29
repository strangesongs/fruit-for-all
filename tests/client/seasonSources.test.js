// SEASON_CHECKS (client/utils/seasonSources.js) mirrors the "Status by entry" table
// in docs/season-sources.md, and seasonCoverage counts the kind list by family.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SEASON_CHECKS } from '../../client/utils/seasonSources.js';
import { seasonCoverage } from '../../client/utils/seasonCoverage.js';
import { FRUIT_SEASONS } from '../../client/utils/fruitSeasons.js';
import { FRUIT_LIST } from '../../client/utils/fruitList.js';

const doc = readFileSync(new URL('../../docs/season-sources.md', import.meta.url), 'utf8');
const table = doc.slice(doc.indexOf('## Status by entry'));
const rows = [...table.matchAll(/^\| ([^|]+?) \| (.+?) \|$/gm)]
  .map(([, kind, status]) => ({ kind, status }))
  .filter((r) => r.kind !== 'Entry' && !/^-+$/.test(r.kind));

describe('season sources', () => {
  test('the doc table has a row for every entry with months, and only those', () => {
    assert.deepEqual(rows.map((r) => r.kind).sort(), Object.keys(FRUIT_SEASONS).sort());
  });

  test('SEASON_CHECKS matches the doc: the same checked entries, how, and sources', () => {
    const fromDoc = {};
    for (const { kind, status } of rows) {
      const how = /^\**([a-z]+)/.exec(status)[1];
      if (how === 'unverified') continue;
      const sources = [...new Set([...status.matchAll(/\bS(\d+)\b/g)].map((m) => Number(m[1])))]
        .sort((a, b) => a - b).map((n) => `S${n}`);
      fromDoc[kind] = { how, sources };
    }
    assert.deepEqual(SEASON_CHECKS, fromDoc);
  });

  test('every checked entry has months; every status is one of three', () => {
    for (const [kind, c] of Object.entries(SEASON_CHECKS)) {
      assert.ok(FRUIT_SEASONS[kind], kind);
      assert.ok(['verified', 'changed', 'bloom'].includes(c.how), kind);
    }
  });
});

describe('seasonCoverage', () => {
  test('counts the whole list: checked + unchecked + no months = every kind', () => {
    const c = seasonCoverage();
    assert.equal(c.total, FRUIT_LIST.length);
    assert.equal(c.checked + c.unchecked + c.none, c.total);
    assert.equal(c.checked, Object.keys(SEASON_CHECKS).length);
    assert.equal(c.checked + c.unchecked, Object.keys(FRUIT_SEASONS).length);
    for (const f of c.families) assert.equal(f.noMonths.length, f.none, f.id);
  });

  test('by family, in family order, from given data', () => {
    const c = seasonCoverage({
      kinds: ['fig', 'loquat', 'basil', 'lemon', 'mint'],
      seasons: { fig: {}, loquat: {}, lemon: {} },
      checks: { fig: { how: 'verified', sources: ['S5'] } },
      family: (k) => ({ fig: 'tree', loquat: 'tree', lemon: 'citrus', basil: 'herbs', mint: 'herbs' })[k],
    });
    assert.deepEqual(
      c.families.map((f) => [f.id, f.checked, f.unchecked, f.none, f.noMonths]),
      [['tree', 1, 1, 0, []], ['citrus', 0, 1, 0, []], ['herbs', 0, 0, 2, ['basil', 'mint']]],
    );
    assert.deepEqual([c.total, c.checked, c.unchecked, c.none], [5, 1, 2, 2]);
  });
});
