import React, { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useQuery } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { Badge } from '../../../shared/components/ui/Badge';
import { SectionHeader } from '../../../shared/components/ui/SectionHeader';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import type { JobRequirement } from '../../../shared/types/domain';

const FILTER_OPTIONS = ['all', 'open', 'invited', 'fulfilled', 'closed'] as const;
type FilterOption = typeof FILTER_OPTIONS[number];

export const InvitationsScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const [filter, setFilter] = useState<FilterOption>('all');

  const { data: requirements, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-requirements', filter],
    queryFn: () => requirementsApi.getMyRequirements(),
    staleTime: 60 * 1000,
  });

  const all: JobRequirement[] = requirements ?? [];
  const filtered = filter === 'all' ? all : all.filter((r) => r.status === filter);

  if (isLoading && !requirements) return <LoadingState message="Loading requirements…" />;
  if (isError) return <ErrorState title="Unable to Load Invitations" message="Could not fetch your job invitations. Please check your connection and try again." onRetry={() => void refetch()} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1338B0" />
      <ScreenHeader title="My Requirements" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTER_OPTIONS.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.filterChip,
              {
                backgroundColor: filter === f ? theme.colors.primary : theme.colors.card,
                borderColor: filter === f ? theme.colors.primary : theme.colors.border,
              },
            ]}
          >
            <AppText
              variant="caption"
              color={filter === f ? '#FFFFFF' : theme.colors.text}
              style={styles.chipText}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <EmptyState
          title="No requirements"
          message={filter === 'all' ? 'No requirements yet.' : `No ${filter} requirements.`}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => void refetch()} />
          }
          renderItem={({ item }) => (
            <AppCard style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.reqInfo}>
                  <AppText variant="label">{item.title}</AppText>
                  <AppText variant="caption" color={theme.colors.mutedText}>
                    {item.category} · {item.district}, {item.state}
                  </AppText>
                </View>
                <Badge label={item.status} variant={item.status === 'open' ? 'success' : 'warning'} />
              </View>

              <View style={[styles.detailRow, { borderTopColor: theme.colors.border }]}>
                <AppText variant="caption" color={theme.colors.mutedText}>
                  {item.workerCount} worker{item.workerCount !== 1 ? 's' : ''} · {item.createdAt.slice(0, 10)}
                </AppText>
              </View>
            </AppCard>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  filters: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipText: { fontWeight: '600' },
  list: { padding: 16, paddingTop: 4, paddingBottom: 40 },
  card: { marginBottom: 10 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reqInfo: { flex: 1, gap: 2 },
  detailRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
