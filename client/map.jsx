import React, { Component } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import { getAuthHeader, isAuthenticated, getUser, isAdmin, handleUnauthorized } from './utils/auth.js';
import { getCache, setCache, clearCache, clearCachesByPrefix, buildPinsCacheKey } from './utils/cache.js';
import { clusterPins } from './utils/clustering.js';
import { API_BASE } from './utils/config.js';
import { containsProfanity } from './utils/profanity.js';
import { fetchWithRetry } from './utils/network.js';
import { isOlderThanMonths } from './utils/timeAgo.js';
import { TINY_MAX, getBottomChromePx } from './utils/breakpoints.js';
import { familyOf, markSvg } from './utils/fruitFamilies.js';
import { ripenessOf, buildViewSummary, lookForHints, MONTH_NAMES, distanceMiles } from './utils/pinSummary.js';
import { buildShelf, shelfEnabled, SEARCH_AREA_MI } from './utils/seasonShelf.js';
import { detectZoneFallback } from './utils/zoneFallback.js';
import { popupPanDelta } from './utils/popupFit.js';
import { LOCATE_OPTIONS, isAppleMobile, locateErrorMessage, parseLastLocation } from './utils/geolocation.js';
import L from 'leaflet';

import './stylesheets/map.css';
import 'leaflet/dist/leaflet.css';

// Marker icons — one hand-cut mark per kind of find (utils/fruitFamilies.js), printed
// block-print style. In season: paper disk, leaf ring, and the mark's colour block under
// the ink. Yours: a solid fig disk with paper linework (a fill, not just a ring colour,
// so it reads without colour vision). Not in season: small, faded, no colour block.
// Icons are cached so Leaflet doesn't rebuild DOM on every render.
const _pinIconCache = new globalThis.Map();
function pinIcon(family, state, stale) {
    const key = `${family}|${state}|${stale ? 1 : 0}`;
    let icon = _pinIconCache.get(key);
    if (!icon) {
        const quiet = state === 'quiet';
        const mine = state === 'mine';
        const ink = mine ? 'var(--paper)' : (quiet ? 'var(--text-muted)' : 'var(--text)');
        const mark = markSvg(family, { size: quiet ? 18 : 22, color: ink, block: state === 'ripe' });
        icon = new L.DivIcon({
            className: '',
            html: `<div class="ffa-pin ffa-pin--${state}${stale ? ' ffa-pin--stale' : ''}">`
                + `<span class="ffa-pin__disk">${mark}</span>`
                + `<span class="ffa-pin__tail"></span></div>`,
            iconSize: [38, 46],
            iconAnchor: [19, 46],
            popupAnchor: [0, -46],
        });
        _pinIconCache.set(key, icon);
    }
    return icon;
}

// Clusters are an ink stamp with the count.
const _clusterIconCache = new globalThis.Map();
function clusterIcon(count) {
    const label = count > 99 ? '99+' : String(count || '+');
    let icon = _clusterIconCache.get(label);
    if (!icon) {
        icon = new L.DivIcon({
            className: '',
            html: `<div class="ffa-cluster">${label}</div>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19],
            popupAnchor: [0, -20],
        });
        _clusterIconCache.set(label, icon);
    }
    return icon;
}

// The season shelf's current entry: a fig number stamped on its pin (only that one).
// Drawn as its own non-interactive marker on top of the pin, same anchor.
const SHELF_MARK_ICON = new L.DivIcon({
    className: '',
    html: '<div class="ffa-shelf-mark" aria-hidden="true"><span>1</span></div>',
    iconSize: [38, 46],
    iconAnchor: [19, 46],
});

// "search this area": a stamp on the map that re-anchors the season shelf. Taps
// must not reach the map underneath (same as the locate button).
function SearchAreaStamp({ onClick }) {
    const ref = React.useRef(null);
    React.useEffect(() => {
        if (ref.current) {
            L.DomEvent.disableClickPropagation(ref.current);
            L.DomEvent.disableScrollPropagation(ref.current);
        }
    }, []);
    return (
        <button ref={ref} type="button" className="search-area-stamp" onClick={onClick}>
            search this area
        </button>
    );
}

// Merge two pin arrays by pinId, keeping existing pins and adding new ones
function mergePins(existing, incoming) {
    const seen = new Set(existing.map(p => p.pinId));
    const added = incoming.filter(p => !seen.has(p.pinId));
    return added.length ? [...existing, ...added] : existing;
}

// Captures the Leaflet map instance into a mutable ref on the parent class
function MapRefCapture({ onMap }) {
    const map = useMap();
    React.useEffect(() => { onMap(map); }, [map]);
    return null;
}

// After a pan/fly completes, opens the popup on the marker at `target` coords
function OpenPopupOnPin({ target, seq }) {
    const map = useMap();
    const lastSeq = React.useRef(-1);
    React.useEffect(() => {
        if (!target || seq === lastSeq.current) return;
        lastSeq.current = seq;
        const openPopup = () => {
            map.eachLayer(layer => {
                if (!(layer instanceof L.Marker)) return;
                const ll = layer.getLatLng();
                if (Math.abs(ll.lat - target.lat) < 0.000001 &&
                    Math.abs(ll.lng - target.lng) < 0.000001) {
                    layer.openPopup();
                }
            });
        };
        map.once('moveend', openPopup);
        return () => map.off('moveend', openPopup);
    }, [seq]);
    return null;
}

// Component to fly the map to a new location (e.g. after geolocation resolves)
function MapFlyTo({ target }) {
    const map = useMap();
    const prevTarget = React.useRef(null);
    React.useEffect(() => {
        if (target && target !== prevTarget.current) {
            prevTarget.current = target;
            map.flyTo([target.lat, target.lng], 13, { duration: 1.2 });
        }
    }, [target]);
    return null;
}

// Re-center button — asks for the precise location and flies there. If that fails it
// says why (it used to fail silently, which on iPhone looked like a dead button) and
// falls back to the last known location.
function LocateMeButton({ onLocate, onPreciseLocation, fallbackLocation }) {
    const ref = React.useRef(null);
    const [finding, setFinding] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const msgTimer = React.useRef(null);

    // Like Leaflet's own controls: keep taps on the button from reaching the map
    // (drag start, popup close, tap-hold) underneath.
    React.useEffect(() => {
        if (ref.current) {
            L.DomEvent.disableClickPropagation(ref.current);
            L.DomEvent.disableScrollPropagation(ref.current);
        }
        return () => clearTimeout(msgTimer.current);
    }, []);

    // The season shelf's "use my location" link asks this button to locate.
    const locateRef = React.useRef(null);
    React.useEffect(() => {
        const onRequest = () => locateRef.current && locateRef.current();
        window.addEventListener('ffa:locate-me', onRequest);
        return () => window.removeEventListener('ffa:locate-me', onRequest);
    }, []);

    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;

    const showMessage = (text) => {
        clearTimeout(msgTimer.current);
        setMessage(text);
        if (text) msgTimer.current = setTimeout(() => setMessage(''), 9000);
    };

    const locate = () => {
        if (finding) return;
        if (onLocate) onLocate();
        setFinding(true);
        showMessage('');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setFinding(false);
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                try { sessionStorage.setItem('ffa_last_location', JSON.stringify(loc)); } catch (e) {}
                if (onPreciseLocation) onPreciseLocation(loc, true);
            },
            (err) => {
                setFinding(false);
                let last = null;
                try { last = parseLastLocation(sessionStorage.getItem('ffa_last_location')); } catch (e) {}
                const fallback = last || fallbackLocation || null;
                // A fresh object so MapFlyTo flies even if it's the same place.
                if (fallback && onPreciseLocation) onPreciseLocation({ lat: fallback.lat, lng: fallback.lng }, false);
                showMessage(locateErrorMessage(err && err.code, {
                    apple: isAppleMobile(navigator.userAgent, navigator.maxTouchPoints || 0),
                    hasFallback: !!fallback,
                }));
            },
            LOCATE_OPTIONS
        );
    };
    locateRef.current = locate;

    return (
        <div ref={ref} className={`locate-me-btn${finding ? ' locate-me-btn--finding' : ''}`}
            title="go to my location" aria-label="go to my location"
            role="button" tabIndex={0} aria-busy={finding}
            onClick={locate}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); locate(); } }}
        >
            {message && (
                <div className="locate-me-msg" role="status"
                    onClick={(e) => { e.stopPropagation(); showMessage(''); }}>
                    {message}
                </div>
            )}
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                <circle cx="12" cy="12" r="8" strokeOpacity="0.3"/>
            </svg>
        </div>
    );
}

// Pan needed to fit an open popup above the bottom bar (standard phones). Reads the
// popup's real position; the arithmetic lives in utils/popupFit.js (tested).
function popupFitBox(map, target, mapSize, bottomChrome) {
    const visibleH = Math.max(mapSize.y - bottomChrome, mapSize.y * 0.4);
    const pin = map.latLngToContainerPoint([target.lat, target.lng]);
    const wrap = map.getContainer().querySelector('.leaflet-popup-content-wrapper');
    const r = wrap ? wrap.getBoundingClientRect() : null;
    if (!r || !r.height) {
        // Popup not open yet (e.g. a bar entry flying to a find): bring the pin itself
        // into place; the later check fits the card once it exists.
        return { dx: Math.round(pin.x - mapSize.x / 2), dy: Math.round(pin.y - visibleH * 0.8) };
    }
    const cont = map.getContainer().getBoundingClientRect();
    return popupPanDelta({
        pinY: pin.y,
        popupTop: r.top - cont.top,
        popupLeft: r.left - cont.left,
        popupRight: r.right - cont.left,
        mapW: mapSize.x,
        visibleH,
    });
}

// Pans to a pin when its popup is opened
function PanToPin({ target, seq }) {
    const map = useMap();
    const lastSeq = React.useRef(-1);
    React.useEffect(() => {
        if (!target || seq === lastSeq.current) return;
        lastSeq.current = seq;
        // Offset the center downward (northward in lat) so the popup,
        // which renders above the pin, stays fully visible on small screens.
        // On narrow phones (≤360px) the map is 100vh but browser chrome eats
        // ~55px off the top, so we need a larger offset to keep the popup clear.
        const mapSize = map.getSize();
        const zoom = map.getZoom();
        const pinPoint = map.project([target.lat, target.lng], zoom);
        let offsetPx;
        const bottomChrome = mapSize.x <= TINY_MAX ? 0 : getBottomChromePx();
        if (bottomChrome > 0) {
            // Standard phones: a fixed bar covers the bottom of the map. The popup's
            // height isn't known yet when it opens (react-leaflet fills and lays out its
            // content after this effect runs; measuring now often read 0 and left the top
            // of a tall card off-screen). So wait for layout, measure the card where it
            // actually is, and pan by exactly what's needed to fit it.
            let cancelled = false;
            const fit = () => {
                if (cancelled) return;
                const box = popupFitBox(map, target, mapSize, bottomChrome);
                if (box && (box.dx || box.dy)) map.panBy([box.dx, box.dy], { animate: true, duration: 0.4 });
            };
            // Two frames: one for React's commit, one for Leaflet's popup layout.
            requestAnimationFrame(() => requestAnimationFrame(fit));
            // Fonts or the content settling can still change the height; check once more.
            const late = setTimeout(fit, 500);
            return () => { cancelled = true; clearTimeout(late); };
        } else {
            offsetPx = mapSize.y * (mapSize.x <= TINY_MAX ? 0.40 : 0.25);
        }
        const centreLatLng = map.unproject(pinPoint.subtract([0, offsetPx]), zoom);
        map.panTo(centreLatLng, { animate: true, duration: 0.5 });
    }, [seq]); // primitive comparison — fires reliably on every new pin click
    return null;
}

// Closes all open Leaflet popups when the signal value changes
function ClosePopupsOnCommand({ signal }) {
    const map = useMap();
    React.useEffect(() => {
        if (signal > 0) map.closePopup();
    }, [signal]);
    return null;
}



// Import extracted components
import PinPopup from './components/PinPopup.jsx';
import MapControls from './components/MapControls.jsx';

// Where the map opens before any location is known (central LA).
const DEFAULT_CENTER = [34.061415, -118.293991];

// Component to handle map events
function MapEvents({ onViewportChange, onZoomChange }) {
    const map = useMapEvents({
        moveend: () => {
            const bounds = map.getBounds();
            const viewportBounds = {
                minLat: bounds.getSouth(),
                maxLat: bounds.getNorth(),
                minLng: bounds.getWest(),
                maxLng: bounds.getEast()
            };
            const zoom = map.getZoom();
            onViewportChange(viewportBounds);
            onZoomChange(zoom); // Update zoom on every move
        },
        zoomend: () => {
            const bounds = map.getBounds();
            const viewportBounds = {
                minLat: bounds.getSouth(),
                maxLat: bounds.getNorth(),
                minLng: bounds.getWest(),
                maxLng: bounds.getEast()
            };
            const zoom = map.getZoom();
            onViewportChange(viewportBounds);
            onZoomChange(zoom);
        }
    });
    return null;
}

class Map extends Component {
    constructor(props) {
        super(props);
        this.state = {
            pins: [], // Pins from database
            loading: true,
            error: null,
            showMyPinsOnly: false,
            etag: null, // Store ETag for conditional requests
            zoom: 13, // Current zoom level
            fruitFilter: 'all', // Filter for fruit types
            editingPinId: null, // Pin currently being edited
            editingNotes: '', // Temp storage for edited notes
            userLocation: null, // User's geolocation once resolved
            closePopupsSignal: 0, // Increment to close all open popups
            pinFlyTarget: null,  // Set to {lat, lng} to pan map to that pin
            pinFlySeq: 0,        // Increments on each pin click to reliably trigger pan
            spotlightPin: null,  // Coords of pin whose popup should open after pan
            spotlightSeq: 0,     // Increments to trigger OpenPopupOnPin
            // Season shelf (?landing=shelf, signed out): where it's measured from.
            // { lat, lng, kind: 'approx' | 'precise' | 'area', city }
            shelfAnchor: null,
            showSearchArea: false,
            shelfMark: null,     // {lat, lng} of the shelf's current entry
        };
        this._shelfOn = shelfEnabled();
        this._personAnchor = null; // the person's own anchor, for "back to near me"
        this.mapRef = null; // Reference to map instance
        this._leafletMap = null; // Live Leaflet map instance (set by MapRefCapture)
        this._betVisited = new Set(); // Pins already shown in the current nearest-bet cycle
        this.debounceTimer = null; // Timer for debouncing viewport changes
        this._blockViewportFetchUntil = 0; // ms timestamp; viewport fetches are ignored before this
        this._requestControllers = {
            ipLocate: null,
            initialPins: null,
            viewportPins: null,
        };
        this._etagByCacheKey = new globalThis.Map();
        // After a pin changes, skip the browser's HTTP cache for a while: pin lists are
        // served with max-age, so a revisited view could otherwise show the old list.
        this._skipHttpCacheUntil = 0;
        this._viewBounds = null; // last viewport bounds, for the "in this view" summary
    }

    closePopups = () => {
        this.setState(prev => ({ closePopupsSignal: prev.closePopupsSignal + 1 }));
    };

    componentDidMount() {
        this.requestIpLocation();
        window.addEventListener('ffa:nearest-good-bet', this.handleNearestGoodBet);
        window.addEventListener('ffa:fly-to', this.handleFlyTo);
        if (this._shelfOn) {
            window.addEventListener('ffa:shelf-select', this.handleShelfSelect);
            window.addEventListener('ffa:shelf-search-area', this.searchThisArea);
            window.addEventListener('ffa:shelf-near-me', this.backToNearMe);
            this.locateIfAlreadyAllowed();
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.fruitFilter !== this.state.fruitFilter || prevState.showMyPinsOnly !== this.state.showMyPinsOnly) {
            this.publishPinSummary(this.state.pins);
        }
    }

    // Tapping a cluster zooms in to its finds (keeping them clear of the phone bar).
    zoomToCluster = (cluster) => {
        const map = this._leafletMap;
        if (!map || !cluster.pins || cluster.pins.length === 0) return;
        const bounds = L.latLngBounds(cluster.pins.map(p => [p.coordinates.lat, p.coordinates.lng]));
        const bottom = map.getSize().x <= TINY_MAX ? 70 : getBottomChromePx() + 40;
        map.flyToBounds(bounds, {
            paddingTopLeft: [40, 70],
            paddingBottomRight: [70, bottom],
            maxZoom: 17,
            duration: 0.6,
        });
    };

    componentWillUnmount() {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.cancelRequest('ipLocate');
        this.cancelRequest('initialPins');
        this.cancelRequest('viewportPins');
        window.removeEventListener('ffa:nearest-good-bet', this.handleNearestGoodBet);
        window.removeEventListener('ffa:fly-to', this.handleFlyTo);
        window.removeEventListener('ffa:shelf-select', this.handleShelfSelect);
        window.removeEventListener('ffa:shelf-search-area', this.searchThisArea);
        window.removeEventListener('ffa:shelf-near-me', this.backToNearMe);
    }

    // ── Season shelf ──────────────────────────────────────────────────────────

    // Where the person is: a precise location replaces the network guess, never the reverse.
    setPersonAnchor = (anchor) => {
        if (!anchor) return;
        if (anchor.kind !== 'precise' && this._personAnchor && this._personAnchor.kind === 'precise') return;
        this._personAnchor = anchor;
        this.setState(prev => (prev.shelfAnchor && prev.shelfAnchor.kind === 'area' ? null : { shelfAnchor: anchor }),
            () => this.publishPinSummary(this.state.pins));
    };

    // If the browser already has permission, use the precise location without a prompt.
    locateIfAlreadyAllowed = () => {
        try {
            if (!navigator.permissions || !navigator.geolocation) return;
            navigator.permissions.query({ name: 'geolocation' }).then((status) => {
                if (status.state !== 'granted') return;
                navigator.geolocation.getCurrentPosition((pos) => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    try { sessionStorage.setItem('ffa_last_location', JSON.stringify(loc)); } catch (e) {}
                    this._blockViewportFetchUntil = Date.now() + 4000;
                    this.setState({ userLocation: loc });
                    this.fetchPins(false, this.getLocationBounds(loc.lat, loc.lng));
                    this.setPersonAnchor({ ...loc, kind: 'precise', city: null });
                }, () => {}, LOCATE_OPTIONS);
            }).catch(() => {});
        } catch (e) { /* no permissions API */ }
    };

    searchThisArea = () => {
        const map = this._leafletMap;
        if (!map) return;
        const c = map.getCenter();
        this.setState({ shelfAnchor: { lat: c.lat, lng: c.lng, kind: 'area', city: null }, showSearchArea: false, shelfMark: null },
            () => this.publishPinSummary(this.state.pins));
    };

    backToNearMe = () => {
        const a = this._personAnchor;
        this.setState({ shelfAnchor: a, shelfMark: null }, () => this.publishPinSummary(this.state.pins));
        if (a && this._leafletMap) this._leafletMap.flyTo([a.lat, a.lng], Math.max(this._leafletMap.getZoom(), 14), { duration: 0.8 });
    };

    // A shelf entry was chosen: bring its find into the visible map (above the shelf)
    // and number its pin. No popup: the pin is one tap away.
    handleShelfSelect = (event) => {
        const c = event?.detail;
        const map = this._leafletMap;
        if (!map || !c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
        const zoom = Math.max(map.getZoom(), 15); // clusters break up at 14
        const size = map.getSize();
        const visibleH = Math.max(size.y - getBottomChromePx(), size.y * 0.4);
        const pt = map.project([c.lat, c.lng], zoom);
        // Put the pin in the middle of the strip of map above the shelf.
        const centre = map.unproject(pt.add([0, size.y / 2 - visibleH / 2]), zoom);
        map.setView(centre, zoom, { animate: true, duration: 0.5 });
        this.setState({ shelfMark: { lat: c.lat, lng: c.lng } });
    };

    publishShelf = (center) => {
        if (!this._shelfOn || typeof window === 'undefined') return;
        const anchor = this.state.shelfAnchor;
        const shelf = buildShelf(this.state.pins, anchor, new Date().getMonth() + 1);
        // The stamp appears once the map is beyond the shelf's reach from its anchor.
        let showSearchArea = false;
        if (anchor && center && !isAuthenticated()) {
            const reach = shelf.entries.reduce((m, e) => (e.distanceMi < 50 ? Math.max(m, e.distanceMi) : m), 0);
            showSearchArea = distanceMiles(anchor, center) > Math.max(SEARCH_AREA_MI, reach + 0.5);
        }
        if (showSearchArea !== this.state.showSearchArea) this.setState({ showSearchArea });
        window.dispatchEvent(new CustomEvent('ffa:shelf', {
            detail: {
                anchor: anchor ? { kind: anchor.kind, city: anchor.city || null } : { kind: 'none', city: null },
                shelf,
                loading: this.state.loading,
            },
        }));
    };

    // Bar entries ("in season", "nearest") pan to a find and open its popup.
    handleFlyTo = (event) => {
        const c = event?.detail;
        if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
        // Clusters break up at zoom 14; get close enough for the pin's own marker.
        const map = this._leafletMap;
        if (map && map.getZoom() < 15) map.setZoom(15, { animate: false });
        this.setState(prev => ({
            pinFlyTarget: { lat: c.lat, lng: c.lng },
            pinFlySeq: prev.pinFlySeq + 1,
            spotlightPin: { lat: c.lat, lng: c.lng },
            spotlightSeq: prev.spotlightSeq + 1,
        }));
    };

    // Squared approximate distance — good enough for city-scale comparisons
    _dist2 = (a, b) => {
        const dlat = a.lat - b.lat;
        const dlng = (a.lng - b.lng) * Math.cos(a.lat * Math.PI / 180);
        return dlat * dlat + dlng * dlng;
    };

    // Returns candidate pins sorted nearest-first from current map center.
    _sortedGoodBets = () => {
        const { pins, userLocation } = this.state;
        const month = new Date().getMonth() + 1;
        const exclude = ['test', 'tests', 'demo', 'testing', 'user'];

        const lc = this._leafletMap ? this._leafletMap.getCenter() : null;
        const ref = lc ? { lat: lc.lat, lng: lc.lng } : userLocation;

        const candidates = pins.filter(pin => {
            if (pin.cluster || !pin.fruitType) return false;
            const lowerType = pin.fruitType.toLowerCase();
            if (exclude.some(w => lowerType.includes(w))) return false;
            // In season where the find is (its saved zone, else estimated from its location).
            return ripenessOf(pin, month) === 'ripe';
        });

        const pool = candidates.length > 0 ? candidates : pins.filter(pin =>
            !pin.cluster && pin.fruitType &&
            !exclude.some(w => pin.fruitType.toLowerCase().includes(w))
        );

        if (pool.length === 0) return [];
        if (!ref) return pool;

        return [...pool].sort((a, b) =>
            this._dist2(ref, a.coordinates) - this._dist2(ref, b.coordinates)
        );
    };

    handleNearestGoodBet = () => {
        const sorted = this._sortedGoodBets();
        if (sorted.length === 0) return;

        // Skip pins already visited in this cycle; when all visited, restart.
        const pinKey = p => `${p.coordinates.lat},${p.coordinates.lng}`;
        let unvisited = sorted.filter(p => !this._betVisited.has(pinKey(p)));
        if (unvisited.length === 0) {
            this._betVisited.clear();
            unvisited = sorted;
        }

        const pin = unvisited[0];
        this._betVisited.add(pinKey(pin));

        this.setState(prev => ({
            pinFlyTarget: pin.coordinates,
            pinFlySeq: prev.pinFlySeq + 1,
            spotlightPin: pin.coordinates,
            spotlightSeq: prev.spotlightSeq + 1,
        }));
    };

    cancelRequest = (requestKey) => {
        const controller = this._requestControllers[requestKey];
        if (controller) {
            controller.abort();
            this._requestControllers[requestKey] = null;
        }
    };

    createRequestController = (requestKey) => {
        this.cancelRequest(requestKey);
        const controller = new AbortController();
        this._requestControllers[requestKey] = controller;
        return controller;
    };

    // Publishes what is *in the current viewport* (not every pin loaded this session)
    // for the "in this view" ticker and the fruit filter.
    publishPinSummary = (pins) => {
        if (typeof window === 'undefined') return;
        const excludeWords = ['test', 'tests', 'demo', 'testing', 'user'];
        const b = this._viewBounds;
        const visible = b
            ? (pins || []).filter(p => p.coordinates
                && p.coordinates.lat >= b.minLat && p.coordinates.lat <= b.maxLat
                && p.coordinates.lng >= b.minLng && p.coordinates.lng <= b.maxLng
                && !(p.fruitType && excludeWords.some(w => p.fruitType.toLowerCase().includes(w))))
            : (pins || []);
        const fruitTypes = [...new Set(visible
            .map(pin => pin.fruitType)
            .filter(Boolean)
            .filter(type => {
                const lowerType = type.toLowerCase();
                return !excludeWords.some(word => lowerType.includes(word));
            })
        )].sort();

        const lc = this._leafletMap ? this._leafletMap.getCenter() : null;
        const center = lc ? { lat: lc.lat, lng: lc.lng }
            : b ? { lat: (b.minLat + b.maxLat) / 2, lng: (b.minLng + b.maxLng) / 2 } : this.state.userLocation;
        // Count only what the map actually draws: the fruit filter and "my pins" hide
        // markers, so the bar must not offer finds the user can't see.
        const { fruitFilter, showMyPinsOnly } = this.state;
        const me = showMyPinsOnly ? (getUser() || {}).userName : null;
        const drawn = visible.filter(p => (fruitFilter === 'all' || p.fruitType === fruitFilter)
            && (!me || p.submittedBy === me));
        const summary = buildViewSummary(drawn, center, new Date().getMonth() + 1);
        this.publishShelf(center);
        window.dispatchEvent(new CustomEvent('ffa:pins-summary', {
            detail: {
                pinCount: drawn.length,
                fruitTypes,
                authenticated: isAuthenticated(),
                summary,
            },
        }));
    };

    updatePinsState = (nextPins, extraState = {}) => {
        this.setState({
            pins: nextPins,
            ...extraState,
        }, () => this.publishPinSummary(nextPins));
    };

    // On startup, get approximate location from the server-side IP lookup (no browser
    // permission prompt). Uses the precise location only when the user explicitly clicks
    // the locate-me button.
    requestIpLocation = async () => {
        const controller = this.createRequestController('ipLocate');
        try {
            const response = await fetchWithRetry(`${API_BASE}/api/locate`, {
                signal: controller.signal,
            }, {
                timeoutMs: 7000,
                retries: 1,
            });
            if (response.ok) {
                const data = await response.json();
                if (data.lat && data.lng) {
                    const userLocation = { lat: data.lat, lng: data.lng };
                    this._blockViewportFetchUntil = Date.now() + 4000;
                    if (this._personAnchor && this._personAnchor.kind === 'precise') {
                        // A precise location arrived first; don't fly back to the guess.
                        this.fetchPins(false, this.getLocationBounds(data.lat, data.lng));
                        return;
                    }
                    this.setState({ userLocation });
                    if (this._shelfOn) this.setPersonAnchor({ ...userLocation, kind: 'approx', city: data.city || null });
                    this.fetchPins(false, this.getLocationBounds(data.lat, data.lng));
                    return;
                }
            }
        } catch (e) {
            if (controller.signal.aborted) return;
            /* network error — fall through */
        } finally {
            if (this._requestControllers.ipLocate === controller) {
                this._requestControllers.ipLocate = null;
            }
        }
        // No IP location: load the area around where the map is (the default centre on
        // first load), not an unbounded list from anywhere in the world.
        this.fetchPins(false, this.getFallbackBounds());
    };

    // ~100 miles around the map's current centre, or the default centre before the
    // map has mounted.
    getFallbackBounds = () => {
        const c = this._leafletMap ? this._leafletMap.getCenter() : null;
        const [lat, lng] = c ? [c.lat, c.lng] : DEFAULT_CENTER;
        return this.getLocationBounds(lat, lng);
    };

    // Returns a bounding box approximately 100 miles around (lat, lng)
    getLocationBounds = (lat, lng) => {
        const latDelta = 1.45; // 1° lat ≈ 69 miles; 1.45° ≈ 100 miles
        const lngDelta = latDelta / Math.cos((lat * Math.PI) / 180);
        return {
            minLat: lat - latDelta,
            maxLat: lat + latDelta,
            minLng: lng - lngDelta,
            maxLng: lng + lngDelta,
        };
    };

    fetchPins = async (forceRefresh = false, bounds = null) => {
        const controller = this.createRequestController('initialPins');
        const cacheKey = buildPinsCacheKey(bounds);

        // Fetch public pins for unauthenticated visitors (bounds + cursor match authed /api/pins, no usernames)
        if (!isAuthenticated()) {
            this.setState({ loading: true });
            try {
                const params = new URLSearchParams();
                if (bounds) {
                    params.set('minLat', bounds.minLat.toFixed(6));
                    params.set('maxLat', bounds.maxLat.toFixed(6));
                    params.set('minLng', bounds.minLng.toFixed(6));
                    params.set('maxLng', bounds.maxLng.toFixed(6));
                    params.set('limit', '500');
                } else {
                    params.set('limit', '200');
                }
                const response = await fetchWithRetry(`${API_BASE}/api/pins/public?${params.toString()}`, {
                    signal: controller.signal,
                    cache: this.pinsCacheMode(),
                }, {
                    timeoutMs: 9000,
                    retries: 2,
                });
                const data = await response.json();
                if (bounds && data.success) {
                    setCache(cacheKey, data.pins);
                }
                this.updatePinsState(data.success ? data.pins : [], { loading: false, error: null });
            } catch (err) {
                if (!controller.signal.aborted) {
                    this.updatePinsState([], { loading: false, error: null });
                }
            } finally {
                if (this._requestControllers.initialPins === controller) {
                    this._requestControllers.initialPins = null;
                }
            }
            return;
        }

        this.setState({ loading: true });

        // Check cache first (unless force refresh)
        if (!forceRefresh) {
            const cachedPins = getCache(cacheKey);
            if (cachedPins) {
                this.updatePinsState(cachedPins, { loading: false });
                return;
            }
        }

        try {
            const headers = {
                ...getAuthHeader(),
            };

            // Add If-None-Match header if we have an ETag
            const etagForKey = this._etagByCacheKey.get(cacheKey);
            if (etagForKey) {
                headers['If-None-Match'] = etagForKey;
            }

            // Build URL with bounds query params if provided
            let url = `${API_BASE}/api/pins`;
            if (bounds) {
                const params = new URLSearchParams({
                    minLat: bounds.minLat.toFixed(6),
                    maxLat: bounds.maxLat.toFixed(6),
                    minLng: bounds.minLng.toFixed(6),
                    maxLng: bounds.maxLng.toFixed(6)
                });
                url += `?${params.toString()}`;
            }

            const response = await fetchWithRetry(url, {
                headers,
                signal: controller.signal,
                cache: this.pinsCacheMode(),
            }, {
                timeoutMs: 12000,
                retries: 2,
            });

            // Handle 304 Not Modified - use cached data
            if (response.status === 304) {
                const cachedPins = getCache(cacheKey);
                if (cachedPins) {
                    this.updatePinsState(cachedPins, { loading: false, error: null });
                    return;
                }
            }

            // Expired or invalid token: sign out (the sidebar reloads public pins)
            if (handleUnauthorized(response)) {
                this.setState({ loading: false });
                return;
            }

            // Handle auth errors
            if (response.status === 401 || response.status === 403) {
                console.error('[PINS] Auth error', response.status, '- re-login required');
                this.setState({
                    error: 'Session expired. Please log in again.', 
                    loading: false,
                    pins: []
                });
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                // Store ETag from response
                const newEtag = response.headers.get('ETag');
                if (newEtag) this._etagByCacheKey.set(cacheKey, newEtag);
                
                // Cache the pins data with bounds-based key
                setCache(cacheKey, result.pins);
                
                this.updatePinsState(result.pins, {
                    loading: false,
                    etag: newEtag || null,
                    error: null
                });
            } else {
                console.error('[PINS] API returned success=false:', result.message);
                this.setState({ 
                    error: 'Failed to load pins: ' + result.message, 
                    loading: false 
                });
            }
        } catch (error) {
            if (controller.signal.aborted) return;
            console.error('[PINS] Exception:', error);
            this.setState({ 
                error: 'Error loading pins: ' + error.message, 
                loading: false 
            });
        } finally {
            if (this._requestControllers.initialPins === controller) {
                this._requestControllers.initialPins = null;
            }
        }
    };

    // Method to refresh pins (called from parent when new pin is submitted)
    // Forget every cached pin list (localStorage, ETags, and the browser HTTP cache
    // for the next few minutes). Call after creating, editing or deleting a pin.
    invalidatePinCaches = () => {
        clearCache('allPins');
        clearCachesByPrefix('pins_');
        this._etagByCacheKey.clear();
        this._skipHttpCacheUntil = Date.now() + 5 * 60 * 1000;
    };

    // fetch() cache mode for pin lists: revalidate with the server while a recent
    // change could still be hidden by a cached response.
    pinsCacheMode = () => (Date.now() < this._skipHttpCacheUntil ? 'no-cache' : 'default');

    refreshPins = () => {
        this.invalidatePinCaches();
        this.cancelRequest('viewportPins');
        this.setState({ loading: true });
        const { userLocation } = this.state;
        if (userLocation) {
            this.fetchPins(true, this.getLocationBounds(userLocation.lat, userLocation.lng));
        } else {
            this.fetchPins(true, this.getFallbackBounds());
        }
    };

    // After sign-out: clear user-specific state and reload public pins (no usernames)
    resetAfterLogout = () => {
        this.setState({ showMyPinsOnly: false, editingPinId: null, editingNotes: '' });
        this.refreshPins();
    };

    // Toggle filtering to show only the current user's pins
    toggleMyPins = () => {
        this.setState(prevState => ({
            showMyPinsOnly: !prevState.showMyPinsOnly
        }));
    };

    // Handle viewport changes with debouncing — merges new pins into existing set
    handleViewportChange = (bounds) => {
        this._viewBounds = bounds;
        this.publishPinSummary(this.state.pins);
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(async () => {
            if (Date.now() < this._blockViewportFetchUntil) return;

            const cacheKey = buildPinsCacheKey(bounds);
            const cached = getCache(cacheKey);
            if (cached) {
                this.setState(prev => ({
                    pins: mergePins(prev.pins, cached)
                }), () => this.publishPinSummary(this.state.pins));
                return;
            }

            const authed = isAuthenticated();
            const controller = this.createRequestController('viewportPins');
            try {
                const params = new URLSearchParams({
                    minLat: bounds.minLat.toFixed(6),
                    maxLat: bounds.maxLat.toFixed(6),
                    minLng: bounds.minLng.toFixed(6),
                    maxLng: bounds.maxLng.toFixed(6),
                    limit: '500'
                });
                const path = authed ? '/api/pins' : '/api/pins/public';
                const response = await fetchWithRetry(`${API_BASE}${path}?${params}`, {
                    ...(authed ? { headers: getAuthHeader() } : {}),
                    signal: controller.signal,
                    cache: this.pinsCacheMode(),
                }, {
                    timeoutMs: 10000,
                    retries: 2,
                });
                if (!response.ok) {
                    handleUnauthorized(response);
                    return;
                }
                const result = await response.json();
                if (result.success) {
                    setCache(cacheKey, result.pins);
                    this.setState(prev => ({ pins: mergePins(prev.pins, result.pins) }), () => this.publishPinSummary(this.state.pins));
                }
            } catch (e) {
                if (controller.signal.aborted) return;
            } finally {
                if (this._requestControllers.viewportPins === controller) {
                    this._requestControllers.viewportPins = null;
                }
            }
        }, 600);
    };

    // Handle zoom changes
    handleZoomChange = (zoom) => {
        this.setState({ zoom });
    };

    // Delete a pin
    deletePin = async (pinId) => {
        if (!confirm('Are you sure you want to delete this pin?')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/pins/${pinId}`, {
                method: 'DELETE',
                headers: getAuthHeader()
            });
            if (handleUnauthorized(response)) return;

            const result = await response.json();

            if (result.success) {
                // Optimistic update: remove from state immediately, clear cache
                const updatedPins = this.state.pins.filter(pin => pin.pinId !== pinId);
                this.invalidatePinCaches();
                this.updatePinsState(updatedPins);
            } else {
                alert('Error deleting pin: ' + result.message);
            }
        } catch (error) {
            console.error('Error deleting pin:', error);
            alert('Error deleting pin. Please try again.');
        }
    };

    // Start editing notes for a pin
    // Both of these swap the popup's contents. Doing that inside the click handler
    // detaches the clicked button before Leaflet sees the click, so Leaflet treats
    // it as a click on the bare map and closes the popup. Waiting one tick lets
    // Leaflet handle the click first.
    startEditingNotes = (pinId, currentNotes) => {
        setTimeout(() => this.setState({
            editingPinId: pinId,
            editingNotes: currentNotes || ''
        }), 0);
    };

    // Cancel editing notes
    cancelEditingNotes = () => {
        setTimeout(() => this.setState({
            editingPinId: null,
            editingNotes: ''
        }), 0);
    };

    // Save edited notes
    saveEditedNotes = async (pinId) => {
        if (containsProfanity(this.state.editingNotes)) {
            alert('Please keep notes family-friendly.');
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/pins/${pinId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify({ notes: this.state.editingNotes })
            });
            if (handleUnauthorized(response)) return;

            const result = await response.json();

            if (result.success) {
                // Update the pin in state
                const updatedPins = this.state.pins.map(pin => 
                    pin.pinId === pinId ? { ...pin, notes: this.state.editingNotes } : pin
                );
                this.setState({
                    pins: updatedPins,
                    editingPinId: null,
                    editingNotes: ''
                }, () => this.publishPinSummary(updatedPins));
                // Every cached view that holds this pin now has the old notes
                this.invalidatePinCaches();
            } else {
                alert('Error saving notes: ' + result.message);
            }
        } catch (error) {
            console.error('[EDIT] Error saving notes:', error);
            alert('Error saving notes. Please try again.');
        }
    };

    render() {
        const { pins, loading, error, showMyPinsOnly, zoom, fruitFilter, editingPinId, editingNotes } = this.state;
        const currentUser = getUser();
        const currentUsername = currentUser ? currentUser.userName : null;
        
        // Filter out test/demo pins from display
        const excludeWords = ['test', 'tests', 'demo', 'testing', 'user'];
        let filteredPins = pins.filter(pin => {
            if (!pin.fruitType) return false;
            const lowerType = pin.fruitType.toLowerCase();
            return !excludeWords.some(word => lowerType.includes(word));
        });
        
        // Filter by selected fruit type if filter is active
        if (fruitFilter !== 'all') {
            filteredPins = filteredPins.filter(pin => pin.fruitType === fruitFilter);
        }
        
        // Filter to only current user's pins if active
        if (showMyPinsOnly && currentUsername) {
            filteredPins = filteredPins.filter(pin => pin.submittedBy === currentUsername);
        }
        
        // Apply clustering based on zoom level
        const bounds = { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 };
        const displayPins = clusterPins(filteredPins, bounds, zoom);
        const month = new Date().getMonth() + 1;
        const vb = this._viewBounds;
        const inViewCount = vb ? filteredPins.filter(p => p.coordinates
            && p.coordinates.lat >= vb.minLat && p.coordinates.lat <= vb.maxLat
            && p.coordinates.lng >= vb.minLng && p.coordinates.lng <= vb.maxLng).length : filteredPins.length;
        const shelfMode = this._shelfOn && !currentUsername;
        const showEmpty = !shelfMode && !loading && !error && !showMyPinsOnly && vb && inViewCount === 0 && fruitFilter === 'all';
        let emptyHints = [];
        if (showEmpty) {
            const c = this._leafletMap ? this._leafletMap.getCenter() : null;
            if (c) emptyHints = lookForHints(detectZoneFallback(c.lat, c.lng), month);
        }

        return (
            <div className='map-area'>
                    <MapContainer center={DEFAULT_CENTER} zoom={13} scrollWheelZoom={true} zoomControl={false}>
                        <ZoomControl position="topright" />
                        <MapRefCapture onMap={(map) => { this._leafletMap = map; }} />
                        <MapFlyTo target={this.state.userLocation} />
                        <PanToPin target={this.state.pinFlyTarget} seq={this.state.pinFlySeq} />
                        <OpenPopupOnPin target={this.state.spotlightPin} seq={this.state.spotlightSeq} />
                        <ClosePopupsOnCommand signal={this.state.closePopupsSignal} />
                        <LocateMeButton
                            onLocate={() => { this._blockViewportFetchUntil = Date.now() + 4000; }}
                            onPreciseLocation={(loc, precise) => {
                                this.setState({ userLocation: loc });
                                if (this._shelfOn && precise) this.setPersonAnchor({ ...loc, kind: 'precise', city: null });
                            }}
                            fallbackLocation={this.state.userLocation}
                        />
                        <MapEvents 
                            onViewportChange={this.handleViewportChange} 
                            onZoomChange={this.handleZoomChange}
                        />
                        <TileLayer
                            attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com">Stamen Design</a> &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
                            url='https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png'
                            detectRetina={false}
                        />
                        {(loading || filteredPins.length > 0) && (
                            <div className={`pin-count-badge${loading ? ' pin-count-badge--loading' : ''}`}>
                                {loading ? 'loading…' : `${filteredPins.length} pin${filteredPins.length !== 1 ? 's' : ''}`}
                            </div>
                        )}
                        {error && (
                            <div className="error-overlay">
                                {error}
                            </div>
                        )}
                        {showEmpty && (
                            <div className="map-empty-card" role="status">
                                {/* seed mark */}
                                <span className="map-empty-card__mark" aria-hidden="true"
                                    dangerouslySetInnerHTML={{ __html: markSvg('seed', { size: 28, color: 'var(--red)', strokeWidth: 1.5, block: true }) }} />
                                <p className="map-empty-card__title">nothing logged here yet.</p>
                                {emptyHints.length > 0 && (
                                    <p className="map-empty-card__hint">
                                        in {MONTH_NAMES[month - 1]}, look up at parkway trees and alley fences: {emptyHints.join(' and ')} {emptyHints.length > 1 ? 'are' : 'is'} in season around here.
                                    </p>
                                )}
                                <button type="button" className="btn map-empty-card__primary"
                                    onClick={() => window.dispatchEvent(new CustomEvent('ffa:add-find'))}>
                                    add the first find
                                </button>
                                <button type="button" className="map-empty-card__link"
                                    onClick={() => this._leafletMap && this._leafletMap.zoomOut(2)}>
                                    zoom out to look nearby →
                                </button>
                            </div>
                        )}
                        {shelfMode && this.state.showSearchArea && (
                            <SearchAreaStamp onClick={this.searchThisArea} />
                        )}
                        {shelfMode && this.state.shelfMark && (
                            <Marker
                                position={[this.state.shelfMark.lat, this.state.shelfMark.lng]}
                                icon={SHELF_MARK_ICON}
                                interactive={false}
                                keyboard={false}
                                zIndexOffset={1000}
                            />
                        )}
                        {showMyPinsOnly && !loading && filteredPins.length === 0 && (
                            <div className="my-pins-empty">
                                <strong>no pins yet</strong>
                                add your first fruit pin using the menu
                            </div>
                        )}
                        {
                            displayPins.map((pin) => {
                                // Handle cluster markers
                                if (pin.cluster) {
                                    return (
                                        <Marker
                                            position={[pin.coordinates.lat, pin.coordinates.lng]}
                                            key={pin.pinId}
                                            icon={clusterIcon(pin.count)}
                                            title={`${pin.count} finds here: tap to zoom in`}
                                            keyboard={true}
                                            eventHandlers={{ click: () => this.zoomToCluster(pin) }}
                                        />
                                    );
                                }
                                
                                // Regular pin markers
                                const isMyPin = currentUsername && pin.submittedBy === currentUsername;
                                // Stale = no sign of life in 6 months (created or last "still good").
                                const lastSeen = (pin.confirmations || []).reduce(
                                    (t, c) => (c.timestamp && c.timestamp > t ? c.timestamp : t), pin.createdAt || '');
                                const isStale = isOlderThanMonths(lastSeen, 6);
                                const ripeness = ripenessOf(pin, month);
                                const state = isMyPin ? 'mine' : (ripeness === 'quiet' ? 'quiet' : 'ripe');
                                const markerIcon = pinIcon(familyOf(pin.fruitType), state, isStale);
                                return (
                                    <Marker 
                                        position={[pin.coordinates.lat, pin.coordinates.lng]} 
                                        key={pin.pinId}
                                        icon={markerIcon}
                                    >
                                        <Popup autoPan={false} eventHandlers={{ add: () => { this.setState(prev => ({ pinFlyTarget: { lat: pin.coordinates.lat, lng: pin.coordinates.lng }, pinFlySeq: prev.pinFlySeq + 1 })); this.props.onPinOpen && this.props.onPinOpen(); } }}>
                                            <PinPopup
                                                pin={pin}
                                                isMyPin={isMyPin}
                                                isAdmin={isAdmin()}
                                                editingPinId={editingPinId}
                                                editingNotes={editingNotes}
                                                startEditingNotes={this.startEditingNotes}
                                                cancelEditingNotes={this.cancelEditingNotes}
                                                saveEditedNotes={this.saveEditedNotes}
                                                deletePin={this.deletePin}
                                                setEditingNotes={val => this.setState({ editingNotes: val })}
                                            />
                                        </Popup>
                                    </Marker>
                                );
                            })
                        }
                    </MapContainer>
            </div>
        );
    }

}

export default Map;
