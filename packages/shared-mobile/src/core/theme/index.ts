import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors } from './colors';

type ThemeMode = 'light' | 'dark';

export interface AppTheme {
  mode: ThemeMode;
  colors: typeof lightColors;
  spacing: {
    xs: number;   // 4
    sm: number;   // 8
    md: number;   // 12
    lg: number;   // 16
    xl: number;   // 24
    xxl: number;  // 32
    xxxl: number; // 48
  };
  radius: {
    xs: number;   // 4
    sm: number;   // 8
    md: number;   // 12
    lg: number;   // 16
    xl: number;   // 20
    xxl: number;  // 28
    full: number; // 999
  };
  fontSize: {
    xs: number;   // 11
    sm: number;   // 12
    md: number;   // 14
    base: number; // 15
    lg: number;   // 17
    xl: number;   // 20
    xxl: number;  // 24
    xxxl: number; // 28
    display: number; // 34
  };
  shadow: {
    xs: object;
    sm: object;
    md: object;
    lg: object;
    xl: object;
  };
}

interface ThemeContextValue {
  theme: AppTheme;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const makeShadow = (color: string, neutralColor: string, mode: ThemeMode) => {
  if (mode === 'dark') {
    return {
      xs: {},
      sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
      },
      md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
      },
      lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
      },
      xl: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
        elevation: 16,
      },
    };
  }
  // Light mode — brand-colored shadows for primary elements, neutral for cards
  return {
    xs: {
      shadowColor: neutralColor,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 1,
    },
    sm: {
      shadowColor: neutralColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    md: {
      shadowColor: neutralColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 4,
    },
    lg: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.14,
      shadowRadius: 20,
      elevation: 8,
    },
    xl: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 32,
      elevation: 16,
    },
  };
};

export const ThemeProvider = ({
  children,
  primaryOverride,
}: React.PropsWithChildren<{ primaryOverride?: string }>): React.JSX.Element => {
  const systemMode = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>(systemMode === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    setThemeMode(systemMode === 'dark' ? 'dark' : 'light');
  }, [systemMode]);

  const value = useMemo<ThemeContextValue>(() => {
    const baseColors = themeMode === 'dark' ? darkColors : lightColors;
    const colors = primaryOverride
      ? {
          ...baseColors,
          primary: primaryOverride,
          primaryMid: primaryOverride,
          primaryDark: primaryOverride,
          primaryLight: primaryOverride + '18',
          borderFocus: primaryOverride,
          info: primaryOverride,
          infoLight: primaryOverride + '18',
          tabBarActive: primaryOverride,
        }
      : baseColors;

    return {
      theme: {
        mode: themeMode,
        colors,
        spacing: {
          xs: 4,
          sm: 8,
          md: 12,
          lg: 16,
          xl: 24,
          xxl: 32,
          xxxl: 48,
        },
        radius: {
          xs: 4,
          sm: 8,
          md: 12,
          lg: 16,
          xl: 20,
          xxl: 28,
          full: 999,
        },
        fontSize: {
          xs: 11,
          sm: 12,
          md: 14,
          base: 15,
          lg: 17,
          xl: 20,
          xxl: 24,
          xxxl: 28,
          display: 34,
        },
        shadow: makeShadow(colors.shadow, colors.shadowNeutral, themeMode),
      },
      setThemeMode,
    };
  }, [themeMode]);

  return React.createElement(ThemeContext.Provider, { value }, children);
};

export const useAppTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme must be used inside ThemeProvider');
  return context;
};
