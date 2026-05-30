/**
 * Unit tests for the Axios API client (core/api/client.ts).
 * Covers: request interceptor (token injection), response pass-through,
 * 401 handling with/without stored token, and ApiClientError shape.
 */
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Mock storage before importing the client so interceptors pick up our mock
jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn(),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({
  emitForceSignOut: jest.fn(),
}));

import { apiClient } from '../../core/api/client';
import { getAccessToken, clearAuthSession } from '../../core/storage/authStorage';
import { emitForceSignOut } from '../../state/auth/authEventBus';

const mockGetToken = getAccessToken as jest.Mock;
const mockClear    = clearAuthSession as jest.Mock;
const mockSignOut  = emitForceSignOut as jest.Mock;

describe('apiClient', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    jest.clearAllMocks();
  });

  afterEach(() => mock.restore());

  // ── Request interceptor ──────────────────────────────────────────────────────

  it('attaches Bearer token when access token is available', async () => {
    mockGetToken.mockResolvedValue('test-token-abc');
    mock.onGet('/api/v1/test').reply(200, { ok: true });

    const res = await apiClient.get('/api/v1/test');

    expect(res.config.headers?.Authorization).toBe('Bearer test-token-abc');
  });

  it('does not attach Authorization header when no token is stored', async () => {
    mockGetToken.mockResolvedValue(null);
    mock.onGet('/api/v1/test').reply(200, { ok: true });

    const res = await apiClient.get('/api/v1/test');

    expect(res.config.headers?.Authorization).toBeUndefined();
  });

  // ── Response pass-through ────────────────────────────────────────────────────

  it('passes through 2xx responses unchanged', async () => {
    mockGetToken.mockResolvedValue(null);
    mock.onGet('/api/v1/ping').reply(200, { message: 'pong' });

    const res = await apiClient.get('/api/v1/ping');

    expect(res.data).toEqual({ message: 'pong' });
    expect(res.status).toBe(200);
  });

  // ── 401 handling ────────────────────────────────────────────────────────────

  it('forces sign-out and clears session on 401 when a token exists', async () => {
    mockGetToken
      .mockResolvedValueOnce('request-token') // request interceptor
      .mockResolvedValueOnce('request-token'); // 401 handler check
    mockClear.mockResolvedValue(undefined);
    mock.onGet('/api/v1/protected').reply(401, { message: 'Unauthorized' });

    await expect(apiClient.get('/api/v1/protected')).rejects.toMatchObject({
      statusCode: 401,
    });

    expect(mockClear).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('does NOT force sign-out on 401 when there is no stored token (bad login)', async () => {
    mockGetToken.mockResolvedValue(null);
    mock.onPost('/api/v1/user/login').reply(401, { message: 'Wrong credentials' });

    await expect(apiClient.post('/api/v1/user/login', {})).rejects.toMatchObject({
      statusCode: 401,
    });

    expect(mockClear).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  // ── ApiClientError shape ─────────────────────────────────────────────────────

  it('transforms 4xx errors into ApiClientError with statusCode and details', async () => {
    mockGetToken.mockResolvedValue(null);
    mock.onPost('/api/v1/bad').reply(422, {
      message: 'Validation failed',
      errors: [{ field: 'phone', msg: 'required' }],
    });

    await expect(apiClient.post('/api/v1/bad', {})).rejects.toMatchObject({
      message: 'Validation failed',
      statusCode: 422,
      details: [{ field: 'phone', msg: 'required' }],
    });
  });

  it('falls back to a generic message when the server body has no message field', async () => {
    mockGetToken.mockResolvedValue(null);
    mock.onGet('/api/v1/crash').reply(500, {});

    const err = await apiClient.get('/api/v1/crash').catch((e) => e);

    expect(err.statusCode).toBe(500);
    expect(typeof err.message).toBe('string');
    expect(err.message.length).toBeGreaterThan(0);
  });

  it('handles network errors (no response) with a descriptive message', async () => {
    mockGetToken.mockResolvedValue(null);
    mock.onGet('/api/v1/offline').networkError();

    const err = await apiClient.get('/api/v1/offline').catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(typeof err.message).toBe('string');
  });
});
