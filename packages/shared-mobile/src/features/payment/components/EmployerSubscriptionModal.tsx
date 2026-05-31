import React, { useEffect, useRef } from 'react';
import {
  Animated,
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
import {
  usePricingConfig,
  calcDiscount,
  EMPLOYER_PLANS_DEFAULTS,
} from '../../../core/api/endpoints/pricingApi';
import type { EmployerTypeKey, PlanFeatures } from '../../../core/api/endpoints/pricingApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { Avatar } from '../../../shared/components/ui/Avatar';

interface EmployerSubscriptionModalProps {
  visible: boolean;
  onDismiss: () => void;
  userName: string;
  employerType?: EmployerTypeKey;
}

// ─── Static + dynamic benefit groups ──────────────────────────────────────────
// Each group has:
//   staticItems — always shown regardless of plan config (2 per group)
//   dynamicItems — shown only when the matching feature flag is true

interface BenefitGroup {
  icon:      string;
  label:     string;
  color:     string;
  colorDark: string;
  bg:        string;
  bgDark:    string;
  items:     string[];   // resolved at render time
}

const SCOPE_TEXT = { district: 'your district', state: 'your state (state-wide)', india: 'all of India' };

function buildBenefitGroups(features: PlanFeatures, contacts1m: number): BenefitGroup[] {
  // ── ⚡ Priority & Speed — 2 static always + conditional ───────────────────
  const speed: string[] = [
    'Verified workers get job alerts for subscribed employers',
    'Your employer account is whitelisted for faster responses',
  ];
  if (features.priorityListing) speed.push('Priority listing — your requirements shown first to workers');

  // ── 🔓 Full Access — 2 static always + conditional ────────────────────────
  const access: string[] = [
    'View verified worker profiles & work history',
    `Unlock up to ${contacts1m} worker contacts in the first month`,
  ];
  // Scope line only when state/india — district is the default minimum
  if (features.workerSearchScope === 'state') access.push('Search workers state-wide — not limited to your district');
  if (features.workerSearchScope === 'india') access.push('Search workers across all of India — no location cap');

  // ── 🎯 Smart Matching — 2 static always + conditional ─────────────────────
  const match: string[] = [
    'Advanced filters: location, skill, age, gender',
    'Real-time job-worker matching notifications',
  ];
  if (features.pipelineEnabled)  match.push('Full hiring pipeline — Shortlist → Interview → Join');
  if (features.inviteEnabled)    match.push('Directly invite workers to apply for your jobs');
  if (features.bulkPostEnabled)  match.push('Bulk post multiple requirements at once');
  if (features.unlimitedPosts)   match.push('Unlimited job requirement posts — no daily cap');

  // ── 🛡️ Trust & Support — 2 static always + conditional ───────────────────
  const trust: string[] = [
    'All workers verified with skills & background checks',
    'Secure payment with BookMyWorker guarantee',
  ];
  if (features.analyticsEnabled) trust.push(`Hiring analytics dashboard (${features.analyticsMonths}-month history)`);
  if (features.dedicatedSupport) trust.push('Dedicated BookMyWorker account manager assigned');

  return [
    {
      icon: '⚡', label: 'Priority & Speed',
      color: '#F59E0B', colorDark: '#FBBF24', bg: '#FFFBEB', bgDark: '#451A03',
      items: speed,
    },
    {
      icon: '🔓', label: 'Full Access',
      color: '#1A56DB', colorDark: '#4F7CF8', bg: '#EBF1FF', bgDark: '#1C2E58',
      items: access,
    },
    {
      icon: '🎯', label: 'Smart Matching',
      color: '#059669', colorDark: '#10B981', bg: '#ECFDF5', bgDark: '#064E3B',
      items: match,
    },
    {
      icon: '🛡️', label: 'Trust & Support',
      color: '#7C3AED', colorDark: '#A78BFA', bg: '#F3EFFE', bgDark: '#2E1B5E',
      items: trust,
    },
  ];
}

const STATS = [
  { value: '50K+', label: 'Verified\nWorkers' },
  { value: '3×',   label: 'Faster\nResponses' },
  { value: '98%',  label: 'Hire\nSuccess' },
];

// ─── Component ─────────────────────────────────────────────────────────────────
export const EmployerSubscriptionModal = ({
  visible,
  onDismiss,
  userName,
  employerType = 'individual',
}: EmployerSubscriptionModalProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const isDark = theme.mode === 'dark';
  const { pricing, employerPlans } = usePricingConfig();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  // Resolve this employer type's plan config
  const typePlan   = employerPlans[employerType] ?? EMPLOYER_PLANS_DEFAULTS[employerType];
  const features   = typePlan.features;
  const contacts1m = typePlan.limits['1m'].contacts;

  // Pricing teaser (1-month entry price)
  const monthlyPrice = pricing.subscription[employerType]?.['1m'] ?? pricing.subscription.individual['1m'];
  const monthlyMrp   = pricing.subscriptionMrp[employerType]?.['1m'] ?? pricing.subscriptionMrp.individual['1m'];
  const monthlyDisc  = calcDiscount(monthlyMrp, monthlyPrice);

  const benefitGroups = buildBenefitGroups(features, contacts1m);

  // Slide-up animation
  const slideAnim   = useRef(new Animated.Value(60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(60);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim,   { toValue: 0,   useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(opacityAnim, { toValue: 1,   duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleViewPlans = (): void => {
    onDismiss();
    navigation.navigate('Subscription');
  };

  const heroBg    = isDark ? '#07112A' : '#1037A4';
  const heroText  = '#FFFFFF';
  const heroMuted = isDark ? 'rgba(241,245,249,0.60)' : 'rgba(255,255,255,0.72)';

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onDismiss}>
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
        <Animated.View
          style={[styles.sheet, { backgroundColor: theme.colors.card, transform: [{ translateY: slideAnim }] }]}
        >
          {/* Drag pill */}
          <View style={styles.pillWrap} pointerEvents="none">
            <View style={[styles.pill, { backgroundColor: isDark ? '#2A3E5E' : '#D1D5DB' }]} />
          </View>

          {/* ── Hero ── */}
          <View style={[styles.hero, { backgroundColor: heroBg }]}>
            <View style={[styles.circle1, { backgroundColor: 'rgba(255,255,255,0.06)' }]}  pointerEvents="none" />
            <View style={[styles.circle2, { backgroundColor: 'rgba(255,255,255,0.04)' }]}  pointerEvents="none" />
            <View style={[styles.circle3, { backgroundColor: 'rgba(79,124,248,0.18)' }]}   pointerEvents="none" />

            <View style={styles.avatarWrap}>
              <Avatar name={userName} size={68} ring ringColor="rgba(255,255,255,0.50)" />
              <View style={styles.premiumBadge}>
                <AppText style={styles.premiumBadgeText}>⭐ PRO</AppText>
              </View>
            </View>

            <AppText style={[styles.heroTitle, { color: heroText }]}>
              Hire Smarter with Premium
            </AppText>
            <AppText style={[styles.heroSub, { color: heroMuted }]}>
              Employers who subscribe get{' '}
              <AppText style={styles.heroBold}>3× more responses</AppText>
              {'\n'}and fill roles faster.
            </AppText>

            {/* Stats strip */}
            <View style={styles.statsRow}>
              {STATS.map((s, i) => (
                <React.Fragment key={s.value}>
                  <View style={styles.statItem}>
                    <AppText style={[styles.statValue, { color: heroText }]}>{s.value}</AppText>
                    <AppText style={[styles.statLabel, { color: heroMuted }]}>{s.label}</AppText>
                  </View>
                  {i < STATS.length - 1 && (
                    <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

            {/* ── Dynamic benefit groups ── */}
            {benefitGroups.map((group) => {
              const iconBg    = isDark ? group.bgDark    : group.bg;
              const iconColor = isDark ? group.colorDark : group.color;
              return (
                <View key={group.label} style={[styles.benefitGroup, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <View style={styles.groupHeader}>
                    <View style={[styles.groupIconWrap, { backgroundColor: iconBg }]}>
                      <AppText style={styles.groupIcon}>{group.icon}</AppText>
                    </View>
                    <AppText style={[styles.groupLabel, { color: iconColor }]}>{group.label}</AppText>
                  </View>
                  {group.items.map((item) => (
                    <View key={item} style={styles.benefitRow}>
                      <View style={[styles.checkDot, { backgroundColor: iconColor }]}>
                        <AppText style={styles.checkTick}>✓</AppText>
                      </View>
                      <AppText style={[styles.benefitText, { color: theme.colors.textSecondary }]}>
                        {item}
                      </AppText>
                    </View>
                  ))}
                </View>
              );
            })}

            {/* ── Pricing teaser ── */}
            <View style={[styles.priceCard, {
              backgroundColor: theme.colors.primaryLight,
              borderColor:     isDark ? theme.colors.borderStrong : '#BFDBFE',
            }]}>
              <View style={styles.priceCardInner}>
                <View style={styles.priceTitleRow}>
                  <AppText style={[styles.pricePlanLabel, { color: theme.colors.primary }]}>
                    Flexible Plans — {employerType.charAt(0).toUpperCase() + employerType.slice(1)} Pricing
                  </AppText>
                  {monthlyDisc && (
                    <View style={[styles.savingsBadge, { backgroundColor: theme.colors.success }]}>
                      <AppText style={styles.savingsBadgeText}>Save {monthlyDisc}%</AppText>
                    </View>
                  )}
                </View>
                <View style={styles.priceRow}>
                  <AppText style={[styles.priceFrom, { color: theme.colors.mutedText }]}>Starting from</AppText>
                  {monthlyMrp > monthlyPrice && (
                    <AppText style={styles.priceMrp}>₹{monthlyMrp}</AppText>
                  )}
                  <AppText style={[styles.priceAmount, { color: theme.colors.primary }]}>₹{monthlyPrice}</AppText>
                  <AppText style={[styles.priceUnit, { color: theme.colors.mutedText }]}>/mo</AppText>
                </View>
                <AppText style={[styles.priceNote, { color: theme.colors.mutedText }]}>
                  Plans for Individual · Contractor · Agency · Industry
                </AppText>
              </View>
            </View>

            {/* ── Social proof ── */}
            <View style={[styles.proofRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <AppText style={[styles.proofText, { color: theme.colors.mutedText }]}>
                🏢 Trusted by{' '}
                <AppText style={[styles.proofBold, { color: theme.colors.text }]}>2,000+ employers</AppText>
                {' '}across India — from solo contractors to large industries.
              </AppText>
            </View>
          </ScrollView>

          {/* ── Footer ── */}
          <View style={[styles.footer, { borderTopColor: theme.colors.divider, backgroundColor: theme.colors.card }]}>
            <TouchableOpacity onPress={onDismiss} style={[styles.laterBtn, { borderColor: theme.colors.border }]} activeOpacity={0.7}>
              <AppText style={[styles.laterText, { color: theme.colors.mutedText }]}>Later</AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleViewPlans} style={[styles.plansBtn, { backgroundColor: theme.colors.primary }]} activeOpacity={0.88}>
              <AppText style={styles.plansBtnText}>View Plans  →</AppText>
            </TouchableOpacity>
          </View>
          <AppText style={[styles.noCommit, { color: theme.colors.mutedText }]}>
            No commitment · Cancel anytime
          </AppText>

          {/* Close pill (pressable) */}
          <Pressable onPress={onDismiss} style={styles.closePill} hitSlop={14}>
            <View style={[styles.pillBar, { backgroundColor: isDark ? '#2A3E5E' : '#D1D5DB' }]} />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.60)', justifyContent: 'flex-end' },
  sheet:    { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', maxHeight: '94%' },

  pillWrap: { position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  pill:     { width: 38, height: 4, borderRadius: 2 },

  hero: { paddingTop: 34, paddingBottom: 20, paddingHorizontal: 20, alignItems: 'center', overflow: 'hidden', gap: 8 },
  circle1:{ position: 'absolute', top: -70, right: -60, width: 220, height: 220, borderRadius: 110 },
  circle2:{ position: 'absolute', bottom: -50, left: -40, width: 160, height: 160, borderRadius: 80 },
  circle3:{ position: 'absolute', top: 20, left: -20, width: 120, height: 120, borderRadius: 60 },

  avatarWrap:       { position: 'relative', marginBottom: 2 },
  premiumBadge:     {
    position: 'absolute', top: -6, right: -28,
    backgroundColor: '#F59E0B', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4,
  },
  premiumBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  heroTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', lineHeight: 26, letterSpacing: -0.3 },
  heroSub:   { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  heroBold:  { fontWeight: '700', color: '#FFFFFF' },

  statsRow:    {
    flexDirection: 'row', marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 6, alignSelf: 'stretch',
  },
  statItem:    { flex: 1, alignItems: 'center', gap: 2 },
  statValue:   { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  statLabel:   { fontSize: 10, textAlign: 'center', lineHeight: 13 },
  statDivider: { width: 1, marginVertical: 4 },

  body:        { maxHeight: 420 },
  bodyContent: { padding: 14, gap: 10 },

  benefitGroup:  { borderRadius: 18, borderWidth: 1, padding: 14, gap: 8 },
  groupHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  groupIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  groupIcon:     { fontSize: 16 },
  groupLabel:    { fontSize: 13, fontWeight: '800', letterSpacing: 0.1 },
  benefitRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkDot:      { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  checkTick:     { fontSize: 10, color: '#fff', fontWeight: '900', lineHeight: 12 },
  benefitText:   { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '500' },

  priceCard:      { borderRadius: 18, borderWidth: 1.5, overflow: 'hidden' },
  priceCardInner: { padding: 16, gap: 6 },
  priceTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pricePlanLabel: { fontSize: 13, fontWeight: '800', flex: 1 },
  savingsBadge:   { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  savingsBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  priceRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  priceFrom:   { fontSize: 12, fontWeight: '500' },
  priceMrp:    { fontSize: 13, color: '#94A3B8', textDecorationLine: 'line-through', fontWeight: '500' },
  priceAmount: { fontSize: 28, fontWeight: '900', lineHeight: 34, letterSpacing: -0.5 },
  priceUnit:   { fontSize: 13, fontWeight: '600', alignSelf: 'flex-end', marginBottom: 3 },
  priceNote:   { fontSize: 11, lineHeight: 15 },

  proofRow:    { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  proofText:   { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  proofBold:   { fontWeight: '700' },

  footer: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  laterBtn:     { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 14, alignItems: 'center' },
  laterText:    { fontSize: 14, fontWeight: '600' },
  plansBtn:     {
    flex: 1.8, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 10, elevation: 5,
  },
  plansBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  noCommit:     { textAlign: 'center', fontSize: 11, paddingBottom: 18, fontStyle: 'italic' },

  closePill: { position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center' },
  pillBar:   { width: 38, height: 4, borderRadius: 2 },
});
