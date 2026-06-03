import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import { useAppTheme } from '../../../core/theme';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { RawRequirement } from '../../../core/api/endpoints/requirementsApi';
import { useAuth } from '../../../state/auth/AuthContext';
// Profile-completion nudge disabled for now — mandatory completion is enforced
// via the post-OTP WorkerProfileCompletionScreen instead.
// import { ProfileCompletionModal } from '../../../shared/components/ui/ProfileCompletionModal';
import { GuidedTour } from '../../../shared/components/ui/GuidedTour';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { SectionHeader } from '../../../shared/components/ui/SectionHeader';
import { GradientHeader } from '../../../shared/components/ui/GradientHeader';
import { QuickActionCard, QuickActionsRow } from '../../../shared/components/ui/QuickActionCard';
import { WorkerCategoryGrid } from '../../../shared/components/ui/WorkerCategoryGrid';
import type { WorkCategory } from '../../../shared/components/ui/WorkerCategoryGrid';
import { getJobTitle, getCategoryLabel, getLocationStr, isWorkerProfileComplete } from '../../../shared/utils/labelUtils';
import type { MainStackParamList } from '../../../app/navigation/types';
import { PromoBannerSlider } from '../../../shared/components/ui/PromoBannerSlider';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import i18n from '../../../core/i18n';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 40;

const RESUME_TYPES = ['ITI/Diploma', 'Graduate'];

// ── Work type visual config ───────────────────────────────────────────────────
interface WorkVisual { emoji: string; color: string; bg: string; accent: string }

const WORK_VISUALS: Record<string, WorkVisual> = {
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

const getGreetKey = (): 'goodMorning' | 'goodAfternoon' | 'goodEvening' => {
  const h = new Date().getHours();
  if (h < 12) return 'goodMorning';
  if (h < 17) return 'goodAfternoon';
  return 'goodEvening';
};

// ── Stat Widget ───────────────────────────────────────────────────────────────
interface StatWidgetProps {
  emoji: string;
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
      <AppText style={styles.statEmoji}>{emoji}</AppText>
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
          <View style={[sliderCard.emojiWrap, { backgroundColor: isDark ? theme.colors.surface : visual.accent + '25' }]}>
            <AppText style={sliderCard.emojiTxt}>{visual.emoji}</AppText>
          </View>
          <View style={sliderCard.infoWrap}>
            <AppText style={[sliderCard.title, { color: isDark ? theme.colors.text : visual.color }]} numberOfLines={1}>{jobTitle}</AppText>
            <AppText style={[sliderCard.catLabel, { color: isDark ? theme.colors.mutedText : visual.color + 'AA' }]} numberOfLines={1}>{catLabel}</AppText>
            <View style={sliderCard.salaryRow}>
              <AppText style={[sliderCard.salaryTxt, { color: visual.accent }]}>
                ₹{salaryMin.toLocaleString('en-IN')}–{salaryMax.toLocaleString('en-IN')}
              </AppText>
              <View style={[sliderCard.periodBadge, { backgroundColor: visual.accent + '18', borderColor: visual.accent + '40' }]}>
                <AppText style={[sliderCard.periodTxt, { color: visual.accent }]}>{t('salaryPer')} {salaryPeriod}</AppText>
              </View>
            </View>
          </View>
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

      {/* ── Meta: location + workers + perks (single scroll row) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[sliderCard.metaScroll, { borderTopColor: isDark ? theme.colors.border : '#EEF2F8' }]}
        contentContainerStyle={sliderCard.metaContent}
      >
        <AppText style={sliderCard.metaIcon}>📍</AppText>
        <AppText style={[sliderCard.metaTxt, { color: theme.colors.mutedText }]}>{location}</AppText>
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
      </ScrollView>

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

// ── Mini Wage Modal ───────────────────────────────────────────────────────────
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <TouchableOpacity style={modal.overlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity
            activeOpacity={1}
            style={[modal.box, { backgroundColor: theme.colors.surface, paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
          >
            <View style={[modal.banner, { backgroundColor: visual.bg }]}>
              <AppText style={modal.bannerEmoji}>{visual.emoji}</AppText>
              <View style={{ flex: 1 }}>
                <AppText style={[modal.bannerTitle, { color: visual.color }]} numberOfLines={1}>{jobTitle}</AppText>
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
export const WorkerDashboardScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state, updateProfile } = useAuth();
  const { t } = useTranslation();
  const user = state.session?.user;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const queryClient = useQueryClient();
  const [uploadingResume, setUploadingResume] = useState(false);
  const [interestedIds, setInterestedIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [wageModalReq, setWageModalReq] = useState<RawRequirement | null>(null);
  const sliderRef = useRef<ScrollView>(null);
  const autoScrollX = useRef(0);
  const scrollPaused = useRef(false);
  const liveCountRef = useRef(0);

  const isSelfWorker = (user?.role ?? '').toLowerCase() === 'selfworker';
  const userId = user?.id ?? '';

  // ── Queries ──────────────────────────────────────────────────────────────────
  const reqsQuery = useQuery({
    queryKey: ['worker-reqs-dash', userId],
    queryFn: () =>
      requirementsApi.listForRole({ role: 'selfworker', userId, page: 1, limit: 1 }),
    staleTime: 60 * 1000,
    enabled: !!userId,
  });

  const liveReqsQuery = useQuery({
    queryKey: ['worker-live-reqs-slider', userId],
    queryFn: () =>
      requirementsApi.listForRole({ role: 'selfworker', userId, page: 1, limit: 50 }),
    staleTime: 60 * 1000,
    enabled: !!userId,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const likeMutation = useMutation({
    mutationFn: (reqId: string) => requirementsApi.toggleLike(reqId),
    onMutate: (reqId) => {
      setLikedIds((prev) => {
        const next = new Set(prev);
        next.has(reqId) ? next.delete(reqId) : next.add(reqId);
        return next;
      });
    },
    onError: (_, reqId) => {
      setLikedIds((prev) => {
        const next = new Set(prev);
        next.has(reqId) ? next.delete(reqId) : next.add(reqId);
        return next;
      });
    },
  });

  const interestMutation = useMutation({
    mutationFn: ({ reqId, wage }: { reqId: string; wage: number }) =>
      requirementsApi.expressInterestWithWage(reqId, wage),
    onSuccess: (_, { reqId }) => {
      setInterestedIds((prev) => new Set([...prev, reqId]));
      setWageModalReq(null);
      void queryClient.invalidateQueries({ queryKey: ['worker-live-reqs-slider'] });
      showAlert(t('alertAppliedTitle'), t('alertAppliedMsg'));
    },
    onError: () => showAlert(t('alertError'), t('alertSubmitError')),
  });

  // Seed likedIds from server data
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

  useEffect(() => {
    liveCountRef.current = liveReqsQuery.data?.requirements?.length ?? 0;
  }, [liveReqsQuery.data]);

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

  const isInterested = (req: RawRequirement): boolean =>
    interestedIds.has(req._id) ||
    Boolean(req.intrestedAgents?.some((a) => a.agentId === userId));

  const handleLike = (id: string): void => { likeMutation.mutate(id); };

  const handleShare = async (req: RawRequirement): Promise<void> => {
    const { Share } = await import('react-native');
    const jobTitle = req.subCategory ? fmtLabel(req.subCategory) : fmtLabel(req.workType);
    const location = getLocationStr({ district: req.district, state: req.state }, i18n.language, '—');
    const salary = `₹${req.minBudgetPerWorker ?? 0}–${req.maxBudgetPerWorker ?? 0}`;
    try {
      await Share.share({
        message: `🔔 Job Available: ${jobTitle}\n📍 ${location}\n💰 ${salary}/${getSalaryType(req)}\n\nApply on BookMyWorker App`,
        title: `Job: ${jobTitle}`,
      });
    } catch { /* dismissed */ }
  };

  const isRefreshing = reqsQuery.isFetching || liveReqsQuery.isFetching;

  const handleRefresh = (): void => {
    void reqsQuery.refetch();
    void liveReqsQuery.refetch();
  };

  const showResumeSection = isSelfWorker && user?.workerSubType && RESUME_TYPES.includes(user.workerSubType);

  const handlePickResume = async (): Promise<void> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploadingResume(true);
      const resumeUrl = await workerApi.uploadResume(asset.uri, asset.name ?? 'resume.pdf');
      await updateProfile({ resumeUrl });
      showAlert(t('alertResumeUploadedTitle'), t('alertResumeUploadedMsg'));
    } catch {
      showAlert(t('alertUploadFailedTitle'), t('alertUploadFailedMsg'));
    } finally {
      setUploadingResume(false);
    }
  };

  const handleViewResume = (): void => {
    if (user?.resumeUrl) navigation.navigate('PdfViewer', { url: user.resumeUrl, title: 'My Resume' });
  };

  const handleCategoryPress = (cat: WorkCategory): void => {
    navigation.navigate('JobMarketplace', { workType: cat.value });
  };

  const kycPending = user?.kycStatus === 'pending';
  const greetKey = getGreetKey();

  const totalCount = reqsQuery.data?.pagination?.totalCount ?? 0;
  const myInterestsCount = reqsQuery.data?.myInterestsCount ?? 0;
  const liveReqs = liveReqsQuery.data?.requirements ?? [];

  const statWidgets: StatWidgetProps[] = [
    {
      emoji: '📋',
      label: t('allRequirements'),
      sub: reqsQuery.isLoading ? null : `${totalCount} ${t('openReqs')}`,
      gradient: ['#1E3A8A', '#2563EB'] as const,
      isLoading: reqsQuery.isLoading,
      onPress: () => navigation.navigate('JobMarketplace'),
    },
    {
      emoji: '❤️',
      label: t('myInterests'),
      sub: reqsQuery.isLoading ? null : `${myInterestsCount} ${t('applied')}`,
      gradient: ['#7C2D12', '#EA580C'] as const,
      isLoading: reqsQuery.isLoading,
      onPress: () => navigation.navigate('JobMarketplace', { myInterests: true }),
    },
    {
      emoji: '🔍',
      label: t('browseJobs'),
      sub: t('findWorkNearYou'),
      gradient: ['#064E3B', '#059669'] as const,
      onPress: () => navigation.navigate('JobMarketplace'),
    },
    {
      emoji: '👤',
      label: t('myProfile'),
      sub: t('viewAndEdit'),
      gradient: ['#4C1D95', '#7C3AED'] as const,
      onPress: () => navigation.navigate('Profile'),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />

      <GradientHeader
        subtitle={t(greetKey)}
        title={user?.fullName ?? t('workerRole')}
        caption={kycPending ? `⚠️ ${t('verificationPending')}` : `✓ ${t('verified')}`}
        avatarName={user?.fullName ?? 'W'}
        onAvatarPress={() => navigation.navigate('Profile')}
        rightIcon="🔔"
        onRightPress={() => navigation.navigate('Notifications')}
        style={{ paddingBottom: 14 }}
      />

      {/* ── Complete Profile Banner ── */}
      {!isWorkerProfileComplete(user ?? null) && (
        <TouchableOpacity
          onPress={() => navigation.navigate('WorkerProfileCompletion')}
          activeOpacity={0.85}
          style={{
            marginHorizontal: 14,
            marginTop: 12,
            borderRadius: 14,
            backgroundColor: '#FFF7ED',
            borderWidth: 1.5,
            borderColor: '#FED7AA',
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            paddingVertical: 12,
            gap: 10,
          }}
        >
          <AppText style={{ fontSize: 22 }}>📋</AppText>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontSize: 13.5, fontWeight: '800', color: '#C2410C' }}>
              {t('wpc_title', 'Complete Your Profile')}
            </AppText>
            <AppText style={{ fontSize: 12, color: '#9A3412', marginTop: 1 }}>
              {t('wpc_completeProfileBanner', 'Complete your profile to get better job matches')}
            </AppText>
          </View>
          <AppText style={{ fontSize: 18, color: '#C2410C', fontWeight: '700' }}>›</AppText>
        </TouchableOpacity>
      )}

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

          {/* KYC Alert */}
          {/* {kycPending && (
            <Pressable
              onPress={() => navigation.navigate('Kyc')}
              style={[styles.alertBanner, { backgroundColor: theme.colors.warningLight, borderColor: theme.colors.warning }]}
            >
              <AppText style={styles.alertIcon}>⚠️</AppText>
              <View style={styles.alertTextWrap}>
                <AppText variant="labelSm" color={theme.colors.warning}>{t('kycPendingTitle')}</AppText>
                <AppText variant="caption" color={theme.colors.mutedText} style={styles.alertSub}>
                  {t('kycPendingMsg')}
                </AppText>
              </View>
            </Pressable>
          )} */}

          {/* Resume Upload Banner (ITI/Diploma & Graduate only) */}
          {showResumeSection && (
            <View style={styles.resumeCard}>
              <View style={styles.resumeCardTop}>
                <View style={styles.resumeIconBox}>
                  <AppText style={styles.resumeEmoji}>📄</AppText>
                </View>
                <View style={styles.resumeTextCol}>
                  <AppText style={styles.resumeTitle}>
                    {user?.resumeUrl ? t('resumeUploaded') : t('uploadYourResume')}
                  </AppText>
                  <AppText style={styles.resumeSub}>
                    {user?.resumeUrl
                      ? t('resumeUploadedDesc')
                      : t('resumeUploadDesc', { subType: user?.workerSubType ?? '' })}
                  </AppText>
                </View>
              </View>
              <View style={styles.resumeActions}>
                <TouchableOpacity
                  style={[styles.resumeBtn, styles.resumeBtnPrimary, uploadingResume && styles.resumeBtnDisabled]}
                  onPress={() => void handlePickResume()}
                  disabled={uploadingResume}
                  activeOpacity={0.8}
                >
                  <AppText style={styles.resumeBtnTxtPrimary}>
                    {uploadingResume ? t('uploading') : user?.resumeUrl ? `🔄 ${t('replaceResume')}` : `⬆️ ${t('uploadResume')}`}
                  </AppText>
                </TouchableOpacity>
                {user?.resumeUrl && (
                  <TouchableOpacity
                    style={styles.resumeViewBtn}
                    onPress={handleViewResume}
                    activeOpacity={0.8}
                  >
                    <AppText style={styles.resumeViewIcon}>👁</AppText>
                    <AppText style={styles.resumeViewTxt}>{t('viewResume')}</AppText>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* ── 4 Stat Widgets (2×2 grid) ─────────────────────── */}
          <View style={styles.widgetGrid}>
            {statWidgets.map((w, i) => (
              <StatWidget key={i} {...w} />
            ))}
          </View>

          {/* ── Live Requirements Slider ───────────────────────── */}
          <View style={styles.sliderSection}>
            <View style={styles.sliderHeader}>
              <View>
                <AppText style={[styles.sliderTitle, { color: theme.colors.text }]}>{t('openJobsNearYou')}</AppText>
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
            actionLabel={t('seeAll')}
            onAction={() => navigation.navigate('JobMarketplace')}
            style={styles.sectionFirst}
          />
          <WorkerCategoryGrid
            horizontal
            onCategoryPress={handleCategoryPress}
          />

          {/* Quick Actions */}
          <SectionHeader title={t('quickActions')} style={styles.sectionGap} />
          <QuickActionsRow>
            <QuickActionCard
              icon="🔍"
              title={t('browseJobs')}
              subtitle={t('findNearYou')}
              color={theme.colors.primary}
              onPress={() => navigation.navigate('JobMarketplace')}
            />
            {isSelfWorker ? (
              <QuickActionCard
                icon="❤️"
                title={t('likedJobs')}
                subtitle={t('mySavedJobs')}
                color="#E11D48"
                onPress={() => navigation.navigate('JobMarketplace', { likedOnly: true })}
              />
            ) : (
              <QuickActionCard
                icon="📋"
                title={t('myApplicationsTab')}
                subtitle={t('browseJobs')}
                color={theme.colors.success}
                onPress={() => navigation.navigate('MyApplications')}
              />
            )}
          </QuickActionsRow>

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
            <View style={styles.waGlow} />
            <View style={styles.waLeft}>
              <View style={styles.waIconWrap}>
                <AppText style={styles.waIcon}>💬</AppText>
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
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },
  body: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, gap: 0 },

  // ── Alerts ───────────────────────────────────────────────────────────────────
  alertBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 12,
  },
  alertIcon: { fontSize: 18, lineHeight: 22 },
  alertTextWrap: { flex: 1, gap: 3 },
  alertSub: { lineHeight: 16 },

  // ── 2×2 stat widget grid ─────────────────────────────────────────────────────
  widgetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
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

  // ── Requirements slider ──────────────────────────────────────────────────────
  sliderSection: { marginTop: 14, marginBottom: 18 },
  sliderHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
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
  sliderContent: { paddingHorizontal: 0, paddingBottom: 4, gap: 12, flexDirection: 'row', alignItems: 'stretch' },
  sliderSkeleton: { flexDirection: 'row', gap: 12 },
  sliderSkeletonCard: { width: CARD_W, height: 180, borderRadius: 20, opacity: 0.5 },
  sliderEmpty: { borderRadius: 20, padding: 28, alignItems: 'center', gap: 8 },
  sliderEmptyEmoji: { fontSize: 32, lineHeight: 38 },
  sliderEmptyTxt: { fontSize: 13, fontWeight: '500' },
  sliderEmptyLink: { fontSize: 13, fontWeight: '700', color: '#1037A4', marginTop: 4 },

  sectionFirst: { marginTop: 4, marginBottom: 10 },
  sectionGap: { marginTop: 20 },

  // ── Quick links ──────────────────────────────────────────────────────────────
  quickRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  quickBtn: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'transparent', minHeight: 48 },
  quickBtnText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },

  // ── WhatsApp banner ─────────────────────────────────────────────────────────
  waBanner: {
    marginTop: 18, borderRadius: 20, backgroundColor: '#075E54',
    padding: 16, flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
    shadowColor: '#075E54', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  waGlow: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: '#25D366', opacity: 0.18, top: -60, right: -40,
  },
  waLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  waIconWrap: {
    width: 46, height: 46, borderRadius: 14, backgroundColor: '#25D366',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  waIcon: { fontSize: 24, lineHeight: 28 },
  waTextBlock: { flex: 1, gap: 3 },
  waTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', lineHeight: 19 },
  waSub: { color: 'rgba(255,255,255,0.70)', fontSize: 11, fontWeight: '500', lineHeight: 15 },
  waArrowWrap: {
    width: 28, height: 28, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  waArrow: { color: '#FFFFFF', fontSize: 20, fontWeight: '300', lineHeight: 24 },

  // ── Resume Upload Card ───────────────────────────────────────────────────────
  resumeCard: {
    borderRadius: 16, backgroundColor: '#fffbeb',
    borderWidth: 1, borderColor: '#fde68a',
    padding: 14, marginBottom: 12, gap: 12,
  },
  resumeCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  resumeIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#fde68a', flexShrink: 0,
  },
  resumeEmoji: { fontSize: 22 },
  resumeTextCol: { flex: 1, gap: 3 },
  resumeTitle: { fontSize: 14, fontWeight: '800', color: '#92400e', lineHeight: 18 },
  resumeSub: { fontSize: 12, color: '#a16207', lineHeight: 16 },
  resumeActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  resumeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  resumeBtnPrimary: { backgroundColor: '#d97706' },
  resumeBtnDisabled: { opacity: 0.55 },
  resumeBtnTxtPrimary: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  // View button — icon + text always side by side
  resumeViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#d97706',
    backgroundColor: 'transparent',
  },
  resumeViewIcon: { fontSize: 15, lineHeight: 19 },
  resumeViewTxt: { fontSize: 13, fontWeight: '700', color: '#d97706', lineHeight: 17 },
});

// ── Slider card styles ────────────────────────────────────────────────────────
const sliderCard = StyleSheet.create({
  wrap: {
    borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#DDE6F5',
    shadowColor: '#0B2D8F', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.13, shadowRadius: 18, elevation: 8,
  },
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
  periodBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3 },
  periodTxt: { fontSize: 11, fontWeight: '800' },
  iconCol: { gap: 7, alignItems: 'center', flexShrink: 0 },
  iconBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconTxt: { fontSize: 14, lineHeight: 18 },
  metaScroll: { borderTopWidth: StyleSheet.hairlineWidth },
  metaContent: { paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center' },
  metaIcon: { fontSize: 12, lineHeight: 16 },
  metaTxt: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  metaDot: { fontSize: 12, lineHeight: 16 },
  perkTxt: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  applyWrap: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth },
  applyBtn: {
    borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 6, elevation: 4,
  },
  applyTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.2 },
  viewAllWrap: { alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 185 },
  viewAllEmoji: { fontSize: 38, lineHeight: 44 },
  viewAllTitle: { fontSize: 17, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', lineHeight: 24 },
  viewAllArrow: { fontSize: 26, color: 'rgba(255,255,255,0.65)', fontWeight: '300' },
});

// ── Mini wage modal styles ────────────────────────────────────────────────────
const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  box: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 0, maxHeight: '85%' },
  banner: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, gap: 12, marginBottom: 16 },
  bannerEmoji: { fontSize: 30, lineHeight: 36 },
  bannerTitle: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  bannerSub: { fontSize: 11, fontWeight: '500', marginTop: 2, lineHeight: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', minHeight: 48 },
  cancelTxt: { fontSize: 14, fontWeight: '700' },
  submitBtn: { flex: 2, borderRadius: 12, paddingVertical: 13, alignItems: 'center', minHeight: 48 },
  submitTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
