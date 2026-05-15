import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../../core/theme';

type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled' | 'flat' | 'glass';

interface AppCardProps extends React.PropsWithChildren {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  noPadding?: boolean;
  variant?: CardVariant;
  /** Accent color for left border indicator */
  accentColor?: string;
  /** Tighter press scale (default: 0.99) */
  pressScale?: number;
}

export const AppCard = ({
  children,
  onPress,
  style,
  noPadding = false,
  variant = 'default',
  accentColor,
  pressScale = 0.985,
}: AppCardProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const isDark = theme.mode === 'dark';
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = (): void => {
    if (!onPress) return;
    Animated.spring(scale, { toValue: pressScale, useNativeDriver: true, speed: 50, bounciness: 3 }).start();
  };
  const handlePressOut = (): void => {
    if (!onPress) return;
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 35, bounciness: 5 }).start();
  };

  const variantStyles: Record<CardVariant, object> = {
    default: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: isDark ? theme.colors.border : '#E2E8F4',
      shadowColor: isDark ? '#000' : '#8896B0',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.25 : 0.07,
      shadowRadius: 8,
      elevation: 2,
    },
    elevated: {
      backgroundColor: theme.colors.card,
      borderWidth: 0,
      shadowColor: isDark ? '#000' : '#1A56DB',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.10,
      shadowRadius: 16,
      elevation: 5,
    },
    outlined: {
      backgroundColor: theme.colors.card,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    filled: {
      backgroundColor: isDark ? theme.colors.surface1 : theme.colors.primaryLight,
      borderWidth: 0,
    },
    flat: {
      backgroundColor: theme.colors.card,
      borderWidth: 0,
    },
    glass: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.4 : 0.08,
      shadowRadius: 16,
      elevation: 4,
    },
  };

  const inner = (
    <Animated.View
      style={[
        styles.card,
        variantStyles[variant],
        noPadding && styles.noPadding,
        accentColor && styles.withAccent,
        { transform: [{ scale }] },
        style,
      ]}
    >
      {accentColor && (
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      )}
      {children}
    </Animated.View>
  );

  if (!onPress) return inner;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {inner}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  noPadding: { padding: 0 },
  withAccent: { paddingLeft: 20 },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
});
