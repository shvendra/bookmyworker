import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import { apiClient } from '../../../core/api/client';
import { paymentApi } from '../../../core/api/endpoints/paymentApi';
import {
  usePricingConfig, calcDiscount, buildFeatureBenefits, EMPLOYER_PLANS_DEFAULTS,
} from '../../../core/api/endpoints/pricingApi';
import type { EmployerPlansConfig } from '../../../core/api/endpoints/pricingApi';
import type { MainStackParamList } from '../../../app/navigation/types';
import type { EmployerTypeKey } from '../../../shared/types/domain';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type TFn = (key: string, opts?: Record<string, unknown>) => string;
type PlanId = '1m' | '6m' | '12m';

const BRAND = '#1037A4';
const BRAND_DARK = '#0B2570';
const WHITE = '#FFFFFF';

const PLAN_ORDER: EmployerTypeKey[] = ['individual', 'contractor', 'agency', 'industry'];
const PLAN_META: Record<EmployerTypeKey, { icon: string; taglineKey: string }> = {
  individual: { icon: '🏠', taglineKey: 'eb_tagline_individual' },
  contractor: { icon: '🔨', taglineKey: 'eb_tagline_contractor' },
  agency:     { icon: '🏢', taglineKey: 'eb_tagline_agency' },
  industry:   { icon: '🏭', taglineKey: 'eb_tagline_industry' },
};
const TYPE_NAME_KEY: Record<EmployerTypeKey, string> = {
  individual: 'pr_type_individual',
  contractor: 'pr_type_contractor',
  agency:     'pr_type_agency',
  industry:   'pr_type_industry',
};
const DURATIONS: { id: PlanId; labelKey: string; accessKey: string }[] = [
  { id: '1m',  labelKey: 'pricingPlanMonthly',    accessKey: 'pricing1MonthAccess' },
  { id: '6m',  labelKey: 'pricingPlanHalfYearly',  accessKey: 'pricing6MonthAccess' },
  { id: '12m', labelKey: 'pricingPlanYearly',      accessKey: 'pricing12MonthAccess' },
];
const FALLBACK_PRICING: Record<EmployerTypeKey, Record<string, number>> = {
  individual: { '1m': 199, '6m': 999,  '12m': 1999 },
  contractor: { '1m': 599, '6m': 2900, '12m': 4999 },
  agency:     { '1m': 599, '6m': 2900, '12m': 4999 },
  industry:   { '1m': 999, '6m': 3999, '12m': 5999 },
};
const EMPLOYER_PRIORITY: EmployerTypeKey[] = ['industry', 'agency', 'contractor', 'individual'];

function resolveEmployerType(raw?: { individual?: boolean; contractor?: boolean; agency?: boolean; industry?: boolean }): EmployerTypeKey {
  if (!raw) return 'individual';
  for (const tk of EMPLOYER_PRIORITY) { if (raw[tk]) return tk; }
  return 'individual';
}

interface FreshProfile {
  isSubscribed?: boolean;
  subscriptionExpery?: string;
  remainingContacts?: number;
  remainingPosts?: number;
  employerType?: { individual?: boolean; contractor?: boolean; agency?: boolean; industry?: boolean };
}

export const EmployerBenefitsScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Nav>();
  const { theme } = useAppTheme();
  const { state: authState } = useAuth();
  const toast = useToast();
  const { t } = useTranslation('employer');
  const user = authState.session?.user;
  const isDark = theme.mode === 'dark';

  const { pricing, employerPlans, gstRate } = usePricingConfig();
  const plansCfg: EmployerPlansConfig = employerPlans ?? EMPLOYER_PLANS_DEFAULTS;

  const [modalType, setModalType] = useState<EmployerTypeKey | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<PlanId>('1m');
  const [paying, setPaying] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['employer-benefits-profile'],
    queryFn: async () => {
      const res = await apiClient.get<{ user?: FreshProfile }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    staleTime: 60 * 1000,
  });

  useFocusEffect(useCallback(() => {
    if (profileQuery.isStale) void profileQuery.refetch();
  }, [profileQuery]));

  const profile = profileQuery.data;
  const isActive = !!profile?.isSubscribed &&
    (!profile.subscriptionExpery || new Date(profile.subscriptionExpery).getTime() > Date.now());
  const remainingContacts = profile?.remainingContacts ?? 0;
  const remainingPosts = profile?.remainingPosts ?? 0;
  const typeKey = resolveEmployerType((profile?.employerType ?? user?.employerType) as Parameters<typeof resolveEmployerType>[0]);
  const currentIdx = PLAN_ORDER.indexOf(typeKey);
  const isTopTier = typeKey === 'industry';

  const sub = pricing.subscription as unknown as Record<string, Record<string, number>>;
  const mrp = pricing.subscriptionMrp as unknown as Record<string, Record<string, number>>;

  const priceFor = (tk: EmployerTypeKey, dur: PlanId): number =>
    (sub?.[tk]?.[dur] ?? FALLBACK_PRICING[tk][dur]);
  const mrpFor = (tk: EmployerTypeKey, dur: PlanId): number => (mrp?.[tk]?.[dur] ?? 0);

  const fmtExpiry = (d?: string): string => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return '—'; }
  };

  const handlePay = async (): Promise<void> => {
    if (!user || !modalType) return;
    setPaying(true);
    try {
      const baseAmount = priceFor(modalType, selectedDuration);
      const gstCharges = parseFloat((baseAmount * gstRate).toFixed(2));
      const totalAmount = parseFloat((baseAmount + gstCharges).toFixed(2));
      const resp = await paymentApi.initiateSubscription({
        employerId: user.id,
        firstName: user.fullName,
        email: user.email ?? '',
        employerType: modalType,
        employer_phone: user.phone,
        paymentType: 'subscription',
        amount: totalAmount,
        gstCharges,
        productName: `Employer Subscription Plan - ${modalType} - ${selectedDuration}`,
        planId: selectedDuration,
      });
      if (resp.url) {
        setModalType(null);
        navigation.navigate('PaymentWebView', { url: resp.url, merchantOrderId: resp.merchantOrderId });
      } else {
        toast.error(t('jp_payUrlMissing'), t('jp_paymentError'));
      }
    } catch {
      toast.error(t('jp_payInitFail'), t('jp_paymentFailed'));
    } finally {
      setPaying(false);
    }
  };

  const openModal = (tk: EmployerTypeKey) => {
    setSelectedDuration('1m');
    setModalType(tk);
  };

  const typeLabel = t(TYPE_NAME_KEY[typeKey]);
  const contacts1m = plansCfg[typeKey]?.limits?.['1m']?.contacts || 1;
  const usedPct = isActive && remainingContacts > 0
    ? Math.max(6, Math.min(100, Math.round((remainingContacts / contacts1m) * 100)))
    : 0;

  return (
    <View style={[s.root, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader title={t('eb_title')} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero status card ── */}
        <View style={[s.hero, { backgroundColor: isDark ? BRAND_DARK : BRAND }]}>
          <View style={s.heroDecor1} />
          <View style={s.heroDecor2} />
          <View style={s.heroTopRow}>
            <View style={{ flex: 1 }}>
              <AppText style={s.heroLabel}>👑 {t('eb_currentPlan')}</AppText>
              <AppText style={s.heroTitle}>{t('eb_planNameFmt', { type: typeLabel })}</AppText>
              <AppText style={s.heroTagline}>{t(PLAN_META[typeKey].taglineKey)}</AppText>
              <View style={[s.statusChip, { backgroundColor: isActive ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.22)' }]}>
                <AppText style={[s.statusChipTxt, { color: isActive ? '#86EFAC' : '#FCA5A5' }]}>
                  {isActive ? t('eb_activeExpires', { date: fmtExpiry(profile?.subscriptionExpery) }) : t('eb_noSub')}
                </AppText>
              </View>
            </View>
            <View style={s.heroStats}>
              {[
                { label: t('eb_contactsLeft'), value: isActive ? remainingContacts : '—' },
                { label: t('eb_postsLeft'),    value: isActive ? remainingPosts : '—' },
              ].map((stat) => (
                <View key={stat.label} style={s.heroStatBox}>
                  <AppText style={s.heroStatVal}>{stat.value}</AppText>
                  <AppText style={s.heroStatLabel}>{stat.label}</AppText>
                </View>
              ))}
            </View>
          </View>

          {isActive && (
            <View style={s.usageWrap}>
              <View style={s.usageHeadRow}>
                <AppText style={s.usageLabel}>{t('eb_usageThisMonth')}</AppText>
                <AppText style={s.usageLabel}>{t('eb_remaining', { count: remainingContacts })}</AppText>
              </View>
              <View style={s.usageTrack}>
                <View style={[s.usageFill, { width: `${usedPct}%`, backgroundColor: usedPct < 20 ? '#F87171' : '#FFFFFF' }]} />
              </View>
            </View>
          )}
        </View>

        {/* ── Tier progression ── */}
        <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <AppText style={[s.sectionLabel, { color: theme.colors.mutedText }]}>{t('eb_progression')}</AppText>
          <View style={s.tierRow}>
            {PLAN_ORDER.map((pk, i) => {
              const active = i === currentIdx;
              const passed = i < currentIdx;
              const done = active || passed;
              return (
                <React.Fragment key={pk}>
                  <View style={s.tierStep}>
                    <View style={[
                      s.tierDot,
                      done ? { backgroundColor: BRAND, borderColor: BRAND } : { backgroundColor: theme.colors.surface1, borderColor: theme.colors.border },
                      active && s.tierDotActive,
                    ]}>
                      <AppText style={[s.tierDotTxt, { color: done ? WHITE : theme.colors.mutedText }]}>{passed ? '✓' : i + 1}</AppText>
                    </View>
                    <AppText numberOfLines={2} style={[s.tierName, { color: active ? theme.colors.text : theme.colors.mutedText, fontWeight: active ? '800' : '500' }]}>
                      {t(TYPE_NAME_KEY[pk])}
                    </AppText>
                  </View>
                  {i < PLAN_ORDER.length - 1 && (
                    <View style={[s.tierLine, { backgroundColor: i < currentIdx ? BRAND : theme.colors.border }]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* ── Plan comparison ── */}
        <AppText style={[s.sectionLabel, { color: theme.colors.mutedText, marginHorizontal: 16, marginTop: 6 }]}>
          {t('eb_comparison')}
        </AppText>

        {PLAN_ORDER.map((pk) => {
          const idx = PLAN_ORDER.indexOf(pk);
          const isCurrent = pk === typeKey;
          const isUpgrade = idx > currentIdx;
          const isLower = idx < currentIdx;
          const meta = PLAN_META[pk];
          const planData = plansCfg[pk] ?? EMPLOYER_PLANS_DEFAULTS[pk];
          const benefits = buildFeatureBenefits(planData.features, t as TFn);
          const lim1m = planData.limits['1m'];
          const fromPrice = priceFor(pk, '1m');

          return (
            <View key={pk} style={[
              s.planCard,
              { backgroundColor: theme.colors.card, borderColor: isCurrent ? BRAND : theme.colors.border },
              isCurrent && s.planCardCurrent,
            ]}>
              <View style={[s.planAccent, { backgroundColor: isUpgrade ? BRAND : isCurrent ? '#16A34A' : theme.colors.border }]} />
              <View style={s.planHeader}>
                <View style={[s.planIcon, { backgroundColor: theme.colors.primaryLight }]}>
                  <AppText style={{ fontSize: 20 }}>{meta.icon}</AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={[s.planName, { color: theme.colors.text }]}>{t(TYPE_NAME_KEY[pk])}</AppText>
                  <AppText style={[s.planTagline, { color: theme.colors.mutedText }]}>{t(meta.taglineKey)}</AppText>
                </View>
                {isCurrent && (
                  <View style={s.currentBadge}><AppText style={s.currentBadgeTxt}>{t('eb_current')}</AppText></View>
                )}
              </View>

              <View style={s.planStatsRow}>
                <View style={[s.planStat, { backgroundColor: theme.colors.surface1 }]}>
                  <AppText style={[s.planStatVal, { color: BRAND }]}>{lim1m.contacts}</AppText>
                  <AppText style={[s.planStatKey, { color: theme.colors.mutedText }]}>{t('jp_contactsLabel')}</AppText>
                </View>
                <View style={[s.planStat, { backgroundColor: theme.colors.surface1 }]}>
                  <AppText style={[s.planStatVal, { color: BRAND }]}>{lim1m.posts >= 999 ? '∞' : lim1m.posts}</AppText>
                  <AppText style={[s.planStatKey, { color: theme.colors.mutedText }]}>{t('jp_postsLabel')}</AppText>
                </View>
              </View>

              <View style={s.planBenefits}>
                {benefits.slice(0, 5).map((b) => (
                  <View key={b} style={s.benefitRow}>
                    <AppText style={[s.benefitTick, { color: BRAND }]}>✓</AppText>
                    <AppText style={[s.benefitTxt, { color: theme.colors.textSecondary }]}>{b}</AppText>
                  </View>
                ))}
              </View>

              {isLower ? (
                <View style={[s.planBtn, s.planBtnDisabled, { borderColor: theme.colors.border }]}>
                  <AppText style={[s.planBtnTxt, { color: theme.colors.mutedText }]}>{t('eb_included')}</AppText>
                </View>
              ) : (
                <TouchableOpacity
                  style={[s.planBtn, { backgroundColor: BRAND }]}
                  activeOpacity={0.85}
                  onPress={() => openModal(pk)}
                >
                  <AppText style={s.planBtnTxt}>
                    {isUpgrade ? t('eb_upgrade') : isActive ? t('eb_renew') : t('eb_choose')} · ₹{fromPrice}+
                  </AppText>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* ── Top-tier message ── */}
        {isTopTier && (
          <View style={[s.topTier, { backgroundColor: isDark ? theme.colors.card : '#F0FDF4', borderColor: isDark ? theme.colors.border : '#BBF7D0' }]}>
            <AppText style={{ fontSize: 28, marginBottom: 6 }}>🏆</AppText>
            <AppText style={[s.topTierTitle, { color: theme.colors.text }]}>{t('eb_topTierTitle')}</AppText>
            <AppText style={[s.topTierDesc, { color: theme.colors.mutedText }]}>{t('eb_topTierDesc')}</AppText>
          </View>
        )}
      </ScrollView>

      {/* ── Upgrade / buy modal ── */}
      <Modal visible={modalType !== null} transparent animationType="slide" onRequestClose={() => setModalType(null)}>
        <View style={s.modalBackdrop}>
          <View style={[s.modalSheet, { backgroundColor: theme.colors.card }]}>
            <View style={[s.modalHead, { backgroundColor: BRAND }]}>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontSize: 20 }}>{modalType ? PLAN_META[modalType].icon : ''}</AppText>
                <AppText style={s.modalTitle}>
                  {modalType ? t('eb_upgradeToFmt', { type: t(TYPE_NAME_KEY[modalType]) }) : ''}
                </AppText>
              </View>
              <TouchableOpacity onPress={() => setModalType(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <AppText style={s.modalClose}>✕</AppText>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
              <AppText style={[s.sectionLabel, { color: theme.colors.mutedText, marginBottom: 10 }]}>{t('eb_selectDuration')}</AppText>
              {modalType && DURATIONS.map((d) => {
                const price = priceFor(modalType, d.id);
                const m = mrpFor(modalType, d.id);
                const disc = calcDiscount(m, price);
                const selected = selectedDuration === d.id;
                return (
                  <TouchableOpacity
                    key={d.id}
                    activeOpacity={0.85}
                    onPress={() => setSelectedDuration(d.id)}
                    style={[s.durRow, { borderColor: selected ? BRAND : theme.colors.border, backgroundColor: selected ? theme.colors.primaryLight : theme.colors.surface1 }]}
                  >
                    <View style={[s.radio, { borderColor: selected ? BRAND : theme.colors.border }]}>
                      {selected && <View style={s.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={[s.durName, { color: theme.colors.text }]}>{t(d.labelKey)}</AppText>
                      <AppText style={[s.durAccess, { color: theme.colors.mutedText }]}>{t(d.accessKey)}</AppText>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      {m > price && <AppText style={[s.durMrp, { color: theme.colors.mutedText }]}>₹{m}</AppText>}
                      <AppText style={[s.durPrice, { color: selected ? BRAND : theme.colors.text }]}>₹{price}</AppText>
                      {!!disc && <AppText style={s.durDisc}>{disc}% OFF</AppText>}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {isActive && (remainingContacts > 0 || remainingPosts > 0) && (
                <View style={[s.carryNote, { backgroundColor: theme.colors.primaryLight }]}>
                  <AppText style={[s.carryTxt, { color: theme.colors.text }]}>🎁 {t('eb_carryover')}</AppText>
                  {/* Show exactly what carries over (matches CRM upgrade view) */}
                  <View style={s.carryChips}>
                    {remainingContacts > 0 && (
                      <View style={[s.carryChip, { borderColor: BRAND }]}>
                        <AppText style={[s.carryChipTxt, { color: BRAND }]}>+{remainingContacts} {t('jp_contactsLabel')}</AppText>
                      </View>
                    )}
                    {remainingPosts > 0 && (
                      <View style={[s.carryChip, { borderColor: BRAND }]}>
                        <AppText style={[s.carryChipTxt, { color: BRAND }]}>+{remainingPosts} {t('jp_postsLabel')}</AppText>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {modalType && (() => {
                const base = priceFor(modalType, selectedDuration);
                const gst = parseFloat((base * gstRate).toFixed(2));
                const total = parseFloat((base + gst).toFixed(2));
                return (
                  <View style={[s.totalRow, { borderTopColor: theme.colors.border }]}>
                    <AppText style={[s.totalLabel, { color: theme.colors.mutedText }]}>{t('eb_total')} (+GST)</AppText>
                    <AppText style={[s.totalVal, { color: theme.colors.text }]}>₹{total}</AppText>
                  </View>
                );
              })()}

              <TouchableOpacity
                style={[s.payBtn, { backgroundColor: BRAND, opacity: paying ? 0.7 : 1 }]}
                activeOpacity={0.85}
                disabled={paying}
                onPress={() => void handlePay()}
              >
                {paying
                  ? <ActivityIndicator size="small" color={WHITE} />
                  : <AppText style={s.payBtnTxt}>{modalType ? t('eb_payNowFmt', { amount: `₹${parseFloat((priceFor(modalType, selectedDuration) * (1 + gstRate)).toFixed(2))}` }) : ''}</AppText>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { paddingBottom: 40 },

  // Hero
  hero:        { marginHorizontal: 16, marginTop: 14, borderRadius: 18, padding: 18, overflow: 'hidden' },
  heroDecor1:  { position: 'absolute', top: -40, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.05)' },
  heroDecor2:  { position: 'absolute', bottom: -50, left: '35%', width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.04)' },
  heroTopRow:  { flexDirection: 'row', gap: 14 },
  heroLabel:   { color: 'rgba(255,255,255,0.65)', fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  heroTitle:   { color: WHITE, fontSize: 23, lineHeight: 32, fontWeight: '900', letterSpacing: -0.4, marginBottom: 3 },
  heroTagline: { color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 17, marginBottom: 10 },
  statusChip:  { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusChipTxt: { fontSize: 11, fontWeight: '700' },
  heroStats:   { gap: 8 },
  heroStatBox: { minWidth: 76, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  heroStatVal: { color: WHITE, fontSize: 20, fontWeight: '900', lineHeight: 22 },
  heroStatLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600', marginTop: 2 },
  usageWrap:   { marginTop: 16 },
  usageHeadRow:{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  usageLabel:  { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '600' },
  usageTrack:  { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  usageFill:   { height: 6, borderRadius: 3 },

  // Generic card / section
  card:         { marginHorizontal: 16, marginTop: 14, borderRadius: 14, borderWidth: 1, padding: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },

  // Tier progression
  tierRow:      { flexDirection: 'row', alignItems: 'flex-start', marginTop: 14 },
  tierStep:     { alignItems: 'center', width: 64 },
  tierDot:      { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  tierDotActive:{ transform: [{ scale: 1.08 }] },
  tierDotTxt:   { fontSize: 13, fontWeight: '800' },
  tierName:     { fontSize: 10.5, textAlign: 'center' },
  tierLine:     { flex: 1, height: 2, marginTop: 16 },

  // Plan cards
  planCard:        { marginHorizontal: 16, marginTop: 12, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  planCardCurrent: { borderWidth: 1.5 },
  planAccent:      { height: 4 },
  planHeader:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 10 },
  planIcon:        { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  planName:        { fontSize: 16, lineHeight: 22, fontWeight: '800' },
  planTagline:     { fontSize: 11.5, marginTop: 2 },
  currentBadge:    { backgroundColor: '#16A34A', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  currentBadgeTxt: { color: WHITE, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  planStatsRow:    { flexDirection: 'row', gap: 10, paddingHorizontal: 14, marginBottom: 12 },
  planStat:        { flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: 'center' },
  planStatVal:     { fontSize: 18, fontWeight: '900', lineHeight: 20 },
  planStatKey:     { fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  planBenefits:    { paddingHorizontal: 14, gap: 7, marginBottom: 14 },
  benefitRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  benefitTick:     { fontSize: 13, fontWeight: '900', lineHeight: 18 },
  benefitTxt:      { flex: 1, fontSize: 12.5, fontWeight: '500', lineHeight: 18 },
  planBtn:         { marginHorizontal: 14, marginBottom: 14, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  planBtnDisabled: { backgroundColor: 'transparent', borderWidth: 1.5 },
  planBtnTxt:      { color: WHITE, fontSize: 14, fontWeight: '800' },

  // Top tier
  topTier:      { marginHorizontal: 16, marginTop: 14, borderRadius: 14, borderWidth: 1, padding: 22, alignItems: 'center' },
  topTierTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  topTierDesc:  { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:    { borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '88%', overflow: 'hidden' },
  modalHead:     { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 12 },
  modalTitle:    { color: WHITE, fontSize: 17, fontWeight: '900', marginTop: 2 },
  modalClose:    { color: 'rgba(255,255,255,0.8)', fontSize: 18, fontWeight: '700' },
  durRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 14, marginBottom: 10 },
  radio:         { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: BRAND },
  durName:       { fontSize: 14, fontWeight: '800' },
  durAccess:     { fontSize: 11.5, marginTop: 1 },
  durMrp:        { fontSize: 11, textDecorationLine: 'line-through' },
  durPrice:      { fontSize: 16, fontWeight: '900' },
  durDisc:       { fontSize: 10, fontWeight: '800', color: '#15803D' },
  carryNote:     { borderRadius: 12, padding: 12, marginTop: 4, marginBottom: 4 },
  carryTxt:      { fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  carryChips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  carryChip:     { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  carryChipTxt:  { fontSize: 12, fontWeight: '800' },
  totalRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10, paddingTop: 14 },
  totalLabel:    { fontSize: 13, fontWeight: '600' },
  totalVal:      { fontSize: 20, fontWeight: '900' },
  payBtn:        { borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  payBtnTxt:     { color: WHITE, fontSize: 15, fontWeight: '800' },
});

export default EmployerBenefitsScreen;
