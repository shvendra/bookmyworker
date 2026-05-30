import React, { useCallback } from 'react';
import {
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { Badge } from '../../../shared/components/ui/Badge';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { useAppTheme } from '../../../core/theme';
import { agentApi } from '../../../core/api/endpoints/agentApi';
import type { WorkerItem } from '../../../core/api/endpoints/agentApi';
import type { MainStackParamList } from '../../../app/navigation/types';
import i18n from '../../../core/i18n';
import { getLocationStr } from '../../../shared/utils/labelUtils';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const fmtDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return ''; }
};

const WorkerCard = ({ worker }: { worker: WorkerItem }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const isVerified = worker.status === 'Verified';
  const skills = worker.areasOfWork?.slice(0, 2).map(s => s.replace(/_/g, ' ')).join(', ');

  return (
    <AppCard style={[styles.card, { borderColor: theme.colors.border }]}>
      <View style={styles.cardRow}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.primaryLight }]}>
          <AppText style={[styles.avatarText, { color: theme.colors.primary }]}>
            {worker.name.charAt(0).toUpperCase()}
          </AppText>
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.cardTop}>
            <AppText variant="label" style={styles.workerName} numberOfLines={1}>
              {worker.name}
            </AppText>
            <Badge
              label={isVerified ? 'Verified' : 'Pending'}
              variant={isVerified ? 'success' : 'warning'}
            />
          </View>
          <AppText variant="caption" color={theme.colors.mutedText} style={styles.cardMeta}>
            📱 {worker.phone}
          </AppText>
          {(worker.district || worker.state) && (
            <AppText variant="caption" color={theme.colors.mutedText}>
              📍 {getLocationStr({ district: worker.district, state: worker.state }, i18n.language, '')}
            </AppText>
          )}
          {skills ? (
            <AppText variant="caption" color={theme.colors.mutedText} numberOfLines={1}>
              🔧 {skills}
            </AppText>
          ) : null}
          <AppText variant="caption" color={theme.colors.mutedText} style={styles.cardDate}>
            Added {fmtDate(worker.createdAt)}
          </AppText>
        </View>
      </View>
    </AppCard>
  );
};

export const AgentWorkersScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['my-workers'],
    queryFn: ({ pageParam = 1 }) => agentApi.getMyWorkers({ page: pageParam as number, limit: 20 }),
    getNextPageParam: (last) => last.page < last.pages ? last.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 30 * 1000,
  });

  // Refetch when screen regains focus (e.g. after adding a worker)
  useFocusEffect(
    useCallback(() => {
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ['agent-stats'] });
    }, [refetch, queryClient])
  );

  const workers = data?.pages.flatMap((p) => p.workers) ?? [];
  const total   = data?.pages[0]?.total ?? 0;

  const isRefreshing = isLoading || isFetchingNextPage;

  if (isLoading) return <LoadingState message="Loading your workers…" />;
  if (isError) {
    return (
      <ErrorState
        title="Could not load workers"
        description="Check your connection and try again."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader
        title="My Workers"
        onBack={() => navigation.goBack()}
        rightIcon="➕"
        onRightPress={() => navigation.navigate('AddWorker')}
      />

      {/* Count bar */}
      <View style={[styles.countBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <AppText variant="caption" color={theme.colors.mutedText}>
          {total} worker{total !== 1 ? 's' : ''} registered
        </AppText>
        <TouchableOpacity
          onPress={() => navigation.navigate('AddWorker')}
          style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
          activeOpacity={0.8}
        >
          <AppText variant="caption" color="#FFFFFF" style={styles.addBtnText}>+ Add Worker</AppText>
        </TouchableOpacity>
      </View>

      {workers.length === 0 ? (
        <EmptyState
          icon="👷"
          title="No workers yet"
          message="Add workers to your team and track them here."
          action={
            <AppButton
              title="Add First Worker"
              onPress={() => navigation.navigate('AddWorker')}
              variant="primary"
              size="md"
            />
          }
        />
      ) : (
        <FlatList
          data={workers}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <WorkerCard worker={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => void refetch()} />
          }
          onEndReached={() => { if (hasNextPage) void fetchNextPage(); }}
          onEndReachedThreshold={0.4}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  countBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: { fontWeight: '700' },
  list: { padding: 12, gap: 10 },
  card: { padding: 12 },
  cardRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 18, fontWeight: '800' },
  cardInfo: { flex: 1, gap: 3 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  workerName: { flex: 1 },
  cardMeta: { marginTop: 2 },
  cardDate: { marginTop: 4 },
});
