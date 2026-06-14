import React, { useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { agentApi } from '../../../core/api/endpoints/agentApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { Badge } from '../../../shared/components/ui/Badge';
import { SectionHeader } from '../../../shared/components/ui/SectionHeader';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import type { MainStackParamList } from '../../../app/navigation/types';
import { useTranslation } from 'react-i18next';
import i18n from '../../../core/i18n';
import { getLocationStr } from '../../../shared/utils/labelUtils';
import { parseAreasOfWork, subcatDisplay } from '../../../shared/data/categoryLabels';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Verified', value: 'verified' },
  { label: 'Pending', value: 'pending' },
] as const;

type Filter = typeof FILTERS[number]['value'];

interface RawWorker {
  _id?: string;
  id?: string;
  name?: string;
  fullName?: string;
  phone?: string;
  status?: string;
  state?: string;
  district?: string;
  categories?: string[];
  areasOfWork?: string[];
  profilePhoto?: string;
  createdAt?: string;
}

const workerName = (w: RawWorker): string => w.fullName ?? w.name ?? '—';
const workerStatus = (w: RawWorker): string => w.status?.toLowerCase() ?? 'pending';
const workerLocation = (w: RawWorker): string =>
  getLocationStr({ district: w.district, state: w.state }, i18n.language, '—');
const workerWork = (worker) => {
  const data = worker?.areasOfWork || worker?.skills; // Or however you pull it
  if (!data) return '—';
  
  if (Array.isArray(data)) {
    return data.join(', ');
  }
  
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed.join(', ');
    }
  } catch {
    // If it's a comma-separated string already, just clean up loose brackets/quotes
  }
  
  return String(data).replace(/[\[\]"']/g, '').trim() || '—';
};

export const MyWorkersScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const { state } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const user = state.session?.user;
  const [filter, setFilter] = useState<Filter>('all');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-workers'],
    queryFn: () => agentApi.getMyWorkers(),
    staleTime: 60 * 1000,
  });

  if (isLoading) return <LoadingState message="Loading workers…" />;
  if (isError) return <ErrorState title="Unable to Load Workers" message="Could not fetch your workers list. Please check your connection and try again." onRetry={() => void refetch()} />;

  const rawWorkers: RawWorker[] = (data?.myJobs ?? data?.workers ?? data?.data ?? []) as RawWorker[];

  const filtered = filter === 'all'
    ? rawWorkers
    : rawWorkers.filter((w) => {
        const s = workerStatus(w);
        if (filter === 'verified') return s === 'verified';
        return s !== 'verified';
      });

  const stats = {
    total: rawWorkers.length,
    verified: rawWorkers.filter((w) => workerStatus(w) === 'verified').length,
    pending: rawWorkers.filter((w) => workerStatus(w) !== 'verified').length,
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title="My Workers" onBack={() => navigation.goBack()} />
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void refetch()} />}
      showsVerticalScrollIndicator={false}
    >

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.statChip, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }]}>
          <AppText variant="title" color={theme.colors.primary} style={styles.statNum}>{stats.total}</AppText>
          <AppText variant="caption" color={theme.colors.mutedText}>Total</AppText>
        </View>
        <View style={[styles.statChip, { backgroundColor: '#10B98115', borderColor: '#10B981' }]}>
          <AppText variant="title" color="#10B981" style={styles.statNum}>{stats.verified}</AppText>
          <AppText variant="caption" color={theme.colors.mutedText}>Verified</AppText>
        </View>
        <View style={[styles.statChip, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B' }]}>
          <AppText variant="title" color="#F59E0B" style={styles.statNum}>{stats.pending}</AppText>
          <AppText variant="caption" color={theme.colors.mutedText}>Pending</AppText>
        </View>
      </View>

      {/* Add Worker CTA */}
      <AppButton
        title="+ Register New Worker"
        onPress={() => navigation.navigate('AddWorker')}
        style={styles.addBtn}
      />

      {/* Filters */}
      <SectionHeader title="Worker List" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            onPress={() => setFilter(f.value)}
            style={[styles.filterChip, {
              backgroundColor: filter === f.value ? theme.colors.primary : theme.colors.card,
              borderColor: filter === f.value ? theme.colors.primary : theme.colors.border,
            }]}
          >
            <AppText variant="caption" color={filter === f.value ? '#FFF' : theme.colors.text} style={styles.filterText}>
              {f.label}
            </AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Worker Cards */}
      {filtered.length === 0 ? (
        <EmptyState
          title={filter === 'all' ? 'No workers yet' : `No ${filter} workers`}
          message={filter === 'all' ? 'Register your first worker to start earning commissions.' : `No workers with ${filter} status.`}
        />
      ) : (
        filtered.map((w, i) => {
          const id = w._id ?? w.id ?? String(i);
          const status = workerStatus(w);
          return (
            <TouchableOpacity
              key={id}
              onPress={() => navigation.navigate('WorkerProfile', { workerId: id })}
              activeOpacity={0.8}
            >
              <AppCard style={styles.workerCard}>
                <Avatar name={workerName(w)} size={44} uri={w.profilePhoto} />
                <View style={styles.workerInfo}>
                  <AppText variant="label" numberOfLines={2}>{workerName(w)}</AppText>
                  <AppText variant="caption" color={theme.colors.mutedText} numberOfLines={2}>
                    {w.phone ?? '—'} · {workerLocation(w)}
                  </AppText>
                 {workerWork(w) !== '—' && (
  <AppText variant="caption" color={theme.colors.mutedText} numberOfLines={2}>
    {/* Translate each stored skill/area to the active language (all 11 langs) */}
    {parseAreasOfWork(w.areasOfWork ?? (w as { skills?: unknown }).skills)
      .map(subcatDisplay)
      .join(', ')}
  </AppText>
)}
                </View>
                <Badge
                  label={status === 'verified' ? t('verified') : t('statusPending')}
                  variant={status === 'verified' ? 'success' : 'warning'}
                />
              </AppCard>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statChip: { flex: 1, alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingVertical: 12, gap: 2 },
  statNum: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  addBtn: { marginBottom: 20 },
  filters: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  filterChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  filterText: { fontWeight: '600' },
  workerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  workerInfo: { flex: 1, gap: 2 },
});
