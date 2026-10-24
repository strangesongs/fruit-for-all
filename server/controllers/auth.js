import * as db from '../schemas/schemas.js';
import { escapeHtml } from '../utils/html.js';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import { logEmailResult } from '../utils/email.js';
import { UserError, publicMessage } from '../schemas/errors.js';
import { appUrl as emailBaseUrl } from '../utils/appUrl.js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

if (process.env.NODE_ENV === 'production' && !JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is not set.');
  console.error('Generate a secure secret with: openssl rand -base64 32');
  process.exit(1);
}
const JWT_SECRET_FINAL = JWT_SECRET || 'loquat-dev-secret-ONLY-FOR-DEVELOPMENT';
if (!JWT_SECRET && process.env.NODE_ENV !== 'production') {
  console.warn('⚠️  WARNING: Using default JWT_SECRET. Set JWT_SECRET environment variable for production.');
}

function generateToken(user) {
  return jwt.sign(
    {
      userName: user.userName,
      email: user.email,
      isAdmin: user.isAdmin || false,
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET_FINAL,
    { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' },
  );
}

export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET_FINAL, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

// User-facing errors keep their status and message. Anything else (a database
// or network failure) is logged and answered with a generic 500, so internal
// details like "connect ECONNREFUSED" never reach the browser.
function sendAuthError(res, error, status, fallback, label) {
  if (error instanceof UserError) {
    return res.status(status).json({ success: false, message: error.message });
  }
  console.error(`[AUTH] ${label} error:`, error);
  return res.status(500).json({ success: false, message: publicMessage(error, fallback) });
}

export const registerUser = async (req, res) => {
  try {
    const { userName, password, email } = req.body;
    const user = await db.createUser({ userName, password, email });
    const token = generateToken(user);
    const appUrl = emailBaseUrl();
    if (resend) {
      resend.emails.send({
        from: 'fruit for all <noreply@fruitforall.app>',
        to: email,
        subject: 'welcome to fruit for all',
        html: `
          <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #2a2420;">
            <h2 style="color: #5b3a5e; margin-bottom: 4px;">fruit for all</h2>
            <p style="color: #66584c; font-size: 0.85rem; margin-top: 0;">open source orchard</p>
            <hr style="border: none; border-top: 1px solid #c4b49b; margin: 24px 0;" />
            <p>welcome to fruit for all, your open source orchard.</p>
            <p>fruit for all is a community-built, user-submitted map of free street fruit in your area. find it, pick it, share it.</p>
            <p>you can only add fruit when it's right under your nose &mdash; hit the &lsquo;add fruit&rsquo; button to pull your geolocation and log fruit to the map.</p>
            <p>anyone using fruit for all will be able to see fruit you've shared, so make sure it's ok for other users to forage that fruit (i.e. don't share fruit in a private backyard or locked away behind a gate).</p>
            <p>check out our code at <a href="https://github.com/strangesongs/fruit-for-all" style="color: #5b3a5e;">github.com/strangesongs/fruit-for-all</a> and feel free to submit issues, feature requests and fixes.</p>
            <p>please reach out with any questions to <a href="mailto:admin@fruitforall.app" style="color: #5b3a5e;">admin@fruitforall.app</a></p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${appUrl}" style="background: #5b3a5e; color: #f7f1e3; padding: 12px 28px; text-decoration: none; border-radius: 3px; font-weight: bold; display: inline-block;">open the map</a>
            </div>
            <hr style="border: none; border-top: 1px solid #c4b49b; margin: 24px 0;" />
            <p style="font-size: 0.8rem; color: #bbb; text-align: center;">
              <img src="${appUrl}/loquat-48.png" alt="fruit for all" width="32" height="32" style="display: block; margin: 0 auto 8px auto;" />
              <a href="${appUrl}" style="color: #5b3a5e;">fruitforall.app</a>
            </p>
          </div>
        `,
      }).then(logEmailResult('Welcome email')).catch((err) => console.error('[EMAIL] Welcome email failed:', err.message));
    }
    const adminEmail = process.env.ADMIN_EMAIL;
    if (resend && adminEmail) {
      resend.emails.send({
        from: 'fruit for all <noreply@fruitforall.app>',
        to: adminEmail,
        subject: `new user: ${userName}`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #2a2420;">
            <h2 style="color: #5b3a5e;">new registration</h2>
            <p><strong>username:</strong> ${escapeHtml(userName)}</p>
            <p><strong>email:</strong> ${escapeHtml(email)}</p>
            <p><strong>time:</strong> ${new Date().toUTCString()}</p>
            <p style="margin-top: 24px;"><a href="${appUrl}" style="color: #5b3a5e;">fruitforall.app</a></p>
          </div>
        `,
      }).then(logEmailResult('Admin notification')).catch((err) => console.error('[EMAIL] Admin notification failed:', err.message));
    }
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: { userName: user.userName, email: user.email, createdAt: user.createdAt },
      token,
    });
  } catch (error) {
    sendAuthError(res, error, 400, 'Could not create your account. Please try again.', 'register');
  }
};

export const loginUser = async (req, res) => {
  try {
    const { userName, password } = req.body;
    const user = await db.verifyUser(userName, password);
    const token = generateToken(user);
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        userName: user.userName,
        email: user.email,
        lastLogin: user.lastLogin,
        isAdmin: user.isAdmin || false,
      },
      token,
    });
  } catch (error) {
    sendAuthError(res, error, 401, 'Could not sign you in. Please try again.', 'login');
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await db.getUser(req.user.userName);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({
      success: true,
      user: {
        userName: user.userName,
        email: user.email,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching user data' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    const { userName, token } = await db.requestPasswordReset(email);
    const appUrl = emailBaseUrl();
    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    if (resend) {
      const sent = await resend.emails.send({
        from: 'fruit for all <noreply@fruitforall.app>',
        to: email,
        subject: 'reset your fruit for all password',
        html: `
          <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #2a2420;">
            <h2 style="color: #5b3a5e; margin-bottom: 4px;">fruit for all</h2>
            <p style="color: #66584c; font-size: 0.85rem; margin-top: 0;">open source orchard</p>
            <hr style="border: none; border-top: 1px solid #c4b49b; margin: 24px 0;" />
            <p>hi ${userName},</p>
            <p>we received a request to reset your password. click the button below to set a new one &mdash; this link expires in 1 hour.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="background: #5b3a5e; color: #f7f1e3; padding: 12px 28px; text-decoration: none; border-radius: 3px; font-weight: bold; display: inline-block;">reset password</a>
            </div>
            <p style="font-size: 0.85rem; color: #999;">if you didn't request this, you can safely ignore this email. your password won't change.</p>
            <hr style="border: none; border-top: 1px solid #c4b49b; margin: 24px 0;" />
            <p style="font-size: 0.8rem; color: #bbb; text-align: center;">
              <img src="${appUrl}/loquat-48.png" alt="fruit for all" width="32" height="32" style="display: block; margin: 0 auto 8px auto;" />
              <a href="${appUrl}" style="color: #5b3a5e;">fruitforall.app</a>
            </p>
          </div>
        `,
      });
      logEmailResult('Password reset')(sent);
    } else {
      console.log(`[RESET DEV] Password reset URL for ${userName}: ${resetUrl}`);
    }
    res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  } catch (error) {
    console.error('[RESET] forgotPassword error:', error.message);
    res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }
    const { userName } = await db.resetPassword(token, password);
    res.json({ success: true, message: 'Password updated successfully', userName });
  } catch (error) {
    sendAuthError(res, error, 400, 'Could not reset your password. Please try again.', 'resetPassword');
  }
};
