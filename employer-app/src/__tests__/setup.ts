// Jest setup — global mocks shared by every test.
import { configure } from '@testing-library/react-native';

// Be resilient on slow / loaded CI machines: give async helpers more headroom.
configure({ asyncUtilTimeout: 10000 });

// AsyncStorage: use the library's official in-memory jest mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Safe-area insets — return a fixed inset so screens can lay out without a provider.
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => insets,
  };
});

// i18n — translate by echoing the key so assertions can target stable strings.
// Keys listed in the global `__i18nEmpty` set resolve to '' so tests can drive
// the `t('x') || 'fallback'` branches in the components.
jest.mock('react-i18next', () => {
  const React = require('react');
  return {
    useTranslation: () => ({
      t: (key: string) => {
        const empty: string[] = (globalThis as Record<string, unknown>)
          .__i18nEmpty as string[] | undefined ?? [];
        return empty.includes(key) ? '' : key;
      },
      i18n: { changeLanguage: jest.fn() },
    }),
    I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Silence the noisy "useNativeDriver" warning from the Animated mock.
jest.spyOn(console, 'warn').mockImplementation(() => undefined);
