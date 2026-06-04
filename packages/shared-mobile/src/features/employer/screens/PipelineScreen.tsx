import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal,
  Platform, RefreshControl, ScrollView, StatusBar, StyleSheet,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppText } from '../../../shared/components/ui/AppText';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useAppTheme } from '../../../core/theme';
import { useAuth } from '../../../state/auth/AuthContext';
import { apiClient } from '../../../core/api/client';
import { usePlanFeatures } from '../../../core/hooks/usePlanFeatures';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { RawRequirement } from '../../../core/api/endpoints/requirementsApi';
import { workerMappingApi, type WorkerMapping } from '../../../core/api/endpoints/workerMappingApi';
import { useTranslation } from 'react-i18next';
import type { MainStackParamList } from '../../../app/navigation/types';
import i18n from '../../../core/i18n';
import { getLocationStr } from '../../../shared/utils/labelUtils';
import { subcatDisplay } from '../../../shared/data/categoryLabels';

type Props = NativeStackScreenProps<MainStackParamList, 'EmployerPipeline'>;

const BRAND = '#1037A4';
type StageKey = 'Shortlisted' | 'Selected' | 'Joined';
type Counts = Record<StageKey, number>;

interface UserProfile {
  isSubscribed?: boolean;
  subscriptionExpery?: string;
  planFeatures?: { pipelineEnabled?: boolean };
}

function deriveStage(req: RawRequirement, counts: Counts): number {
  const s = (req.status ?? '').toLowerCase();
  if (s === 'completed') return 4;
  if (counts.Joined > 0) return 3;
  if (counts.Shortlisted > 0 || counts.Selected > 0) return 2;
  if ((req.intrestedAgents ?? []).length > 0) return 1;
  return 0;
}

// ─── Progress stepper ─────────────────────────────────────────────────────────
const PipelineStepper = ({ activeIdx }: { activeIdx: number }): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const pipeLabels = [t('stagePosted'), t('stageResponding'), t('stageShortlisted'), t('stageHired'), t('stageCompleted')];
  return (
    <View style={[ps.wrap, { backgroundColor: theme.colors.surface1 }]}>
      {pipeLabels.map((label, i) => {
        const done    = i < activeIdx;
        const current = i === activeIdx;
        const filled  = done || current;
        const leftLine  = i > 0 ? (done || current ? BRAND : theme.colors.border) : 'transparent';
        const rightLine = i < pipeLabels.length - 1 ? (done ? BRAND : theme.colors.border) : 'transparent';
        return (
          <View key={label} style={ps.step}>
            <View style={ps.connRow}>
              <View style={[ps.line, { backgroundColor: leftLine }]} />
              <View style={[ps.circle, {
                backgroundColor: filled ? BRAND : theme.colors.surface,
                borderColor:     filled ? BRAND : theme.colors.border,
              }]}>
                <AppText style={[ps.circleNum, { color: filled ? '#fff' : theme.colors.mutedText }]}>
                  {done ? '✓' : String(i + 1)}
                </AppText>
              </View>
              <View style={[ps.line, { backgroundColor: rightLine }]} />
            </View>
            <AppText style={[ps.label, {
              color:      current ? BRAND : done ? theme.colors.textSecondary : theme.colors.mutedText,
              fontWeight: current ? '800' : '600',
            }]} numberOfLines={1}>
              {label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
};
const ps = StyleSheet.create({
  wrap:      { flexDirection: 'row', borderRadius: 10, padding: 10, marginVertical: 2 },
  step:      { flex: 1, alignItems: 'center' },
  connRow:   { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 4 },
  line:      { flex: 1, height: 2 },
  circle:    { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  circleNum: { fontSize: 8, fontWeight: '900', lineHeight: 10 },
  label:     { fontSize: 8, textAlign: 'center', lineHeight: 12, letterSpacing: 0.1 },
});

// ─── Worker row ───────────────────────────────────────────────────────────────
interface WorkerRowProps {
  worker: WorkerMapping;
  onSelect: () => void;
  onJoin: () => void;
  onRevert: () => void;
  onRemove: () => void;
  busy: boolean;
}

const statusConfig = {
  Shortlisted: { color: '#2563eb', bg: '#eff6ff', labelKey: 'shortlisted' },
  Selected:    { color: '#7c3aed', bg: '#f5f3ff', labelKey: 'selected' },
  Joined:      { color: '#059669', bg: '#ecfdf5', labelKey: 'joined' },
} as const;

// Pipeline stage → existing i18n key (all 11 locales). Reused for the global
// totals cards, the per-requirement count pills and the worker status badges.
const STAGE_TKEY: Record<string, string> = {
  Interested: 'ws_outcome_interested',
  Shortlisted: 'shortlisted',
  Selected: 'selected',
  Joined: 'joined',
};

// Backend requirement status → existing i18n key (all 11 locales).
const REQ_STATUS_TKEY: Record<string, string> = {
  open: 'statusOpen',
  pending: 'statusPending',
  closed: 'statusClosed',
  expired: 'statusClosed',
  completed: 'stageCompleted',
  assigned: 'statusOngoing',
  ongoing: 'statusOngoing',
};

const WorkerRow = ({ worker, onSelect, onJoin, onRevert, onRemove, busy }: WorkerRowProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const sc = statusConfig[worker.status];
  const initials = worker.workerName
    .split(' ').filter(Boolean).slice(0, 2)
    .map(w => w[0]).join('').toUpperCase();

  const rateInfo = worker.status === 'Joined' && worker.agreedRate
    ? `₹${worker.agreedRate}${worker.rateType === 'Daily' ? t('perDay') : t('perMonth')}`
    : null;

  return (
    <View style={[wr.row, { borderBottomColor: theme.colors.border }]}>
      {/* Avatar */}
      <View style={[wr.avatar, { backgroundColor: BRAND + '18' }]}>
        <AppText style={[wr.avatarTxt, { color: BRAND }]}>{initials || '?'}</AppText>
      </View>

      {/* Name + skill */}
      <View style={wr.info}>
        <AppText style={[wr.name, { color: theme.colors.text }]} numberOfLines={1}>
          {worker.workerName}
        </AppText>
        <AppText style={[wr.skill, { color: theme.colors.mutedText }]} numberOfLines={1}>
          {[worker.workerSkill ? subcatDisplay(worker.workerSkill) : t('rd_workerFallback'), rateInfo].filter(Boolean).join(' · ')}
        </AppText>
      </View>

      {/* Status + actions */}
      <View style={wr.right}>
        <View style={[wr.badge, { backgroundColor: sc.bg }]}>
          <AppText style={[wr.badgeTxt, { color: sc.color }]}>{t(sc.labelKey)}</AppText>
        </View>

        <View style={wr.btnRow}>
          {worker.status === 'Shortlisted' && (
            <>
              <TouchableOpacity
                onPress={onSelect} disabled={busy}
                style={[wr.btn, { backgroundColor: BRAND }]}
                activeOpacity={0.8}
              >
                <AppText style={wr.btnWhite}>{t('pipelineSelectBtn')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onRemove} disabled={busy}
                style={[wr.btn, { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5' }]}
                activeOpacity={0.8}
              >
                <AppText style={[wr.btnColored, { color: '#dc2626' }]}>✕</AppText>
              </TouchableOpacity>
            </>
          )}

          {worker.status === 'Selected' && (
            <>
              <TouchableOpacity
                onPress={onJoin} disabled={busy}
                style={[wr.btn, { backgroundColor: '#059669' }]}
                activeOpacity={0.8}
              >
                <AppText style={wr.btnWhite}>{t('pipelineJoinBtn')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onRevert} disabled={busy}
                style={[wr.btn, { backgroundColor: theme.colors.surface1, borderWidth: 1, borderColor: theme.colors.border }]}
                activeOpacity={0.8}
              >
                <AppText style={[wr.btnColored, { color: theme.colors.textSecondary }]}>{t('pipelineUnselect')}</AppText>
              </TouchableOpacity>
            </>
          )}

          {worker.status === 'Joined' && (
            <TouchableOpacity
              onPress={onRevert} disabled={busy}
              style={[wr.btn, { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fdba74' }]}
              activeOpacity={0.8}
            >
              <AppText style={[wr.btnColored, { color: '#c2410c' }]}>{t('pipelineUnjoin')}</AppText>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const wr = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  avatar:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt: { fontSize: 13, fontWeight: '800' },
  info:      { flex: 1, minWidth: 0 },
  name:      { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  skill:     { fontSize: 11, marginTop: 2, lineHeight: 15 },
  right:     { alignItems: 'flex-end', gap: 5, flexShrink: 0 },
  badge:     { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt:  { fontSize: 10, fontWeight: '700' },
  btnRow:    { flexDirection: 'row', gap: 5 },
  btn:       { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  btnWhite:  { fontSize: 10, fontWeight: '800', color: '#fff' },
  btnColored:{ fontSize: 10, fontWeight: '700' },
});

// ─── Requirement section (card + expandable workers) ─────────────────────────
interface ReqSectionProps {
  req: RawRequirement;
  counts: Counts;
  workers: WorkerMapping[];
  stageIdx: number;
  expanded: boolean;
  onToggle: () => void;
  onWorkerSelect: (w: WorkerMapping) => void;
  onWorkerJoin: (w: WorkerMapping) => void;
  onWorkerRevert: (w: WorkerMapping) => void;
  onWorkerRemove: (w: WorkerMapping) => void;
  busyId: string | null;
  onViewInterested: () => void;
}

const ReqSection = ({
  req, counts, workers, stageIdx, expanded, onToggle,
  onWorkerSelect, onWorkerJoin, onWorkerRevert, onWorkerRemove,
  busyId, onViewInterested,
}: ReqSectionProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  // Localize the work-type / sub-category to the active language (all 11) —
  // subcatDisplay falls back to readable Title Case for labels not in the catalog.
  const title = [req.workType, req.subCategory]
    .filter(Boolean)
    .map(s => subcatDisplay(String(s)))
    .join(' · ');
  const location = getLocationStr({ district: req.district, state: req.state }, i18n.language, '');
  const interestedCount = (req.intrestedAgents ?? []).length;
  const statusRaw = (req.status ?? '').toLowerCase();
  const isOpen = statusRaw !== 'closed' && statusRaw !== 'expired' && statusRaw !== 'completed';
  const statusColor = isOpen ? '#059669' : theme.colors.mutedText;
  const statusBg    = isOpen ? '#ecfdf5' : theme.colors.surface1;
  const totalPipelined = counts.Shortlisted + counts.Selected + counts.Joined;

  const countPills: { key: 'Interested' | 'Shortlisted' | 'Selected' | 'Joined'; count: number; color: string; bg: string }[] = [
    { key: 'Interested',  count: interestedCount,    color: '#d97706', bg: '#fffbeb' },
    { key: 'Shortlisted', count: counts.Shortlisted, color: '#2563eb', bg: '#eff6ff' },
    { key: 'Selected',    count: counts.Selected,    color: '#7c3aed', bg: '#f5f3ff' },
    { key: 'Joined',      count: counts.Joined,      color: '#059669', bg: '#ecfdf5' },
  ];

  return (
    <View style={[rs.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      {/* Header row */}
      <TouchableOpacity onPress={onToggle} activeOpacity={0.82} style={rs.headerRow}>
        <View style={{ flex: 1 }}>
          <AppText style={[rs.title, { color: theme.colors.text }]} numberOfLines={2}>
            {title || t('calRequirement')}
          </AppText>
          <AppText style={[rs.sub, { color: theme.colors.mutedText }]} numberOfLines={1}>
            {req.ERN_NUMBER ? `ERN ${req.ERN_NUMBER}` : ''}
            {req.ERN_NUMBER && location ? '  ·  ' : ''}
            {location}
          </AppText>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <View style={[rs.statusBadge, { backgroundColor: statusBg }]}>
            <View style={[rs.statusDot, { backgroundColor: statusColor }]} />
            <AppText style={[rs.statusTxt, { color: statusColor }]}>{t(REQ_STATUS_TKEY[statusRaw] ?? 'statusOpen')}</AppText>
          </View>
          {totalPipelined > 0 && (
            <AppText style={[rs.pipeCount, { color: theme.colors.mutedText }]}>
              {t('pipelineWorkersInPipeline', { count: totalPipelined })}
            </AppText>
          )}
        </View>
      </TouchableOpacity>

      {/* Stepper */}
      <PipelineStepper activeIdx={stageIdx} />

      {/* Count pills */}
      <View style={rs.pillsRow}>
        {countPills.map(p => (
          <View key={p.key} style={[rs.pill, { backgroundColor: p.bg }]}>
            <AppText style={[rs.pillNum, { color: p.color }]}>{p.count}</AppText>
            <AppText style={[rs.pillLabel, { color: p.color }]}>{t(STAGE_TKEY[p.key])}</AppText>
          </View>
        ))}
      </View>

      {/* Expand/collapse toggle */}
      <TouchableOpacity
        onPress={onToggle}
        style={[rs.toggleRow, { borderTopColor: theme.colors.border }]}
        activeOpacity={0.75}
      >
        <AppText style={[rs.toggleTxt, { color: BRAND }]}>
          {expanded ? t('pipelineCollapseWorkers') : t('pipelineExpandWorkers')}
        </AppText>
        <AppText style={{ color: BRAND, fontSize: 12 }}>{expanded ? '▲' : '▼'}</AppText>
      </TouchableOpacity>

      {/* Workers list */}
      {expanded && (
        <View style={rs.workersList}>
          {workers.length === 0 ? (
            <View style={rs.emptyWorkers}>
              <AppText style={[rs.emptyTxt, { color: theme.colors.mutedText }]}>
                {t('pipelineNoWorkers')}
              </AppText>
              {interestedCount > 0 && (
                <TouchableOpacity onPress={onViewInterested} style={rs.viewInterestedBtn} activeOpacity={0.8}>
                  <AppText style={rs.viewInterestedTxt}>{t('pipelineViewInterested')}</AppText>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {workers.map(w => (
                <WorkerRow
                  key={w._id}
                  worker={w}
                  onSelect={() => onWorkerSelect(w)}
                  onJoin={() => onWorkerJoin(w)}
                  onRevert={() => onWorkerRevert(w)}
                  onRemove={() => onWorkerRemove(w)}
                  busy={busyId === w._id}
                />
              ))}
              {interestedCount > 0 && (
                <TouchableOpacity onPress={onViewInterested} style={rs.viewMoreBtn} activeOpacity={0.8}>
                  <AppText style={[rs.viewMoreTxt, { color: BRAND }]}>
                    {`${interestedCount} ${t('ws_outcome_interested')} · ${t('viewAll')}`}
                  </AppText>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
};

const rs = StyleSheet.create({
  card:         { borderRadius: 18, borderWidth: 1, marginBottom: 12, padding: 14, gap: 10, elevation: 2, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  headerRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title:        { fontSize: 14, fontWeight: '800', lineHeight: 20 },
  sub:          { fontSize: 11.5, marginTop: 3 },
  statusBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusDot:    { width: 6, height: 6, borderRadius: 3 },
  statusTxt:    { fontSize: 10, fontWeight: '700' },
  pipeCount:    { fontSize: 10, fontWeight: '600' },
  pillsRow:     { flexDirection: 'row', gap: 6 },
  pill:         { flex: 1, borderRadius: 10, alignItems: 'center', paddingVertical: 7, gap: 1 },
  pillNum:      { fontSize: 15, fontWeight: '900', lineHeight: 19 },
  pillLabel:    { fontSize: 7.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },
  toggleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  toggleTxt:    { fontSize: 11, fontWeight: '700' },
  workersList:  { gap: 0, paddingTop: 4 },
  emptyWorkers: { alignItems: 'center', paddingVertical: 14, gap: 8 },
  emptyTxt:     { fontSize: 12, fontWeight: '500', textAlign: 'center' },
  viewInterestedBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: BRAND },
  viewInterestedTxt: { fontSize: 11, fontWeight: '700', color: '#fff' },
  viewMoreBtn:  { paddingVertical: 10, alignItems: 'center' },
  viewMoreTxt:  { fontSize: 11.5, fontWeight: '700' },
});

// ─── Join rate modal ───────────────────────────────────────────────────────────
interface JoinModalState {
  mappingId: string;
  workerName: string;
}
interface JoinModalProps {
  state: JoinModalState;
  onConfirm: (agreedRate: number, rateType: 'Daily' | 'Monthly') => void;
  onClose: () => void;
}

const JoinRateModal = ({ state, onConfirm, onClose }: JoinModalProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const insets = useSafeAreaInsets();
  const [rate, setRate] = useState('');
  const [rateType, setRateType] = useState<'Daily' | 'Monthly'>('Daily');

  const handleConfirm = () => {
    const parsed = parseFloat(rate);
    if (!parsed || parsed <= 0) {
      Alert.alert(t('error'), t('pipelineJoinRateRequired'));
      return;
    }
    onConfirm(parsed, rateType);
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={jm.overlay}
      >
        <View style={[jm.sheet, { backgroundColor: theme.colors.card, paddingBottom: insets.bottom + 16 }]}>
          {/* Handle */}
          <View style={[jm.handle, { backgroundColor: theme.colors.border }]} />

          <AppText style={[jm.title, { color: theme.colors.text }]}>{t('pipelineJoinModalTitle')}</AppText>
          <AppText style={[jm.desc, { color: theme.colors.mutedText }]}>
            {t('pipelineJoinModalDesc', { name: state.workerName })}
          </AppText>

          {/* Rate input */}
          <AppText style={[jm.label, { color: theme.colors.textSecondary }]}>{t('pipelineAgreedRateLabel')}</AppText>
          <TextInput
            style={[jm.input, { backgroundColor: theme.colors.surface1, borderColor: theme.colors.border, color: theme.colors.text }]}
            placeholder={t('pipelineAgreedRatePlaceholder')}
            placeholderTextColor={theme.colors.mutedText}
            keyboardType="numeric"
            value={rate}
            onChangeText={setRate}
          />

          {/* Rate type toggle */}
          <AppText style={[jm.label, { color: theme.colors.textSecondary }]}>{t('pipelineRateTypeDaily') + ' / ' + t('pipelineRateTypeMonthly')}</AppText>
          <View style={jm.toggleGroup}>
            {(['Daily', 'Monthly'] as const).map(rt => (
              <TouchableOpacity
                key={rt}
                onPress={() => setRateType(rt)}
                style={[jm.toggle, {
                  backgroundColor: rateType === rt ? BRAND : theme.colors.surface1,
                  borderColor: rateType === rt ? BRAND : theme.colors.border,
                }]}
                activeOpacity={0.8}
              >
                <AppText style={[jm.toggleTxt, { color: rateType === rt ? '#fff' : theme.colors.textSecondary }]}>
                  {rt === 'Daily' ? t('pipelineRateTypeDaily') : t('pipelineRateTypeMonthly')}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Actions */}
          <TouchableOpacity onPress={handleConfirm} style={[jm.confirmBtn, { backgroundColor: '#059669' }]} activeOpacity={0.85}>
            <AppText style={jm.confirmTxt}>{t('pipelineConfirmJoin')}</AppText>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} activeOpacity={0.75}>
            <AppText style={[jm.cancelTxt, { color: theme.colors.mutedText }]}>{t('cancel')}</AppText>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const jm = StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:      { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 10 },
  handle:     { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  title:      { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  desc:       { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  label:      { fontSize: 12, fontWeight: '700', marginTop: 6 },
  input:      { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontWeight: '600' },
  toggleGroup:{ flexDirection: 'row', gap: 10 },
  toggle:     { flex: 1, borderRadius: 10, borderWidth: 1.5, paddingVertical: 12, alignItems: 'center' },
  toggleTxt:  { fontSize: 14, fontWeight: '700' },
  confirmBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 10 },
  confirmTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  cancelTxt:  { textAlign: 'center', fontSize: 13, fontWeight: '600', paddingVertical: 10 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export const PipelineScreen = ({ navigation }: Props): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme }  = useAppTheme();
  const insets     = useSafeAreaInsets();
  const { state: authState } = useAuth();
  const userId = authState.session?.user?.id;
  const queryClient = useQueryClient();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [joinModal, setJoinModal] = useState<JoinModalState | null>(null);

  // ── Subscription & plan check ────────────────────────────────────────────
  const profileQuery = useQuery({
    queryKey: ['pipeline-profile'],
    queryFn: async () => {
      const res = await apiClient.get<{ user?: UserProfile }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const isSubscribed = (() => {
    const p = profileQuery.data;
    if (!p?.isSubscribed) return false;
    const exp = p.subscriptionExpery;
    if (!exp) return true;
    return new Date(exp).getTime() > Date.now();
  })();
  // Use the shared plan-features hook so pipelineEnabled resolves from the
  // employer tier (Contractor/Agency/Industry = true) when the backend user
  // doc omits the raw planFeatures flag — instead of defaulting to a false lock.
  const plan = usePlanFeatures();
  const pipelineEnabled = plan.pipelineEnabled;
  const hasAccess = isSubscribed && pipelineEnabled;

  // ── Data queries ─────────────────────────────────────────────────────────
  const reqListQuery = useQuery({
    queryKey: ['pipeline-req-list', userId],
    queryFn: () => requirementsApi.listForRole({ role: 'employer', userId: userId ?? '', limit: 50, page: 1 }),
    enabled: hasAccess && profileQuery.isSuccess && !!userId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const pipelineQuery = useQuery({
    queryKey: ['employer-pipeline-full'],
    queryFn: () => workerMappingApi.getEmployerPipelineOverview(),
    enabled: hasAccess && profileQuery.isSuccess,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // ── Merge requirements + pipeline data ──────────────────────────────────
  const pipelineByReqId = new Map(
    (pipelineQuery.data?.requirements ?? [])
      .filter(e => e.requirement != null)
      .map(e => [String(e.requirement._id), e]),
  );
  const mergedReqs = (reqListQuery.data?.requirements ?? []).map(req => {
    const entry   = pipelineByReqId.get(String(req._id));
    const counts  = entry?.counts  ?? { Shortlisted: 0, Selected: 0, Joined: 0 };
    const workers = entry?.workers ?? [];
    return { req, counts, workers, stageIdx: deriveStage(req, counts) };
  });
  const totals = pipelineQuery.data?.totals ?? { Shortlisted: 0, Selected: 0, Joined: 0 };

  // ── Mutations ────────────────────────────────────────────────────────────
  const invalidatePipeline = () => {
    void queryClient.invalidateQueries({ queryKey: ['employer-pipeline-full'] });
    void queryClient.invalidateQueries({ queryKey: ['pipeline-req-list'] });
  };

  const advanceMutation = useMutation({
    mutationFn: ({ mappingId, status, hireRate }: {
      mappingId: string;
      status: 'Selected' | 'Joined';
      hireRate?: { agreedRate: number; rateType: 'Daily' | 'Monthly' };
    }) => workerMappingApi.updateMappingStatus(mappingId, status, hireRate),
    onSuccess: () => { invalidatePipeline(); setBusyId(null); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update status.';
      Alert.alert(t('error'), msg);
      setBusyId(null);
    },
  });

  const revertMutation = useMutation({
    mutationFn: (mappingId: string) => workerMappingApi.revertMappingStatus(mappingId),
    onSuccess: () => {
      invalidatePipeline();
      setBusyId(null);
      Alert.alert('', t('pipelineRevertedSuccess'));
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to revert.';
      Alert.alert(t('error'), msg);
      setBusyId(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (mappingId: string) => workerMappingApi.removeShortlist(mappingId),
    onSuccess: () => {
      invalidatePipeline();
      setBusyId(null);
      Alert.alert('', t('pipelineRemovedSuccess'));
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to remove.';
      Alert.alert(t('error'), msg);
      setBusyId(null);
    },
  });

  // ── Worker action handlers ───────────────────────────────────────────────
  const handleSelect = (w: WorkerMapping) => {
    Alert.alert(
      t('pipelineConfirmSelectTitle'),
      t('pipelineConfirmSelectBody', { name: w.workerName }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('yesSelect'), onPress: () => {
            setBusyId(w._id);
            advanceMutation.mutate({ mappingId: w._id, status: 'Selected' });
          },
        },
      ],
    );
  };

  const handleJoin = (w: WorkerMapping) => {
    setJoinModal({ mappingId: w._id, workerName: w.workerName });
  };

  const handleJoinConfirm = (agreedRate: number, rateType: 'Daily' | 'Monthly') => {
    if (!joinModal) return;
    setJoinModal(null);
    setBusyId(joinModal.mappingId);
    advanceMutation.mutate({
      mappingId: joinModal.mappingId,
      status: 'Joined',
      hireRate: { agreedRate, rateType },
    });
  };

  const handleRevert = (w: WorkerMapping) => {
    const isJoined = w.status === 'Joined';
    Alert.alert(
      isJoined ? t('pipelineConfirmUnjoinTitle') : t('pipelineConfirmUnselectTitle'),
      isJoined ? t('pipelineConfirmUnjoinBody', { name: w.workerName }) : t('pipelineConfirmUnselectBody', { name: w.workerName }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('yesRevert'), onPress: () => {
            setBusyId(w._id);
            revertMutation.mutate(w._id);
          },
        },
      ],
    );
  };

  const handleRemove = (w: WorkerMapping) => {
    Alert.alert(
      t('pipelineConfirmRemoveTitle'),
      t('pipelineConfirmRemoveBody', { name: w.workerName }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('yesRemove'), style: 'destructive', onPress: () => {
            setBusyId(w._id);
            removeMutation.mutate(w._id);
          },
        },
      ],
    );
  };

  const toggleExpand = (reqId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(reqId)) next.delete(reqId);
      else next.add(reqId);
      return next;
    });
  };

  // ── Loading / refreshing ─────────────────────────────────────────────────
  const isLoading  = profileQuery.isLoading || (hasAccess && (reqListQuery.isLoading || pipelineQuery.isLoading));
  const isFetching = reqListQuery.isFetching || pipelineQuery.isFetching;

  useFocusEffect(
    useCallback(() => {
      if (profileQuery.isStale) void profileQuery.refetch();
    }, [profileQuery]),
  );

  const handleRefresh = useCallback(() => {
    void Promise.all([reqListQuery.refetch(), pipelineQuery.refetch()]);
  }, [reqListQuery, pipelineQuery]);

  // ── Lock screen: not subscribed ──────────────────────────────────────────
  const renderSubscribeLock = (): React.JSX.Element => (
    <ScrollView
      contentContainerStyle={[ls.scroll, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={ls.box}>
        <View style={[ls.icon, { backgroundColor: '#fef9c3', borderColor: '#fde047' }]}>
          <AppText style={{ fontSize: 36 }}>🔒</AppText>
        </View>
        <AppText style={[ls.title, { color: theme.colors.text }]}>{t('noActiveSubscription')}</AppText>
        <AppText style={[ls.sub, { color: theme.colors.mutedText }]}>{t('pipelineSubscribeDesc')}</AppText>
        <View style={[ls.benefits, { backgroundColor: theme.colors.surface1 }]}>
          {[t('pipelineBenefit1'), t('pipelineBenefit2'), t('pipelineBenefit3'), t('pipelineBenefit4')].map((b, i) => (
            <View key={i} style={ls.row}>
              <View style={ls.dot} />
              <AppText style={[ls.benefitTxt, { color: theme.colors.textSecondary }]}>{b}</AppText>
            </View>
          ))}
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Subscription')} style={ls.btn} activeOpacity={0.85}>
          <AppText style={ls.btnTxt}>{t('viewSubscriptionPlans')}</AppText>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // ── Lock screen: subscribed but plan doesn't include pipeline ────────────
  const renderPlanLock = (): React.JSX.Element => (
    <ScrollView
      contentContainerStyle={[ls.scroll, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={ls.box}>
        <View style={[ls.icon, { backgroundColor: '#eff6ff', borderColor: '#93c5fd' }]}>
          <AppText style={{ fontSize: 36 }}>⬆️</AppText>
        </View>
        <AppText style={[ls.title, { color: theme.colors.text }]}>{t('pipelinePlanTitle')}</AppText>
        <AppText style={[ls.sub, { color: theme.colors.mutedText }]}>{t('pipelinePlanDesc')}</AppText>
        <View style={[ls.benefits, { backgroundColor: theme.colors.surface1 }]}>
          {[t('pipelinePlanBenefit1'), t('pipelinePlanBenefit2'), t('pipelinePlanBenefit3'), t('pipelinePlanBenefit4')].map((b, i) => (
            <View key={i} style={ls.row}>
              <View style={[ls.dot, { backgroundColor: BRAND }]} />
              <AppText style={[ls.benefitTxt, { color: theme.colors.textSecondary }]}>{b}</AppText>
            </View>
          ))}
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Subscription')} style={ls.btn} activeOpacity={0.85}>
          <AppText style={ls.btnTxt}>{t('pipelinePlanUpgradeBtn')}</AppText>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader title={t('hiringPipeline')} onBack={() => navigation.goBack()} />

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={BRAND} size="large" />
        </View>
      ) : profileQuery.isSuccess && !isSubscribed ? (
        renderSubscribeLock()
      ) : profileQuery.isSuccess && isSubscribed && !pipelineEnabled ? (
        renderPlanLock()
      ) : (
        <FlatList
          data={mergedReqs}
          keyExtractor={item => String(item.req._id)}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={handleRefresh} tintColor={BRAND} />
          }
          ListHeaderComponent={
            <View>
              {/* Global totals */}
              <View style={sg.row}>
                {([
                  { key: 'Shortlisted' as StageKey, color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', emoji: '🔖' },
                  { key: 'Selected'    as StageKey, color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', emoji: '✅' },
                  { key: 'Joined'      as StageKey, color: '#059669', bg: '#ecfdf5', border: '#6ee7b7', emoji: '🤝' },
                ] as const).map(s => (
                  <View key={s.key} style={[sg.cell, { backgroundColor: s.bg, borderColor: s.border }]}>
                    <AppText style={sg.emoji}>{s.emoji}</AppText>
                    <AppText style={[sg.count, { color: s.color }]}>
                      {pipelineQuery.isLoading ? '—' : String(totals[s.key] ?? 0)}
                    </AppText>
                    <AppText style={[sg.label, { color: s.color }]}>{t(STAGE_TKEY[s.key])}</AppText>
                  </View>
                ))}
              </View>
              <AppText style={[sg.sectionTitle, { color: theme.colors.mutedText }]}>
                {t('allRequirements', { count: mergedReqs.length })}
              </AppText>
            </View>
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={sg.emptyBox}>
                <AppText style={sg.emptyEmoji}>📋</AppText>
                <AppText style={[sg.emptyTitle, { color: theme.colors.text }]}>{t('noRequirementsTitle')}</AppText>
                <AppText style={[sg.emptySub, { color: theme.colors.mutedText }]}>{t('noRequirementsDesc')}</AppText>
                <TouchableOpacity
                  onPress={() => navigation.navigate('PostRequirement')}
                  style={sg.postBtn}
                  activeOpacity={0.85}
                >
                  <AppText style={sg.postBtnTxt}>{t('postARequirement')}</AppText>
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const reqId = String(item.req._id);
            return (
              <ReqSection
                req={item.req}
                counts={item.counts}
                workers={item.workers}
                stageIdx={item.stageIdx}
                expanded={expandedIds.has(reqId)}
                onToggle={() => toggleExpand(reqId)}
                onWorkerSelect={handleSelect}
                onWorkerJoin={handleJoin}
                onWorkerRevert={handleRevert}
                onWorkerRemove={handleRemove}
                busyId={busyId}
                onViewInterested={() => navigation.navigate('RequirementDetail', { requirementId: reqId })}
              />
            );
          }}
        />
      )}

      {/* Join rate modal */}
      {joinModal && (
        <JoinRateModal
          state={joinModal}
          onConfirm={handleJoinConfirm}
          onClose={() => setJoinModal(null)}
        />
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const sg = StyleSheet.create({
  row:          { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 4 },
  cell:         { flex: 1, borderRadius: 14, borderWidth: 1.5, padding: 12, alignItems: 'center', gap: 3 },
  emoji:        { fontSize: 18 },
  count:        { fontSize: 22, fontWeight: '900' },
  label:        { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionTitle: { fontSize: 12, fontWeight: '800', marginTop: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyBox:     { alignItems: 'center', paddingVertical: 44, gap: 8 },
  emptyEmoji:   { fontSize: 44 },
  emptyTitle:   { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptySub:     { fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
  postBtn:      { marginTop: 8, backgroundColor: BRAND, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  postBtnTxt:   { fontSize: 13, fontWeight: '800', color: '#fff' },
});

const ls = StyleSheet.create({
  scroll:     { flexGrow: 1, justifyContent: 'center' },
  box:        { alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 40 },
  icon:       { width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  sub:        { fontSize: 13.5, textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 },
  benefits:   { width: '100%', borderRadius: 14, padding: 16, gap: 10 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot:        { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#2563eb', flexShrink: 0 },
  benefitTxt: { fontSize: 13, fontWeight: '500', flex: 1 },
  btn:        { width: '100%', borderRadius: 14, paddingVertical: 16, alignItems: 'center', backgroundColor: BRAND },
  btnTxt:     { color: '#fff', fontSize: 15, fontWeight: '800' },
});
