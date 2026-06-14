import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAppTheme } from '../../../core/theme';
import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent' | 'success' | 'teal';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: string;
  iconRight?: string;
  fullWidth?: boolean;
}

export const AppButton = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  icon,
  iconRight,
  fullWidth = false,
}: AppButtonProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const isDark = theme.mode === 'dark';

  const handlePressIn = (): void => {
    Animated.spring(scale, {
      toValue: 0.965,
      useNativeDriver: true,
      speed: 60,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = (): void => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  type VariantStyle = {
    bg: string;
    bg2?: string;   // second layer for fake gradient
    text: string;
    border: string;
    shadow?: object;
  };

  const variantMap: Record<ButtonVariant, VariantStyle> = {
    primary: {
      bg: theme.colors.primary,
      bg2: theme.colors.gradientEnd,
      text: '#FFFFFF',
      border: 'transparent',
      shadow: isDark ? {} : {
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.30,
        shadowRadius: 14,
        elevation: 8,
      },
    },
    accent: {
      bg: '#F97316',
      bg2: '#EA580C',
      text: '#FFFFFF',
      border: 'transparent',
      shadow: isDark ? {} : {
        shadowColor: '#F97316',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 12,
        elevation: 6,
      },
    },
    teal: {
      bg: theme.colors.teal,
      bg2: '#0E7490',
      text: '#FFFFFF',
      border: 'transparent',
      shadow: isDark ? {} : {
        shadowColor: theme.colors.teal,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
      },
    },
    secondary: {
      bg: isDark ? theme.colors.surface1 : theme.colors.primaryLight,
      text: theme.colors.primary,
      border: theme.colors.primary + '30',
    },
    outline: {
      bg: 'transparent',
      text: theme.colors.primary,
      border: theme.colors.primary,
    },
    ghost: {
      bg: 'transparent',
      text: theme.colors.mutedText,
      border: 'transparent',
    },
    danger: {
      bg: isDark ? theme.colors.dangerLight : theme.colors.dangerLight,
      text: theme.colors.danger,
      border: theme.colors.danger + '35',
    },
    success: {
      bg: theme.colors.successLight,
      text: theme.colors.success,
      border: theme.colors.success + '35',
    },
  };

  const heightMap: Record<ButtonSize, number> = { xs: 30, sm: 38, md: 50, lg: 56 };
  const fontSizeMap: Record<ButtonSize, number> = { xs: 12, sm: 13, md: 15, lg: 16 };
  const paddingMap: Record<ButtonSize, number> = { xs: 12, sm: 14, md: 20, lg: 24 };
  const radiusMap: Record<ButtonSize, number> = { xs: 8, sm: 10, md: 14, lg: 16 };

  const { bg, bg2, text, border, shadow } = variantMap[variant];
  const isGradient = !!bg2 && !disabled;
  const minHeight = heightMap[size];
  const fontSize = fontSizeMap[size];
  const paddingH = paddingMap[size];
  const radius = radiusMap[size];

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={{ alignSelf: fullWidth ? 'stretch' : 'auto' }}
    >
      <Animated.View
        style={[
          styles.button,
          {
            backgroundColor: bg,
            borderColor: border,
            borderWidth: border === 'transparent' ? 0 : 1.5,
            minHeight,
            paddingHorizontal: paddingH,
            borderRadius: radius,
            opacity: disabled ? 0.42 : 1,
            transform: [{ scale }],
          },
          shadow,
          style,
        ]}
      >
        {/* Fake gradient overlay for primary/accent/teal */}
        {isGradient && (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: radius,
                backgroundColor: bg2,
                opacity: 0.4,
                // right-side lighter feel
              },
            ]}
            pointerEvents="none"
          />
        )}
        {loading ? (
          <ActivityIndicator color={text} size="small" />
        ) : (
          <View style={styles.content}>
            {icon ? (
              <AppText style={[styles.icon, { fontSize: fontSize + 1 }]}>{icon}</AppText>
            ) : null}
            <AppText
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[
                styles.label,
                {
                  color: text,
                  fontSize,
                  fontWeight: size === 'xs' || size === 'sm' ? '600' : '700',
                  flexShrink: 1,
                },
              ]}
            >
              {title}
            </AppText>
            {iconRight ? (
              <AppText style={[styles.icon, { fontSize: fontSize + 1 }]}>{iconRight}</AppText>
            ) : null}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    zIndex: 1,
  },
  icon: { lineHeight: 22 },
  label: { letterSpacing: 0.2 },
});
