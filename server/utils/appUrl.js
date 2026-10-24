// Base URL for links in emails (reset password, welcome, admin notices).
// APP_URL wins when set. Without it, production must still point at the live site:
// a reset link to localhost looks fine in the code and goes nowhere on a phone.
export const LIVE_URL = 'https://fruitforall.app';

export function appUrl(env = process.env) {
  const set = typeof env.APP_URL === 'string' ? env.APP_URL.trim().replace(/\/+$/, '') : '';
  if (set) return set;
  return env.NODE_ENV === 'production' ? LIVE_URL : 'http://localhost:3000';
}
