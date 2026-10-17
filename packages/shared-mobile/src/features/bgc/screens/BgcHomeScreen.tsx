import React from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useAppTheme } from '../../../core/theme';
import { bgcSlabPrice, bgcSlabRange, computeBgcQuote, useBgcConfig } from '../../../core/api/endpoints/bgcApi';
import { bgcFmtCount, bgcInr } from '../bgcShared';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'BgcHome'>;
const BRAND = '#1037A4';

export const BgcHomeScreen = ({ navigation }: Props): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const { config, isLoading } = useBgcConfig();
  const one = computeBgcQuote(config, 1);
  const off = config.mrpPerWorker && config.pricePerWorker && config.mrpPerWorker > config.pricePerWorker
    ? Math.round(((config.mrpPerWorker - config.pricePerWorker) / config.mrpPerWorker) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader title={t('bgc_title')} onBack={() => navigation.goBack()} />
      {isLoading ? (
        <View style={s.center}><ActivityIndicator color={BRAND} /></View>
      ) : !config.enabled ? (
        <View style={s.center} testID="bgc-unavailable">
          <Ionicons name="shield-outline" size={40} color="#94a3b8" />
          <AppText style={[s.muted, { color: theme.colors.mutedText, textAlign: 'center' }]}>{t('bgc_unavailable')}</AppText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={s.hero}>
            <Ionicons name="shield-checkmark" size={30} color="#fff" />
            <AppText style={s.heroTitle}>{config.headline || t('bgc_title')}</AppText>
            {!!config.tagline && <AppText style={s.heroSub}>{config.tagline}</AppText>}
            {(config.verifiedCount ?? 0) > 0 && <AppText testID="bgc-verified-count" style={s.heroCount}>✓ {t('bgc_verifiedCount', { count: bgcFmtCount(config.verifiedCount!) })}</AppText>}
          </View>

          <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} testID="bgc-price-card">
            <View style={s.row}>
              <AppText style={[s.price, { color: theme.colors.text }]}>{bgcInr(config.pricePerWorker ?? 0)}</AppText>
              {off > 0 && <AppText style={s.mrp}>{bgcInr(config.mrpPerWorker ?? 0)}</AppText>}
              {off > 0 && <View style={s.off}><AppText style={s.offTxt}>{t('bgc_pctOff', { percent: off })}</AppText></View>}
            </View>
            <AppText style={[s.muted, { color: theme.colors.mutedText }]}>
              {t('bgc_perWorkerGst', { gst: config.gstPercent ?? 0, total: bgcInr(one.total) })}
            </AppText>
            <AppText style={[s.muted, { color: theme.colors.mutedText, marginTop: 6 }]}>
              {t('bgc_timeline', { min: config.turnaroundMinDays, max: config.turnaroundMaxDays })}
            </AppText>
            {(config.priceTiers ?? []).length > 0 && (
              <View style={s.slabs} testID="bgc-slabs">
                {(config.priceTiers ?? []).map((tr, i) => (
                  <View key={i} style={[s.slabRow, i % 2 === 1 && { backgroundColor: 'rgba(16,55,164,0.06)' }]}>
                    <View style={{ flex: 1 }}>
                      <AppText style={[s.slabName, { color: theme.colors.text }]}>{tr.name || bgcSlabRange(tr)}</AppText>
                      <AppText style={[s.muted, { color: theme.colors.mutedText }]}>
                        {tr.name ? bgcSlabRange(tr) : ''}{tr.contractOnly ? `${tr.name ? ' · ' : ''}${t('bgc_asPerContract')}` : ''}
                      </AppText>
                    </View>
                    <AppText style={s.slabPrice}>{bgcSlabPrice(tr)}</AppText>
                  </View>
                ))}
              </View>
            )}
            {!(config.priceTiers ?? []).length && (config.bulkDiscounts ?? []).map((b) => (
              <AppText key={b.minWorkers} style={s.bulk}>{t('bgc_bulkOffer', { percent: b.percent, count: b.minWorkers })}</AppText>
            ))}
          </View>

          {(config.benefits ?? []).map((b) => (
            <View key={b} style={s.benefit}>
              <Ionicons name="checkmark-circle" size={18} color="#15803d" />
              <AppText style={[s.benefitTxt, { color: theme.colors.text }]}>{b}</AppText>
            </View>
          ))}

          <AppButton title={config.promo?.cta || t('bgc_start')} onPress={() => navigation.navigate('BgcEnroll')} fullWidth style={{ marginTop: 18 }} />
          <TouchableOpacity onPress={() => navigation.navigate('BgcOrders')} style={s.link} accessibilityRole="button">
            <AppText style={s.linkTxt}>{t('bgc_myVerifications')}</AppText>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  slabs:      { marginTop: 10, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, overflow: 'hidden' },
  slabRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  slabName:   { fontSize: 13, fontWeight: '800' },
  slabPrice:  { fontSize: 15, fontWeight: '900', color: BRAND },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  hero:       { backgroundColor: BRAND, borderRadius: 16, padding: 18, gap: 6, marginBottom: 14 },
  heroTitle:  { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub:    { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  heroCount:  { color: '#86efac', fontSize: 13, fontWeight: '800', marginTop: 2 },
  card:       { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  price:      { fontSize: 26, fontWeight: '900' },
  mrp:        { fontSize: 14, color: '#94a3b8', textDecorationLine: 'line-through' },
  off:        { backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  offTxt:     { color: '#15803d', fontSize: 11, fontWeight: '800' },
  muted:      { fontSize: 12.5 },
  bulk:       { color: '#b45309', fontSize: 12, fontWeight: '700', marginTop: 6 },
  benefit:    { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 8 },
  benefitTxt: { flex: 1, fontSize: 13.5 },
  link:       { alignItems: 'center', padding: 14 },
  linkTxt:    { color: BRAND, fontWeight: '800', fontSize: 14 },
});
