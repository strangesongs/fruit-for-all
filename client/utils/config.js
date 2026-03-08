// API base URL — empty string in production (same-origin), full URL in dev (cross-origin)
export const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8080';
