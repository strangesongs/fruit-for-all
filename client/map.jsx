import React, { Component } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import { getAuthHeader, isAuthenticated, getUser, isAdmin } from './utils/auth.js';
import { getCache, setCache, clearCache } from './utils/cache.js';
import { clusterPins } from './utils/clustering.js';
import { getSeasonForZone, isInSeason, getSeasonDisplay } from './utils/fruitSeasons.js';
import { API_BASE } from './utils/config.js';
import { containsProfanity } from './utils/profanity.js';
import L from 'leaflet';

import './stylesheets/map.css';
import 'leaflet/dist/leaflet.css';

// Marker icons — SVG teardrops matching the earthy palette
const makePinIcon = (fill, stroke) => new L.DivIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" style="filter:drop-shadow(1px 2px 3px rgba(0,0,0,0.35))"><path fill="${fill}" stroke="${stroke}" stroke-width="0.8" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5 14.5 7.62 14.5 9 13.38 11.5 12 11.5z"/></svg>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -36],
});

const defaultIcon = makePinIcon('#7a3c20', '#3a1008');
const myPinIcon  = makePinIcon('#5c6b2e', '#2a3a14');

const makeClusterIcon = (count) => new L.DivIcon({
    className: '',
    html: `<div style="
        width: 28px;
        height: 28px;
        background: #7a3c20;
        border-radius: 50%;
        border: 2px solid rgba(0,0,0,0.25);
        box-shadow: 1px 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 11px;
        font-family: 'Vollkorn', serif;
        font-weight: bold;
    ">${count}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
});

const clusterIcon = makeClusterIcon('+');

// Merge two pin arrays by pinId, keeping existing pins and adding new ones
function mergePins(existing, incoming) {
    const seen = new Set(existing.map(p => p.pinId));
    const added = incoming.filter(p => !seen.has(p.pinId));
    return added.length ? [...existing, ...added] : existing;
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

// Re-center button — flies back to the user's last known location
function LocateMeButton({ userLocation, onLocate }) {
    const map = useMap();
    if (!userLocation) return null;
    return (
        <div className="locate-me-btn" title="Back to my location"
            onClick={() => {
                map.flyTo([userLocation.lat, userLocation.lng], 13, { duration: 1.0 });
                if (onLocate) onLocate();
            }}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                <circle cx="12" cy="12" r="8" strokeOpacity="0.3"/>
            </svg>
        </div>
    );
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
        const offsetRatio = mapSize.x <= 360 ? 0.40 : 0.25;
        const zoom = map.getZoom();
        const pinPoint = map.project([target.lat, target.lng], zoom);
        const offsetPx = mapSize.y * offsetRatio;
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

const MONTH_LETTERS = ['J','F','M','A','M','J','J','A','S','O','N','D'];
const MONTH_NAMES   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Season strip — 12-segment month bar with today tick and status pill
function SeasonStrip({ inSeason, seasonMonths, generalSeason, currentMonth }) {
    const seasonSet = new Set(seasonMonths || []);

    let pillClass, pillIcon, pillText;
    if (inSeason !== null) {
        if (inSeason) {
            pillClass = 'strip-pill strip-pill--in';
            pillIcon = (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 10 C2 10 3 5 8 3 C10 2 11 2 11 2 C11 2 11 3 10 5 C8 8 4 10 2 10Z" fill="currentColor"/>
                    <line x1="2" y1="10" x2="6" y2="6" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                </svg>
            );
            pillText = 'in season now';
        } else if (seasonMonths && seasonMonths.length > 0) {
            const range = seasonMonths.length > 6
                ? 'most of the year'
                : `${MONTH_NAMES[seasonMonths[0]-1]} \u2013 ${MONTH_NAMES[seasonMonths[seasonMonths.length-1]-1]}`;
            pillClass = 'strip-pill strip-pill--upcoming';
            pillIcon = (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="2.5" fill="currentColor"/>
                    <line x1="6" y1="0.5" x2="6" y2="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="6" y1="10" x2="6" y2="11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="0.5" y1="6" x2="2" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="10" y1="6" x2="11.5" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
            );
            pillText = range;
        } else {
            pillClass = 'strip-pill strip-pill--out';
            pillIcon = (
                <svg width="9" height="10" viewBox="0 0 10 12" fill="none">
                    <path d="M7.5 1.5 A4.5 4.5 0 1 0 7.5 10.5 A3 3 0 1 1 7.5 1.5Z" fill="currentColor"/>
                </svg>
            );
            pillText = 'out of season';
        }
    } else {
        pillClass = 'strip-pill strip-pill--general';
        pillIcon = (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="2.5" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.1" fill="none"/>
                <line x1="1" y1="5.5" x2="11" y2="5.5" stroke="currentColor" strokeWidth="1"/>
                <line x1="4" y1="1" x2="4" y2="4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="8" y1="1" x2="8" y2="4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
        );
        pillText = generalSeason ? generalSeason.toLowerCase() : 'season varies';
    }

    const todayLeft = `calc(${((currentMonth - 0.5) / 12 * 100).toFixed(2)}% - 1px)`;

    return (
        <div className="season-strip">
            <div className={pillClass}>
                {pillIcon}
                {pillText}
            </div>
            <div className="season-strip__wrap">
                <div className="season-strip__bar">
                    {MONTH_LETTERS.map((_, i) => (
                        <div key={i} className={`season-strip__seg${seasonSet.has(i + 1) ? ' peak' : ''}`} />
                    ))}
                </div>
                <div className="season-strip__today" style={{ left: todayLeft }} />
                <div className="season-strip__labels">
                    {MONTH_LETTERS.map((l, i) => <span key={i}>{l}</span>)}
                </div>
            </div>
        </div>
    );
}

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
            pinFlySeq: 0         // Increments on each pin click to reliably trigger pan
        };
        this.mapRef = null; // Reference to map instance
        this.debounceTimer = null; // Timer for debouncing viewport changes
        this._locationReceived = false;
        this._blockViewportFetchUntil = 0; // ms timestamp; viewport fetches are ignored before this
    }

    closePopups = () => {
        this.setState(prev => ({ closePopupsSignal: prev.closePopupsSignal + 1 }));
    };

    componentDidMount() {
        this.requestUserLocation();
    }

    // Request geolocation on startup; center map + seed first pin fetch with ~100-mile bounds.
    // Browser remembers the permission grant, so after the first accept it's a silent call.
    requestUserLocation = async () => {
        if (!navigator.geolocation) {
            this.fetchPins();
            return;
        }
        // Skip the wait if the user has already explicitly denied permission
        if (navigator.permissions) {
            try {
                const status = await navigator.permissions.query({ name: 'geolocation' });
                if (status.state === 'denied') {
                    this.fetchPins();
                    return;
                }
            } catch (e) { /* Permissions API unavailable */ }
        }
        this._locationReceived = false;
        // If geolocation stalls (e.g. user ignores the prompt), fall back after 5 s
        const fallback = setTimeout(() => {
            if (!this._locationReceived) {
                this._locationReceived = true;
                this.fetchPins();
            }
        }, 5000);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (this._locationReceived) return;
                this._locationReceived = true;
                clearTimeout(fallback);
                const userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                // Cache across the session so the add-fruit form is pre-filled
                try { sessionStorage.setItem('ffa_last_location', JSON.stringify(userLocation)); } catch (e) {}
                // Block viewport-change re-fetches for 4 s so the fly-to animation
                // doesn't immediately overwrite this regional load with a tiny viewport.
                this._blockViewportFetchUntil = Date.now() + 4000;
                this.setState({ userLocation });
                this.fetchPins(false, this.getLocationBounds(userLocation.lat, userLocation.lng));
            },
            () => {
                if (this._locationReceived) return;
                this._locationReceived = true;
                clearTimeout(fallback);
                this.fetchPins();
            },
            { timeout: 8000, maximumAge: 5 * 60 * 1000, enableHighAccuracy: false }
        );
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
        // Fetch public pins for unauthenticated visitors
        if (!isAuthenticated()) {
            this.setState({ loading: true });
            try {
                const response = await fetch('/api/pins/public');
                const data = await response.json();
                this.setState({
                    pins: data.success ? data.pins : [],
                    loading: false,
                    error: null,
                });
            } catch (err) {
                this.setState({ pins: [], loading: false, error: null });
            }
            return;
        }

        this.setState({ loading: true });

        // Create cache key based on bounds if provided
        const cacheKey = bounds 
            ? `pins_${bounds.minLat}_${bounds.maxLat}_${bounds.minLng}_${bounds.maxLng}`
            : 'allPins';

        // Check cache first (unless force refresh)
        if (!forceRefresh) {
            const cachedPins = getCache(cacheKey);
            if (cachedPins) {
                this.setState({ 
                    pins: cachedPins, 
                    loading: false 
                });
                return;
            }
        }

        try {
            const headers = {
                ...getAuthHeader(),
            };

            // Add If-None-Match header if we have an ETag
            if (this.state.etag) {
                headers['If-None-Match'] = this.state.etag;
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

            const response = await fetch(url, { headers });

            // Handle 304 Not Modified - use cached data
            if (response.status === 304) {
                const cachedPins = getCache('allPins');
                if (cachedPins) {
                    this.setState({ loading: false });
                    return;
                }
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
                
                // Cache the pins data with bounds-based key
                setCache(cacheKey, result.pins);
                
                this.setState({ 
                    pins: result.pins, 
                    loading: false,
                    etag: newEtag,
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
            console.error('[PINS] Exception:', error);
            this.setState({ 
                error: 'Error loading pins: ' + error.message, 
                loading: false 
            });
        }
    };

    // Method to refresh pins (called from parent when new pin is submitted)
    refreshPins = () => {
        clearCache('allPins');
        this.setState({ loading: true });
        const { userLocation } = this.state;
        if (userLocation) {
            this.fetchPins(true, this.getLocationBounds(userLocation.lat, userLocation.lng));
        } else {
            this.fetchPins(true);
        }
    };

    // Toggle filtering to show only the current user's pins
    toggleMyPins = () => {
        this.setState(prevState => ({
            showMyPinsOnly: !prevState.showMyPinsOnly
        }));
    };

    // Handle viewport changes with debouncing — merges new pins into existing set
    handleViewportChange = (bounds) => {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(async () => {
            // Ignore viewport fetches during the initial fly-to animation
            if (Date.now() < this._blockViewportFetchUntil) return;
            if (!isAuthenticated()) return;

            const cacheKey = `pins_${bounds.minLat}_${bounds.maxLat}_${bounds.minLng}_${bounds.maxLng}`;
            const cached = getCache(cacheKey);
            if (cached) {
                // Merge cached viewport pins into existing set
                this.setState(prev => ({
                    pins: mergePins(prev.pins, cached)
                }));
                return;
            }

            try {
                const params = new URLSearchParams({
                    minLat: bounds.minLat.toFixed(6),
                    maxLat: bounds.maxLat.toFixed(6),
                    minLng: bounds.minLng.toFixed(6),
                    maxLng: bounds.maxLng.toFixed(6),
                    limit: '500'
                });
                const response = await fetch(`${API_BASE}/api/pins?${params}`, { headers: getAuthHeader() });
                if (!response.ok) return;
                const result = await response.json();
                if (result.success) {
                    setCache(cacheKey, result.pins);
                    this.setState(prev => ({ pins: mergePins(prev.pins, result.pins) }));
                }
            } catch (e) { /* silent — existing pins stay */ }
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

            const result = await response.json();

            if (result.success) {
                // Optimistic update: remove from state immediately, clear cache
                const updatedPins = this.state.pins.filter(pin => pin.pinId !== pinId);
                clearCache('allPins');
                setCache('allPins', updatedPins);
                this.setState({ pins: updatedPins });
            } else {
                alert('Error deleting pin: ' + result.message);
            }
        } catch (error) {
            console.error('Error deleting pin:', error);
            alert('Error deleting pin. Please try again.');
        }
    };

    // Start editing notes for a pin
    startEditingNotes = (pinId, currentNotes) => {
        this.setState({
            editingPinId: pinId,
            editingNotes: currentNotes || ''
        });
    };

    // Cancel editing notes
    cancelEditingNotes = () => {
        this.setState({
            editingPinId: null,
            editingNotes: ''
        });
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
                });
                // Update cache
                setCache('allPins', updatedPins);
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

        return (
            <div className='map-area'>
                    <MapContainer center={[34.061415, -118.293991]} zoom={13} scrollWheelZoom={true} zoomControl={false}>
                        <ZoomControl position="topright" />
                        <MapFlyTo target={this.state.userLocation} />
                        <PanToPin target={this.state.pinFlyTarget} seq={this.state.pinFlySeq} />
                        <ClosePopupsOnCommand signal={this.state.closePopupsSignal} />
                        <LocateMeButton userLocation={this.state.userLocation} onLocate={() => { this._blockViewportFetchUntil = Date.now() + 3000; }} />
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
                                            icon={makeClusterIcon(pin.count || '+')}
                                        >
                                            <Popup autoPan={false} eventHandlers={{ add: () => this.props.onPinOpen && this.props.onPinOpen() }}>
                                                <div className="pin-popup">
                                                    <div className="popup-header">
                                                        <h3 className="fruit-title">{pin.count} fruit pins</h3>
                                                    </div>
                                                    <div className="popup-content">
                                                        <p style={{fontSize: '0.9rem', color: '#666'}}>Zoom in to see individual pins</p>
                                                        <div className="metadata-grid">
                                                            {pin.pins.slice(0, 3).map((p, i) => (
                                                                <div key={i} className="metadata-item">
                                                                    <strong>{p.fruitTypeDisplay.toLowerCase()}</strong>
                                                                    <span>{p.submittedBy}</span>
                                                                </div>
                                                            ))}
                                                            {pin.pins.length > 3 && (
                                                                <div className="metadata-item">
                                                                    <span style={{fontStyle: 'italic'}}>...and {pin.pins.length - 3} more</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    );
                                }
                                
                                // Regular pin markers
                                const isMyPin = currentUsername && pin.submittedBy === currentUsername;
                                const markerIcon = isMyPin ? myPinIcon : defaultIcon;
                                
                                // Calculate seasonal status
                                const currentMonth = new Date().getMonth() + 1;
                                const inSeason = pin.zone ? isInSeason(pin.fruitType, pin.zone, currentMonth) : null;
                                const seasonMonths = pin.zone ? getSeasonForZone(pin.fruitType, pin.zone) : null;
                                const generalSeason = getSeasonDisplay(pin.fruitType);
                                
                                // Determine season badge
                                const seasonBadge = (
                                    <SeasonStrip
                                        inSeason={inSeason}
                                        seasonMonths={seasonMonths}
                                        generalSeason={generalSeason}
                                        currentMonth={currentMonth}
                                    />
                                );
                                
                                return (
                                    <Marker 
                                        position={[pin.coordinates.lat, pin.coordinates.lng]} 
                                        key={pin.pinId}
                                        icon={markerIcon}
                                    >
                                        <Popup autoPan={false} eventHandlers={{ add: () => { this.setState(prev => ({ pinFlyTarget: { lat: pin.coordinates.lat, lng: pin.coordinates.lng }, pinFlySeq: prev.pinFlySeq + 1 })); this.props.onPinOpen && this.props.onPinOpen(); } }}>
                                            <div className="pin-popup">
                                                <div className="popup-header">
                                                    <h3 className="fruit-title">{pin.fruitTypeDisplay.toLowerCase()}</h3>
                                                    {seasonBadge}
                                                </div>
                                                
                                                <div className="popup-content">
                                                    {(pin.notes || editingPinId === pin.pinId || (isMyPin || isAdmin())) && (
                                                        <div className="notes-section">
                                                            <strong>notes:</strong>
                                                            {editingPinId === pin.pinId ? (
                                                                <div className="edit-notes-box">
                                                                    <textarea 
                                                                        value={editingNotes}
                                                                        onChange={(e) => this.setState({ editingNotes: e.target.value })}
                                                                        className="notes-textarea"
                                                                    />
                                                                    <div className="edit-notes-actions">
                                                                        <button 
                                                                            onClick={() => this.saveEditedNotes(pin.pinId)}
                                                                            className="save-notes-btn"
                                                                        >
                                                                            save
                                                                        </button>
                                                                        <button 
                                                                            onClick={this.cancelEditingNotes}
                                                                            className="cancel-notes-btn"
                                                                        >
                                                                            cancel
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : pin.notes ? (
                                                                <p 
                                                                    className="pin-notes clickable-notes"
                                                                    onClick={() => (isMyPin || isAdmin()) && this.startEditingNotes(pin.pinId, pin.notes)}
                                                                    style={{ cursor: (isMyPin || isAdmin()) ? 'pointer' : 'default' }}
                                                                    title={(isMyPin || isAdmin()) ? 'Click to edit' : ''}
                                                                >
                                                                    {pin.notes}
                                                                </p>
                                                            ) : (isMyPin || isAdmin()) ? (
                                                                <p
                                                                    className="pin-notes add-notes-prompt"
                                                                    onClick={() => this.startEditingNotes(pin.pinId, '')}
                                                                    style={{ cursor: 'pointer' }}
                                                                >
                                                                    + add notes
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    )}
                                                    
                                                    <details className="metadata-details">
                                                        <summary className="metadata-summary">details</summary>
                                                        <div className="metadata-grid">
                                                            <div className="metadata-item">
                                                                <strong>location:</strong>
                                                                <span>{pin.coordinates.lat.toFixed(4)}, {pin.coordinates.lng.toFixed(4)}</span>
                                                            </div>
                                                            
                                                            <div className="metadata-item">
                                                                <strong>added by:</strong>
                                                                <span>{pin.submittedBy || 'anonymous'}</span>
                                                            </div>
                                                            
                                                            <div className="metadata-item">
                                                                <strong>date:</strong>
                                                                <span>{new Date(pin.createdAt).toLocaleDateString('en-US', {
                                                                    year: 'numeric',
                                                                    month: 'short',
                                                                    day: 'numeric'
                                                                })}</span>
                                                            </div>
                                                        </div>
                                                    </details>
                                                    
                                                    {/* Action buttons - show delete for owner or admin */}
                                                    {(isMyPin || isAdmin()) && (
                                                        <div className="pin-actions">
                                                            <button 
                                                                className="delete-pin-btn"
                                                                onClick={() => this.deletePin(pin.pinId)}
                                                            >
                                                                delete pin
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
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
