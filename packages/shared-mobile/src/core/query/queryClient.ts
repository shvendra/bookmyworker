import { QueryClient } from '@tanstack/react-query';
import { installConnectivityManager } from './connectivity';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 1000 * 60 * 60,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false, // no window focus in React Native — prevents spurious refetches
      // Retry a couple more times for network errors (with a short capped backoff) so
      // a brief connectivity blip self-heals without the user tapping "Try again";
      // real server errors (with a response) still fail fast after one retry.
      retry: (failureCount, error: unknown) => {
        const hasResponse =
          typeof error === 'object' && error !== null && 'statusCode' in error &&
          (error as { statusCode?: number }).statusCode !== undefined;
        return hasResponse ? failureCount < 1 : failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: {
      retry: 0,
    },
  },
});

// Bridge React Native connectivity → onlineManager so queries auto-recover when the
// network returns mid-session (refetchOnReconnect otherwise never fires on RN).
installConnectivityManager();
