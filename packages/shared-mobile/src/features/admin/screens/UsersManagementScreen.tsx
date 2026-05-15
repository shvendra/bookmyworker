import React, { useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { adminApi } from '../../../core/api/endpoints/adminApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { Badge } from '../../../shared/components/ui/Badge';
import { SectionHeader } from '../../../shared/components/ui/SectionHeader';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import type { UserProfile } from '../../../shared/types/domain';
import type { MainStackParamList } from '../../../app/navigation/types';

const ROLE_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Agent', value: 'Agent' },
  { label: 'Employer', value: 'Employer' },
  { label: 'Worker', value: 'Worker' },
  { label: 'Self Worker', value: 'SelfWorker' },
  { label: 'KYC', value: 'KYC' },
] as const;

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Verified', value: 'Verified' },
  { label: 'Unverified', value: 'Unverified' },
  { label: 'Blocked', value: 'Block' },
] as const;

type RoleFilter = typeof ROLE_FILTERS[number]['value'];
type StatusFilter = typeof STATUS_FILTERS[number]['value'];

const roleColor: Record<string, string> = {
  agent: '#6366F1',
  employer: '#F59E0B',
  worker: '#3B82F6',
  selfworker: '#10B981',
  admin: '#EF4444',
  superadmin: '#7C3AED',
};

export const UsersManagementScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [page] = useState(1);

  const params = {
    page,
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-users', roleFilter, statusFilter, page],
    queryFn: () => adminApi.getAllUsers(params),
    staleTime: 30 * 1000,
  });

  if (isLoading) return <LoadingState message="Loading users…" />;
  if (isError) return <ErrorState title="Unable to Load Users" message="Could not fetch the user list. Please check your connection and try again." onRetry={() => void refetch()} />;

  const users: UserProfile[] = data?.users ?? [];
  const total = data?.total ?? 0;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void refetch()} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.pageHeader}>
        <AppText variant="title">Users</AppText>
        <AppText variant="caption" color={theme.colors.mutedText}>{total} total users</AppText>
      </View>

      {/* Role Filters */}
      <SectionHeader title="Filter by Role" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {ROLE_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            onPress={() => setRoleFilter(f.value)}
            style={[styles.chip, {
              backgroundColor: roleFilter === f.value ? theme.colors.primary : theme.colors.card,
              borderColor: roleFilter === f.value ? theme.colors.primary : theme.colors.border,
            }]}
          >
            <AppText variant="caption" color={roleFilter === f.value ? '#FFF' : theme.colors.text} style={styles.chipText}>
              {f.label}
            </AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Status Filters */}
      <SectionHeader title="Filter by Status" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            onPress={() => setStatusFilter(f.value)}
            style={[styles.chip, {
              backgroundColor: statusFilter === f.value ? '#6366F1' : theme.colors.card,
              borderColor: statusFilter === f.value ? '#6366F1' : theme.colors.border,
            }]}
          >
            <AppText variant="caption" color={statusFilter === f.value ? '#FFF' : theme.colors.text} style={styles.chipText}>
              {f.label}
            </AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results */}
      <AppText variant="caption" color={theme.colors.mutedText} style={styles.resultCount}>
        Showing {users.length} of {total}
      </AppText>

      {users.length === 0 ? (
        <EmptyState title="No users found" message="Try changing your filters." />
      ) : (
        users.map((u) => (
          <TouchableOpacity
            key={u.id}
            onPress={() => navigation.navigate('WorkerProfile', { workerId: u.id })}
            activeOpacity={0.8}
          >
            <AppCard style={styles.userCard}>
              <Avatar name={u.fullName} size={42} uri={u.profileImage} />
              <View style={styles.userInfo}>
                <AppText variant="label" numberOfLines={1}>{u.fullName}</AppText>
                <AppText variant="caption" color={theme.colors.mutedText}>
                  {u.phone || '—'}
                  {u.district ? ` · ${u.district}` : ''}
                </AppText>
                <AppText variant="caption" style={{ color: roleColor[u.role] ?? theme.colors.mutedText, fontWeight: '600', fontSize: 11 }}>
                  {u.role.toUpperCase()}
                </AppText>
              </View>
              <Badge
                label={u.kycStatus === 'verified' ? 'Verified' : u.kycStatus === 'rejected' ? 'Blocked' : 'Pending'}
                variant={u.kycStatus === 'verified' ? 'success' : u.kycStatus === 'rejected' ? 'danger' : 'warning'}
              />
            </AppCard>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  pageHeader: { marginBottom: 16, gap: 2 },
  filters: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  chip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  chipText: { fontWeight: '600' },
  resultCount: { marginBottom: 12 },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  userInfo: { flex: 1, gap: 2 },
});
