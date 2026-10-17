import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

interface FloatViewProps {
  children?: React.ReactNode;
  /** Travel distance in px (up and back). */
  distance?: number;
  period?: number;
  /** Stagger several floaters so they never move in lockstep. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/** A slow, endless up-and-down drift — for decorative shapes in hero cards. Still under "Reduce motion". */
export const FloatView = ({ children, distance = 7, period = 3400, delay = 0, style }: FloatViewProps): React.JSX.Element => {
  const reduce = useReduceMotion();
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduce) { y.setValue(0); return undefined; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(y, { toValue: -distance, duration: period / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: period / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, distance, period, delay, y]);

  return <Animated.View style={[style, { transform: [{ translateY: y }] }]}>{children}</Animated.View>;
};
