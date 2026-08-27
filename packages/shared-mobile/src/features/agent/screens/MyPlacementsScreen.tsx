import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlert } from '../../../shared/state/alert/AppAlertContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import { useAppTheme } from '../../../core/theme';
import { useAuth } from '../../../state/auth/AuthContext';
import { placementApi } from '../../../core/api/endpoints/placementApi';
import type { Placement, PlacementStatus } from '../../../core/api/endpoints/placementApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtRate = (rate: number, type: 'Daily' | 'Monthly', dayLabel: string, monthLabel: string) =>
  `₹${rate.toLocaleString('en-IN')} / ${type === 'Daily' ? dayLabel : monthLabel}`;

// ── Placement card ────────────────────────────────────────────────────────────
const PlacementCard = React.memo(({
  item,
  onMarkComplete,
  onUploadProof,
  completing,
  statusLabel,
  statusColor,
  statusBg,
}: {
  item: Placement;
  onMarkComplete: (id: string) => void;
  onUploadProof: (id: string) => void;
  completing: boolean;
  statusLabel: string;
  statusColor: string;
  statusBg: string;
}) => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const isDark = theme.mode === 'dark';

  return (
    <View style={[styles.card, { backgroundColor: isDark ? theme.colors.card : '#fff', borderColor: isDark ? theme.colors.border : '#E8EEF6' }]}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
          <AppText style={[styles.statusText, { color: statusColor }]}>{statusLabel}</AppText>
        </View>
        {item.ernNumber ? (
          <AppText style={[styles.ernText, { color: theme.colors.mutedText }]}>ERN: {item.ernNumber}</AppText>
        ) : null}
      </View>

      {/* Worker */}
      <AppText style={[styles.workerName, { color: theme.colors.text }]}>{item.workerName}</AppText>
      {item.workerPhone ? (
        <AppText style={[styles.sub, { color: theme.colors.mutedText }]}>📞 {item.workerPhone}</AppText>
      ) : null}
      {item.workerSkill ? (
        <AppText style={[styles.sub, { color: theme.colors.mutedText }]}>🛠 {item.workerSkill}</AppText>
      ) : null}

      <View style={styles.divider} />

      {/* Details grid */}
      <View style={styles.detailGrid}>
        <View style={styles.detailItem}>
          <AppText style={[styles.detailLabel, { color: theme.colors.mutedText }]}>{t('pl_labelEmployer')}</AppText>
          <AppText style={[styles.detailValue, { color: theme.colors.text }]}>
            {item.employerName ?? '—'}
          </AppText>
        </View>
        <View style={styles.detailItem}>
          <AppText style={[styles.detailLabel, { color: theme.colors.mutedText }]}>{t('pl_labelRate')}</AppText>
          <AppText style={[styles.detailValue, { color: '#1037A4' }]}>
            {fmtRate(item.agreedRate, item.rateType, t('day', 'day'), t('month', 'month'))}
          </AppText>
        </View>
        <View style={styles.detailItem}>
          <AppText style={[styles.detailLabel, { color: theme.colors.mutedText }]}>{t('pl_labelJoined')}</AppText>
          <AppText style={[styles.detailValue, { color: theme.colors.text }]}>{fmtDate(item.joinedDate)}</AppText>
        </View>
        {item.district ? (
          <View style={styles.detailItem}>
            <AppText style={[styles.detailLabel, { color: theme.colors.mutedText }]}>{t('pl_labelLocation')}</AppText>
            <AppText style={[styles.detailValue, { color: theme.colors.text }]}>
              {item.district}{item.state ? `, ${item.state}` : ''}
            </AppText>
          </View>
        ) : null}
      </View>

      {/* Proof indicator */}
      {item.proofFileUrl ? (
        <View style={styles.proofRow}>
          <AppText style={styles.proofIcon}>📎</AppText>
          <AppText style={[styles.proofText, { color: '#15803D' }]}>{t('pl_proofUploaded')}</AppText>
        </View>
      ) : null}

      {/* Actions — only for active placements */}
      {item.status === 'active' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.proofBtn, { borderColor: '#1037A4' }]}
            onPress={() => onUploadProof(item._id)}
            activeOpacity={0.75}
          >
            <AppText style={[styles.actionBtnText, { color: '#1037A4' }]}>
              {item.proofFileUrl ? t('pl_updateProof') : t('pl_uploadProof')}
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.completeBtn, { backgroundColor: '#15803D' }]}
            onPress={() => onMarkComplete(item._id)}
            disabled={completing}
            activeOpacity={0.8}
          >
            <AppText style={styles.completeBtnText}>{t('pl_markDone')}</AppText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

// ── Screen ────────────────────────────────────────────────────────────────────
export const MyPlacementsScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { state } = useAuth();
  const isDark = theme.mode === 'dark';

  const [filter, setFilter] = useState<PlacementStatus | 'all'>('all');
  const [completingId, setCompletingId] = useState<string | null>(null);

  // Status config uses translated labels
  const STATUS_CONFIG: Record<PlacementStatus, { label: string; color: string; bg: string }> = {
    active:    { label: t('pl_statusActive'),    color: '#15803D', bg: '#DCFCE7' },
    completed: { label: t('pl_statusCompleted'), color: '#1D4ED8', bg: '#DBEAFE' },
    disputed:  { label: t('pl_statusDisputed'),  color: '#B91C1C', bg: '#FEE2E2' },
  };

  const FILTERS: { label: string; value: PlacementStatus | 'all' }[] = [
    { label: t('pl_filterAll'),       value: 'all' },
    { label: t('pl_filterActive'),    value: 'active' },
    { label: t('pl_filterCompleted'), value: 'completed' },
    { label: t('pl_filterDisputed'),  value: 'disputed' },
  ];

  const queryParams = filter === 'all' ? {} : { status: filter };

  const { data, isLoading, isError, refetch, isFetching, fetchStatus } = useQuery({
    queryKey: ['my-placements', filter],
    queryFn: () => placementApi.getMyPlacements(queryParams),
    staleTime: 30_000,
  });

  const completeMutation = useMutation({
    mutationFn: (placementId: string) => placementApi.markCompleted(placementId),
    onMutate: (id) => { setCompletingId(id); },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-placements'] });
      showAlert(t('pl_doneTitle'), t('pl_doneMsg'));
    },
    onError: () => showAlert(t('error', 'Error'), t('pl_errUpdateMsg')),
    onSettled: () => setCompletingId(null),
  });

  const uploadMutation = useMutation({
    mutationFn: async (placementId: string) => {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return null;
      const asset = result.assets[0];
      return placementApi.uploadProof(
        placementId,
        asset.uri,
        asset.name ?? 'proof',
        asset.mimeType ?? 'application/octet-stream',
      );
    },
    onSuccess: (data) => {
      if (!data) return;
      void queryClient.invalidateQueries({ queryKey: ['my-placements'] });
      showAlert(t('pl_uploadedTitle'), t('pl_uploadedMsg'));
    },
    onError: () => showAlert(t('error', 'Error'), t('pl_errUploadMsg')),
  });

  const handleMarkComplete = (id: string) => {
    showAlert(
      t('pl_confirmTitle'),
      t('pl_confirmMsg'),
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        { text: t('pl_confirmYes'), style: 'default', onPress: () => completeMutation.mutate(id) },
      ],
    );
  };

  const placements = data?.placements ?? [];
  const stats = data?.stats;

  return (
    <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F1F5F9' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <AppText style={styles.headerTitle}>{t('pl_title')}</AppText>
        <AppText style={styles.headerSub}>{t('pl_subtitle')}</AppText>

        {/* Stats row */}
        {stats && (
          <View style={styles.statsRow}>
            {[
              { label: t('pl_statTotal'),     value: stats.totalPlacements,     color: '#fff' },
              { label: t('pl_statActive'),    value: stats.activePlacements,    color: '#86EFAC' },
              { label: t('pl_statCompleted'), value: stats.completedPlacements, color: '#93C5FD' },
            ].map((s) => (
              <View key={s.label} style={styles.statBox}>
                <AppText style={[styles.statValue, { color: s.color }]}>{s.value}</AppText>
                <AppText style={styles.statLabel}>{s.label}</AppText>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Filter tabs */}
      <View style={[styles.filterRow, { backgroundColor: isDark ? theme.colors.surface : '#fff', borderBottomColor: isDark ? theme.colors.border : '#E8EEF6' }]}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.value}
            onPress={() => setFilter(f.value)}
            style={[styles.filterTab, filter === f.value && { borderBottomColor: '#1037A4', borderBottomWidth: 2 }]}
          >
            <AppText style={[styles.filterTabText, { color: filter === f.value ? '#1037A4' : theme.colors.mutedText }]}>
              {f.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      {isLoading ? (
        <LoadingState message={t('pl_loading')} />
      ) : isError || (fetchStatus === 'paused' && !data) ? (
        // paused+no-data means React Query never even attempted the request —
        // the device was offline before it ran, so it never became isError.
        // Without this it fell through to the empty-list view, misleadingly
        // showing "no placements" when the real problem was connectivity.
        <ErrorState title={t('pl_errTitle')} description={t('pl_errDesc')} onRetry={refetch} />
      ) : placements.length === 0 ? (
        <EmptyState
          icon="🤝"
          title={t('pl_emptyTitle')}
          description={t('pl_emptyDesc')}
        />
      ) : (
        <FlatList
          data={placements}
          keyExtractor={(p) => p._id}
          renderItem={({ item }) => {
            const cfg = STATUS_CONFIG[item.status];
            return (
              <PlacementCard
                item={item}
                onMarkComplete={handleMarkComplete}
                onUploadProof={(id) => uploadMutation.mutate(id)}
                completing={completingId === item._id}
                statusLabel={cfg.label}
                statusColor={cfg.color}
                statusBg={cfg.bg}
              />
            );
          }}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    backgroundColor: '#1037A4',
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 2 },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 14 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statBox:  { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 10, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  filterRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  filterTab: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  filterTabText: { fontSize: 11.5, fontWeight: '600' },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#1037A4',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusText:  { fontSize: 11, fontWeight: '700' },
  ernText:     { fontSize: 11, fontWeight: '600' },

  workerName: { fontSize: 17, fontWeight: '800', marginBottom: 2 },
  sub:        { fontSize: 12.5, marginBottom: 2 },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },

  detailGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailItem:  { width: '47%' },
  detailLabel: { fontSize: 11, fontWeight: '600', marginBottom: 1 },
  detailValue: { fontSize: 13, fontWeight: '700' },

  proofRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  proofIcon: { fontSize: 14 },
  proofText: { fontSize: 12, fontWeight: '600' },

  actions:     { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn:   { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  proofBtn:    { borderWidth: 1.5 },
  completeBtn: {},
  actionBtnText:   { fontSize: 13, fontWeight: '700' },
  completeBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
