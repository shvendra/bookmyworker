import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StatusBar } from 'expo-status-bar';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Shared modules — resolved via Metro watchFolders
import '../../packages/shared-mobile/src/core/i18n';
import { queryClient } from '../../packages/shared-mobile/src/core/query/queryClient';
import { ThemeProvider } from '../../packages/shared-mobile/src/core/theme';
import { AuthProvider } from '../../packages/shared-mobile/src/state/auth/AuthContext';
import { ErrorState } from '../../packages/shared-mobile/src/shared/components/feedback/ErrorState';
import { ToastProvider } from '../../packages/shared-mobile/src/shared/state/toast/ToastContext';

import { AppNavigator } from './navigation/AppNavigator';

const asyncStoragePersister = createAsyncStoragePersister({ storage: AsyncStorage });

const AppErrorFallback = ({ error, resetErrorBoundary }: FallbackProps): React.JSX.Element => (
  <ErrorState
    title="Something went wrong"
    message={error instanceof Error ? error.message : 'An unexpected error occurred'}
    onRetry={resetErrorBoundary}
  />
);

const App = (): React.JSX.Element => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaProvider>
      {/* Blue brand for employer app */}
      <ThemeProvider primaryOverride="#1037A4">
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: asyncStoragePersister }}
        >
          <AuthProvider>
            <ToastProvider>
              <ErrorBoundary FallbackComponent={AppErrorFallback}>
                <StatusBar style="auto" />
                <AppNavigator />
              </ErrorBoundary>
            </ToastProvider>
          </AuthProvider>
        </PersistQueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
    </KeyboardAvoidingView>
  </GestureHandlerRootView>
);

export default App;
