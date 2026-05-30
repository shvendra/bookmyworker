import React, { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlert } from '../../state/alert/AppAlertContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { usePricingConfig, calcDiscount } from '../../../core/api/endpoints/pricingApi';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import type { RawAgent } from '../../../core/api/endpoints/workerApi';
import { apiClient } from '../../../core/api/client';
import { ENV } from '../../../core/config/env';
import { AppText } from './AppText';
import { AppButton } from './AppButton';

const FILE_BASE = ENV.API_BASE_URL.replace(/\/api\/v1\/?$/, '');
const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = 90;
// ─── Subscription Pricing (matches CRM PricingPage.jsx) ────────────────────────
type EmployerType = 'industry' | 'agency' | 'contractor' | 'individual';
type PlanId = '1m' | '6m' | '12m';

interface Plan {
  id: PlanId;
  label: string;
  duration: string;
  workers: number;
  posts: number;
  badge?: string;
}

const PLANS: Plan[] = [
  { id: '1m',  label: 'Monthly Plan',     duration: '1 Month',   workers: 100,  posts: 25 },
  { id: '6m',  label: 'Half-Yearly Plan', duration: '6 Months',  workers: 800,  posts: 50, badge: 'Popular' },
  { id: '12m', label: 'Yearly Plan',      duration: '12 Months', workers: 1600, posts: 75, badge: 'Best Value' },
];

// ─── Agent Carousel ────────────────────────────────────────────────────────────
const AgentCarousel = ({ agents }: { agents: RawAgent[] }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const listRef = useRef<FlatList<RawAgent>>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (agents.length < 2) return;
    const interval = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % agents.length;
        listRef.current?.scrollToIndex({ index: next, animated: true, viewOffset: (SCREEN_W - 280 - CARD_W * 2 - 16) / 2 });
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [agents.length]);

  if (agents.length === 0) return <View style={{ height: 110 }} />;

  return (
    <View style={carStyles.wrap}>
      <FlatList
        ref={listRef}
        data={agents}
        horizontal
        keyExtractor={(a) => a._id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={carStyles.list}
        getItemLayout={(_, i) => ({ length: CARD_W + 8, offset: (CARD_W + 8) * i, index: i })}
        renderItem={({ item }) => {
          const photoUrl = item.profilePhoto ? `${FILE_BASE}/${item.profilePhoto}` : undefined;
          const initials = (item.name ?? '?').slice(0, 2).toUpperCase();
          return (
            <View style={[carStyles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={carStyles.avatar} />
              ) : (
                <View style={[carStyles.avatarFallback, { backgroundColor: theme.colors.primary + '22' }]}>
                  <AppText style={[carStyles.initials, { color: theme.colors.primary }]}>{initials}</AppText>
                </View>
              )}
              {item.status === 'Verified' && (
                <View style={carStyles.verBadge}>
                  <AppText style={carStyles.verTick}>✓</AppText>
                </View>
              )}
              <AppText style={[carStyles.name, { color: theme.colors.text }]} numberOfLines={1}>
                {item.name}
              </AppText>
            </View>
          );
        }}
      />
    </View>
  );
};

const carStyles = StyleSheet.create({
  wrap: { height: 110, overflow: 'hidden' },
  list: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  card: { width: CARD_W, borderRadius: 14, borderWidth: 1, padding: 8, alignItems: 'center', gap: 4 },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  avatarFallback: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 18, fontWeight: '700' },
  verBadge: { position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' },
  verTick: { fontSize: 8, color: '#fff', fontWeight: '700', lineHeight: 10 },
  name: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
});

// ─── Main Modal ────────────────────────────────────────────────────────────────
interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  employerType?: EmployerType;
  employerId?: string;
  employerName?: string;
  email?: string;
  employerPhone?: string;
}

export const SubscriptionModal = ({
  visible,
  onClose,
  employerType = 'individual',
  employerId,
  employerName,
  email,
  employerPhone,
}: SubscriptionModalProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('1m');
  const { pricing: pricingConfig, gstRate } = usePricingConfig();

  const { data: agentsData } = useQuery({
    queryKey: ['subscription-agents-preview'],
    queryFn: () => workerApi.getAllAgents({ limit: 20, status: 'Verified' }),
    staleTime: 10 * 60 * 1000,
    enabled: visible,
  });

  const agents = agentsData?.rawAgents ?? [];
  const pricing    = pricingConfig.subscription[employerType]    ?? pricingConfig.subscription.individual;
  const pricingMrp = pricingConfig.subscriptionMrp[employerType] ?? pricingConfig.subscriptionMrp.individual;
  const plan = PLANS.find((p) => p.id === selectedPlan) ?? PLANS[0]!;
  const baseAmount = pricing[plan.id];
  const gstAmt = Number((baseAmount * gstRate).toFixed(2));
  const totalAmt = Number((baseAmount + gstAmt).toFixed(2));

  const payMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ url?: string; paymentUrl?: string }>('/api/v1/payment/add-trans', {
        employerId,
        firstName: employerName ?? '',
        email: email ?? '',
        employerType,
        employer_phone: employerPhone ?? '',
        paymentType: 'subscription',
        amount: totalAmt,
        gstCharges: gstAmt,
        productName: `Subscription Plan - ${plan.duration}`,
        planId: plan.id,
      });
      return res.data;
    },
    onSuccess: async (data) => {
      const url = data.url ?? data.paymentUrl;
      if (url) {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
          onClose();
        } else {
          showAlert('Error', 'Cannot open payment URL. Please try again.');
        }
      } else {
        showAlert('Subscribed!', 'Your subscription has been activated.');
        onClose();
      }
    },
    onError: () => {
      showAlert('Payment Error', 'Could not initiate payment. Please try again.');
    },
  });

  const PLAN_BENEFITS: Record<PlanId, string[]> = {
    '1m':  ['Filter workers by a specific location', 'Access limited worker profiles', 'Post basic job requirements'],
    '6m':  ['Filter workers from anywhere within your state', 'Higher worker profile visibility', 'Priority job post listing'],
    '12m': ['Filter workers from any location across India', 'Maximum worker profile access', 'Priority leads & faster matching', 'Dedicated support from BookMyWorker team'],
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.topBar, { borderBottomColor: theme.colors.border, paddingTop: insets.top + 14 }]}>
          <AppText variant="title" style={styles.title}>Unlock Full Access</AppText>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <AppText style={[styles.closeBtn, { color: theme.colors.mutedText }]}>✕</AppText>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Workers preview carousel */}
          <View style={[styles.carouselSection, { backgroundColor: theme.colors.surface }]}>
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.carouselLabel}>
              {agentsData?.total ? `${agentsData.total.toLocaleString()} Verified Agents/Workers` : 'Verified Agents & Workers'}
            </AppText>
            <AgentCarousel agents={agents} />
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.carouselSub}>
              Subscribe to view contact details and connect directly
            </AppText>
          </View>

          {/* Employer type label */}
          <View style={[styles.typeChip, { backgroundColor: theme.colors.primary + '12', borderColor: theme.colors.primary + '30' }]}>
            <AppText style={[styles.typeChipText, { color: theme.colors.primary }]}>
              {employerType.charAt(0).toUpperCase() + employerType.slice(1)} Pricing Applied
            </AppText>
          </View>

          {/* Plan selection */}
          <AppText variant="label" style={styles.sectionTitle}>Choose a Plan</AppText>
          {PLANS.map((p) => {
            const pBase    = pricing[p.id];
            const pMrp     = pricingMrp[p.id];
            const pTotal   = Number((pBase * (1 + gstRate)).toFixed(0));
            const discount = calcDiscount(pMrp, pBase);
            const isActive = selectedPlan === p.id;
            const benefits = PLAN_BENEFITS[p.id];
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => setSelectedPlan(p.id)}
                style={[styles.planCard, {
                  borderColor: isActive ? theme.colors.primary : theme.colors.border,
                  backgroundColor: isActive ? theme.colors.primary + '08' : theme.colors.card,
                }]}
              >
                <View style={styles.planTop}>
                  <View style={styles.planLeft}>
                    <View style={styles.planLabelRow}>
                      <AppText variant="label" color={isActive ? theme.colors.primary : theme.colors.text}>
                        {p.label}
                      </AppText>
                      {p.badge && (
                        <View style={[styles.planBadge, { backgroundColor: isActive ? theme.colors.primary : '#6366F1' }]}>
                          <AppText style={styles.planBadgeText}>{p.badge}</AppText>
                        </View>
                      )}
                    </View>
                    <AppText variant="caption" color={theme.colors.mutedText}>
                      {p.duration} · {p.workers}+ Workers · {p.posts} Posts
                    </AppText>
                  </View>
                  <View style={styles.planRight}>
                    {pMrp > pBase && (
                      <View style={styles.mrpRow}>
                        <AppText style={styles.mrpText}>₹{pMrp}</AppText>
                        {discount && (
                          <View style={styles.discountBadge}>
                            <AppText style={styles.discountBadgeText}>{discount}% OFF</AppText>
                          </View>
                        )}
                      </View>
                    )}
                    <AppText variant="label" color={isActive ? theme.colors.primary : theme.colors.text}>
                      ₹{pTotal}
                    </AppText>
                    <AppText style={[styles.perMonth, { color: theme.colors.mutedText }]}>incl. GST</AppText>
                  </View>
                </View>
                {isActive && (
                  <View style={[styles.benefitsBox, { borderTopColor: theme.colors.border }]}>
                    {benefits.map((b) => (
                      <AppText key={b} variant="caption" color={theme.colors.text} style={styles.benefitItem}>
                        ✔ {b}
                      </AppText>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Fee Summary */}
          <View style={[styles.summary, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <AppText variant="label" style={styles.summaryTitle}>Fee Summary</AppText>
            {[
              ['Subscription Fee', `₹${baseAmount}`],
              [`GST (${pricingConfig.gstPercentage}%)`, `₹${gstAmt.toFixed(2)}`],
            ].map(([label, val]) => (
              <View key={label} style={styles.summaryRow}>
                <AppText variant="caption" color={theme.colors.mutedText}>{label}</AppText>
                <AppText variant="caption" color={theme.colors.text}>{val}</AppText>
              </View>
            ))}
            <View style={[styles.summaryRow, styles.totalRow, { borderTopColor: theme.colors.border }]}>
              <AppText variant="label">Total</AppText>
              <AppText variant="label" color={theme.colors.primary}>₹{totalAmt.toFixed(2)}</AppText>
            </View>
          </View>

          {/* Benefits highlight */}
          <View style={[styles.benefitsHighlight, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <AppText style={styles.benefitsHighlightTitle}>🌟 Why Subscribe?</AppText>
            {['Get Immediate Daily Workers', 'Verified and Skilled Workers', 'Hire as per your Budget & Work', 'Faster coordination and quicker hiring'].map((b) => (
              <AppText key={b} variant="caption" color="#1e40af" style={styles.benefitHighlightItem}>✅ {b}</AppText>
            ))}
          </View>

          {/* Pay Button */}
          <AppButton
            title={payMutation.isPending ? 'Processing…' : `🔒 Pay ₹${totalAmt.toFixed(2)} Securely`}
            onPress={() => payMutation.mutate()}
            style={styles.payBtn}
          />
          {payMutation.isPending && <ActivityIndicator style={{ marginTop: 8 }} color={theme.colors.primary} />}

          <AppText variant="caption" color={theme.colors.mutedText} style={styles.disclaimer}>
            Secure payment powered by BookMyWorker. By subscribing you agree to our Terms of Service.
          </AppText>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18 },
  closeBtn: { fontSize: 18, fontWeight: '600' },
  scroll: { padding: 16, paddingBottom: 40 },
  carouselSection: { borderRadius: 16, paddingVertical: 16, marginBottom: 12, overflow: 'hidden' },
  carouselLabel: { textAlign: 'center', fontWeight: '700', marginBottom: 10 },
  carouselSub: { textAlign: 'center', paddingHorizontal: 20, marginTop: 10 },
  typeChip: { alignSelf: 'center', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 16 },
  typeChipText: { fontSize: 12, fontWeight: '700' },
  sectionTitle: { marginBottom: 10 },
  planCard: { borderWidth: 1.5, borderRadius: 16, marginBottom: 10, overflow: 'hidden' },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 14 },
  planLeft: { flex: 1, gap: 4 },
  planLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planRight: { alignItems: 'flex-end', gap: 2 },
  planBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  planBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  perMonth: { fontSize: 10 },
  mrpRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mrpText: { fontSize: 11, color: '#94A3B8', textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: '#DCFCE7', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  discountBadgeText: { fontSize: 9, fontWeight: '800', color: '#15803D' },
  benefitsBox: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  benefitItem: { fontSize: 12, lineHeight: 18 },
  summary: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 4, marginBottom: 12 },
  summaryTitle: { marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalRow: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 6, paddingTop: 10 },
  benefitsHighlight: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16, gap: 6 },
  benefitsHighlightTitle: { fontSize: 15, fontWeight: '700', color: '#1e40af', marginBottom: 4 },
  benefitHighlightItem: { fontSize: 13, lineHeight: 20 },
  payBtn: { marginTop: 4 },
  disclaimer: { textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
});
