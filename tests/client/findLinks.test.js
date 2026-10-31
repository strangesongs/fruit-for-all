// A link per find and reports (client/utils/findLinks.js, shared with the server).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPinId, findPath, findUrl, pinIdFromPath, validateReport, REPORT_REASONS,
  REPORT_NOTE_MAX, findSummary, plainText,
} from '../../client/utils/findLinks.js';

const ID = '3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c';

describe('find links', () => {
  test('paths and urls', () => {
    assert.equal(findPath(ID), `/find/${ID}`);
    assert.equal(findUrl('https://fruitforall.app/', ID), `https://fruitforall.app/find/${ID}`);
  });
  test('reads the id from a path, upper or lower case, trailing slash ok', () => {
    assert.equal(pinIdFromPath(`/find/${ID}`), ID);
    assert.equal(pinIdFromPath(`/find/${ID}/`), ID);
    assert.equal(pinIdFromPath(`/find/${ID.toUpperCase()}`), ID);
  });
  test('anything else is not a find', () => {
    for (const p of ['/', '/find/', '/find/fig', `/finds/${ID}`, `/find/${ID}/x`, null, 42, '/reset-password']) {
      assert.equal(pinIdFromPath(p), null, String(p));
    }
    assert.equal(isPinId('not-a-uuid'), false);
    assert.equal(isPinId(ID), true);
  });
});

describe('validateReport', () => {
  test('accepts each reason, with or without a note', () => {
    for (const r of REPORT_REASONS) {
      if (r.id === 'other') continue;
      assert.deepEqual(validateReport({ reason: r.id }), { valid: true, report: { reason: r.id, note: '' } });
    }
    assert.deepEqual(validateReport({ reason: 'gone', note: '  cut down last week ' }).report,
      { reason: 'gone', note: 'cut down last week' });
  });
  test('"something else" needs a few words', () => {
    assert.equal(validateReport({ reason: 'other' }).valid, false);
    assert.equal(validateReport({ reason: 'other', note: '   ' }).valid, false);
    assert.equal(validateReport({ reason: 'other', note: 'bees nest in it' }).valid, true);
  });
  test('rejects (never throws on) bad bodies', () => {
    const bad = [null, undefined, 'gone', [], {}, { reason: 'nope' }, { reason: 3 }, { reason: ['gone'] },
      { reason: 'gone', note: 5 }, { reason: 'gone', note: { a: 1 } },
      { reason: 'gone', note: 'x'.repeat(REPORT_NOTE_MAX + 1) }];
    for (const b of bad) {
      assert.doesNotThrow(() => validateReport(b));
      assert.equal(validateReport(b).valid, false, JSON.stringify(b));
    }
  });
});

describe('findSummary', () => {
  const fig = {
    pinId: ID, fruitType: 'fig', fruitTypeDisplay: 'Fig', zone: 10,
    coordinates: { lat: 34.06, lng: -118.29 }, notes: 'over the alley fence, low branches',
    submittedBy: 'ana',
  };
  test('kind, season and the note; never who added it', () => {
    const s = findSummary(fig, 8);
    assert.equal(s.title, 'fig · fruit for all');
    assert.match(s.description, /^fig, in season now \(.+ here\)\. “over the alley fence, low branches”$/);
    assert.ok(!s.description.includes('ana'));
  });
  test('out of season says when', () => {
    assert.match(findSummary(fig, 2).description, /^fig, in season .+ here\./);
    assert.doesNotMatch(findSummary(fig, 2).description, /now/);
  });
  test('borrowed months say whose zone, not "here"', () => {
    // a fig in zone 11 (Miami) uses zone 10's months
    const miami = { ...fig, zone: 11, coordinates: { lat: 25.77, lng: -80.19 } };
    assert.match(findSummary(miami, 8).description, /^fig, in season now \(jun – oct, zone 10 timing\)\./);
    assert.match(findSummary(miami, 2).description, /^fig, in season jun – oct \(zone 10 timing\)\./);
  });
  test('no season data, no notes', () => {
    const s = findSummary({ ...fig, fruitType: 'carob', fruitTypeDisplay: 'carob', notes: '' }, 8);
    assert.equal(s.description, 'carob, season varies. a find on the map of free fruit growing in public.');
  });
  test('long notes are clipped at a word', () => {
    const s = findSummary({ ...fig, notes: 'word '.repeat(80) }, 8);
    assert.ok(s.description.length < 200);
    assert.match(s.description, /word…”$/);
  });
  test('stored kind names lose their HTML escaping', () => {
    assert.equal(plainText('st. john&#039;s wort'), "st. john's wort");
    assert.equal(findSummary({ ...fig, fruitType: 'st. john&#039;s wort', fruitTypeDisplay: 'st. john&#039;s wort' }, 8).title,
      "st. john's wort · fruit for all");
  });
});
