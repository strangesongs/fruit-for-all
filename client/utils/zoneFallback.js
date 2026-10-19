// USDA hardiness zone estimate from lat/lng. Shared by the server (fallback when
// phzmapi.com is unreachable) and the client (season hints for empty map areas).
// Dependency-free, like fruitList.js.

/** Rough USDA zone for a point; tuned for the continental US. */
export function detectZoneFallback(lat, lng) {
  if (lat < 24 || lat > 49 || lng < -125 || lng > -66) {
    if (lat > 40) return 6;
    if (lat > 30) return 8;
    if (lat > 15) return 10;
    return 11;
  }
  if (lat < 25.5) return 11;
  if (lat < 28 && lng > -82) return 10;
  if (lat < 33 && lng < -117) return 10;
  if (lat < 34.3 && lng >= -119 && lng < -117.6) return 10; // Los Angeles basin (10a/10b)
  if (lat < 33 && lng >= -115 && lng < -109) return 10;
  if (lat < 37 && lng >= -117 && lng < -109) return 9;
  if (lng < -122) {
    if (lat < 34) return 10;
    if (lat < 39) return 9;
    if (lat < 49) return 8;
  }
  if (lat < 39 && lng >= -122 && lng < -118) return 9;
  if (lat < 31 && lng > -85) return 9;
  if (lat < 32 && lng > -97) return 9;
  if (lat < 36 && lng > -100) return 8;
  if (lat < 38 && lng > -95) return 8;
  if (lat < 38 && lng > -78) return 8;
  if (lat < 37 && lng > -109 && lng < -100) return 7;
  if (lat < 42 && lng > -120 && lng < -109) return 7;
  if (lat < 37 && lng > -100 && lng < -75) return 7;
  if (lat < 40 && lng > -80) return 7;
  if (lat < 42 && lng > -76) return 7;
  if (lat < 42 && lng > -95) return 6;
  if (lat < 44 && lng > -75) return 6;
  if (lat < 48 && lng > -118 && lng < -113) return 6;
  if (lat < 45) return 5;
  if (lat < 47) return 4;
  return 3;
}
