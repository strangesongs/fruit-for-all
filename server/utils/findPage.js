// /find/<pinId>: the app's index.html with this find's title and link-preview tags,
// so a link pasted into a message shows "fig · fruit for all" and a line about it
// instead of the generic card. Pure (string in, string out); tested.
import { escapeHtml } from './html.js';
import { findSummary, findUrl } from '../../client/utils/findLinks.js';

const SHARE_BLOCK = /<!-- share:start[\s\S]*?<!-- share:end -->/;
const TITLE = /<title>[^<]*<\/title>/;

export function shareTags({ title, description, url, image }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  return [
    '<!-- share:start -->',
    `<meta name="description" content="${d}" />`,
    '<meta property="og:site_name" content="fruit for all" />',
    '<meta property="og:type" content="article" />',
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    '<meta name="twitter:card" content="summary" />',
    '<!-- share:end -->',
  ].join('\n  ');
}

/**
 * The index page for one find. `pin` must already be public (no submittedBy).
 * Returns the template unchanged if it has no share block (an old build).
 */
export function findPageHtml(template, pin, { baseUrl, month = new Date().getMonth() + 1 } = {}) {
  if (typeof template !== 'string' || !SHARE_BLOCK.test(template) || !pin) return template;
  const summary = findSummary(pin, month);
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const tags = shareTags({
    ...summary,
    url: findUrl(base, pin.pinId),
    image: `${base}/loquat-512.png`,
  });
  return template
    .replace(SHARE_BLOCK, tags)
    .replace(TITLE, `<title>${escapeHtml(summary.title)}</title>`);
}
