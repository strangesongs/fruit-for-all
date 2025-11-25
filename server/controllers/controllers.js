
import * as db from '../schemas/schemas.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const controller = {};

// JWT secret - MUST be set in production
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '1h';

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
        lastLogin: user.lastLogin
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

  // Validate notes length (max 500 words)
  if (notes && notes.split(' ').length > 500) {
    return res.status(400).json({ 
      success: false, 
      message: 'Notes cannot exceed 500 words' 
    });
  }

  try {
    const pin = await db.createPin({
      coordinates,
      fruitType: fruitType.trim(),
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
controller.deletePin = async (req, res) => {
  try {
    const { pinId } = req.params;
    
    // First verify the pin exists and belongs to the user
    const pin = await db.getPinById(pinId);
    if (!pin) {
      return res.status(404).json({
        success: false,
        message: 'Pin not found'
      });
    }
    
    if (pin.submittedBy !== req.user.userName) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own pins'
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

// Export the middleware for use in routes
controller.verifyToken = verifyToken;

export default controller;
