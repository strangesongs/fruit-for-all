import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import controllers from './server/controllers/controllers.js';

const app = express();
const PORT = 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(compression()); // Enable gzip compression
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for pin creation
const pinLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 pin creations per minute
  message: 'Too many pins created, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS configuration based on environment
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:8080'];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // In production, only allow specified origins
  if (process.env.NODE_ENV === 'production') {
    if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
  } else {
    // In development, allow any origin for easier testing
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Serve static files from dist/ at the root FIRST
app.use(express.static(path.join(__dirname, 'dist')));

// Serve test files from root directory for development
app.use('/test', express.static(__dirname));

// Serve the built frontend for root and all non-API routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

// Catch-all for client-side routing (SPA)
app.get(/^\/((?!api|user|save|dist).)*$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

// Map page (legacy)
app.get('/map', (req, res) => {
  res.redirect('./client/map-index.html');
});

// Authentication endpoints (no auth required, but rate limited)
app.post('/api/auth/register', authLimiter, controllers.registerUser); // create new user
app.post('/api/auth/login', authLimiter, controllers.loginUser); // login user

// Protected API endpoints (authentication required)
app.get('/api/auth/me', controllers.verifyToken, controllers.getCurrentUser); // get current user
app.post('/api/pins', controllers.verifyToken, pinLimiter, controllers.createPin); // create new pin
app.get('/api/pins', controllers.verifyToken, controllers.getAllPins); // get all pins
app.get('/api/pins/my', controllers.verifyToken, controllers.getMyPins); // get user's pins
app.patch('/api/pins/:pinId', controllers.verifyToken, controllers.updatePin); // update pin (edit notes)
app.delete('/api/pins/:pinId', controllers.verifyToken, controllers.deletePin); // delete pin

app.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));
