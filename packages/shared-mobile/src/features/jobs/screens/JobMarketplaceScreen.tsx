import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlert } from '../../../shared/state/alert/AppAlertContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../core/theme';
import { useAuth } from '../../../state/auth/AuthContext';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { RawRequirement } from '../../../core/api/endpoints/requirementsApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import type { MainStackParamList } from '../../../app/navigation/types';
import categoriesData from '../../../shared/data/categories.json';
import { getJobTitle, getCategoryLabel, getLocationStr, getSubCatLabel } from '../../../shared/utils/labelUtils';

type RouteProps = RouteProp<MainStackParamList, 'JobMarketplace'>;

interface CategoryEntry {
  label: string;
  value: string;
  subcategories: Array<{ label: string; value: string }>;
}

const CATEGORIES = (categoriesData as CategoryEntry[]);

// ── Work type visual mapping ──────────────────────────────────────────────────
interface WorkVisual { emoji: string; color: string; bg: string }

const WORK_TYPE_VISUALS: Record<string, WorkVisual> = {
  // snake_case values (from categories.json)
  construction_project_workers:     { emoji: '🏗️', color: '#92400E', bg: '#FEF3C7' },
  manufacturing_industrial_workers: { emoji: '⚙️', color: '#1D4ED8', bg: '#DBEAFE' },
  agriculture_farming_workers:      { emoji: '🌾', color: '#15803D', bg: '#DCFCE7' },
  event_decoration_workers:         { emoji: '🎊', color: '#7C3AED', bg: '#EDE9FE' },
  household_domestic_workers:       { emoji: '🧹', color: '#0E7490', bg: '#CFFAFE' },
  hospitality_service_workers:      { emoji: '🛎️', color: '#BE185D', bg: '#FCE7F3' },
  transport_logistics_workers:      { emoji: '🚛', color: '#1E40AF', bg: '#DBEAFE' },
  retail_shop_workers:              { emoji: '🏪', color: '#92400E', bg: '#FEF3C7' },
  skilled_technical_workers:        { emoji: '🛠️', color: '#065F46', bg: '#D1FAE5' },
  specialized_creative_workers:     { emoji: '🎨', color: '#6D28D9', bg: '#EDE9FE' },
  'Automobile & Workshop Workers':  { emoji: '🚗', color: '#374151', bg: '#F3F4F6' },
  'Healthcare Support Workers':     { emoji: '🏥', color: '#DC2626', bg: '#FEE2E2' },
  'Security & Facility Workers':    { emoji: '👮', color: '#1F2937', bg: '#F1F5F9' },
  // Label-string aliases (for legacy DB records that stored display labels)
  'Construction & Project Workers':     { emoji: '🏗️', color: '#92400E', bg: '#FEF3C7' },
  'Manufacturing & Industrial Workers': { emoji: '⚙️', color: '#1D4ED8', bg: '#DBEAFE' },
  'Agriculture & Farming Workers':      { emoji: '🌾', color: '#15803D', bg: '#DCFCE7' },
  'Event & Decoration Workers':         { emoji: '🎊', color: '#7C3AED', bg: '#EDE9FE' },
  'Household & Domestic Workers':       { emoji: '🧹', color: '#0E7490', bg: '#CFFAFE' },
  'Hospitality & Service Workers':      { emoji: '🛎️', color: '#BE185D', bg: '#FCE7F3' },
  'Transport & Logistics Workers':      { emoji: '🚛', color: '#1E40AF', bg: '#DBEAFE' },
  'Retail & Shop Workers':              { emoji: '🏪', color: '#92400E', bg: '#FEF3C7' },
  'Retail & Service Workers':           { emoji: '🏪', color: '#92400E', bg: '#FEF3C7' },
  'Skilled Technical Workers':          { emoji: '🛠️', color: '#065F46', bg: '#D1FAE5' },
  'Specialized & Creative Workers':     { emoji: '🎨', color: '#6D28D9', bg: '#EDE9FE' },
  'Security & Facility Worker':         { emoji: '👮', color: '#1F2937', bg: '#F1F5F9' },
};
const DEFAULT_VISUAL: WorkVisual = { emoji: '👷', color: '#1037A4', bg: '#EBF1FF' };

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
  const base = (workType && WORK_TYPE_VISUALS[workType]) ? WORK_TYPE_VISUALS[workType] : DEFAULT_VISUAL;
  if (subCategory) {
    const rule = SUB_EMOJI_RULES.find(({ pattern }) => pattern.test(subCategory));
    if (rule) return { ...base, emoji: rule.emoji };
  }
  return base;
};

const inferPeriod = (amount: number): string => {
  if (amount < 2000) return 'day';
  if (amount <= 4000) return 'week';
  return 'month';
};

const getSalaryType = (req: RawRequirement): string =>
  inferPeriod(req.minBudgetPerWorker ?? 0);

const fmtDate = (d?: string): string => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const fmtTime = (t?: string | null): string => {
  if (!t) return '—';
  // Already a plain time string like "10:00 AM" — return as-is
  if (!/^\d{4}-\d{2}-\d{2}T/.test(t)) return t;
  try {
    return new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return t; }
};

const fmtLabel = (s?: string | null): string => {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const totalWorkers = (r: RawRequirement): number =>
  (r.workerQuantitySkilled ?? 0) + (r.workerQuantityUnskilled ?? 0);

// ── Requirement card ──────────────────────────────────────────────────────────
interface ReqCardProps {
  req: RawRequirement;
  isAgent: boolean;
  isVerifiedAgent: boolean;
  isSelfWorker: boolean;
  alreadyInterested: boolean;
  isLiked: boolean;
  onInterest: (req: RawRequirement) => void;
  onLike: (id: string) => void;
  onCallPress: (reqId: string, employerName: string) => void;
}

const ReqCard = React.memo(({ req, isAgent, isVerifiedAgent, isSelfWorker, alreadyInterested, isLiked, onInterest, onLike, onCallPress }: ReqCardProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();
  const visual = getVisual(req.workType, req.subCategory);
  const isDark = theme.mode === 'dark';
  const boosted = !!(req.isBoosted && req.boostedUntil && new Date(req.boostedUntil).getTime() > Date.now());

  const locationStr = getLocationStr(
    { tehsil: req.tehsil, district: req.district, state: req.state },
    i18n.language,
    t('panIndia'),
  );
  const workers = totalWorkers(req);
  const salaryText = `₹${req.minBudgetPerWorker ?? 0}–${req.maxBudgetPerWorker ?? 0}`;
  const salaryType = getSalaryType(req);
  const salaryPeriod = t(`salaryPeriod_${salaryType}` as 'salaryPeriod_day' | 'salaryPeriod_month' | 'salaryPeriod_week');
  const jobTitle = getJobTitle(req.workType, req.subCategory, i18n.language, t);
  const categoryLabel = getCategoryLabel(req.workType, t, req.subCategory);

  const APP_STORE_URL = 'https://play.google.com/store/apps/details?id=com.app.myworker';

  const handleShare = async (): Promise<void> => {
    try {
      const msg = [
        `🔔 Job Available: ${jobTitle}`,
        `📍 ${locationStr}`,
        `💰 ${salaryText} per ${salaryType}`,
        workers > 0 ? `👷 ${workers} workers needed` : null,
        req.workerNeedDate ? `📅 Start: ${fmtDate(req.workerNeedDate)}` : null,
        '',
        '📲 Download BookMyWorker App & Apply Now:',
        APP_STORE_URL,
      ].filter((l) => l !== null).join('\n');
      // Pass url separately so iOS share sheet shows it as a clickable link
      await Share.share({ message: msg, url: APP_STORE_URL, title: `Job: ${jobTitle}` });
    } catch { /* user dismissed */ }
  };

  const cardBg = isDark ? theme.colors.card : '#FFFFFF';
  const borderCol = boosted ? (isDark ? 'rgba(236,72,153,0.55)' : '#F9A8D4') : (isDark ? theme.colors.border : '#E8EEF6');

  const handleCardPress = (): void => {
    navigation.navigate('JobMarketplaceDetail', { requirementId: req._id });
  };

  return (
    <TouchableOpacity
      onPress={handleCardPress}
      activeOpacity={0.97}
      style={[styles.reqCard, { backgroundColor: cardBg, borderColor: borderCol }, boosted && { borderWidth: 1.5 }]}
    >

      {/* ── Boosted ribbon ───────────────────────────────────── */}
      {boosted && (
        <View style={{
          alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4,
          backgroundColor: isDark ? 'rgba(236,72,153,0.18)' : '#FDF2F8',
          borderWidth: 1, borderColor: isDark ? 'rgba(236,72,153,0.35)' : '#FBCFE8',
          borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
        }}>
          <Ionicons name="rocket" size={11} color={isDark ? '#F9A8D4' : '#BE185D'} />
          <AppText style={{ fontSize: 10.5, fontWeight: '800', color: isDark ? '#F9A8D4' : '#BE185D', letterSpacing: 0.3 }}>
            {t('req_boostedBadge')}
          </AppText>
        </View>
      )}

      {/* ── Top: logo + title + like ─────────────────────────── */}
      <View style={styles.cardTop}>
        <View style={[styles.logoBox, { backgroundColor: isDark ? theme.colors.surface : visual.bg }]}>
          <AppText style={styles.logoEmoji}>{visual.emoji}</AppText>
        </View>

        <View style={styles.titleBlock}>
          <AppText
            style={[styles.cardTitle, { color: theme.colors.text }]}
            numberOfLines={2}
          >
            {jobTitle}
          </AppText>
          <AppText style={[styles.cardCategory, { color: theme.colors.mutedText }]} numberOfLines={2}>
            {categoryLabel}
          </AppText>
        </View>

        <TouchableOpacity
          onPress={() => onLike(req._id)}
          activeOpacity={0.75}
          style={[styles.likeBtn, { backgroundColor: isLiked ? '#FEE2E2' : (isDark ? theme.colors.surface : '#F8FAFC') }]}
        >
          <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={18} color={isLiked ? '#EF4444' : (isDark ? theme.colors.mutedText : '#94A3B8')} />
        </TouchableOpacity>
      </View>

      {/* ── Location row ─────────────────────────────────────── */}
      <View style={styles.infoRow}>
        <Ionicons name="location-sharp" size={13} color={theme.colors.mutedText} style={styles.infoRowIcon} />
        <AppText style={[styles.infoRowText, { color: theme.colors.mutedText, flex: 1, minWidth: 0 }]} numberOfLines={2}>
          {locationStr}
        </AppText>
      </View>

      {/* ── Contact person row (number stays behind the reveal/Call flow) ── */}
      {req.contactPersonName ? (
        <View style={styles.infoRow}>
          <Ionicons name="person" size={13} color={theme.colors.mutedText} style={styles.infoRowIcon} />
          <AppText style={[styles.infoRowText, { color: theme.colors.mutedText, flex: 1, minWidth: 0 }]} numberOfLines={2}>
            {req.contactPersonName}
          </AppText>
        </View>
      ) : null}

      {/* ── Salary row ───────────────────────────────────────── */}
      <View style={styles.infoRow}>
        <Ionicons name="wallet" size={13} color={visual.color} style={styles.infoRowIcon} />
        <AppText style={[styles.salaryAmt, { color: visual.color, flexShrink: 1 }]} numberOfLines={1}>{salaryText}</AppText>
        <AppText style={[styles.salarySlash, { color: theme.colors.mutedText, flexShrink: 1 }]} numberOfLines={1}> {t('salaryPer')} {salaryPeriod}</AppText>
        {workers > 0 && (
          <>
            <AppText style={[styles.dot, { color: theme.colors.mutedText, flexShrink: 0 }]}> · </AppText>
            <AppText style={[styles.infoRowText, { color: theme.colors.mutedText, flexShrink: 0 }]} numberOfLines={1}><Ionicons name="people" size={12} color={theme.colors.mutedText} />{' '}{t('workerNeeded', { count: workers })}</AppText>
          </>
        )}
      </View>

      {/* ── Chips row ────────────────────────────────────────── */}
      <View style={styles.chipsWrap}>
        <View style={[styles.chip, { backgroundColor: isDark ? theme.colors.surface : visual.bg + 'CC', borderColor: visual.color + '33' }]}>
          <AppText style={[styles.chipText, { color: visual.color }]} numberOfLines={1}>{categoryLabel}</AppText>
        </View>
        {req.accommodationAvailable && (
          <View style={[styles.chip, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
            <AppText style={[styles.chipText, { color: '#15803D' }]} numberOfLines={1}><Ionicons name="home" size={11} color="#15803D" />{' '}{t('perkStay')}</AppText>
          </View>
        )}
        {req.foodAvailable && (
          <View style={[styles.chip, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
            <AppText style={[styles.chipText, { color: '#C2410C' }]} numberOfLines={1}><Ionicons name="restaurant" size={11} color="#C2410C" />{' '}{t('perkFood')}</AppText>
          </View>
        )}
        {req.transportProvided && (
          <View style={[styles.chip, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <AppText style={[styles.chipText, { color: '#1D4ED8' }]} numberOfLines={1}><Ionicons name="bus" size={11} color="#1D4ED8" />{' '}{t('perkTransport')}</AppText>
          </View>
        )}
        {req.bonus && (
          <View style={[styles.chip, { backgroundColor: '#FDF4FF', borderColor: '#E9D5FF' }]}>
            <AppText style={[styles.chipText, { color: '#7C3AED' }]} numberOfLines={1}><Ionicons name="gift" size={11} color="#7C3AED" />{' '}{t('perkBonus')}</AppText>
          </View>
        )}
        {req.incentive && (
          <View style={[styles.chip, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
            <AppText style={[styles.chipText, { color: '#92400E' }]} numberOfLines={1}><Ionicons name="star" size={11} color="#92400E" />{' '}{t('perkIncentive')}</AppText>
          </View>
        )}
        {req.weeklyOff && (
          <View style={[styles.chip, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
            <AppText style={[styles.chipText, { color: '#15803D' }]} numberOfLines={1}><Ionicons name="calendar" size={11} color="#15803D" />{' '}{t('perkWeeklyOff')}</AppText>
          </View>
        )}
        {req.overtimeAvailable && (
          <View style={[styles.chip, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
            <AppText style={[styles.chipText, { color: '#C2410C' }]} numberOfLines={1}><Ionicons name="time" size={11} color="#C2410C" />{' '}{t('perkOvertime')}</AppText>
          </View>
        )}
        {req.insuranceAvailable && (
          <View style={[styles.chip, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <AppText style={[styles.chipText, { color: '#1D4ED8' }]} numberOfLines={1}><Ionicons name="shield-checkmark" size={11} color="#1D4ED8" />{' '}{t('perkInsurance')}</AppText>
          </View>
        )}
        {req.pfAvailable && (
          <View style={[styles.chip, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
            <AppText style={[styles.chipText, { color: '#7C3AED' }]} numberOfLines={1}><Ionicons name="business" size={11} color="#7C3AED" />{' '}{t('perkPf')}</AppText>
          </View>
        )}
        {req.esicAvailable && (
          <View style={[styles.chip, { backgroundColor: '#ECFEFF', borderColor: '#A5F3FC' }]}>
            <AppText style={[styles.chipText, { color: '#0E7490' }]} numberOfLines={1}><Ionicons name="medkit" size={11} color="#0E7490" />{' '}{t('perkEsic')}</AppText>
          </View>
        )}
      </View>

      {/* ── Action row ───────────────────────────────────────── */}
      <View style={[styles.actionRow, { borderTopColor: isDark ? theme.colors.border : '#F1F5F9' }]}>
        <View style={styles.actionRight}>
          <TouchableOpacity
            onPress={() => { void handleShare(); }}
            style={[styles.shareBtn, { borderColor: isDark ? theme.colors.border : '#E2E8F0', backgroundColor: isDark ? theme.colors.surface : '#F8FAFC' }]}
            activeOpacity={0.75}
          >
            <Ionicons name="share-social" size={14} color={isDark ? theme.colors.mutedText : '#64748B'} />
            <AppText style={[styles.shareBtnLabel, { color: isDark ? theme.colors.mutedText : '#64748B' }]} numberOfLines={1}>{t('shareWithFriends')}</AppText>
          </TouchableOpacity>

          {/* Call button — only visible when employer has an active subscription.
              SelfWorker: can call freely.
              Agent: must have verified badge, else show badge gate message. */}
          {req.employerSubscribed && (
            <TouchableOpacity
              onPress={() => {
                if (!isSelfWorker && isAgent && !isVerifiedAgent) {
                  showAlert(
                    t('verifiedBadgeRequired'),
                    t('verifiedAgentCallMsg'),
                    [{ text: 'OK' }]
                  );
                  return;
                }
                onCallPress(req._id, req.contactPersonName ?? req.employerName ?? '');
              }}
              activeOpacity={0.8}
              style={styles.viewContactBtn}
            >
              <Ionicons name="call" size={14} color="#FFFFFF" style={styles.viewContactIcon} />
              <AppText style={styles.viewContactText}>{t('call')}</AppText>
            </TouchableOpacity>
          )}

          {isAgent && (
            <TouchableOpacity
              onPress={() => !alreadyInterested && onInterest(req)}
              activeOpacity={alreadyInterested ? 1 : 0.8}
              style={[styles.applyBtn, { backgroundColor: alreadyInterested ? '#10B981' : visual.color }]}
            >
              <AppText style={styles.applyBtnText}>
                {alreadyInterested ? t('appliedCheck') : `${t('apply')} →`}
              </AppText>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});
ReqCard.displayName = 'ReqCard';

// ── Contact reveal modal ──────────────────────────────────────────────────────
interface ContactModalProps {
  visible: boolean;
  name: string;
  phone: string;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

const ContactModal = ({ visible, name, phone, loading, error, onClose }: ContactModalProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.modalBox, { backgroundColor: theme.colors.surface }]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
          >
            {/* Handle bar */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 20 }} />

            <View style={{ alignItems: 'center', paddingHorizontal: 8 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <AppText style={{ fontSize: 32 }}>📞</AppText>
              </View>
              <AppText style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: 4, textAlign: 'center' }}>{name || t('detailEmployer')}</AppText>
              <AppText style={{ fontSize: 12, color: theme.colors.mutedText, marginBottom: 20 }}>{t('employerContact')}</AppText>

              {/* Phone number card */}
              <View style={{
                backgroundColor: loading ? '#F8FAFC' : (phone ? '#EBF1FF' : '#FEF2F2'),
                borderRadius: 16,
                paddingVertical: 20,
                paddingHorizontal: 24,
                marginBottom: 24,
                borderWidth: 1.5,
                borderColor: loading ? theme.colors.border : (phone ? '#1037A4' + '40' : '#FECACA'),
                width: '100%',
                alignItems: 'center',
                minHeight: 72,
                justifyContent: 'center',
              }}>
                {loading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator size="small" color="#1037A4" />
                    <AppText style={{ fontSize: 14, color: '#1037A4', fontWeight: '600' }}>{t('fetchingContact')}</AppText>
                  </View>
                ) : error ? (
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <AppText style={{ fontSize: 20 }}>⚠️</AppText>
                    <AppText style={{ fontSize: 13, color: '#DC2626', fontWeight: '600', textAlign: 'center' }}>{error}</AppText>
                  </View>
                ) : phone ? (
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <AppText style={{ fontSize: 11, fontWeight: '700', color: '#1037A4', letterSpacing: 0.5, textTransform: 'uppercase' }}>{t('mobileNumber')}</AppText>
                    <AppText style={{ fontSize: 26, fontWeight: '900', color: '#1037A4', letterSpacing: 2 }}>{phone}</AppText>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <AppText style={{ fontSize: 20 }}>📵</AppText>
                    <AppText style={{ fontSize: 13, color: '#DC2626', fontWeight: '600' }}>{t('phoneUnavailable')}</AppText>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.modalActions}>
              <AppButton title={t('cancel')} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
              <AppButton
                title={`📞 ${t('callNow')}`}
                onPress={() => { if (phone) void Linking.openURL(`tel:${phone}`); onClose(); }}
                style={{ flex: 1 }}
                disabled={!phone || loading}
              />
            </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

// ── Wage modal ────────────────────────────────────────────────────────────────
interface WageModalProps {
  visible: boolean;
  req: RawRequirement | null;
  onClose: () => void;
  onSubmit: (reqId: string, wage: number) => void;
  loading: boolean;
}

const WageModal = ({ visible, req, onClose, onSubmit, loading }: WageModalProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [wage, setWage] = useState('');
  const visual = getVisual(req?.workType, req?.subCategory);

  useEffect(() => { if (visible) setWage(''); }, [visible]);

  const minWage = req?.minBudgetPerWorker ?? 0;
  const period = req ? getSalaryType(req) : 'day';
  const periodLabel = t(`salaryPeriod_${period}` as 'salaryPeriod_day' | 'salaryPeriod_month' | 'salaryPeriod_week');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.modalBox, { backgroundColor: theme.colors.surface }]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
            >
              {/* Job banner inside modal */}
              <View style={[styles.modalBanner, { backgroundColor: visual.bg }]}>
                <AppText style={styles.modalBannerEmoji}>{visual.emoji}</AppText>
                <View style={{ flex: 1 }}>
                  <AppText style={[styles.modalBannerTitle, { color: visual.color }]} numberOfLines={2}>
                    {getJobTitle(req?.workType, req?.subCategory, i18n.language, t)}
                  </AppText>
                  <AppText variant="caption" style={{ color: visual.color + '99' }}>
                    {req?.district ?? ''} · ₹{minWage}+ {t('perPeriod', { period })}
                  </AppText>
                </View>
              </View>

              <AppText variant="caption" color={theme.colors.mutedText} style={[styles.fieldLabel, { marginTop: 16 }]}>
                {t('wageFieldLabel', { period: periodLabel, minWage })}
              </AppText>
              <TextInput
                value={wage}
                onChangeText={setWage}
                keyboardType="numeric"
                placeholder={t('wageInputPlaceholder', { minWage })}
                placeholderTextColor={theme.colors.mutedText}
                style={[styles.wageInput, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]}
              />

              <View style={[styles.modalActions, { marginTop: 8 }]}>
                <AppButton title={t('cancel')} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
                <AppButton
                  title={t('submitApplication')}
                  loading={loading}
                  onPress={() => {
                    const n = Number(wage);
                    if (!n || n < minWage) {
                      showAlert(t('alertInvalidWage'), t('alertMinWageMsg', { minWage }));
                      return;
                    }
                    if (req?._id) onSubmit(req._id, n);
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export const JobMarketplaceScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t, i18n } = useTranslation();
  const isDark = theme.mode === 'dark';
  const insets = useSafeAreaInsets();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();

  const user = authState.session?.user;
  const role = user?.role ?? 'worker';
  const isAgent = role === 'agent' || role === 'selfworker' || role === 'worker';
  const isVerifiedAgent = !!(user?.veryfiedBage);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(route.params?.workType ?? '');
  const [selectedSubCat, setSelectedSubCat] = useState<string>(route.params?.subCategory ?? '');
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  // Pending state — holds draft selections while the sheet is open.
  // Applied to actual state only when user taps "Apply Filters".
  const [pendingCategory, setPendingCategory] = useState<string>('');
  const [pendingSubCat, setPendingSubCat] = useState<string>('');
  const showMyInterests = route.params?.myInterests === true;
  const showLikedOnly = route.params?.likedOnly === true;

  // Debounce search
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (text: string): void => {
    setSearch(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(text);
    }, 500);
  };
  // Clear any pending debounce on unmount (no setState after unmount).
  useEffect(() => () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); }, []);

  // Sync pending state with applied state whenever the sheet opens
  useEffect(() => {
    if (filterSheetVisible) {
      setPendingCategory(selectedCategory);
      setPendingSubCat(selectedSubCat);
    }
  }, [filterSheetVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subcategories for the applied filter (drives the query)
  const subCategories = useMemo(() => {
    if (!selectedCategory) return [];
    const cat = CATEGORIES.find((c) => c.value === selectedCategory);
    return cat?.subcategories ?? [];
  }, [selectedCategory]);

  // Subcategories shown inside the filter sheet (driven by pending selection)
  const pendingSubCategories = useMemo(() => {
    if (!pendingCategory) return [];
    const cat = CATEGORIES.find((c) => c.value === pendingCategory);
    return cat?.subcategories ?? [];
  }, [pendingCategory]);

  // ── Liked-only mode: flat query ─────────────────────────────────────────────
  const likedQuery = useInfiniteQuery({
    queryKey: ['requirements-liked', user?.id],
    queryFn: ({ pageParam = 1 }) => requirementsApi.getLiked(pageParam as number, 50),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { currentPage, totalPages } = lastPage.pagination;
      return currentPage < totalPages ? currentPage + 1 : undefined;
    },
    staleTime: 30_000,
    enabled: showLikedOnly,
  });

  const {
    data,
    isLoading: allLoading,
    isError: allError,
    refetch: allRefetch,
    isFetching: allFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['requirements-role', role, user?.id, selectedCategory, selectedSubCat, debouncedSearch, showMyInterests],
    queryFn: ({ pageParam = 1 }) => requirementsApi.listForRole({
      role,
      userId: user?.id,
      workType: selectedCategory || undefined,
      subCategory: selectedSubCat || undefined,
      search: debouncedSearch || undefined,
      myInterests: showMyInterests || undefined,
      page: pageParam as number,
      limit: 50,
    }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { currentPage, totalPages } = lastPage.pagination;
      return currentPage < totalPages ? currentPage + 1 : undefined;
    },
    staleTime: 30_000,
    enabled: !showLikedOnly,
  });

  // Resolve active query based on mode
  const isLoading = showLikedOnly ? likedQuery.isLoading : allLoading;
  const isError   = showLikedOnly ? likedQuery.isError   : allError;
  const isFetching = showLikedOnly ? likedQuery.isFetching : allFetching;
  const refetch = showLikedOnly ? likedQuery.refetch : allRefetch;

  // Distinguish a user-initiated pull-to-refresh from background refetches
  // (search/filter changes) so we never show two spinners at once.
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  const handleRefresh = useCallback(() => {
    setIsManualRefresh(true);
    void Promise.resolve(refetch()).finally(() => setIsManualRefresh(false));
  }, [refetch]);

  const requirements: RawRequirement[] = useMemo(() => {
    const src = showLikedOnly ? likedQuery.data : data;
    return src?.pages.flatMap((p) => p.requirements) ?? [];
  }, [showLikedOnly, likedQuery.data, data]);

  const totalCount = showLikedOnly
    ? (likedQuery.data?.pages[0]?.pagination.totalCount ?? 0)
    : (data?.pages[0]?.pagination.totalCount ?? 0);

  // Track interested requirements (optimistic)
  const [interestedIds, setInterestedIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [wageModalReq, setWageModalReq] = useState<RawRequirement | null>(null);
  const [sortMode, setSortMode] = useState<'default' | 'salary' | 'new'>('default');
  const [contactInfo, setContactInfo] = useState<{ name: string; phone: string; loading: boolean; error: string | null } | null>(null);

  // Seed liked IDs from server data (likedBy field on each requirement)
  useEffect(() => {
    if (!user?.id) return;
    setLikedIds((prev) => {
      const next = new Set(prev);
      requirements.forEach((r) => {
        if (r.likedBy?.includes(user.id)) next.add(r._id);
      });
      return next;
    });
  }, [requirements, user?.id]);

  // Like mutation — optimistic with rollback
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

  const handleLike = useCallback((id: string): void => { likeMutation.mutate(id); }, [likeMutation]);

  const interestMutation = useMutation({
    mutationFn: ({ reqId, wage }: { reqId: string; wage: number }) =>
      requirementsApi.expressInterestWithWage(reqId, wage),
    onSuccess: (_, { reqId }) => {
      setInterestedIds((prev) => new Set([...prev, reqId]));
      setWageModalReq(null);
      void queryClient.invalidateQueries({ queryKey: ['requirements-role'] });
      showAlert(t('alertAppliedTitle'), t('alertAppliedMsg'));
    },
    onError: () => showAlert(t('alertError'), t('alertSubmitError')),
  });

  const handleInterest = useCallback((req: RawRequirement): void => {
    setWageModalReq(req);
  }, []);

  // Reveal employer phone — opens modal immediately with a loading state, then populates phone
  const revealMutation = useMutation({
    mutationFn: (reqId: string) => requirementsApi.revealEmployerPhone(reqId),
    onSuccess: ({ phone, name }) => {
      setContactInfo({ phone: phone ?? '', name, loading: false, error: null });
    },
    onError: (err: unknown) => {
      const errObj = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = errObj?.response?.data?.message ?? errObj?.message ?? 'Could not fetch contact details.';
      setContactInfo((prev) => prev ? { ...prev, loading: false, error: msg } : null);
    },
  });

  const handleCallPress = useCallback((reqId: string, employerName: string): void => {
    setContactInfo({ phone: '', name: employerName, loading: true, error: null });
    revealMutation.mutate(reqId);
  }, [revealMutation]);

  const isInterested = (req: RawRequirement): boolean =>
    interestedIds.has(req._id) ||
    Boolean(req.intrestedAgents?.some((a) => a.agentId === user?.id));

  const handleCategorySelect = (value: string): void => {
    const next = selectedCategory === value ? '' : value;
    setSelectedCategory(next);
    setSelectedSubCat('');
  };

  const sortedRequirements = useMemo(() => {
    if (sortMode === 'salary') return [...requirements].sort((a, b) => (b.minBudgetPerWorker ?? 0) - (a.minBudgetPerWorker ?? 0));
    if (sortMode === 'new') return [...requirements].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    return requirements;
  }, [requirements, sortMode]);

  if (isLoading) return <LoadingState message={t('loading')} />;
  if (isError) return <ErrorState title={t('alertError')} message={t('fetchJobsError')} onRetry={() => void refetch()} />;

  const pageTitle = showLikedOnly ? t('likedJobs') : showMyInterests ? t('myApplicationsTab') : t('findWorkNearYou');
  const hasFilters = !!(selectedCategory || selectedSubCat);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? theme.colors.background : '#F1F5F9' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />

      {/* ── Green header ─────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
            <AppText style={styles.backIcon}>←</AppText>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <AppText style={styles.headerTitle}>{pageTitle}</AppText>
            <AppText style={styles.headerSub}>
              {t('jobsFoundNearYou', { count: totalCount > 0 ? totalCount : requirements.length })}
            </AppText>
          </View>
          {isFetching && !isFetchingNextPage && !isManualRefresh && <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />}
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.6)" style={styles.searchBarIcon} />
          <TextInput
            value={search}
            onChangeText={handleSearchChange}
            placeholder={t('searchPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.55)"
            style={styles.searchBarInput}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setDebouncedSearch(''); }} hitSlop={8}>
              <AppText style={styles.searchBarClear}>✕</AppText>
            </TouchableOpacity>
          )}
          {!showLikedOnly && (
            <TouchableOpacity
              onPress={() => setFilterSheetVisible(true)}
              style={[styles.filterIconBtn, { backgroundColor: hasFilters ? '#F97316' : 'rgba(255,255,255,0.18)' }]}
              activeOpacity={0.8}
            >
              <Ionicons name="options" size={16} color="#FFFFFF" style={styles.filterIconText} />
              {hasFilters && <View style={styles.filterActiveDot} />}
            </TouchableOpacity>
          )}
        </View>

        {/* Quick sort chips */}
        {!showLikedOnly && !showMyInterests && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortChips}>
            {([
              { id: 'default', icon: 'sparkles' as const, label: t('sortAllJobs') },
              { id: 'salary',  icon: 'cash' as const,     label: t('sortHighSalary') },
              { id: 'new',     icon: 'flash' as const,    label: t('sortNewJobs') },
            ] as const).map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setSortMode(s.id)}
                style={[styles.sortChip, sortMode === s.id && styles.sortChipActive]}
              >
                <AppText style={[styles.sortChipText, sortMode === s.id && styles.sortChipTextActive]}>
                  <Ionicons name={s.icon} size={12} color={sortMode === s.id ? '#1037A4' : 'rgba(255,255,255,0.85)'} />{' '}{s.label}
                </AppText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Active filter chips summary */}
      {!showLikedOnly && hasFilters && (
        <View style={[styles.activeFiltersRow, { backgroundColor: isDark ? theme.colors.surface : '#FFFFFF', borderBottomColor: theme.colors.border }]}>
          {selectedCategory && (
            <View style={[styles.activeChip, { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary }]}>
              <AppText style={[styles.activeChipText, { color: theme.colors.primary }]}>
                {(WORK_TYPE_VISUALS[selectedCategory] ?? DEFAULT_VISUAL).emoji} {getCategoryLabel(selectedCategory, t)}
              </AppText>
              <TouchableOpacity onPress={() => { setSelectedCategory(''); setSelectedSubCat(''); }} hitSlop={8}>
                <AppText style={[styles.activeChipX, { color: theme.colors.primary }]}>✕</AppText>
              </TouchableOpacity>
            </View>
          )}
          {selectedSubCat && (
            <View style={[styles.activeChip, { backgroundColor: '#EDE9FE', borderColor: '#6366F1' }]}>
              <AppText style={[styles.activeChipText, { color: '#6366F1' }]}>
                {getSubCatLabel(selectedSubCat, i18n.language)}
              </AppText>
              <TouchableOpacity onPress={() => setSelectedSubCat('')} hitSlop={8}>
                <AppText style={[styles.activeChipX, { color: '#6366F1' }]}>✕</AppText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Job list */}
      {sortedRequirements.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            title={showLikedOnly ? t('noLikedJobsTitle') : t('noJobsFound')}
            message={
              showLikedOnly
                ? t('noLikedJobsMsg')
                : selectedCategory
                  ? t('noJobsInArea')
                  : t('noJobsYet')
            }
          />
        </View>
      ) : (
        <FlatList
          data={sortedRequirements}
          keyExtractor={(item, i) => item._id || String(i)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={10}
          removeClippedSubviews={false}
          refreshControl={<RefreshControl refreshing={isManualRefresh} onRefresh={handleRefresh} />}
          onEndReached={() => {
            if (showLikedOnly) {
              if (likedQuery.hasNextPage && !likedQuery.isFetchingNextPage) void likedQuery.fetchNextPage();
            } else {
              if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.3}
          renderItem={({ item }) => (
            <ReqCard
              req={item}
              isAgent={isAgent}
              isVerifiedAgent={isVerifiedAgent}
              isSelfWorker={role === 'selfworker'}
              alreadyInterested={isInterested(item)}
              isLiked={likedIds.has(item._id)}
              onInterest={handleInterest}
              onLike={handleLike}
              onCallPress={handleCallPress}
            />
          )}
          ListFooterComponent={
            (isFetchingNextPage || likedQuery.isFetchingNextPage) ? (
              <View style={styles.loadMore}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : null
          }
        />
      )}

      {/* Filter bottom sheet */}
      <Modal
        visible={filterSheetVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterSheetVisible(false)}
      >
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setFilterSheetVisible(false)} />
        <View style={[styles.sheetContainer, { backgroundColor: theme.colors.surface }]}>
          {/* Handle */}
          <View style={[styles.sheetHandle, { backgroundColor: theme.colors.border }]} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <AppText style={[styles.sheetTitle, { color: theme.colors.text }]}>{t('filterJobsTitle')}</AppText>
            {(pendingCategory || pendingSubCat) && (
              <TouchableOpacity onPress={() => { setPendingCategory(''); setPendingSubCat(''); }}>
                <AppText style={styles.sheetClear}>{t('clearAllFilters')}</AppText>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {/* Work Category */}
            <AppText style={[styles.sheetSection, { color: theme.colors.mutedText }]}>{t('workCategorySection').toUpperCase()}</AppText>
            <TouchableOpacity
              onPress={() => { setPendingCategory(''); setPendingSubCat(''); }}
              style={[styles.sheetRow, { borderBottomColor: theme.colors.divider }]}
            >
              <AppText style={styles.sheetRowEmoji}>🔍</AppText>
              <AppText style={[styles.sheetRowLabel, { color: theme.colors.text }]}>{t('allCategories')}</AppText>
              {!pendingCategory && <AppText style={styles.sheetRowCheck}>✓</AppText>}
            </TouchableOpacity>
            {CATEGORIES.map((cat) => {
              const v = WORK_TYPE_VISUALS[cat.value] ?? DEFAULT_VISUAL;
              const active = pendingCategory === cat.value;
              return (
                <TouchableOpacity
                  key={cat.value}
                  onPress={() => { setPendingCategory(active ? '' : cat.value); setPendingSubCat(''); }}
                  style={[styles.sheetRow, { borderBottomColor: theme.colors.divider, backgroundColor: active ? theme.colors.primaryLight : 'transparent' }]}
                >
                  <AppText style={styles.sheetRowEmoji}>{v.emoji}</AppText>
                  <AppText style={[styles.sheetRowLabel, { color: active ? theme.colors.primary : theme.colors.text, fontWeight: active ? '700' : '500' }]}>
                    {getCategoryLabel(cat.value, t)}
                  </AppText>
                  {active && <AppText style={styles.sheetRowCheck}>✓</AppText>}
                </TouchableOpacity>
              );
            })}

            {/* Sub-category */}
            {pendingSubCategories.length > 0 && (
              <>
                <AppText style={[styles.sheetSection, { color: theme.colors.mutedText, marginTop: 16 }]}>{t('subCategorySection').toUpperCase()}</AppText>
                <TouchableOpacity
                  onPress={() => setPendingSubCat('')}
                  style={[styles.sheetRow, { borderBottomColor: theme.colors.divider }]}
                >
                  <AppText style={[styles.sheetRowLabel, { color: theme.colors.text }]}>{t('allSubCategories')}</AppText>
                  {!pendingSubCat && <AppText style={styles.sheetRowCheck}>✓</AppText>}
                </TouchableOpacity>
                {pendingSubCategories.map((sc) => {
                  const active = pendingSubCat === sc.value;
                  return (
                    <TouchableOpacity
                      key={sc.value}
                      onPress={() => setPendingSubCat(active ? '' : sc.value)}
                      style={[styles.sheetRow, { borderBottomColor: theme.colors.divider, backgroundColor: active ? '#EDE9FE' : 'transparent' }]}
                    >
                      <AppText style={[styles.sheetRowLabel, { color: active ? '#6366F1' : theme.colors.text, fontWeight: active ? '700' : '500' }]}>
                        {getSubCatLabel(sc.value, i18n.language)}
                      </AppText>
                      {active && <AppText style={[styles.sheetRowCheck, { color: '#6366F1' }]}>✓</AppText>}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={[styles.sheetFooter, { borderTopColor: theme.colors.border }]}>
            <AppButton
              title={t('applyFiltersBtn')}
              onPress={() => {
                setSelectedCategory(pendingCategory);
                setSelectedSubCat(pendingSubCat);
                setFilterSheetVisible(false);
              }}
              fullWidth
            />
          </View>
        </View>
      </Modal>

      {/* Wage modal */}
      <WageModal
        visible={Boolean(wageModalReq)}
        req={wageModalReq}
        onClose={() => setWageModalReq(null)}
        onSubmit={(reqId, wage) => interestMutation.mutate({ reqId, wage })}
        loading={interestMutation.isPending}
      />

      {/* Contact reveal modal */}
      <ContactModal
        visible={!!contactInfo}
        name={contactInfo?.name ?? ''}
        phone={contactInfo?.phone ?? ''}
        loading={contactInfo?.loading ?? false}
        error={contactInfo?.error ?? null}
        onClose={() => setContactInfo(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: '#1037A4',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', lineHeight: 22 },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 1 },

  // ── Search bar (inside header) ───────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  searchBarIcon: { fontSize: 16, lineHeight: 20 },
  searchBarInput: { flex: 1, fontSize: 15, color: '#FFFFFF', paddingVertical: 0 },
  searchBarClear: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '700' },
  filterIconBtn: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  filterIconText: { fontSize: 16, lineHeight: 20 },
  filterActiveDot: {
    position: 'absolute', top: 4, right: 4,
    width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#EF4444',
  },

  // ── Sort chips ───────────────────────────────────────────────────────────────
  sortChips: { flexDirection: 'row', gap: 8, paddingTop: 12, paddingBottom: 2 },
  sortChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.30)',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  sortChipActive: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderColor: 'rgba(255,255,255,0.95)',
  },
  sortChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  sortChipTextActive: { color: '#1037A4', fontWeight: '800' },

  // ── Active filter chips ──────────────────────────────────────────────────────
  activeFiltersRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  activeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 999, borderWidth: 1.5,
    paddingHorizontal: 12, paddingVertical: 5,
    maxWidth: '100%',
  },
  // flexShrink:1 lets a long label wrap/use the available width instead of being
  // clipped by the trailing ✕ (RN <Text> defaults to flexShrink:0 in a row).
  activeChipText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  activeChipX: { fontSize: 11, fontWeight: '800', flexShrink: 0 },

  // ── Filter bottom sheet ──────────────────────────────────────────────────────
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetContainer: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '88%', overflow: 'hidden',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', flexShrink: 1 },
  sheetClear: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  sheetBody: { paddingHorizontal: 0 },
  sheetSection: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
  },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetRowEmoji: { fontSize: 20, lineHeight: 24, width: 28, textAlign: 'center' },
  sheetRowLabel: { flex: 1, fontSize: 14 },
  sheetRowCheck: { fontSize: 16, fontWeight: '800', color: '#1037A4' },
  sheetFooter: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },

  // ── List ────────────────────────────────────────────────────────────────────
  list: { padding: 12, paddingBottom: 40 },

  // ── Card ────────────────────────────────────────────────────────────────────
  reqCard: {
    marginBottom: 10, borderRadius: 16, borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#1037A4', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTop: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12,
  },
  logoBox: {
    width: 50, height: 50, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  logoEmoji: { fontSize: 26, lineHeight: 32 },
  titleBlock: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15, fontWeight: '800', lineHeight: 20, letterSpacing: -0.2 },
  cardCategory: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  likeBtn: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  likeBtnIcon: { fontSize: 17, lineHeight: 22 },

  // Info rows (location, salary)
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 5, gap: 5 },
  infoRowIcon: { fontSize: 12, lineHeight: 16 },
  infoRowText: { fontSize: 12.5, lineHeight: 17 },
  salaryAmt: { fontSize: 13.5, fontWeight: '800', lineHeight: 18 },
  salarySlash: { fontSize: 12, fontWeight: '500' },
  dot: { fontSize: 12 },

  // Chips
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 14, marginVertical: 8 },
  chip: {
    borderRadius: 999, borderWidth: 1,
    paddingHorizontal: 11, paddingVertical: 5,
    flexShrink: 0,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipText: { fontSize: 11.5, fontWeight: '600' },

  // Expanded
  expandedBlock: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  detailRow: { flexDirection: 'row', gap: 6 },
  detailKey: { minWidth: 90, fontWeight: '600', fontSize: 12 },

  // Action row
  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  detailsBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  detailsBtnText: { fontSize: 11, fontWeight: '600' },
  actionRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', rowGap: 6, gap: 6 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, flexShrink: 0 },
  shareBtnIcon: { fontSize: 13, lineHeight: 17 },
  shareBtnLabel: { fontSize: 12, fontWeight: '600' },
  viewContactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: '#1037A4', flexShrink: 0,
  },
  viewContactIcon: { fontSize: 13, lineHeight: 17 },
  viewContactText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', flexShrink: 0 },
  applyBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexShrink: 0 },
  applyBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', textAlign: 'center' },

  // Load more
  loadMore: { paddingVertical: 20, alignItems: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, gap: 12, marginBottom: 4 },
  modalBannerEmoji: { fontSize: 30, lineHeight: 38 },
  modalBannerTitle: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  fieldLabel: { marginTop: 14, marginBottom: 6, fontWeight: '600' },
  wageInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 10 },
});
