// USDA Hardiness Zone Detection
// Simplified latitude-based approximation for continental US
// For production, consider using geospatial boundaries or API

/**
 * Detect USDA hardiness zone from coordinates
 * Uses simplified latitude-based approximation for US
 * @param {number} lat - Latitude (-90 to 90)
 * @param {number} lng - Longitude (-180 to 180)
 * @returns {number} USDA zone (1-13)
 */
export function detectZone(lat, lng) {
  // Default to zone 9 if outside continental US bounds
  if (lat < 24 || lat > 49 || lng < -125 || lng > -66) {
    // Simplified international fallback
    if (lat > 40) return 6;        // Northern latitudes
    if (lat > 30) return 8;        // Temperate
    if (lat > 15) return 10;       // Subtropical
    return 11;                     // Tropical
  }
  
  // Continental US approximation (latitude-based with regional adjustments)
  
  // Zone 10-11: Southern Florida, Southern California coast, Hawaii
  if (lat < 28 && lng > -82) return 10;  // South Florida
  if (lat < 33 && lng < -117) return 10; // San Diego area
  
  // Zone 9: Northern Florida, Gulf Coast, Southern California
  if (lat < 31 && lng > -85) return 9;   // Florida panhandle, Gulf
  if (lat < 35 && lng < -116) return 9;  // Southern California inland
  
  // Zone 8: Southern states, Pacific Northwest coast, Mid-Atlantic
  if (lat < 33 && lng > -100) return 8;  // Deep South
  if (lat < 38 && lng > -95) return 8;   // Southern states
  if (lat < 45 && lng < -120) return 8;  // Pacific Northwest coast
  if (lat < 38 && lng > -78) return 8;   // Mid-Atlantic coast
  
  // Zone 7: Transition zone - lower Midwest, mid-Atlantic
  if (lat < 37 && lng > -100 && lng < -75) return 7;
  if (lat < 40 && lng > -80) return 7;   // Mid-Atlantic inland
  
  // Zone 6: Upper Midwest, Northeast, mountain west
  if (lat < 42 && lng > -95) return 6;   // Midwest
  if (lat < 44 && lng > -75) return 6;   // Northeast
  
  // Zone 5: Northern states
  if (lat < 45) return 5;
  
  // Zone 4: Very northern states
  if (lat < 47) return 4;
  
  // Zone 3 and below: Extreme northern areas
  return 3;
}

/**
 * Get zone name/description
 * @param {number} zone - USDA zone number
 * @returns {string}
 */
export function getZoneName(zone) {
  const zoneNames = {
    1: "Zone 1 (Arctic)",
    2: "Zone 2 (Subarctic)",
    3: "Zone 3 (Northern)",
    4: "Zone 4 (Cold)",
    5: "Zone 5 (Cool)",
    6: "Zone 6 (Temperate)",
    7: "Zone 7 (Mild)",
    8: "Zone 8 (Warm)",
    9: "Zone 9 (Subtropical)",
    10: "Zone 10 (Tropical)",
    11: "Zone 11 (Tropical)",
    12: "Zone 12 (Equatorial)",
    13: "Zone 13 (Equatorial)"
  };
  
  return zoneNames[zone] || `Zone ${zone}`;
}

/**
 * Get zone information including temperature range
 * @param {number} zone - USDA zone number
 * @returns {object}
 */
export function getZoneInfo(zone) {
  const zoneData = {
    1: { minTemp: "Below -50°F", description: "Arctic climates" },
    2: { minTemp: "-50°F to -40°F", description: "Subarctic climates" },
    3: { minTemp: "-40°F to -30°F", description: "Very cold winters" },
    4: { minTemp: "-30°F to -20°F", description: "Cold winters" },
    5: { minTemp: "-20°F to -10°F", description: "Cool climate" },
    6: { minTemp: "-10°F to 0°F", description: "Temperate climate" },
    7: { minTemp: "0°F to 10°F", description: "Mild climate" },
    8: { minTemp: "10°F to 20°F", description: "Warm temperate" },
    9: { minTemp: "20°F to 30°F", description: "Subtropical" },
    10: { minTemp: "30°F to 40°F", description: "Tropical" },
    11: { minTemp: "Above 40°F", description: "Tropical - frost-free" },
    12: { minTemp: "Above 50°F", description: "Equatorial" },
    13: { minTemp: "Above 60°F", description: "Equatorial - always warm" }
  };
  
  return zoneData[zone] || { minTemp: "Unknown", description: "Unknown zone" };
}
