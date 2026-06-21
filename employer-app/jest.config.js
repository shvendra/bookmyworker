/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testMatch: ['**/src/__tests__/**/*.test.{ts,tsx}'],
  testTimeout: 20000,
  // Map the heavy shared-mobile / native imports to lightweight, controllable
  // mocks. Order matters — Jest uses the FIRST matching pattern, so specific
  // module paths are listed before the broad feature/app catch-alls.
  moduleNameMapper: {
    // ── Native / third-party libs ──────────────────────────────────────────
    '^expo-notifications$': '<rootDir>/src/__tests__/__mocks__/notifications.ts',
    '^@react-navigation/native$': '<rootDir>/src/__tests__/__mocks__/navigation.tsx',
    '^@react-navigation/native-stack$': '<rootDir>/src/__tests__/__mocks__/nativeStack.tsx',

    // ── shared-mobile: specific modules (must precede the broad rules) ──────
    '.*shared-mobile/src/core/i18n/useLangSync$':
      '<rootDir>/src/__tests__/__mocks__/shared/useLangSync.ts',
    '.*shared-mobile/src/core/i18n$':
      '<rootDir>/src/__tests__/__mocks__/shared/i18n.ts',
    '.*shared-mobile/src/core/theme$':
      '<rootDir>/src/__tests__/__mocks__/shared/theme.tsx',
    '.*shared-mobile/src/core/query/queryClient$':
      '<rootDir>/src/__tests__/__mocks__/shared/queryClient.ts',
    '.*shared-mobile/src/core/navigation/navigationRef$':
      '<rootDir>/src/__tests__/__mocks__/shared/navigationRef.ts',
    '.*shared-mobile/src/core/review/storeReview$':
      '<rootDir>/src/__tests__/__mocks__/shared/storeReview.ts',
    '.*shared-mobile/src/core/errors/globalErrorHandler$':
      '<rootDir>/src/__tests__/__mocks__/shared/globalErrorHandler.ts',
    '.*shared-mobile/src/core/auth/googleSignIn$':
      '<rootDir>/src/__tests__/__mocks__/shared/googleSignIn.ts',
    '.*shared-mobile/src/state/auth/AuthContext$':
      '<rootDir>/src/__tests__/__mocks__/shared/authContext.tsx',
    '.*shared-mobile/src/shared/state/toast/ToastContext$':
      '<rootDir>/src/__tests__/__mocks__/shared/passthroughProvider.tsx',
    '.*shared-mobile/src/shared/state/alert/AppAlertContext$':
      '<rootDir>/src/__tests__/__mocks__/shared/appAlert.tsx',
    '.*shared-mobile/src/core/api/endpoints/appConfigApi$':
      '<rootDir>/src/__tests__/__mocks__/shared/appConfigApi.ts',
    '.*shared-mobile/src/features/auth/services/authService$':
      '<rootDir>/src/__tests__/__mocks__/shared/authService.ts',
    '.*shared-mobile/src/features/auth/validation/authSchemas$':
      '<rootDir>/src/__tests__/__mocks__/shared/authSchemas.ts',
    '.*shared-mobile/src/shared/components/feedback/ErrorState$':
      '<rootDir>/src/__tests__/__mocks__/shared/ui.tsx',
    '.*shared-mobile/src/shared/components/feedback/LoadingState$':
      '<rootDir>/src/__tests__/__mocks__/shared/ui.tsx',
    '.*shared-mobile/src/shared/components/ui/AppButton$':
      '<rootDir>/src/__tests__/__mocks__/shared/ui.tsx',
    '.*shared-mobile/src/shared/components/ui/AppText$':
      '<rootDir>/src/__tests__/__mocks__/shared/ui.tsx',
    '.*shared-mobile/src/shared/components/ui/AppInput$':
      '<rootDir>/src/__tests__/__mocks__/shared/ui.tsx',
    '.*shared-mobile/src/shared/components/ui/Trademark$':
      '<rootDir>/src/__tests__/__mocks__/shared/ui.tsx',

    // ── shared-mobile: broad catch-alls for screens / navigators ───────────
    '.*shared-mobile/src/features/.*$':
      '<rootDir>/src/__tests__/__mocks__/proxyComponent.js',
    '.*shared-mobile/src/app/.*$':
      '<rootDir>/src/__tests__/__mocks__/proxyComponent.js',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    // Pure type declarations — no executable runtime to cover.
    '!src/navigation/types.ts',
  ],
  coverageThreshold: {
    global: { lines: 100, functions: 100, branches: 100, statements: 100 },
  },
};
