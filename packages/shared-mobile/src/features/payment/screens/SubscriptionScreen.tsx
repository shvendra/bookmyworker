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
import {
  usePricingConfig, calcDiscount,
  buildFeatureBenefits,
  EMPLOYER_PLANS_DEFAULTS,
} from '../../../core/api/endpoints/pricingApi';
import type { EmployerPlansConfig, PlanFeatures, BoostConfig } from '../../../core/api/endpoints/pricingApi';
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
  contacts: number;        // unlockable contacts this plan grants
  posts: number;           // job posts allowed (999 = unlimited)
  tier: 'basic' | 'popular' | 'premium';
  benefits: string[];      // ready-to-render strings (static common + dynamic features)
}

function resolveEmployerType(
  raw?: { individual?: boolean; contractor?: boolean; agency?: boolean; industry?: boolean },
): EmployerTypeKey {
  if (!raw) return 'individual';
  for (const t of EMPLOYER_PRIORITY) { if (raw[t]) return t; }
  return 'individual';
}

type TFn = (key: string, opts?: Record<string, unknown>) => string;

// Linear upgrade path; industry is the top tier (no next).
const NEXT_TYPE: Record<EmployerTypeKey, EmployerTypeKey | null> = {
  individual: 'contractor',
  contractor: 'agency',
  agency:     'industry',
  industry:   null,
};

const SCOPE_RANK: Record<string, number> = { district: 0, state: 1, india: 2 };

/**
 * Derive the feature lines that the NEXT tier unlocks but the current tier
 * lacks — fully configurable from `employerPlans[*].features`, mirroring the
 * same flags `buildFeatureBenefits` uses (incl. workerSearchScope upgrades).
 * Returns translated strings; empty when nothing new is unlocked.
 */
function buildUpgradeBenefits(
  current: PlanFeatures,
  next: PlanFeatures,
  t: TFn,
): string[] {
  const items: string[] = [];
  // workerSearchScope: only the higher scope that current doesn't already have
  const curRank  = SCOPE_RANK[current.workerSearchScope] ?? 0;
  const nextRank = SCOPE_RANK[next.workerSearchScope] ?? 0;
  if (nextRank > curRank) {
    if (next.workerSearchScope === 'state') items.push(t('pr_feat_searchState'));
    if (next.workerSearchScope === 'india') items.push(t('pr_feat_searchIndia'));
  }
  if (next.pipelineEnabled  && !current.pipelineEnabled)  items.push(t('pr_feat_pipeline'));
  if (next.inviteEnabled    && !current.inviteEnabled)    items.push(t('pr_feat_invite'));
  if (next.analyticsEnabled && (!current.analyticsEnabled || next.analyticsMonths > current.analyticsMonths)) {
    items.push(t('pr_feat_analytics', { months: next.analyticsMonths }));
  }
  if (next.priorityListing  && !current.priorityListing)  items.push(t('pr_feat_priority'));
  if (next.unlimitedPosts   && !current.unlimitedPosts)   items.push(t('pr_feat_unlimitedPosts'));
  if (next.bulkPostEnabled  && !current.bulkPostEnabled)  items.push(t('pr_feat_bulkPost'));
  if (next.dedicatedSupport && !current.dedicatedSupport) items.push(t('pr_feat_dedicatedSupport'));
  return items;
}

const TYPE_NAME_KEY: Record<EmployerTypeKey, string> = {
  individual: 'pr_type_individual',
  contractor: 'pr_type_contractor',
  agency:     'pr_type_agency',
  industry:   'pr_type_industry',
};

// Duration-specific lines computed from dynamic contacts/posts — unique per card
function buildDurationBenefits(planId: PlanId, contacts: number, posts: number, contacts1m: number, t: TFn): string[] {
  const postsLabel = posts >= 999 ? t('jp_unlimited') : String(posts);
  if (planId === '1m') return [
    t('jp_benefitTrialContacts', { contacts }),
    t('jp_benefitPostsThisMonth', { posts: postsLabel }),
  ];
  const mul = contacts1m > 0 ? Math.round(contacts / contacts1m) : t('jp_more');
  if (planId === '6m') return [
    t('jp_benefitMoreReach', { contacts, mul }),
    t('jp_benefitBetterCpc'),
  ];
  return [
    t('jp_benefitMoreReach', { contacts, mul }),
    t('jp_benefitLowestCpc'),
  ];
}

type PlanId = '1m' | '6m' | '12m';

function buildPlans(
  employerType: EmployerTypeKey,
  t: TFn,
  subscriptionPricing?: Record<string, Record<string, number>>,
  subscriptionMrp?: Record<string, Record<string, number>>,
  employerPlans: EmployerPlansConfig = EMPLOYER_PLANS_DEFAULTS,
  boostConfig?: BoostConfig,
): Plan[] {
  const p       = (subscriptionPricing?.[employerType] ?? FALLBACK_PRICING[employerType]) as Record<string, number>;
  const m       = (subscriptionMrp?.[employerType] ?? {}) as Record<string, number>;
  const typePlan = employerPlans[employerType] ?? EMPLOYER_PLANS_DEFAULTS[employerType];
  const featureBenefits = buildFeatureBenefits(typePlan.features, t);
  const sharedBenefits  = [t('jp_benefitVerifiedProfiles'), t('jp_benefitUnlockContacts'), ...featureBenefits];
  const contacts1m      = typePlan.limits['1m'].contacts;
  // Requirement-boost allowance for this employer type, per duration (mirrors CRM
  // PricingPage: boostConfig.allowance[type][id]). enabled=false / 0 → no line.
  const boostAllow = boostConfig?.enabled !== false ? boostConfig?.allowance?.[employerType] : undefined;

  const makePlan = (id: PlanId, tier: Plan['tier']) => {
    const lim = typePlan.limits[id];
    const boosts = boostAllow ? (Number(boostAllow[id]) || 0) : 0;
    return {
      id, tier,
      labelKey:  id === '1m' ? 'pricingPlanMonthly' : id === '6m' ? 'pricingPlanHalfYearly' : 'pricingPlanYearly',
      accessKey: id === '1m' ? 'pricing1MonthAccess' : id === '6m' ? 'pricing6MonthAccess' : 'pricing12MonthAccess',
      price:    p[id]!,
      mrp:      m[id] ?? 0,
      discount: calcDiscount(m[id] ?? 0, p[id]!),
      contacts: lim.contacts,
      posts:    lim.posts,
      // Duration-specific lines first so each card looks distinct, then the boost
      // line (CRM parity), then the shared static + feature lines.
      benefits: [
        ...buildDurationBenefits(id, lim.contacts, lim.posts, contacts1m, t),
        ...(boosts > 0 ? [t('jp_benefitBoosts', { count: boosts })] : []),
        ...sharedBenefits,
      ],
    };
  };

  return [makePlan('1m', 'basic'), makePlan('6m', 'popular'), makePlan('12m', 'premium')];
}

function buildAgentPlans(
  t: TFn,
  agentPricing?: Record<string, number>,
  agentMrp?: Record<string, number>,
): Plan[] {
  const p = { ...AGENT_FALLBACK, ...(agentPricing ?? {}) };
  const m = agentMrp ?? {};
  const benefits = [
    t('jp_agentBenefitVerifiedBadge'),
    t('jp_agentBenefitPriority'),
    t('jp_agentBenefitSearchResults'),
    t('jp_agentBenefitManageWorkers'),
    t('jp_agentBenefitJobInvites'),
  ];
  return [
    {
      id: '1m', labelKey: 'pricingPlanMonthly', accessKey: 'pricing1MonthAccess',
      price: p['1m']!, mrp: m['1m'] ?? 0, discount: calcDiscount(m['1m'] ?? 0, p['1m']!),
      contacts: 0, posts: 0, tier: 'basic', benefits,
    },
    {
      id: '6m', labelKey: 'pricingPlanHalfYearly', accessKey: 'pricing6MonthAccess',
      price: p['6m']!, mrp: m['6m'] ?? 0, discount: calcDiscount(m['6m'] ?? 0, p['6m']!),
      contacts: 0, posts: 0, tier: 'popular', benefits,
    },
    {
      id: '12m', labelKey: 'pricingPlanYearly', accessKey: 'pricing12MonthAccess',
      price: p['12m']!, mrp: m['12m'] ?? 0, discount: calcDiscount(m['12m'] ?? 0, p['12m']!),
      contacts: 0, posts: 0, tier: 'premium', benefits,
    },
  ];
}

// ── Design tokens — restrained, professional palette (single brand accent) ─────
const C = {
  primary:     '#1037A4',   // brand blue — the one accent
  primaryMid:  '#1A56DB',
  primaryTint: '#EEF3FF',   // very light blue surface
  primaryBorder: '#C7D6F5',
  ink:         '#0F1626',   // near-black headings
  body:        '#475569',   // body text
  muted:       '#94A3B8',   // captions, struck MRP
  white:       '#ffffff',
  surface:     '#ffffff',
  bg:          '#F5F7FC',
  line:        '#E5EAF3',   // hairline borders / dividers
  chipBg:      '#F2F5FB',   // neutral stat chip
  green:       '#059669',
  greenLight:  '#ECFDF5',
  greenBorder: '#A7F3D0',
  red:         '#DC2626',
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
  // t kept for translated header strings (plan name, duration, badge labels)
}) => {
  const gst   = parseFloat((plan.price * gstRate).toFixed(2));
  const total = parseFloat((plan.price + gst).toFixed(2));
  const isLoading = loadingPlanId === plan.id;

  // Recommend the "popular" plan: subtle highlighted border + small badge + filled CTA.
  const isRecommended = plan.tier === 'popular';
  const badgeText = plan.tier === 'premium' ? t('pricingBestValue') : t('pricingMostPopular');
  const showBadge = plan.tier === 'popular' || plan.tier === 'premium';

  return (
    <View
      style={[
        pc.wrap,
        { backgroundColor: C.surface, borderColor: isRecommended ? C.primary : C.line, overflow: 'hidden' },
        isRecommended && pc.wrapRecommended,
      ]}
    >
      {/* Top accent bar — premium CRM-style */}
      <View style={[pc.accentBar, { backgroundColor: C.primary }]} />

      {/* Tier badge — subtle, no full fill */}
      {showBadge && (
        <View style={[pc.badge, { backgroundColor: C.primaryTint, borderColor: C.primaryBorder }]}>
          <AppText style={[pc.badgeTxt, { color: C.primary }]}>{badgeText}</AppText>
        </View>
      )}

      {/* Header row — premium icon tile + plan name + price */}
      <View style={pc.headerRow}>
        <View style={[pc.iconTile, { backgroundColor: C.primaryTint, borderColor: C.primaryBorder }]}>
          <AppText style={pc.iconTxt}>👑</AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText style={[pc.planName, { color: C.ink }]}>{t(plan.labelKey)}</AppText>
          <AppText style={[pc.planDuration, { color: C.body }]}>{t(plan.accessKey)}</AppText>
        </View>
        <View style={pc.priceBlock}>
          {plan.mrp > plan.price && (
            <AppText style={[pc.mrpTxt, { color: C.muted }]}>₹{plan.mrp}</AppText>
          )}
          <AppText style={[pc.priceTxt, { color: C.ink }]}>₹{plan.price}</AppText>
          {plan.discount && (
            <View style={[pc.discountPill, { backgroundColor: C.greenLight, borderColor: C.greenBorder }]}>
              <AppText style={[pc.discountTxt, { color: C.green }]}>
                {t('pricingOffLabel', { pct: plan.discount })}
              </AppText>
            </View>
          )}
        </View>
      </View>

      {/* GST / Total */}
      <View style={pc.gstRow}>
        <AppText style={[pc.gstTxt, { color: C.muted }]}>{t('pricingGst', { amount: gst })}</AppText>
        <AppText style={[pc.totalTxt, { color: C.primary }]}>
          {t('pricingTotal', { amount: total })}
        </AppText>
      </View>

      {/* Stats — employer only */}
      {!isAgent && (
        <View style={pc.statsRow}>
          <View style={[pc.statChip, { backgroundColor: C.chipBg }]}>
            <AppText style={[pc.statVal, { color: C.ink }]}>{plan.contacts}</AppText>
            <AppText style={[pc.statKey, { color: C.body }]}>{t('jp_contactsLabel')}</AppText>
          </View>
          <View style={[pc.statChip, { backgroundColor: C.chipBg }]}>
            <AppText style={[pc.statVal, { color: C.ink }]}>{plan.posts >= 999 ? '∞' : plan.posts}</AppText>
            <AppText style={[pc.statKey, { color: C.body }]}>{t('jp_postsLabel')}</AppText>
          </View>
        </View>
      )}

      {/* Divider */}
      <View style={[pc.divider, { backgroundColor: C.line }]} />

      {/* Benefits — rendered from dynamic benefits array */}
      <View style={pc.benefits}>
        {plan.benefits.map((b) => (
          <View key={b} style={pc.benefitRow}>
            <AppText style={[pc.checkMark, { color: C.primary }]}>✓</AppText>
            <AppText style={[pc.benefitTxt, { color: C.body }]}>{b}</AppText>
          </View>
        ))}
      </View>

      {/* CTA — filled for recommended, outline for the rest */}
      <TouchableOpacity
        style={[
          pc.btn,
          isRecommended
            ? { backgroundColor: C.primary, borderColor: C.primary }
            : { backgroundColor: C.surface, borderColor: C.primary },
          isLoading && { opacity: 0.7 },
        ]}
        onPress={() => onBuy(plan)}
        disabled={isLoading}
        activeOpacity={0.85}
      >
        {isLoading ? (
          <ActivityIndicator color={isRecommended ? C.white : C.primary} size="small" />
        ) : (
          <AppText style={[pc.btnTxt, { color: isRecommended ? C.white : C.primary }]}>
            {isSubscribed ? t('pricingRenewUpgrade') : t('pricingGetStarted')}
          </AppText>
        )}
      </TouchableOpacity>
    </View>
  );
});
PlanCard.displayName = 'PlanCard';

const pc = StyleSheet.create({
  wrap:        { borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 14, marginHorizontal: 16,
                 shadowColor: '#0F1626', shadowOffset: { width: 0, height: 2 },
                 shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  wrapRecommended: { borderWidth: 1.5,
                 shadowOpacity: 0.1, shadowRadius: 14, elevation: 4 },
  accentBar:   { height: 4, marginTop: -18, marginHorizontal: -18, marginBottom: 16 },
  iconTile:    { width: 42, height: 42, borderRadius: 12, borderWidth: 1,
                 alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  iconTxt:     { fontSize: 20 },
  badge:       { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, paddingHorizontal: 11,
                 paddingVertical: 4, marginBottom: 14 },
  badgeTxt:    { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  planName:    { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  planDuration:{ fontSize: 12, fontWeight: '500', marginTop: 3 },
  priceBlock:  { alignItems: 'flex-end', gap: 2 },
  mrpTxt:      { fontSize: 13, textDecorationLine: 'line-through', fontWeight: '500' },
  priceTxt:    { fontSize: 26, fontWeight: '900', letterSpacing: -0.8 },
  discountPill:{ borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, marginTop: 2 },
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
  btn:         { borderRadius: 12, borderWidth: 1.5, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  btnTxt:      { fontSize: 15, fontWeight: '800' },
});

// ── Upgrade banner — informational, derives unlocked features from plan config ──
const UpgradeBanner = React.memo(({
  nextTypeName, benefits, t,
}: {
  nextTypeName: string;
  benefits: string[];
  t: TFn;
}) => (
  <View style={ub.wrap}>
    <AppText style={ub.title}>{t('pr_upgradeTitle')}</AppText>
    <AppText style={ub.subtitle}>{t('pr_upgradeSubtitle', { tier: nextTypeName })}</AppText>
    <View style={ub.list}>
      {benefits.map((b) => (
        <View key={b} style={ub.row}>
          <AppText style={ub.check}>✓</AppText>
          <AppText style={ub.rowTxt}>{b}</AppText>
        </View>
      ))}
    </View>
  </View>
));
UpgradeBanner.displayName = 'UpgradeBanner';

const ub = StyleSheet.create({
  wrap:     { marginHorizontal: 16, marginTop: 4, marginBottom: 4,
              backgroundColor: C.primaryTint, borderRadius: 16, borderWidth: 1,
              borderColor: C.primaryBorder, padding: 16 },
  title:    { fontSize: 15, fontWeight: '800', color: C.ink, marginBottom: 4 },
  subtitle: { fontSize: 12.5, fontWeight: '500', color: C.body, lineHeight: 18, marginBottom: 12 },
  list:     { gap: 8 },
  row:      { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  check:    { fontSize: 13, fontWeight: '900', color: C.primary, lineHeight: 18, marginTop: 1 },
  rowTxt:   { flex: 1, fontSize: 13, fontWeight: '500', color: C.body, lineHeight: 18 },
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

  const { pricing, employerPlans, gstRate, boostConfig } = usePricingConfig();
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
    ? buildAgentPlans(t as TFn, sub?.['agent'], mrp?.['agent'])
    : buildPlans(employerType, t as TFn, sub, mrp, employerPlans, boostConfig);

  // ── Upgrade banner (employer-only) — features derived from the next tier's config ──
  const nextType = !isAgent ? NEXT_TYPE[employerType] : null;
  const upgradeBenefits = nextType
    ? buildUpgradeBenefits(
        (employerPlans[employerType] ?? EMPLOYER_PLANS_DEFAULTS[employerType]).features,
        (employerPlans[nextType] ?? EMPLOYER_PLANS_DEFAULTS[nextType]).features,
        t as TFn,
      )
    : [];
  const showUpgrade = !!nextType && upgradeBenefits.length > 0;

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
        toast.error(t('jp_payUrlMissing'), t('jp_paymentError'));
      }
    } catch {
      toast.error(t('jp_payInitFail'), t('jp_paymentFailed'));
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
        toast.error(t('jp_payUrlMissing'), t('jp_paymentError'));
      }
    } catch {
      toast.error(t('jp_payInitFail'), t('jp_paymentFailed'));
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
    <View style={[s.root, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <ScreenHeader title={t('pricingPageTitle')} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero — clean, premium, CRM-style ── */}
        <View style={s.hero}>
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
                <ActivityIndicator size="small" color={C.primary} />
              ) : (
                <>
                  <AppText style={s.contactsNum}>{remainingContacts}</AppText>
                  <AppText style={s.contactsLabel}>{t('pricingContactsLeft')}</AppText>
                </>
              )}
            </View>
          </View>
        )}

        {/* ── Upgrade/advanced-features upsell box removed for a cleaner, CRM-style page ──
        {showUpgrade && nextType && (
          <UpgradeBanner
            nextTypeName={t(TYPE_NAME_KEY[nextType])}
            benefits={upgradeBenefits}
            t={t as TFn}
          />
        )} */}

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
            <AppText style={s.trustTxt}>🏆 {t('pricingTrustBadge', { count: config.stats.employerCount.toLocaleString('en-IN') })}</AppText>
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

  // Hero — clean light header on the page background (CRM-style)
  hero:         { paddingTop: 24, paddingBottom: 12, paddingHorizontal: 24, alignItems: 'center' },
  heroTitle:    { fontSize: 26, fontWeight: '900', color: C.ink, textAlign: 'center',
                  letterSpacing: -0.6, lineHeight: 32, marginBottom: 8 },
  heroSub:      { fontSize: 13, color: C.body, textAlign: 'center', lineHeight: 20 },

  // Active subscription banner
  activeBanner: { marginHorizontal: 16, marginTop: 14, backgroundColor: C.greenLight,
                  borderRadius: 14, borderWidth: 1, borderColor: C.greenBorder,
                  flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  activeDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: C.green, flexShrink: 0 },
  activeTxt:    { fontSize: 14, fontWeight: '800', color: C.green },
  activeExpiry: { fontSize: 11, color: '#047857', fontWeight: '500', marginTop: 2 },
  contactsPill: { backgroundColor: C.primaryTint, borderRadius: 12, paddingHorizontal: 12,
                  paddingVertical: 8, alignItems: 'center', flexShrink: 0 },
  contactsNum:  { fontSize: 20, fontWeight: '900', color: C.primary, lineHeight: 24 },
  contactsLabel:{ fontSize: 9, fontWeight: '700', color: C.primary, textAlign: 'center',
                  lineHeight: 12, marginTop: 1 },

  // Section title
  sectionTitle: { fontSize: 13, fontWeight: '800', color: C.body,
                  letterSpacing: 0.8, textTransform: 'uppercase',
                  marginTop: 18, marginBottom: 12, marginHorizontal: 16 },

  // Top-up section
  topupSection: { marginHorizontal: 16, marginTop: 4, marginBottom: 8 },
  topupHeader:  { marginBottom: 12 },
  topupTitle:   { fontSize: 15, fontWeight: '800', color: C.ink, marginBottom: 4 },
  topupDesc:    { fontSize: 12, color: C.body, lineHeight: 17 },
  topupCard:    { backgroundColor: C.surface, borderRadius: 14, padding: 16,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 10, borderWidth: 1, borderColor: C.line,
                  shadowColor: '#0F1626', shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  topupLeft:    { flex: 1 },
  topupCount:   { fontSize: 15, fontWeight: '800', color: C.ink, marginBottom: 3 },
  topupPrice:   { fontSize: 12, color: C.body },
  topupGst:     { color: C.muted },
  topupTotal:   { fontWeight: '800', color: C.ink },
  topupBtn:     { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11 },
  topupBtnTxt:  { fontSize: 13, fontWeight: '800', color: C.white },

  // Footer
  footer:       { marginHorizontal: 16, marginTop: 16, marginBottom: 8, alignItems: 'center', gap: 8 },
  trustRow:     { backgroundColor: C.primaryTint, borderRadius: 12, paddingHorizontal: 16,
                  paddingVertical: 10, borderWidth: 1, borderColor: C.primaryBorder },
  trustTxt:     { fontSize: 12, fontWeight: '700', color: C.primary, textAlign: 'center' },
  supportTxt:   { fontSize: 11, color: C.muted, textAlign: 'center' },
});
