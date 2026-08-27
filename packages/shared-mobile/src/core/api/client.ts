import axios, { AxiosError } from 'axios';
import { ENV } from '../config/env';
import { clearAuthSession, getAccessToken } from '../storage/authStorage';
import { emitForceSignOut } from '../../state/auth/authEventBus';
import { reportNetworkOk, reportNetworkDown } from '../query/connectivity';

export interface ApiClientError extends Error {
  statusCode?: number;
  details?: unknown;
}

/** Maps Axios raw error codes / HTTP statuses → human-readable messages. */
const humanMessage = (error: AxiosError<{ message?: string }>): string => {
  // Server returned a message — use it directly.
  const serverMsg = error.response?.data?.message;
  if (serverMsg) return serverMsg;

  // No response at all → network-level failure.
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message)) {
      return 'Request timed out. Please check your internet connection and try again.';
    }
    // Axios fires "Network Error" when the device is offline or the server is unreachable.
    return 'Unable to connect. Please check your internet connection and try again.';
  }

  // Response received but HTTP error status.
  switch (error.response.status) {
    case 400: return 'Invalid request. Please check your details and try again.';
    case 401: return 'Session expired. Please log in again.';
    case 403: return 'You do not have permission to perform this action.';
    case 404: return 'The requested information could not be found.';
    case 409: return 'This action conflicts with existing data. Please refresh and try again.';
    case 422: return 'Some fields are invalid. Please review your details and try again.';
    case 429: return 'Too many requests. Please wait a moment and try again.';
    case 500:
    case 502:
    case 503: return 'Our server is temporarily unavailable. Please try again in a moment.';
    default:  return 'Something went wrong. Please try again.';
  }
};

const toApiError = (error: AxiosError<{ message?: string; errors?: unknown }>): ApiClientError => {
  const apiError = new Error(humanMessage(error)) as ApiClientError;
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

// ── Transient connectivity auto-retry for login ───────────────────────────────
// A brief backend restart/blip used to surface as an immediate "Unable to
// connect" error on the login screen, even though the exact same blip on a
// background query would just quietly retry on reconnect (see connectivity.ts).
// Login is retried automatically (2x, with backoff) because it's safe: a
// retried login attempt has no duplicate-action risk — it either succeeds or
// fails on real credentials, nothing gets created twice. This mirrors the CRM
// web app's identical fix — see crm/src/utils/axiosConfig.js.
// Registration/other POSTs are deliberately NOT auto-retried here for the same
// reason as web: resubmitting could duplicate an action if the original
// request actually reached the server and only the response was lost.
const RETRY_MAX = 2;
const RETRY_DELAY_MS = [1000, 2500];
const SAFE_TO_RETRY_URLS = ['/api/v1/user/login'];

function isConnectivityFailure(error: AxiosError): boolean {
  if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message)) return true;
  if (!error.response) return true;
  return [502, 503, 504].includes(error.response.status);
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

apiClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    reportNetworkOk(); // a server response proves connectivity is up
    return response;
  },
  async (error: AxiosError<{ message?: string; errors?: unknown }>) => {
    // Feed React Query's onlineManager from real traffic: no HTTP response means a
    // network-level failure (offline); any response means the server was reachable.
    if (error.response) reportNetworkOk();
    else reportNetworkDown();

    const cfg = error.config;
    const url = cfg?.url || '';
    const isSafeToRetry = (cfg?.method || 'get').toLowerCase() === 'post'
      && SAFE_TO_RETRY_URLS.some((u) => url.includes(u));
    if (isSafeToRetry && cfg && isConnectivityFailure(error)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfgAny = cfg as any;
      const retryCount: number = cfgAny.__retryCount || 0;
      if (retryCount < RETRY_MAX) {
        await delay(RETRY_DELAY_MS[retryCount] || 2500);
        cfgAny.__retryCount = retryCount + 1;
        return apiClient(cfg); // resolves the ORIGINAL caller's promise transparently on success
      }
    }

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
