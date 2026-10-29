// Words for the admin command center (/admin): pure, so they're unit-tested.
// The data comes from GET /api/admin/overview (server/schemas/pg/admin.js).
import { REPORT_REASONS } from './findLinks.js';

export const ADMIN_PATH = '/admin';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_MS = 86400000;

/** True for /admin and /admin/ (the page), nothing else. */
export function isAdminPath(pathname) {
  return pathname === ADMIN_PATH || pathname === `${ADMIN_PATH}/`;
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** Whole calendar days from `iso` to `now` (local time): 0 = today, 1 = yesterday. */
export function daysAgo(iso, now = new Date()) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return Math.round((startOfDay(now) - startOfDay(t)) / DAY_MS);
}

/** "oct 4" */
export function shortDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "9:12 am" */
export function clockTime(iso) {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** For activity rows: "today 9:12 am", "yesterday", "oct 24". */
export function whenLabel(iso, now = new Date()) {
  const n = daysAgo(iso, now);
  if (n === null) return '';
  if (n <= 0) return `today ${clockTime(iso)}`;
  if (n === 1) return 'yesterday';
  return shortDate(iso);
}

/** For reports: "today", "yesterday", "3 days ago", then the date. */
export function agoLabel(iso, now = new Date()) {
  const n = daysAgo(iso, now);
  if (n === null) return '';
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n < 14) return `${n} days ago`;
  return shortDate(iso);
}

/** The page's running head: "monday, october 26". */
export function todayLabel(now = new Date()) {
  const month = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
    'september', 'october', 'november', 'december'][now.getMonth()];
  return `${DAYS[now.getDay()]}, ${month} ${now.getDate()}`;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "3 open reports · 15 finds · 10 people" (hidden finds only when there are some). */
export function countsLine(counts) {
  if (!counts) return '';
  const parts = [
    plural(counts.openReports, 'open report'),
    plural(counts.finds, 'find'),
  ];
  if (counts.hidden) parts.push(`${counts.hidden} hidden`);
  parts.push(plural(counts.people, 'person', 'people'));
  return parts.join(' · ');
}

/** The sidebar link's second line. */
export function sidebarCountLabel(openReports) {
  if (!Number.isFinite(openReports) || openReports <= 0) return 'nothing open';
  return plural(openReports, 'open report');
}

/** "2 reports on this find" / "1 report". */
export function reportCountLabel(n) {
  return n > 1 ? `${n} reports on this find` : '1 report';
}

/** A person's name as the page shows it: you, a visitor (anonymous "still good"), or their name. */
export function whoLabel(by, me) {
  if (!by) return 'a visitor';
  if (me && String(by).toLowerCase() === String(me).toLowerCase()) return 'you';
  return by;
}

const FIELD_WORDS = { notes: 'notes', kind: 'kind', spot: 'spot' };

/** One activity row's words: { what, detail }. */
export function activityWords(a) {
  const fields = (a.fields || []).map((f) => FIELD_WORDS[f] || f);
  switch (a.kind) {
    case 'added': return { what: 'added', detail: '' };
    case 'edited':
      // A move alone reads better as "moved".
      if (fields.length === 1 && fields[0] === 'spot') return { what: 'moved', detail: '' };
      return { what: 'edited', detail: fields.join(', ') };
    case 'hidden': return { what: 'hidden', detail: '' };
    case 'restored': return { what: 'put back', detail: '' };
    case 'deleted': return { what: 'deleted', detail: '' };
    case 'still-there': return { what: 'still there', detail: '' };
    case 'still-good': return { what: 'still good', detail: '' };
    case 'report-handled': return { what: 'report handled', detail: '' };
    default: return { what: String(a.kind || '').replace(/-/g, ' '), detail: '' };
  }
}

/** Short tags for report reasons (the reporter's form says "it's gone" and so on). */
export const REASON_TAGS = {
  gone: 'gone',
  private: 'private property',
  unsafe: 'unsafe',
  'wrong-kind': 'a different plant',
  other: 'something else',
};
// Every reason the form offers has a tag (a test checks this too).
for (const r of REPORT_REASONS) if (!REASON_TAGS[r.id]) REASON_TAGS[r.id] = r.id;

export function reasonTag(id) {
  return REASON_TAGS[id] || String(id || '');
}

/** "reported unsafe" for a hidden find, when a report hid it. */
export function hiddenReasonLabel(reason) {
  return reason ? `reported ${reasonTag(reason)}` : '';
}

/** The "handled (4)" fold line: "the last one oct 23, kumquat, kept". */
export function handledSummary(handled) {
  const last = handled?.recent?.[0];
  if (!last) return '';
  const outcome = last.outcome === 'hidden' ? 'hidden' : 'kept';
  return `the last one ${shortDate(last.handledAt)}, ${last.fruitType}, ${outcome}`;
}
