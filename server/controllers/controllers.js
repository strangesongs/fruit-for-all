
import * as db from '../schemas/schemas.js';
import { containsProfanity } from '../utils/profanity.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Resend } from 'resend';
import { FRUIT_LIST } from '../../client/utils/fruitList.js';

const FRUIT_SET = new Set(FRUIT_LIST);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const controller = {};

// JWT secret - MUST be set in production
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

// Validate JWT_SECRET exists in production
if (process.env.NODE_ENV === 'production' && !JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is not set.');
  console.error('Generate a secure secret with: openssl rand -base64 32');
  process.exit(1);
}

// Use default only in development
const JWT_SECRET_FINAL = JWT_SECRET || 'loquat-dev-secret-ONLY-FOR-DEVELOPMENT';

if (!JWT_SECRET && process.env.NODE_ENV !== 'production') {
  console.warn('⚠️  WARNING: Using default JWT_SECRET. Set JWT_SECRET environment variable for production.');
}

// Helper function to generate JWT token
function generateToken(user) {
  return jwt.sign(
    { 
      userName: user.userName, 
      email: user.email,
      isAdmin: user.isAdmin || false,
      iat: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET_FINAL,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Middleware to verify JWT token
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. No token provided.' 
    });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET_FINAL);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token.' 
    });
  }
}

// User registration
controller.registerUser = async (req, res) => {
  try {
    const { userName, password, email } = req.body;
    
    // Create user (includes validation and password hashing)
    const user = await db.createUser({ userName, password, email });
    
    // Generate JWT token
    const token = generateToken(user);

    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    // Send welcome email to new user
    if (resend) {
      resend.emails.send({
        from: 'fruit for all <noreply@fruitforall.app>',
        to: email,
        subject: 'welcome to fruit for all',
        html: `
          <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #333;">
            <h2 style="color: #C23939; margin-bottom: 4px;">fruit for all</h2>
            <p style="color: #666; font-size: 0.85rem; margin-top: 0;">open source orchard</p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
            <p>welcome to fruit for all, your open source orchard.</p>
            <p>fruit for all is a community-built, user-submitted map of free street fruit in your area. find it, pick it, share it.</p>
            <p>you can only add fruit when it's right under your nose &mdash; hit the &lsquo;add fruit&rsquo; button to pull your geolocation and log fruit to the map.</p>
            <p>anyone using fruit for all will be able to see fruit you've shared, so make sure it's ok for other users to forage that fruit (i.e. don't share fruit in a private backyard or locked away behind a gate).</p>
            <p>check out our code at <a href="https://github.com/strangesongs/fruit-for-all" style="color: #D84747;">github.com/strangesongs/fruit-for-all</a> and feel free to submit issues, feature requests and fixes.</p>
            <p>please reach out with any questions to <a href="mailto:admin@fruitforall.app" style="color: #D84747;">admin@fruitforall.app</a></p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${appUrl}" style="background: #D84747; color: white; padding: 12px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">open the map</a>
            </div>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
            <p style="font-size: 0.8rem; color: #bbb; text-align: center;">
              <img src="${appUrl}/loquat-48.png" alt="fruit for all" width="32" height="32" style="display: block; margin: 0 auto 8px auto;" />
              <a href="${appUrl}" style="color: #D84747;">fruitforall.app</a>
            </p>
          </div>
        `
      }).catch(err => console.error('[EMAIL] Welcome email failed:', err.message));
    }

    // Send admin notification
    const adminEmail = process.env.ADMIN_EMAIL;
    if (resend && adminEmail) {
      resend.emails.send({
        from: 'fruit for all <noreply@fruitforall.app>',
        to: adminEmail,
        subject: `new user: ${userName}`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #333;">
            <h2 style="color: #C23939;">new registration</h2>
            <p><strong>username:</strong> ${userName}</p>
            <p><strong>email:</strong> ${email}</p>
            <p><strong>time:</strong> ${new Date().toUTCString()}</p>
            <p style="margin-top: 24px;"><a href="${appUrl}" style="color: #D84747;">fruitforall.app</a></p>
          </div>
        `
      }).catch(err => console.error('[EMAIL] Admin notification failed:', err.message));
    }
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        userName: user.userName,
        email: user.email,
        createdAt: user.createdAt
      },
      token
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// User login
controller.loginUser = async (req, res) => {
  try {
    const { userName, password } = req.body;
    
    // Verify user credentials
    const user = await db.verifyUser(userName, password);
    
    // Generate JWT token
    const token = generateToken(user);
    
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        userName: user.userName,
        email: user.email,
        lastLogin: user.lastLogin,
        isAdmin: user.isAdmin || false
      },
      token
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error.message
    });
  }
};

// Get current user info (requires authentication)
controller.getCurrentUser = async (req, res) => {
  try {
    // req.user is set by verifyToken middleware
    const user = await db.getUser(req.user.userName);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      user: {
        userName: user.userName,
        email: user.email,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user data'
    });
  }
};

// Save pins for user
controller.saveButton = async (req, res) => {
  const { userName, pins } = req.body;
  let user = await db.getUser(userName);
  if (!user) {
    user = { userName, savedPins: [] };
  }
  user.savedPins = pins;
  await db.saveUser(user);
  res.json({ success: true });
};

// Create a new pin (requires authentication)
controller.createPin = async (req, res) => {
  const { coordinates, fruitType, notes } = req.body;
  
  // submittedBy comes from authenticated user
  const submittedBy = req.user.userName;
  
  // Validate required fields
  if (!coordinates || !coordinates.lat || !coordinates.lng || !fruitType) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required fields: coordinates and fruitType are required' 
    });
  }

  // Validate coordinates are numbers
  if (typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
    return res.status(400).json({ 
      success: false, 
      message: 'Coordinates must be numbers' 
    });
  }

  // Validate fruitType is from the approved list
  if (!FRUIT_SET.has(fruitType.trim().toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: 'Invalid fruit type. Please select from the approved list.'
    });
  }

  // Validate notes length (max 500 words)
  if (notes && notes.split(' ').length > 500) {
    return res.status(400).json({ 
      success: false, 
      message: 'Notes cannot exceed 500 words' 
    });
  }

  // Profanity check
  if (containsProfanity(notes)) {
    return res.status(400).json({
      success: false,
      message: 'Please keep notes family-friendly.'
    });
  }

  try {
    const pin = await db.createPin({
      coordinates,
      fruitType: fruitType.trim().toLowerCase(),
      notes: notes ? notes.trim() : '',
      submittedBy: submittedBy.trim()
    });

    if (pin) {
      res.json({ success: true, pin });
    } else {
      res.status(500).json({ success: false, message: 'Failed to create pin' });
    }
  } catch (error) {
    console.error('Error in createPin controller:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get a sample of pins for unauthenticated (public) visitors
controller.getPublicPins = async (req, res) => {
  try {
    const result = await db.getAllPins({ limit: 100 });
    // Strip submittedBy to avoid exposing usernames publicly
    const publicPins = result.pins.map(({ submittedBy, ...pin }) => pin);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ success: true, pins: publicPins });
  } catch (error) {
    console.error('Error in getPublicPins controller:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get all pins (requires authentication)
controller.getAllPins = async (req, res) => {
  try {
    const { limit, cursor, submittedBy, minLat, maxLat, minLng, maxLng } = req.query;
    const parsedLimit = limit ? parseInt(limit) : 1000; // Increased default for viewport filtering
    
    // Parse bounds if provided
    const bounds = (minLat && maxLat && minLng && maxLng) ? {
      minLat: parseFloat(minLat),
      maxLat: parseFloat(maxLat),
      minLng: parseFloat(minLng),
      maxLng: parseFloat(maxLng)
    } : null;
    
    // Get pins with optional pagination, filtering, and bounds
    const result = await db.getAllPins({
      limit: parsedLimit,
      cursor,
      submittedBy, // Filter by user if provided
      bounds // Filter by viewport bounds if provided
    });
    
    // Generate ETag based on pins data
    const dataString = JSON.stringify(result.pins);
    const etag = `"${crypto.createHash('md5').update(dataString).digest('hex')}"`;
    
    // Check if client's ETag matches (304 Not Modified)
    const clientEtag = req.headers['if-none-match'];
    if (clientEtag === etag) {
      return res.status(304).end();
    }
    
    // Set ETag header
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minutes
    
    res.json({ 
      success: true, 
      pins: result.pins,
      cursor: result.cursor, // Next page cursor
      hasMore: result.hasMore // Whether more pages exist
    });
  } catch (error) {
    console.error('Error in getAllPins controller:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get current user's pins only
controller.getMyPins = async (req, res) => {
  try {
    const { limit, cursor } = req.query;
    const parsedLimit = limit ? parseInt(limit) : 100;
    
    // Use backend filtering instead of frontend filter
    const result = await db.getAllPins({
      limit: parsedLimit,
      cursor,
      submittedBy: req.user.userName
    });
    
    res.json({ 
      success: true, 
      pins: result.pins,
      cursor: result.cursor,
      hasMore: result.hasMore
    });
  } catch (error) {
    console.error('Error in getMyPins controller:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Delete user's own pin
controller.updatePin = async (req, res) => {
  try {
    const { pinId } = req.params;
    const { notes } = req.body;
    
    // Verify pin exists
    const pin = await db.getPinById(pinId);
    if (!pin) {
      return res.status(404).json({
        success: false,
        message: 'Pin not found'
      });
    }
    
    // Check if user is admin or owner
    const isAdmin = req.user.isAdmin || false;
    const isOwner = pin.submittedBy === req.user.userName;
    
    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Only admin or pin owner can edit this pin'
      });
    }
    
    // Profanity check
    if (containsProfanity(notes)) {
      return res.status(400).json({
        success: false,
        message: 'Please keep notes family-friendly.'
      });
    }

    // Update the pin with new notes
    const updatedPin = await db.updatePin(pinId, { notes: notes || '' });
    
    res.json({
      success: true,
      message: 'Pin updated successfully',
      pin: updatedPin
    });
  } catch (error) {
    console.error('Error in updatePin controller:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

controller.deletePin = async (req, res) => {
  try {
    const { pinId } = req.params;
    
    // First verify the pin exists
    const pin = await db.getPinById(pinId);
    if (!pin) {
      return res.status(404).json({
        success: false,
        message: 'Pin not found'
      });
    }
    
    // Check if user is admin or owner
    const isAdmin = req.user.isAdmin || false;
    const isOwner = pin.submittedBy === req.user.userName;
    
    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Only admin or pin owner can delete this pin'
      });
    }
    
    // Delete the pin
    await db.deletePin(pinId);
    
    res.json({
      success: true,
      message: 'Pin deleted successfully'
    });
  } catch (error) {
    console.error('Error in deletePin controller:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

// Request password reset — sends email with reset link
controller.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const { userName, token } = await db.requestPasswordReset(email);

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    if (resend) {
      await resend.emails.send({
        from: 'fruit for all <noreply@fruitforall.app>',
        to: email,
        subject: 'reset your fruit for all password',
        html: `
          <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #333;">
            <h2 style="color: #C23939; margin-bottom: 4px;">fruit for all</h2>
            <p style="color: #666; font-size: 0.85rem; margin-top: 0;">open source orchard</p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
            <p>hi ${userName},</p>
            <p>we received a request to reset your password. click the button below to set a new one &mdash; this link expires in 1 hour.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="background: #D84747; color: white; padding: 12px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">reset password</a>
            </div>
            <p style="font-size: 0.85rem; color: #999;">if you didn't request this, you can safely ignore this email. your password won't change.</p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
            <p style="font-size: 0.8rem; color: #bbb; text-align: center;">
              <img src="${appUrl}/loquat-48.png" alt="fruit for all" width="32" height="32" style="display: block; margin: 0 auto 8px auto;" />
              <a href="${appUrl}" style="color: #D84747;">fruitforall.app</a>
            </p>
          </div>
        `
      });
    } else {
      console.log(`[RESET DEV] Password reset URL for ${userName}: ${resetUrl}`);
    }

    res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  } catch (error) {
    // Log real error internally but return generic success to client
    console.error('[RESET] forgotPassword error:', error.message);
    res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  }
};

// Complete password reset — validates token and sets new password
controller.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }

    const { userName } = await db.resetPassword(token, password);
    res.json({ success: true, message: 'Password updated successfully', userName });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Export the middleware for use in routes
controller.verifyToken = verifyToken;

export default controller;
