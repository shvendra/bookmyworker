/**
 * Skeleton — lightweight shimmer placeholder for loading states.
 * Uses Animated API (no external dependencies).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../../core/theme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const Skeleton = ({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.skeletonBase,
          opacity,
        },
        style,
      ]}
    />
  );
};

// ── Pre-built skeleton layouts ────────────────────────────────────────────────

export const SkeletonCard = ({ lines = 3 }: { lines?: number }): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        skStyles.card,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
      ]}
    >
      <View style={skStyles.topRow}>
        <Skeleton width={44} height={44} borderRadius={22} />
        <View style={skStyles.titleBlock}>
          <Skeleton width="60%" height={14} borderRadius={7} />
          <Skeleton width="40%" height={11} borderRadius={6} style={{ marginTop: 6 }} />
        </View>
      </View>
      {Array.from({ length: lines - 1 }, (_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 2 ? '70%' : '100%'}
          height={12}
          borderRadius={6}
          style={{ marginTop: 10 }}
        />
      ))}
    </View>
  );
};

export const SkeletonStatGrid = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View style={skStyles.grid}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[skStyles.statBox, { backgroundColor: theme.colors.card }]}>
          <Skeleton width={42} height={42} borderRadius={13} />
          <Skeleton width="70%" height={20} borderRadius={8} style={{ marginTop: 10 }} />
          <Skeleton width="50%" height={12} borderRadius={6} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
};

const skStyles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  titleBlock: {
    flex: 1,
    gap: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 18,
    padding: 14,
  },
});
