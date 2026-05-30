/**
 * Unit tests for authStorage — save, load, clear, getAccessToken.
 * Uses in-memory AsyncStorage and SecureStore mocks (via moduleNameMapper).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  saveAuthSession,
  loadAuthSession,
  clearAuthSession,
  getAccessToken,
} from '../../core/storage/authStorage';
import type { AuthSession } from '../../state/auth/authTypes';

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeSession = (overrides: Partial<AuthSession> = {}): AuthSession => ({
  user: {
    id: 'user-001',
    fullName: 'Ravi Shankar',
    phone: '9876543210',
    role: 'agent',
    kycStatus: 'verified',
    language: 'hi',
    email: 'ravi@example.com',
    state: 'Maharashtra',
    district: 'Pune',
  },
  tokens: {
    accessToken: 'access-token-abc',
    refreshToken: 'refresh-token-xyz',
    expiresAt: Date.now() + 3600 * 1000,
  },
  onboardingCompleted: true,
  availableRoles: ['Agent', 'SelfWorker'],
  defaultRole: 'Agent',
  ...overrides,
});

// Reset mock stores before each test
const asyncStorageMock = AsyncStorage as { _reset: () => void } & typeof AsyncStorage;
const secureStoreMock = SecureStore as { _reset: () => void; _set: (k: string, v: string) => void } & typeof SecureStore;

beforeEach(() => {
  asyncStorageMock._reset();
  secureStoreMock._reset();
  jest.clearAllMocks();
});

// ── saveAuthSession ───────────────────────────────────────────────────────────

describe('saveAuthSession', () => {
  it('writes session JSON to AsyncStorage and tokens to SecureStore', async () => {
    const session = makeSession();
    await saveAuthSession(session);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'bmw_auth_session',
      expect.stringContaining('"fullName":"Ravi Shankar"')
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('bmw_auth_accessToken', 'access-token-abc');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('bmw_auth_refreshToken', 'refresh-token-xyz');
  });

  it('does NOT persist tokens in AsyncStorage (security)', async () => {
    const session = makeSession();
    await saveAuthSession(session);

    const stored = await AsyncStorage.getItem('bmw_auth_session');
    expect(stored).not.toContain('access-token-abc');
    expect(stored).not.toContain('refresh-token-xyz');
  });

  it('persists availableRoles and defaultRole', async () => {
    const session = makeSession({ availableRoles: ['Agent'], defaultRole: 'Agent' });
    await saveAuthSession(session);

    const stored = await AsyncStorage.getItem('bmw_auth_session');
    const parsed = JSON.parse(stored!);
    expect(parsed.availableRoles).toEqual(['Agent']);
    expect(parsed.defaultRole).toBe('Agent');
  });

  it('handles session without availableRoles', async () => {
    const session = makeSession({ availableRoles: undefined, defaultRole: undefined });
    await saveAuthSession(session);
    const stored = await AsyncStorage.getItem('bmw_auth_session');
    expect(stored).toBeTruthy();
  });
});

// ── loadAuthSession ───────────────────────────────────────────────────────────

describe('loadAuthSession', () => {
  it('returns full AuthSession when both storage layers have data', async () => {
    const session = makeSession();
    await saveAuthSession(session);

    const loaded = await loadAuthSession();

    expect(loaded).not.toBeNull();
    expect(loaded!.user.fullName).toBe('Ravi Shankar');
    expect(loaded!.user.role).toBe('agent');
    expect(loaded!.tokens.accessToken).toBe('access-token-abc');
    expect(loaded!.tokens.refreshToken).toBe('refresh-token-xyz');
    expect(loaded!.onboardingCompleted).toBe(true);
    expect(loaded!.availableRoles).toEqual(['Agent', 'SelfWorker']);
    expect(loaded!.defaultRole).toBe('Agent');
  });

  it('returns null when AsyncStorage has no session', async () => {
    secureStoreMock._set('bmw_auth_accessToken', 'tok');
    secureStoreMock._set('bmw_auth_refreshToken', 'ref');

    const loaded = await loadAuthSession();
    expect(loaded).toBeNull();
  });

  it('returns null when access token is missing from SecureStore', async () => {
    const session = makeSession();
    await AsyncStorage.setItem('bmw_auth_session', JSON.stringify({ user: session.user, onboardingCompleted: true }));
    secureStoreMock._set('bmw_auth_refreshToken', 'ref');

    const loaded = await loadAuthSession();
    expect(loaded).toBeNull();
  });

  it('returns null when refresh token is missing from SecureStore', async () => {
    const session = makeSession();
    await AsyncStorage.setItem('bmw_auth_session', JSON.stringify({ user: session.user, onboardingCompleted: true }));
    secureStoreMock._set('bmw_auth_accessToken', 'tok');

    const loaded = await loadAuthSession();
    expect(loaded).toBeNull();
  });

  it('returns null when session JSON is malformed', async () => {
    await AsyncStorage.setItem('bmw_auth_session', 'not-valid-json{{{');
    secureStoreMock._set('bmw_auth_accessToken', 'tok');
    secureStoreMock._set('bmw_auth_refreshToken', 'ref');

    const loaded = await loadAuthSession();
    expect(loaded).toBeNull();
  });

  it('sets a fresh expiresAt (future timestamp)', async () => {
    const session = makeSession();
    await saveAuthSession(session);
    const before = Date.now();
    const loaded = await loadAuthSession();
    expect(loaded!.tokens.expiresAt).toBeGreaterThan(before);
  });
});

// ── clearAuthSession ──────────────────────────────────────────────────────────

describe('clearAuthSession', () => {
  it('removes all auth data from both storage layers', async () => {
    const session = makeSession();
    await saveAuthSession(session);
    await clearAuthSession();

    const stored = await AsyncStorage.getItem('bmw_auth_session');
    const token = await SecureStore.getItemAsync('bmw_auth_accessToken');
    const refresh = await SecureStore.getItemAsync('bmw_auth_refreshToken');

    expect(stored).toBeNull();
    expect(token).toBeNull();
    expect(refresh).toBeNull();
  });

  it('completes without error when storage is already empty', async () => {
    await expect(clearAuthSession()).resolves.toBeUndefined();
  });
});

// ── getAccessToken ────────────────────────────────────────────────────────────

describe('getAccessToken', () => {
  it('returns the stored access token', async () => {
    secureStoreMock._set('bmw_auth_accessToken', 'my-jwt-token');
    const token = await getAccessToken();
    expect(token).toBe('my-jwt-token');
  });

  it('returns null when no token is stored', async () => {
    const token = await getAccessToken();
    expect(token).toBeNull();
  });
});
