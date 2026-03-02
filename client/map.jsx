import React, { Component } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { getAuthHeader, isAuthenticated, getUser, isAdmin } from './utils/auth.js';
import { getCache, setCache, clearCache } from './utils/cache.js';
import { clusterPins } from './utils/clustering.js';
import { getSeasonForZone, isInSeason, getSeasonDisplay } from './utils/fruitSeasons.js';
import { API_BASE } from './utils/config.js';
import L from 'leaflet';

import './stylesheets/map.css';
import 'leaflet/dist/leaflet.css';

// Custom marker icons
const defaultIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const myPinIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Cluster icon (blue for clusters)
const clusterIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [35, 57],
    iconAnchor: [17, 57],
    popupAnchor: [1, -50],
    shadowSize: [57, 57]
});

// Sample pins shown only when the database has no real pins yet
const SAMPLE_PINS = [
    {
        pinId: 'sample-1',
        fruitType: 'lemon',
        fruitTypeDisplay: 'Lemon',
        coordinates: { lat: 34.0614, lng: -118.2940 },
        submittedBy: 'sample',
        notes: 'Large tree, very productive in winter.',
        zone: 10,
        address: 'Boyle Heights, Los Angeles'
    },
    {
        pinId: 'sample-2',
        fruitType: 'fig',
        fruitTypeDisplay: 'Fig',
        coordinates: { lat: 34.0682, lng: -118.2855 },
        submittedBy: 'sample',
        notes: 'Two trees near the sidewalk. Ripe in late summer.',
        zone: 10,
        address: 'East Los Angeles'
    },
    {
        pinId: 'sample-3',
        fruitType: 'orange',
        fruitTypeDisplay: 'Orange',
        coordinates: { lat: 34.0558, lng: -118.3012 },
        submittedBy: 'sample',
        notes: 'Navel oranges, branches hang over the sidewalk.',
        zone: 10,
        address: 'Lincoln Heights, Los Angeles'
    },
    {
        pinId: 'sample-4',
        fruitType: 'avocado',
        fruitTypeDisplay: 'Avocado',
        coordinates: { lat: 34.0645, lng: -118.3085 },
        submittedBy: 'sample',
        notes: 'Tall Hass tree, fruit drops to the ground when ripe.',
        zone: 10,
        address: 'Silver Lake, Los Angeles'
    },
    {
        pinId: 'sample-5',
        fruitType: 'mulberry',
        fruitTypeDisplay: 'Mulberry',
        coordinates: { lat: 34.0724, lng: -118.2778 },
        submittedBy: 'sample',
        notes: 'White mulberry. Brings birds in spring.',
        zone: 10,
        address: 'El Sereno, Los Angeles'
    }
];

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
            editingNotes: '' // Temp storage for edited notes
        };
        this.mapRef = null; // Reference to map instance
        this.debounceTimer = null; // Timer for debouncing viewport changes
    }

    componentDidMount() {
        // Fetch pins on mount
        this.fetchPins();
    }

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
        // Clear cache when manually refreshing
        clearCache('allPins');
        this.setState({ loading: true });
        this.fetchPins(true); // Force refresh
    };

    // Toggle filtering to show only the current user's pins
    toggleMyPins = () => {
        this.setState(prevState => ({
            showMyPinsOnly: !prevState.showMyPinsOnly
        }));
    };

    // Handle viewport changes with debouncing
    handleViewportChange = (bounds) => {
        // Clear existing timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Set new timer - wait 500ms after user stops moving
        this.debounceTimer = setTimeout(() => {
            this.setState({ loading: true });
            this.fetchPins(false, bounds);
        }, 500);
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
        
        // Use sample pins when database is empty
        const displaySource = pins.length === 0 ? SAMPLE_PINS : pins;

        // Filter out test/demo pins from display
        const excludeWords = ['test', 'tests', 'demo', 'testing', 'user'];
        let filteredPins = displaySource.filter(pin => {
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
                    <MapContainer center={[34.061415, -118.293991]} zoom={13} scrollWheelZoom={true}>
                        <MapEvents 
                            onViewportChange={this.handleViewportChange} 
                            onZoomChange={this.handleZoomChange}
                        />
                        <TileLayer
                            attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                        />
                        {loading && (
                            <div className="loading-overlay">
                                Loading pins...
                            </div>
                        )}
                        {error && (
                            <div className="error-overlay">
                                {error}
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
                                            icon={clusterIcon}
                                        >
                                            <Popup>
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
                                let seasonBadge = null;
                                if (inSeason !== null) {
                                    if (inSeason) {
                                        seasonBadge = <div className="season-badge in-season">🟢 In season now!</div>;
                                    } else if (seasonMonths && seasonMonths.length > 0) {
                                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                                                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                        const seasonRange = seasonMonths.length > 6 
                                            ? 'Most of the year'
                                            : `${monthNames[seasonMonths[0]-1]} - ${monthNames[seasonMonths[seasonMonths.length-1]-1]}`;
                                        
                                        seasonBadge = <div className="season-badge upcoming">🔵 Coming soon: {seasonRange}</div>;
                                    } else {
                                        seasonBadge = <div className="season-badge out-of-season">⚪ Out of season</div>;
                                    }
                                } else {
                                    seasonBadge = <div className="season-badge general">📅 Typical: {generalSeason}</div>;
                                }
                                
                                return (
                                    <Marker 
                                        position={[pin.coordinates.lat, pin.coordinates.lng]} 
                                        key={pin.pinId}
                                        icon={markerIcon}
                                    >
                                        <Popup>
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
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}</span>
                                                        </div>
                                                    </div>
                                                    
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
