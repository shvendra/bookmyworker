import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppText } from '../../../shared/components/ui/AppText';
import { CountUpText } from '../../../shared/components/motion';
import { useAppConfig } from '../../../core/api/endpoints/appConfigApi';
import { isNeverSubscribed } from '../utils/happyCustomers';

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
        <AppText style={s.sub}>{t('hc_sub')}</AppText>
        <TouchableOpacity onPress={onViewPlans} activeOpacity={0.88} style={s.cta} accessibilityRole="button" testID="happy-cta">
          <AppText style={s.ctaTxt}>{t('hc_cta')}</AppText>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  // Same rhythm as the neighbouring dashboard cards: no top margin (the block above ends with marginBottom 14), 14 below,
  // and no extra side margin (the screen already pads its content) so it lines up with them.
  card:   { flexDirection: 'row', gap: 14, marginBottom: 14, padding: 16, borderRadius: 18, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#DBE6FF' },
  seal:   { width: 56, height: 56, borderRadius: 28, backgroundColor: '#0A1B47', alignItems: 'center', justifyContent: 'center' },
  body:   { flex: 1 },
  kicker: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', color: '#1D4ED8' },
  row:    { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  count:  { fontSize: 28, fontWeight: '900', color: '#0A1B47' },
  title:  { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  stars:  { flexDirection: 'row', gap: 2, marginTop: 4 },
  sub:    { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 4, lineHeight: 17 },
  cta:    { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: '#0A1B47', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  ctaTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
