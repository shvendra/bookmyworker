/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/__tests__'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/src/__tests__/__mocks__/asyncStorage.ts',
    '^expo-secure-store$':
      '<rootDir>/src/__tests__/__mocks__/secureStore.ts',
    '^expo-file-system$':
      '<rootDir>/src/__tests__/__mocks__/fileSystem.ts',
    '^expo-constants$': '<rootDir>/src/__tests__/__mocks__/expoConstants.ts',
    '^expo-notifications$':
      '<rootDir>/src/__tests__/__mocks__/notifications.ts',
    '^react-native$':
      '<rootDir>/src/__tests__/__mocks__/reactNative.ts',
    '^../../../core/notifications/pushService$':
      '<rootDir>/src/__tests__/__mocks__/pushService.ts',
    '^../../notifications/pushService$':
      '<rootDir>/src/__tests__/__mocks__/pushService.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
    }],
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  collectCoverageFrom: [
    'src/core/api/**/*.ts',
    'src/core/storage/**/*.ts',
    'src/features/auth/services/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: { lines: 90, functions: 90, branches: 85, statements: 90 },
  },
};
