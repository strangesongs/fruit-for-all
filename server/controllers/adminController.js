/**
 * /api/admin/*: the command center. Every route runs verifyToken → requireAdmin
 * → wrap(handler). Anyone who isn't an admin gets the same 404 as an unknown
 * route, so the routes don't advertise themselves. Responses are never cached:
 * they can name who added a find (public responses never do). No emails.
 */
import * as db from '../schemas/schemas.js';
import { AdminUnavailableError, PinsQueryError, UsersQueryError } from '../schemas/errors.js';

const notFound = (res) => res.status(404).json({ success: false, message: 'Not found' });

/** Admin rights come from the users table on every request, not just the 7-day token. */
export async function requireAdmin(req, res, next) {
  try {
    if (!req.user?.isAdmin) return notFound(res);
    const user = await db.getUser(req.user.userName);
    if (!user?.isAdmin) return notFound(res);
    res.setHeader('Cache-Control', 'no-store');
    return next();
  } catch (error) {
    return sendAdminError(res, error, 'requireAdmin');
  }
}

function sendAdminError(res, error, label) {
  if (res.headersSent) return undefined;
  if (error instanceof AdminUnavailableError) {
    return res.status(503).json({ success: false, message: 'The command center needs the Postgres database.' });
  }
  if (error instanceof PinsQueryError || error instanceof UsersQueryError) {
    console.error(`${label} database failure:`, error.cause || error.message);
    return res.status(503).json({ success: false, message: 'The database is unavailable. Try again in a moment.' });
  }
  console.error(`Error in ${label}:`, error);
  return res.status(500).json({ success: false, message: 'Internal server error' });
}

// GET /api/admin/summary: counts only (the sidebar's "command center · 3 reports").
export const getAdminSummary = async (req, res) => {
  try {
    res.json({ success: true, counts: await db.getAdminSummary() });
  } catch (error) {
    sendAdminError(res, error, 'getAdminSummary');
  }
};

// GET /api/admin/overview: everything the page shows.
export const getAdminOverview = async (req, res) => {
  try {
    res.json({ success: true, ...(await db.getAdminOverview()) });
  } catch (error) {
    sendAdminError(res, error, 'getAdminOverview');
  }
};

/** A write: (id, { by }) → true, or false when there's nothing to act on (404). */
function action(fn, param, label, gone) {
  return async (req, res) => {
    try {
      const id = req.params[param];
      if (typeof id !== 'string' || id.length > 64) return res.status(404).json({ success: false, message: gone });
      const done = await fn(id.toLowerCase(), { by: req.user.userName });
      if (!done) return res.status(404).json({ success: false, message: gone });
      return res.json({ success: true, counts: await db.getAdminSummary() });
    } catch (error) {
      return sendAdminError(res, error, label);
    }
  };
}

// POST /api/admin/reports/:reportId/handle: "handled, it's fine" (the find stays).
export const handleReport = action((id, o) => db.handleReport(id, o), 'reportId', 'handleReport', 'No such open report');
// POST /api/admin/pins/:pinId/hide | /restore | /still-there
export const hidePin = action((id, o) => db.hidePin(id, o), 'pinId', 'hidePin', 'No such find on the map');
export const restorePin = action((id, o) => db.restorePin(id, o), 'pinId', 'restorePin', 'No such hidden find');
export const markStillThere = action((id, o) => db.markStillThere(id, o), 'pinId', 'markStillThere', 'No such find on the map');
