import React from 'react';
import { Platform } from 'react-native';
import { render, screen } from '@testing-library/react-native';

// ── Provider / library stubs not covered by the global moduleNameMapper ──────
jest.mock('@tanstack/query-async-storage-persister', () => ({
  createAsyncStoragePersister: () => ({}),
}));
jest.mock('@tanstack/react-query-persist-client', () => ({
  PersistQueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
}));

// Keep the App unit isolated from the full navigation tree.
jest.mock('../navigation/AppNavigator', () => ({
  AppNavigator: () => null,
}));

// ErrorBoundary stub that renders BOTH the children and the FallbackComponent,
// feeding it whatever error the current test set on the global. This lets us
// exercise AppErrorFallback (and both arms of its message ternary).
jest.mock('react-error-boundary', () => ({
  ErrorBoundary: ({
    children,
    FallbackComponent,
  }: {
    children: React.ReactNode;
    FallbackComponent: (props: { error: unknown; resetErrorBoundary: () => void }) => React.ReactNode;
  }) => (
    <>
      {FallbackComponent({
        error: (globalThis as Record<string, unknown>).__APP_EB_ERROR,
        resetErrorBoundary: jest.fn(),
      })}
      {children}
    </>
  ),
}));

import { installGlobalErrorHandlers } from '../__tests__/__mocks__/shared/globalErrorHandler';
import App from '../App';

describe('App', () => {
  it('installs the global error handlers at module load', () => {
    expect(installGlobalErrorHandlers).toHaveBeenCalled();
  });

  it('renders the provider tree without crashing', () => {
    (globalThis as Record<string, unknown>).__APP_EB_ERROR = new Error('ignored');
    expect(() => render(<App />)).not.toThrow();
  });

  it('error fallback shows the message of a thrown Error', () => {
    (globalThis as Record<string, unknown>).__APP_EB_ERROR = new Error('kaboom');
    render(<App />);
    expect(screen.getByText('kaboom')).toBeTruthy();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('error fallback shows a generic message for a non-Error value', () => {
    (globalThis as Record<string, unknown>).__APP_EB_ERROR = 'not-an-error';
    render(<App />);
    expect(screen.getByText('An unexpected error occurred')).toBeTruthy();
  });

  it('uses the android keyboard behavior', () => {
    const original = Platform.OS;
    (Platform as { OS: string }).OS = 'android';
    (globalThis as Record<string, unknown>).__APP_EB_ERROR = new Error('ignored');
    try {
      expect(() => render(<App />)).not.toThrow();
    } finally {
      (Platform as { OS: string }).OS = original;
    }
  });

  it('uses the ios keyboard behavior', () => {
    const original = Platform.OS;
    (Platform as { OS: string }).OS = 'ios';
    (globalThis as Record<string, unknown>).__APP_EB_ERROR = new Error('ignored');
    try {
      expect(() => render(<App />)).not.toThrow();
    } finally {
      (Platform as { OS: string }).OS = original;
    }
  });
});
