import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useAppTheme } from '../../../core/theme';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { InvitedRequirement } from '../../../core/api/endpoints/requirementsApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { useToast } from '../../../shared/state/toast/ToastContext';
import type { MainStackParamList } from '../../../app/navigation/types';
import { getWorkTypeLabel, getSubCatLabel, getLocationStr } from '../../../shared/utils/labelUtils';
import i18n from '../../../core/i18n';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const PAGE_LIMIT = 10;

const STATUS_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  invited:  { color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  accepted: { color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  declined: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
};

const fmtDate = (d?: string) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

// ─── Invitation card ──────────────────────────────────────────────────────────
const InvitationCard = React.memo(({
  item, onAccept, onDecline, responding, onPress, t,
}: {
  item: InvitedRequirement;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  responding: string | null;
  onPress: (id: string) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const inv = item.invitation;
  const status = inv?.status ?? 'invited';
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.invited;
  const statusLabel = t(`inv${status.charAt(0).toUpperCase() + status.slice(1)}`);
  const isPending = status === 'invited';
  const isAccepted = status === 'accepted';
  const reqId = String(item._id);
  const isBusy = responding === reqId;
  const hasPhone = !!item.employerPhone;
  // employerSubscribed=false means subscription definitively expired (not just missing phone)
  const isOnHold = item.employerSubscribed === false;

  const lang = i18n.language;
  const workTypeLabel = getWorkTypeLabel(item.workType, t as Parameters<typeof getWorkTypeLabel>[1]);
  const subCatLabel   = item.subCategory ? getSubCatLabel(item.subCategory, lang) : null;
  const locationStr   = getLocationStr({ district: item.district, state: item.state }, lang, '');

  const handleCall = useCallback(() => {
    if (item.employerPhone) void Linking.openURL(`tel:${item.employerPhone}`);
  }, [item.employerPhone]);

  return (
    <TouchableOpacity
      onPress={() => onPress(reqId)}
      activeOpacity={0.92}
      style={[card.wrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
    >
      {/* Status accent strip */}
      <View style={[card.accentStrip, { backgroundColor: colors.color }]} />

      <View style={card.inner}>
        {/* Header: title + status pill */}
        <View style={card.topRow}>
          <View style={{ flex: 1, gap: 3 }}>
            <AppText style={[card.title, { color: theme.colors.text }]} numberOfLines={2}>
              {workTypeLabel}{subCatLabel ? ` · ${subCatLabel}` : ''}
            </AppText>
            {!!locationStr && (
              <AppText style={[card.meta, { color: theme.colors.mutedText }]}>
                📍 {locationStr}
              </AppText>
            )}
            {item.ERN_NUMBER ? (
              <AppText style={[card.ern, { color: theme.colors.mutedText }]}>
                ERN #{item.ERN_NUMBER}
              </AppText>
            ) : null}
          </View>
          <View style={[card.statusPill, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <AppText style={[card.statusTxt, { color: colors.color }]}>{statusLabel}</AppText>
          </View>
        </View>

        {/* Employer row — info only, no inline call button */}
        {item.employerName ? (
          <View style={[card.employerRow, { backgroundColor: theme.colors.surface1, borderColor: theme.colors.border }]}>
            <View style={[card.employerIcon, { backgroundColor: theme.colors.primaryLight }]}>
              <AppText style={{ fontSize: 13 }}>🏢</AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={[card.employerName, { color: theme.colors.text }]}>
                {item.employerName}
              </AppText>
              {hasPhone ? (
                <AppText style={[card.employerPhone, { color: theme.colors.primary }]}>
                  📞 {item.employerPhone}
                </AppText>
              ) : (
                <AppText style={[card.employerPhone, { color: theme.colors.mutedText }]}>
                  🔒 {t('invPhoneLocked')}
                </AppText>
              )}
            </View>
          </View>
        ) : null}

        {/* On-hold banner — employer subscription expired */}
        {isOnHold && (
          <View style={card.onHoldBanner}>
            <AppText style={card.onHoldTxt}>⏸ {t('invOnHold')}</AppText>
          </View>
        )}

        {/* Invited date */}
        {inv?.invitedAt ? (
          <AppText style={[card.dateTxt, { color: theme.colors.mutedText }]}>
            {t('invInvitedOn', { date: fmtDate(inv.invitedAt) })}
          </AppText>
        ) : null}

        {/* Action buttons */}
        {isPending ? (
          /* Pending: Reject | Call | Accept */
          <View style={card.actions}>
            <TouchableOpacity
              onPress={() => onDecline(reqId)}
              disabled={isBusy}
              style={[card.declineBtn, { borderColor: '#FECACA' }, isBusy && { opacity: 0.5 }]}
              activeOpacity={0.8}
            >
              {isBusy
                ? <ActivityIndicator size="small" color="#DC2626" />
                : <AppText style={card.declineTxt}>{t('invDeclineBtn')}</AppText>}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={hasPhone ? handleCall : undefined}
              disabled={!hasPhone || isBusy}
              style={[card.callBtn, !hasPhone && card.callBtnLocked, isBusy && { opacity: 0.5 }]}
              activeOpacity={0.85}
            >
              <AppText style={[card.callBtnTxt, !hasPhone && card.callBtnLockedTxt]}>
                {hasPhone ? `📞 ${t('invCallBtn')}` : `🔒 ${t('invCallBtn')}`}
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onAccept(reqId)}
              disabled={isBusy}
              style={[card.acceptBtn, isBusy && { opacity: 0.5 }]}
              activeOpacity={0.85}
            >
              {isBusy
                ? <ActivityIndicator size="small" color="#fff" />
                : <AppText style={card.acceptTxt}>{t('invAcceptBtn')}</AppText>}
            </TouchableOpacity>
          </View>
        ) : isAccepted ? (
          /* Accepted: wide Call button only */
          <View style={card.actions}>
            <TouchableOpacity
              onPress={hasPhone ? handleCall : undefined}
              disabled={!hasPhone}
              style={[card.callBtnWide, !hasPhone && card.callBtnLocked]}
              activeOpacity={0.85}
            >
              <AppText style={[card.callBtnTxt, !hasPhone && card.callBtnLockedTxt]}>
                {hasPhone ? `📞 ${t('invCallBtn')}` : `🔒 ${t('invPhoneLocked')}`}
              </AppText>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});
InvitationCard.displayName = 'InvitationCard';

const card = StyleSheet.create({
  wrap:             { borderRadius: 18, borderWidth: 1, marginBottom: 12, overflow: 'hidden', flexDirection: 'row', elevation: 3, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10 },
  accentStrip:      { width: 5 },
  inner:            { flex: 1, padding: 14, gap: 10 },

  // Header
  topRow:           { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title:            { fontSize: 15, fontWeight: '800', lineHeight: 20, letterSpacing: -0.1 },
  meta:             { fontSize: 12, fontWeight: '500' },
  ern:              { fontSize: 11, fontWeight: '600' },
  statusPill:       { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  statusTxt:        { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  // Employer row (info only — no inline call button)
  employerRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 10 },
  employerIcon:     { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  employerName:     { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  employerPhone:    { fontSize: 11, fontWeight: '500', marginTop: 2 },

  onHoldBanner:     { borderRadius: 10, backgroundColor: '#FEF9C3', borderWidth: 1, borderColor: '#FDE68A', paddingHorizontal: 12, paddingVertical: 8 },
  onHoldTxt:        { fontSize: 12, fontWeight: '700', color: '#92400E' },

  dateTxt:          { fontSize: 11 },

  // Action buttons
  actions:          { flexDirection: 'row', gap: 8, marginTop: 2 },
  declineBtn:       { flex: 1, borderRadius: 12, borderWidth: 1.5, paddingVertical: 11, alignItems: 'center' },
  declineTxt:       { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  callBtn:          { flex: 1, borderRadius: 12, backgroundColor: '#16A34A', paddingVertical: 11, alignItems: 'center' },
  callBtnWide:      { flex: 1, borderRadius: 12, backgroundColor: '#16A34A', paddingVertical: 11, alignItems: 'center' },
  callBtnLocked:    { backgroundColor: '#E5E7EB' },
  callBtnTxt:       { fontSize: 13, fontWeight: '700', color: '#fff' },
  callBtnLockedTxt: { color: '#6B7280' },
  acceptBtn:        { flex: 1, borderRadius: 12, backgroundColor: '#7C3AED', paddingVertical: 11, alignItems: 'center' },
  acceptTxt:        { fontSize: 13, fontWeight: '800', color: '#fff' },
});

// ─── Filter config ────────────────────────────────────────────────────────────
type FilterOption = 'all' | 'invited' | 'accepted' | 'declined';
const FILTERS: FilterOption[] = ['all', 'invited', 'accepted', 'declined'];
const FILTER_KEY: Record<FilterOption, string> = {
  all:      'invAll',
  invited:  'invInvited',
  accepted: 'invAccepted',
  declined: 'invDeclined',
};

// ─── Screen ───────────────────────────────────────────────────────────────────
export const InvitationsScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterOption>('all');
  const [responding, setResponding] = useState<string | null>(null);

  // ── Infinite query — 10 per page, newest first ──────────────────────────
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
  } = useInfiniteQuery({
    queryKey: ['my-invitations'],
    queryFn: ({ pageParam = 1 }) =>
      requirementsApi.getMyInvitations(pageParam as number, PAGE_LIMIT),
    getNextPageParam: (last) =>
      last.pagination && last.pagination.currentPage < last.pagination.totalPages
        ? last.pagination.currentPage + 1
        : undefined,
    initialPageParam: 1,
    staleTime: 60 * 1000,
  });

  // Mark seen on focus
  useFocusEffect(
    useCallback(() => {
      void requirementsApi.markInvitationsSeen().then(() => {
        void queryClient.invalidateQueries({ queryKey: ['invitation-unseen-count'] });
      });
    }, [queryClient]),
  );

  const respondMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'declined' }) =>
      requirementsApi.respondToInvitation(id, status),
    onMutate: ({ id }) => setResponding(id),
    onSuccess: (_, { status }) => {
      toast.success(status === 'accepted' ? `${t('invAccepted')}!` : `${t('invDeclined')}.`);
      void queryClient.invalidateQueries({ queryKey: ['my-invitations'] });
    },
    onError: () => toast.error(t('invLoadError')),
    onSettled: () => setResponding(null),
  });

  const handleAccept  = useCallback((id: string) => respondMutation.mutate({ id, status: 'accepted' }), [respondMutation]);
  const handleDecline = useCallback((id: string) => respondMutation.mutate({ id, status: 'declined' }), [respondMutation]);
  const handlePress   = useCallback((id: string) => navigation.navigate('RequirementDetail', { requirementId: id }), [navigation]);
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Flatten all pages and apply client-side filter
  const allInvitations: InvitedRequirement[] = (data?.pages ?? []).flatMap((p) => p.invitations ?? []);
  const filtered = filter === 'all'
    ? allInvitations
    : allInvitations.filter((i) => i.invitation?.status === filter);

  const renderItem = useCallback(({ item }: { item: InvitedRequirement }) => (
    <InvitationCard
      item={item}
      onAccept={handleAccept}
      onDecline={handleDecline}
      responding={responding}
      onPress={handlePress}
      t={t as (key: string, opts?: Record<string, unknown>) => string}
    />
  ), [handleAccept, handleDecline, responding, handlePress, t]);

  const ListFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={s.loadMore}>
        <ActivityIndicator size="small" color="#7C3AED" />
      </View>
    );
  }, [isFetchingNextPage]);

  return (
    <View style={[s.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title={t('jobInvitationsTitle')} onBack={() => navigation.goBack()} />

      {/* Filter chips */}
      <View style={[s.filterRow, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        {FILTERS.map((f) => {
          const active = filter === f;
          const count = f === 'all'
            ? allInvitations.length
            : allInvitations.filter((i) => i.invitation?.status === f).length;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[
                s.chip,
                active
                  ? { backgroundColor: '#7C3AED', borderColor: '#7C3AED' }
                  : { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
              activeOpacity={0.8}
            >
              <AppText style={[s.chipTxt, { color: active ? '#fff' : theme.colors.mutedText }]}>
                {t(FILTER_KEY[f])}{count > 0 ? ` (${count})` : ''}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading && !data ? (
        <View style={s.center}><ActivityIndicator size="large" color="#7C3AED" /></View>
      ) : isError ? (
        <View style={s.center}>
          <AppText style={[s.errorTxt, { color: theme.colors.danger }]}>{t('invLoadError')}</AppText>
          <TouchableOpacity onPress={() => void refetch()} style={s.retryBtn} activeOpacity={0.85}>
            <AppText style={s.retryTxt}>{t('retry')}</AppText>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <AppText style={{ fontSize: 52, marginBottom: 14 }}>📭</AppText>
          <AppText style={[s.emptyTitle, { color: theme.colors.text }]}>
            {filter === 'all' ? t('invNoTitle') : t('invNoFilter', { filter: t(FILTER_KEY[filter]) })}
          </AppText>
          <AppText style={[s.emptySub, { color: theme.colors.mutedText }]}>
            {filter === 'all' ? t('invEmptyMsg') : t('invNoFilterMsg', { filter: t(FILTER_KEY[filter]) })}
          </AppText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item._id)}
          renderItem={renderItem}
          ListFooterComponent={ListFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isFetchingNextPage}
              onRefresh={() => void refetch()}
              tintColor="#7C3AED"
              colors={['#7C3AED']}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container:  { flex: 1 },
  filterRow:  { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  chip:       { borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 6 },
  chipTxt:    { fontSize: 12, fontWeight: '700' },
  list:       { padding: 14, paddingTop: 10, paddingBottom: 40 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorTxt:   { fontSize: 14, fontWeight: '600' },
  retryBtn:   { backgroundColor: '#7C3AED', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  retryTxt:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptySub:   { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  loadMore:   { paddingVertical: 20, alignItems: 'center' },
});
