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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../../app/navigation/types';
import { paymentApi } from '../../../core/api/endpoints/paymentApi';
import { usePricingConfig } from '../../../core/api/endpoints/pricingApi';
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

const BENEFITS = [
  '⭐ Premium visibility — appear at the top of employer searches',
  '✅ Trust badge displayed on your profile and all cards',
  '🔔 Priority notifications for new requirements in your area',
  '💼 Access to exclusive high-paying requirements',
  '📞 Direct employer contact details unlocked',
  '🏆 Dedicated account support & faster KYC processing',
];

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
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [loading, setLoading] = useState(false);

  const { pricing } = usePricingConfig();
  const isAgent = userRole === 'agent';
  const price = isAgent ? pricing.verifiedBadge.agent : pricing.verifiedBadge.worker;
  const originalPrice = isAgent ? price * 5 : price * 10;
  const discount = isAgent ? '80% OFF' : '90% OFF';

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
      // Payment URL fetch failed — dismiss and let them retry from profile
      onDismiss();
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

          {/* ── Hero header ──────────────────────────────────────── */}
          <View style={styles.hero}>
            {/* Decorative circles */}
            <View style={styles.heroCircle1} pointerEvents="none" />
            <View style={styles.heroCircle2} pointerEvents="none" />

            {/* Avatar + VERIFIED badge */}
            <View style={styles.avatarWrap}>
              <Avatar name={userName} size={72} ring ringColor="rgba(255,255,255,0.55)" />
              <View style={styles.verifiedTag}>
                <AppText style={styles.verifiedTagText}>✔ VERIFIED</AppText>
              </View>
            </View>

            <AppText style={styles.heroTitle}>Become a Verified Agent</AppText>
            <AppText style={styles.heroSub}>
              Stand out from the crowd and unlock{'\n'}premium features instantly
            </AppText>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Benefits ─────────────────────────────────────── */}
            <View style={[styles.benefitsCard, { borderColor: theme.colors.border }]}>
              {BENEFITS.map((b, i) => (
                <View
                  key={i}
                  style={[
                    styles.benefitRow,
                    i < BENEFITS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
                  ]}
                >
                  <AppText style={styles.benefitText}>{b}</AppText>
                </View>
              ))}
            </View>

            {/* ── Price card ───────────────────────────────────── */}
            <View style={[styles.priceCard, { borderColor: '#DBEAFE' }]}>
              <View style={[styles.priceCardHeader, { backgroundColor: '#EFF6FF', borderBottomColor: '#DBEAFE' }]}>
                <AppText style={styles.priceCardTitle}>One-time Verification Fee</AppText>
                <AppText style={[styles.priceCardSub, { color: theme.colors.mutedText }]}>
                  Unlock all premium features
                </AppText>
              </View>
              <View style={styles.priceCardBody}>
                <View style={styles.priceRow}>
                  <AppText style={styles.priceOld}>₹{originalPrice.toLocaleString('en-IN')}</AppText>
                  <AppText style={styles.priceNew}>₹{price.toLocaleString('en-IN')}</AppText>
                  <View style={styles.discountBadge}>
                    <AppText style={styles.discountText}>{discount}</AppText>
                  </View>
                </View>
                <AppText style={[styles.priceNote, { color: theme.colors.mutedText }]}>
                  One-time payment · No renewal · Lifetime validity
                </AppText>
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
              <AppText style={[styles.laterBtnText, { color: theme.colors.mutedText }]}>Maybe Later</AppText>
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
                <AppText style={styles.verifyBtnText}>✔ Get Verified Now</AppText>
              )}
            </TouchableOpacity>
          </View>

          {/* Close pill */}
          <Pressable onPress={onDismiss} style={styles.closePill} hitSlop={12}>
            <View style={[styles.closePillBar, { backgroundColor: theme.colors.border }]} />
          </Pressable>
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

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: '#1037A4',
    padding: 24,
    paddingTop: 32,
    alignItems: 'center',
    overflow: 'hidden',
    gap: 10,
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
    position: 'absolute', top: -8, right: -16,
    backgroundColor: '#22C55E',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
  },
  verifiedTagText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', textAlign: 'center', lineHeight: 26 },
  heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: 13, textAlign: 'center', lineHeight: 18 },

  // ── Body ──────────────────────────────────────────────────────────────────
  body: { maxHeight: 400 },
  bodyContent: { padding: 16, gap: 12 },

  benefitsCard: {
    borderRadius: 18, borderWidth: 1, overflow: 'hidden',
    backgroundColor: '#FAFAFA',
  },
  benefitRow: { paddingHorizontal: 16, paddingVertical: 11 },
  benefitText: { fontSize: 13, fontWeight: '500', color: '#334155', lineHeight: 18 },

  priceCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  priceCardHeader: {
    padding: 14, borderBottomWidth: 1, gap: 3,
  },
  priceCardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  priceCardSub: { fontSize: 12 },
  priceCardBody: { padding: 16, gap: 10, backgroundColor: '#fff' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  priceOld: { fontSize: 14, color: '#94A3B8', fontWeight: '600', textDecorationLine: 'line-through' },
  priceNew: { fontSize: 30, fontWeight: '900', color: '#15803D', lineHeight: 36 },
  discountBadge: {
    backgroundColor: '#DCFCE7', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  discountText: { fontSize: 11, fontWeight: '800', color: '#15803D' },
  priceNote: { fontSize: 12, lineHeight: 16 },

  // ── Footer ────────────────────────────────────────────────────────────────
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
  verifyBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // ── Close pill ────────────────────────────────────────────────────────────
  closePill: {
    position: 'absolute', top: 10, alignSelf: 'center', left: 0, right: 0,
    alignItems: 'center',
  },
  closePillBar: { width: 40, height: 4, borderRadius: 2 },
});
