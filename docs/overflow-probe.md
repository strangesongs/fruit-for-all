# Overflow probe (Firefox responsive mode)

Use this when a fixed bar or panel looks cut off on the right, or zoom looks off-centre.

1. Open the app in Firefox, then responsive design mode (⌥⌘M / Ctrl+Shift+M).
2. Set the size (402×874 or 240×427) and turn **touch simulation on**. Firefox only honours the meta viewport with touch simulation, so the bug can hide without it.
3. Reload, open the console and paste:

```js
(() => {
  const vw = window.innerWidth;
  const vv = window.visualViewport;
  const w = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return `${sel}: not rendered`;
    const r = el.getBoundingClientRect();
    return `${sel}: width ${r.width.toFixed(1)}, left ${r.left.toFixed(1)}, right ${r.right.toFixed(1)}, computed ${getComputedStyle(el).width}`;
  };
  console.log(`innerWidth ${vw}, clientWidth ${document.documentElement.clientWidth}, scrollWidth ${document.documentElement.scrollWidth}`);
  if (vv) console.log(`visualViewport width ${vv.width.toFixed(1)}, scale ${vv.scale.toFixed(3)}, offsetLeft ${vv.offsetLeft.toFixed(1)}`);
  ['html', 'body', '.main-layout', '.guest-bar', '.auth-bar', '.mobile-panel', '.leaflet-container'].forEach((s) => console.log(w(s)));
  const wide = [...document.querySelectorAll('body *')]
    .filter((el) => !el.closest('.leaflet-map-pane') && el.getBoundingClientRect().right > vw + 0.5)
    .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} → right ${el.getBoundingClientRect().right.toFixed(1)}`);
  console.log(wide.length ? `past the right edge:\n${wide.slice(0, 30).join('\n')}` : 'nothing past the right edge');
})();
```

What to look for:
- `visualViewport.scale` below 1, or `clientWidth` larger than the size you set: the layout viewport was widened. The "past the right edge" list names the element that caused it.
- Leaflet's map pane (tiles, markers) extends past the map on purpose and is clipped by `.leaflet-container`, so the probe skips it.
