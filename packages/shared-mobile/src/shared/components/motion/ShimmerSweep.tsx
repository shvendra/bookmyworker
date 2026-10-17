import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useReduceMotion } from './useReduceMotion';

interface ShimmerSweepProps {
  /** Pause between sweeps (ms). */
  rest?: number;
  duration?: number;
  /** Highlight colour of the sweep. */
  tint?: string;
}

/**
 * A soft light sweep that glides across its parent every few seconds.
 * Drop it as the LAST child of a card that has `overflow: 'hidden'`; it never captures touches.
 */
export const ShimmerSweep = ({ rest = 2600, duration = 1100, tint = 'rgba(255,255,255,0.28)' }: ShimmerSweepProps): React.JSX.Element | null => {
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const BAR = 90;

  useEffect(() => {
    if (reduce || w <= 0) return undefined;
    x.setValue(-BAR);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: w + BAR, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(rest),
        Animated.timing(x, { toValue: -BAR, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, w, rest, duration, x]);

  if (reduce) return null;
  return (
    <Animated.View
      pointerEvents="none"
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={StyleSheet.absoluteFill}
    >
      <Animated.View style={[styles.bar, { width: BAR, transform: [{ translateX: x }, { skewX: '-18deg' }] }]}>
        <LinearGradient colors={['transparent', tint, 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});
