/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testMatch: ['**/src/__tests__/**/*.test.{ts,tsx}'],
  // Map the heavy shared-mobile / native imports to lightweight, controllable
  // mocks. Order matters — Jest uses the FIRST matching pattern, so specific
  // module paths are listed before the broad feature/app catch-alls.
  moduleNameMapper: {
    // ── Native / third-party libs ──────────────────────────────────────────
    '^expo-notifications$': '<rootDir>/src/__tests__/__mocks__/notifications.ts',
    '^expo-document-picker$': '<rootDir>/src/__tests__/__mocks__/documentPicker.ts',
    '^expo-image-picker$': '<rootDir>/src/__tests__/__mocks__/imagePicker.ts',
    '^@react-navigation/native$': '<rootDir>/src/__tests__/__mocks__/navigation.tsx',
    '^@react-navigation/native-stack$': '<rootDir>/src/__tests__/__mocks__/nativeStack.tsx',

    // ── shared-mobile: specific modules (must precede the broad rules) ──────
    '.*shared-mobile/src/core/i18n/useLangSync$':
      '<rootDir>/src/__tests__/__mocks__/shared/useLangSync.ts',
    '.*shared-mobile/src/core/i18n/translations$':
      '<rootDir>/src/__tests__/__mocks__/shared/translations.ts',
    '.*shared-mobile/src/core/i18n$':
      '<rootDir>/src/__tests__/__mocks__/shared/i18n.ts',
    '.*shared-mobile/src/core/theme$':
      '<rootDir>/src/__tests__/__mocks__/shared/theme.tsx',
    '.*shared-mobile/src/core/query/queryClient$':
      '<rootDir>/src/__tests__/__mocks__/shared/queryClient.ts',
    '.*shared-mobile/src/core/navigation/navigationRef$':
      '<rootDir>/src/__tests__/__mocks__/shared/navigationRef.ts',
    '.*shared-mobile/src/core/errors/globalErrorHandler$':
      '<rootDir>/src/__tests__/__mocks__/shared/globalErrorHandler.ts',
    '.*shared-mobile/src/core/config/env$':
      '<rootDir>/src/__tests__/__mocks__/shared/env.ts',
    '.*shared-mobile/src/core/storage/authStorage$':
      '<rootDir>/src/__tests__/__mocks__/shared/authStorage.ts',
    '.*shared-mobile/src/core/api/endpoints/appConfigApi$':
      '<rootDir>/src/__tests__/__mocks__/shared/appConfigApi.ts',
    '.*shared-mobile/src/core/api/endpoints/workerApi$':
      '<rootDir>/src/__tests__/__mocks__/shared/workerApi.ts',
    '.*shared-mobile/src/state/auth/AuthContext$':
      '<rootDir>/src/__tests__/__mocks__/shared/authContext.tsx',
    '.*shared-mobile/src/shared/state/toast/ToastContext$':
      '<rootDir>/src/__tests__/__mocks__/shared/passthroughProvider.tsx',
    '.*shared-mobile/src/shared/state/alert/AppAlertContext$':
      '<rootDir>/src/__tests__/__mocks__/shared/appAlert.tsx',
    '.*shared-mobile/src/features/auth/services/authService$':
      '<rootDir>/src/__tests__/__mocks__/shared/authService.ts',
    '.*shared-mobile/src/features/auth/validation/authSchemas$':
      '<rootDir>/src/__tests__/__mocks__/shared/authSchemas.ts',
    '.*shared-mobile/src/shared/components/ui/WorkerCategoryGrid$':
      '<rootDir>/src/__tests__/__mocks__/shared/workerCategoryGrid.ts',
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
    '.*shared-mobile/src/shared/components/ui/GradientHeader$':
      '<rootDir>/src/__tests__/__mocks__/shared/ui.tsx',
    '.*shared-mobile/src/shared/components/ui/Badge$':
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
    global: { lines: 95, functions: 95, branches: 90, statements: 95 },
  },
};
