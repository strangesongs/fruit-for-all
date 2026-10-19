// Authentication utilities for managing JWT tokens

const TOKEN_KEY = 'ffa_auth_token';
const USER_KEY = 'ffa_user';

// Save authentication token and user info to localStorage
export function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Get the stored authentication token
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// Get the stored user information
export function getUser() {
  const userStr = localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
}

// Remove authentication token and user info (logout)
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Check if user is authenticated
export function isAuthenticated() {
  const token = getToken();
  if (!token) return false;
  
  try {
    // Decode JWT to check expiration (token format: header.payload.signature)
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expirationTime = payload.exp * 1000; // Convert to milliseconds
    
    // Check if token is expired
    if (Date.now() >= expirationTime) {
      clearAuth(); // Clean up expired token
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error validating token:', error);
    clearAuth(); // Clean up invalid token
    return false;
  }
}

// Get authorization header for API requests
export function getAuthHeader() {
  const token = getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Check if current user is admin
export function isAdmin() {
  const user = getUser();
  return user && user.isAdmin === true;
}

// Fired on window when the server rejects the stored token (expired or invalid).
export const SESSION_EXPIRED_EVENT = 'ffa:session-expired';

// Call with any response from an authenticated request. On a 401 while a token is
// stored, clears it and tells the app to switch back to guest mode. Returns true
// when it did, so the caller can stop handling the response.
// 403 is left alone: it means "not yours", not "signed out".
export function handleUnauthorized(response) {
  if (!response || response.status !== 401 || !getToken()) return false;
  clearAuth();
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
  return true;
}
