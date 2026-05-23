import axios, { AxiosError } from 'axios';
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
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string; errors?: unknown }>) => {
    if (error.response?.status === 401) {
      // Only force-sign-out when there is an active session (expired token).
      // During login attempts there is no stored token, so 401 means wrong
      // credentials — let the calling code handle it via the rejected error.
      const existingToken = await getAccessToken().catch(() => null);
      if (existingToken) {
        await clearAuthSession().catch(() => {});
        emitForceSignOut();
      }
    }
    return Promise.reject(toApiError(error));
  }
);
