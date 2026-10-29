// How much of the kind list has season months, and how many of those were checked
// against a source. Pure, for the command center's "season data" section.
import { FRUIT_LIST } from './fruitList.js';
import { FRUIT_SEASONS } from './fruitSeasons.js';
import { SEASON_CHECKS } from './seasonSources.js';
import { FAMILIES, FALLBACK_FAMILY, familyOf } from './fruitFamilies.js';

/**
 * @returns {{ total, checked, unchecked, none, families: Array<{ id, label, checked, unchecked, none, noMonths: string[] }> }}
 * Families come in FAMILIES order; one with no kinds at all is left out.
 */
export function seasonCoverage({
  kinds = FRUIT_LIST, seasons = FRUIT_SEASONS, checks = SEASON_CHECKS, family = familyOf,
} = {}) {
  const order = [...FAMILIES, FALLBACK_FAMILY];
  const byId = new Map(order.map((f) => [f.id, { id: f.id, label: f.label, checked: 0, unchecked: 0, none: 0, noMonths: [] }]));
  for (const kind of kinds) {
    const row = byId.get(family(kind)) || byId.get(FALLBACK_FAMILY.id);
    if (!seasons[kind]) {
      row.none += 1;
      row.noMonths.push(kind);
    } else if (checks[kind]) {
      row.checked += 1;
    } else {
      row.unchecked += 1;
    }
  }
  const families = order.map((f) => byId.get(f.id)).filter((r) => r.checked + r.unchecked + r.none > 0);
  for (const f of families) f.noMonths.sort();
  const sum = (k) => families.reduce((n, f) => n + f[k], 0);
  return { total: kinds.length, checked: sum('checked'), unchecked: sum('unchecked'), none: sum('none'), families };
}
