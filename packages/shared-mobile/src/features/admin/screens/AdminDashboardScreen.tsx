import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { adminApi } from '../../../core/api/endpoints/adminApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { StatCard } from '../../../shared/components/ui/StatCard';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { Badge } from '../../../shared/components/ui/Badge';
import { SectionHeader } from '../../../shared/components/ui/SectionHeader';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';

export const AdminDashboardScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const user = state.session?.user;

  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: adminApi.getDashboardStats,
    staleTime: 3 * 60 * 1000,
  });

  const { data: unverified, refetch: refetchUnverified } = useQuery({
    queryKey: ['admin-unverified'],
    queryFn: () => adminApi.getAllUsers({ page: 1, status: 'Unverified' }),
    staleTime: 60 * 1000,
  });

  const handleRefresh = (): void => {
    void refetch();
    void refetchUnverified();
  };

  if (isLoading) return <LoadingState message="Loading admin dashboard…" />;
  if (isError) return <ErrorState title="Dashboard Unavailable" message="Could not load dashboard data. Please check your connection and try again." onRetry={handleRefresh} />;

  const pendingUsers = (unverified?.users ?? []).slice(0, 5);

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <AppText variant="caption" color={theme.colors.mutedText}>Admin Console</AppText>
          <AppText variant="title">{user?.fullName ?? 'Admin'}</AppText>
        </View>
        <Avatar name={user?.fullName ?? 'A'} size={46} color={theme.colors.danger} />
      </View>

      {/* Platform Health */}
      <AppCard style={[styles.healthCard, { backgroundColor: theme.colors.primary }]}>
        <AppText variant="label" color="#FFFFFF">Platform Health</AppText>
        <View style={styles.healthRow}>
          <View style={styles.healthItem}>
            <AppText variant="title" color="#FFFFFF">
              {stats?.totalWorkers?.toLocaleString('en-IN') ?? '—'}
            </AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.75)">Workers</AppText>
          </View>
          <View style={styles.healthItem}>
            <AppText variant="title" color="#FFFFFF">
              {stats?.totalEmployers?.toLocaleString('en-IN') ?? '—'}
            </AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.75)">Employers</AppText>
          </View>
          <View style={styles.healthItem}>
            <AppText variant="title" color="#FFFFFF">
              {stats?.totalAgents?.toLocaleString('en-IN') ?? '—'}
            </AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.75)">Agents</AppText>
          </View>
        </View>
      </AppCard>

      {/* Stats Grid */}
      <SectionHeader title="Metrics" />
      <View style={styles.statsGrid}>
        <StatCard
          label="Total Requirements"
          value={stats?.totalRequirements ?? 0}
          color={theme.colors.primary}
        />
        <StatCard
          label="Active"
          value={stats?.activeRequirements ?? 0}
          color={theme.colors.success}
        />
        <StatCard
          label="Pending KYC"
          value={stats?.pendingKyc ?? 0}
          color={theme.colors.warning}
        />
        <StatCard
          label="Today's Signups"
          value={stats?.todayRegistrations ?? 0}
          color={theme.colors.secondary}
        />
        <StatCard
          label="This Week"
          value={stats?.weekRegistrations ?? 0}
          color={theme.colors.primary}
        />
        <StatCard
          label="Revenue"
          value={`₹${((stats?.totalRevenue ?? 0) / 1000).toFixed(0)}k`}
          color={theme.colors.success}
        />
      </View>

      {/* Pending KYC */}
      <SectionHeader
        title="Pending Verifications"
        actionLabel="See all"
        onAction={() => {}}
      />
      {pendingUsers.length === 0 ? (
        <AppCard>
          <AppText variant="body" color={theme.colors.mutedText}>
            No pending verifications.
          </AppText>
        </AppCard>
      ) : (
        pendingUsers.map((u) => (
          <AppCard key={u.id}>
            <View style={styles.userRow}>
              <Avatar name={u.fullName} size={36} />
              <View style={styles.userInfo}>
                <AppText variant="label">{u.fullName}</AppText>
                <AppText variant="caption" color={theme.colors.mutedText}>
                  {u.phone} · {u.role}
                </AppText>
              </View>
              <Badge label={u.kycStatus} variant="warning" />
            </View>
          </AppCard>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: { gap: 2 },
  healthCard: {
    marginBottom: 20,
    padding: 16,
  },
  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  healthItem: { alignItems: 'center' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userInfo: { flex: 1, gap: 2 },
});
