// Helpers for the locate-me button. Pure (no DOM access) so they can be unit-tested.

// Options for the locate-me request. A short maximumAge so a tap after walking
// somewhere doesn't return a five-minute-old fix.
export const LOCATE_OPTIONS = { timeout: 10000, maximumAge: 30 * 1000, enableHighAccuracy: false };

// iPhone/iPad (iPadOS reports itself as a Mac with touch).
export function isAppleMobile(userAgent = '', maxTouchPoints = 0) {
    return /iPhone|iPad|iPod/.test(userAgent)
        || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

// Short, lowercase message for a GeolocationPositionError code.
// 1 = permission denied, 2 = position unavailable, 3 = timeout.
export function locateErrorMessage(code, { apple = false, hasFallback = false } = {}) {
    if (code === 1) {
        return apple
            ? 'location is off for this site. on iphone: settings › privacy & security › location services › safari websites → while using the app, then reload.'
            : 'location is blocked for this site. allow it in your browser’s site settings, then reload.';
    }
    const back = hasFallback ? ' showing your last known area.' : '';
    if (code === 3) return `couldn’t find you in time — try again.${back}`;
    return `couldn’t get your location — try again.${back}`;
}

// Last precise location saved this session (by locate-me or add-a-find), if any.
export function parseLastLocation(raw) {
    try {
        const loc = JSON.parse(raw);
        if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) return { lat: loc.lat, lng: loc.lng };
    } catch (e) { /* ignore */ }
    return null;
}
