import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { I18nextProvider } from 'react-i18next';
// Shared modules — resolved via Metro watchFolders
import i18n from '../../packages/shared-mobile/src/core/i18n';
import { queryClient } from '../../packages/shared-mobile/src/core/query/queryClient';
import { ThemeProvider } from '../../packages/shared-mobile/src/core/theme';
import { AuthProvider } from '../../packages/shared-mobile/src/state/auth/AuthContext';
import { ErrorState } from '../../packages/shared-mobile/src/shared/components/feedback/ErrorState';
import { ToastProvider } from '../../packages/shared-mobile/src/shared/state/toast/ToastContext';
import { AppAlertProvider } from '../../packages/shared-mobile/src/shared/state/alert/AppAlertContext';
import { installGlobalErrorHandlers } from '../../packages/shared-mobile/src/core/errors/globalErrorHandler';
import { setClientPlatform } from '../../packages/shared-mobile/src/core/api/client';
import { useAppFonts, markFontsReady } from '../../packages/shared-mobile/src/core/theme/fonts';
import { clearCachedData, persistBuster } from '../../packages/shared-mobile/src/core/boot/bootSafety';

import { AppNavigator } from './navigation/AppNavigator';
import { AppGate } from '../../packages/shared-mobile/src/app/AppGate';

// Keep the native splash screen up until the brand fonts are ready, so text
// never flashes in the system font first. Safe/idempotent at module load.
void SplashScreen.preventAutoHideAsync().catch(() => {});

// Catch async errors that escape React's render phase (the ErrorBoundary only
// catches render-phase errors). Idempotent — safe to call at module load.
installGlobalErrorHandlers();

// Tags every outgoing request as coming from the employer app, so the
// backend can tell it apart from the agent app (both share this API client).
setClientPlatform('employer_app');

const asyncStoragePersister = createAsyncStoragePersister({ storage: AsyncStorage });

const AppErrorFallback = ({ error, resetErrorBoundary }: FallbackProps): React.JSX.Element => (
  <ErrorState
    title="Something went wrong"
    message={error instanceof Error ? error.message : 'An unexpected error occurred'}
    // "Try again" also drops cached server data, so a bad/stale cache can be
    // recovered in-app (login + settings are untouched) instead of by reinstalling.
    onRetry={() => { void clearCachedData().finally(resetErrorBoundary); }}
  />
);

const App = (): React.JSX.Element | null => {
  const [fontsLoaded, fontError] = useAppFonts();
  // Watchdog: if font loading never settles, stop holding the splash and render
  // with system fonts rather than leaving the user on a blank screen forever.
  const [fontTimedOut, setFontTimedOut] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setFontTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (fontsLoaded || fontError || fontTimedOut) {
      if (fontsLoaded) markFontsReady();
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError, fontTimedOut]);

  // Hold on the native splash while fonts load. If loading ERRORS (or stalls
  // past the watchdog) we still render (fonts stay on the system default) —
  // the app never bricks.
  if (!fontsLoaded && !fontError && !fontTimedOut) return null;

  return (
  <I18nextProvider i18n={i18n}>
  <GestureHandlerRootView style={{ flex: 1 }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaProvider>
      {/* Blue brand for employer app */}
      <ThemeProvider primaryOverride="#1037A4">
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: asyncStoragePersister, buster: persistBuster }}
        >
          <AuthProvider>
            <ToastProvider>
              <AppAlertProvider>
                <ErrorBoundary FallbackComponent={AppErrorFallback}>
                  <StatusBar style="auto" />
                  <AppGate app="employer">
                    <AppNavigator />
                  </AppGate>
                </ErrorBoundary>
              </AppAlertProvider>
            </ToastProvider>
          </AuthProvider>
        </PersistQueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
    </KeyboardAvoidingView>
  </GestureHandlerRootView>
  </I18nextProvider>
  );
};

export default App;
