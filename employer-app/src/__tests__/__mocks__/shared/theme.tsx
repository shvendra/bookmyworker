// Theme mock. `__themeState.mode` is mutable so tests can flip dark/light.
import React from 'react';

export const __themeState: { mode: 'light' | 'dark' } = { mode: 'light' };

const baseColors = {
  primary: '#1037A4',
  background: '#FFFFFF',
  surface: '#F4F6FB',
  card: '#FFFFFF',
  text: '#111827',
  textSecondary: '#475569',
  mutedText: '#94A3B8',
  border: '#E2E8F0',
  secondary: '#F97316',
};

export const useAppTheme = () => ({
  theme: { mode: __themeState.mode, colors: baseColors },
});

export const ThemeProvider = ({
  children,
}: {
  children: React.ReactNode;
  primaryOverride?: string;
}): React.ReactNode => children;
