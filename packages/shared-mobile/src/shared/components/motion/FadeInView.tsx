import React, { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

interface FadeInViewProps {
  children: React.ReactNode;
  /** Stagger — ms to wait before this block starts. */
  delay?: number;
  duration?: number;
  /** How far (px) the block rises while fading in. */
  distance?: number;
  style?: StyleProp<ViewStyle>;
}

/** Fades + lifts its children in once, when first mounted. Static under "Reduce motion". */
export const FadeInView = ({ children, delay = 0, duration = 420, distance = 14, style }: FadeInViewProps): React.JSX.Element => {
  const reduce = useReduceMotion();
  const p = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) { p.setValue(1); return undefined; }
    const anim = Animated.timing(p, { toValue: 1, duration, delay, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [reduce, p, delay, duration]);

  return (
    <Animated.View
      style={[
        style,
        { opacity: p, transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
};
