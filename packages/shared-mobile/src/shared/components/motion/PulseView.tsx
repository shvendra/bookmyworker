import React, { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

interface PulseViewProps {
  children: React.ReactNode;
  /** Turn the pulse off without unmounting (e.g. while a request is in flight). */
  active?: boolean;
  scaleTo?: number;
  period?: number;
  style?: StyleProp<ViewStyle>;
}

/** A slow, gentle "breathing" scale — draws the eye to a call-to-action without being loud. */
export const PulseView = ({ children, active = true, scaleTo = 1.04, period = 1700, style }: PulseViewProps): React.JSX.Element => {
  const reduce = useReduceMotion();
  const s = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active || reduce) { s.setValue(1); return undefined; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(s, { toValue: scaleTo, duration: period / 2, useNativeDriver: true }),
        Animated.timing(s, { toValue: 1, duration: period / 2, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduce, scaleTo, period, s]);

  return <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>;
};
