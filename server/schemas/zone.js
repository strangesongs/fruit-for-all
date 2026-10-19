// USDA hardiness zone (1–13) for seasonal UI — phzmapi first, then local heuristic.
import { detectZoneFallback } from '../../client/utils/zoneFallback.js';

export { detectZoneFallback };
export async function detectZone(lat, lng) {
  try {
    const url = `https://phzmapi.com/${lat}/${lng}.json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      const z = parseInt(data.zone, 10);
      if (z >= 1 && z <= 13) return z;
    }
  } catch {
    // timeout, network, or bad response
  }
  return detectZoneFallback(lat, lng);
}
