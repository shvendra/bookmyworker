const FALLBACK_API_BASE_URL = 'https://bookmyworkers.com';
const FALLBACK_SOCKET_BASE_URL = 'https://bookmyworkers.com';

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
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${S3_BASE}/${path}`.replace(/([^:]\/)\/+/g, '$1');
};
