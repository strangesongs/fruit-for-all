// Words for the admin command center (client/utils/adminView.js).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAdminPath, daysAgo, shortDate, whenLabel, agoLabel, todayLabel, countsLine, sidebarCountLabel,
  reportCountLabel, whoLabel, activityWords, reasonTag, REASON_TAGS, hiddenReasonLabel, handledSummary,
} from '../../client/utils/adminView.js';
import { REPORT_REASONS } from '../../client/utils/findLinks.js';

// Local times, so the labels don't depend on the machine's time zone.
const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
const NOW = new Date(2026, 9, 26, 15, 30); // monday, oct 26 2026, 3:30 pm

describe('admin view words', () => {
  test('only /admin is the page', () => {
    assert.equal(isAdminPath('/admin'), true);
    assert.equal(isAdminPath('/admin/'), true);
    for (const p of ['/', '/administrator', '/admin/x', '/find/admin']) assert.equal(isAdminPath(p), false, p);
  });

  test('days ago follows the calendar, not 24-hour blocks', () => {
    assert.equal(daysAgo(at(2026, 10, 26, 0, 5), NOW), 0);
    assert.equal(daysAgo(at(2026, 10, 25, 23, 59), NOW), 1);
    assert.equal(daysAgo(at(2026, 10, 20), NOW), 6);
    assert.equal(daysAgo('not a date', NOW), null);
  });

  test('when (activity) and ago (reports)', () => {
    assert.equal(whenLabel(at(2026, 10, 26, 9, 12), NOW), 'today 9:12 am');
    assert.equal(whenLabel(at(2026, 10, 26, 0, 5), NOW), 'today 12:05 am');
    assert.equal(whenLabel(at(2026, 10, 26, 13, 0), NOW), 'today 1:00 pm');
    assert.equal(whenLabel(at(2026, 10, 25), NOW), 'yesterday');
    assert.equal(whenLabel(at(2026, 10, 24), NOW), 'oct 24');
    assert.equal(agoLabel(at(2026, 10, 26), NOW), 'today');
    assert.equal(agoLabel(at(2026, 10, 25), NOW), 'yesterday');
    assert.equal(agoLabel(at(2026, 10, 23), NOW), '3 days ago');
    assert.equal(agoLabel(at(2026, 10, 1), NOW), 'oct 1');
    assert.equal(shortDate(at(2026, 8, 2)), 'aug 2');
    assert.equal(todayLabel(NOW), 'monday, october 26');
  });

  test('counts', () => {
    assert.equal(countsLine({ openReports: 3, finds: 15, hidden: 0, people: 10 }), '3 open reports · 15 finds · 10 people');
    assert.equal(countsLine({ openReports: 1, finds: 1, hidden: 2, people: 1 }), '1 open report · 1 find · 2 hidden · 1 person');
    assert.equal(sidebarCountLabel(0), 'nothing open');
    assert.equal(sidebarCountLabel(undefined), 'nothing open');
    assert.equal(sidebarCountLabel(1), '1 open report');
    assert.equal(sidebarCountLabel(3), '3 open reports');
    assert.equal(reportCountLabel(1), '1 report');
    assert.equal(reportCountLabel(2), '2 reports on this find');
  });

  test('who: you, a visitor, or the name', () => {
    assert.equal(whoLabel('Admin', 'admin'), 'you');
    assert.equal(whoLabel(null, 'admin'), 'a visitor');
    assert.equal(whoLabel('marisol', 'admin'), 'marisol');
  });

  test('activity words', () => {
    assert.deepEqual(activityWords({ kind: 'edited', fields: ['notes', 'kind'] }), { what: 'edited', detail: 'notes, kind' });
    assert.deepEqual(activityWords({ kind: 'edited', fields: ['spot'] }), { what: 'moved', detail: '' });
    assert.deepEqual(activityWords({ kind: 'edited', fields: ['notes', 'spot'] }), { what: 'edited', detail: 'notes, spot' });
    for (const [kind, what] of [['added', 'added'], ['hidden', 'hidden'], ['restored', 'put back'], ['deleted', 'deleted'],
      ['still-there', 'still there'], ['still-good', 'still good'], ['report-handled', 'report handled']]) {
      assert.equal(activityWords({ kind }).what, what, kind);
    }
  });

  test('every report reason has a short tag', () => {
    for (const r of REPORT_REASONS) assert.ok(REASON_TAGS[r.id], r.id);
    assert.equal(reasonTag('wrong-kind'), 'a different plant');
    assert.equal(hiddenReasonLabel('unsafe'), 'reported unsafe');
    assert.equal(hiddenReasonLabel(null), '');
  });

  test('the handled fold line', () => {
    assert.equal(handledSummary({ count: 0, recent: [] }), '');
    assert.equal(
      handledSummary({ count: 4, recent: [{ handledAt: at(2026, 10, 23), fruitType: 'kumquat', outcome: 'kept' }] }),
      'the last one oct 23, kumquat, kept',
    );
  });
});
