import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { apiClient } from '../../../core/api/client';
import { paymentApi, GST_RATE } from '../../../core/api/endpoints/paymentApi';
import type { MainStackParamList } from '../../../app/navigation/types';
import type { EmployerTypeKey } from '../../../shared/types/domain';

interface FreshProfile {
  isSubscribed?: boolean;
  subscriptionExpery?: string;
  remainingContacts?: number;
  employerType?: { individual?: boolean; contractor?: boolean; agency?: boolean; industry?: boolean };
}

type Nav = NativeStackNavigationProp<MainStackParamList>;

// ─── Pricing data (mirrors CRM PricingPage.jsx) ───────────────────────────────
const EMPLOYER_PRICING: Record<EmployerTypeKey, Record<string, number>> = {
  individual: { '1m': 199,  '6m': 999,  '12m': 1999 },
  contractor: { '1m': 599,  '6m': 2900, '12m': 4999 },
  agency:     { '1m': 599,  '6m': 2900, '12m': 4999 },
  industry:   { '1m': 999,  '6m': 3999, '12m': 5999 },
};

const EMPLOYER_PRIORITY: EmployerTypeKey[] = ['industry', 'agency', 'contractor', 'individual'];

interface Plan {
  id: string;
  label: string;
  duration: string;
  price: number;
  workers: number;
  posts: number;
  popular?: boolean;
  benefits: string[];
}

function resolveEmployerType(
  raw?: { individual?: boolean; contractor?: boolean; agency?: boolean; industry?: boolean },
): EmployerTypeKey {
  if (!raw) return 'individual';
  for (const t of EMPLOYER_PRIORITY) {
    if (raw[t]) return t;
  }
  return 'individual';
}

function buildPlans(employerType: EmployerTypeKey): Plan[] {
  const p = EMPLOYER_PRICING[employerType];
  return [
    {
      id: '1m',
      label: 'Monthly Plan',
      duration: '1 Month',
      price: p['1m'],
      workers: 100,
      posts: 25,
      benefits: [
        'Access limited worker profiles',
        'Post basic job requirements',
        'Standard customer support',
      ],
    },
    {
      id: '6m',
      label: 'Half-Yearly Plan',
      duration: '6 Months',
      price: p['6m'],
      workers: 800,
      posts: 50,
      popular: true,
      benefits: [
        'Higher worker profile visibility',
        'Priority job post listing',
        'Faster support response',
      ],
    },
    {
      id: '12m',
      label: 'Yearly Plan',
      duration: '12 Months',
      price: p['12m'],
      workers: 1600,
      posts: 75,
      benefits: [
        'Maximum worker profile access',
        'Priority leads & faster matching',
        'Dedicated support from BookMyWorker',
        'Early access to new features',
      ],
    },
  ];
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  navy:   '#0f172a',
  blue:   '#2563eb',
  blueSoft: '#eff6ff',
  green:  '#16a34a',
  greenSoft: '#f0fdf4',
  slate:  '#64748b',
  light:  '#f8fafc',
  border: '#e2e8f0',
  white:  '#ffffff',
  gold:   '#f59e0b',
};

export const SubscriptionScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Nav>();
  const { state: authState } = useAuth();
  const user = authState.session?.user;
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  // Fetch fresh profile — session user is stale after contacts are consumed
  const profileQuery = useQuery({
    queryKey: ['subscription-screen-profile'],
    queryFn: async () => {
      const res = await apiClient.get<{ user?: FreshProfile }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    staleTime: 60 * 1000,
  });

  // Only refetch on focus when the cached data is actually stale
  useFocusEffect(
    useCallback(() => {
      if (profileQuery.isStale) {
        void profileQuery.refetch();
      }
    }, [profileQuery]),
  );

  const profile = profileQuery.data;

  // Use fresh API data; fallback to session for employer type (rarely changes)
  const isSubscribed = !!profile?.isSubscribed &&
    (!profile.subscriptionExpery || new Date(profile.subscriptionExpery).getTime() > Date.now());

  const remainingContacts = profile?.remainingContacts ?? 0;
  const employerType = resolveEmployerType(
    (profile?.employerType ?? user?.employerType) as Parameters<typeof resolveEmployerType>[0],
  );
  const plans = buildPlans(employerType);

  const handleBuyPlan = async (plan: Plan): Promise<void> => {
    if (!user) return;
    setLoadingPlanId(plan.id);
    try {
      const baseAmount = plan.price;
      const gstCharges = parseFloat((baseAmount * GST_RATE).toFixed(2));
      const totalAmount = parseFloat((baseAmount + gstCharges).toFixed(2));

      const resp = await paymentApi.initiateSubscription({
        employerId: user.id,
        firstName: user.fullName,
        email: user.email ?? '',
        employerType,
        employer_phone: user.phone,
        paymentType: 'subscription',
        amount: totalAmount,
        gstCharges,
        productName: `Subscription Plan - ${plan.duration}`,
        planId: plan.id,
      });

      if (resp.url) {
        navigation.navigate('PaymentWebView', {
          url: resp.url,
          merchantOrderId: resp.merchantOrderId,
        });
      } else {
        Alert.alert('Error', 'Payment URL not received. Please try again.');
      }
    } catch {
      Alert.alert('Payment Failed', 'Could not initiate payment. Please try again.');
    } finally {
      setLoadingPlanId(null);
    }
  };

  const handleTopup = async (contactCount: 50 | 100): Promise<void> => {
    if (!user) return;
    const TOPUP_PRICES = { 50: 199, 100: 349 };
    const baseAmount = TOPUP_PRICES[contactCount];
    const gstCharges = parseFloat((baseAmount * GST_RATE).toFixed(2));
    const totalAmount = parseFloat((baseAmount + gstCharges).toFixed(2));

    setLoadingPlanId(`topup_${contactCount}`);
    try {
      const resp = await paymentApi.initiateTopup({
        employerId: user.id,
        firstName: user.fullName,
        email: user.email ?? '',
        employer_phone: user.phone,
        amount: totalAmount,
        gstCharges,
        contactCount,
        ernStatus: 'contact_topup',
      });

      if (resp.url) {
        navigation.navigate('TopupWebView', {
          url: resp.url,
          merchantOrderId: resp.merchantOrderId,
        });
      } else {
        Alert.alert('Error', 'Payment URL not received. Please try again.');
      }
    } catch {
      Alert.alert('Payment Failed', 'Could not initiate payment. Please try again.');
    } finally {
      setLoadingPlanId(null);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: C.light }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1338B0" />
      <ScreenHeader title="Pricing Plans" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={s.hero}>
          <AppText style={s.heroTitle}>BookMyWorker Subscription</AppText>
          <AppText style={s.heroSub}>
            Get access to verified workers across India.{'\n'}
            Plans built for employers, contractors & industries.
          </AppText>
        </View>

        {/* Active subscription badge */}
        {isSubscribed && (
          <View style={s.activeBadge}>
            <AppText style={s.activeBadgeText}>
              ✅ Active Subscription
              {profile?.subscriptionExpery
                ? `  ·  Expires ${new Date(profile.subscriptionExpery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : ''}
            </AppText>
          </View>
        )}

        {/* Remaining contacts — always from fresh API data */}
        {isSubscribed && (
          <View style={s.contactsRow}>
            {profileQuery.isFetching && !profileQuery.data ? (
              <ActivityIndicator size="small" color="#1d4ed8" />
            ) : (
              <AppText style={s.contactsText}>
                📞  Remaining Contacts: <AppText style={s.contactsBold}>{remainingContacts}</AppText>
              </AppText>
            )}
          </View>
        )}

        {/* Plan cards */}
        <AppText style={s.sectionLabel}>Subscription Plans</AppText>
        {plans.map((plan) => {
          const gst = parseFloat((plan.price * GST_RATE).toFixed(2));
          const total = parseFloat((plan.price + gst).toFixed(2));
          const isLoading = loadingPlanId === plan.id;

          return (
            <View key={plan.id} style={[s.planCard, plan.popular && s.planCardPopular]}>
              {plan.popular && (
                <View style={s.popularChip}>
                  <AppText style={s.popularText}>Most Popular</AppText>
                </View>
              )}

              <View style={s.planTop}>
                <View>
                  <AppText style={s.planLabel}>{plan.label}</AppText>
                  <AppText style={s.planDuration}>{plan.duration} Access</AppText>
                </View>
                <View style={s.priceBox}>
                  <AppText style={s.priceMain}>₹{plan.price}</AppText>
                  <AppText style={s.priceGst}>+ ₹{gst} GST</AppText>
                  <AppText style={s.priceTotal}>Total: ₹{total}</AppText>
                </View>
              </View>

              <View style={s.statsRow}>
                <View style={s.statChip}>
                  <AppText style={s.statVal}>{plan.workers}+</AppText>
                  <AppText style={s.statKey}>Workers</AppText>
                </View>
                <View style={s.statChip}>
                  <AppText style={s.statVal}>{plan.posts}</AppText>
                  <AppText style={s.statKey}>Posts</AppText>
                </View>
              </View>

              <View style={s.benefitsList}>
                {plan.benefits.map((b, i) => (
                  <AppText key={i} style={s.benefitItem}>✔ {b}</AppText>
                ))}
              </View>

              <TouchableOpacity
                style={[s.planBtn, plan.popular ? s.planBtnPrimary : s.planBtnDark]}
                onPress={() => { void handleBuyPlan(plan); }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={C.white} size="small" />
                ) : (
                  <AppText style={s.planBtnText}>
                    {isSubscribed ? 'Renew / Upgrade' : 'Get Started'}
                  </AppText>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Topup section — only show if already subscribed */}
        {isSubscribed && (
          <View style={s.topupSection}>
            <AppText style={s.sectionLabel}>Contact Top-up</AppText>
            <AppText style={s.topupDesc}>
              Need more contacts? Top up your account without changing your plan.
            </AppText>

            {([50, 100] as const).map((count) => {
              const prices = { 50: 199, 100: 349 };
              const base = prices[count];
              const gst = parseFloat((base * GST_RATE).toFixed(2));
              const total = parseFloat((base + gst).toFixed(2));
              const isLoading = loadingPlanId === `topup_${count}`;

              return (
                <View key={count} style={s.topupCard}>
                  <View>
                    <AppText style={s.topupTitle}>{count} Contacts</AppText>
                    <AppText style={s.topupPrice}>₹{base} + ₹{gst} GST = <AppText style={{ fontWeight: '800' }}>₹{total}</AppText></AppText>
                  </View>
                  <TouchableOpacity
                    style={s.topupBtn}
                    onPress={() => { void handleTopup(count); }}
                    disabled={isLoading}
                  >
                    {isLoading
                      ? <ActivityIndicator color={C.white} size="small" />
                      : <AppText style={s.topupBtnText}>Buy</AppText>
                    }
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Support */}
        <View style={s.support}>
          <AppText style={s.supportText}>Need help? Contact support@bookmyworkers.com</AppText>
        </View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root:         { flex: 1 },
  scroll:       { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  hero:         { marginBottom: 20, alignItems: 'center' },
  heroTitle:    { fontSize: 22, fontWeight: '900', color: '#0f172a', textAlign: 'center', letterSpacing: -0.5 },
  heroSub:      { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 6, lineHeight: 20 },
  activeBadge:  { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 12 },
  activeBadgeText: { fontSize: 13, fontWeight: '700', color: '#16a34a', textAlign: 'center' },
  contactsRow:  { backgroundColor: '#eff6ff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#bfdbfe', marginBottom: 16 },
  contactsText: { fontSize: 13, color: '#1d4ed8', textAlign: 'center' },
  contactsBold: { fontWeight: '900' },
  sectionLabel: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 12, marginTop: 4 },
  planCard:     { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  planCardPopular: { borderColor: '#93c5fd', borderWidth: 1.5 },
  popularChip:  { alignSelf: 'flex-start', backgroundColor: '#2563eb', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10 },
  popularText:  { fontSize: 11, fontWeight: '800', color: '#fff' },
  planTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  planLabel:    { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  planDuration: { fontSize: 12, color: '#64748b', fontWeight: '500', marginTop: 2 },
  priceBox:     { alignItems: 'flex-end' },
  priceMain:    { fontSize: 24, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  priceGst:     { fontSize: 11, color: '#94a3b8', fontWeight: '500', marginTop: 1 },
  priceTotal:   { fontSize: 12, color: '#2563eb', fontWeight: '700', marginTop: 2 },
  statsRow:     { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statChip:     { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  statVal:      { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  statKey:      { fontSize: 11, color: '#64748b', fontWeight: '600', marginTop: 2 },
  benefitsList: { marginBottom: 16, gap: 6 },
  benefitItem:  { fontSize: 12, color: '#334155', fontWeight: '600', lineHeight: 18 },
  planBtn:      { borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  planBtnPrimary: { backgroundColor: '#2563eb' },
  planBtnDark:  { backgroundColor: '#0f172a' },
  planBtnText:  { fontSize: 15, fontWeight: '800', color: '#fff' },
  topupSection: { marginTop: 8, marginBottom: 8 },
  topupDesc:    { fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 18 },
  topupCard:    { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  topupTitle:   { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  topupPrice:   { fontSize: 12, color: '#64748b', marginTop: 3 },
  topupBtn:     { backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  topupBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  support:      { marginTop: 16, marginBottom: 8, alignItems: 'center' },
  supportText:  { fontSize: 12, color: '#94a3b8', textAlign: 'center' },
});
