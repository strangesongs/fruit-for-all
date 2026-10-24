import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { logoSvg, logoStroke, HEX_INKS } from '../../client/utils/logo.js';

describe('logo', () => {
  test('one fruit and its leaf at every size', () => {
    for (const size of [16, 32, 58, 512]) {
      const svg = logoSvg({ size });
      assert.equal((svg.match(/<ellipse/g) || []).length, 2, `${size}px: one fruit, block + ink`);
      assert.match(svg, /^<svg[^>]*viewBox="0 0 48 48".*<\/svg>$/);
    }
  });

  test('ink stays about the same printed weight at every size', () => {
    for (const size of [16, 24, 32, 42, 58]) {
      const px = (logoStroke(size) * size) / 48;
      assert.ok(px >= 1.1 && px <= 2, `${size}px → ${px}px line`);
    }
    assert.ok(logoStroke(16) > logoStroke(46));
  });

  test('uses the CSS tokens in the app and literal hex for standalone files', () => {
    assert.match(logoSvg(), /fill:var\(--citron\)/);
    const file = logoSvg({ size: 512, inks: HEX_INKS });
    assert.ok(!file.includes('var('));
    assert.match(file, /#e2b93b/);
  });

  test('decorative by default, an accessible image with a label', () => {
    assert.match(logoSvg(), /aria-hidden="true"/);
    assert.match(logoSvg({ label: 'fruit for all' }), /role="img" aria-label="fruit for all"/);
  });
});
