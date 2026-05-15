import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '../../core/query/queryClient';
import { ThemeProvider } from '../../core/theme';
import { AuthProvider } from '../../state/auth/AuthContext';
import { ErrorState } from '../../shared/components/feedback/ErrorState';
import { ToastProvider } from '../../shared/state/toast/ToastContext';

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

const AppErrorFallback = ({ error, resetErrorBoundary }: FallbackProps): React.JSX.Element => (
  <ErrorState
    title="Something went wrong"
    message={error instanceof Error ? error.message : 'An unexpected error occurred'}
    onRetry={resetErrorBoundary}
  />
);

export const AppProviders = ({ children }: React.PropsWithChildren): React.JSX.Element => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <ThemeProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: asyncStoragePersister,
          }}
        >
          <AuthProvider>
            <ToastProvider>
              <ErrorBoundary FallbackComponent={AppErrorFallback}>
                <StatusBar style="auto" />
                {children}
              </ErrorBoundary>
            </ToastProvider>
          </AuthProvider>
        </PersistQueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);
