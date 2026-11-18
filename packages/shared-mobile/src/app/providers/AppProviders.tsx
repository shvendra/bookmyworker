import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { SafeAreaView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '../../core/query/queryClient';
import { ThemeProvider } from '../../core/theme';
import { AuthProvider } from '../../state/auth/AuthContext';
import { logError } from '../../core/errors/globalErrorHandler';
import { ErrorState } from '../../shared/components/feedback/ErrorState';
import { ToastProvider } from '../../shared/state/toast/ToastContext';
import { AppAlertProvider } from '../../shared/state/alert/AppAlertContext';

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

declare const __DEV__: boolean | undefined;

// Last-resort fallback (only reached if a screen-level boundary itself failed). Users get a friendly message; the raw
// technical text is shown in development only.
const AppErrorFallback = ({ error, resetErrorBoundary }: FallbackProps): React.JSX.Element => (
  <SafeAreaView style={{ flex: 1 }}>
    <ErrorState
      title="Something went wrong"
      message={
        typeof __DEV__ !== 'undefined' && __DEV__ && error instanceof Error
          ? error.message
          : 'The app hit an unexpected problem. Please try again.'
      }
      onRetry={resetErrorBoundary}
    />
  </SafeAreaView>
);

export const AppProviders = ({ children }: React.PropsWithChildren): React.JSX.Element => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary FallbackComponent={AppErrorFallback} onError={(e, info) => logError('root', e, { componentStack: info?.componentStack ?? undefined })}>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister: asyncStoragePersister,
            }}
          >
            <AuthProvider>
              <ToastProvider>
                <AppAlertProvider>
                  <StatusBar style="auto" />
                  {children}
                </AppAlertProvider>
              </ToastProvider>
            </AuthProvider>
          </PersistQueryClientProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);
