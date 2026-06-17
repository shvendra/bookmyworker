import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../shared/state/toast/ToastContext';
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
  alternate?: string;
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
  const toast = useToast();
  const queryClient = useQueryClient();

  // Manage-numbers modal: edit / swap a worker's primary & alternate numbers.
  const [managing, setManaging] = useState<{ id: string; name: string } | null>(null);
  const [primaryInput, setPrimaryInput] = useState('');
  const [alternateInput, setAlternateInput] = useState('');
  const [savingNumbers, setSavingNumbers] = useState(false);

  const openManage = (id: string, name: string, phone: string, alternate: string): void => {
    setManaging({ id, name });
    setPrimaryInput(phone ?? '');
    setAlternateInput(alternate ?? '');
  };
  const swapNumbers = (): void => {
    setPrimaryInput(alternateInput);
    setAlternateInput(primaryInput);
  };
  const saveNumbers = async (): Promise<void> => {
    if (!managing) return;
    const tenDigit = /^[6-9]\d{9}$/;
    if (!tenDigit.test(primaryInput)) { toast.error(t('mwInvalidPrimary'), t('mwNumbersUpdateFailTitle')); return; }
    if (alternateInput && !tenDigit.test(alternateInput)) { toast.error(t('mwInvalidAlternate'), t('mwNumbersUpdateFailTitle')); return; }
    if (alternateInput && alternateInput === primaryInput) { toast.error(t('mwSameNumbers'), t('mwNumbersUpdateFailTitle')); return; }
    setSavingNumbers(true);
    try {
      await agentApi.updateWorker(managing.id, { phone: primaryInput, alternate: alternateInput });
      toast.success(t('mwNumbersUpdated'), t('mwNumbersUpdatedTitle'));
      setManaging(null);
      await queryClient.invalidateQueries({ queryKey: ['my-workers'] });
      void refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? t('mwNumbersUpdateFail'), t('mwNumbersUpdateFailTitle'));
    } finally {
      setSavingNumbers(false);
    }
  };

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
                  {w.alternate ? (
                    <AppText variant="caption" color={theme.colors.mutedText} numberOfLines={1}>
                      {t('alternateNumber')}: {w.alternate}
                    </AppText>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => openManage(id, workerName(w), w.phone ?? '', w.alternate ?? '')}
                    style={[styles.manageBtn, { borderColor: theme.colors.primary }]}
                    activeOpacity={0.7}
                  >
                    <AppText variant="caption" color={theme.colors.primary} style={{ fontWeight: '700' }}>
                      {t('mwManageNumbers')}
                    </AppText>
                  </TouchableOpacity>
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

      {/* Manage numbers modal — edit / swap primary & alternate */}
      <Modal visible={!!managing} transparent animationType="slide" onRequestClose={() => setManaging(null)}>
        <View style={styles.mwOverlay}>
          <View style={[styles.mwSheet, { backgroundColor: theme.colors.card }]}>
            <AppText variant="label" style={{ marginBottom: 4 }}>{t('mwManageNumbers')}</AppText>
            <AppText variant="caption" color={theme.colors.mutedText} style={{ marginBottom: 12 }}>
              {t('mwPrimaryHint')}
            </AppText>

            <AppText variant="caption" color={theme.colors.mutedText} style={{ marginBottom: 4 }}>{t('mwPrimaryNumber')}</AppText>
            <TextInput
              value={primaryInput}
              onChangeText={(v) => setPrimaryInput(v.replace(/[^\d]/g, '').slice(0, 10))}
              keyboardType="phone-pad"
              maxLength={10}
              placeholder="9876543210"
              placeholderTextColor={theme.colors.mutedText}
              style={[styles.mwInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
            />

            <AppText variant="caption" color={theme.colors.mutedText} style={{ marginTop: 12, marginBottom: 4 }}>{t('alternateNumberOptional')}</AppText>
            <TextInput
              value={alternateInput}
              onChangeText={(v) => setAlternateInput(v.replace(/[^\d]/g, '').slice(0, 10))}
              keyboardType="phone-pad"
              maxLength={10}
              placeholder="9876543210"
              placeholderTextColor={theme.colors.mutedText}
              style={[styles.mwInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
            />

            <TouchableOpacity onPress={swapNumbers} style={styles.mwSwap} activeOpacity={0.7}>
              <AppText variant="caption" color={theme.colors.primary} style={{ fontWeight: '700' }}>⇅ {t('mwSwap')}</AppText>
            </TouchableOpacity>

            <View style={styles.mwActions}>
              <TouchableOpacity onPress={() => setManaging(null)} style={[styles.mwCancel, { borderColor: theme.colors.border }]} activeOpacity={0.7}>
                <AppText variant="caption" color={theme.colors.text} style={{ fontWeight: '700' }}>{t('mwCancel')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void saveNumbers()}
                disabled={savingNumbers}
                style={[styles.mwSave, { backgroundColor: theme.colors.primary, opacity: savingNumbers ? 0.6 : 1 }]}
                activeOpacity={0.85}
              >
                {savingNumbers
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <AppText variant="caption" color="#fff" style={{ fontWeight: '800' }}>{t('mwSaveNumbers')}</AppText>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  manageBtn: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  mwOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  mwSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 32 },
  mwInput: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  mwSwap: { alignSelf: 'center', paddingVertical: 12 },
  mwActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  mwCancel: { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  mwSave: { flex: 2, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
});
