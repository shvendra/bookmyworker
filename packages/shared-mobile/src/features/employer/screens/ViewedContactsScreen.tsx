import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../../shared/components/ui/AppText';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { useAppTheme } from '../../../core/theme';
import { useTranslation } from 'react-i18next';
import { contactViewsApi, type ContactViewItem } from '../../../core/api/endpoints/contactViewsApi';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'ViewedContacts'>;

const BRAND = '#1037A4';
const WHITE = '#FFFFFF';
const GREEN = '#059669';

const AVATAR_PALETTES = [
  { bg: '#EBF1FF', text: '#1A56DB' },
  { bg: '#F5F3FF', text: '#7C3AED' },
  { bg: '#ECFDF5', text: GREEN },
  { bg: '#FFF7ED', text: '#EA580C' },
  { bg: '#FEF2F2', text: '#DC2626' },
];

function formatRelative(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ContactCard({
  item,
  idx,
}: {
  item: ContactViewItem;
  idx: number;
}): React.JSX.Element {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const palette = AVATAR_PALETTES[idx % AVATAR_PALETTES.length]!;
  const isFree = item.countedAgainstQuota === false;

  const initials = (item.workerName || 'W')
    .split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();

  return (
    <View
      style={[card.wrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
    >
      <View style={[card.avatar, { backgroundColor: palette.bg }]}>
        <AppText style={[card.initials, { color: palette.text }]}>{initials}</AppText>
      </View>

      <View style={{ flex: 1 }}>
        <AppText style={[card.name, { color: theme.colors.text }]} numberOfLines={1}>
          {(item.workerName || 'Worker').replace(/\b\w/g, (c) => c.toUpperCase())}
        </AppText>
        {/* Worker phone intentionally NOT shown in history */}
        <AppText style={[card.meta, { color: theme.colors.mutedText }]} numberOfLines={2}>
          {t('vcLastViewed')}: {formatRelative(item.lastViewedAt)} · {t('vcViews', { count: item.viewCount || 1 })}
        </AppText>
      </View>

      <View style={[card.badge, { backgroundColor: isFree ? '#ECFDF5' : '#FEF2F2' }]}>
        <AppText style={[card.badgeTxt, { color: isFree ? GREEN : '#DC2626' }]}>
          {isFree ? t('vcFree') : t('vcCharged')}
        </AppText>
      </View>
    </View>
  );
}

const card = StyleSheet.create({
  wrap:     { borderRadius: 14, borderWidth: 1, marginBottom: 10, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  avatar:   { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 16, fontWeight: '800' },
  name:     { fontSize: 14, fontWeight: '800' },
  phone:    { fontSize: 12, marginTop: 2 },
  meta:     { fontSize: 11, marginTop: 2 },
  badge:    { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTxt: { fontSize: 10.5, fontWeight: '800' },
});

export const ViewedContactsScreen = ({ navigation }: Props): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  const query = useQuery({
    queryKey: ['my-contact-views'],
    queryFn: () => contactViewsApi.getMyViews(1, 100),
    staleTime: 60 * 1000,
    // Slow / flaky connections get a couple of automatic retries before we give
    // up and show the error state — instead of instantly looking "empty".
    retry: 2,
  });

  // Depending on the whole `query` object (a fresh reference every render) made
  // this focus effect re-subscribe on EVERY render — with `isStale` that turned
  // into a refetch loop, the cause of the screen "blinking". `refetch` is a
  // stable fn and `isStale` is a boolean, so the effect now settles.
  const { refetch, isStale } = query;
  useFocusEffect(
    useCallback(() => {
      if (isStale) void refetch();
    }, [isStale, refetch]),
  );

  const data = query.data;
  const items = data?.items ?? [];
  const summary = data?.summary;

  // Only a genuine "loaded, nothing there" shows the empty state. A first-load
  // failure (usually slow / no internet) shows a clear message + Retry instead
  // of the misleading "No worker profiles viewed yet".
  const showError = query.isError && items.length === 0;
  const showEmpty = query.isSuccess && items.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader title={t('vcTitle')} onBack={() => navigation.goBack()} />

      {/* Summary bar */}
      {summary && (
        <View style={[sc.summaryBar, { borderBottomColor: theme.colors.border }]}>
          <View style={[sc.summaryCell, { backgroundColor: theme.colors.primaryLight }]}>
            <AppText style={[sc.summaryNum, { color: theme.colors.primary }]}>{summary.totalUnique}</AppText>
            <AppText style={[sc.summaryLabel, { color: theme.colors.mutedText }]}>{t('vcSummaryUnique')}</AppText>
          </View>
          <View style={[sc.summaryCell, { backgroundColor: theme.colors.surface1 }]}>
            <AppText style={[sc.summaryNum, { color: theme.colors.text }]}>{summary.chargedUnique}</AppText>
            <AppText style={[sc.summaryLabel, { color: theme.colors.mutedText }]}>{t('vcSummaryCredits')}</AppText>
          </View>
          {summary.remainingContacts != null && (
            <View style={[sc.summaryCell, { backgroundColor: theme.colors.successLight }]}>
              <AppText style={[sc.summaryNum, { color: theme.colors.success }]}>{summary.remainingContacts}</AppText>
              <AppText style={[sc.summaryLabel, { color: theme.colors.mutedText }]}>{t('vcSummaryLeft')}</AppText>
            </View>
          )}
        </View>
      )}

      {query.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={BRAND} />
          <AppText style={[sc.loadingHint, { color: theme.colors.mutedText }]}>
            {t('vcLoading', { defaultValue: 'Loading your viewed profiles…' })}
          </AppText>
        </View>
      ) : showError ? (
        <ErrorState
          title={t('vcErrorTitle', { defaultValue: 'Couldn’t load this page' })}
          message={
            (query.error as { message?: string })?.message ||
            t('vcErrorNetwork', {
              defaultValue:
                'Your internet connection looks slow or unavailable. This does NOT mean you have no viewed profiles — please check your network and try again.',
            })
          }
          onRetry={() => void refetch()}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it._id}
          contentContainerStyle={[sc.listContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching}
              onRefresh={() => void refetch()}
              tintColor={BRAND}
            />
          }
          ListEmptyComponent={
            showEmpty ? (
              <View style={sc.emptyBox}>
                <AppText style={sc.emptyEmoji}>👁️</AppText>
                <AppText style={[sc.emptyTitle, { color: theme.colors.text }]}>{t('vcEmptyTitle')}</AppText>
                <AppText style={[sc.emptySub, { color: theme.colors.mutedText }]}>{t('vcEmptyDesc')}</AppText>
                <TouchableOpacity
                  onPress={() => navigation.navigate('WorkerSearch')}
                  style={sc.browseBtn}
                  activeOpacity={0.85}
                >
                  <AppText style={sc.browseBtnTxt}>{t('browseWorkers')}</AppText>
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => <ContactCard item={item} idx={index} />}
        />
      )}
    </View>
  );
};

const sc = StyleSheet.create({
  summaryBar:   { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 10, paddingHorizontal: 14, gap: 8 },
  summaryCell:  { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center', gap: 2 },
  summaryNum:   { fontSize: 18, fontWeight: '900' },
  summaryLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },

  listContent:  { padding: 14 },
  loadingHint:  { fontSize: 12, textAlign: 'center' },

  emptyBox:     { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 32, gap: 12 },
  emptyEmoji:   { fontSize: 48 },
  emptyTitle:   { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptySub:     { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  browseBtn:    { backgroundColor: BRAND, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 4 },
  browseBtnTxt: { color: WHITE, fontSize: 13, fontWeight: '800' },
});
