import * as db from '../schemas/schemas.js';
import { PinsQueryError } from '../schemas/errors.js';
import { escapeHtml } from '../utils/html.js';
import { containsProfanity } from '../utils/profanity.js';
import { isDuplicateConfirm, markConfirmed, isDuplicateReport, markReported } from '../utils/confirmDedup.js';
import crypto from 'crypto';
import { Resend } from 'resend';
import { logEmailResult } from '../utils/email.js';
import { createIpLocator, EMPTY_LOCATION } from '../utils/ipLocate.js';
import { FRUIT_LIST } from '../../client/utils/fruitList.js';
import { appUrl as emailBaseUrl } from '../utils/appUrl.js';
import { NUDGE_LIMIT_M, withinNudge } from '../../client/utils/findPlacement.js';
import { isPinId, findUrl, validateReport, reportReasonLabel, plainText } from '../../client/utils/findLinks.js';
import { findPageHtml } from '../utils/findPage.js';

const FRUIT_SET = new Set(FRUIT_LIST);
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function sendPinsError(res, err, logLabel) {
  if (err instanceof PinsQueryError) {
    console.error(`${logLabel} database failure:`, err.cause);
    return res
      .status(503)
      .json({ success: false, message: 'Map data is temporarily unavailable. Please try again.' });
  }
  return null;
}

/**
 * Admin rights come from the users table, not from the 7-day token, so a token
 * issued before an admin flag was removed can't keep using it.
 */
async function isCurrentAdmin(req) {
  if (!req.user?.isAdmin) return false;
  const user = await db.getUser(req.user.userName);
  return !!user?.isAdmin;
}

export const createPin = async (req, res) => {
  try {
    // Validate types before calling any string methods: a non-string field used to
    // throw outside the try block and crash the process.
    const check = db.validatePinInput(req.body, FRUIT_SET);
    if (!check.valid) {
      return res.status(400).json({ success: false, message: check.message });
    }
    const { coordinates, fruitType, notes } = req.body;
    const submittedBy = req.user.userName;
    if (containsProfanity(notes)) {
      return res.status(400).json({ success: false, message: 'Please keep notes family-friendly.' });
    }
    const pin = await db.createPin({
      coordinates,
      fruitType: fruitType.trim().toLowerCase(),
      notes: notes ? notes.trim() : '',
      submittedBy: submittedBy.trim(),
    });
    if (!pin) {
      return res.status(500).json({ success: false, message: 'Failed to create pin' });
    }
    res.json({ success: true, pin });
    const adminEmail = process.env.ADMIN_EMAIL;
    if (resend && adminEmail && process.env.PIN_NOTIFICATIONS === 'true') {
      const appUrl = emailBaseUrl();
      resend
        .emails.send({
          from: 'fruit for all <noreply@fruitforall.app>',
          to: adminEmail,
          subject: `new pin: ${plainText(pin.fruitTypeDisplay || fruitType)} by ${submittedBy}`,
          html: `
            <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #2a2420;">
              <h2 style="color: #5b3a5e;">new pin submitted</h2>
              <p><strong>fruit:</strong> ${escapeHtml(plainText(pin.fruitTypeDisplay || fruitType))}</p>
              <p><strong>submitted by:</strong> ${escapeHtml(submittedBy)}</p>
              <p><strong>coordinates:</strong> ${coordinates.lat}, ${coordinates.lng}</p>
              ${pin.notes ? `<p><strong>notes:</strong> ${escapeHtml(pin.notes)}</p>` : ''}
              <p><strong>time:</strong> ${new Date().toUTCString()}</p>
              <p style="margin-top: 24px;"><a href="${appUrl}" style="color: #5b3a5e;">fruitforall.app</a></p>
            </div>
          `,
        })
        .then(logEmailResult('Pin notification'))
        .catch((err) => console.error('[EMAIL] Pin notification failed:', err.message));
    }
  } catch (error) {
    console.error('Error in createPin controller:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const locateIp = createIpLocator();

export const getIpLocation = async (req, res) => {
  try {
    const location = await locateIp(req.ip);
    if (location.lat !== null) res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.json(location);
  } catch (e) {
    return res.json(EMPTY_LOCATION);
  }
};

// What anyone may see of a find: never who added it, never its reports.
export function toPublicPin(pin) {
  if (!pin) return null;
  // eslint-disable-next-line no-unused-vars
  const { submittedBy, reports, reportCount, ...rest } = pin;
  return rest;
}

// GET /api/pins/:pinId (public): one find, for a shared link.
export const getPublicPin = async (req, res) => {
  try {
    const { pinId } = req.params;
    if (!isPinId(pinId)) {
      return res.status(404).json({ success: false, message: 'No such find' });
    }
    const pin = await db.getPinById(pinId.toLowerCase());
    if (!pin) {
      return res.status(404).json({ success: false, message: 'No such find' });
    }
    res.setHeader('Cache-Control', 'no-cache');
    return res.json({ success: true, pin: toPublicPin(pin) });
  } catch (error) {
    if (sendPinsError(res, error, 'getPublicPin')) return;
    console.error('Error in getPublicPin controller:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * GET /find/:pinId: the app, with this find's title and link-preview tags.
 * `readIndex()` returns dist/index.html. A find that's gone still gets the app
 * (it says so) with a 404, so link previews and crawlers don't keep it.
 */
export function makeFindPage(readIndex) {
  return async (req, res) => {
    let template;
    try {
      template = readIndex();
    } catch (e) {
      console.error('[find-page] no dist/index.html:', e.message);
      return res.status(503).send('fruit for all is starting up. try again in a moment.');
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html');
    const { pinId } = req.params;
    if (!isPinId(pinId)) return res.status(404).send(template);
    try {
      const pin = await db.getPinById(pinId.toLowerCase());
      if (!pin) return res.status(404).send(template);
      return res.send(findPageHtml(template, toPublicPin(pin), { baseUrl: emailBaseUrl() }));
    } catch (error) {
      // The database is down: serve the plain app; it fetches the find itself.
      console.error('[find-page] could not read the find:', error.cause || error);
      return res.send(template);
    }
  };
}

// POST /api/pins/:pinId/report (public): { reason, note? }. One per find per IP per
// day. Stored on the pin and emailed to the admin; the find stays up.
export const reportPin = async (req, res) => {
  try {
    const { pinId } = req.params;
    if (!isPinId(pinId)) {
      return res.status(404).json({ success: false, message: 'No such find' });
    }
    const check = validateReport(req.body);
    if (!check.valid) {
      return res.status(400).json({ success: false, message: check.message });
    }
    const { reason, note } = check.report;
    const ip = req.ip ?? '127.0.0.1';
    const store = req.redisClient ?? null;
    const id = pinId.toLowerCase();
    if (await isDuplicateReport(store, id, ip)) {
      return res.status(409).json({ success: false, message: 'You already reported this find today. Thank you.' });
    }
    const pin = await db.getPinById(id, { withReports: true });
    if (!pin) {
      return res.status(404).json({ success: false, message: 'No such find' });
    }
    const { stored } = await db.reportPin(pin, { reason, note });
    await markReported(store, id, ip);
    res.json({ success: true });

    const adminEmail = process.env.ADMIN_EMAIL;
    if (resend && adminEmail) {
      const kind = plainText(pin.fruitTypeDisplay || pin.fruitType || 'find').toLowerCase();
      const link = findUrl(emailBaseUrl(), pin.pinId);
      resend.emails
        .send({
          from: 'fruit for all <noreply@fruitforall.app>',
          to: adminEmail,
          subject: `report: ${kind}, ${reportReasonLabel(reason)}`,
          html: `
            <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #2a2420;">
              <h2 style="color: #5b3a5e;">a find was reported</h2>
              <p><strong>find:</strong> ${escapeHtml(kind)}</p>
              <p><strong>what's wrong:</strong> ${escapeHtml(reportReasonLabel(reason))}</p>
              ${note ? `<p><strong>note:</strong> ${escapeHtml(note)}</p>` : ''}
              <p><strong>added by:</strong> ${escapeHtml(pin.submittedBy || 'unknown')}</p>
              <p><strong>reports so far:</strong> ${(pin.reportCount || 0) + (stored ? 1 : 0)}${stored ? '' : ' (list full: this one was not stored)'}</p>
              <p>the find is still on the map. to remove it, open it and delete it.</p>
              <p style="margin-top: 24px;"><a href="${escapeHtml(link)}" style="color: #5b3a5e;">open the find</a></p>
            </div>
          `,
        })
        .then(logEmailResult('Report notification'))
        .catch((err) => console.error('[EMAIL] Report notification failed:', err.message));
    }
  } catch (error) {
    if (res.headersSent) return;
    if (sendPinsError(res, error, 'reportPin')) return;
    console.error('Error in reportPin controller:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getPublicPins = async (req, res) => {
  try {
    const { minLat, maxLat, minLng, maxLng, limit, cursor } = req.query;
    const parsedLimit = Math.min(limit ? (parseInt(limit, 10) || 200) : 200, 500);
    const bounds =
      minLat && maxLat && minLng && maxLng
        ? {
            minLat: parseFloat(minLat),
            maxLat: parseFloat(maxLat),
            minLng: parseFloat(minLng),
            maxLng: parseFloat(maxLng),
          }
        : null;
    const result = await db.getAllPins({ limit: parsedLimit, cursor, bounds });
    const publicPins = result.pins.map(toPublicPin);
    if (bounds) {
      res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
    res.json({
      success: true,
      pins: publicPins,
      cursor: result.cursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    if (sendPinsError(res, error, 'getPublicPins')) return;
    console.error('Error in getPublicPins controller:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getAllPins = async (req, res) => {
  try {
    const { limit, cursor, submittedBy, minLat, maxLat, minLng, maxLng } = req.query;
    const parsedLimit = Math.min(limit ? parseInt(limit, 10) || 1000 : 1000, 5000);
    const bounds =
      minLat && maxLat && minLng && maxLng
        ? {
            minLat: parseFloat(minLat),
            maxLat: parseFloat(maxLat),
            minLng: parseFloat(minLng),
            maxLng: parseFloat(maxLng),
          }
        : null;
    const result = await db.getAllPins({
      limit: parsedLimit,
      cursor,
      submittedBy,
      bounds,
    });
    const dataString = JSON.stringify(result.pins);
    const etag = `"${crypto.createHash('md5').update(dataString).digest('hex')}"`;
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.json({
      success: true,
      pins: result.pins,
      cursor: result.cursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    if (sendPinsError(res, error, 'getAllPins')) return;
    console.error('Error in getAllPins controller:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getMyPins = async (req, res) => {
  try {
    const { limit, cursor } = req.query;
    const parsedLimit = limit ? parseInt(limit, 10) : 100;
    const result = await db.getAllPins({
      limit: parsedLimit,
      cursor,
      submittedBy: req.user.userName,
    });
    res.json({
      success: true,
      pins: result.pins,
      cursor: result.cursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    if (sendPinsError(res, error, 'getMyPins')) return;
    console.error('Error in getMyPins controller:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updatePin = async (req, res) => {
  try {
    const { pinId } = req.params;
    // Types first: string methods below must never meet a number or an object.
    const check = db.validatePinUpdate(req.body, FRUIT_SET);
    if (!check.valid) {
      return res.status(400).json({ success: false, message: check.message });
    }
    const { notes, fruitType, coordinates } = req.body;
    const pin = await db.getPinById(pinId);
    if (!pin) {
      return res.status(404).json({ success: false, message: 'Pin not found' });
    }
    const isOwner = pin.submittedBy === req.user.userName;
    // Admin is checked lazily: owners only need it to move a find further than a block.
    let admin = null;
    const checkAdmin = async () => {
      if (admin === null) admin = await isCurrentAdmin(req);
      return admin;
    };
    if (!isOwner && !(await checkAdmin())) {
      return res.status(403).json({
        success: false,
        message: 'Only admin or pin owner can edit this pin',
      });
    }
    if (notes !== undefined && containsProfanity(notes)) {
      return res.status(400).json({ success: false, message: 'Please keep notes family-friendly.' });
    }
    if (coordinates !== undefined && pin.coordinates
      && !withinNudge(pin.coordinates, coordinates) && !(await checkAdmin())) {
      return res.status(400).json({
        success: false,
        message: `A find can only move about ${NUDGE_LIMIT_M} m. Delete it and add it again to move it further.`,
      });
    }
    const updates = {};
    if (notes !== undefined) updates.notes = db.sanitizeString(notes || '');
    if (fruitType !== undefined) updates.fruitType = fruitType.trim().toLowerCase();
    if (coordinates !== undefined) updates.coordinates = { lat: coordinates.lat, lng: coordinates.lng };
    const updatedPin = await db.updatePin(pinId, updates);
    res.json({ success: true, message: 'Pin updated successfully', pin: updatedPin });
  } catch (error) {
    console.error('Error in updatePin controller:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const confirmPin = async (req, res) => {
  try {
    const { pinId } = req.params;
    if (!pinId || typeof pinId !== 'string' || pinId.length > 64) {
      return res.status(400).json({ success: false, message: 'Invalid pin ID' });
    }

    const ip = req.ip ?? '127.0.0.1';
    const redisClient = req.redisClient ?? null;

    if (await isDuplicateConfirm(redisClient, pinId, ip)) {
      return res.status(409).json({ success: false, message: 'Already confirmed recently' });
    }

    const updatedPin = await db.confirmPin(pinId);
    if (!updatedPin) {
      return res.status(404).json({ success: false, message: 'Pin not found' });
    }

    await markConfirmed(redisClient, pinId, ip);

    res.json({ success: true, confirmations: updatedPin.confirmations });
  } catch (error) {
    console.error('Error in confirmPin controller:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deletePin = async (req, res) => {
  try {
    const { pinId } = req.params;
    const pin = await db.getPinById(pinId);
    if (!pin) {
      return res.status(404).json({ success: false, message: 'Pin not found' });
    }
    const isOwner = pin.submittedBy === req.user.userName;
    if (!isOwner && !(await isCurrentAdmin(req))) {
      return res.status(403).json({
        success: false,
        message: 'Only admin or pin owner can delete this pin',
      });
    }
    await db.deletePin(pinId);
    res.json({ success: true, message: 'Pin deleted successfully' });
  } catch (error) {
    console.error('Error in deletePin controller:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
