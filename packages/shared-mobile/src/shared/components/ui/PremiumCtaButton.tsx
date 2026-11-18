import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';

import { BRAND } from '../../../core/theme/brand';
interface Props {
  label: string;
  onPress: () => void;
}

/**
 * Attention-grabbing "Upgrade" button: deep-blue gradient, gold border glow
 * that pulses outward, a light sweep, a bobbing arrow and a sparkle icon.
 * All loops are native-driver and stop on unmount.
 */
export const PremiumCtaButton = ({ label, onPress }: Props): React.JSX.Element => {
  const pulse = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const [w, setW] = useState(300);

  useEffect(() => {
    const loops = [
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(halo, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(halo, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.delay(500),
        Animated.timing(sweep, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(900),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [pulse, halo, sweep]);

  const pressTo = (v: number): void => { Animated.spring(press, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start(); };
  const scale = Animated.multiply(press, pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }));
  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-100, w + 50] });
  const arrowX = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });
  const sparkle = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.2] });

  return (
    <View style={s.root}>
      <Animated.View pointerEvents="none" style={[s.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />
      <Animated.View style={{ transform: [{ scale }] }}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={() => pressTo(0.96)}
          onPressOut={() => pressTo(1)}
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
          activeOpacity={0.92}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={s.btn}
        >
          <LinearGradient colors={['#1D4ED8', BRAND, '#0B1F6B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Animated.View pointerEvents="none" style={[s.shine, { transform: [{ translateX: sweepX }, { skewX: '-20deg' }] }]} />
          <View style={s.row}>
            <Animated.View style={{ transform: [{ scale: sparkle }] }}>
              <Ionicons name="sparkles" size={18} color="#FCD34D" />
            </Animated.View>
            <AppText style={s.txt}>{label}</AppText>
            <Animated.View style={{ transform: [{ translateX: arrowX }] }}>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Animated.View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const s = StyleSheet.create({
  root: { width: '100%', justifyContent: 'center' },
  halo: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 16, borderWidth: 2, borderColor: '#F59E0B' },
  btn: {
    borderRadius: 16, paddingVertical: 16, alignItems: 'center', overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#F59E0B',
    shadowColor: BRAND, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
  },
  shine: { position: 'absolute', top: -10, bottom: -10, width: 46, backgroundColor: 'rgba(255,255,255,0.3)' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  txt: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.4 },
});
