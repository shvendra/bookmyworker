import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppText } from '../../../shared/components/ui/AppText';
import { useBgcConfig } from '../../../core/api/endpoints/bgcApi';
import { bgcFmtCount, bgcInr } from '../bgcShared';

/** Dashboard advertisement for Police Verification. Renders nothing unless SuperAdmin has enabled the service. */
export const BgcPromoCard = ({ onPress }: { onPress: () => void }): React.JSX.Element | null => {
  const { t } = useTranslation('employer');
  const { config } = useBgcConfig();
  if (!config.enabled) return null;
  const headline = config.promo?.headline || config.headline || t('bgc_title');
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={s.card} accessibilityRole="button" testID="bgc-promo">
      <View style={s.icon}><Ionicons name="shield-checkmark" size={24} color="#fff" /></View>
      <View style={{ flex: 1 }}>
        <AppText style={s.title} numberOfLines={2}>{headline}</AppText>
        {!!config.promo?.subline && <AppText style={s.sub} numberOfLines={2}>{config.promo.subline}</AppText>}
        {(config.verifiedCount ?? 0) > 0 && <AppText testID="bgc-verified-count" style={s.count}>✓ {t('bgc_verifiedCount', { count: bgcFmtCount(config.verifiedCount!) })}</AppText>}
        <AppText style={s.price}>{config.startingPrice ? `${bgcInr(config.startingPrice)} • ` : ''}{config.promo?.cta || t('bgc_start')} →</AppText>
      </View>
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  card:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#0f766e', borderRadius: 16, padding: 14, marginHorizontal: 16, marginTop: 14 },
  icon:  { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 15, fontWeight: '800' },
  sub:   { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  count: { color: '#bbf7d0', fontSize: 12, fontWeight: '800', marginTop: 4 },
  price: { color: '#fff', fontSize: 12.5, fontWeight: '800', marginTop: 6 },
});
