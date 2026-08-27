import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../core/theme';
import { useTranslation } from 'react-i18next';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { WorkerInvitation } from '../../../core/api/endpoints/requirementsApi';
import { usePlanFeatures } from '../../../core/hooks/usePlanFeatures';
import { SuggestedWorkersModal } from '../components/SuggestedWorkersModal';
import { AppText } from '../../../shared/components/ui/AppText';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { apiClient } from '../../../core/api/client';
import type { MainStackParamList } from '../../../app/navigation/types';
import i18n from '../../../core/i18n';
import { getLocationStr, getWorkTypeLabel, getSubCatLabel } from '../../../shared/utils/labelUtils';

type Props = NativeStackScreenProps<MainStackParamList, 'RequirementInvitations'>;

// ─── Status tokens ────────────────────────────────────────────────────────────
const STATUS: Record<string, { color: string; bg: string; border: string; dotColor: string; label_key: string }> = {
  invited:  { color: '#6D28D9', bg: '#F5F3FF', border: '#C4B5FD', dotColor: '#7C3AED', label_key: 'invStatusPending'  },
  accepted: { color: '#047857', bg: '#ECFDF5', border: '#6EE7B7', dotColor: '#10B981', label_key: 'invStatusAccepted' },
  declined: { color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA', dotColor: '#EF4444', label_key: 'invStatusDeclined' },
};

const ACCENT: Record<string, string> = {
  invited:  '#7C3AED',
  accepted: '#10B981',
  declined: '#EF4444',
};

const fmtDate = (d?: string): string => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

const fmtTime = (d?: string): string => {
  if (!d) return '';
  try { return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

// Map a raw requirement status → a translated label key (employer ns).
// Unknown statuses fall back to the raw value so nothing ever disappears.
const REQ_STATUS_LABEL_KEYS: Record<string, string> = {
  pending: 'rd_statusPending',
  open: 'rd_statusOpen', active: 'rd_statusOpen', approved: 'rd_statusOpen',
  closed: 'rd_statusClosed', expired: 'rd_statusClosed',
  completed: 'rd_statusCompleted', fulfilled: 'rd_statusCompleted',
  ongoing: 'rd_statusOngoing', assigned: 'rd_statusOngoing',
  rejected: 'rd_statusRejected',
};

// ─── Requirement header card ──────────────────────────────────────────────────
const RequirementHeader = React.memo(({ requirementId }: { requirementId: string }): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  const { t: tDefault } = useTranslation();
  const { t } = useTranslation('employer');

  const { data: req, isLoading } = useQuery({
    queryKey: ['requirement', requirementId],
    queryFn: () => requirementsApi.getById(requirementId),
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
  });

  if (isLoading || !req) return null;

  const lang = i18n.language;
  const statusRaw = (req.status ?? '').toLowerCase();
  const isCompleted = statusRaw === 'completed' || statusRaw === 'fulfilled';
  const isClosedStatus = statusRaw === 'closed' || statusRaw === 'expired';
  const isOpen = !isCompleted && !isClosedStatus;
  const location = getLocationStr({ district: req.district, state: req.state }, lang, '');
  const totalWorkers = (req.workerQuantitySkilled ?? 0) + (req.workerQuantityUnskilled ?? 0);
  // Category labels embed a literal "\n" for the 2-line grid cards; flatten it
  // to a space so the single-line title here doesn't break mid-name.
  const workTypeLabel = getWorkTypeLabel(req.workType, tDefault as Parameters<typeof getWorkTypeLabel>[1]).replace(/\n/g, ' ');
  const subCatLabel   = req.subCategory ? getSubCatLabel(req.subCategory, lang) : null;
  const statusLabel   = REQ_STATUS_LABEL_KEYS[statusRaw]
    ? t(REQ_STATUS_LABEL_KEYS[statusRaw] as Parameters<typeof t>[0])
    : (req.status ?? t('rd_statusOpen'));

  return (
    <View style={[rh.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      {/* Blue left accent */}
      <View style={rh.leftAccent} />

      <View style={rh.body}>
        {/* Sub-category + Status */}
        <View style={rh.topRow}>
          {subCatLabel ? (
            <AppText style={[rh.subCat, { color: theme.colors.primary }]}>{subCatLabel}</AppText>
          ) : (
            <View />
          )}
          <View style={[rh.statusPill, { backgroundColor: isCompleted ? '#EFF6FF' : isOpen ? '#ECFDF5' : '#F1F5F9' }]}>
            <View style={[rh.statusDot, { backgroundColor: isCompleted ? '#2563EB' : isOpen ? '#10B981' : '#94A3B8' }]} />
            <AppText style={[rh.statusTxt, { color: isCompleted ? '#1D4ED8' : isOpen ? '#047857' : '#64748B' }]} numberOfLines={1}>
              {statusLabel}
            </AppText>
          </View>
        </View>

        {/* Work type title */}
        <AppText style={[rh.title, { color: theme.colors.text }]} numberOfLines={2}>
          {workTypeLabel}
        </AppText>

        {/* Chips row */}
        <View style={rh.chipsRow}>
          {req.ERN_NUMBER ? (
            <View style={[rh.chip, { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary + '30' }]}>
              <AppText style={[rh.chipTxt, { color: theme.colors.primary }]}>{'#'}{req.ERN_NUMBER}</AppText>
            </View>
          ) : null}
          {!!location && (
            <View style={[rh.chip, { backgroundColor: theme.colors.surface1, borderColor: theme.colors.border }]}>
              <AppText style={[rh.chipTxt, { color: theme.colors.mutedText }]}>{'📍 '}{location}</AppText>
            </View>
          )}
          {totalWorkers > 0 && (
            <View style={[rh.chip, { backgroundColor: theme.colors.surface1, borderColor: theme.colors.border }]}>
              <AppText style={[rh.chipTxt, { color: theme.colors.mutedText }]}>{'👷 '}{totalWorkers}</AppText>
            </View>
          )}
          {req.minBudgetPerWorker != null && (
            <View style={[rh.chip, { backgroundColor: '#F0FDF4', borderColor: '#A7F3D0' }]}>
              <AppText style={[rh.chipTxt, { color: '#065F46', fontWeight: '800' }]}>
                {'₹'}{req.minBudgetPerWorker}{req.maxBudgetPerWorker ? '–' + String(req.maxBudgetPerWorker) : ''}{'/day'}
              </AppText>
            </View>
          )}
        </View>
      </View>
    </View>
  );
});
RequirementHeader.displayName = 'RequirementHeader';

const rh = StyleSheet.create({
  card:       { flexDirection: 'row', marginHorizontal: 16, marginBottom: 14, borderRadius: 18, borderWidth: 1, overflow: 'hidden', elevation: 3, shadowColor: '#1A56DB', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 12 },
  leftAccent: { width: 5, backgroundColor: '#1A56DB' },
  body:       { flex: 1, padding: 14, gap: 8 },
  topRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subCat:     { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusTxt:  { fontSize: 11, fontWeight: '800' },
  title:      { fontSize: 17, fontWeight: '900', lineHeight: 23, letterSpacing: -0.3 },
  chipsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:       { flexDirection: 'row', alignItems: 'center', borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  chipTxt:    { fontSize: 11, fontWeight: '600' },
});

// ─── Stats strip ──────────────────────────────────────────────────────────────
const StatsStrip = React.memo(({ invitations }: { invitations: WorkerInvitation[] }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');

  const total    = invitations.length;
  const pending  = invitations.filter((i) => i.status === 'invited').length;
  const accepted = invitations.filter((i) => i.status === 'accepted').length;
  const declined = invitations.filter((i) => i.status === 'declined').length;

  const cells = [
    { label: t('invFilterAll'),      count: total,    color: theme.colors.primary,    bg: theme.colors.primaryLight,   border: theme.colors.primary + '25'   },
    { label: t('invFilterPending'),  count: pending,  color: '#7C3AED',               bg: '#F5F3FF',                   border: '#C4B5FD'                      },
    { label: t('invFilterAccepted'), count: accepted, color: '#047857',               bg: '#ECFDF5',                   border: '#A7F3D0'                      },
    { label: t('invFilterDeclined'), count: declined, color: '#B91C1C',               bg: '#FEF2F2',                   border: '#FECACA'                      },
  ];

  return (
    <View style={[st.row, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      {cells.map(({ label, count, color, bg, border }) => (
        <View key={label} style={[st.cell, { backgroundColor: bg, borderColor: border }]}>
          <AppText style={[st.count, { color }]}>{count}</AppText>
          <AppText style={[st.label, { color }]}>{label}</AppText>
        </View>
      ))}
    </View>
  );
});
StatsStrip.displayName = 'StatsStrip';

const st = StyleSheet.create({
  row:   { flexDirection: 'row', gap: 8, padding: 12, marginHorizontal: 16, marginBottom: 14, borderRadius: 16, borderWidth: 1, elevation: 2, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  cell:  { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 11, alignItems: 'center', gap: 4 },
  count: { fontSize: 22, fontWeight: '900', lineHeight: 26 },
  label: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
});

// ─── Invitation card ──────────────────────────────────────────────────────────
const InvitationCard = React.memo(({ item }: { item: WorkerInvitation }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');

  const statusKey = (item.status ?? 'invited') as keyof typeof STATUS;
  const s = STATUS[statusKey] ?? STATUS.invited!;
  const accentColor = ACCENT[statusKey] ?? ACCENT.invited!;
  const statusLabel = t(s.label_key as any);

  const initials = (item.workerName || 'W')
    .trim().split(/\s+/).map((w) => (w[0] ?? '').toUpperCase()).join('').slice(0, 2);

  const handleCall = (): void => {
    if (item.workerPhone) void Linking.openURL(`tel:${item.workerPhone}`);
  };

  return (
    <View style={[ic.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      {/* Colored top band */}
      <View style={[ic.topBand, { backgroundColor: s.bg, borderBottomColor: s.border }]}>
        {/* Avatar */}
        <View style={[ic.avatar, { backgroundColor: s.color + '18', borderColor: s.border }]}>
          <AppText style={[ic.avatarTxt, { color: s.color }]}>{initials}</AppText>
        </View>

        {/* Name + phone */}
        <View style={ic.nameCol}>
          <AppText style={[ic.name, { color: theme.colors.text }]} numberOfLines={2}>
            {item.workerName || 'Unknown Worker'}
          </AppText>
          {!!item.workerPhone && (
            <View style={ic.phoneRow}>
              <AppText style={[ic.phoneTxt, { color: theme.colors.mutedText }]}>
                {item.workerPhone}
              </AppText>
            </View>
          )}
        </View>

        {/* Right side: status + call */}
        <View style={ic.rightCol}>
          {/* Status badge */}
          <View style={[ic.statusBadge, { backgroundColor: s.bg, borderColor: s.border }]}>
            <View style={[ic.statusDot, { backgroundColor: accentColor }]} />
            <AppText style={[ic.statusTxt, { color: s.color }]}>{statusLabel}</AppText>
          </View>
          {/* Call button */}
          {!!item.workerPhone && (
            <TouchableOpacity onPress={handleCall} style={ic.callBtn} activeOpacity={0.8}>
              <AppText style={ic.callIcon}>{'📞'}</AppText>
              <AppText style={ic.callTxt}>{t('invCallBtn')}</AppText>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Timeline footer */}
      <View style={[ic.footer, { borderTopColor: theme.colors.divider }]}>
        <View style={ic.timeBlock}>
          <AppText style={[ic.timeHeading, { color: theme.colors.mutedText }]}>{t('invTimelineInvited')}</AppText>
          <AppText style={[ic.timeDate, { color: theme.colors.text }]}>{fmtDate(item.invitedAt)}</AppText>
          <AppText style={[ic.timeClock, { color: theme.colors.mutedText }]}>{fmtTime(item.invitedAt)}</AppText>
        </View>

        {item.respondedAt && (
          <>
            <View style={[ic.divider, { backgroundColor: theme.colors.border }]} />
            <View style={ic.timeBlock}>
              <AppText style={[ic.timeHeading, { color: theme.colors.mutedText }]}>{t('invTimelineResponded')}</AppText>
              <AppText style={[ic.timeDate, { color: s.color }]}>{fmtDate(item.respondedAt)}</AppText>
              <AppText style={[ic.timeClock, { color: theme.colors.mutedText }]}>{fmtTime(item.respondedAt)}</AppText>
            </View>
          </>
        )}
      </View>
    </View>
  );
});
InvitationCard.displayName = 'InvitationCard';

const ic = StyleSheet.create({
  card:        { marginHorizontal: 16, marginBottom: 12, borderRadius: 18, borderWidth: 1, overflow: 'hidden', elevation: 3, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12 },

  topBand:     { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderBottomWidth: 1 },
  avatar:      { width: 52, height: 52, borderRadius: 26, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt:   { fontSize: 18, fontWeight: '900', lineHeight: 22 },

  nameCol:     { flex: 1, minWidth: 0, gap: 3 },
  name:        { fontSize: 15, fontWeight: '800', lineHeight: 19, letterSpacing: -0.2 },
  phoneRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  phoneTxt:    { fontSize: 12, fontWeight: '600' },

  rightCol:    { alignItems: 'flex-end', gap: 8, flexShrink: 0 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusTxt:   { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  callBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0FDF4', borderRadius: 10, borderWidth: 1, borderColor: '#6EE7B7', paddingHorizontal: 10, paddingVertical: 5 },
  callIcon:    { fontSize: 12, lineHeight: 16 },
  callTxt:     { fontSize: 12, fontWeight: '800', color: '#047857' },

  footer:      { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  timeBlock:   { flex: 1, gap: 2 },
  timeHeading: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  timeDate:    { fontSize: 13, fontWeight: '700' },
  timeClock:   { fontSize: 11, fontWeight: '500' },
  divider:     { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 2 },
});

// ─── Subscription lock ────────────────────────────────────────────────────────
const LOCK_BENEFIT_KEYS = ['invLockBenefit1', 'invLockBenefit2', 'invLockBenefit3', 'invLockBenefit4'] as const;

const SubscriptionLock = React.memo(({ onSubscribe, isExpired }: { onSubscribe: () => void; isExpired: boolean }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');

  return (
    <ScrollView contentContainerStyle={[lk.scroll, { backgroundColor: theme.colors.background }]} showsVerticalScrollIndicator={false}>
      <View style={[lk.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>

        <View style={lk.badgeRow}>
          <View style={lk.badge}>
            <AppText style={lk.badgeStar}>{'⭐'}</AppText>
            <AppText style={lk.badgeTxt}>{t('invLockFeatureBadge')}</AppText>
          </View>
        </View>

        <View style={[lk.iconWrap, { backgroundColor: isExpired ? '#FFF8E1' : '#EBF1FF' }]}>
          <View style={[lk.iconRing, { borderColor: isExpired ? '#FCD34D' : '#93C5FD' }]}>
            <AppText style={lk.iconEmoji}>{isExpired ? '⏰' : '🔒'}</AppText>
          </View>
        </View>

        <AppText style={[lk.title, { color: theme.colors.text }]}>
          {isExpired ? t('invExpiredTitle') : t('invNoSubscription')}
        </AppText>
        <AppText style={[lk.desc, { color: theme.colors.mutedText }]}>
          {isExpired ? t('invExpiredDesc') : t('invSubscriptionDesc')}
        </AppText>

        <View style={[lk.benefits, { backgroundColor: theme.colors.primaryLight, borderColor: '#C7D7F8' }]}>
          {LOCK_BENEFIT_KEYS.map((key) => (
            <View key={key} style={lk.benefitRow}>
              <View style={lk.check}><AppText style={lk.checkTxt}>{'✓'}</AppText></View>
              <AppText style={[lk.benefitTxt, { color: theme.colors.textSecondary }]}>{t(key)}</AppText>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={onSubscribe}
          style={[lk.btn, { backgroundColor: isExpired ? '#D97706' : '#1037A4' }]}
          activeOpacity={0.85}
        >
          <AppText style={lk.btnTxt}>{isExpired ? t('invRenewBtn') : t('invSubscribeBtn')}{'  →'}</AppText>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
});
SubscriptionLock.displayName = 'SubscriptionLock';

const lk = StyleSheet.create({
  scroll:      { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card:        { borderRadius: 24, borderWidth: 1, padding: 24, alignItems: 'center', gap: 16, elevation: 3, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16 },
  badgeRow:    { alignSelf: 'stretch', alignItems: 'center' },
  badge:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FEF9C3', borderRadius: 20, borderWidth: 1, borderColor: '#FDE68A', paddingHorizontal: 12, paddingVertical: 5 },
  badgeStar:   { fontSize: 12, lineHeight: 16 },
  badgeTxt:    { fontSize: 10, fontWeight: '900', color: '#92400E', letterSpacing: 1.2, textTransform: 'uppercase' },
  iconWrap:    { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  iconRing:    { width: 78, height: 78, borderRadius: 39, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  iconEmoji:   { fontSize: 36, lineHeight: 44 },
  title:       { fontSize: 20, fontWeight: '900', textAlign: 'center', letterSpacing: -0.3 },
  desc:        { fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 270 },
  benefits:    { alignSelf: 'stretch', borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  benefitRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  check:       { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1A56DB', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  checkTxt:    { fontSize: 11, fontWeight: '900', color: '#fff', lineHeight: 14 },
  benefitTxt:  { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '600', lineHeight: 20 },
  btn:         { alignSelf: 'stretch', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 4, elevation: 2, shadowColor: '#1037A4', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  btnTxt:      { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.4 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export const RequirementInvitationsScreen = ({ route, navigation }: Props): React.JSX.Element => {
  const { requirementId } = route.params;
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = React.useState<'all' | 'invited' | 'accepted' | 'declined'>('all');
  const [inviteVisible, setInviteVisible] = React.useState(false);
  const planFeat = usePlanFeatures();

  // Requirement details — shares RequirementHeader's cache (same query key), used
  // to seed the invite modal with the requirement's work type for suggestions.
  const reqQuery = useQuery({
    queryKey: ['requirement', requirementId],
    queryFn: () => requirementsApi.getById(requirementId),
    staleTime: 60 * 1000,
  });
  const reqWorkType = reqQuery.data?.workType;

  // ── Subscription check ───────────────────────────────────────────────────
  const profileQuery = useQuery({
    queryKey: ['employer-full-profile'],
    queryFn: async () => {
      const res = await apiClient.get<{ user?: { isSubscribed?: boolean; subscriptionExpery?: string } }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    staleTime: 60 * 1000,
    gcTime:    5 * 60 * 1000,
    refetchOnMount: true,
  });

  const { isSubscribed, isExpired } = (() => {
    const p = profileQuery.data;
    if (!p?.isSubscribed) return { isSubscribed: false, isExpired: false };
    const exp = p.subscriptionExpery;
    if (!exp) return { isSubscribed: true, isExpired: false };
    const active = new Date(exp).getTime() > Date.now();
    return { isSubscribed: active, isExpired: !active };
  })();

  // ── Invitations data ─────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch, isFetching, fetchStatus } = useQuery({
    queryKey: ['requirement-invitations', requirementId],
    queryFn: () => requirementsApi.getRequirementInvitations(requirementId),
    staleTime: 60 * 1000,
    retry: 2,
    enabled: isSubscribed || !profileQuery.isSuccess,
  });

  const FILTER_CONFIG = [
    { key: 'all'      as const, label: t('invFilterAll'),      activeColor: theme.colors.primary  },
    { key: 'invited'  as const, label: t('invFilterPending'),  activeColor: '#7C3AED'             },
    { key: 'accepted' as const, label: t('invFilterAccepted'), activeColor: '#047857'             },
    { key: 'declined' as const, label: t('invFilterDeclined'), activeColor: '#B91C1C'             },
  ];

  const allInvitations: WorkerInvitation[] = data?.invitations ?? [];
  const filtered = filter === 'all' ? allInvitations : allInvitations.filter((i) => i.status === filter);

  const renderItem = useCallback(({ item }: { item: WorkerInvitation }) => (
    <InvitationCard item={item} />
  ), []);

  const keyExtractor = useCallback((item: WorkerInvitation, index: number) =>
    item.workerId ? String(item.workerId) : String(index), []);

  const ListHeader = useCallback(() => (
    <View>
      <RequirementHeader requirementId={requirementId} />

      {allInvitations.length > 0 && <StatsStrip invitations={allInvitations} />}

      {/* Section title + filter chips */}
      <View style={sc.sectionRow}>
        <AppText style={[sc.sectionTitle, { color: theme.colors.text }]}>
          {t('workerInvitations')}
        </AppText>
        <View style={sc.sectionRight}>
          <AppText style={[sc.sectionCount, { color: theme.colors.mutedText }]}>
            {allInvitations.length}
          </AppText>
          {planFeat.inviteEnabled && (
            <TouchableOpacity
              onPress={() => setInviteVisible(true)}
              style={sc.inviteBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <AppText style={sc.inviteBtnTxt}>＋ {t('inv_sendInvite')}</AppText>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sc.chipScroll} contentContainerStyle={sc.chipScrollContent}>
        {FILTER_CONFIG.map(({ key, label, activeColor }) => {
          const active = filter === key;
          const count  = key === 'all' ? allInvitations.length : allInvitations.filter((i) => i.status === key).length;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setFilter(key)}
              style={[
                sc.chip,
                active
                  ? { backgroundColor: activeColor, borderColor: activeColor }
                  : { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
              activeOpacity={0.8}
            >
              <AppText style={[sc.chipTxt, { color: active ? '#fff' : theme.colors.mutedText }]}>
                {label}
              </AppText>
              {count > 0 && (
                <View style={[sc.chipBadge, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : theme.colors.surface1 }]}>
                  <AppText style={[sc.chipBadgeTxt, { color: active ? '#fff' : theme.colors.mutedText }]}>
                    {count}
                  </AppText>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  ), [allInvitations, filter, theme, requirementId, planFeat.inviteEnabled]);

  const ListEmpty = useCallback(() => {
    if (isLoading) return null;
    const filterLabel = FILTER_CONFIG.find((f) => f.key === filter)?.label ?? '';
    return (
      <View style={sc.empty}>
        <View style={sc.emptyIconWrap}>
          <AppText style={sc.emptyIcon}>{'📭'}</AppText>
        </View>
        <AppText style={[sc.emptyTitle, { color: theme.colors.text }]}>
          {filter === 'all' ? t('invNoInvitationsSent') : t('invNoFilterInvitations', { filter: filterLabel })}
        </AppText>
        <AppText style={[sc.emptySub, { color: theme.colors.mutedText }]}>{t('invEmptySub')}</AppText>
      </View>
    );
  }, [isLoading, filter, theme]);

  return (
    <View style={[sc.root, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title={t('workerInvitations')} onBack={() => navigation.goBack()} />

      {/* Loading */}
      {(isLoading || profileQuery.isLoading) ? (
        <View style={sc.center}>
          <ActivityIndicator size="large" color={theme.colors.secondary} />
          <AppText style={[sc.loadTxt, { color: theme.colors.mutedText }]}>{t('invLoadingText')}</AppText>
        </View>

      /* Error — includes fetchStatus === 'paused' with no data: the device was
         offline before the query ever ran, so it never resolved to isError,
         it just parked itself waiting to reconnect. Without this it fell
         through to the empty-list view below, misleadingly showing "no
         invitations sent" when the real problem was connectivity. */
      ) : isError || (fetchStatus === 'paused' && !data) ? (
        <View style={sc.center}>
          <View style={sc.errorIconWrap}>
            <AppText style={sc.errorIcon}>{'⚠️'}</AppText>
          </View>
          <AppText style={[sc.errorTxt, { color: theme.colors.text }]}>{t('invCouldNotLoad')}</AppText>
          <TouchableOpacity onPress={() => void refetch()} style={[sc.retryBtn, { backgroundColor: theme.colors.primary }]} activeOpacity={0.85}>
            <AppText style={sc.retryTxt}>{t('retry')}</AppText>
          </TouchableOpacity>
        </View>

      /* Subscription gate */
      ) : profileQuery.isSuccess && !isSubscribed ? (
        <SubscriptionLock onSubscribe={() => navigation.navigate('Subscription')} isExpired={isExpired} />

      /* Main content */
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={[sc.list, { paddingBottom: insets.bottom + 32 }, filtered.length === 0 && sc.listFlex]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => void refetch()}
              tintColor={theme.colors.secondary}
              colors={[theme.colors.secondary]}
            />
          }
          style={{ backgroundColor: theme.colors.background }}
        />
      )}

      {/* Send-invite modal — reuses the dashboard's suggested-workers picker.
          On close, refetch so freshly-sent invites appear in the list. */}
      <SuggestedWorkersModal
        visible={inviteVisible}
        onClose={() => { setInviteVisible(false); void refetch(); }}
        requirementId={requirementId}
        workType={reqWorkType}
        titleLabel={(reqWorkType || '').replace(/_/g, ' ')}
      />
    </View>
  );
};

const sc = StyleSheet.create({
  root:            { flex: 1 },

  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  loadTxt:         { fontSize: 13, fontWeight: '600', marginTop: 6 },

  errorIconWrap:   { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  errorIcon:       { fontSize: 34, lineHeight: 42 },
  errorTxt:        { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  retryBtn:        { borderRadius: 14, paddingHorizontal: 32, paddingVertical: 13, marginTop: 4, elevation: 2, shadowColor: '#1A56DB', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8 },
  retryTxt:        { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.3 },

  sectionRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle:    { fontSize: 15, fontWeight: '900', letterSpacing: -0.2 },
  sectionCount:    { fontSize: 13, fontWeight: '700' },
  sectionRight:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 'auto' },
  inviteBtn:       { backgroundColor: '#1037A4', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  inviteBtnTxt:    { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },

  chipScroll:      { marginBottom: 14 },
  chipScrollContent:{ paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  chip:            { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 24, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 8 },
  chipTxt:         { fontSize: 12, fontWeight: '800' },
  chipBadge:       { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  chipBadgeTxt:    { fontSize: 10, fontWeight: '900' },

  list:            { paddingTop: 14 },
  listFlex:        { flexGrow: 1 },

  empty:           { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36, gap: 12 },
  emptyIconWrap:   { width: 88, height: 88, borderRadius: 44, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyIcon:       { fontSize: 40, lineHeight: 48 },
  emptyTitle:      { fontSize: 18, fontWeight: '900', textAlign: 'center', letterSpacing: -0.2 },
  emptySub:        { fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 260 },
});
