import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import compression from 'compression';
import helmet from 'helmet';
import { createClient } from 'redis';
import { RedisStore } from 'rate-limit-redis';
import controllers from './server/controllers/index.js';
import { REGION, USERS_TABLE, PINS_TABLE } from './server/db/dynamo.js';
import { describeDatabaseUrl } from './server/db/postgres.js';
import { createMemoryDedupStore } from './server/utils/confirmDedup.js';
import { wrap } from './server/utils/wrap.js';
import { RATE_LIMITS } from './server/utils/rateLimits.js';
import fs from 'fs';

const app = express();
const PORT = Number.parseInt(process.env.PORT || '8080', 10);

// Trust the first proxy hop (Railway, etc.) so req.ip returns the real client IP
app.set('trust proxy', 1);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(compression()); // Enable gzip compression
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Cloudflare Web Analytics: the beacon script, and where it reports.
        scriptSrc: ["'self'", 'https://static.cloudflareinsights.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: [
          "'self'",
          'data:',
          'https://raw.githubusercontent.com',
          'https://cdnjs.cloudflare.com',
          'https://*.tile.openstreetmap.org',
          'https://tiles.stadiamaps.com',
        ],
        connectSrc: ["'self'", 'https://cloudflareinsights.com'],
      },
    },
    crossOriginEmbedderPolicy: false, // Leaflet map tiles require this off
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }, // needed for Stadia Maps domain auth
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization',
  );
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

/** One store per limiter (express-rate-limit disallows reusing a single store instance). */
function createRedisRateLimitStore(redisClient, prefix) {
  if (!redisClient) return undefined;
  return new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: `rl:ffa:${prefix}:`,
  });
}

async function createAppWithRateLimiters() {
  let redisClient = null;
  if (process.env.REDIS_URL) {
    try {
      redisClient = createClient({ url: process.env.REDIS_URL });
      redisClient.on('error', (err) => console.error('[redis] rate-limit client', err));
      await redisClient.connect();
      console.log('[rate-limit] using Redis (REDIS_URL set)');
    } catch (e) {
      console.error('[rate-limit] Redis connect failed; using in-memory store', e);
      redisClient = null;
    }
  } else {
    console.log('[rate-limit] in-memory (set REDIS_URL for multi-replica limit consistency)');
  }

  const keyGen = (req) => ipKeyGenerator(req.ip ?? '127.0.0.1');
  const limiterDefaults = { standardHeaders: true, legacyHeaders: false, keyGenerator: keyGen };

  // The client parses every /api response as JSON, so limits answer in JSON too.
  const limiter = (name) =>
    rateLimit({
      ...limiterDefaults,
      ...RATE_LIMITS[name],
      message: { success: false, message: RATE_LIMITS[name].message },
      store: createRedisRateLimitStore(redisClient, name),
    });

  const loginLimiter = limiter('login');
  const registerLimiter = limiter('register');
  const resetLimiter = limiter('reset');
  const pinLimiter = limiter('pin');
  const confirmLimiter = limiter('confirm');
  const publicPinsLimiter = limiter('publicPins');
  const locateLimiter = limiter('locate');
  const reportLimiter = limiter('report');

  // Serve static files from dist/ at the root FIRST
  app.use(
    express.static(path.join(__dirname, 'dist'), {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(`${path.sep}sw.js`) || filePath.endsWith(`${path.sep}manifest.json`)) {
          res.setHeader('Cache-Control', 'no-cache');
          return;
        }
        if (filePath.endsWith(`${path.sep}index.html`)) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );

  // Load balancer / monitoring — must be before SPA catch-all
  app.get('/health', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // NOTE: /test static route removed — it exposed project source files in production

  // Serve the built frontend for root
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
  });

  // Legacy path — must be before SPA catch-all
  app.get('/map', (req, res) => {
    res.redirect(301, '/');
  });

  // A link to one find: the app, with that find's title and link-preview tags.
  // dist/index.html only changes on a deploy (a restart), so it's read once.
  let indexHtml = null;
  const readIndex = () => {
    if (indexHtml === null) indexHtml = fs.readFileSync(path.join(__dirname, 'dist/index.html'), 'utf8');
    return indexHtml;
  };
  app.get('/find/:pinId', publicPinsLimiter, wrap(controllers.makeFindPage(readIndex)));

  // Catch-all for client-side routing (SPA) — exclude api, health, legacy paths
  app.get(
    /^\/((?!api|user|save|dist|health).)*$/,
    (req, res) => {
      res.sendFile(path.join(__dirname, 'dist/index.html'));
    },
  );

  // Without Redis, "still good?" dedup falls back to this process's memory.
  const memoryDedupStore = createMemoryDedupStore();

  // Public endpoints (no auth required)
  app.get('/api/locate', locateLimiter, wrap(controllers.getIpLocation));
  app.get('/api/pins/public', publicPinsLimiter, wrap(controllers.getPublicPins));

  // Authentication endpoints
  app.post('/api/auth/register', registerLimiter, wrap(controllers.registerUser));
  app.post('/api/auth/login', loginLimiter, wrap(controllers.loginUser));
  app.post('/api/auth/forgot-password', resetLimiter, wrap(controllers.forgotPassword));
  app.post('/api/auth/reset-password', resetLimiter, wrap(controllers.resetPassword));

  // Protected API endpoints
  app.get('/api/auth/me', controllers.verifyToken, wrap(controllers.getCurrentUser));
  app.post('/api/pins', controllers.verifyToken, pinLimiter, wrap(controllers.createPin));
  app.get('/api/pins', controllers.verifyToken, wrap(controllers.getAllPins));
  app.get('/api/pins/my', controllers.verifyToken, wrap(controllers.getMyPins));
  app.patch('/api/pins/:pinId', controllers.verifyToken, pinLimiter, wrap(controllers.updatePin));
  app.delete('/api/pins/:pinId', controllers.verifyToken, wrap(controllers.deletePin));
  app.post(
    '/api/pins/:pinId/confirm',
    (req, _res, next) => { req.redisClient = redisClient ?? memoryDedupStore; next(); },
    confirmLimiter,
    wrap(controllers.confirmPin),
  );
  // Public: one find (for a shared link), and "report a problem" (deduped like confirm).
  app.get('/api/pins/:pinId', publicPinsLimiter, wrap(controllers.getPublicPin));
  app.post(
    '/api/pins/:pinId/report',
    (req, _res, next) => { req.redisClient = redisClient ?? memoryDedupStore; next(); },
    reportLimiter,
    wrap(controllers.reportPin),
  );

  // Unknown API routes → JSON 404 (instead of Express's HTML page)
  app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: 'Not found' });
  });

  // Last-resort error handler: malformed JSON bodies, errors forwarded by wrap(), etc.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status >= 500) console.error('[error]', req.method, req.originalUrl, err);
    if (res.headersSent) return;
    res.status(status).json({
      success: false,
      message: status === 500 ? 'Internal server error' : 'Bad request',
    });
  });
}

// An async handler that throws must never take the process down.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// Boot
createAppWithRateLimiters()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port: ${PORT}`);
      // Which data this instance talks to — the first thing to check when prod and local disagree.
      console.log(
        `[config] NODE_ENV=${process.env.NODE_ENV || '(unset)'} region=${REGION} ` +
          `usersTable=${USERS_TABLE} pinsTable=${PINS_TABLE} ` +
          `postgres=${describeDatabaseUrl(process.env.DATABASE_URL)} ` +
          `email=${process.env.RESEND_API_KEY ? 'resend' : 'off'} redis=${process.env.REDIS_URL ? 'on' : 'off'}`,
      );
    });
  })
  .catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
