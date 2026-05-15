import React, { useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { adminApi } from '../../../core/api/endpoints/adminApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { Badge } from '../../../shared/components/ui/Badge';
import { SectionHeader } from '../../../shared/components/ui/SectionHeader';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import type { Lead } from '../../../shared/types/domain';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'New', value: 'new' },
  { label: 'Called', value: 'called' },
  { label: 'Interested', value: 'interested' },
  { label: 'Registered', value: 'registered' },
  { label: 'Not Interested', value: 'not_interested' },
] as const;

type StatusFilter = typeof STATUS_FILTERS[number]['value'];

const statusVariant = (s?: string): 'success' | 'warning' | 'danger' | 'primary' => {
  if (!s) return 'warning';
  const l = s.toLowerCase();
  if (l === 'registered' || l === 'interested') return 'success';
  if (l === 'not_interested') return 'danger';
  if (l === 'called') return 'primary';
  return 'warning';
};

const fmtDate = (d: string): string => {
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

export const LeadsManagementScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [page] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-leads', statusFilter, page],
    queryFn: () => adminApi.getLeads({
      page,
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    staleTime: 30 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminApi.updateLeadStatus(id, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
    },
    onError: () => Alert.alert('Error', 'Could not update lead status.'),
  });

  const handleStatusChange = (lead: Lead, newStatus: string): void => {
    Alert.alert(`Mark as "${newStatus}"?`, `Update ${lead.name}'s status to ${newStatus}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Update', onPress: () => updateMutation.mutate({ id: lead.id, status: newStatus }) },
    ]);
  };

  if (isLoading) return <LoadingState message="Loading leads…" />;
  if (isError) return <ErrorState title="Unable to Load Leads" message="Could not fetch leads data. Please check your connection and try again." onRetry={() => void refetch()} />;

  const leads: Lead[] = data?.leads ?? [];
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
        <AppText variant="title">Leads</AppText>
        <AppText variant="caption" color={theme.colors.mutedText}>{total} total leads</AppText>
      </View>

      {/* Status Filters */}
      <SectionHeader title="Filter by Status" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            onPress={() => setStatusFilter(f.value)}
            style={[styles.chip, {
              backgroundColor: statusFilter === f.value ? theme.colors.primary : theme.colors.card,
              borderColor: statusFilter === f.value ? theme.colors.primary : theme.colors.border,
            }]}
          >
            <AppText variant="caption" color={statusFilter === f.value ? '#FFF' : theme.colors.text} style={styles.chipText}>
              {f.label}
            </AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <AppText variant="caption" color={theme.colors.mutedText} style={styles.resultCount}>
        Showing {leads.length} of {total}
      </AppText>

      {leads.length === 0 ? (
        <EmptyState title="No leads found" message="Try changing your filters." />
      ) : (
        leads.map((lead) => (
          <AppCard key={lead.id} style={styles.leadCard}>
            <TouchableOpacity onPress={() => setExpandedId(expandedId === lead.id ? null : lead.id)} activeOpacity={0.8}>
              <View style={styles.leadHeader}>
                <View style={styles.leadInitial}>
                  <AppText variant="label" color="#FFF">
                    {(lead.name ?? '?').charAt(0).toUpperCase()}
                  </AppText>
                </View>
                <View style={styles.leadInfo}>
                  <AppText variant="label" numberOfLines={1}>{lead.name}</AppText>
                  <AppText variant="caption" color={theme.colors.mutedText}>{lead.phone}</AppText>
                </View>
                <Badge label={lead.callStatus ?? 'new'} variant={statusVariant(lead.callStatus)} />
              </View>
            </TouchableOpacity>

            {/* Expanded: quick status actions */}
            {expandedId === lead.id && (
              <View style={[styles.expandedBlock, { borderTopColor: theme.colors.border }]}>
                <AppText variant="caption" color={theme.colors.mutedText} style={{ marginBottom: 8 }}>
                  Role: {lead.role ?? '—'} · {lead.createdAt ? fmtDate(lead.createdAt) : ''}
                </AppText>
                <AppText variant="caption" color={theme.colors.mutedText} style={{ marginBottom: 10 }}>
                  Update status:
                </AppText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {['called', 'interested', 'registered', 'not_interested'].map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => handleStatusChange(lead, s)}
                      style={[styles.statusBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                    >
                      <AppText variant="caption" color={theme.colors.text} style={{ fontWeight: '600', fontSize: 11 }}>
                        {s.replace('_', ' ').toUpperCase()}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </AppCard>
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
  leadCard: { padding: 0, marginBottom: 8, overflow: 'hidden' },
  leadHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  leadInitial: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center' },
  leadInfo: { flex: 1, gap: 2 },
  expandedBlock: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14 },
  statusBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
});
