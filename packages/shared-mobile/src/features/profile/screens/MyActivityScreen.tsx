import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { apiClient } from '../../../core/api/client';
import { AppText } from '../../../shared/components/ui/AppText';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';

interface ActivityItem {
  _id: string;
  action: string;
  entity: string;
  description?: string;
  createdAt: string;
}

interface ActivityPage {
  success: boolean;
  activities: ActivityItem[];
  total: number;
  page: number;
  totalPages: number;
}

const timeAgo = (date: string): string => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
};

const ACTION_COLOR: Record<string, { bg: string; color: string; border: string; symbol: string }> = {
  CREATE: { bg: '#dcfce7', color: '#16a34a', border: '#86efac', symbol: '+' },
  UPDATE: { bg: '#dbeafe', color: '#2563eb', border: '#93c5fd', symbol: '✎' },
  DELETE: { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5', symbol: '×' },
  VIEW:   { bg: '#f5f3ff', color: '#7c3aed', border: '#c4b5fd', symbol: '◉' },
  LOGIN:  { bg: '#f0fdf4', color: '#16a34a', border: '#86efac', symbol: '→' },
  LOGOUT: { bg: '#fff7ed', color: '#ea580c', border: '#fdba74', symbol: '←' },
};

const ActivityRow = React.memo(({ item }: { item: ActivityItem }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const cfg = ACTION_COLOR[item.action] ?? ACTION_COLOR.UPDATE;
  return (
    <View style={s.row}>
      <View style={[s.dot, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
        <AppText style={[s.dotTxt, { color: cfg.color }]}>{cfg.symbol}</AppText>
      </View>
      <View style={s.body}>
        <View style={s.topRow}>
          <View style={[s.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
            <AppText style={[s.badgeTxt, { color: cfg.color }]}>{item.action}</AppText>
          </View>
          <AppText style={[s.entity, { color: theme.colors.text }]}>{item.entity}</AppText>
        </View>
        <AppText style={s.desc} numberOfLines={2}>{item.description ?? item.action}</AppText>
        <AppText style={s.time}>{timeAgo(item.createdAt)}</AppText>
      </View>
    </View>
  );
});
ActivityRow.displayName = 'ActivityRow';

export const MyActivityScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const navigation = useNavigation();

  const query = useInfiniteQuery<ActivityPage>({
    queryKey: ['my-activity-full'],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await apiClient.get<ActivityPage>('/api/v1/activity/my', {
        params: { page: pageParam, limit: 20 },
      });
      return res.data;
    },
    getNextPageParam: (last) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
    initialPageParam: 1,
  });

  const HIDDEN_ACTIONS = new Set(['LOGIN', 'LOGOUT']);
  const allItems: ActivityItem[] = (query.data?.pages ?? [])
    .flatMap((p) => p.activities ?? [])
    .filter((a) => !HIDDEN_ACTIONS.has(a.action));

  const handleLoadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query]);

  const renderItem = useCallback(
    ({ item }: { item: ActivityItem }) => <ActivityRow item={item} />,
    [],
  );

  const renderFooter = useCallback(() => {
    if (!query.isFetchingNextPage) return null;
    return (
      <View style={s.loadMoreWrap}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }, [query.isFetchingNextPage, theme.colors.primary]);

  const renderEmpty = useCallback(() => {
    if (query.isLoading) return null;
    return (
      <View style={s.empty}>
        <AppText style={s.emptyIcon}>📋</AppText>
        <AppText style={s.emptyTitle}>No activity yet</AppText>
        <AppText style={s.emptySub}>Actions you take in the app will appear here.</AppText>
      </View>
    );
  }, [query.isLoading]);

  return (
    <View style={[s.root, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title="My Activity" onBack={() => navigation.goBack()} />

      {query.isLoading ? (
        <View style={s.loadWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={allItems}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          contentContainerStyle={allItems.length === 0 ? s.emptyContainer : s.list}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && !query.isFetchingNextPage}
              onRefresh={() => void query.refetch()}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={[s.separator, { backgroundColor: theme.colors.border }]} />}
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  root:         { flex: 1 },
  loadWrap:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:         { paddingBottom: 40 },
  emptyContainer: { flex: 1 },

  row:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  dot:    { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dotTxt: { fontSize: 15, fontWeight: '700', lineHeight: 18 },
  body:   { flex: 1, gap: 3 },

  topRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge:    { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  badgeTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  entity:   { fontSize: 13, fontWeight: '700', color: '#0f172a', flex: 1 },
  desc:     { fontSize: 12, color: '#475569', lineHeight: 17 },
  time:     { fontSize: 11, color: '#94a3b8' },

  separator:    { height: StyleSheet.hairlineWidth, marginLeft: 62 },
  loadMoreWrap: { paddingVertical: 16, alignItems: 'center' },

  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  emptyIcon:  { fontSize: 48, lineHeight: 56 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  emptySub:   { fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 19 },
});
