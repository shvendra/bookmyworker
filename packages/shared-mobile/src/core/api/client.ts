import axios, { AxiosError } from 'axios';
import { Platform } from 'react-native';
import { ENV } from '../config/env';
import { clearAuthSession, getAccessToken } from '../storage/authStorage';
import { emitForceSignOut } from '../../state/auth/authEventBus';

export interface ApiClientError extends Error {
  statusCode?: number;
  details?: unknown;
}

const toApiError = (error: AxiosError<{ message?: string; errors?: unknown }>): ApiClientError => {
  const apiError = new Error(
    error.response?.data?.message ?? error.message ?? 'Something went wrong. Please try again.'
  ) as ApiClientError;

  apiError.statusCode = error.response?.status;
  apiError.details = error.response?.data?.errors;
  return apiError;
};

export const apiClient = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: 15000,
  withCredentials: true, // lets browser send Set-Cookie automatically on web
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    // Web: browser handles cookies automatically via withCredentials — setting Cookie manually is blocked
    // Native (iOS/Android): must set it manually since there is no browser cookie jar
    if (Platform.OS !== 'web') {
      config.headers.Cookie = `token=${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string; errors?: unknown }>) => {
    if (error.response?.status === 401) {
      // Clear persisted session and kick the user back to login
      await clearAuthSession().catch(() => {});
      emitForceSignOut();
    }
    return Promise.reject(toApiError(error));
  }
);
