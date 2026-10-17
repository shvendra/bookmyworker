import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../../../shared/components/ui/AppText';
import { PulseView, ShimmerSweep } from '../../../shared/components/motion';

const BRAND = '#1037A4';
const CARD_W = Math.min(Dimensions.get('window').width - 40, 380);

interface PlanExpiredModalProps {
  visible: boolean;
  /** Biggest "% off" across plans, or null → generic wording (never an invented number). */
  discountPct: number | null;
  onClose: () => void;
  onRenew: () => void;
}

/**
 * "Your plan has expired" popup — the Employer-app counterpart of the CRM's plan-expired dialog
 * (same copy, same discount number), styled with the app's own card / brand-blue button look.
 */
export const PlanExpiredModal = ({ visible, discountPct, onClose, onRenew }: PlanExpiredModalProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const isDark = theme.mode === 'dark';
  const { t } = useTranslation('employer');
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) { pop.setValue(0); return undefined; }
    const a = Animated.timing(pop, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [visible, pop]);

  const bullets = [t('pe_b1'), t('pe_b2'), t('pe_b3')];
  const ink = isDark ? '#F1F5F9' : '#0F172A';
  const body = isDark ? '#CBD5E1' : '#334155';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable onPress={() => { /* swallow taps inside the card */ }}>
          <Animated.View
            style={[
              s.card,
              { width: CARD_W, backgroundColor: isDark ? '#1E293B' : '#FFFFFF', opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] },
            ]}
          >
            <TouchableOpacity onPress={onClose} style={[s.close, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F1F5F9' }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={t('pe_close')}>
              <Ionicons name="close" size={16} color={isDark ? '#CBD5E1' : '#64748B'} />
            </TouchableOpacity>

            <AppText style={[s.title, { color: ink }]} maxFontSizeMultiplier={1.2}>{t('pe_title')}</AppText>
            <AppText style={[s.sub, { color: ink }]} maxFontSizeMultiplier={1.2}>
              {discountPct ? t('pe_sub', { pct: discountPct }) : t('pe_subNoPct')}
            </AppText>

            <PulseView scaleTo={1.05} period={1600} style={s.chipWrap}>
              <View style={s.chip}>
                <Ionicons name="pricetag" size={12} color="#E11D48" />
                <AppText style={s.chipTxt} maxFontSizeMultiplier={1.2}>{t('pe_chip')}</AppText>
              </View>
            </PulseView>

            <AppText style={[s.renewTo, { color: isDark ? '#94A3B8' : '#475569' }]} maxFontSizeMultiplier={1.2}>{t('pe_renewTo')}</AppText>
            <View style={[s.rule, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0' }]} />

            <View style={s.bullets}>
              {bullets.map((b) => (
                <View key={b} style={s.bulletRow}>
                  <View style={s.dot} />
                  <AppText style={[s.bulletTxt, { color: body }]} maxFontSizeMultiplier={1.2}>{b}</AppText>
                </View>
              ))}
            </View>

            <PulseView scaleTo={1.025} period={1800}>
              <TouchableOpacity style={s.cta} activeOpacity={0.88} onPress={onRenew}>
                <AppText style={s.ctaTxt} maxFontSizeMultiplier={1.2}>{t('pe_cta')}{'  →'}</AppText>
                <ShimmerSweep />
              </TouchableOpacity>
            </PulseView>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { borderRadius: 22, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 22, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  close: { position: 'absolute', top: 12, right: 12, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  title: { fontSize: 21, fontWeight: '900', lineHeight: 28, paddingRight: 30 },
  sub: { fontSize: 15, fontWeight: '700', marginTop: 4, lineHeight: 21 },
  chipWrap: { alignSelf: 'flex-start', marginTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFF1F2', borderColor: '#FECDD3', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipTxt: { color: '#E11D48', fontSize: 12, fontWeight: '800' },
  renewTo: { fontSize: 13, fontWeight: '600', marginTop: 18 },
  rule: { height: 1, marginTop: 10, marginBottom: 14 },
  bullets: { gap: 11, marginBottom: 22 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND },
  bulletTxt: { flex: 1, fontSize: 13.5, fontWeight: '500', lineHeight: 19 },
  cta: { backgroundColor: BRAND, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ctaTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
