import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlert } from '../../../shared/state/alert/AppAlertContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../../app/navigation/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../../core/theme';
import { usePricingConfig } from '../../../core/api/endpoints/pricingApi';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { RawRequirement } from '../../../core/api/endpoints/requirementsApi';
import { agentApi } from '../../../core/api/endpoints/agentApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { type CompletenessField } from '../../../shared/components/ui/ProfileCompletenessCard';
import { SectionHeader } from '../../../shared/components/ui/SectionHeader';
import { GradientHeader } from '../../../shared/components/ui/GradientHeader';
import { Skeleton, SkeletonCard } from '../../../shared/components/ui/Skeleton';
import { WorkerCategoryGrid } from '../../../shared/components/ui/WorkerCategoryGrid';
import { getJobTitle, getCategoryLabel, getLocationStr } from '../../../shared/utils/labelUtils';
import { buildJobShareMessage } from '../../../shared/utils/jobShare';
import { describeLoadError, firstQueryError } from '../../../shared/utils/describeLoadError';
import { VerifiedBadgeModal } from '../../../shared/components/ui/VerifiedBadgeModal';
import { HelpChatModal } from '../../../shared/components/ui/HelpChatModal';
// Profile-completion nudge disabled for now — mandatory completion is enforced
// via the post-OTP WorkerProfileCompletionScreen instead.
// import { ProfileCompletionModal } from '../../../shared/components/ui/ProfileCompletionModal';
import { GuidedTour } from '../../../shared/components/ui/GuidedTour';
import { PromoBannerSlider } from '../../../shared/components/ui/PromoBannerSlider';
import i18n from '../../../core/i18n';

const { width: SCREEN_W } = Dimensions.get('window');
// Full content width = screen minus the body's horizontal padding (12 each side),
// so each slider card fills the viewport for clean one-at-a-time paging.
const CARD_W = SCREEN_W - 24;

// ── Work type visual config ───────────────────────────────────────────────────
interface WorkVisual { emoji: string; color: string; bg: string; accent: string }

const WORK_VISUALS: Record<string, WorkVisual> = {
  // snake_case values (from categories.json)
  construction_project_workers:     { emoji: '🏗️', color: '#92400E', bg: '#FFFBEB', accent: '#F59E0B' },
  manufacturing_industrial_workers: { emoji: '⚙️', color: '#1E3A8A', bg: '#EFF6FF', accent: '#3B82F6' },
  agriculture_farming_workers:      { emoji: '🌾', color: '#14532D', bg: '#F0FDF4', accent: '#22C55E' },
  event_decoration_workers:         { emoji: '🎊', color: '#4C1D95', bg: '#F5F3FF', accent: '#8B5CF6' },
  household_domestic_workers:       { emoji: '🧹', color: '#164E63', bg: '#ECFEFF', accent: '#06B6D4' },
  hospitality_service_workers:      { emoji: '🛎️', color: '#831843', bg: '#FDF2F8', accent: '#EC4899' },
  transport_logistics_workers:      { emoji: '🚛', color: '#1E3A8A', bg: '#EFF6FF', accent: '#6366F1' },
  retail_shop_workers:              { emoji: '🏪', color: '#78350F', bg: '#FFFBEB', accent: '#D97706' },
  skilled_technical_workers:        { emoji: '🛠️', color: '#064E3B', bg: '#F0FDF4', accent: '#10B981' },
  specialized_creative_workers:     { emoji: '🎨', color: '#581C87', bg: '#FAF5FF', accent: '#A855F7' },
  'Automobile & Workshop Workers':  { emoji: '🚗', color: '#1C1917', bg: '#F8FAFC', accent: '#64748B' },
  'Healthcare Support Workers':     { emoji: '🏥', color: '#7F1D1D', bg: '#FFF5F5', accent: '#EF4444' },
  'Security & Facility Workers':    { emoji: '👮', color: '#0F172A', bg: '#F1F5F9', accent: '#475569' },
  // Label-string aliases (for legacy DB records that stored display labels)
  'Construction & Project Workers':     { emoji: '🏗️', color: '#92400E', bg: '#FFFBEB', accent: '#F59E0B' },
  'Manufacturing & Industrial Workers': { emoji: '⚙️', color: '#1E3A8A', bg: '#EFF6FF', accent: '#3B82F6' },
  'Agriculture & Farming Workers':      { emoji: '🌾', color: '#14532D', bg: '#F0FDF4', accent: '#22C55E' },
  'Event & Decoration Workers':         { emoji: '🎊', color: '#4C1D95', bg: '#F5F3FF', accent: '#8B5CF6' },
  'Household & Domestic Workers':       { emoji: '🧹', color: '#164E63', bg: '#ECFEFF', accent: '#06B6D4' },
  'Hospitality & Service Workers':      { emoji: '🛎️', color: '#831843', bg: '#FDF2F8', accent: '#EC4899' },
  'Transport & Logistics Workers':      { emoji: '🚛', color: '#1E3A8A', bg: '#EFF6FF', accent: '#6366F1' },
  'Retail & Shop Workers':              { emoji: '🏪', color: '#78350F', bg: '#FFFBEB', accent: '#D97706' },
  'Retail & Service Workers':           { emoji: '🏪', color: '#78350F', bg: '#FFFBEB', accent: '#D97706' },
  'Skilled Technical Workers':          { emoji: '🛠️', color: '#064E3B', bg: '#F0FDF4', accent: '#10B981' },
  'Specialized & Creative Workers':     { emoji: '🎨', color: '#581C87', bg: '#FAF5FF', accent: '#A855F7' },
  'Security & Facility Worker':         { emoji: '👮', color: '#0F172A', bg: '#F1F5F9', accent: '#475569' },
};
const DEFAULT_VISUAL: WorkVisual = { emoji: '👷', color: '#1037A4', bg: '#EBF1FF', accent: '#3B82F6' };

// Subcategory keyword → emoji overrides (applied on top of work-type base visual)
const SUB_EMOJI_RULES: Array<{ pattern: RegExp; emoji: string }> = [
  { pattern: /clean|sweep|maid|janitor|housekeep|sanit/i, emoji: '🧹' },
  { pattern: /cook|chef|kitchen|catering/i,               emoji: '👨‍🍳' },
  { pattern: /security|guard|watchman|bouncer/i,          emoji: '👮' },
  { pattern: /driver|chauffeur/i,                         emoji: '🚗' },
  { pattern: /electrician|electric|wiring/i,              emoji: '⚡' },
  { pattern: /plumber|plumbing/i,                         emoji: '🔧' },
  { pattern: /carpenter|woodwork|furniture/i,             emoji: '🪚' },
  { pattern: /painter|painting/i,                         emoji: '🖌️' },
  { pattern: /welder|welding/i,                           emoji: '🔥' },
  { pattern: /nurse|patient care|caregiv/i,               emoji: '👩‍⚕️' },
  { pattern: /garden|landscap/i,                          emoji: '🌿' },
  { pattern: /delivery|courier|dispatch/i,                emoji: '📦' },
  { pattern: /packer|packaging/i,                         emoji: '📦' },
  { pattern: /tailor|sewing|stitch/i,                     emoji: '🧵' },
  { pattern: /barber|salon|hair/i,                        emoji: '✂️' },
  { pattern: /loader|loading/i,                           emoji: '💪' },
];

const getVisual = (workType?: string | null, subCategory?: string | null): WorkVisual => {
  const base = (workType && WORK_VISUALS[workType]) ? WORK_VISUALS[workType] : DEFAULT_VISUAL;
  if (subCategory) {
    const rule = SUB_EMOJI_RULES.find(({ pattern }) => pattern.test(subCategory));
    if (rule) return { ...base, emoji: rule.emoji };
  }
  return base;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const getGreetKey = (): 'goodMorning' | 'goodAfternoon' | 'goodEvening' => {
  const h = new Date().getHours();
  if (h < 12) return 'goodMorning';
  if (h < 17) return 'goodAfternoon';
  return 'goodEvening';
};

const fmtLabel = (s?: string | null): string => {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const inferPeriod = (amount: number): string => {
  if (amount < 2000) return 'day';
  if (amount <= 4000) return 'week';
  return 'month';
};

const getSalaryType = (req: RawRequirement): string =>
  inferPeriod(req.minBudgetPerWorker ?? 0);

const VERIFIED_BADGE_SHOWN_KEY = 'verifiedBadgeShown_v1';

// ── Stat Widget Card ──────────────────────────────────────────────────────────
interface StatWidgetProps {
  emoji: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string | null;
  gradient: readonly [string, string];
  onPress: () => void;
  isLoading?: boolean;
}

const StatWidget = ({ emoji, label, sub, gradient, onPress, isLoading }: StatWidgetProps): React.JSX.Element => (
  <Pressable
    onPress={onPress}
    style={({ pressed }: { pressed: boolean }) => [
      styles.statWidget,
      { backgroundColor: gradient[0], opacity: pressed ? 0.88 : 1 },
    ]}
    android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
  >
    <View style={[styles.statWidgetGrad, { backgroundColor: gradient[1] }]} pointerEvents="none" />
    <View style={styles.statWidgetInner}>
      <Ionicons name={emoji} size={22} color="#FFFFFF" style={styles.statEmoji} />
      <AppText style={styles.statLabel}>{label}</AppText>
      {isLoading ? (
        <View style={styles.statSubSkeleton} />
      ) : (
        sub !== null && <AppText style={styles.statSub} numberOfLines={1}>{sub}</AppText>
      )}
    </View>
  </Pressable>
);

// ── Requirement Slider Card ───────────────────────────────────────────────────
interface ReqSliderCardProps {
  req: RawRequirement;
  alreadyApplied: boolean;
  isLiked: boolean;
  onApply: () => void;
  onLike: () => void;
  onShare: () => void;
  onViewAll: () => void;
}

const ReqSliderCard = ({ req, alreadyApplied, isLiked, onApply, onLike, onShare, onViewAll }: ReqSliderCardProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t, i18n } = useTranslation();
  const visual = getVisual(req.workType, req.subCategory);
  const isDark = theme.mode === 'dark';

  const jobTitle = getJobTitle(req.workType, req.subCategory, i18n.language, t);
  const catLabel = getCategoryLabel(req.workType, t);
  const salaryMin = req.minBudgetPerWorker ?? 0;
  const salaryMax = req.maxBudgetPerWorker ?? 0;
  const salaryType = getSalaryType(req);
  const salaryPeriod = t(`salaryPeriod_${salaryType}` as 'salaryPeriod_day' | 'salaryPeriod_month' | 'salaryPeriod_week');
  const location = getLocationStr(
    { tehsil: req.tehsil, district: req.district, state: req.state },
    i18n.language,
    t('panIndia'),
  );
  const workers = (req.workerQuantitySkilled ?? 0) + (req.workerQuantityUnskilled ?? 0);
  const cardBg = isDark ? theme.colors.card : '#FFFFFF';
  const headerBg = isDark ? visual.color + '22' : visual.bg;
  const hasPerks = req.accommodationAvailable || req.foodAvailable || req.transportProvided || req.bonus
    || req.weeklyOff || req.overtimeAvailable || req.insuranceAvailable || req.pfAvailable || req.esicAvailable || req.incentive;

  return (
    <TouchableOpacity activeOpacity={0.97} style={[sliderCard.wrap, { backgroundColor: cardBg, width: CARD_W }]} onPress={onViewAll}>

      {/* ── Compact header ────────────────────────────────── */}
      <View style={[sliderCard.header, { backgroundColor: headerBg }]}>
        <View style={[sliderCard.blob, { backgroundColor: visual.accent + '20' }]} />
        <View style={sliderCard.headerRow}>

          {/* Emoji box */}
          <View style={[sliderCard.emojiWrap, { backgroundColor: isDark ? theme.colors.surface : visual.accent + '25' }]}>
            <AppText style={sliderCard.emojiTxt}>{visual.emoji}</AppText>
          </View>

          {/* Info: title + category + salary */}
          <View style={sliderCard.infoWrap}>
            <AppText style={[sliderCard.title, { color: isDark ? theme.colors.text : visual.color }]} numberOfLines={2}>
              {jobTitle}
            </AppText>
            <AppText style={[sliderCard.catLabel, { color: isDark ? theme.colors.mutedText : visual.color + 'AA' }]} numberOfLines={2}>
              {catLabel}
            </AppText>
            <View style={sliderCard.salaryRow}>
              <AppText style={[sliderCard.salaryTxt, { color: visual.accent }]} numberOfLines={1}>
                ₹{salaryMin.toLocaleString('en-IN')}–{salaryMax.toLocaleString('en-IN')}
              </AppText>
              <View style={[sliderCard.periodBadge, { backgroundColor: visual.accent + '18', borderColor: visual.accent + '40' }]}>
                <AppText style={[sliderCard.periodTxt, { color: visual.accent }]} numberOfLines={1}>{t('salaryPer')} {salaryPeriod}</AppText>
              </View>
            </View>
          </View>

          {/* Like + Share stacked */}
          <View style={sliderCard.iconCol}>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onShare(); }}
              activeOpacity={0.75}
              style={[sliderCard.iconBtn, { backgroundColor: isDark ? theme.colors.surface : '#FFFFFF' + 'DD' }]}
            >
              <AppText style={sliderCard.iconTxt}>📤</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onLike(); }}
              activeOpacity={0.75}
              style={[sliderCard.iconBtn, { backgroundColor: isLiked ? '#FEE2E2' : (isDark ? theme.colors.surface : '#FFFFFF' + 'DD') }]}
            >
              <AppText style={sliderCard.iconTxt}>{isLiked ? '❤️' : '🤍'}</AppText>
            </TouchableOpacity>
          </View>

        </View>
      </View>

      {/* ── Meta: location + workers + perks (wraps so nothing is clipped) */}
      <View style={[sliderCard.metaWrap, { borderTopColor: isDark ? theme.colors.border : '#EEF2F8' }]}>
        <Ionicons name="location-sharp" size={12} color={theme.colors.mutedText} style={sliderCard.metaIcon} />
        <AppText style={[sliderCard.metaTxt, { color: theme.colors.mutedText, flexShrink: 1 }]}>{location}</AppText>
        {workers > 0 && (
          <>
            <AppText style={[sliderCard.metaDot, { color: theme.colors.mutedText }]}> · </AppText>
            <AppText style={sliderCard.metaIcon}>👷</AppText>
            <AppText style={[sliderCard.metaTxt, { color: theme.colors.mutedText }]}>{t('workerNeeded', { count: workers })}</AppText>
          </>
        )}
        {hasPerks && <AppText style={[sliderCard.metaDot, { color: theme.colors.mutedText }]}> · </AppText>}
        {req.accommodationAvailable && <AppText style={[sliderCard.perkTxt, { color: '#15803D' }]}>🏠 {t('perkStay')}  </AppText>}
        {req.foodAvailable          && <AppText style={[sliderCard.perkTxt, { color: '#C2410C' }]}>🍱 {t('perkFood')}  </AppText>}
        {req.transportProvided      && <AppText style={[sliderCard.perkTxt, { color: '#1D4ED8' }]}>🚌 {t('perkTransport')}  </AppText>}
        {req.bonus                  && <AppText style={[sliderCard.perkTxt, { color: '#7C3AED' }]}>🎁 {t('perkBonus')}  </AppText>}
        {req.incentive              && <AppText style={[sliderCard.perkTxt, { color: '#92400E' }]}>⭐ {t('perkIncentive')}  </AppText>}
        {req.weeklyOff              && <AppText style={[sliderCard.perkTxt, { color: '#15803D' }]}>📅 {t('perkWeeklyOff')}  </AppText>}
        {req.overtimeAvailable      && <AppText style={[sliderCard.perkTxt, { color: '#C2410C' }]}>⏱ {t('perkOvertime')}  </AppText>}
        {req.insuranceAvailable     && <AppText style={[sliderCard.perkTxt, { color: '#1D4ED8' }]}>🛡 {t('perkInsurance')}  </AppText>}
        {req.pfAvailable            && <AppText style={[sliderCard.perkTxt, { color: '#7C3AED' }]}>🏦 {t('perkPf')}  </AppText>}
        {req.esicAvailable          && <AppText style={[sliderCard.perkTxt, { color: '#0E7490' }]}>🏥 {t('perkEsic')}</AppText>}
      </View>

      {/* ── Apply button ───────────────────────────────────── */}
      <View style={[sliderCard.applyWrap, { borderTopColor: isDark ? theme.colors.border : '#EEF2F8' }]}>
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); if (!alreadyApplied) onApply(); }}
          activeOpacity={alreadyApplied ? 1 : 0.82}
          style={[sliderCard.applyBtn, { backgroundColor: alreadyApplied ? '#10B981' : visual.accent }]}
        >
          <AppText style={sliderCard.applyTxt}>{alreadyApplied ? t('appliedTick') : `${t('applyNow')}  →`}</AppText>
        </TouchableOpacity>
      </View>

    </TouchableOpacity>
  );
};

// ── "View All" end card ───────────────────────────────────────────────────────
const ViewAllCard = ({ onPress }: { onPress: () => void }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[sliderCard.wrap, sliderCard.viewAllWrap, { backgroundColor: '#1037A4', width: CARD_W * 0.55 }]}
    >
      <AppText style={sliderCard.viewAllEmoji}>📋</AppText>
      <AppText style={sliderCard.viewAllTitle}>{t('viewAllJobs')}</AppText>
      <AppText style={sliderCard.viewAllArrow}>→</AppText>
    </TouchableOpacity>
  );
};

// ── Mini Wage Modal (quick apply from dashboard) ──────────────────────────────
interface MiniWageModalProps {
  visible: boolean;
  req: RawRequirement | null;
  onClose: () => void;
  onSubmit: (reqId: string, wage: number) => void;
  loading: boolean;
}

const MiniWageModal = ({ visible, req, onClose, onSubmit, loading }: MiniWageModalProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [wage, setWage] = useState('');
  const visual = getVisual(req?.workType, req?.subCategory);
  const minWage = req?.minBudgetPerWorker ?? 0;

  useEffect(() => { if (visible) setWage(''); }, [visible]);

  const jobTitle = getJobTitle(req?.workType, req?.subCategory, i18n.language, t);
  const period = req ? getSalaryType(req) : 'day';
  const periodLabel = t(`salaryPeriod_${period}` as 'salaryPeriod_day' | 'salaryPeriod_month' | 'salaryPeriod_week');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={modal.overlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity
            activeOpacity={1}
            style={[modal.box, { backgroundColor: theme.colors.surface, paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
          >
          {/* Job mini-banner */}
          <View style={[modal.banner, { backgroundColor: visual.bg }]}>
            <AppText style={modal.bannerEmoji}>{visual.emoji}</AppText>
            <View style={{ flex: 1 }}>
              <AppText style={[modal.bannerTitle, { color: visual.color }]} numberOfLines={2}>{jobTitle}</AppText>
              <AppText style={[modal.bannerSub, { color: visual.color + '99' }]} numberOfLines={2}>
                {getLocationStr({ district: req?.district, state: req?.state }, i18n.language, '')} · {t('wageMinBanner', { minWage, period })}
              </AppText>
            </View>
          </View>

          <AppText style={[modal.fieldLabel, { color: theme.colors.mutedText }]}>
            {t('wageFieldLabel', { period: periodLabel, minWage })}
          </AppText>
          <TextInput
            value={wage}
            onChangeText={setWage}
            keyboardType="numeric"
            placeholder={t('wageInputPlaceholder', { minWage })}
            placeholderTextColor={theme.colors.mutedText}
            style={[modal.input, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]}
          />

          <View style={modal.actions}>
            <TouchableOpacity onPress={onClose} style={[modal.cancelBtn, { borderColor: theme.colors.border }]}>
              <AppText style={[modal.cancelTxt, { color: theme.colors.mutedText }]}>{t('cancel')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                const n = Number(wage);
                if (!n || n < minWage) {
                  showAlert(t('alertInvalidWage'), t('alertMinWageMsg', { minWage }));
                  return;
                }
                if (req?._id) onSubmit(req._id, n);
              }}
              style={[modal.submitBtn, { backgroundColor: visual.accent }, loading && { opacity: 0.7 }]}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator size="small" color="#FFF" />
                : <AppText style={modal.submitTxt}>{t('submitApplication')}</AppText>
              }
            </TouchableOpacity>
          </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export const AgentDashboardScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const { t } = useTranslation();
  const { pricing } = usePricingConfig();
  const user = state.session?.user;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const queryClient = useQueryClient();

  const normalizedRole = (user?.role ?? '').toLowerCase();
  const isAgent = normalizedRole === 'agent';
  const userId = user?.id ?? '';
  const role = normalizedRole || 'worker';

  const [badgeModalVisible, setBadgeModalVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [interestedIds, setInterestedIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [wageModalReq, setWageModalReq] = useState<RawRequirement | null>(null);
  const sliderRef = useRef<ScrollView>(null);
  const autoScrollX = useRef(0);
  const scrollPaused = useRef(false);
  const liveCountRef = useRef(0);

  const likeMutation = useMutation({
    mutationFn: (reqId: string) => requirementsApi.toggleLike(reqId),
    onMutate: (reqId) => {
      // Optimistic update
      setLikedIds((prev) => {
        const next = new Set(prev);
        next.has(reqId) ? next.delete(reqId) : next.add(reqId);
        return next;
      });
    },
    onError: (_, reqId) => {
      // Rollback on error
      setLikedIds((prev) => {
        const next = new Set(prev);
        next.has(reqId) ? next.delete(reqId) : next.add(reqId);
        return next;
      });
    },
  });

  const handleLike = (id: string): void => { likeMutation.mutate(id); };

  const handleShare = async (req: RawRequirement): Promise<void> => {
    const { Share } = await import('react-native');
    const jobTitle = req.subCategory ? fmtLabel(req.subCategory) : fmtLabel(req.workType);
    const location = getLocationStr({ district: req.district, state: req.state }, i18n.language, '—');
    const salary = `₹${req.minBudgetPerWorker ?? 0}–${req.maxBudgetPerWorker ?? 0}`;
    const { message, url, title } = buildJobShareMessage({
      requirementId: req._id,
      jobTitle,
      location,
      salary,
      period: getSalaryType(req),
      workers: (req.workerQuantitySkilled ?? 0) + (req.workerQuantityUnskilled ?? 0),
    });
    try {
      await Share.share({ message, url, title });
    } catch { /* dismissed */ }
  };

  useEffect(() => {
    if (!userId || !isAgent || user?.veryfiedBage) return;
    void AsyncStorage.getItem(VERIFIED_BADGE_SHOWN_KEY).then((shown) => {
      if (!shown) {
        setBadgeModalVisible(true);
        void AsyncStorage.setItem(VERIFIED_BADGE_SHOWN_KEY, '1');
      }
    });
  }, [userId, user?.role, user?.veryfiedBage]);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const reqsQuery = useQuery({
    queryKey: ['agent-reqs-dash', userId],
    queryFn: () =>
      requirementsApi.listForRole({
        role: isAgent ? 'agent' : 'selfworker',
        userId,
        page: 1,
        limit: 1,
      }),
    staleTime: 60 * 1000,
    enabled: !!userId,
  });

  // Fetch live requirements for the horizontal slider
  const liveReqsQuery = useQuery({
    queryKey: ['agent-live-reqs-slider', userId, role],
    queryFn: () =>
      requirementsApi.listForRole({
        role: isAgent ? 'agent' : 'selfworker',
        userId,
        page: 1,
        limit: 50,
      }),
    staleTime: 60 * 1000,
    enabled: !!userId,
  });

  const statsQuery = useQuery({
    queryKey: ['agent-stats', userId],
    queryFn: () => agentApi.getStats(),
    staleTime: 60 * 1000,
    enabled: !!userId && isAgent,
  });

  const unseenInvitationQuery = useQuery({
    queryKey: ['invitation-unseen-count'],
    queryFn: () => requirementsApi.getUnseenInvitationCount(),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!userId,
  });

  // Refresh unseen count when screen comes back into focus
  useFocusEffect(
    React.useCallback(() => {
      void unseenInvitationQuery.refetch();
    }, [unseenInvitationQuery]),
  );

  const unseenCount = unseenInvitationQuery.data ?? 0;

  // Apply mutation
  const interestMutation = useMutation({
    mutationFn: ({ reqId, wage }: { reqId: string; wage: number }) =>
      requirementsApi.expressInterestWithWage(reqId, wage),
    onSuccess: (_, { reqId }) => {
      setInterestedIds((prev) => new Set([...prev, reqId]));
      setWageModalReq(null);
      void queryClient.invalidateQueries({ queryKey: ['agent-live-reqs-slider'] });
      showAlert(t('alertAppliedTitle'), t('alertAppliedMsg'));
    },
    onError: () => showAlert(t('alertError'), t('alertSubmitError')),
  });

  const isInterested = (req: RawRequirement): boolean =>
    interestedIds.has(req._id) ||
    Boolean(req.intrestedAgents?.some((a) => a.agentId === userId));

  // Seed likedIds from server data (likedBy array on each requirement)
  useEffect(() => {
    const reqs = liveReqsQuery.data?.requirements ?? [];
    if (!reqs.length || !userId) return;
    setLikedIds((prev) => {
      const next = new Set(prev);
      reqs.forEach((r) => {
        if (r.likedBy?.includes(userId)) next.add(r._id);
      });
      return next;
    });
  }, [liveReqsQuery.data, userId]);

  // Sync live count for auto-scroll
  useEffect(() => {
    liveCountRef.current = liveReqsQuery.data?.requirements?.length ?? 0;
  }, [liveReqsQuery.data]);

  // Auto-scroll: advances one card every 3s, pauses on touch
  useEffect(() => {
    const step = CARD_W + 12;
    const id = setInterval(() => {
      if (scrollPaused.current || liveCountRef.current < 2) return;
      autoScrollX.current += step;
      if (autoScrollX.current >= liveCountRef.current * step) {
        autoScrollX.current = 0;
        sliderRef.current?.scrollTo({ x: 0, animated: false });
      } else {
        sliderRef.current?.scrollTo({ x: autoScrollX.current, animated: true });
      }
    }, 3000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isRefreshing = reqsQuery.isFetching || statsQuery.isFetching || liveReqsQuery.isFetching;

  const handleRefresh = (): void => {
    void reqsQuery.refetch();
    void liveReqsQuery.refetch();
    if (isAgent) void statsQuery.refetch();
  };

  // Surface a retry affordance when the primary data sources fail, instead of
  // silently rendering zeros / an empty job list on the agent's home screen.
  const hasLoadError = reqsQuery.isError || liveReqsQuery.isError || (isAgent && statsQuery.isError);
  // Explain WHY the refresh failed (slow internet / server busy / session).
  const loadErrorReason = describeLoadError(
    firstQueryError([reqsQuery, liveReqsQuery, isAgent ? statsQuery : null]),
    t,
  );

  const liveReqs = liveReqsQuery.data?.requirements ?? [];

  const kycPending = user?.kycStatus === 'pending' || user?.kycStatus === 'rejected';
  const greetKey = getGreetKey();

  // ── Profile completeness fields (agent) — agent-specific info ──
  // Email & work-areas are intentionally excluded: the agent app does not
  // collect them, so they should neither count toward the % nor appear as
  // pending chips on the profile-strength card.
  const completenessFields = useMemo<CompletenessField[]>(() => [
    { key: 'name',      label: t('pf_name'),      done: !!user?.fullName?.trim() },
    { key: 'phone',     label: t('pf_phone'),     done: !!user?.phone },
    { key: 'state',     label: t('pf_state'),     done: !!user?.state?.trim() },
    { key: 'district',  label: t('pf_district'),  done: !!user?.district?.trim() },
    { key: 'photo',     label: t('pf_photo'),     done: !!user?.profileImage },
    { key: 'kyc',       label: t('pf_kyc'),       done: user?.kycStatus === 'verified' },
  ], [t, user?.fullName, user?.phone, user?.state, user?.district, user?.profileImage, user?.kycStatus]);

  // ── Profile completeness % for the header avatar badge ──
  const profilePct = useMemo(() => {
    const d = completenessFields.filter((f) => f.done).length;
    return completenessFields.length ? Math.round((d / completenessFields.length) * 100) : 0;
  }, [completenessFields]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />

      <VerifiedBadgeModal
        visible={badgeModalVisible}
        onDismiss={() => setBadgeModalVisible(false)}
        userRole={normalizedRole}
        userId={userId}
        userName={user?.fullName ?? ''}
        userEmail={user?.email ?? ''}
        userPhone={user?.phone ?? ''}
      />

      <GradientHeader
        subtitle={t(greetKey)}
        title={user?.fullName ?? (isAgent ? t('agentRole') : t('workerRole'))}
        caption={kycPending ? `⚠️ ${t('verificationPending')}` : `✓ ${t('verified')}`}
        avatarName={user?.fullName ?? 'U'}
        avatarUri={user?.profileImage}
        onAvatarPress={() => navigation.navigate('EditProfile')}
        avatarBadge={`${profilePct}%`}
        avatarBadgeColor={profilePct >= 90 ? '#10B981' : profilePct >= 70 ? '#3B82F6' : profilePct >= 40 ? '#F59E0B' : '#EF4444'}
        rightIcon="📬"
        onRightPress={() => navigation.navigate('Invitations')}
        rightIcon2="💬"
        onRightPress2={() => setHelpVisible(true)}
        notifCount={unseenCount > 0 ? unseenCount : undefined}
        style={{ paddingBottom: 14 }}
      />

      <HelpChatModal visible={helpVisible} onClose={() => setHelpVisible(false)} />

      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>

          {/* Promotional Banner Slider */}
          <PromoBannerSlider onCategoryPress={(cat) => navigation.navigate('JobMarketplace', { workType: cat.value })} />

          {/* ── Data load error banner (retry) ── */}
          {hasLoadError && (
            <TouchableOpacity
              onPress={handleRefresh}
              activeOpacity={0.85}
              disabled={isRefreshing}
              style={errBanner.wrap}
            >
              <AppText style={errBanner.icon}>⚠️</AppText>
              <View style={errBanner.textCol}>
                <AppText style={errBanner.msg} numberOfLines={1}>{t('dashboardLoadError')}</AppText>
                {!!loadErrorReason && (
                  <AppText style={errBanner.reason} numberOfLines={3}>{loadErrorReason}</AppText>
                )}
              </View>
              <View style={errBanner.cta}>
                <AppText style={errBanner.ctaTxt}>{isRefreshing ? '…' : t('retry')}</AppText>
              </View>
            </TouchableOpacity>
          )}

          {/* ── Job Invitations banner (shown when employer sent invites) ── */}
          {unseenCount > 0 && (
            <TouchableOpacity
              onPress={() => navigation.navigate('Invitations')}
              activeOpacity={0.88}
              style={[invBanner.wrap]}
            >
              <View style={invBanner.left}>
                <View style={invBanner.iconWrap}>
                  <Ionicons name="mail" size={22} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={invBanner.title}>
                    {unseenCount === 1
                      ? '1 new job invitation!'
                      : `${unseenCount} new job invitations!`}
                  </AppText>
                  <AppText style={invBanner.sub}>An employer wants to hire you · Tap to view</AppText>
                </View>
              </View>
              <View style={invBanner.cta}>
                <AppText style={invBanner.ctaTxt}>View →</AppText>
              </View>
            </TouchableOpacity>
          )}

          {/* ── KYC alert ─────────────────────────────────────── */}
          {/* {kycPending && (
            <Pressable
              onPress={() => navigation.navigate('Kyc')}
              style={[styles.alertBanner, { backgroundColor: theme.colors.warningLight, borderColor: theme.colors.warning }]}
            >
              <AppText style={styles.alertIcon}>⚠️</AppText>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="labelSm" color={theme.colors.warning}>{t('kycPendingTitle')}</AppText>
                <AppText variant="caption" color={theme.colors.mutedText}>{t('kycPendingMsg')}</AppText>
              </View>
            </Pressable>
          )} */}

          {/* ── Verified badge upsell ─────────────────────────── */}
          {isAgent && !user?.veryfiedBage && (
            <Pressable onPress={() => setBadgeModalVisible(true)} style={styles.verifyBanner}>
              <View style={styles.verifyBannerLeft}>
                <Ionicons name="star" size={20} color="#FBBF24" style={styles.verifyBannerIcon} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="labelSm" color="#FFFFFF">{t('getVerifiedBadge')}</AppText>
                  <AppText variant="caption" color="rgba(255,255,255,0.72)">Boost visibility — ₹{pricing.verifiedBadge.agent}</AppText>
                </View>
              </View>
              <AppText style={styles.verifyBannerArrow}>→</AppText>
            </Pressable>
          )}

          {/* ── Profile Strength card moved to the Profile tab (below the
                profile photo). The avatar % badge in the header still reflects
                completeness. ── */}

          {/* ── Live Requirements Slider ───────────────────────── */}
          <View style={styles.sliderSection}>
            {/* Section header */}
            <View style={styles.sliderHeader}>
              <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                <AppText numberOfLines={2} style={[styles.sliderTitle, { color: theme.colors.text }]}>{t('openJobsNearYou')}</AppText>
                <AppText style={[styles.sliderSub, { color: theme.colors.mutedText }]}>{t('scrollSeeMore')}</AppText>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('JobMarketplace')}
                style={[styles.viewAllBtn, { backgroundColor: '#EBF1FF', borderColor: '#C3D3F5' }]}
                activeOpacity={0.8}
              >
                <AppText style={styles.viewAllBtnText}>{t('viewAll')}</AppText>
                <AppText style={styles.viewAllBtnArrow}> ›</AppText>
              </TouchableOpacity>
            </View>

            {/* Horizontal scroll */}
            {liveReqsQuery.isLoading ? (
              <View style={styles.sliderSkeleton}>
                {[0, 1].map((i) => (
                  <Skeleton key={i} width={CARD_W} height={180} borderRadius={20} />
                ))}
              </View>
            ) : liveReqs.length === 0 ? (
              <View style={[styles.sliderEmpty, { backgroundColor: theme.colors.card }]}>
                <AppText style={styles.sliderEmptyEmoji}>🔍</AppText>
                <AppText style={[styles.sliderEmptyTxt, { color: theme.colors.mutedText }]}>{t('noOpenJobsNow')}</AppText>
                <TouchableOpacity onPress={() => navigation.navigate('JobMarketplace')} activeOpacity={0.8}>
                  <AppText style={styles.sliderEmptyLink}>{t('browseAllJobs')} →</AppText>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <ScrollView
                  ref={sliderRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sliderContent}
                  decelerationRate="fast"
                  snapToInterval={CARD_W + 12}
                  snapToAlignment="start"
                  scrollEventThrottle={16}
                  onTouchStart={() => { scrollPaused.current = true; }}
                  onTouchEnd={() => { setTimeout(() => { scrollPaused.current = false; }, 2000); }}
                  onMomentumScrollEnd={(e) => {
                    autoScrollX.current = e.nativeEvent.contentOffset.x;
                  }}
                >
                  {liveReqs.map((req) => (
                    <ReqSliderCard
                      key={req._id}
                      req={req}
                      alreadyApplied={isInterested(req)}
                      isLiked={likedIds.has(req._id)}
                      onApply={() => setWageModalReq(req)}
                      onLike={() => handleLike(req._id)}
                      onShare={() => { void handleShare(req); }}
                      onViewAll={() => navigation.navigate('JobMarketplaceDetail', { requirementId: req._id })}
                    />
                  ))}
                  <ViewAllCard onPress={() => navigation.navigate('JobMarketplace')} />
                </ScrollView>
              </>
            )}
          </View>

          {/* ── Browse Work Categories ─────────────────────────── */}
          <SectionHeader
            title={t('browseCategories')}
            subtitle={t('browseCategoriesSubtitle')}
            style={styles.sectionGap}
          />
          {reqsQuery.isLoading ? (
            <SkeletonCard />
          ) : (
            <WorkerCategoryGrid
              horizontal
              onCategoryPress={(cat) => navigation.navigate('JobMarketplace', { workType: cat.value })}
            />
          )}

          {/* ── Quick links row ───────────────────────────────── */}
          <View style={styles.quickRow}>
            <Pressable
              onPress={() => navigation.navigate('JobMarketplace')}
              style={[styles.quickBtn, { backgroundColor: theme.colors.primaryLight }]}
            >
              <AppText style={[styles.quickBtnText, { color: theme.colors.primary }]}>
                📋 {t('allRequirements')}
              </AppText>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('JobMarketplace', { myInterests: true })}
              style={[styles.quickBtn, { backgroundColor: '#FEF3F2', borderColor: '#FCA5A5' }]}
            >
              <AppText style={[styles.quickBtnText, { color: '#DC2626' }]}>
                ❤️ {t('myInterests')}
              </AppText>
            </Pressable>
          </View>

          {/* ── WhatsApp community banner ─────────────────────── */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => void Linking.openURL('https://whatsapp.com/channel/0029VbCKi4T72WTpgeytLk1f')}
            style={styles.waBanner}
          >
            {/* Green glow circle */}
            <View style={styles.waGlow} />

            <View style={styles.waLeft}>
              <View style={styles.waIconWrap}>
                <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" style={styles.waIcon} />
              </View>
              <View style={styles.waTextBlock}>
                <AppText style={styles.waTitle}>{t('waTitle')}</AppText>
                <AppText style={styles.waSub}>{t('waSub')}</AppText>
              </View>
            </View>

            <View style={styles.waArrowWrap}>
              <AppText style={styles.waArrow}>›</AppText>
            </View>
          </TouchableOpacity>

        </View>
      </ScrollView>

      {/* Quick-apply wage modal */}
      <MiniWageModal
        visible={Boolean(wageModalReq)}
        req={wageModalReq}
        onClose={() => setWageModalReq(null)}
        onSubmit={(reqId, wage) => interestMutation.mutate({ reqId, wage })}
        loading={interestMutation.isPending}
      />

      {/* Profile-completion popup disabled for now. */}
      {/* {user && <ProfileCompletionModal user={user} />} */}

      {isAgent ? (
        <GuidedTour
          tourKey="agent_tour_v1"
          steps={[
            { icon: t('tour_agent_1_icon'), title: t('tour_agent_1_title'), desc: t('tour_agent_1_desc') },
            { icon: t('tour_agent_2_icon'), title: t('tour_agent_2_title'), desc: t('tour_agent_2_desc') },
            { icon: t('tour_agent_3_icon'), title: t('tour_agent_3_title'), desc: t('tour_agent_3_desc') },
            { icon: t('tour_agent_4_icon'), title: t('tour_agent_4_title'), desc: t('tour_agent_4_desc') },
            { icon: t('tour_agent_5_icon'), title: t('tour_agent_5_title'), desc: t('tour_agent_5_desc') },
          ]}
          skipLabel={t('tour_skip')}
          nextLabel={t('tour_next')}
          backLabel={t('tour_back')}
          finishLabel={t('tour_getStarted')}
          stepOfLabel={t('tour_stepOf')}
        />
      ) : (
        <GuidedTour
          tourKey="worker_tour_v1"
          steps={[
            { icon: t('tour_worker_1_icon'), title: t('tour_worker_1_title'), desc: t('tour_worker_1_desc') },
            { icon: t('tour_worker_2_icon'), title: t('tour_worker_2_title'), desc: t('tour_worker_2_desc') },
            { icon: t('tour_worker_3_icon'), title: t('tour_worker_3_title'), desc: t('tour_worker_3_desc') },
            { icon: t('tour_worker_4_icon'), title: t('tour_worker_4_title'), desc: t('tour_worker_4_desc') },
            { icon: t('tour_worker_5_icon'), title: t('tour_worker_5_title'), desc: t('tour_worker_5_desc') },
          ]}
          skipLabel={t('tour_skip')}
          nextLabel={t('tour_next')}
          backLabel={t('tour_back')}
          finishLabel={t('tour_getStarted')}
          stepOfLabel={t('tour_stepOf')}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },
  // Gutter (20) matches the GradientHeader so content lines up with the greeting;
  // larger top padding gives the first card room to breathe below the header.
  body: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 20 },

  // ── Alerts ──────────────────────────────────────────────────────────────────
  alertBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 12,
  },
  alertIcon: { fontSize: 18, lineHeight: 22 },

  verifyBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1E3A8A', borderRadius: 14,
    padding: 14, marginBottom: 4, gap: 10,
  },
  verifyBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  verifyBannerIcon: { fontSize: 20, lineHeight: 24 },
  verifyBannerArrow: { fontSize: 18, color: 'rgba(255,255,255,0.8)', fontWeight: '700' },

  // ── 2×2 stat widget grid ────────────────────────────────────────────────────
  widgetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20, marginTop: 2 },
  statWidget: {
    width: '47.5%', borderRadius: 20, overflow: 'hidden',
    minHeight: 110, padding: 16, position: 'relative',
  },
  statWidgetGrad: { ...StyleSheet.absoluteFillObject, opacity: 0.42, borderRadius: 20 },
  statWidgetInner: { gap: 6, zIndex: 1 },
  statEmoji: { fontSize: 26, lineHeight: 30 },
  statLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', lineHeight: 16 },
  statSub: { color: 'rgba(255,255,255,0.80)', fontSize: 11, fontWeight: '500' },
  statSubSkeleton: { width: '60%', height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 2 },

  // ── Requirements slider ─────────────────────────────────────────────────────
  sliderSection: { marginTop: 8, marginBottom: 10 },
  sliderHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12, paddingHorizontal: 0,
  },
  sliderTitle: { fontSize: 16, fontWeight: '800', lineHeight: 20 },
  sliderSub: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  viewAllBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  viewAllBtnText: { fontSize: 12, fontWeight: '700', color: '#1037A4' },
  viewAllBtnArrow: { fontSize: 14, fontWeight: '800', color: '#1037A4' },

  sliderContent: { paddingHorizontal: 0, paddingBottom: 4, gap: 12, flexDirection: 'row', alignItems: 'flex-start' },

  // Skeleton
  sliderSkeleton: { flexDirection: 'row', gap: 12 },
  sliderSkeletonCard: { width: CARD_W, height: 180, borderRadius: 20, opacity: 0.5 },

  // Empty
  sliderEmpty: { borderRadius: 20, padding: 28, alignItems: 'center', gap: 8 },
  sliderEmptyEmoji: { fontSize: 32, lineHeight: 38 },
  sliderEmptyTxt: { fontSize: 13, fontWeight: '500' },
  sliderEmptyLink: { fontSize: 13, fontWeight: '700', color: '#1037A4', marginTop: 4 },

  sectionGap: { marginTop: 1, marginBottom: 16 },

  // ── Activity card ───────────────────────────────────────────────────────────

  // ── Quick links ─────────────────────────────────────────────────────────────
  quickRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  quickBtn: { flex: 1, minHeight: 48, borderRadius: 14, padding: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  quickBtnText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },

  // ── WhatsApp banner ─────────────────────────────────────────────────────────
  waBanner: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: '#075E54',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#075E54',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  waGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#25D366',
    opacity: 0.18,
    top: -60,
    right: -40,
  },
  waLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  waIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  waIcon: { fontSize: 24, lineHeight: 28 },
  waTextBlock: { flex: 1, gap: 3 },
  waTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', lineHeight: 19 },
  waSub: { color: 'rgba(255,255,255,0.70)', fontSize: 11, fontWeight: '500', lineHeight: 15 },
  waArrowWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  waArrow: { color: '#FFFFFF', fontSize: 20, fontWeight: '300', lineHeight: 24 },
});

// ── Slider card styles ────────────────────────────────────────────────────────
const sliderCard = StyleSheet.create({
  wrap: {
    borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#DDE6F5',
    shadowColor: '#0B2D8F', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.13, shadowRadius: 18, elevation: 8,
  },

  // Compact coloured header
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, overflow: 'hidden', position: 'relative' },
  blob: { position: 'absolute', width: 100, height: 100, borderRadius: 50, top: -28, right: -18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  emojiWrap: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emojiTxt: { fontSize: 26, lineHeight: 32 },

  infoWrap: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '900', lineHeight: 20, letterSpacing: -0.2 },
  catLabel: { fontSize: 11, fontWeight: '600', lineHeight: 15 },

  salaryRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 },
  salaryTxt: { fontSize: 15, fontWeight: '900', lineHeight: 19, flexShrink: 1 },
  periodBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3, flexShrink: 0 },
  periodTxt: { fontSize: 11, fontWeight: '800' },

  iconCol: { gap: 7, alignItems: 'center', flexShrink: 0 },
  iconBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconTxt: { fontSize: 14, lineHeight: 18 },

  // Meta + perks single scrollable row
  metaWrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 4 },
  metaIcon: { fontSize: 12, lineHeight: 16 },
  metaTxt: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  metaDot: { fontSize: 12, lineHeight: 16 },
  perkTxt: { fontSize: 12, fontWeight: '700', lineHeight: 16 },

  // Apply button
  applyWrap: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth },
  applyBtn: {
    borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 6, elevation: 4,
  },
  applyTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.2 },

  // View all card
  viewAllWrap: { alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 185 },
  viewAllEmoji: { fontSize: 38, lineHeight: 44 },
  viewAllTitle: { fontSize: 17, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', lineHeight: 24 },
  viewAllArrow: { fontSize: 26, color: 'rgba(255,255,255,0.65)', fontWeight: '300' },
});

// ── Mini wage modal styles ────────────────────────────────────────────────────
const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  box: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 0 },
  banner: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, gap: 12, marginBottom: 16 },
  bannerEmoji: { fontSize: 30, lineHeight: 36 },
  bannerTitle: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  bannerSub: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelTxt: { fontSize: 14, fontWeight: '700' },
  submitBtn: { flex: 2, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  submitTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});

// ── Job Invitations banner ────────────────────────────────────────────────────
const invBanner = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#7C3AED', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 4, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
  left:    { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconWrap:{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title:   { fontSize: 14, fontWeight: '800', color: '#FFFFFF', lineHeight: 18 },
  sub:     { fontSize: 11, color: 'rgba(255,255,255,0.78)', marginTop: 2, fontWeight: '500' },
  cta:     { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  ctaTxt:  { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
});

const errBanner = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10 },
  icon:    { fontSize: 18 },
  textCol: { flex: 1, gap: 2 },
  msg:     { fontSize: 13, fontWeight: '800', color: '#991B1B' },
  reason:  { fontSize: 11, fontWeight: '500', color: '#B91C1C', lineHeight: 15 },
  cta:     { backgroundColor: '#DC2626', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  ctaTxt:  { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
});

// ── Activity section styles ───────────────────────────────────────────────────

