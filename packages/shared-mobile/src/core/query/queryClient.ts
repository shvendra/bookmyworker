import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 1000 * 60 * 60,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false, // no window focus in React Native — prevents spurious refetches
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
