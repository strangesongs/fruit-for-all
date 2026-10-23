import { test } from 'node:test';
import assert from 'node:assert/strict';
import { popupPanDelta, POPUP_PAD } from '../../client/utils/popupFit.js';

// iPhone SE 2022-ish: 375 wide, ~480px of map visible above the bar.
const base = { mapW: 375, visibleH: 480, popupLeft: 45, popupRight: 330 };

// Applying panBy([dx, dy]) moves everything on the map by (-dx, -dy).
const after = (input, d) => ({
    pinY: input.pinY - d.dy,
    top: input.popupTop - d.dy,
    left: input.popupLeft - d.dx,
    right: input.popupRight - d.dx,
});

test('tall card cut off at the top is pulled down so its top is visible', () => {
    const input = { ...base, pinY: 430, popupTop: -30 }; // the screenshot case
    const d = popupPanDelta(input);
    const a = after(input, d);
    assert.ok(a.top >= POPUP_PAD - 1, `top ${a.top}`);
    assert.ok(a.pinY <= base.visibleH - 8, `pin ${a.pinY} under the bar`);
});

test('short card puts the pin 80% down the visible area', () => {
    const input = { ...base, pinY: 100, popupTop: 0 }; // card 100px tall
    const a = after(input, popupPanDelta(input));
    assert.equal(a.pinY, Math.round(base.visibleH * 0.8));
});

test('card taller than the visible area keeps its top on screen', () => {
    const input = { ...base, pinY: 300, popupTop: -300 }; // 600px above the pin
    const a = after(input, popupPanDelta(input));
    assert.equal(a.top, POPUP_PAD);
});

test('card hanging off the left or right edge is nudged back in', () => {
    const left = { ...base, pinY: 384, popupTop: 200, popupLeft: -40, popupRight: 245 };
    assert.equal(after(left, popupPanDelta(left)).left, POPUP_PAD);
    const right = { ...base, pinY: 384, popupTop: 200, popupLeft: 120, popupRight: 405 };
    assert.equal(after(right, popupPanDelta(right)).right, base.mapW - POPUP_PAD);
});

test('already in place: no pan', () => {
    const input = { ...base, pinY: 384, popupTop: 100 };
    assert.deepEqual(popupPanDelta(input), { dx: 0, dy: 0 });
});
