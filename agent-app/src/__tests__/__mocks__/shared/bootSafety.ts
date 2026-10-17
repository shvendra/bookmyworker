// Mock for shared-mobile/src/core/boot/bootSafety — the real module pulls in the
// real queryClient (and so NetInfo) and expo-application.
export const persistBuster = 'test-build';
export const clearCachedData = jest.fn(() => Promise.resolve());
export const withTimeout = <T,>(p: Promise<T>): Promise<T> => p;
