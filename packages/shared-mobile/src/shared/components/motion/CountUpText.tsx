import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { AppText } from '../ui/AppText';
import { useReduceMotion } from './useReduceMotion';
import { countUpValue, formatIndian } from './motionMath';

type AppTextProps = React.ComponentProps<typeof AppText>;

interface CountUpTextProps extends Omit<AppTextProps, 'children'> {
  /** Target number. A later change animates from the number currently shown. */
  value: number;
  duration?: number;
  /** Shown before / after the number, e.g. "₹" or "+". */
  prefix?: string;
  suffix?: string;
  format?: (n: number) => string;
}

/** A number that counts up to `value` (Indian digit grouping by default). Snaps straight there under "Reduce motion". */
export const CountUpText = ({ value, duration = 900, prefix = '', suffix = '', format = formatIndian, ...textProps }: CountUpTextProps): React.JSX.Element => {
  const reduce = useReduceMotion();
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  const driver = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    if (reduce || duration <= 0) { shownRef.current = target; setShown(target); return undefined; }
    const from = shownRef.current;
    if (from === target) return undefined;
    driver.setValue(0);
    const id = driver.addListener(({ value: elapsed }) => {
      const next = countUpValue(from, target, elapsed, duration);
      if (next !== shownRef.current) { shownRef.current = next; setShown(next); }
    });
    const anim = Animated.timing(driver, { toValue: duration, duration, easing: Easing.linear, useNativeDriver: false });
    anim.start(({ finished }) => { if (finished) { shownRef.current = target; setShown(target); } });
    return () => { anim.stop(); driver.removeListener(id); };
  }, [value, duration, reduce, driver]);

  return <AppText {...textProps}>{`${prefix}${format(shown)}${suffix}`}</AppText>;
};
