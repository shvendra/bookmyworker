import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '../../../shared/components/ui/AppText';
import { PremiumCtaButton } from '../../../shared/components/ui/PremiumCtaButton';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

/**
 * Dashboard "Upgrade to Premium" card (non-subscribers): dark navy + gold premium panel. Fades in, rocket floats,
 * then the premium CTA pulses.
 */
export const UpgradeBanner = ({ onUpgrade }: { onUpgrade: () => void }): React.JSX.Element => {
  const { t } = useTranslation('employer');

  const enter = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [enter, float]);

  return (
    <Animated.View
      style={[s.shadow, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}
    >
      <LinearGradient colors={['#071433', '#0D2468', '#1037A4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
        <LinearGradient colors={['#F5C451', '#FFE9A8', '#F5C451']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.goldLine} />
        <View style={s.glowA} pointerEvents="none" />
        <View style={s.glowB} pointerEvents="none" />

        <View style={s.pill}>
          <Ionicons name="diamond" size={11} color="#F5C451" />
          <AppText style={s.pillTxt}>{t('upgradePill')}</AppText>
        </View>

        <View style={s.header}>
          <Animated.View
            style={[s.iconWrap, { transform: [
              { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [2, -4] }) },
              { rotate: float.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] }) },
            ] }]}
          >
            <AppText style={s.icon}>🚀</AppText>
          </Animated.View>
          <AppText style={s.title}>{t('upgradeToPremium')}</AppText>
        </View>

        <AppText style={s.desc}>{t('upgradeBannerDesc')}</AppText>

        <PremiumCtaButton label={t('upgradeNow')} onPress={onUpgrade} />
      </LinearGradient>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  shadow: { marginBottom: 14, borderRadius: 20, elevation: 6, shadowColor: '#0A1B47', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  card: { borderRadius: 20, padding: 18, paddingTop: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(245,196,81,0.35)' },
  goldLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  glowA: { position: 'absolute', top: -60, right: -40, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(96,165,250,0.18)' },
  glowB: { position: 'absolute', bottom: -70, left: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(245,196,81,0.10)' },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(245,196,81,0.14)', borderWidth: 1, borderColor: 'rgba(245,196,81,0.5)', marginBottom: 12 },
  pillTxt: { color: '#F5C451', fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1.5, borderColor: 'rgba(245,196,81,0.7)' },
  icon: { fontSize: 26, lineHeight: 34, textAlign: 'center' },
  title: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '800', lineHeight: 24 },
  desc: { color: 'rgba(255,255,255,0.85)', fontSize: 13.5, lineHeight: 20, marginBottom: 18 },
});
