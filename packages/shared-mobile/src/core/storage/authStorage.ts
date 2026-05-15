import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '../../shared/constants/storageKeys';
import type { AuthSession } from '../../state/auth/authTypes';

type PersistedSession = Omit<AuthSession, 'tokens'>;

export const saveAuthSession = async (session: AuthSession): Promise<void> => {
  const persistedSession: PersistedSession = {
    user: session.user,
    onboardingCompleted: session.onboardingCompleted,
    availableRoles: session.availableRoles,
    defaultRole: session.defaultRole,
  };

  await Promise.all([
    AsyncStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(persistedSession)),
    SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, session.tokens.accessToken),
    SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, session.tokens.refreshToken),
  ]);
};

export const loadAuthSession = async (): Promise<AuthSession | null> => {
  const [sessionString, accessToken, refreshToken] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.AUTH_SESSION),
    SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
    SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
  ]);

  if (!sessionString || !accessToken || !refreshToken) {
    return null;
  }

  try {
    const persistedSession = JSON.parse(sessionString) as PersistedSession;
    return {
      ...persistedSession,
      availableRoles: persistedSession.availableRoles,
      tokens: {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + 60 * 60 * 1000,
      },
    };
  } catch {
    return null;
  }
};

export const clearAuthSession = async (): Promise<void> => {
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEYS.AUTH_SESSION),
    SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
    SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
  ]);
};

export const getAccessToken = async (): Promise<string | null> =>
  SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
