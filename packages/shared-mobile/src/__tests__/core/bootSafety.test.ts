jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.2.3', nativeBuildVersion: '45' }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '9.9.9' } } }));
jest.mock('../../core/query/queryClient', () => ({ queryClient: { clear: jest.fn() } }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearCachedData, persistBuster, withTimeout } from '../../core/boot/bootSafety';

describe('bootSafety', () => {
  it('persistBuster identifies the installed build', () => {
    expect(persistBuster).toBe('1.2.3+45');
  });

  it('clearCachedData removes the persisted query cache but not the session', async () => {
    await AsyncStorage.setItem('REACT_QUERY_OFFLINE_CACHE', '{"x":1}');
    await AsyncStorage.setItem('auth_session', 'keep-me');
    await clearCachedData();
    expect(await AsyncStorage.getItem('REACT_QUERY_OFFLINE_CACHE')).toBeNull();
    expect(await AsyncStorage.getItem('auth_session')).toBe('keep-me');
  });

  it('withTimeout returns the value when the promise settles in time', async () => {
    expect(await withTimeout(Promise.resolve('ok'), 1000, 'fallback')).toBe('ok');
  });

  it('withTimeout returns the fallback on timeout or rejection', async () => {
    jest.useFakeTimers();
    const hung = withTimeout(new Promise<string>(() => {}), 500, 'fallback');
    jest.advanceTimersByTime(501);
    expect(await hung).toBe('fallback');
    jest.useRealTimers();
    expect(await withTimeout(Promise.reject(new Error('x')), 1000, 'fb')).toBe('fb');
  });
});
