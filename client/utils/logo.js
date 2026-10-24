// The fruit for all logo: one block-printed loquat and its long leaf (Oct 2026). Like
// the pin marks (fruitFamilies.js) it prints as flat colour blocks under ink linework,
// nudged a little out of register. The same drawing is used at every size; only the
// ink weight changes, so the line prints at roughly the same width from a 16px
// favicon up to a home-screen icon. (A four-fruit cluster was tried and felt too busy.)
//
// Dependency-free so it can be unit-tested and used to regenerate the static icons
// (favicon.svg and loquat-*.png in the repo root, rasterised once with a headless browser).

// In the app the inks follow the :root tokens; standalone files need literal colours.
export const TOKEN_INKS = {
  ink: 'var(--text)',
  citron: 'var(--citron)',
  sage: 'var(--sage)',
};
export const HEX_INKS = { ink: '#2a2420', citron: '#e2b93b', sage: '#8fa35e' };

const FRUIT = '<ellipse cx="20" cy="30" rx="12" ry="13.5"/>';
const LEAF = 'M23 10 C28 3 38 1 45 3 C42 10 33 14 23 10Z';
const STEM = 'M20 16.5 C20 13 21 10.5 23 9';

/** Ink stroke in viewBox units, so the line prints at roughly 1.2–1.5px at any size. */
export function logoStroke(size) {
  return Math.round(Math.min(3.6, Math.max(1.6, 60 / size)) * 100) / 100;
}

/**
 * Complete <svg> string for the logo at `size` px. `inks` defaults to the CSS tokens.
 * `label` makes it an accessible image; without one it's decorative.
 */
export function logoSvg({ size = 32, inks = TOKEN_INKS, label } = {}) {
  const k = inks;
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48" ${a11y}>` +
    `<g transform="translate(1.8 1.8)"><ellipse cx="20" cy="30" rx="12" ry="13.5" style="fill:${k.citron}"/>` +
    `<path d="${LEAF}" style="fill:${k.sage}"/></g>` +
    `<g fill="none" style="stroke:${k.ink}" stroke-width="${logoStroke(size)}" stroke-linecap="round" stroke-linejoin="round">` +
    `${FRUIT}<path d="${STEM}"/><path d="${LEAF}"/></g>` +
    '</svg>'
  );
}
