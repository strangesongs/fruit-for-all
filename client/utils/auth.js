// Authentication utilities for managing JWT tokens

const TOKEN_KEY = 'loquat_auth_token';
const USER_KEY = 'loquat_user';

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
