import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { queryClient } from '../query/queryClient';

/**
 * Tags the persisted React Query cache with the installed build. When the app is
 * updated the build changes, so the old cache (possibly shaped for the previous
 * release) is discarded instead of being rendered by new code — the classic
 * "crashes after update until reinstall" failure.
 */
export const persistBuster: string =
  `${Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '0'}` +
  `+${Application.nativeBuildVersion ?? '0'}`;

/** Default key used by createAsyncStoragePersister. */
const PERSIST_KEY = 'REACT_QUERY_OFFLINE_CACHE';

/**
 * Drops all cached server data (memory + disk) WITHOUT touching the login
 * session, language or any other stored setting. Used by the error screen's
 * "Try again" so a poisoned cache can be recovered in-app instead of by
 * uninstalling.
 */
export async function clearCachedData(): Promise<void> {
  try { queryClient.clear(); } catch { /* ignore */ }
  try { await AsyncStorage.removeItem(PERSIST_KEY); } catch { /* ignore */ }
}

/** Resolve with `fallback` if `p` hasn't settled within `ms` (or rejects). */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });
}
