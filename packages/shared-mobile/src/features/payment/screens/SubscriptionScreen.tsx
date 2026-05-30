import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAuth } from '../../../state/auth/AuthContext';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { useAppTheme } from '../../../core/theme';
import { useAppConfig } from '../../../core/api/endpoints/appConfigApi';
import { apiClient } from '../../../core/api/client';
import { paymentApi } from '../../../core/api/endpoints/paymentApi';
import { usePricingConfig, calcDiscount } from '../../../core/api/endpoints/pricingApi';
import type { MainStackParamList } from '../../../app/navigation/types';
import type { EmployerTypeKey } from '../../../shared/types/domain';

interface FreshProfile {
  isSubscribed?: boolean;
  subscriptionExpery?: string;
  remainingContacts?: number;
  employerType?: { individual?: boolean; contractor?: boolean; agency?: boolean; industry?: boolean };
}

type Nav = NativeStackNavigationProp<MainStackParamList>;

const FALLBACK_PRICING: Record<EmployerTypeKey, Record<string, number>> = {
  individual: { '1m': 199,  '6m': 999,  '12m': 1999 },
  contractor: { '1m': 599,  '6m': 2900, '12m': 4999 },
  agency:     { '1m': 599,  '6m': 2900, '12m': 4999 },
  industry:   { '1m': 999,  '6m': 3999, '12m': 5999 },
};
const AGENT_FALLBACK: Record<string, number> = { '1m': 299, '6m': 1499, '12m': 2499 };
const EMPLOYER_PRIORITY: EmployerTypeKey[] = ['industry', 'agency', 'contractor', 'individual'];

interface Plan {
  id: string;
  labelKey: string;
  accessKey: string;
  price: number;
  mrp: number;
  discount: number | null;
  workers: number;
  posts: number;
  tier: 'basic' | 'popular' | 'premium';
  benefitKeys: string[];
}

function resolveEmployerType(
  raw?: { individual?: boolean; contractor?: boolean; agency?: boolean; industry?: boolean },
): EmployerTypeKey {
  if (!raw) return 'individual';
  for (const t of EMPLOYER_PRIORITY) { if (raw[t]) return t; }
  return 'individual';
}

function buildPlans(
  employerType: EmployerTypeKey,
  subscriptionPricing?: Record<string, Record<string, number>>,
  subscriptionMrp?: Record<string, Record<string, number>>,
): Plan[] {
  const p = (subscriptionPricing?.[employerType] ?? FALLBACK_PRICING[employerType]) as Record<string, number>;
  const m = (subscriptionMrp?.[employerType] ?? {}) as Record<string, number>;
  return [
    {
      id: '1m', labelKey: 'pricingPlanMonthly', accessKey: 'pricing1MonthAccess',
      price: p['1m'], mrp: m['1m'] ?? 0, discount: calcDiscount(m['1m'] ?? 0, p['1m']),
      workers: 100, posts: 25, tier: 'basic',
      benefitKeys: ['pricingEmpBen1m1', 'pricingEmpBen1m2', 'pricingEmpBen1m3'],
    },
    {
      id: '6m', labelKey: 'pricingPlanHalfYearly', accessKey: 'pricing6MonthAccess',
      price: p['6m'], mrp: m['6m'] ?? 0, discount: calcDiscount(m['6m'] ?? 0, p['6m']),
      workers: 800, posts: 50, tier: 'popular',
      benefitKeys: ['pricingEmpBen6m1', 'pricingEmpBen6m2', 'pricingEmpBen6m3'],
    },
    {
      id: '12m', labelKey: 'pricingPlanYearly', accessKey: 'pricing12MonthAccess',
      price: p['12m'], mrp: m['12m'] ?? 0, discount: calcDiscount(m['12m'] ?? 0, p['12m']),
      workers: 1600, posts: 75, tier: 'premium',
      benefitKeys: ['pricingEmpBen12m1', 'pricingEmpBen12m2', 'pricingEmpBen12m3', 'pricingEmpBen12m4'],
    },
  ];
}

function buildAgentPlans(
  agentPricing?: Record<string, number>,
  agentMrp?: Record<string, number>,
): Plan[] {
  const p = { ...AGENT_FALLBACK, ...(agentPricing ?? {}) };
  const m = agentMrp ?? {};
  return [
    {
      id: '1m', labelKey: 'pricingPlanMonthly', accessKey: 'pricing1MonthAccess',
      price: p['1m']!, mrp: m['1m'] ?? 0, discount: calcDiscount(m['1m'] ?? 0, p['1m']!),
      workers: 0, posts: 0, tier: 'basic',
      benefitKeys: ['pricingAgentBen1m1', 'pricingAgentBen1m2', 'pricingAgentBen1m3'],
    },
    {
      id: '6m', labelKey: 'pricingPlanHalfYearly', accessKey: 'pricing6MonthAccess',
      price: p['6m']!, mrp: m['6m'] ?? 0, discount: calcDiscount(m['6m'] ?? 0, p['6m']!),
      workers: 0, posts: 0, tier: 'popular',
      benefitKeys: ['pricingAgentBen6m1', 'pricingAgentBen6m2', 'pricingAgentBen6m3'],
    },
    {
      id: '12m', labelKey: 'pricingPlanYearly', accessKey: 'pricing12MonthAccess',
      price: p['12m']!, mrp: m['12m'] ?? 0, discount: calcDiscount(m['12m'] ?? 0, p['12m']!),
      workers: 0, posts: 0, tier: 'premium',
      benefitKeys: ['pricingAgentBen12m1', 'pricingAgentBen12m2', 'pricingAgentBen12m3'],
    },
  ];
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  navy:        '#0f172a',
  navyLight:   '#1e293b',
  blue:        '#2563eb',
  blueDark:    '#1d4ed8',
  blueLight:   '#eff6ff',
  gold:        '#f59e0b',
  goldLight:   '#fffbeb',
  green:       '#16a34a',
  greenLight:  '#f0fdf4',
  greenBorder: '#86efac',
  red:         '#dc2626',
  redLight:    '#fef2f2',
  white:       '#ffffff',
  slate50:     '#f8fafc',
  slate100:    '#f1f5f9',
  slate200:    '#e2e8f0',
  slate400:    '#94a3b8',
  slate600:    '#475569',
  slate700:    '#334155',
  slate900:    '#0f172a',
};

// ── Plan card ─────────────────────────────────────────────────────────────────
const PlanCard = React.memo(({
  plan, isSubscribed, isAgent, gstRate, loadingPlanId, onBuy, t,
}: {
  plan: Plan;
  isSubscribed: boolean;
  isAgent: boolean;
  gstRate: number;
  loadingPlanId: string | null;
  onBuy: (plan: Plan) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) => {
  const gst   = parseFloat((plan.price * gstRate).toFixed(2));
  const total = parseFloat((plan.price + gst).toFixed(2));
  const isLoading = loadingPlanId === plan.id;

  const isPopular  = plan.tier === 'popular';
  const isPremium  = plan.tier === 'premium';

  const cardBg     = isPremium ? C.navy : isPopular ? C.blue : C.white;
  const textPrimary = isPremium || isPopular ? C.white : C.navy;
  const textMuted   = isPremium ? '#94a3b8' : isPopular ? '#bfdbfe' : C.slate600;
  const borderColor = isPremium ? C.gold : isPopular ? C.blueDark : C.slate200;

  const badgeBg   = isPremium ? C.gold : C.white;
  const badgeTxt  = isPremium ? C.navy : C.blue;
  const badgeText = isPremium ? t('pricingBestValue') : t('pricingMostPopular');

  const btnBg     = isPremium ? C.gold : isPopular ? C.white : C.navy;
  const btnTxt    = isPremium ? C.navy : isPopular ? C.blue : C.white;

  const checkColor = isPremium ? C.gold : isPopular ? '#bfdbfe' : C.blue;
  const mrpColor   = isPremium ? '#64748b' : isPopular ? '#93c5fd' : C.slate400;

  return (
    <View style={[pc.wrap, { backgroundColor: cardBg, borderColor }]}>
      {/* Tier badge */}
      {(isPopular || isPremium) && (
        <View style={[pc.badge, { backgroundColor: badgeBg }]}>
          <AppText style={[pc.badgeTxt, { color: badgeTxt }]}>
            {isPremium ? '★ ' : '🔥 '}{badgeText}
          </AppText>
        </View>
      )}

      {/* Header row */}
      <View style={pc.headerRow}>
        <View style={{ flex: 1 }}>
          <AppText style={[pc.planName, { color: textPrimary }]}>{t(plan.labelKey)}</AppText>
          <AppText style={[pc.planDuration, { color: textMuted }]}>{t(plan.accessKey)}</AppText>
        </View>
        <View style={pc.priceBlock}>
          {plan.mrp > plan.price && (
            <AppText style={[pc.mrpTxt, { color: mrpColor }]}>₹{plan.mrp}</AppText>
          )}
          <AppText style={[pc.priceTxt, { color: textPrimary }]}>₹{plan.price}</AppText>
          {plan.discount && (
            <View style={[pc.discountPill, { backgroundColor: isPremium ? C.gold : C.red }]}>
              <AppText style={[pc.discountTxt, { color: isPremium ? C.navy : C.white }]}>
                {t('pricingOffLabel', { pct: plan.discount })}
              </AppText>
            </View>
          )}
        </View>
      </View>

      {/* GST / Total */}
      <View style={pc.gstRow}>
        <AppText style={[pc.gstTxt, { color: textMuted }]}>{t('pricingGst', { amount: gst })}</AppText>
        <AppText style={[pc.totalTxt, { color: isPremium ? C.gold : isPopular ? C.white : C.blue }]}>
          {t('pricingTotal', { amount: total })}
        </AppText>
      </View>

      {/* Stats — employer only */}
      {!isAgent && (
        <View style={pc.statsRow}>
          <View style={[pc.statChip, { backgroundColor: isPremium ? C.navyLight : isPopular ? C.blueDark : C.slate100 }]}>
            <AppText style={[pc.statVal, { color: isPremium ? C.gold : isPopular ? C.white : C.navy }]}>
              {plan.workers}+
            </AppText>
            <AppText style={[pc.statKey, { color: textMuted }]}>{t('pricingWorkers')}</AppText>
          </View>
          <View style={[pc.statChip, { backgroundColor: isPremium ? C.navyLight : isPopular ? C.blueDark : C.slate100 }]}>
            <AppText style={[pc.statVal, { color: isPremium ? C.gold : isPopular ? C.white : C.navy }]}>
              {plan.posts}
            </AppText>
            <AppText style={[pc.statKey, { color: textMuted }]}>{t('pricingPosts')}</AppText>
          </View>
        </View>
      )}

      {/* Divider */}
      <View style={[pc.divider, { backgroundColor: isPremium ? '#1e293b' : isPopular ? '#1d4ed8' : C.slate200 }]} />

      {/* Benefits */}
      <View style={pc.benefits}>
        {plan.benefitKeys.map((key) => (
          <View key={key} style={pc.benefitRow}>
            <AppText style={[pc.checkMark, { color: checkColor }]}>✓</AppText>
            <AppText style={[pc.benefitTxt, { color: textPrimary }]}>{t(key)}</AppText>
          </View>
        ))}
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[pc.btn, { backgroundColor: btnBg }, isLoading && { opacity: 0.7 }]}
        onPress={() => onBuy(plan)}
        disabled={isLoading}
        activeOpacity={0.85}
      >
        {isLoading ? (
          <ActivityIndicator color={btnTxt} size="small" />
        ) : (
          <AppText style={[pc.btnTxt, { color: btnTxt }]}>
            {isSubscribed ? t('pricingRenewUpgrade') : t('pricingGetStarted')}
          </AppText>
        )}
      </TouchableOpacity>
    </View>
  );
});
PlanCard.displayName = 'PlanCard';

const pc = StyleSheet.create({
  wrap:        { borderRadius: 20, borderWidth: 1.5, padding: 18, marginBottom: 16, marginHorizontal: 16,
                 shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                 shadowOpacity: 0.12, shadowRadius: 12, elevation: 5 },
  badge:       { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12,
                 paddingVertical: 5, marginBottom: 14 },
  badgeTxt:    { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  planName:    { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  planDuration:{ fontSize: 12, fontWeight: '500', marginTop: 3 },
  priceBlock:  { alignItems: 'flex-end', gap: 2 },
  mrpTxt:      { fontSize: 13, textDecorationLine: 'line-through', fontWeight: '500' },
  priceTxt:    { fontSize: 26, fontWeight: '900', letterSpacing: -0.8 },
  discountPill:{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginTop: 2 },
  discountTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  gstRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  gstTxt:      { fontSize: 11, fontWeight: '500' },
  totalTxt:    { fontSize: 12, fontWeight: '700' },
  statsRow:    { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statChip:    { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center' },
  statVal:     { fontSize: 20, fontWeight: '900' },
  statKey:     { fontSize: 11, fontWeight: '600', marginTop: 2 },
  divider:     { height: 1, marginBottom: 14 },
  benefits:    { gap: 8, marginBottom: 16 },
  benefitRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  checkMark:   { fontSize: 13, fontWeight: '900', lineHeight: 18, marginTop: 1 },
  benefitTxt:  { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  btn:         { borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnTxt:      { fontSize: 15, fontWeight: '800' },
});

// ── Screen ────────────────────────────────────────────────────────────────────
export const SubscriptionScreen = (): React.JSX.Element => {
  const navigation  = useNavigation<Nav>();
  const { theme }   = useAppTheme();
  const { state: authState } = useAuth();
  const { config }  = useAppConfig();
  const toast       = useToast();
  const { t }       = useTranslation('employer');
  const user        = authState.session?.user;
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  const { pricing, gstRate } = usePricingConfig();
  const isAgent = user?.role === 'agent';

  const profileQuery = useQuery({
    queryKey: ['subscription-screen-profile'],
    queryFn: async () => {
      const res = await apiClient.get<{ user?: FreshProfile }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    staleTime: 60 * 1000,
  });

  useFocusEffect(
    useCallback(() => {
      if (profileQuery.isStale) void profileQuery.refetch();
    }, [profileQuery]),
  );

  const profile = profileQuery.data;
  const isSubscribed = !!profile?.isSubscribed &&
    (!profile.subscriptionExpery || new Date(profile.subscriptionExpery).getTime() > Date.now());
  const remainingContacts = profile?.remainingContacts ?? 0;
  const employerType = resolveEmployerType(
    (profile?.employerType ?? user?.employerType) as Parameters<typeof resolveEmployerType>[0],
  );

  const sub = pricing.subscription as unknown as Record<string, Record<string, number>>;
  const mrp = pricing.subscriptionMrp as unknown as Record<string, Record<string, number>>;

  const plans = isAgent
    ? buildAgentPlans(sub?.['agent'], mrp?.['agent'])
    : buildPlans(employerType, sub, mrp);

  const handleBuyPlan = async (plan: Plan): Promise<void> => {
    if (!user) return;
    setLoadingPlanId(plan.id);
    try {
      const baseAmount = plan.price;
      const gstCharges = parseFloat((baseAmount * gstRate).toFixed(2));
      const totalAmount = parseFloat((baseAmount + gstCharges).toFixed(2));
      const resp = await paymentApi.initiateSubscription({
        employerId: user.id,
        firstName: user.fullName,
        email: user.email ?? '',
        employerType: (isAgent ? 'agent' : employerType) as string,
        employer_phone: user.phone,
        paymentType: 'subscription',
        amount: totalAmount,
        gstCharges,
        productName: `${isAgent ? 'Agent' : 'Employer'} Subscription Plan - ${plan.id}`,
        planId: plan.id,
      });
      if (resp.url) {
        navigation.navigate('PaymentWebView', { url: resp.url, merchantOrderId: resp.merchantOrderId });
      } else {
        toast.error('Payment URL not received. Please try again.', 'Payment Error');
      }
    } catch {
      toast.error('Could not initiate payment. Please try again.', 'Payment Failed');
    } finally {
      setLoadingPlanId(null);
    }
  };

  const handleTopup = async (contactCount: 50 | 100): Promise<void> => {
    if (!user) return;
    const TOPUP_PRICES = { 50: pricing.topup.contacts50, 100: pricing.topup.contacts100 };
    const baseAmount  = TOPUP_PRICES[contactCount];
    const gstCharges  = parseFloat((baseAmount * gstRate).toFixed(2));
    const totalAmount = parseFloat((baseAmount + gstCharges).toFixed(2));
    setLoadingPlanId(`topup_${contactCount}`);
    try {
      const resp = await paymentApi.initiateTopup({
        employerId: user.id, firstName: user.fullName, email: user.email ?? '',
        employer_phone: user.phone, amount: totalAmount, gstCharges,
        contactCount, ernStatus: 'contact_topup',
      });
      if (resp.url) {
        navigation.navigate('TopupWebView', { url: resp.url, merchantOrderId: resp.merchantOrderId });
      } else {
        toast.error('Payment URL not received. Please try again.', 'Payment Error');
      }
    } catch {
      toast.error('Could not initiate payment. Please try again.', 'Payment Failed');
    } finally {
      setLoadingPlanId(null);
    }
  };

  const fmtExpiry = (d?: string) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return ''; }
  };

  return (
    <View style={[s.root, { backgroundColor: C.slate100 }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title={t('pricingPageTitle')} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <View style={s.hero}>
          <View style={s.heroDecorLeft} />
          <View style={s.heroDecorRight} />
          <AppText style={s.heroCrown}>👑</AppText>
          <AppText style={s.heroTitle}>{t('pricingHeroTitle')}</AppText>
          <AppText style={s.heroSub}>
            {isAgent ? t('pricingHeroSubAgent') : t('pricingHeroSubEmp')}
          </AppText>
        </View>

        {/* ── Active subscription ── */}
        {isSubscribed && (
          <View style={s.activeBanner}>
            <View style={s.activeDot} />
            <View style={{ flex: 1 }}>
              <AppText style={s.activeTxt}>{t('pricingActiveSub')}</AppText>
              {profile?.subscriptionExpery && (
                <AppText style={s.activeExpiry}>
                  {t('pricingExpiresDate', { date: fmtExpiry(profile.subscriptionExpery) })}
                </AppText>
              )}
            </View>
            <View style={s.contactsPill}>
              {profileQuery.isFetching && !profileQuery.data ? (
                <ActivityIndicator size="small" color={C.blue} />
              ) : (
                <>
                  <AppText style={s.contactsNum}>{remainingContacts}</AppText>
                  <AppText style={s.contactsLabel}>{t('pricingContactsLeft')}</AppText>
                </>
              )}
            </View>
          </View>
        )}

        {/* ── Plans heading ── */}
        <AppText style={s.sectionTitle}>{t('pricingPlansHeading')}</AppText>

        {/* ── Plan cards ── */}
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isSubscribed={isSubscribed}
            isAgent={isAgent}
            gstRate={gstRate}
            loadingPlanId={loadingPlanId}
            onBuy={handleBuyPlan}
            t={t as (key: string, opts?: Record<string, unknown>) => string}
          />
        ))}

        {/* ── Top-up — subscribed employers only ── */}
        {isSubscribed && !isAgent && (
          <View style={s.topupSection}>
            <View style={s.topupHeader}>
              <AppText style={s.topupTitle}>{t('pricingTopupHeading')}</AppText>
              <AppText style={s.topupDesc}>{t('pricingTopupDesc')}</AppText>
            </View>
            {([50, 100] as const).map((count) => {
              const prices = { 50: pricing.topup.contacts50, 100: pricing.topup.contacts100 };
              const base   = prices[count];
              const gst    = parseFloat((base * gstRate).toFixed(2));
              const total  = parseFloat((base + gst).toFixed(2));
              const isBusy = loadingPlanId === `topup_${count}`;
              return (
                <View key={count} style={s.topupCard}>
                  <View style={s.topupLeft}>
                    <AppText style={s.topupCount}>{t('pricingTopupContacts', { count })}</AppText>
                    <AppText style={s.topupPrice}>
                      ₹{base}
                      <AppText style={s.topupGst}> + ₹{gst} GST</AppText>
                      {'  =  '}
                      <AppText style={s.topupTotal}>₹{total}</AppText>
                    </AppText>
                  </View>
                  <TouchableOpacity
                    style={[s.topupBtn, isBusy && { opacity: 0.6 }]}
                    onPress={() => { void handleTopup(count); }}
                    disabled={isBusy}
                    activeOpacity={0.85}
                  >
                    {isBusy
                      ? <ActivityIndicator color={C.white} size="small" />
                      : <AppText style={s.topupBtnTxt}>{t('pricingBuyBtn')}</AppText>}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Footer ── */}
        <View style={s.footer}>
          <View style={s.trustRow}>
            <AppText style={s.trustTxt}>🏆 {t('pricingTrustBadge')}</AppText>
          </View>
          <AppText style={s.supportTxt}>
            {t('pricingSupportNote', { email: config.contact.supportEmail })}
          </AppText>
        </View>

      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root:         { flex: 1 },
  scroll:       { paddingBottom: 40 },

  // Hero
  hero:         { backgroundColor: C.navy, paddingTop: 28, paddingBottom: 32,
                  paddingHorizontal: 20, alignItems: 'center', overflow: 'hidden' },
  heroDecorLeft: { position: 'absolute', top: -40, left: -40, width: 140, height: 140,
                   borderRadius: 70, backgroundColor: '#1e40af', opacity: 0.35 },
  heroDecorRight:{ position: 'absolute', bottom: -30, right: -30, width: 110, height: 110,
                   borderRadius: 55, backgroundColor: '#1e40af', opacity: 0.25 },
  heroCrown:    { fontSize: 32, marginBottom: 8 },
  heroTitle:    { fontSize: 22, fontWeight: '900', color: C.white, textAlign: 'center',
                  letterSpacing: -0.5, marginBottom: 8 },
  heroSub:      { fontSize: 13, color: '#93c5fd', textAlign: 'center', lineHeight: 20 },

  // Active subscription banner
  activeBanner: { marginHorizontal: 16, marginTop: 14, backgroundColor: C.greenLight,
                  borderRadius: 16, borderWidth: 1.5, borderColor: C.greenBorder,
                  flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  activeDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: C.green, flexShrink: 0 },
  activeTxt:    { fontSize: 14, fontWeight: '800', color: C.green },
  activeExpiry: { fontSize: 11, color: '#166534', fontWeight: '500', marginTop: 2 },
  contactsPill: { backgroundColor: C.blueLight, borderRadius: 12, paddingHorizontal: 12,
                  paddingVertical: 8, alignItems: 'center', flexShrink: 0 },
  contactsNum:  { fontSize: 20, fontWeight: '900', color: C.blue, lineHeight: 24 },
  contactsLabel:{ fontSize: 9, fontWeight: '700', color: C.blueDark, textAlign: 'center',
                  lineHeight: 12, marginTop: 1 },

  // Section title
  sectionTitle: { fontSize: 13, fontWeight: '800', color: C.slate600,
                  letterSpacing: 0.8, textTransform: 'uppercase',
                  marginTop: 20, marginBottom: 12, marginHorizontal: 16 },

  // Top-up section
  topupSection: { marginHorizontal: 16, marginTop: 4, marginBottom: 8 },
  topupHeader:  { marginBottom: 12 },
  topupTitle:   { fontSize: 15, fontWeight: '800', color: C.navy, marginBottom: 4 },
  topupDesc:    { fontSize: 12, color: C.slate600, lineHeight: 17 },
  topupCard:    { backgroundColor: C.white, borderRadius: 16, padding: 16,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 10, borderWidth: 1, borderColor: C.slate200,
                  shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  topupLeft:    { flex: 1 },
  topupCount:   { fontSize: 15, fontWeight: '800', color: C.navy, marginBottom: 3 },
  topupPrice:   { fontSize: 12, color: C.slate600 },
  topupGst:     { color: C.slate400 },
  topupTotal:   { fontWeight: '800', color: C.navy },
  topupBtn:     { backgroundColor: C.blue, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11 },
  topupBtnTxt:  { fontSize: 13, fontWeight: '800', color: C.white },

  // Footer
  footer:       { marginHorizontal: 16, marginTop: 16, marginBottom: 8, alignItems: 'center', gap: 8 },
  trustRow:     { backgroundColor: C.goldLight, borderRadius: 12, paddingHorizontal: 16,
                  paddingVertical: 10, borderWidth: 1, borderColor: '#fde68a' },
  trustTxt:     { fontSize: 12, fontWeight: '700', color: '#92400e', textAlign: 'center' },
  supportTxt:   { fontSize: 11, color: C.slate400, textAlign: 'center' },
});
