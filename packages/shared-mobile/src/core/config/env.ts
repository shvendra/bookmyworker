// Canonical production host = www (matches CRM/next-web REACT_APP_API_BASE_URL).
// The non-www host does not serve the API, so the fallback must include www.
const FALLBACK_API_BASE_URL = 'https://www.bookmyworkers.com';
const FALLBACK_SOCKET_BASE_URL = 'https://www.bookmyworkers.com';

export const ENV = {
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL ?? FALLBACK_API_BASE_URL,
  SOCKET_BASE_URL: process.env.EXPO_PUBLIC_SOCKET_BASE_URL ?? FALLBACK_SOCKET_BASE_URL,
  // Google OAuth Web Client ID (from Google Cloud Console). Empty → "Continue
  // with Google" stays hidden and the native module is never loaded.
  GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
} as const;

// All user/worker/agent photos are stored in this S3 bucket (matches CRM config.FILE_BASE_URL)
export const S3_BASE = 'https://bookmyworker.s3.eu-north-1.amazonaws.com';

/**
 * Build a full photo URL from the stored path/key.
 * - Already-full URLs (http/https) are returned as-is.
 * - Relative keys (e.g. "uploads/photo.jpg") are prefixed with the S3 base.
 */
export const buildPhotoUrl = (path?: string | null): string | undefined => {
  // Treat empty / whitespace / literal "null"/"undefined" as "no photo" so the
  // caller falls back to the gender avatar instead of building a 404 URL.
  const p = (path ?? '').trim();
  if (!p || p === 'null' || p === 'undefined') return undefined;
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  return `${S3_BASE}/${p}`.replace(/([^:]\/)\/+/g, '$1');
};
