import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { RawRequirement } from '../../../core/api/endpoints/requirementsApi';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { useAppTheme } from '../../../core/theme';
import { useAuth } from '../../../state/auth/AuthContext';
import { useToast } from '../../../shared/state/toast/ToastContext';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'RequirementDetail'>;

// Raw attendance shape from backend
interface RawAttendance {
  _id: string;
  workerName?: string;
  workerId?: string;
  wages?: number;
  date?: string;
  status?: string;
  requirement_id?: string;
}

// ─── Small helpers ─────────────────────────────────────────────────────────────
const formatDate = (d?: string): string => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
};

const statusColor = (status?: string): string => {
  switch ((status ?? '').toLowerCase()) {
    case 'open':     return '#16a34a';
    case 'assigned': return '#2563eb';
    case 'ongoing':  return '#d97706';
    case 'closed':   return '#dc2626';
    default:         return '#64748b';
  }
};

const perkIcon: Record<string, string> = {
  accommodationAvailable: '🏠 Accommodation',
  foodAvailable:          '🍽️ Food',
  transportProvided:      '🚌 Transport',
  weeklyOff:              '📅 Weekly Off',
  overtimeAvailable:      '⏰ Overtime',
  bonus:                  '🎁 Bonus',
  incentive:              '🏆 Incentive',
  insuranceAvailable:     '🛡️ Insurance',
  pfAvailable:            '🏦 PF',
  esicAvailable:          '🏥 ESIC',
};

// ─── InfoRow ──────────────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View style={ir.row}>
      <AppText style={ir.icon}>{icon}</AppText>
      <AppText variant="caption" color={theme.colors.mutedText} style={ir.label}>{label}</AppText>
      <AppText variant="body" color={theme.colors.text} style={ir.value}>{value}</AppText>
    </View>
  );
};
const ir = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
  icon:  { fontSize: 16, width: 22, lineHeight: 22 },
  label: { width: 110, lineHeight: 20 },
  value: { flex: 1, lineHeight: 20, fontWeight: '600' },
});

// ─── Section Card ──────────────────────────────────────────────────────────────
const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View style={[sc.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <AppText variant="label" style={[sc.title, { color: theme.colors.text }]}>{title}</AppText>
      {children}
    </View>
  );
};
const sc = StyleSheet.create({
  card:  { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
});

// ─── SOW Modal ─────────────────────────────────────────────────────────────────
const SOWModal = ({
  visible,
  onClose,
  requirementId,
  employerId,
}: {
  visible: boolean;
  onClose: () => void;
  requirementId: string;
  employerId?: string;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: records = [], isLoading } = useQuery<RawAttendance[]>({
    queryKey: ['attendance', requirementId],
    queryFn: () =>
      requirementsApi.getAttendanceByRequirement(requirementId, employerId) as unknown as Promise<RawAttendance[]>,
    enabled: visible,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => requirementsApi.approveAttendance(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance', requirementId] });
      toast.success('Attendance record approved.', 'Approved');
    },
    onError: () => toast.error('Failed to approve attendance. Please try again.', 'Error'),
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[sow.root, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={sow.header}>
          <View>
            <AppText style={sow.headerTitle}>Statement of Work</AppText>
            <AppText style={sow.headerSub}>Attendance & Payment Records</AppText>
          </View>
          <TouchableOpacity onPress={onClose} style={sow.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <AppText style={sow.closeTxt}>✕</AppText>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ flex: 1 }} color="#2563eb" />
        ) : records.length === 0 ? (
          <View style={sow.empty}>
            <AppText style={sow.emptyIcon}>📋</AppText>
            <AppText style={sow.emptyTitle}>No Records Yet</AppText>
            <AppText style={[sow.emptySub, { color: theme.colors.mutedText }]}>
              Attendance records will appear here once workers check in.
            </AppText>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Table header */}
            <View style={sow.tableHeader}>
              <AppText style={[sow.th, { width: 36 }]}>#</AppText>
              <AppText style={[sow.th, { flex: 1 }]}>Worker</AppText>
              <AppText style={[sow.th, { width: 70 }]}>Wages</AppText>
              <AppText style={[sow.th, { width: 90 }]}>Date</AppText>
              <AppText style={[sow.th, { width: 74 }]}>Action</AppText>
            </View>
            {records.map((rec, idx) => (
              <View
                key={rec._id}
                style={[sow.tableRow, { backgroundColor: idx % 2 === 0 ? theme.colors.card : theme.colors.surface }]}
              >
                <AppText style={[sow.td, { width: 36, color: theme.colors.mutedText }]}>{idx + 1}</AppText>
                <AppText style={[sow.td, { flex: 1, color: theme.colors.text, fontWeight: '600' }]} numberOfLines={2}>
                  {rec.workerName ?? rec.workerId ?? '—'}
                </AppText>
                <AppText style={[sow.td, { width: 70, color: '#16a34a', fontWeight: '700' }]}>
                  {rec.wages != null ? `₹${rec.wages}` : '—'}
                </AppText>
                <AppText style={[sow.td, { width: 90, color: theme.colors.mutedText }]}>
                  {rec.date ? formatDate(rec.date) : '—'}
                </AppText>
                <View style={{ width: 74, justifyContent: 'center', alignItems: 'center' }}>
                  {rec.status === 'approved' ? (
                    <View style={sow.approvedChip}>
                      <AppText style={sow.approvedTxt}>✓ Done</AppText>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={sow.approveBtn}
                      onPress={() => approveMutation.mutate(rec._id)}
                      disabled={approveMutation.isPending}
                    >
                      <AppText style={sow.approveBtnTxt}>
                        {approveMutation.isPending ? '…' : 'Approve'}
                      </AppText>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const sow = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#093d71', paddingHorizontal: 20, paddingTop: 52, paddingBottom: 18 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub:   { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  closeBtn:    { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  closeTxt:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon:   { fontSize: 48, marginBottom: 12 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  emptySub:    { textAlign: 'center', lineHeight: 22 },
  tableHeader: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  th:          { fontSize: 12, fontWeight: '800', color: '#334155', paddingRight: 4 },
  tableRow:    { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0', alignItems: 'center' },
  td:          { fontSize: 13, paddingRight: 4, lineHeight: 18 },
  approvedChip:  { backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  approvedTxt:   { color: '#16a34a', fontSize: 11, fontWeight: '700' },
  approveBtn:    { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  approveBtnTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export const RequirementDetailScreen = ({ route, navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const queryClient = useQueryClient();
  const { state: authState } = useAuth();
  const toast = useToast();
  const user = authState.session?.user;
  const { requirementId } = route.params;
  const [showSOW, setShowSOW] = useState(false);

  const [wageInput, setWageInput] = useState('');

  // Role flags
  const userRole = user?.role ?? '';
  const isAgentOrWorker = userRole === 'agent' || userRole === 'selfworker';
  const isEmployer = userRole === 'employer';

  const { data: req, isLoading, isError, error, refetch } = useQuery<RawRequirement>({
    queryKey: ['requirement', requirementId, user?.id],
    queryFn: () => requirementsApi.getById(requirementId),
    retry: 1,
  });

  const expressInterestMutation = useMutation({
    mutationFn: ({ id, wage }: { id: string; wage: number }) =>
      requirementsApi.expressInterestWithWage(id, wage),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['requirement', requirementId] });
      void queryClient.invalidateQueries({ queryKey: ['agent-reqs'] });
      toast.success('Interest submitted! The employer will be notified.', 'Interest Shown');
      setWageInput('');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to submit interest.'),
  });

  const handleExpressInterest = (): void => {
    if (!req) return;
    const wage = parseInt(wageInput, 10);
    if (!wage || isNaN(wage)) {
      toast.warning('Please enter your per-head wage quote.');
      return;
    }
    const min = req.minBudgetPerWorker ?? 0;
    if (wage < min) {
      toast.warning(`Wage must be at least ₹${min}/day.`);
      return;
    }
    expressInterestMutation.mutate({ id: req._id, wage });
  };

  const closeMutation = useMutation({
    mutationFn: () => requirementsApi.close(requirementId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['requirement', requirementId] });
      void queryClient.invalidateQueries({ queryKey: ['employer-requirements'] });
      toast.success('Requirement has been closed successfully.', 'Requirement Closed');
    },
    onError: () => toast.error('Failed to close requirement. Please try again.', 'Error'),
  });

  // Employer profile — needed for subscription check
  const { data: employerProfile } = useQuery({
    queryKey: ['employer-profile-req-detail'],
    queryFn: async () => {
      const { apiClient: ac } = await import('../../../core/api/client');
      const res = await ac.get<{ user?: { isSubscribed?: boolean; subscriptionExpery?: string } }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    enabled: isEmployer,
    staleTime: 10 * 60 * 1000,
  });

  const isSubscribed = (() => {
    if (!isEmployer) return false;
    if (!employerProfile?.isSubscribed) return false;
    const expiry = employerProfile.subscriptionExpery;
    if (!expiry) return true;
    return new Date(expiry).getTime() > Date.now();
  })();

  // Fetch all interested agent profiles in a single request (matches CRM getAllAgentsAdmin?ids=...)
  const interestedIds = req?.intrestedAgents?.map((a) => a.agentId) ?? [];
  const { data: interestedProfiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['interested-agent-profiles', interestedIds.join(',')],
    queryFn: () => workerApi.getAgentsByIds(interestedIds),
    enabled: isEmployer && interestedIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Merge profile data with the wage the agent quoted
  const interestedWithData = interestedProfiles.map((profile) => {
    const entry = req?.intrestedAgents?.find((a) => a.agentId === profile._id);
    return { ...profile, agentRequiredWage: entry?.agentRequiredWage };
  });

  type InterestedRow = { _id: string; name: string; phone: string; state?: string; district?: string; block?: string; status?: string; agentRequiredWage?: number };
  const interestedRows: InterestedRow[] = interestedWithData.length > 0
    ? interestedWithData
    : (req?.intrestedAgents ?? []).map((a) => ({ _id: a.agentId, name: '', phone: '', agentRequiredWage: a.agentRequiredWage }));

  // Accept = assign the agent to this requirement (matches CRM handleAssignAgent)
  const acceptMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const profile = interestedProfiles.find((p) => p._id === agentId);
      const wage = req?.intrestedAgents?.find((a) => a.agentId === agentId)?.agentRequiredWage
        ?? req?.minBudgetPerWorker
        ?? 0;
      return requirementsApi.assignAgent({
        agentId,
        ern: String(req?.ERN_NUMBER ?? ''),
        assignedAgentName: profile?.name ?? 'Agent',
        assignedAgentPhone: profile?.phone ?? '',
        finalAgentRequiredWage: wage,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['requirement', requirementId] });
      void queryClient.invalidateQueries({ queryKey: ['employer-requirements'] });
      toast.success('Agent assigned successfully!', 'Agent Assigned');
    },
    onError: () => toast.error('Failed to assign agent. Please try again.', 'Error'),
  });

  // Reject = remove agent from interested list (matches CRM handleReject)
  const rejectMutation = useMutation({
    mutationFn: (agentId: string) =>
      requirementsApi.unassignOrAccept({ agentId, ern: String(req?.ERN_NUMBER ?? ''), isAgentAccepted: 'No' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['requirement', requirementId] });
      toast.info('Agent removed from this requirement.', 'Agent Removed');
    },
    onError: () => toast.error('Failed to reject agent. Please try again.', 'Error'),
  });

  if (isLoading) return <LoadingState message="Loading requirement details…" />;
  if (isError || !req) {
    const errMsg = error instanceof Error ? error.message : undefined;
    const isNotFound = errMsg === 'Requirement not found';
    return (
      <ErrorState
        title={isNotFound ? 'Requirement Not Found' : 'Unable to Load'}
        message={
          isNotFound
            ? 'This requirement may have been deleted or you do not have access to it.'
            : 'Something went wrong while loading this requirement. Please check your connection and try again.'
        }
        onRetry={() => void refetch()}
      />
    );
  }

  const statusRaw = (req.status ?? '').toLowerCase();
  const isAssigned = !!req.assignedAgentId;
  // "open" = no agent assigned yet; "assigned"/"approved" = agent placed
  const isOpen = !isAssigned && statusRaw !== 'closed' && statusRaw !== 'expired';
  const isClosed = statusRaw === 'closed' || statusRaw === 'expired';
  const isActiveWork = isAssigned && (statusRaw === 'assigned' || statusRaw === 'approved' || statusRaw === 'ongoing');
  const interestedAgents = req.intrestedAgents ?? [];

  const activePerks = Object.entries(perkIcon).filter(([key]) => (req as unknown as Record<string, unknown>)[key] === true);
  const isAlreadyInterested = req.intrestedAgents?.some(
    (a) => String(a.agentId) === String(user?.id),
  ) ?? false;
  const isAssignedToMe = String(req.assignedAgentId) === String(user?.id);

  const handleERNPress = (): void => {
    if (isAssigned) {
      setShowSOW(true);
    } else {
      toast.info(req.ERN_NUMBER ? `ERN: ${req.ERN_NUMBER}` : 'No ERN assigned yet', 'Requirement ID');
    }
  };

  const handleClose = (): void => {
    Alert.alert('Close Requirement', 'Are you sure you want to close this requirement?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: () => closeMutation.mutate() },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <AppText style={styles.backIcon}>←</AppText>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <AppText style={styles.headerWorkType} numberOfLines={1}>
            {req.workType ?? 'Requirement'}{req.subCategory ? ` · ${req.subCategory}` : ''}
          </AppText>
          <TouchableOpacity onPress={handleERNPress} style={styles.ernRow}>
            <AppText style={styles.ernText}>
              {req.ERN_NUMBER ?? 'No ERN'}
            </AppText>
            {isAssigned && <AppText style={styles.ernArrow}> 📋 SOW</AppText>}
          </TouchableOpacity>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor(req.status) + '20', borderColor: statusColor(req.status) + '40' }]}>
          <AppText style={[styles.statusText, { color: statusColor(req.status) }]}>
            {req.status ?? 'Unknown'}
          </AppText>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* ── Requirement Details ──────────────────────────────────────── */}
        <SectionCard title="📋 Requirement Details">
          {req.req_type && <InfoRow icon="🏷️" label="Type" value={req.req_type.replace(/_/g, ' ')} />}
          {req.district && <InfoRow icon="📍" label="Location" value={[req.tehsil, req.district, req.state].filter(Boolean).join(', ')} />}
          {req.workLocation && <InfoRow icon="🗺️" label="Work Site" value={req.workLocation} />}
          {req.workerNeedDate && <InfoRow icon="📅" label="Start Date" value={formatDate(req.workerNeedDate)} />}
          {req.estimated_days && <InfoRow icon="⏱️" label="Duration" value={`${req.estimated_days} days`} />}
          {(req.inTime || req.outTime) && <InfoRow icon="🕐" label="Timing" value={`${req.inTime ?? '—'} – ${req.outTime ?? '—'}`} />}
          {(req.workerQuantitySkilled != null || req.workerQuantityUnskilled != null) && (
            <InfoRow
              icon="👷"
              label="Workers"
              value={`Skilled: ${req.workerQuantitySkilled ?? 0}${req.workerQuantityUnskilled ? ` · Unskilled: ${req.workerQuantityUnskilled}` : ''}`}
            />
          )}
          {(req.minBudgetPerWorker != null || req.maxBudgetPerWorker != null) && (
            <InfoRow
              icon="💰"
              label="Budget/Worker"
              value={`₹${req.minBudgetPerWorker ?? 0} – ₹${req.maxBudgetPerWorker ?? 0}`}
            />
          )}
          {req.createdAt && <InfoRow icon="🗓️" label="Posted" value={formatDate(req.createdAt)} />}
        </SectionCard>

        {/* ── Perks ────────────────────────────────────────────────────── */}
        {activePerks.length > 0 && (
          <SectionCard title="🎁 Perks & Benefits">
            <View style={styles.perksWrap}>
              {activePerks.map(([, label]) => (
                <View key={label} style={[styles.perkChip, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
                  <AppText style={styles.perkText}>{label}</AppText>
                </View>
              ))}
            </View>
          </SectionCard>
        )}

        {/* ── Remarks ──────────────────────────────────────────────────── */}
        {req.remarks ? (
          <SectionCard title="📝 Remarks">
            <AppText variant="body" color={theme.colors.text} style={{ lineHeight: 22 }}>{req.remarks}</AppText>
          </SectionCard>
        ) : null}

        {/* ── Express Interest (agent / self-worker) ────────────────────── */}
        {isAgentOrWorker && isOpen && (
          <SectionCard title="🤝 Express Interest">
            {isAlreadyInterested ? (
              <View style={[styles.interestDoneWrap, { backgroundColor: theme.colors.successLight }]}>
                <AppText style={{ fontSize: 28, marginBottom: 6 }}>✅</AppText>
                <AppText variant="label" color={theme.colors.success}>Interest Already Shown</AppText>
                <AppText variant="caption" color={theme.colors.mutedText} style={{ textAlign: 'center', marginTop: 4 }}>
                  The employer has been notified. You'll be contacted if selected.
                </AppText>
              </View>
            ) : (
              <View style={styles.interestFormWrap}>
                <AppText variant="body" color={theme.colors.mutedText} style={{ marginBottom: 12, lineHeight: 20 }}>
                  Enter your per-head wage quote to express interest. Minimum: ₹{req.minBudgetPerWorker ?? 0}/day.
                </AppText>
                <TextInput
                  style={[
                    styles.wageTextInput,
                    {
                      backgroundColor: theme.colors.surface1,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  value={wageInput}
                  onChangeText={setWageInput}
                  placeholder={`Quote per head/day (min ₹${req.minBudgetPerWorker ?? 0})`}
                  placeholderTextColor={theme.colors.mutedText}
                  keyboardType="number-pad"
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[
                    styles.expressBtn,
                    {
                      backgroundColor: expressInterestMutation.isPending ? theme.colors.border : theme.colors.primary,
                    },
                  ]}
                  onPress={handleExpressInterest}
                  disabled={expressInterestMutation.isPending || !wageInput}
                  activeOpacity={0.8}
                >
                  <AppText style={styles.expressBtnTxt}>
                    {expressInterestMutation.isPending ? 'Submitting…' : '🤝 Show Interest'}
                  </AppText>
                </TouchableOpacity>
              </View>
            )}
          </SectionCard>
        )}

        {/* ── I'm Assigned (agent / self-worker) ───────────────────────── */}
        {isAgentOrWorker && isAssignedToMe && (
          <SectionCard title="🎉 You're Assigned!">
            <View style={[styles.assignedMeBanner, { backgroundColor: theme.colors.primaryLight }]}>
              <AppText style={{ fontSize: 32, marginBottom: 8 }}>🏆</AppText>
              <AppText variant="label" color={theme.colors.primary}>
                You have been assigned to this requirement
              </AppText>
              <AppText variant="caption" color={theme.colors.mutedText} style={{ textAlign: 'center', marginTop: 4 }}>
                Agreed wage: ₹{req.finalAgentRequiredWage ?? req.minBudgetPerWorker ?? 0}/day
              </AppText>
              <TouchableOpacity
                style={[styles.sowBtn2, { backgroundColor: theme.colors.primary }]}
                onPress={() => setShowSOW(true)}
              >
                <AppText style={styles.sowBtnTxt}>📋 View Statement of Work</AppText>
              </TouchableOpacity>
            </View>
          </SectionCard>
        )}

        {/* ── Assigned Agent (employer view) ───────────────────────────── */}
        {isAssigned && !isAgentOrWorker && (
          <SectionCard title="✅ Assigned Agent">
            <View style={styles.agentCard}>
              <View style={[styles.agentAvatar, { backgroundColor: '#2563eb22' }]}>
                <AppText style={styles.agentAvatarTxt}>
                  {(req.assignedAgentName ?? 'A').slice(0, 2).toUpperCase()}
                </AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={[styles.agentName, { color: theme.colors.text }]}>
                  {req.assignedAgentName ?? '—'}
                </AppText>
                {req.assignedAgentPhone && (
                  <TouchableOpacity onPress={() => void Linking.openURL(`tel:${req.assignedAgentPhone}`)}>
                    <AppText style={styles.agentPhone}>📞 {req.assignedAgentPhone}</AppText>
                  </TouchableOpacity>
                )}
                {req.finalAgentRequiredWage != null && (
                  <AppText style={[styles.agentWage, { color: theme.colors.mutedText }]}>
                    Wage: ₹{req.finalAgentRequiredWage}/day
                  </AppText>
                )}
              </View>
              {req.isAgentAccepted && (
                <View style={styles.acceptedBadge}>
                  <AppText style={styles.acceptedTxt}>Accepted</AppText>
                </View>
              )}
            </View>
          </SectionCard>
        )}

        {/* ── Interested Agents (employer only) ────────────────────────── */}
        {isEmployer && !isAssigned && (
          <SectionCard title={`🙋 Interested Agents${interestedAgents.length > 0 ? ` (${interestedAgents.length})` : ''}`}>
            {interestedAgents.length === 0 ? (
              <View style={styles.noAgents}>
                <AppText style={{ fontSize: 32, marginBottom: 8 }}>👀</AppText>
                <AppText style={[styles.noAgentsTitle, { color: theme.colors.text }]}>No agents yet</AppText>
                <AppText variant="caption" color={theme.colors.mutedText} style={{ textAlign: 'center' }}>
                  Agents who express interest in this requirement will appear here.
                </AppText>
              </View>
            ) : (
              <View style={{ overflow: 'hidden' }}>
                {/* Table header */}
                <View style={[styles.tableHeader, { borderBottomColor: theme.colors.border }]}>
                  <AppText style={[styles.th, { width: 72 }]}>Action</AppText>
                  <AppText style={[styles.th, { flex: 1 }]}>Name</AppText>
                  <AppText style={[styles.th, { width: 70 }]}>Wage</AppText>
                  <AppText style={[styles.th, { width: 26 }]}> </AppText>
                </View>

                {/* Agent rows (blurred for non-subscribed) */}
                <View>
                  {profilesLoading && (
                    <View style={styles.profilesLoading}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                      <AppText style={[styles.profilesLoadingTxt, { color: theme.colors.mutedText }]}>Loading agent details…</AppText>
                    </View>
                  )}

                  {interestedRows.map((agent, idx) => {
                    const location = [agent.state, agent.district].filter(Boolean).join(', ');
                    const isAccepting = acceptMutation.isPending && acceptMutation.variables === agent._id;
                    const isRejecting = rejectMutation.isPending && rejectMutation.variables === agent._id;

                    return (
                      <View key={agent._id}>
                        {/* Blurred row for non-subscribed employer */}
                        {!isSubscribed ? (
                          <View style={[styles.blurRow, { borderBottomColor: theme.colors.border }]}>
                            <View style={[styles.acceptBtn, { opacity: 0.4 }]}>
                              <AppText style={styles.acceptBtnTxt}>Accept</AppText>
                            </View>
                            <View style={{ flex: 1, gap: 3, marginLeft: 10 }}>
                              <AppText style={[styles.agentName, { color: theme.colors.text }]}>
                                {agent.name ? agent.name.slice(0, 2) + '****' : '••••••'}
                              </AppText>
                              <AppText style={[styles.agentWage, { color: theme.colors.mutedText }]}>
                                {location || '••••••'}
                              </AppText>
                              <AppText style={{ color: theme.colors.mutedText, fontSize: 12 }}>
                                📞 ••••••••••
                              </AppText>
                            </View>
                            <View style={[styles.interestedChip, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
                              <AppText style={[styles.interestedChipTxt, { color: '#15803d' }]}>Interested</AppText>
                            </View>
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.interestedRow,
                              { borderBottomColor: theme.colors.border },
                              idx === interestedRows.length - 1 && { borderBottomWidth: 0 },
                            ]}
                          >
                            {/* Action — Accept */}
                            <TouchableOpacity
                              style={[styles.acceptBtn, (isAccepting || acceptMutation.isPending) && { opacity: 0.6 }]}
                              disabled={acceptMutation.isPending || rejectMutation.isPending}
                              onPress={() => {
                                Alert.alert(
                                  'Assign Agent',
                                  `Assign ${agent.name || 'this agent'} at ₹${agent.agentRequiredWage ?? req?.minBudgetPerWorker ?? 0}/day?`,
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Assign', onPress: () => acceptMutation.mutate(agent._id) },
                                  ],
                                );
                              }}
                            >
                              <AppText style={styles.acceptBtnTxt}>
                                {isAccepting ? '…' : 'Accept'}
                              </AppText>
                            </TouchableOpacity>

                            {/* Name + Location + Contact */}
                            <View style={{ flex: 1, gap: 2, marginHorizontal: 10 }}>
                              <AppText style={[styles.agentName, { color: theme.colors.text }]} numberOfLines={1}>
                                {agent.name || `Agent ${idx + 1}`}
                              </AppText>
                              {!!location && (
                                <AppText style={[styles.agentWage, { color: theme.colors.mutedText }]} numberOfLines={1}>
                                  {location}
                                </AppText>
                              )}
                              {!!agent.phone && (
                                <TouchableOpacity onPress={() => void Linking.openURL(`tel:${agent.phone}`)}>
                                  <AppText style={styles.contactLink}>{agent.phone}</AppText>
                                </TouchableOpacity>
                              )}
                            </View>

                            {/* Wage */}
                            <View style={styles.wageBox}>
                              <AppText style={styles.wageText}>
                                {agent.agentRequiredWage != null ? `₹${agent.agentRequiredWage}` : '—'}
                              </AppText>
                            </View>

                            {/* Interested chip */}
                            <View style={[styles.interestedChip, { backgroundColor: '#dcfce7', borderColor: '#86efac', marginLeft: 6 }]}>
                              <AppText style={[styles.interestedChipTxt, { color: '#15803d' }]}>✓</AppText>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {/* Subscription blur overlay */}
                  {!isSubscribed && interestedRows.length > 0 && (
                    <View style={styles.subOverlay}>
                      <View style={styles.subOverlayBox}>
                        <AppText style={styles.subOverlayTitle}>Subscription Required</AppText>
                        <AppText style={[styles.subOverlaySub, { color: theme.colors.mutedText }]}>
                          Subscribe to view agent details & accept
                        </AppText>
                        <TouchableOpacity
                          style={styles.subOverlayBtn}
                          onPress={() => navigation.navigate('Subscription')}
                        >
                          <AppText style={styles.subOverlayBtnTxt}>View Plans</AppText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>

                {/* Suggestion box — shown when < 5 interested (matches CRM) */}
                {interestedAgents.length < 5 && (
                  <View style={[styles.suggestionBox, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
                    <AppText style={styles.suggestionText}>
                      <AppText style={styles.suggestionBold}>Suggestion: </AppText>
                      Workers and agents may currently be engaged in active projects, which can sometimes delay responses to new requirements. For faster coordination and quicker hiring, we recommend exploring relevant workers/agents based on your requirements and contacting suitable profiles directly for prompt response.
                    </AppText>
                  </View>
                )}
              </View>
            )}
          </SectionCard>
        )}

        {/* ── Action Buttons (employer only) ────────────────────────────── */}
        {!isAgentOrWorker && (
          <View style={styles.actionRow}>
            {isAssigned && (
              <TouchableOpacity style={styles.sowBtn} onPress={() => setShowSOW(true)}>
                <AppText style={styles.sowBtnTxt}>📋 View Statement of Work</AppText>
              </TouchableOpacity>
            )}
            {!isClosed && (
              <TouchableOpacity
                style={[styles.closeReqBtn, { borderColor: '#dc2626' }]}
                onPress={handleClose}
                disabled={closeMutation.isPending}
              >
                <AppText style={styles.closeReqTxt}>
                  {closeMutation.isPending ? 'Closing…' : '🔒 Close Requirement'}
                </AppText>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── SOW Modal ──────────────────────────────────────────────────── */}
      <SOWModal
        visible={showSOW}
        onClose={() => setShowSOW(false)}
        requirementId={requirementId}
        employerId={user?.id}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#093d71',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 16,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { color: '#fff', fontSize: 20, lineHeight: 22 },
  headerCenter: { flex: 1 },
  headerWorkType: { color: '#fff', fontSize: 16, fontWeight: '800' },
  ernRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  ernText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  ernArrow: { color: '#93c5fd', fontSize: 12, fontWeight: '600' },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: '800' },

  scroll: { padding: 16, paddingBottom: 40 },

  // Perks
  perksWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  perkChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  perkText: { color: '#15803d', fontSize: 12, fontWeight: '700' },

  // Assigned agent
  agentCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  agentAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  agentAvatarTxt: { fontSize: 17, fontWeight: '700', color: '#2563eb' },
  agentName: { fontSize: 15, fontWeight: '700' },
  agentPhone: { color: '#2563eb', fontSize: 13, fontWeight: '600', marginTop: 2 },
  agentWage: { fontSize: 12, marginTop: 2 },
  acceptedBadge: { backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  acceptedTxt: { color: '#16a34a', fontSize: 11, fontWeight: '800' },

  // Interested agents table
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 2 },
  th: { fontSize: 11, fontWeight: '800', color: '#334155' },
  interestedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  blurRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, opacity: 0.55 },
  acceptBtn: { backgroundColor: '#16a34a', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, minWidth: 68, alignItems: 'center' },
  acceptBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  contactLink: { color: '#1d4ed8', fontSize: 12, fontWeight: '700' },
  wageBox: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#f8fafc', minWidth: 54, alignItems: 'center' },
  wageText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  interestedChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  interestedChipTxt: { fontSize: 11, fontWeight: '800' },
  subOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 12 },
  subOverlayBox: { alignItems: 'center', padding: 20, gap: 8 },
  subOverlayTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  subOverlaySub: { fontSize: 13, textAlign: 'center', fontWeight: '500' },
  subOverlayBtn: { marginTop: 4, backgroundColor: '#2563eb', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  subOverlayBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  profilesLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  profilesLoadingTxt: { fontSize: 12 },
  suggestionBox: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12 },
  suggestionText: { fontSize: 13, color: '#9a3412', lineHeight: 20 },
  suggestionBold: { fontWeight: '800', color: '#9a3412' },
  agentActions: { flexDirection: 'row', gap: 6 },
  rejectBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  rejectBtnTxt: { fontSize: 12, fontWeight: '700' },
  noAgents: { alignItems: 'center', paddingVertical: 20 },
  noAgentsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },

  // Express interest
  interestFormWrap: { gap: 10 },
  interestDoneWrap: { alignItems: 'center', borderRadius: 14, padding: 20 },
  wageTextInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
  },
  expressBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expressBtnTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  // Assigned-to-me banner
  assignedMeBanner: { alignItems: 'center', borderRadius: 14, padding: 20 },
  sowBtn2: { marginTop: 14, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },

  // Action row
  actionRow: { gap: 10, marginTop: 4 },
  sowBtn: {
    backgroundColor: '#093d71',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  sowBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  closeReqBtn: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  closeReqTxt: { color: '#dc2626', fontSize: 14, fontWeight: '700' },
});
