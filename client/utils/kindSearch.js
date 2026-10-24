// The "what's there?" list in add-a-find: every kind on FRUIT_LIST, grouped by family,
// and a search that also knows other names (FRUIT_ALIASES). Pure, unit-tested.
import { FRUIT_LIST, FRUIT_ALIASES } from './fruitList.js';
import { FAMILIES, familyOf } from './fruitFamilies.js';

const KINDS = [...FRUIT_LIST].sort((a, b) => a.localeCompare(b));

/** [{ family, label, kinds: [name, …] }] in FAMILIES order, names A–Z. */
export function groupedKinds() {
  return FAMILIES.map((f) => ({
    family: f.id,
    label: f.label,
    kinds: KINDS.filter((k) => familyOf(k) === f.id),
  })).filter((g) => g.kinds.length > 0);
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Rank: whole name 0, name starts with it 1, a word starts with it 2, contains it 3.
function rank(name, q) {
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.split(/[\s-]/).some((w) => w.startsWith(q))) return 2;
  if (name.includes(q)) return 3;
  return -1;
}

/**
 * Kinds matching `query`, best first: [{ kind, alias }] where `alias` is the other
 * name that matched (e.g. { kind: 'feijoa', alias: 'pineapple guava' }) or null.
 * Empty query → [].
 */
export function searchKinds(query, { limit = 40 } = {}) {
  const q = norm(query);
  if (!q) return [];
  const best = new Map(); // kind → { r, alias }
  for (const k of KINDS) {
    const r = rank(norm(k), q);
    if (r >= 0) best.set(k, { r, alias: null });
  }
  for (const [alias, k] of Object.entries(FRUIT_ALIASES)) {
    const r = rank(norm(alias), q);
    if (r < 0) continue;
    const prev = best.get(k);
    // An alias only shows when it matches better than the kind's own name.
    if (!prev || r + 0.5 < prev.r) best.set(k, { r: r + 0.5, alias });
  }
  return [...best.entries()]
    .sort((a, b) => a[1].r - b[1].r || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([kind, v]) => ({ kind, alias: v.alias }));
}

/** The list's name for typed text, if it is exactly a kind or another name for one. */
export function exactKind(text) {
  const q = norm(text);
  if (!q) return null;
  if (FRUIT_LIST.includes(q)) return q;
  return FRUIT_ALIASES[q] || null;
}
