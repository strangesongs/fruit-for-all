/**
 * WRITES_PAUSED=true: a few minutes with no writes while the data moves to
 * Postgres (the cutover runbook, docs/POSTGRES_CUTOVER.md). Browsing, shared
 * links and signing in keep working; anything that would write answers 503,
 * which the app shows in place ("try again in a few minutes").
 */
export const PAUSE_MESSAGE =
  'fruit for all is moving to a new home for a few minutes. try again shortly.';

// Signing in still works: it only records the login time, best-effort.
const ALLOWED_WRITES = new Set(['POST /api/auth/login']);

export function isPausedWrite(method, path) {
  const m = String(method || '').toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return false;
  if (!String(path || '').startsWith('/api/')) return false;
  return !ALLOWED_WRITES.has(`${m} ${path.replace(/\/+$/, '')}`);
}

export function writePause({ paused = process.env.WRITES_PAUSED === 'true' } = {}) {
  return (req, res, next) => {
    if (!paused || !isPausedWrite(req.method, req.path)) return next();
    res.set('Retry-After', '300');
    return res.status(503).json({ success: false, paused: true, message: PAUSE_MESSAGE });
  };
}
