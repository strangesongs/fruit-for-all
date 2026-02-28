// Simple marker clustering utility
// Groups nearby markers into clusters to improve map performance

/**
 * Group pins into clusters based on zoom level and proximity
 * @param {Array} pins - Array of pin objects with coordinates
 * @param {Object} bounds - Map bounds {minLat, maxLat, minLng, maxLng}
 * @param {number} zoom - Current zoom level (1-18)
 * @returns {Array} Clustered pins with cluster information
 */
export function clusterPins(pins, bounds, zoom) {
  if (!pins || pins.length === 0) return [];
  
  // Don't cluster at high zoom levels (close up view)
  if (zoom >= 14) {
    return pins.map(pin => ({ ...pin, cluster: false, count: 1 }));
  }
  
  // Calculate grid size based on zoom level
  // Lower zoom = larger grid cells = more aggressive clustering
  const gridSize = getGridSize(zoom);
  
  // Create grid-based clusters
  const clusters = {};
  
  pins.forEach(pin => {
    const gridKey = getGridKey(pin.coordinates.lat, pin.coordinates.lng, gridSize);
    
    if (!clusters[gridKey]) {
      clusters[gridKey] = {
        pins: [],
        lat: 0,
        lng: 0
      };
    }
    
    clusters[gridKey].pins.push(pin);
    clusters[gridKey].lat += pin.coordinates.lat;
    clusters[gridKey].lng += pin.coordinates.lng;
  });
  
  // Convert clusters to array
  const result = [];
  
  Object.values(clusters).forEach(cluster => {
    const count = cluster.pins.length;
    
    if (count === 1) {
      // Single pin - no cluster
      result.push({
        ...cluster.pins[0],
        cluster: false,
        count: 1
      });
    } else {
      // Multiple pins - create cluster marker
      result.push({
        pinId: `cluster_${cluster.pins.map(p => p.pinId).join('_')}`,
        coordinates: {
          lat: cluster.lat / count,
          lng: cluster.lng / count
        },
        cluster: true,
        count: count,
        pins: cluster.pins,
        fruitTypeDisplay: `${count} pins`,
        submittedBy: 'multiple'
      });
    }
  });
  
  return result;
}

/**
 * Calculate grid size based on zoom level
 */
function getGridSize(zoom) {
  // Zoom levels: 1 (world) to 18 (street)
  // Grid size in degrees (smaller = less clustering, pins stay individual longer)
  const gridSizes = {
    1: 10,    // Continental - still cluster at world view
    2: 8,
    3: 5,
    4: 3,
    5: 2,
    6: 1,
    7: 0.5,
    8: 0.3,
    9: 0.15,  // City level - reduced from 1 to 0.15
    10: 0.08, // Reduced from 0.5 to 0.08
    11: 0.04, // Reduced from 0.3 to 0.04
    12: 0.02, // Reduced from 0.2 to 0.02
    13: 0.01, // Reduced from 0.1 to 0.01 (neighborhood)
    14: 0,    // Reduced from 0.05 to 0 (no cluster)
    15: 0,    // No clustering (street level)
  };
  
  return gridSizes[Math.floor(zoom)] || 0.05;
}

/**
 * Generate grid key for a coordinate at given grid size
 */
function getGridKey(lat, lng, gridSize) {
  if (gridSize === 0) return `${lat}_${lng}`;
  
  const latGrid = Math.floor(lat / gridSize);
  const lngGrid = Math.floor(lng / gridSize);
  
  return `${latGrid}_${lngGrid}`;
}
