import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../core/theme';
import { useAuth } from '../../../state/auth/AuthContext';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { RawRequirement } from '../../../core/api/endpoints/requirementsApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { showAlert } from '../../../shared/state/alert/AppAlertContext';
import { getJobTitle, getCategoryLabel, getLocationStr } from '../../../shared/utils/labelUtils';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'JobMarketplaceDetail'>;

// ── Locale helper ─────────────────────────────────────────────────────────────
const langToLocale = (lang: string): string => {
  const map: Record<string, string> = {
    hi: 'hi-IN', bn: 'bn-IN', te: 'te-IN', ta: 'ta-IN',
    ml: 'ml-IN', kn: 'kn-IN', gu: 'gu-IN', mr: 'mr-IN',
    or: 'or-IN', pa: 'pa-IN', en: 'en-IN',
  };
  return map[lang] ?? 'en-IN';
};

const fmtDate = (d?: string | null, lang = 'en'): string => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(langToLocale(lang), { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const fmtTime = (t?: string | null, lang = 'en'): string => {
  if (!t) return '—';
  if (!/^\d{4}-\d{2}-\d{2}T/.test(t)) return t;
  try { return new Date(t).toLocaleTimeString(langToLocale(lang), { hour: '2-digit', minute: '2-digit', hour12: true }); }
  catch { return t; }
};

const inferPeriod = (amount: number): string => {
  if (amount < 2000) return 'day';
  if (amount <= 4000) return 'week';
  return 'month';
};

// ── Work type visuals ─────────────────────────────────────────────────────────
interface WorkVisual { emoji: string; color: string; bg: string; gradFrom: string; gradTo: string }
const WORK_VISUALS: Record<string, WorkVisual> = {
  construction_project_workers:     { emoji: '🏗️', color: '#92400E', bg: '#FEF3C7', gradFrom: '#F59E0B', gradTo: '#D97706' },
  manufacturing_industrial_workers: { emoji: '⚙️', color: '#1D4ED8', bg: '#DBEAFE', gradFrom: '#3B82F6', gradTo: '#1D4ED8' },
  agriculture_farming_workers:      { emoji: '🌾', color: '#15803D', bg: '#DCFCE7', gradFrom: '#22C55E', gradTo: '#15803D' },
  event_decoration_workers:         { emoji: '🎊', color: '#7C3AED', bg: '#EDE9FE', gradFrom: '#8B5CF6', gradTo: '#7C3AED' },
  household_domestic_workers:       { emoji: '🧹', color: '#0E7490', bg: '#CFFAFE', gradFrom: '#06B6D4', gradTo: '#0E7490' },
  hospitality_service_workers:      { emoji: '🛎️', color: '#BE185D', bg: '#FCE7F3', gradFrom: '#EC4899', gradTo: '#BE185D' },
  transport_logistics_workers:      { emoji: '🚛', color: '#1E40AF', bg: '#DBEAFE', gradFrom: '#2563EB', gradTo: '#1E40AF' },
  retail_shop_workers:              { emoji: '🏪', color: '#92400E', bg: '#FEF3C7', gradFrom: '#F59E0B', gradTo: '#D97706' },
  skilled_technical_workers:        { emoji: '🛠️', color: '#065F46', bg: '#D1FAE5', gradFrom: '#10B981', gradTo: '#065F46' },
  specialized_creative_workers:     { emoji: '🎨', color: '#6D28D9', bg: '#EDE9FE', gradFrom: '#8B5CF6', gradTo: '#6D28D9' },
  'Hospitality & Service Workers':  { emoji: '🛎️', color: '#BE185D', bg: '#FCE7F3', gradFrom: '#EC4899', gradTo: '#BE185D' },
  'Construction & Project Workers': { emoji: '🏗️', color: '#92400E', bg: '#FEF3C7', gradFrom: '#F59E0B', gradTo: '#D97706' },
};
const DEFAULT_VISUAL: WorkVisual = { emoji: '👷', color: '#1037A4', bg: '#EBF1FF', gradFrom: '#1A56DB', gradTo: '#1037A4' };

const SUB_EMOJI: Array<{ pattern: RegExp; emoji: string }> = [
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
  { pattern: /loader|loading/i,                           emoji: '💪' },
  { pattern: /room service|housekeep|bellboy|steward/i,   emoji: '🛎️' },
  { pattern: /reception|front office/i,                   emoji: '🏨' },
];

const getVisual = (workType?: string | null, subCategory?: string | null): WorkVisual => {
  const base = (workType && WORK_VISUALS[workType]) ? WORK_VISUALS[workType] : DEFAULT_VISUAL;
  if (subCategory) {
    const rule = SUB_EMOJI.find(({ pattern }) => pattern.test(subCategory));
    if (rule) return { ...base, emoji: rule.emoji };
  }
  return base;
};

// ── Contact Modal ─────────────────────────────────────────────────────────────
const ContactModal = ({ visible, name, phone, loading, error, onClose }: {
  visible: boolean; name: string; phone: string; loading: boolean; error: string | null; onClose: () => void;
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const isDark = theme.mode === 'dark';
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={S.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[S.sheet, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
          <View style={S.sheetHandle} />
          <View style={{ alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 }}>
            <View style={S.phoneIconWrap}>
              <AppText style={{ fontSize: 36 }}>📞</AppText>
            </View>
            <AppText style={[S.sheetName, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>{name || t('detailEmployer')}</AppText>
            <AppText style={[S.sheetSub, { color: isDark ? '#64748B' : '#94A3B8' }]}>{t('employerContact')}</AppText>
            <View style={[S.phoneBox, {
              backgroundColor: loading ? (isDark ? '#1E293B' : '#F8FAFC') : phone ? (isDark ? 'rgba(16,55,164,0.15)' : '#EBF1FF') : (isDark ? 'rgba(220,38,38,0.1)' : '#FEF2F2'),
              borderColor: loading ? (isDark ? '#334155' : '#E2E8F0') : phone ? '#1037A440' : '#FECACA',
            }]}>
              {loading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator size="small" color="#1037A4" />
                  <AppText style={{ fontSize: 14, color: '#1037A4', fontWeight: '600' }}>{t('fetchingContact')}</AppText>
                </View>
              ) : error ? (
                <AppText style={{ fontSize: 13, color: '#DC2626', fontWeight: '600', textAlign: 'center' }}>{error}</AppText>
              ) : phone ? (
                <View style={{ alignItems: 'center', gap: 6 }}>
                  <AppText style={{ fontSize: 11, fontWeight: '700', color: '#1037A4', letterSpacing: 1, textTransform: 'uppercase' }}>{t('mobileNumber')}</AppText>
                  <AppText style={{ fontSize: 28, fontWeight: '900', color: '#1037A4', letterSpacing: 3 }}>{phone}</AppText>
                </View>
              ) : (
                <AppText style={{ fontSize: 13, color: '#DC2626', fontWeight: '600' }}>{t('phoneUnavailable')}</AppText>
              )}
            </View>
          </View>
          <View style={[S.sheetActions, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <AppButton title={t('cancel')} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <AppButton title={`📞 ${t('callNow')}`}
              onPress={() => { if (phone) void Linking.openURL(`tel:${phone}`); onClose(); }}
              style={{ flex: 1 }} disabled={!phone || loading} />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

// ── Wage Modal ────────────────────────────────────────────────────────────────
const WageModal = ({ visible, req, onClose, onSubmit, loading }: {
  visible: boolean; req: RawRequirement | null; onClose: () => void;
  onSubmit: (id: string, wage: number) => void; loading: boolean;
}) => {
  const { theme } = useAppTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [wage, setWage] = useState('');
  const visual = getVisual(req?.workType, req?.subCategory);
  React.useEffect(() => { if (visible) setWage(''); }, [visible]);
  const minWage = req?.minBudgetPerWorker ?? 0;
  const period = inferPeriod(minWage);
  const periodLabel = t(`salaryPeriod_${period}` as 'salaryPeriod_day' | 'salaryPeriod_month' | 'salaryPeriod_week');
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}>
        <TouchableOpacity style={S.overlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={[S.sheet, { backgroundColor: theme.colors.surface }]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}>
              <View style={S.sheetHandle} />
              <View style={[S.wageBanner, { backgroundColor: visual.bg }]}>
                <AppText style={{ fontSize: 32 }}>{visual.emoji}</AppText>
                <View style={{ flex: 1 }}>
                  <AppText style={[S.wageBannerTitle, { color: visual.color }]} numberOfLines={1}>
                    {getJobTitle(req?.workType, req?.subCategory, i18n.language, t)}
                  </AppText>
                  <AppText style={{ fontSize: 12, color: visual.color + 'AA' }}>{req?.district} · ₹{minWage}+/{period}</AppText>
                </View>
              </View>
              <View style={{ paddingHorizontal: 20 }}>
                <AppText style={[S.wageLabel, { color: theme.colors.mutedText }]}>
                  {t('wageFieldLabel', { period: periodLabel, minWage })}
                </AppText>
                <TextInput
                  value={wage} onChangeText={setWage} keyboardType="numeric"
                  placeholder={t('wageInputPlaceholder', { minWage })}
                  placeholderTextColor={theme.colors.mutedText}
                  style={[S.wageInput, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]}
                />
                <View style={S.sheetActions}>
                  <AppButton title={t('cancel')} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
                  <AppButton title={t('submitApplication')} loading={loading} style={{ flex: 1 }}
                    onPress={() => {
                      const n = Number(wage);
                      if (!n || n < minWage) { showAlert(t('alertInvalidWage'), t('alertMinWageMsg', { minWage })); return; }
                      if (req?._id) onSubmit(req._id, n);
                    }} />
                </View>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export const JobMarketplaceDetailScreen = ({ route, navigation }: Props): React.JSX.Element => {
  const { requirementId } = route.params;
  const { theme } = useAppTheme();
  const { t, i18n } = useTranslation();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isDark = theme.mode === 'dark';

  const user = authState.session?.user;
  const role = user?.role ?? 'worker';
  const isAgent       = role === 'agent' || role === 'selfworker' || role === 'worker';
  const isVerifiedAgent = !!(user?.veryfiedBage);
  const isSelfWorker  = role === 'selfworker';

  const [isLiked, setIsLiked]       = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [wageModalOpen, setWageModalOpen]   = useState(false);
  const [contactInfo, setContactInfo] = useState<{ name: string; phone: string; loading: boolean; error: string | null } | null>(null);

  const { data: req, isLoading, isError, refetch } = useQuery({
    queryKey: ['requirement', requirementId],
    queryFn: () => requirementsApi.getById(requirementId),
    staleTime: 60_000,
  });

  React.useEffect(() => {
    if (req && user?.id) {
      setIsLiked(req.likedBy?.includes(user.id) ?? false);
      setAlreadyApplied(req.intrestedAgents?.some((a) => a.agentId === user.id) ?? false);
    }
  }, [req, user?.id]);

  const likeMutation = useMutation({
    mutationFn: () => requirementsApi.toggleLike(requirementId),
    onMutate: () => setIsLiked((v) => !v),
    onError:  () => setIsLiked((v) => !v),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['requirements-role'] }),
  });

  const interestMutation = useMutation({
    mutationFn: ({ reqId, wage }: { reqId: string; wage: number }) =>
      requirementsApi.expressInterestWithWage(reqId, wage),
    onSuccess: () => { setAlreadyApplied(true); setWageModalOpen(false); showAlert('🎉', 'Application submitted successfully.'); },
    onError:   () => showAlert(t('alertError'), 'Could not submit. Please try again.'),
  });

  const revealMutation = useMutation({
    mutationFn: () => requirementsApi.revealEmployerPhone(requirementId),
    onSuccess: ({ phone, name }) => setContactInfo({ phone: phone ?? '', name, loading: false, error: null }),
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setContactInfo((p) => p ? { ...p, loading: false, error: e?.response?.data?.message ?? e?.message ?? 'Failed.' } : null);
    },
  });

  const handleLike    = useCallback(() => likeMutation.mutate(), [likeMutation]);
  const handleCallPress = useCallback(() => {
    if (!isSelfWorker && isAgent && !isVerifiedAgent) {
      showAlert(t('verifiedBadgeRequired'), t('verifiedAgentCallMsg'), [{ text: 'OK' }]);
      return;
    }
    setContactInfo({ phone: '', name: req?.employerName ?? '', loading: true, error: null });
    revealMutation.mutate();
  }, [isSelfWorker, isAgent, isVerifiedAgent, req, revealMutation, t]);

  const APP_STORE_URL = 'https://play.google.com/store/apps/details?id=com.app.myworker';

  const handleShare = useCallback(async () => {
    if (!req) return;
    const jobTitle = getJobTitle(req.workType, req.subCategory, i18n.language, t);
    const loc = getLocationStr({ tehsil: req.tehsil, district: req.district, state: req.state }, i18n.language, t('panIndia'));
    const period = inferPeriod(req.minBudgetPerWorker ?? 0);
    const workers = (req.workerQuantitySkilled ?? 0) + (req.workerQuantityUnskilled ?? 0);
    const msg = [
      `🔔 Job Available: ${jobTitle}`,
      `📍 ${loc}`,
      `💰 ₹${req.minBudgetPerWorker ?? 0}–${req.maxBudgetPerWorker ?? 0} per ${period}`,
      workers > 0 ? `👷 ${workers} workers needed` : null,
      req.workerNeedDate ? `📅 Start: ${fmtDate(req.workerNeedDate, i18n.language)}` : null,
      '',
      '📲 Download BookMyWorker App & Apply Now:',
      APP_STORE_URL,
    ].filter(Boolean).join('\n');
    // url param ensures iOS share sheet shows it as a tappable link
    try { await Share.share({ message: msg, url: APP_STORE_URL, title: `Job: ${jobTitle}` }); }
    catch { /* dismissed */ }
  }, [req, i18n.language, t]);

  if (isLoading) return <LoadingState message={t('loading')} />;
  if (isError || !req) return <ErrorState title={t('alertError')} message={t('fetchJobsError')} onRetry={() => void refetch()} />;

  const visual        = getVisual(req.workType, req.subCategory);
  const jobTitle      = getJobTitle(req.workType, req.subCategory, i18n.language, t);
  const categoryLabel = getCategoryLabel(req.workType, t);
  const locationStr   = getLocationStr({ tehsil: req.tehsil, district: req.district, state: req.state }, i18n.language, t('panIndia'));
  const period        = inferPeriod(req.minBudgetPerWorker ?? 0);
  const periodLabel   = t(`salaryPeriod_${period}` as 'salaryPeriod_day' | 'salaryPeriod_month' | 'salaryPeriod_week');
  const skilledCount   = req.workerQuantitySkilled   ?? 0;
  const unskilledCount = req.workerQuantityUnskilled ?? 0;
  const totalWorkers   = skilledCount + unskilledCount;

  type Perk = { icon: string; label: string; bg: string; border: string; color: string };
  const PERKS: Perk[] = [
    { show: !!req.accommodationAvailable, icon: '🏠', label: t('perkStay'),      bg: '#F0FDF4', border: '#86EFAC', color: '#15803D' },
    { show: !!req.foodAvailable,          icon: '🍱', label: t('perkFood'),      bg: '#FFF7ED', border: '#FDB57A', color: '#C2410C' },
    { show: !!req.transportProvided,      icon: '🚌', label: t('perkTransport'), bg: '#EFF6FF', border: '#93C5FD', color: '#1D4ED8' },
    { show: !!req.bonus,                  icon: '🎁', label: t('perkBonus'),     bg: '#FDF4FF', border: '#D8B4FE', color: '#7C3AED' },
    { show: !!req.incentive,              icon: '🌟', label: t('perkIncentive'), bg: '#FFFBEB', border: '#FDE68A', color: '#92400E' },
    { show: !!req.weeklyOff,              icon: '📅', label: t('perkWeeklyOff'), bg: '#F0FDF4', border: '#86EFAC', color: '#15803D' },
    { show: !!req.overtimeAvailable,      icon: '⏱',  label: t('perkOvertime'),  bg: '#FFF7ED', border: '#FDB57A', color: '#C2410C' },
    { show: !!req.insuranceAvailable,     icon: '🛡',  label: t('perkInsurance'), bg: '#EFF6FF', border: '#93C5FD', color: '#1D4ED8' },
    { show: !!req.pfAvailable,            icon: '🏦', label: t('perkPf'),        bg: '#F5F3FF', border: '#C4B5FD', color: '#7C3AED' },
    { show: !!req.esicAvailable,          icon: '🏥', label: t('perkEsic'),      bg: '#ECFEFF', border: '#67E8F9', color: '#0E7490' },
  ].filter((p): p is Perk & { show: true } => p.show);

  const bg     = isDark ? theme.colors.background : '#F0F4F8';
  const cardBg = isDark ? theme.colors.card       : '#FFFFFF';
  const border = isDark ? theme.colors.border     : '#E2E8F0';

  // Info rows
  type InfoRow = { icon: string; label: string; value: string };
  const INFO: InfoRow[] = [
    req.employerName   ? { icon: '🏢', label: t('detailEmployer'),     value: req.employerName } : null,
    { icon: '📍', label: t('locationLabel'), value: locationStr },
    req.workerNeedDate ? { icon: '📅', label: t('detailStartDate'),    value: fmtDate(req.workerNeedDate, i18n.language) } : null,
    (req.inTime && req.outTime) ? { icon: '⏰', label: t('detailTiming'), value: `${fmtTime(req.inTime, i18n.language)} – ${fmtTime(req.outTime, i18n.language)}` } : null,
    req.workLocation   ? { icon: '🗺️', label: t('detailWorkLocation'), value: req.workLocation } : null,
    req.ERN_NUMBER     ? { icon: '🔖', label: t('detailErn'),          value: req.ERN_NUMBER }   : null,
    req.remarks        ? { icon: '📝', label: t('detailRemarks'),      value: req.remarks }      : null,
  ].filter((r): r is InfoRow => r !== null);

  return (
    <View style={[S.root, { backgroundColor: bg }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Hero Header ──────────────────────────────────────────────────────── */}
      <View style={[S.heroGrad, { paddingTop: insets.top + 8, backgroundColor: visual.gradFrom }]}>
        {/* Nav row */}
        <View style={S.navRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={S.navBtn} hitSlop={10}>
            <AppText style={S.navIcon}>←</AppText>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={handleLike} style={[S.navBtn, { backgroundColor: isLiked ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)' }]} hitSlop={8}>
            <AppText style={{ fontSize: 18, lineHeight: 22 }}>{isLiked ? '❤️' : '🤍'}</AppText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { void handleShare(); }} style={[S.navBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]} hitSlop={8}>
            <Ionicons name="share-social" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Emoji + Title */}
        <View style={S.heroContent}>
          <View style={S.heroEmojiWrap}>
            <AppText style={S.heroEmoji}>{visual.emoji}</AppText>
          </View>
          <AppText style={S.heroTitle}>{jobTitle}</AppText>
          <View style={S.heroCategoryChip}>
            <AppText style={S.heroCategoryText}>{categoryLabel}</AppText>
          </View>
          <View style={S.heroMeta}>
            <AppText style={S.heroMetaText}>📍 {locationStr}</AppText>
          </View>
        </View>

        {/* Salary strip */}
        <View style={S.salaryStrip}>
          <View style={S.salaryLeft}>
            <AppText style={S.salaryAmount}>₹{req.minBudgetPerWorker ?? 0}–{req.maxBudgetPerWorker ?? 0}</AppText>
            <AppText style={S.salaryPer}>{t('salaryPer')} {periodLabel}</AppText>
          </View>
          {totalWorkers > 0 && (
            <View style={S.workerBadge}>
              <AppText style={S.workerBadgeText}>👷 {t('workerNeeded', { count: totalWorkers })}</AppText>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[S.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Worker breakdown ──────────────────────────────────────────────── */}
        {(skilledCount > 0 || unskilledCount > 0) && (
          <View style={[S.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={S.workerRow}>
              {skilledCount > 0 && (
                <View style={[S.workerTile, { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' }]}>
                  <AppText style={S.workerTileNum}>{skilledCount}</AppText>
                  <AppText style={[S.workerTileLabel, { color: '#059669' }]}>{t('reqDetailSkilledCount')}</AppText>
                </View>
              )}
              {unskilledCount > 0 && (
                <View style={[S.workerTile, { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' }]}>
                  <AppText style={S.workerTileNum}>{unskilledCount}</AppText>
                  <AppText style={[S.workerTileLabel, { color: '#2563EB' }]}>{t('reqDetailUnskilledCount')}</AppText>
                </View>
              )}
              <View style={[S.workerTile, { backgroundColor: isDark ? theme.colors.surface : '#F8FAFC', borderColor: border }]}>
                <AppText style={[S.workerTileNum, { color: visual.color }]}>{fmtDate(req.createdAt, i18n.language)}</AppText>
                <AppText style={[S.workerTileLabel, { color: isDark ? '#64748B' : '#94A3B8' }]}>{t('reqDetailPostedOn')}</AppText>
              </View>
            </View>
          </View>
        )}

        {/* ── Job Info ──────────────────────────────────────────────────────── */}
        <View style={[S.card, { backgroundColor: cardBg, borderColor: border }]}>
          <AppText style={[S.cardTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            {t('reqDetailJobInfo').toUpperCase()}
          </AppText>
          {INFO.map((row, i) => (
            <View key={i} style={[S.infoRow, { borderBottomColor: border, borderBottomWidth: i < INFO.length - 1 ? StyleSheet.hairlineWidth : 0 }]}>
              <AppText style={S.infoIcon}>{row.icon}</AppText>
              <View style={{ flex: 1 }}>
                <AppText style={[S.infoLabel, { color: isDark ? '#64748B' : '#94A3B8' }]}>{row.label}</AppText>
                <AppText style={[S.infoValue, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>{row.value}</AppText>
              </View>
            </View>
          ))}
        </View>

        {/* ── Perks ─────────────────────────────────────────────────────────── */}
        {PERKS.length > 0 && (
          <View style={[S.card, { backgroundColor: cardBg, borderColor: border }]}>
            <AppText style={[S.cardTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              {t('reqDetailPerks').toUpperCase()}
            </AppText>
            <View style={S.perksGrid}>
              {PERKS.map((p, i) => (
                <View key={i} style={[S.perkItem, { backgroundColor: p.bg, borderColor: p.border }]}>
                  <AppText style={S.perkEmoji}>{p.icon}</AppText>
                  <AppText style={[S.perkLabel, { color: p.color }]} numberOfLines={1}>{p.label}</AppText>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Bottom CTA ───────────────────────────────────────────────────────── */}
      <View style={[S.bottomBar, {
        backgroundColor: isDark ? theme.colors.surface : '#FFFFFF',
        borderTopColor: border,
        paddingBottom: Math.max(insets.bottom, 16),
      }]}>
        <TouchableOpacity
          onPress={() => { void handleShare(); }}
          style={[S.shareChip, { backgroundColor: isDark ? theme.colors.card : '#F1F5F9', borderColor: border }]}
          activeOpacity={0.75}
        >
          <Ionicons name="share-social" size={18} color={visual.color} />
          <AppText style={[S.shareChipText, { color: visual.color }]}>{t('shareWithFriends')}</AppText>
        </TouchableOpacity>

        {req.employerSubscribed && (
          <TouchableOpacity
            onPress={handleCallPress}
            style={[S.contactChip, { backgroundColor: visual.bg, borderColor: visual.color + '44' }]}
            activeOpacity={0.75}
          >
            <AppText style={{ fontSize: 16 }}>👁️</AppText>
            <AppText style={[S.contactChipText, { color: visual.color }]}>{t('viewContact')}</AppText>
          </TouchableOpacity>
        )}

        {isAgent && (
          <TouchableOpacity
            onPress={() => { if (!alreadyApplied) setWageModalOpen(true); }}
            activeOpacity={alreadyApplied ? 1 : 0.85}
            style={[S.applyGrad, { flex: 1, backgroundColor: alreadyApplied ? '#10B981' : visual.gradFrom }]}
          >
            <AppText style={S.applyText}>
              {alreadyApplied ? `✓ ${t('appliedCheck')}` : `${t('apply')} →`}
            </AppText>
          </TouchableOpacity>
        )}
      </View>

      <WageModal visible={wageModalOpen} req={req} onClose={() => setWageModalOpen(false)}
        onSubmit={(id, wage) => interestMutation.mutate({ reqId: id, wage })}
        loading={interestMutation.isPending} />
      <ContactModal visible={!!contactInfo} name={contactInfo?.name ?? ''} phone={contactInfo?.phone ?? ''}
        loading={contactInfo?.loading ?? false} error={contactInfo?.error ?? null} onClose={() => setContactInfo(null)} />
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1 },

  // Hero
  heroGrad: { paddingHorizontal: 16, paddingBottom: 20 },
  navRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 8 },
  navBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  navIcon: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  heroContent: { alignItems: 'center', paddingHorizontal: 8, marginBottom: 20 },
  heroEmojiWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)' },
  heroEmoji: { fontSize: 42, lineHeight: 50 },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', lineHeight: 28, marginBottom: 10, letterSpacing: -0.3 },
  heroCategoryChip: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', marginBottom: 12 },
  heroCategoryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroMetaText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500', textAlign: 'center' },

  // Salary strip (inside hero)
  salaryStrip: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  salaryLeft: { gap: 2 },
  salaryAmount: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  salaryPer: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  workerBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  workerBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Cards
  scroll: { padding: 12, gap: 10 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cardTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 14 },

  // Worker breakdown tiles
  workerRow: { flexDirection: 'row', gap: 10 },
  workerTile: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center', gap: 3 },
  workerTileNum: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  workerTileLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },

  // Info rows
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  infoIcon: { fontSize: 20, width: 28, textAlign: 'center', marginTop: 2 },
  infoLabel: { fontSize: 11.5, fontWeight: '600', marginBottom: 3 },
  infoValue: { fontSize: 14.5, fontWeight: '700', lineHeight: 20 },

  // Perks
  perksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  perkItem: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  perkEmoji: { fontSize: 15, lineHeight: 20 },
  perkLabel: { fontSize: 12.5, fontWeight: '700' },

  // Bottom bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  shareChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11 },
  shareChipText: { fontSize: 12.5, fontWeight: '700' },
  contactChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11 },
  contactChipText: { fontSize: 13, fontWeight: '700' },
  applyGrad: { borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },

  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, paddingHorizontal: 0 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 20 },
  sheetName: { fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 4 },
  sheetSub: { fontSize: 12.5, marginBottom: 18 },
  phoneIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  phoneBox: { borderRadius: 16, paddingVertical: 20, paddingHorizontal: 24, marginBottom: 20, borderWidth: 1.5, width: '100%', alignItems: 'center', minHeight: 72, justifyContent: 'center' },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  wageBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, gap: 12, marginHorizontal: 20, marginBottom: 16 },
  wageBannerTitle: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  wageLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  wageInput: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16 },
});
