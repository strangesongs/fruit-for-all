// Password-reset links arrive as /reset-password?token=…
// The token is read once and the URL is rewritten to plain /reset-password, so it
// doesn't stay in browser history, get bookmarked or show up in screenshots.
// It's kept in sessionStorage (this tab only) so a reload still works, and cleared
// once the password is set.

export const RESET_PATH = '/reset-password';
const STORAGE_KEY = 'ffa_reset_token';

export function takeResetToken({ location, history, storage }) {
  if (!location || location.pathname !== RESET_PATH) return null;

  const params = new URLSearchParams(location.search || '');
  const fromUrl = params.get('token');

  if (fromUrl) {
    try { storage?.setItem(STORAGE_KEY, fromUrl); } catch { /* storage blocked: memory only */ }
    params.delete('token');
    const rest = params.toString();
    try {
      history?.replaceState(null, '', `${RESET_PATH}${rest ? `?${rest}` : ''}${location.hash || ''}`);
    } catch { /* ignore */ }
    return fromUrl;
  }

  try {
    return storage?.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function forgetResetToken(storage) {
  try { storage?.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
