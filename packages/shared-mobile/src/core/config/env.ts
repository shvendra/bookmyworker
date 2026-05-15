const FALLBACK_API_BASE_URL = 'https://www.bookmyworkers.com';
const FALLBACK_SOCKET_BASE_URL = 'https://www.bookmyworkers.com';

export const ENV = {
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL ?? FALLBACK_API_BASE_URL,
  SOCKET_BASE_URL: process.env.EXPO_PUBLIC_SOCKET_BASE_URL ?? FALLBACK_SOCKET_BASE_URL,
} as const;
