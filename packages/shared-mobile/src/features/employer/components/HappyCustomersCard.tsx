import React from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppText } from '../../../shared/components/ui/AppText';
import { CountUpText, useReduceMotion } from '../../../shared/components/motion';
import { useAppConfig } from '../../../core/api/endpoints/appConfigApi';
import { isNeverSubscribed } from '../utils/happyCustomers';
import { PremiumCtaButton } from '../../../shared/components/ui/PremiumCtaButton';

// Dotted India map (assets/india-dots.png) + city pins as [left%, top%, delay] inside the map box.
const INDIA_MAP = require('../../../../assets/india-dots.png');
const PINS: Array<[number, number, number]> = [
  [31.8, 29.7, 0], [17.7, 61.3, 500], [33.1, 81.8, 1000], [68.5, 49.7, 300], [42, 81.3, 1300], [57.7, 39.7, 800],
];

/** Small city marker with a soft expanding ring. Static under Reduce Motion. */
const Pin = ({ left, top, delay }: { left: number; top: number; delay: number }): React.JSX.Element => {
  const reduce = useReduceMotion();
  const ring = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (reduce) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(ring, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduce, delay, ring]);
  return (
    <View style={[s.pin, { left: `${left}%`, top: `${top}%` }]}>
      {!reduce && (
        <Animated.View
          style={[s.pinRing, { opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 3.5] }) }] }]}
        />
      )}
      <View style={s.pinDot} />
    </View>
  );
};

export { isNeverSubscribed };

/**
 * Social-proof card for employers who have never taken a plan (mirrors the CRM "Happy Customers" banner).
 * The figure is the SuperAdmin-controlled Settings → Live Statistics value (default 21,000).
 */
export const HappyCustomersCard = ({ onViewPlans }: { onViewPlans: () => void }): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { config } = useAppConfig();
  // Happy Customers base (Settings) + real employers — computed by the server, same as CRM / website.
  const total = config?.stats?.happyCustomers > 0 ? config.stats.happyCustomers : 21000;
  return (
    <View style={s.card} testID="happy-customers">
      <View style={s.map} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
        <Image source={INDIA_MAP} style={s.mapImg} resizeMode="contain" />
        {PINS.map(([l, t2, d], i) => <Pin key={i} left={l} top={t2} delay={d} />)}
      </View>
      <View style={s.top}>
        <View style={s.seal}><Ionicons name="shield-checkmark" size={30} color="#fff" /></View>
        <View style={s.body}>
          <AppText style={s.kicker}>{t('hc_kicker')}</AppText>
          <View style={s.row}>
            <CountUpText value={total} suffix="+" style={s.count} testID="happy-count" />
            <AppText style={s.title}>{t('hc_title')}</AppText>
          </View>
          <View style={s.stars}>
            {[0, 1, 2, 3, 4].map((i) => <Ionicons key={i} name="star" size={14} color="#f59e0b" />)}
          </View>
        </View>
      </View>
      <AppText style={s.sub}>{t('hc_sub')}</AppText>
      <View style={s.ctaWrap}><PremiumCtaButton label={t('hc_cta')} onPress={onViewPlans} /></View>
    </View>
  );
};

const s = StyleSheet.create({
  // Same rhythm as the neighbouring dashboard cards: no top margin (the block above ends with marginBottom 14), 14 below,
  // and no extra side margin (the screen already pads its content) so it lines up with them.
  map:    { position: 'absolute', right: 10, top: 8, height: 150, aspectRatio: 1.016 },
  mapImg: { width: '100%', height: '100%', opacity: 0.3 },
  pin:    { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  pinDot: { position: 'absolute', width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#F59E0B' },
  pinRing:{ position: 'absolute', width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#F59E0B' },
  card:   { overflow: 'hidden', marginBottom: 14, padding: 16, borderRadius: 18, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#DBE6FF' },
  top:    { flexDirection: 'row', gap: 14, alignItems: 'center' },
  seal:   { width: 56, height: 56, borderRadius: 28, backgroundColor: '#0A1B47', alignItems: 'center', justifyContent: 'center' },
  body:   { flex: 1 },
  kicker: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', color: '#1D4ED8' },
  row:    { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  count:  { fontSize: 28, fontWeight: '900', color: '#0A1B47' },
  title:  { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  stars:  { flexDirection: 'row', gap: 2, marginTop: 4 },
  sub:    { fontSize: 13, color: '#475569', fontWeight: '600', marginTop: 12, lineHeight: 19 },
  ctaWrap: { marginTop: 12 },
});
