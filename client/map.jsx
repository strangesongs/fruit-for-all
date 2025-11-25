import React, { Component } from 'react';
import { render } from 'react-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import { getAuthHeader, isAuthenticated, getUser } from './utils/auth.js';
import { getCache, setCache, clearCache } from './utils/cache.js';
import { clusterPins } from './utils/clustering.js';
import { getSeasonForZone, isInSeason, getSeasonDisplay } from './utils/fruitSeasons.js';
import L from 'leaflet';

import './stylesheets/map.css';
import './stylesheets/sidebar.css'

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
            highlightMyPins: false,
            etag: null, // Store ETag for conditional requests
            zoom: 13, // Current zoom level
            fruitFilter: 'all' // Filter for fruit types
        };
        this.mapRef = null; // Reference to map instance
        this.debounceTimer = null; // Timer for debouncing viewport changes
    }

    componentDidMount() {
        // Only fetch pins if authenticated
        if (isAuthenticated()) {
            this.fetchPins();
        } else {
            this.setState({ loading: false });
        }
    }

    fetchPins = async (forceRefresh = false, bounds = null) => {
        // Don't fetch if not authenticated
        if (!isAuthenticated()) {
            this.setState({ 
                pins: [], 
                loading: false,
                error: null 
            });
            return;
        }

        // Create cache key based on bounds if provided
        const cacheKey = bounds 
            ? `pins_${bounds.minLat}_${bounds.maxLat}_${bounds.minLng}_${bounds.maxLng}`
            : 'allPins';

        // Check cache first (unless force refresh)
        if (!forceRefresh) {
            const cachedPins = getCache(cacheKey);
            if (cachedPins) {
                console.log('Loading pins from cache');
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
            let url = 'http://localhost:8080/api/pins';
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
                console.log('Pins not modified, using cached data');
                const cachedPins = getCache('allPins');
                if (cachedPins) {
                    this.setState({ loading: false });
                    return;
                }
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
                    etag: newEtag
                });
            } else {
                console.error('Failed to fetch pins:', result.message);
                this.setState({ 
                    error: 'Failed to load pins', 
                    loading: false 
                });
            }
        } catch (error) {
            console.error('Error fetching pins:', error);
            this.setState({ 
                error: 'Error loading pins', 
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

    // Toggle highlighting of user's pins
    toggleMyPins = () => {
        this.setState(prevState => ({
            highlightMyPins: !prevState.highlightMyPins
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
            console.log('Viewport changed, loading pins for bounds:', bounds);
            this.setState({ loading: true });
            this.fetchPins(false, bounds);
        }, 500);
    };

    // Handle zoom changes
    handleZoomChange = (zoom) => {
        console.log('Zoom changed to:', zoom);
        this.setState({ zoom });
    };

    // Delete a pin
    deletePin = async (pinId) => {
        if (!confirm('Are you sure you want to delete this pin?')) {
            return;
        }

        try {
            const response = await fetch(`http://localhost:8080/api/pins/${pinId}`, {
                method: 'DELETE',
                headers: getAuthHeader()
            });

            const result = await response.json();

            if (result.success) {
                alert('Pin deleted successfully!');
                // Refresh pins to remove deleted one
                this.fetchPins(true);
            } else {
                alert('Error deleting pin: ' + result.message);
            }
        } catch (error) {
            console.error('Error deleting pin:', error);
            alert('Error deleting pin. Please try again.');
        }
    };

    render() {
        const { pins, loading, error, highlightMyPins, zoom, fruitFilter } = this.state;
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
        
        // Apply clustering based on zoom level
        const bounds = { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 };
        const displayPins = clusterPins(filteredPins, bounds, zoom);

        return (
            <div className='mapAndSidebar'>
                <div className='mapContainer'>
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
                                const markerIcon = (highlightMyPins && isMyPin) ? myPinIcon : defaultIcon;
                                
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
                                                    {pin.notes && (
                                                        <div className="notes-section">
                                                            <strong>notes:</strong>
                                                            <p className="pin-notes">{pin.notes}</p>
                                                        </div>
                                                    )}
                                                    
                                                    <div className="metadata-grid">
                                                        <div className="metadata-item">
                                                            <strong>location:</strong>
                                                            <span>{pin.coordinates.lat.toFixed(6)}, {pin.coordinates.lng.toFixed(6)}</span>
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
                                                    
                                                    {/* Delete button - only show if current user owns this pin */}
                                                    {isMyPin && (
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
            </div>
        );
    }

}

export default Map;
