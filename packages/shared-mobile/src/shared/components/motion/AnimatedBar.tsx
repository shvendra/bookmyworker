import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

interface AnimatedBarProps {
  /** 0–100. */
  percent: number;
  style?: StyleProp<ViewStyle>;
  duration?: number;
  delay?: number;
}

/** A progress fill that grows from empty to `percent`. Jumps straight there under "Reduce motion". */
export const AnimatedBar = ({ percent, style, duration = 900, delay = 250 }: AnimatedBarProps): React.JSX.Element => {
  const reduce = useReduceMotion();
  const w = useRef(new Animated.Value(0)).current;
  const target = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));

  useEffect(() => {
    if (reduce) { w.setValue(target); return undefined; }
    const anim = Animated.timing(w, { toValue: target, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [target, reduce, duration, delay, w]);

  return <Animated.View style={[style, { width: w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />;
};
