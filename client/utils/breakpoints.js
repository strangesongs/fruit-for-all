// Single source of truth for the three layouts. Keep in sync with the
// @media blocks in stylesheets/sidebar.css and stylesheets/map.css.
//   tiny     ≤ 360px  — Jelly Star: FAB + floating panel (renderMobileLayout)
//   standard 361–768  — phones: bottom bar (renderGuestBar / renderAuthenticatedBar)
//   desktop  > 768px  — floating sidebar card
export const TINY_MAX = 360;
export const MOBILE_MAX = 768;

export const TINY_SCREEN_QUERY = `(max-width: ${TINY_MAX}px)`;
export const MOBILE_QUERY = `(max-width: ${MOBILE_MAX}px)`;

/** Height (px) of the fixed bottom bar on standard phones, published by Sidebar as --bottom-chrome. */
export function getBottomChromePx() {
  if (typeof document === 'undefined') return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--bottom-chrome');
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}
