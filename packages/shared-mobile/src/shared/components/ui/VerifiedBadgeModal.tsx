import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../../app/navigation/types';
import { paymentApi } from '../../../core/api/endpoints/paymentApi';
import { usePricingConfig } from '../../../core/api/endpoints/pricingApi';
import { showAlert } from '../../state/alert/AppAlertContext';
import { useAppTheme } from '../../../core/theme';
import { AppText } from './AppText';
import { Avatar } from './Avatar';

interface VerifiedBadgeModalProps {
  visible: boolean;
  onDismiss: () => void;
  userRole: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
}

// Translation keys for the benefit rows — resolved at render time via t().
const BENEFIT_KEYS = [
  'vbBenefit1',
  'vbBenefit2',
  'vbBenefit3',
  'vbBenefit4',
  'vbBenefit5',
  'vbBenefit6',
] as const;

const BenefitRow = ({ text, isLast }: { text: string; isLast: boolean }): React.JSX.Element => (
  <View
    style={[
      benefitRow.row,
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8ECF5' },
    ]}
  >
    <View style={benefitRow.checkCircle}>
      <AppText style={benefitRow.checkMark}>✓</AppText>
    </View>
    <AppText style={benefitRow.text}>{text}</AppText>
  </View>
);

const benefitRow = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkMark: { color: '#fff', fontSize: 11, fontWeight: '800', lineHeight: 16 },
  text: { fontSize: 13, fontWeight: '500', color: '#334155', lineHeight: 18, flex: 1 },
});

export const VerifiedBadgeModal = ({
  visible,
  onDismiss,
  userRole,
  userId,
  userName,
  userEmail,
  userPhone,
}: VerifiedBadgeModalProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [loading, setLoading] = useState(false);

  const { pricing, isLoading: priceLoading } = usePricingConfig();
  const isAgent = userRole === 'agent';
  const price = isAgent ? pricing.verifiedBadge.agent : pricing.verifiedBadge.worker;
  const originalPrice = isAgent ? price * 5 : price * 10;
  const discount = t('vbOff', { percent: isAgent ? 80 : 90 });

  const handleGetVerified = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await paymentApi.initiateVerifiedBadge({
        employerId: userId,
        firstName: userName,
        email: userEmail,
        employer_phone: userPhone,
        role: userRole,
        price,
        gstCharges: 0,
      });
      onDismiss();
      navigation.navigate('PaymentWebView', {
        url: response.url,
        merchantOrderId: response.merchantOrderId,
        returnTo: 'Main',
      });
    } catch {
      // Never fail silently — a swallowed error here is why a broken gateway
      // looked like "nobody is buying". Keep the sheet open and let them retry.
      setLoading(false);
      showAlert(t('vbPayErrTitle'), t('vbPayErrMsg'), [
        { text: t('vbMaybeLater'), style: 'cancel' },
        { text: t('retry'), onPress: () => { void handleGetVerified(); } },
      ]);
      return;
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.card }]}>

          {/* ── Close pill ──────────────────────────────────────── */}
          <Pressable onPress={onDismiss} style={styles.closePill} hitSlop={12}>
            <View style={styles.closePillBar} />
          </Pressable>

          {/* ── Hero header ──────────────────────────────────────── */}
          <View style={styles.hero}>
            <View style={styles.heroCircle1} pointerEvents="none" />
            <View style={styles.heroCircle2} pointerEvents="none" />

            {/* Avatar + VERIFIED badge */}
            <View style={styles.avatarWrap}>
              <Avatar name={userName} size={72} ring ringColor="rgba(255,255,255,0.55)" />
              <View style={styles.verifiedTag}>
                <AppText style={styles.verifiedTagText}>{t('vbVerifiedTag')}</AppText>
              </View>
            </View>

            <AppText style={styles.heroTitle}>{t('vbTitle')}</AppText>
            <AppText style={styles.heroSub}>{t('vbSubtitle')}</AppText>

            {/* "Why get Verified?" pill */}
            <View style={styles.whyPill}>
              <View style={styles.whyDot} />
              <AppText style={styles.whyText}>{t('vbWhy')}</AppText>
            </View>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Benefits ─────────────────────────────────────── */}
            <View style={[styles.benefitsCard, { borderColor: theme.colors.border }]}>
              {BENEFIT_KEYS.map((key, i) => (
                <BenefitRow key={key} text={t(key)} isLast={i === BENEFIT_KEYS.length - 1} />
              ))}
            </View>

            {/* ── Price card ───────────────────────────────────── */}
            <View style={[styles.priceCard, { borderColor: '#DBEAFE' }]}>
              <View style={[styles.priceCardHeader, { backgroundColor: '#EFF6FF', borderBottomColor: '#DBEAFE' }]}>
                <AppText style={styles.priceCardTitle}>{t('vbFeeTitle')}</AppText>
                <AppText style={styles.priceCardSub}>{t('vbFeeSub')}</AppText>
              </View>
              <View style={styles.priceCardBody}>
                <View style={styles.priceRow}>
                  {priceLoading ? (
                    <View style={styles.priceSkeleton} />
                  ) : (
                    <>
                      <AppText style={styles.priceOld}>₹{originalPrice.toLocaleString('en-IN')}</AppText>
                      <AppText style={styles.priceNew}>₹{price.toLocaleString('en-IN')}</AppText>
                      <View style={styles.discountBadge}>
                        <AppText style={styles.discountText}>{discount}</AppText>
                      </View>
                    </>
                  )}
                </View>
                <AppText style={styles.priceNote}>{t('vbPriceNote')}</AppText>
              </View>
            </View>
          </ScrollView>

          {/* ── Action buttons ───────────────────────────────────── */}
          <View style={[styles.footer, { borderTopColor: theme.colors.divider }]}>
            <TouchableOpacity
              onPress={onDismiss}
              style={[styles.laterBtn, { borderColor: theme.colors.border }]}
              activeOpacity={0.75}
            >
              <AppText style={[styles.laterBtnText, { color: theme.colors.mutedText }]}>{t('vbMaybeLater')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void handleGetVerified()}
              disabled={loading}
              style={styles.verifyBtn}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <AppText style={styles.verifyBtnText}>{t('vbGetVerified')}</AppText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: '92%',
  },

  // ── Close pill ────────────────────────────────────────────────────────────────
  closePill: {
    position: 'absolute', top: 10, left: 0, right: 0,
    alignItems: 'center', zIndex: 10,
  },
  closePillBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.45)' },

  // ── Hero ──────────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: '#1037A4',
    paddingTop: 32, paddingBottom: 20, paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
    gap: 8,
  },
  heroCircle1: {
    position: 'absolute', top: -60, right: -50,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heroCircle2: {
    position: 'absolute', bottom: -40, left: -30,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  avatarWrap: { position: 'relative', marginBottom: 4 },
  verifiedTag: {
    position: 'absolute', top: -6, left: -14,
    backgroundColor: '#22C55E',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
  },
  verifiedTagText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 28 },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  whyPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 6, marginTop: 4,
  },
  whyDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  whyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // ── Body ──────────────────────────────────────────────────────────────────────
  body: { maxHeight: 420 },
  bodyContent: { padding: 16, gap: 12 },

  benefitsCard: {
    borderRadius: 18, borderWidth: 1, overflow: 'hidden',
    backgroundColor: '#FAFAFA',
  },

  // ── Price card ────────────────────────────────────────────────────────────────
  priceCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  priceCardHeader: { padding: 14, borderBottomWidth: 1, gap: 4 },
  priceCardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  priceCardSub: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  priceCardBody: { padding: 16, gap: 8, backgroundColor: '#fff' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', minHeight: 40 },
  priceSkeleton: { height: 36, width: 120, borderRadius: 8, backgroundColor: '#E8ECF5' },
  priceOld: { fontSize: 14, color: '#94A3B8', fontWeight: '600', textDecorationLine: 'line-through' },
  priceNew: { fontSize: 30, fontWeight: '900', color: '#15803D', lineHeight: 36 },
  discountBadge: {
    backgroundColor: '#DCFCE7', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  discountText: { fontSize: 11, fontWeight: '800', color: '#15803D' },
  priceNote: { fontSize: 12, color: '#64748B', lineHeight: 16 },

  // ── Footer ────────────────────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row', gap: 10,
    padding: 16, borderTopWidth: StyleSheet.hairlineWidth,
  },
  laterBtn: {
    flex: 1, borderRadius: 14, borderWidth: 1,
    paddingVertical: 14, alignItems: 'center',
  },
  laterBtnText: { fontSize: 14, fontWeight: '700' },
  verifyBtn: {
    flex: 1.6, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#22C55E',
  },
  verifyBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
