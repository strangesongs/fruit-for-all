// Rate-limit settings, kept apart from server.js so they can be tested.
// Each auth action gets its own bucket: a burst of failed logins should not
// lock someone out of resetting their password, and vice versa.

const MINUTE = 60 * 1000;

export const RATE_LIMITS = {
  // Failed logins only; a successful login doesn't use up the allowance.
  login: {
    windowMs: 15 * MINUTE,
    max: 10,
    skipSuccessfulRequests: true,
    message: 'too many sign-in attempts. please try again in a few minutes.',
  },
  register: {
    windowMs: 60 * MINUTE,
    max: 5,
    message: 'too many new accounts from here. please try again later.',
  },
  // Covers both forgot-password and reset-password; each sends or spends a token.
  reset: {
    windowMs: 15 * MINUTE,
    max: 5,
    message: 'too many password reset requests. please try again later.',
  },
  pin: {
    windowMs: MINUTE,
    max: 10,
    message: 'Too many pins created, please slow down.',
  },
  confirm: {
    windowMs: 15 * MINUTE,
    max: 10,
    message: 'Too many confirmations, please slow down.',
  },
  // IP → location lookups (ipapi.co). The client calls this once per visit.
  locate: {
    windowMs: 15 * MINUTE,
    max: 20,
    message: 'too many location lookups. please try again later.',
  },
  publicPins: {
    windowMs: MINUTE,
    max: 200,
    message: 'Too many public map requests, please slow down.',
  },
};
