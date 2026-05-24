import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../ui/AppText';

const LOGO = require('../../../../assets/logo.png') as number;

interface LoadingStateProps {
  label?: string;
  message?: string;
  /** Show fullscreen centered layout */
  fullscreen?: boolean;
}

export const LoadingState = ({ label, message, fullscreen = true }: LoadingStateProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const text = message ?? label;

  // Pulsing dot animation
  const pulse1 = useRef(new Animated.Value(0.4)).current;
  const pulse2 = useRef(new Animated.Value(0.4)).current;
  const pulse3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = (val: Animated.Value, delay: number): Animated.CompositeAnimation =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.4, duration: 400, useNativeDriver: true }),
          Animated.delay(400),
        ])
      );

    const a1 = anim(pulse1, 0);
    const a2 = anim(pulse2, 160);
    const a3 = anim(pulse3, 320);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [pulse1, pulse2, pulse3]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background },
        !fullscreen && styles.inline,
      ]}
    >
      <Image source={LOGO} style={styles.logo} resizeMode="cover" />

      {/* Bouncing dots */}
      <View style={styles.dotsRow}>
        {[pulse1, pulse2, pulse3].map((p, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: theme.colors.primary, opacity: p },
            ]}
          />
        ))}
      </View>

      {text ? (
        <AppText variant="caption" color={theme.colors.mutedText} style={styles.label} center>
          {text}
        </AppText>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  inline: {
    flex: 0,
    paddingVertical: 40,
  },
  logo: { width: 64, height: 64, borderRadius: 20 },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: { lineHeight: 20 },
});
