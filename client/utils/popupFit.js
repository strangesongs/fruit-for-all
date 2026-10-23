// How far to pan the map (Leaflet panBy offsets, in px) so an open pin popup fits
// in the visible part of the map above the standard-phone bottom bar.
// All inputs are in map-container pixels. Pure, so it can be unit-tested.
//
//   pinY       the pin's y position
//   popupTop   top edge of the popup card
//   popupLeft / popupRight   its horizontal edges
//   mapW       map width
//   visibleH   height of the map that isn't covered by the bottom bar
//
// The pin goes 80% of the way down the visible area (as before) unless the card is
// too tall for that, in which case the pin goes lower so the card's top clears the
// edge. If the card can't fit at all, its top wins: the close button and the name
// stay on screen and the card scrolls.
export const POPUP_PAD = 12;

export function popupPanDelta({ pinY, popupTop, popupLeft, popupRight, mapW, visibleH, pad = POPUP_PAD }) {
    const above = pinY - popupTop;              // card + tip + marker height above the pin
    const minPinY = above + pad;                // lowest pin y that keeps the card's top visible
    const maxPinY = visibleH - 8;               // pin stays above the bar
    let pinTarget = Math.max(visibleH * 0.8, minPinY);
    if (minPinY <= maxPinY) pinTarget = Math.min(pinTarget, maxPinY);
    let dy = pinY - pinTarget;

    let dx = 0;
    const width = popupRight - popupLeft;
    if (width > mapW - 2 * pad) dx = (popupLeft + popupRight) / 2 - mapW / 2;
    else if (popupLeft < pad) dx = popupLeft - pad;
    else if (popupRight > mapW - pad) dx = popupRight - (mapW - pad);

    dx = Math.abs(dx) < 2 ? 0 : Math.round(dx);
    dy = Math.abs(dy) < 2 ? 0 : Math.round(dy);
    return { dx, dy };
}
