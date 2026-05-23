import React from 'react';
import {
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
import { useAppTheme } from '../../../core/theme';
import { usePricingConfig, calcDiscount } from '../../../core/api/endpoints/pricingApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { Avatar } from '../../../shared/components/ui/Avatar';

interface EmployerSubscriptionModalProps {
  visible: boolean;
  onDismiss: () => void;
  userName: string;
}

const BENEFITS = [
  '📋 Post unlimited job requirements',
  '👷 Access verified worker & agent profiles',
  '📍 Priority listing in search results',
  '📞 Direct contact with workers and agents',
  '⚡ Faster worker placement with smart matching',
  '🏆 Dedicated account support from BookMyWorker',
];

export const EmployerSubscriptionModal = ({
  visible,
  onDismiss,
  userName,
}: EmployerSubscriptionModalProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { pricing } = usePricingConfig();
  const monthlyPrice = pricing.subscription.individual['1m'];
  const monthlyMrp   = pricing.subscriptionMrp.individual['1m'];
  const monthlyDisc  = calcDiscount(monthlyMrp, monthlyPrice);
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  const handleViewPlans = (): void => {
    onDismiss();
    navigation.navigate('Subscription');
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

          {/* ── Hero header ─────────────────────────────────────── */}
          <View style={styles.hero}>
            <View style={styles.heroCircle1} pointerEvents="none" />
            <View style={styles.heroCircle2} pointerEvents="none" />

            <View style={styles.avatarWrap}>
              <Avatar name={userName} size={72} ring ringColor="rgba(255,255,255,0.55)" />
              <View style={styles.premiumTag}>
                <AppText style={styles.premiumTagText}>⭐ PREMIUM</AppText>
              </View>
            </View>

            <AppText style={styles.heroTitle}>Unlock Premium Access</AppText>
            <AppText style={styles.heroSub}>
              Post requirements & connect with{'\n'}verified workers across India
            </AppText>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Benefits ──────────────────────────────────────── */}
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

            {/* ── Price card ────────────────────────────────────── */}
            <View style={[styles.priceCard, { borderColor: '#DBEAFE' }]}>
              <View style={[styles.priceCardHeader, { backgroundColor: '#EFF6FF', borderBottomColor: '#DBEAFE' }]}>
                <AppText style={styles.priceCardTitle}>Flexible Subscription Plans</AppText>
                <AppText style={[styles.priceCardSub, { color: theme.colors.mutedText }]}>
                  Choose a plan that fits your hiring needs
                </AppText>
              </View>
              <View style={styles.priceCardBody}>
                {monthlyMrp > monthlyPrice && (
                  <View style={styles.mrpRow}>
                    <AppText style={styles.mrpText}>₹{monthlyMrp}</AppText>
                    {monthlyDisc && (
                      <View style={styles.discountBadge}>
                        <AppText style={styles.discountText}>{monthlyDisc}% OFF</AppText>
                      </View>
                    )}
                  </View>
                )}
                <View style={styles.priceRow}>
                  <AppText style={styles.priceFrom}>From</AppText>
                  <AppText style={styles.priceNew}>₹{monthlyPrice}</AppText>
                  <AppText style={styles.pricePerMonth}>/month</AppText>
                </View>
                <AppText style={[styles.priceNote, { color: theme.colors.mutedText }]}>
                  Individual · Contractor · Agency · Industry
                </AppText>
              </View>
            </View>
          </ScrollView>

          {/* ── Action buttons ──────────────────────────────────── */}
          <View style={[styles.footer, { borderTopColor: theme.colors.divider }]}>
            <TouchableOpacity
              onPress={onDismiss}
              style={[styles.laterBtn, { borderColor: theme.colors.border }]}
              activeOpacity={0.75}
            >
              <AppText style={[styles.laterBtnText, { color: theme.colors.mutedText }]}>Maybe Later</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleViewPlans}
              style={styles.plansBtn}
              activeOpacity={0.85}
            >
              <AppText style={styles.plansBtnText}>View Plans  →</AppText>
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
  premiumTag: {
    position: 'absolute', top: -8, right: -20,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
  },
  premiumTagText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', textAlign: 'center', lineHeight: 26 },
  heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: 13, textAlign: 'center', lineHeight: 18 },

  body: { maxHeight: 400 },
  bodyContent: { padding: 16, gap: 12 },

  benefitsCard: {
    borderRadius: 18, borderWidth: 1, overflow: 'hidden',
    backgroundColor: '#FAFAFA',
  },
  benefitRow: { paddingHorizontal: 16, paddingVertical: 11 },
  benefitText: { fontSize: 13, fontWeight: '500', color: '#334155', lineHeight: 18 },

  priceCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  priceCardHeader: { padding: 14, borderBottomWidth: 1, gap: 3 },
  priceCardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  priceCardSub: { fontSize: 12 },
  priceCardBody: { padding: 16, gap: 10, backgroundColor: '#fff' },
  mrpRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mrpText: { fontSize: 13, color: '#94A3B8', textDecorationLine: 'line-through', fontWeight: '500' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  priceFrom: { fontSize: 14, color: '#94A3B8', fontWeight: '600' },
  priceNew: { fontSize: 30, fontWeight: '900', color: '#1037A4', lineHeight: 36 },
  pricePerMonth: { fontSize: 14, color: '#64748B', fontWeight: '600', alignSelf: 'flex-end', marginBottom: 4 },
  discountBadge: {
    backgroundColor: '#EFF6FF', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  discountText: { fontSize: 10, fontWeight: '700', color: '#1D4ED8' },
  priceNote: { fontSize: 12, lineHeight: 16 },

  footer: {
    flexDirection: 'row', gap: 10,
    padding: 16, borderTopWidth: StyleSheet.hairlineWidth,
  },
  laterBtn: {
    flex: 1, borderRadius: 14, borderWidth: 1,
    paddingVertical: 14, alignItems: 'center',
  },
  laterBtnText: { fontSize: 14, fontWeight: '700' },
  plansBtn: {
    flex: 1.6, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1037A4',
  },
  plansBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  closePill: {
    position: 'absolute', top: 10, alignSelf: 'center', left: 0, right: 0,
    alignItems: 'center',
  },
  closePillBar: { width: 40, height: 4, borderRadius: 2 },
});
