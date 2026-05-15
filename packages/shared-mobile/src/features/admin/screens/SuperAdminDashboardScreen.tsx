import React, { useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQueries } from '@tanstack/react-query';
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

const YEARS = ['2024', '2025', '2026'] as const;
type Year = typeof YEARS[number];

const ROLE_CONFIG = [
  { key: 'Agent', label: 'Agents', color: '#6366F1' },
  { key: 'Employer', label: 'Employers', color: '#F59E0B' },
  { key: 'SelfWorker', label: 'Job Seekers', color: '#10B981' },
  { key: 'Worker', label: 'Workers', color: '#3B82F6' },
] as const;

export const SuperAdminDashboardScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const user = state.session?.user;
  const [selectedYear, setSelectedYear] = useState<Year>('2025');

  const [statsQuery, regQuery, unverifiedQuery] = useQueries({
    queries: [
      {
        queryKey: ['admin-dashboard'],
        queryFn: adminApi.getDashboardStats,
        staleTime: 3 * 60 * 1000,
      },
      {
        queryKey: ['superadmin-registrations', selectedYear],
        queryFn: () => adminApi.getRegistrationStats({ type: 'monthly', year: selectedYear }),
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ['admin-unverified'],
        queryFn: () => adminApi.getAllUsers({ page: 1, status: 'Unverified' }),
        staleTime: 60 * 1000,
      },
    ],
  });

  const isLoading = statsQuery.isLoading || regQuery.isLoading;
  const isError = statsQuery.isError;

  const handleRefresh = (): void => {
    void statsQuery.refetch();
    void regQuery.refetch();
    void unverifiedQuery.refetch();
  };

  if (isLoading) return <LoadingState message="Loading platform overview…" />;
  if (isError) return <ErrorState title="Dashboard Unavailable" message="Could not load platform overview. Please check your connection and try again." onRetry={handleRefresh} />;

  const stats = statsQuery.data;
  const summary = regQuery.data?.summary;
  const pendingUsers = (unverifiedQuery.data?.users ?? []).slice(0, 5);

  const totalUsers =
    (stats?.totalWorkers ?? 0) +
    (stats?.totalEmployers ?? 0) +
    (stats?.totalAgents ?? 0);

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
          <AppText variant="caption" color={theme.colors.mutedText}>Super Admin</AppText>
          <AppText variant="title">{user?.fullName ?? 'Super Admin'}</AppText>
        </View>
        <Avatar name={user?.fullName ?? 'SA'} size={46} color="#6366F1" />
      </View>

      {/* Platform Summary Banner */}
      <AppCard style={[styles.banner, { backgroundColor: '#1E1B4B' }]}>
        <AppText variant="caption" color="rgba(255,255,255,0.7)">Total Platform Users</AppText>
        <AppText variant="title" color="#FFFFFF" style={styles.bannerTotal}>
          {totalUsers.toLocaleString('en-IN')}
        </AppText>
        <View style={styles.bannerRow}>
          {ROLE_CONFIG.map((rc) => (
            <View key={rc.key} style={styles.bannerItem}>
              <AppText variant="title" color={rc.color} style={styles.bannerCount}>
                {(
                  rc.key === 'Agent'
                    ? stats?.totalAgents
                    : rc.key === 'Employer'
                      ? stats?.totalEmployers
                      : stats?.totalWorkers
                )?.toLocaleString('en-IN') ?? '—'}
              </AppText>
              <AppText variant="caption" color="rgba(255,255,255,0.6)" style={styles.bannerLabel}>
                {rc.label}
              </AppText>
            </View>
          ))}
        </View>
      </AppCard>

      {/* Platform Metrics */}
      <SectionHeader title="Platform Metrics" />
      <View style={styles.statsGrid}>
        <StatCard label="Requirements" value={stats?.totalRequirements ?? 0} color="#6366F1" />
        <StatCard label="Active" value={stats?.activeRequirements ?? 0} color="#10B981" />
        <StatCard label="Pending KYC" value={stats?.pendingKyc ?? 0} color="#F59E0B" />
        <StatCard label="Today Signups" value={stats?.todayRegistrations ?? 0} color="#3B82F6" />
        <StatCard label="This Week" value={stats?.weekRegistrations ?? 0} color="#8B5CF6" />
        <StatCard
          label="Revenue"
          value={`₹${(((stats?.totalRevenue ?? 0) / 1000)).toFixed(0)}k`}
          color="#10B981"
        />
      </View>

      {/* Registration Stats by Role */}
      <View style={styles.regHeader}>
        <SectionHeader title="Registrations" />
        <View style={styles.yearPills}>
          {YEARS.map((y) => (
            <TouchableOpacity
              key={y}
              onPress={() => setSelectedYear(y)}
              style={[
                styles.yearPill,
                {
                  backgroundColor: selectedYear === y ? '#6366F1' : theme.colors.card,
                  borderColor: selectedYear === y ? '#6366F1' : theme.colors.border,
                },
              ]}
            >
              <AppText
                variant="caption"
                color={selectedYear === y ? '#fff' : theme.colors.text}
                style={styles.yearText}
              >
                {y}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.regGrid}>
        {ROLE_CONFIG.map((rc) => {
          const count = summary?.[rc.key as keyof typeof summary] ?? 0;
          const maxCount = Math.max(
            summary?.Agent ?? 0,
            summary?.Employer ?? 0,
            summary?.SelfWorker ?? 0,
            summary?.Worker ?? 0,
            1
          );
          const pct = Math.round((count / maxCount) * 100);
          return (
            <AppCard key={rc.key} style={styles.regCard}>
              <View style={styles.regCardHeader}>
                <AppText variant="label">{rc.label}</AppText>
                <AppText variant="subtitle" color={rc.color} style={styles.regCount}>
                  {count.toLocaleString('en-IN')}
                </AppText>
              </View>
              <View style={[styles.barBg, { backgroundColor: theme.colors.border }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${pct}%` as `${number}%`, backgroundColor: rc.color },
                  ]}
                />
              </View>
              <AppText variant="caption" color={theme.colors.mutedText}>
                {pct}% of top role
              </AppText>
            </AppCard>
          );
        })}
      </View>

      {/* Pending KYC */}
      <SectionHeader title="Pending Verifications" actionLabel="See all" onAction={() => {}} />
      {pendingUsers.length === 0 ? (
        <AppCard>
          <AppText variant="body" color={theme.colors.mutedText}>No pending verifications.</AppText>
        </AppCard>
      ) : (
        pendingUsers.map((u) => (
          <AppCard key={u.id} style={styles.userCard}>
            <Avatar name={u.fullName} size={36} />
            <View style={styles.userInfo}>
              <AppText variant="label">{u.fullName}</AppText>
              <AppText variant="caption" color={theme.colors.mutedText}>
                {u.phone} · {u.role}
              </AppText>
            </View>
            <Badge label={u.kycStatus} variant="warning" />
          </AppCard>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: { gap: 2 },
  banner: { marginBottom: 20, padding: 20, borderRadius: 16 },
  bannerTotal: { fontSize: 36, lineHeight: 44, marginTop: 4, marginBottom: 16 },
  bannerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  bannerItem: { alignItems: 'center' },
  bannerCount: { fontSize: 20, lineHeight: 28 },
  bannerLabel: { marginTop: 2 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  regHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yearPills: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  yearPill: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  yearText: { fontWeight: '600' },
  regGrid: { gap: 10, marginBottom: 20 },
  regCard: { padding: 14 },
  regCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  regCount: { fontSize: 22, lineHeight: 28 },
  barBg: { height: 8, borderRadius: 4, marginBottom: 6 },
  barFill: { height: 8, borderRadius: 4 },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  userInfo: { flex: 1, gap: 2 },
});
