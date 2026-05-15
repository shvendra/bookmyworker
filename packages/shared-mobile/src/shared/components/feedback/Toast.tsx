import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../ui/AppText';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  id: string;
  message: string;
  title?: string;
  type: ToastType;
  onDismiss: () => void;
  stackIndex?: number; // 0 = bottom-most (most recent)
}

const TYPE_CONFIG: Record<ToastType, { bg: string; border: string; icon: string; titleColor: string; msgColor: string }> = {
  success: { bg: '#F0FDF4', border: '#16A34A', icon: '✅', titleColor: '#15803D', msgColor: '#166534' },
  error:   { bg: '#FEF2F2', border: '#DC2626', icon: '❌', titleColor: '#DC2626', msgColor: '#7F1D1D' },
  warning: { bg: '#FFFBEB', border: '#D97706', icon: '⚠️', titleColor: '#D97706', msgColor: '#78350F' },
  info:    { bg: '#EFF6FF', border: '#2563EB', icon: 'ℹ️', titleColor: '#1D4ED8', msgColor: '#1E3A8A' },
};

const { width: W } = Dimensions.get('window');

export const Toast = ({ message, title, type, onDismiss, stackIndex = 0 }: ToastProps): React.JSX.Element => {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const cfg = TYPE_CONFIG[type];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY, {
        toValue: 0,
        tension: 60,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideY, opacity]);

  const dismiss = (): void => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: 120, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(onDismiss);
  };

  const bottomOffset = insets.bottom + 80 + stackIndex * 72;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: bottomOffset,
          transform: [{ translateY: slideY }],
          opacity,
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={dismiss}
        style={[
          styles.pill,
          {
            backgroundColor: cfg.bg,
            borderColor: cfg.border,
          },
          styles.shadow,
        ]}
      >
        <AppText style={styles.icon}>{cfg.icon}</AppText>
        <View style={styles.textBlock}>
          {title ? (
            <AppText variant="labelSm" color={cfg.titleColor} style={styles.title}>
              {title}
            </AppText>
          ) : null}
          <AppText variant="caption" color={cfg.msgColor} style={styles.message} numberOfLines={3}>
            {message}
          </AppText>
        </View>
        <Pressable onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <AppText style={[styles.close, { color: cfg.titleColor }]}>✕</AppText>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    maxWidth: W - 32,
  },
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  icon: { fontSize: 20, lineHeight: 24 },
  textBlock: { flex: 1, gap: 2 },
  title: { lineHeight: 17 },
  message: { lineHeight: 17 },
  close: { fontSize: 14, fontWeight: '700', opacity: 0.6 },
});
