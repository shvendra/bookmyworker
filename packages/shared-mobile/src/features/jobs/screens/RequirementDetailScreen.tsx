import { type NativeStackScreenProps, type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { RawRequirement } from '../../../core/api/endpoints/requirementsApi';
import { apiClient } from '../../../core/api/client';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { useAppTheme } from '../../../core/theme';
import { useAuth } from '../../../state/auth/AuthContext';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { VerifiedBadgeModal } from '../../../shared/components/ui/VerifiedBadgeModal';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'RequirementDetail'>;
type ReqDetailNav = NativeStackNavigationProp<MainStackParamList>;

// ─── Design tokens ─────────────────────────────────────────────────────────────
const BRAND      = '#1037A4';
const BRAND_MID  = '#1A56DB';
const BRAND_SOFT = '#EBF1FF';
const NAVY       = '#0F172A';
const SLATE      = '#64748B';
const BORDER     = '#E2E8F0';
const GREEN      = '#059669';
const GREEN_SOFT = '#ECFDF5';
const GREEN_BDR  = '#6EE7B7';
const AMBER      = '#D97706';
const AMBER_SOFT = '#FFFBEB';
const RED        = '#DC2626';
const WHITE      = '#FFFFFF';

// ─── Raw attendance shape ──────────────────────────────────────────────────────
interface RawAttendance {
  _id: string;
  workerName?: string;
  workerId?: string;
  wages?: number;
  date?: string;
  status?: string;
  requirement_id?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtLabel = (s?: string | null): string => {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatDate = (d?: string): string => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const formatTime = (t?: string): string => {
  if (!t) return '—';
  try {
    const d = new Date(t);
    if (isNaN(d.getTime())) return t;
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return t; }
};

const statusMeta = (status?: string, isAssigned?: boolean): { label: string; color: string; bg: string; border: string } => {
  if (isAssigned) return { label: 'Ongoing',  color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' };
  const s = (status ?? '').toLowerCase();
  if (s === 'closed' || s === 'expired') return { label: 'Closed', color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' };
  return { label: 'Open', color: GREEN, bg: GREEN_SOFT, border: GREEN_BDR };
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

// ─── InfoTile — 2-column grid tile ────────────────────────────────────────────
const InfoTile = ({ emoji, label, value, accent }: {
  emoji: string; label: string; value: string; accent?: string;
}): React.JSX.Element => (
  <View style={tile.wrap}>
    <View style={[tile.iconBox, { backgroundColor: accent ? accent + '18' : BRAND_SOFT }]}>
      <AppText style={tile.emoji}>{emoji}</AppText>
    </View>
    <AppText style={tile.label}>{label}</AppText>
    <AppText style={[tile.value, accent ? { color: accent } : {}]} numberOfLines={2}>{value}</AppText>
  </View>
);
const tile = StyleSheet.create({
  wrap:    { width: '48%', borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: WHITE, padding: 12, gap: 6 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  emoji:   { fontSize: 18 },
  label:   { fontSize: 10, fontWeight: '700', color: SLATE, letterSpacing: 0.4, textTransform: 'uppercase' },
  value:   { fontSize: 13, fontWeight: '700', color: NAVY, lineHeight: 18 },
});

// ─── Section header ────────────────────────────────────────────────────────────
const SecHead = ({ title, accent = BRAND }: { title: string; accent?: string }): React.JSX.Element => (
  <View style={sh.row}>
    <View style={[sh.bar, { backgroundColor: accent }]} />
    <AppText style={sh.text}>{title}</AppText>
  </View>
);
const sh = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  bar:  { width: 4, height: 18, borderRadius: 2 },
  text: { fontSize: 14, fontWeight: '800', color: NAVY, letterSpacing: 0.1 },
});

// ─── Agent card (subscribed view) ─────────────────────────────────────────────
const AgentCard = ({
  agent,
  idx,
  onProfile,
  isSubscribed,
}: {
  agent: { _id: string; name: string; phone: string; state?: string; district?: string; agentRequiredWage?: number };
  idx: number;
  onProfile: () => void;
  isSubscribed: boolean;
}): React.JSX.Element => {
  const navigation = useNavigation<ReqDetailNav>();
  const toast = useToast();
  const [unlockedPhone, setUnlockedPhone] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const initials = (agent.name || `A${idx + 1}`).slice(0, 2).toUpperCase();
  const location = [agent.district, agent.state].filter(Boolean).join(', ');
  const colors = [
    { bg: '#EBF1FF', text: BRAND_MID },
    { bg: '#F5F3FF', text: '#7C3AED' },
    { bg: '#ECFDF5', text: GREEN },
    { bg: '#FFF7ED', text: '#EA580C' },
  ];
  const palette = colors[idx % colors.length]!;

  const handleReveal = async (): Promise<void> => {
    if (!isSubscribed) {
      toast.error("You don't have an active subscription. Please subscribe to view contact details.", 'No Subscription');
      navigation.navigate('Subscription');
      return;
    }
    if (unlockedPhone) {
      void Linking.openURL(`tel:${unlockedPhone}`);
      return;
    }
    setUnlocking(true);
    setUnlockError(null);
    try {
      const res = await workerApi.unlockNumber(agent._id);
      if (res.phone) {
        setUnlockedPhone(res.phone);
      } else {
        const msg = res.message ?? "You don't have an active subscription. Please subscribe to view contact details.";
        setUnlockError(msg);
        toast.error(msg, 'Access Denied');
        if (msg.toLowerCase().includes('subscri')) navigation.navigate('Subscription');
      }
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = errObj?.response?.data?.message ?? errObj?.message;
      const finalMsg = msg ?? "You don't have an active subscription. Please subscribe to view contact details.";
      setUnlockError(finalMsg);
      toast.error(finalMsg, 'Access Denied');
      if (finalMsg.toLowerCase().includes('subscri')) navigation.navigate('Subscription');
    } finally {
      setUnlocking(false);
    }
  };

  const isSubscriptionBlocked = !isSubscribed || (!!unlockError && (
    unlockError.toLowerCase().includes('subscri') ||
    unlockError.toLowerCase().includes('unlock')
  ));

  return (
    <View style={ac.cardWrap}>
      {/* Main row — tap goes to profile */}
      <TouchableOpacity onPress={onProfile} activeOpacity={0.88} style={ac.card}>
        {/* Avatar */}
        <View style={[ac.avatar, { backgroundColor: palette.bg }]}>
          <AppText style={[ac.initials, { color: palette.text }]}>{initials}</AppText>
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <AppText style={ac.name} numberOfLines={1}>{agent.name || `Agent ${idx + 1}`}</AppText>
          {!!location && (
            <AppText style={ac.location} numberOfLines={1}>📍 {location}</AppText>
          )}
          {agent.agentRequiredWage != null && (
            <View style={ac.wagePill}>
              <AppText style={ac.wageText}>₹{agent.agentRequiredWage}/day</AppText>
            </View>
          )}
        </View>

        {/* Button area — does NOT propagate to onProfile */}
        {isSubscriptionBlocked ? (
          <TouchableOpacity
            onPress={() => {
              toast.error("You don't have an active subscription. Please subscribe to view contact details.", 'No Subscription');
              navigation.navigate('Subscription');
            }}
            style={ac.lockedChip}
            activeOpacity={0.75}
          >
            <AppText style={ac.lockedIcon}>🔒</AppText>
            <AppText style={ac.lockedTxt}>Subscribe</AppText>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => void handleReveal()}
            style={[ac.viewBtn, unlocking && { opacity: 0.7 }]}
            activeOpacity={0.8}
            disabled={unlocking}
          >
            {unlocking ? (
              <ActivityIndicator size="small" color={BRAND} />
            ) : (
              <AppText style={ac.viewTxt}>View{'\n'}Contact</AppText>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Revealed phone — full-width row below the card */}
      {!!unlockedPhone && (
        <View style={ac.phoneRevealedRow}>
          <View style={ac.phoneRevealedLeft}>
            <AppText style={ac.phoneRevealedLabel}>Contact Number</AppText>
            <AppText style={ac.phoneRevealedNum}>📞 {unlockedPhone}</AppText>
          </View>
          <TouchableOpacity
            onPress={() => void Linking.openURL(`tel:${unlockedPhone}`)}
            style={ac.callNowBtn}
            activeOpacity={0.85}
          >
            <AppText style={ac.callNowTxt}>Call Now</AppText>
          </TouchableOpacity>
        </View>
      )}

      {/* Generic (non-subscription) error */}
      {!!unlockError && !isSubscriptionBlocked && (
        <View style={ac.errorRow}>
          <AppText style={ac.unlockError}>⚠️ {unlockError}</AppText>
        </View>
      )}
    </View>
  );
};
const ac = StyleSheet.create({
  cardWrap:      { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER, paddingBottom: 10 },
  card:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4 },
  avatar:        { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  initials:      { fontSize: 16, fontWeight: '800' },
  name:          { fontSize: 14, fontWeight: '700', color: NAVY, marginBottom: 2, textTransform: 'capitalize' },
  location:      { fontSize: 11, color: SLATE, marginBottom: 4 },
  wagePill:      { alignSelf: 'flex-start', backgroundColor: GREEN_SOFT, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: GREEN_BDR },
  wageText:      { fontSize: 11, fontWeight: '700', color: GREEN },
  unlockError:        { fontSize: 11, color: '#DC2626' },
  // View Contact button
  viewBtn:            { backgroundColor: BRAND_SOFT, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: BRAND_MID + '40', minWidth: 62 },
  viewTxt:            { fontSize: 10, fontWeight: '800', color: BRAND_MID, textAlign: 'center', lineHeight: 14 },
  // Subscription locked chip — tappable
  lockedChip:         { backgroundColor: AMBER_SOFT, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: AMBER + '40', minWidth: 62, gap: 3 },
  lockedIcon:         { fontSize: 14 },
  lockedTxt:          { fontSize: 10, fontWeight: '800', color: AMBER, textAlign: 'center' },
  // Revealed phone row
  phoneRevealedRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: GREEN_SOFT, borderRadius: 10, borderWidth: 1, borderColor: GREEN_BDR, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8, gap: 10 },
  phoneRevealedLeft:  { flex: 1 },
  phoneRevealedLabel: { fontSize: 10, fontWeight: '700', color: GREEN, textTransform: 'uppercase', letterSpacing: 0.5 },
  phoneRevealedNum:   { fontSize: 15, fontWeight: '800', color: '#0f172a', marginTop: 2 },
  callNowBtn:         { backgroundColor: GREEN, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  callNowTxt:         { color: WHITE, fontSize: 12, fontWeight: '800' },
  errorRow:           { paddingHorizontal: 4, paddingBottom: 6 },
});

// ─── Blurred agent row (non-subscribed) ───────────────────────────────────────
const BlurredAgentRow = ({ idx }: { idx: number }): React.JSX.Element => (
  <View style={ba.row}>
    <View style={ba.avatar} />
    <View style={{ flex: 1, gap: 5 }}>
      <View style={[ba.line, { width: '55%' }]} />
      <View style={[ba.line, { width: '35%' }]} />
      <View style={[ba.line, { width: '25%' }]} />
    </View>
    <View style={ba.chipWrap}>
      <AppText style={ba.chipTxt}>● Interested</AppText>
    </View>
  </View>
);
const ba = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER, opacity: 0.45 },
  avatar:  { width: 46, height: 46, borderRadius: 23, backgroundColor: BORDER, flexShrink: 0 },
  line:    { height: 10, borderRadius: 5, backgroundColor: BORDER },
  chipWrap:{ backgroundColor: GREEN_SOFT, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  chipTxt: { fontSize: 10, fontWeight: '700', color: GREEN },
});

// ─── SOW Modal ─────────────────────────────────────────────────────────────────
const SOWModal = ({
  visible, onClose, requirementId, employerId,
}: {
  visible: boolean; onClose: () => void; requirementId: string; employerId?: string;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
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
        <View style={[sow.header, { paddingTop: insets.top + 14 }]}>
          <View style={sow.headerLeft}>
            <AppText style={sow.headerTitle}>Statement of Work</AppText>
            <AppText style={sow.headerSub}>Attendance & Payment Records</AppText>
          </View>
          <TouchableOpacity onPress={onClose} style={sow.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <AppText style={sow.closeTxt}>✕</AppText>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ flex: 1 }} color={BRAND_MID} />
        ) : records.length === 0 ? (
          <View style={sow.empty}>
            <View style={sow.emptyIconWrap}><AppText style={{ fontSize: 32 }}>📋</AppText></View>
            <AppText style={sow.emptyTitle}>No Records Yet</AppText>
            <AppText style={[sow.emptySub, { color: theme.colors.mutedText }]}>
              Attendance records will appear here once workers check in.
            </AppText>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={sow.tableHeader}>
              <AppText style={[sow.th, { width: 32 }]}>#</AppText>
              <AppText style={[sow.th, { flex: 1 }]}>Worker</AppText>
              <AppText style={[sow.th, { width: 68 }]}>Wages</AppText>
              <AppText style={[sow.th, { width: 88 }]}>Date</AppText>
              <AppText style={[sow.th, { width: 76 }]}>Status</AppText>
            </View>
            {records.map((rec: RawAttendance, idx: number) => (
              <View key={rec._id} style={[sow.tableRow, { backgroundColor: idx % 2 === 0 ? WHITE : '#F8FAFC' }]}>
                <AppText style={[sow.td, { width: 32, color: SLATE }]}>{idx + 1}</AppText>
                <AppText style={[sow.td, { flex: 1, color: NAVY, fontWeight: '600', textTransform: 'capitalize' }]} numberOfLines={2}>
                  {rec.workerName ?? rec.workerId ?? '—'}
                </AppText>
                <AppText style={[sow.td, { width: 68, color: GREEN, fontWeight: '700' }]}>
                  {rec.wages != null ? `₹${rec.wages}` : '—'}
                </AppText>
                <AppText style={[sow.td, { width: 88, color: SLATE }]}>
                  {rec.date ? formatDate(rec.date) : '—'}
                </AppText>
                <View style={{ width: 76, alignItems: 'center', justifyContent: 'center' }}>
                  {rec.status === 'approved' ? (
                    <View style={sow.approvedChip}><AppText style={sow.approvedTxt}>✓ Done</AppText></View>
                  ) : (
                    <TouchableOpacity style={sow.approveBtn} onPress={() => approveMutation.mutate(rec._id)} disabled={approveMutation.isPending}>
                      <AppText style={sow.approveBtnTxt}>{approveMutation.isPending ? '…' : 'Approve'}</AppText>
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
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: BRAND, paddingHorizontal: 20, paddingBottom: 20 },
  headerLeft:  {},
  headerTitle: { color: WHITE, fontSize: 18, fontWeight: '800' },
  headerSub:   { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 3 },
  closeBtn:    { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  closeTxt:    { color: WHITE, fontSize: 16, fontWeight: '700' },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: BRAND_SOFT, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:  { fontSize: 17, fontWeight: '800', color: NAVY },
  emptySub:    { textAlign: 'center', lineHeight: 20, fontSize: 13 },
  tableHeader: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 11, backgroundColor: '#F1F5F9', borderBottomWidth: 1, borderBottomColor: BORDER },
  th:          { fontSize: 11, fontWeight: '800', color: '#334155', paddingRight: 4, letterSpacing: 0.3 },
  tableRow:    { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER, alignItems: 'center' },
  td:          { fontSize: 13, paddingRight: 4, lineHeight: 18 },
  approvedChip:  { backgroundColor: GREEN_SOFT, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  approvedTxt:   { color: GREEN, fontSize: 11, fontWeight: '700' },
  approveBtn:    { backgroundColor: BRAND_MID, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  approveBtnTxt: { color: WHITE, fontSize: 11, fontWeight: '700' },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export const RequirementDetailScreen = ({ route, navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const queryClient = useQueryClient();
  const { state: authState } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const user = authState.session?.user;
  const { requirementId } = route.params;
  const [showSOW, setShowSOW] = useState(false);
  const [wageInput, setWageInput] = useState('');
  const [badgeModalVisible, setBadgeModalVisible] = useState(false);

  const userRole = user?.role ?? '';
  const isAgentOrWorker = userRole === 'agent' || userRole === 'selfworker' || userRole === 'worker';
  const isEmployer = userRole === 'employer' || userRole === 'admin' || userRole === 'superadmin';

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
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Failed to submit interest.'),
  });

  const handleExpressInterest = (): void => {
    if (!req) return;
    const wage = parseInt(wageInput, 10);
    if (!wage || isNaN(wage)) { toast.warning('Please enter your per-head wage quote.'); return; }
    const min = req.minBudgetPerWorker ?? 0;
    if (wage < min) { toast.warning(`Wage must be at least ₹${min}/${(req as any).salaryType?.toLowerCase() ?? 'day'}.`); return; }
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

  // Employer subscription — shares the same cache key as EmployerDashboardScreen
  // so if the dashboard already loaded the profile, this screen gets it instantly (no spinner).
  const { data: employerProfile, isSuccess: profileLoaded, isError: profileError } = useQuery({
    queryKey: ['employer-full-profile'],
    queryFn: async () => {
      const res = await apiClient.get<{ user?: { isSubscribed?: boolean; subscriptionExpery?: string; remainingContacts?: number; status?: string } }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    enabled: isEmployer,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true,
  });

  const isSubscribed = (() => {
    if (!isEmployer) return false;
    if (!profileLoaded) return false; // wait for real data — don't optimistically unlock
    if (!employerProfile?.isSubscribed) return false;
    const expiry = employerProfile.subscriptionExpery;
    if (!expiry) return true;
    return new Date(expiry).getTime() > Date.now();
  })();

  type IntrestedEntry = { agentId: string; agentRequiredWage?: number };
  const interestedIds = req?.intrestedAgents?.map((a: IntrestedEntry) => a.agentId) ?? [];
  const { data: interestedProfiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['interested-agent-profiles', interestedIds.join(',')],
    queryFn: () => workerApi.getAgentsByIds(interestedIds),
    enabled: isEmployer && interestedIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  type InterestedRow = { _id: string; name: string; phone: string; state?: string; district?: string; block?: string; status?: string; agentRequiredWage?: number };
  type ProfileData = { _id: string; name: string; phone: string; state?: string; district?: string; block?: string };

  // Always show all interested agents; enrich with profile data where available
  const interestedRows: InterestedRow[] = (req?.intrestedAgents ?? []).map((a: IntrestedEntry) => {
    const profile = interestedProfiles.find((p: ProfileData) => p._id === a.agentId);
    return {
      _id: a.agentId,
      name: profile?.name ?? '',
      phone: profile?.phone ?? '',
      state: profile?.state,
      district: profile?.district,
      agentRequiredWage: a.agentRequiredWage,
    };
  });

  if (isLoading) return <LoadingState message="Loading requirement details…" />;
  if (isError || !req) {
    const errMsg = error instanceof Error ? error.message : undefined;
    return (
      <ErrorState
        title={errMsg === 'Requirement not found' ? 'Requirement Not Found' : 'Unable to Load'}
        message={
          errMsg === 'Requirement not found'
            ? 'This requirement may have been deleted or you do not have access to it.'
            : 'Something went wrong. Please check your connection and try again.'
        }
        onRetry={() => void refetch()}
      />
    );
  }

  const statusRaw   = (req.status ?? '').toLowerCase();
  const isAssigned  = !!req.assignedAgentId;
  const isOpen      = !isAssigned && statusRaw !== 'closed' && statusRaw !== 'expired';
  const isClosed    = statusRaw === 'closed' || statusRaw === 'expired';
  const interestedAgents = req.intrestedAgents ?? [];
  const activePerks = Object.entries(perkIcon).filter(([key]) => (req as unknown as Record<string, unknown>)[key] === true);
  const isAlreadyInterested = req.intrestedAgents?.some((a: IntrestedEntry) => String(a.agentId) === String(user?.id)) ?? false;
  const isAssignedToMe = String(req.assignedAgentId) === String(user?.id);
  const sMeta = statusMeta(req.status, isAssigned);

  const handleClose = (): void => {
    Alert.alert('Close Requirement', 'Are you sure you want to close this requirement?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: () => closeMutation.mutate() },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />

      {/* ── Verified Badge Modal (for agent gate CTA) ────────────── */}
      <VerifiedBadgeModal
        visible={badgeModalVisible}
        onDismiss={() => setBadgeModalVisible(false)}
        userRole={user?.role ?? ''}
        userId={user?.id ?? ''}
        userName={user?.fullName ?? ''}
        userEmail={user?.email ?? ''}
        userPhone={user?.phone ?? ''}
      />

      {/* ── Premium Hero Header ──────────────────────────────────────────── */}
      <View style={[hero.wrap, { paddingTop: insets.top + 8 }]}>
        <View style={hero.deco1} />
        <View style={hero.deco2} />

        {/* Back row */}
        <View style={hero.navRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={hero.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <AppText style={hero.backArrow}>←</AppText>
          </TouchableOpacity>
          <AppText style={hero.navTitle} numberOfLines={1}>Requirement Details</AppText>
          {req.ERN_NUMBER ? (
            <View style={hero.ernChip}>
              <AppText style={hero.ernTxt}>#{req.ERN_NUMBER}</AppText>
            </View>
          ) : <View style={{ width: 60 }} />}
        </View>

        {/* Job title + status */}
        <View style={hero.titleRow}>
          <View style={{ flex: 1 }}>
            <AppText style={hero.jobTitle}>
              {fmtLabel(req.workType)}
            </AppText>
            {req.subCategory ? (
              <AppText style={hero.jobSubTitle}>{fmtLabel(req.subCategory)}</AppText>
            ) : null}
            {req.req_type ? (
              <AppText style={hero.jobType}>{fmtLabel(req.req_type)}</AppText>
            ) : null}
          </View>
          <View style={[hero.statusBadge, { backgroundColor: sMeta.bg, borderColor: sMeta.border }]}>
            <View style={[hero.statusDot, { backgroundColor: sMeta.color }]} />
            <AppText style={[hero.statusLabel, { color: sMeta.color }]}>{sMeta.label}</AppText>
          </View>
        </View>

        {/* Quick stat pills */}
        <View style={hero.pillsRow}>
          {(req.district || req.state) ? (
            <View style={hero.pill}>
              <AppText style={hero.pillIcon}>📍</AppText>
              <AppText style={hero.pillTxt} numberOfLines={1}>{[req.district, req.state].filter(Boolean).join(', ')}</AppText>
            </View>
          ) : null}
          {(req.minBudgetPerWorker != null) ? (
            <View style={[hero.pill, hero.pillGreen]}>
              <AppText style={hero.pillIcon}>₹</AppText>
              <AppText style={[hero.pillTxt, { color: GREEN_SOFT }]}>
                {req.minBudgetPerWorker}{req.maxBudgetPerWorker ? `–${req.maxBudgetPerWorker}` : ''}/{(req as any).salaryType?.toLowerCase() ?? 'day'}
              </AppText>
            </View>
          ) : null}
          {(req.workerQuantitySkilled != null || req.workerQuantityUnskilled != null) ? (
            <View style={hero.pill}>
              <AppText style={hero.pillIcon}>👷</AppText>
              <AppText style={hero.pillTxt}>{(req.workerQuantitySkilled ?? 0) + (req.workerQuantityUnskilled ?? 0)} workers</AppText>
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={pg.content}
        style={[pg.scroll, { backgroundColor: theme.colors.background }]}
      >
        {/* ── Info Grid ────────────────────────────────────────────────── */}
        <View style={[pg.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <SecHead title="Job Overview" />
          <View style={pg.grid}>
            {req.workerNeedDate ? (
              <InfoTile emoji="📅" label="Start Date" value={formatDate(req.workerNeedDate)} />
            ) : null}
            {req.estimated_days ? (
              <InfoTile emoji="⏱️" label="Duration" value={`${req.estimated_days} day${Number(req.estimated_days) > 1 ? 's' : ''}`} />
            ) : null}
            {(req.workerQuantitySkilled != null) ? (
              <InfoTile emoji="🧑‍🔧" label="Skilled Workers" value={String(req.workerQuantitySkilled)} accent={BRAND_MID} />
            ) : null}
            {(req.workerQuantityUnskilled != null) ? (
              <InfoTile emoji="👷" label="Unskilled Workers" value={String(req.workerQuantityUnskilled)} />
            ) : null}
            {(req.minBudgetPerWorker != null) ? (
              <InfoTile
                emoji="💰"
                label="Budget / Worker"
                value={`₹${req.minBudgetPerWorker} – ₹${req.maxBudgetPerWorker ?? req.minBudgetPerWorker}/${(req as any).salaryType?.toLowerCase() ?? 'day'}`}
                accent={GREEN}
              />
            ) : null}
            {req.workLocation ? (
              <InfoTile emoji="🗺️" label="Work Site" value={req.workLocation} />
            ) : null}
            {(req.inTime || req.outTime) ? (
              <InfoTile
                emoji="🕐"
                label="Shift Timing"
                value={`${formatTime(req.inTime)} – ${formatTime(req.outTime)}`}
              />
            ) : null}
            {req.createdAt ? (
              <InfoTile emoji="🗓️" label="Posted On" value={formatDate(req.createdAt)} />
            ) : null}
          </View>
        </View>

        {/* ── Perks & Benefits ─────────────────────────────────────────── */}
        {activePerks.length > 0 && (
          <View style={[pg.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <SecHead title="Perks & Benefits" accent={GREEN} />
            <View style={pg.perksWrap}>
              {activePerks.map(([, label]) => (
                <View key={label} style={pg.perkChip}>
                  <AppText style={pg.perkTxt}>{label}</AppText>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Remarks ──────────────────────────────────────────────────── */}
        {req.remarks ? (
          <View style={[pg.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <SecHead title="Additional Notes" accent={AMBER} />
            <View style={pg.remarksBox}>
              <AppText style={pg.remarksIcon}>📝</AppText>
              <AppText style={[pg.remarksTxt, { color: theme.colors.text }]}>{req.remarks}</AppText>
            </View>
          </View>
        ) : null}

        {/* ── Assigned Agent (employer view) ───────────────────────────── */}
        {isAssigned && !isAgentOrWorker && (
          <View style={[pg.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <SecHead title="Assigned Agent" accent="#7C3AED" />
            <View style={pg.assignedCard}>
              <View style={pg.assignedAvatar}>
                <AppText style={pg.assignedInitials}>
                  {(req.assignedAgentName ?? 'A').slice(0, 2).toUpperCase()}
                </AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={[pg.assignedName, { color: theme.colors.text }]}>
                  {req.assignedAgentName ?? '—'}
                </AppText>
                {req.finalAgentRequiredWage != null && (
                  <AppText style={pg.assignedWage}>₹{req.finalAgentRequiredWage}/day agreed</AppText>
                )}
                {req.assignedAgentPhone && (
                  <TouchableOpacity
                    onPress={() => void Linking.openURL(`tel:${req.assignedAgentPhone}`)}
                    style={pg.assignedCallRow}
                  >
                    <AppText style={pg.assignedPhone}>📞 {req.assignedAgentPhone}</AppText>
                  </TouchableOpacity>
                )}
              </View>
              <View style={pg.assignedBadge}>
                <AppText style={pg.assignedBadgeTxt}>✓ Assigned</AppText>
              </View>
            </View>
          </View>
        )}

        {/* ── Interested Agents (employer only) ────────────────────────── */}
        {isEmployer && !isAssigned && (
          <View style={[pg.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={pg.interestedHeader}>
              <SecHead title={`Interested Agents`} />
              {interestedAgents.length > 0 && (
                <View style={pg.countBadge}>
                  <AppText style={pg.countBadgeTxt}>{interestedAgents.length}</AppText>
                </View>
              )}
            </View>

            {/* While subscription status is loading, show spinner — prevents flash of wrong content */}
            {isEmployer && !profileLoaded && !profileError ? (
              <View style={pg.profilesLoading}>
                <ActivityIndicator size="small" color={BRAND} />
                <AppText style={{ fontSize: 12, color: SLATE }}>Checking subscription…</AppText>
              </View>
            ) : interestedAgents.length === 0 ? (
              <View style={pg.noAgentsWrap}>
                <View style={pg.noAgentsIconWrap}>
                  <AppText style={{ fontSize: 28 }}>👀</AppText>
                </View>
                <AppText style={[pg.noAgentsTitle, { color: theme.colors.text }]}>No agents yet</AppText>
                <AppText style={[pg.noAgentsSub, { color: theme.colors.mutedText }]}>
                  Agents who express interest will appear here.
                </AppText>
              </View>
            ) : !isSubscribed ? (
              /* ── Not subscribed — clean lock state, no blurred rows ── */
              <View>
                <View style={pg.lockCard}>
                  {/* Blurred preview rows — 2 visible, very faded */}
                  <View style={pg.lockPreview} pointerEvents="none">
                    {[0, 1].map((i) => (
                      <BlurredAgentRow key={i} idx={i} />
                    ))}
                    <View style={pg.lockPreviewFade} />
                  </View>

                  {/* Clean lock content */}
                  <View style={pg.lockContent}>
                    <View style={pg.subLockIcon}>
                      <AppText style={{ fontSize: 26 }}>🔒</AppText>
                    </View>
                    <AppText style={pg.subOverlayTitle}>
                      {interestedAgents.length} Agent{interestedAgents.length !== 1 ? 's' : ''} Interested
                    </AppText>
                    <AppText style={[pg.subOverlaySub, { color: theme.colors.mutedText }]}>
                      You don't have an active subscription. Subscribe to view agent profiles and contact them directly.
                    </AppText>
                    <TouchableOpacity style={pg.subOverlayBtn} onPress={() => navigation.navigate('Subscription')} activeOpacity={0.85}>
                      <AppText style={pg.subOverlayBtnTxt}>View Plans  →</AppText>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Suggestion tip */}
                {interestedAgents.length < 5 && (
                  <View style={pg.suggestionBox}>
                    <AppText style={{ fontSize: 16 }}>💡</AppText>
                    <AppText style={pg.suggestionTxt}>
                      <AppText style={pg.suggestionBold}>Tip: </AppText>
                      Few agents have responded. For faster hiring, browse workers directly and reach out to matching profiles.
                    </AppText>
                  </View>
                )}
              </View>
            ) : (
              /* ── Subscribed — show agent cards ── */
              <View>
                {profilesLoading && (
                  <View style={pg.profilesLoading}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <AppText style={{ fontSize: 12, color: theme.colors.mutedText }}>Loading agent details…</AppText>
                  </View>
                )}

                {interestedRows.map((agent, idx) => (
                  <AgentCard
                    key={agent._id}
                    agent={agent}
                    idx={idx}
                    isSubscribed={isSubscribed}
                    onProfile={() => navigation.navigate('WorkerProfile', { workerId: agent._id })}
                  />
                ))}

                {interestedAgents.length < 5 && (
                  <View style={pg.suggestionBox}>
                    <AppText style={{ fontSize: 16 }}>💡</AppText>
                    <AppText style={pg.suggestionTxt}>
                      <AppText style={pg.suggestionBold}>Tip: </AppText>
                      Few agents have responded. For faster hiring, browse workers directly and reach out to matching profiles.
                    </AppText>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── Express Interest (agent / self-worker) ────────────────────── */}
        {isAgentOrWorker && isOpen && (
          <View style={[pg.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <SecHead title="Express Interest" accent={GREEN} />
            {userRole === 'agent' && !user?.veryfiedBage ? (
              /* Agent without verified badge — gate access */
              <View style={pg.interestDone}>
                <View style={[pg.interestDoneIcon, { backgroundColor: AMBER_SOFT }]}>
                  <AppText style={{ fontSize: 26 }}>🏆</AppText>
                </View>
                <AppText style={[pg.interestDoneTitle, { color: AMBER }]}>Verified Badge Required</AppText>
                <AppText style={[pg.interestDoneSub, { color: theme.colors.mutedText }]}>
                  Only verified agents can show interest in requirements. Get your badge to unlock this feature.
                </AppText>
                <TouchableOpacity
                  style={[pg.expressBtn, { backgroundColor: AMBER, marginTop: 8 }]}
                  onPress={() => setBadgeModalVisible(true)}
                  activeOpacity={0.85}
                >
                  <AppText style={pg.expressBtnTxt}>🏆  Get Verified Badge</AppText>
                </TouchableOpacity>
              </View>
            ) : isAlreadyInterested ? (
              <View style={pg.interestDone}>
                <View style={pg.interestDoneIcon}><AppText style={{ fontSize: 26 }}>✅</AppText></View>
                <AppText style={pg.interestDoneTitle}>Interest Already Shown</AppText>
                <AppText style={[pg.interestDoneSub, { color: theme.colors.mutedText }]}>
                  The employer has been notified. You'll be contacted if selected.
                </AppText>
              </View>
            ) : (
              <View style={pg.interestForm}>
                <View style={pg.minWageRow}>
                  <AppText style={pg.minWageLabel}>Minimum wage by employer</AppText>
                  <View style={pg.minWagePill}>
                    <AppText style={pg.minWagePillTxt}>₹{req.minBudgetPerWorker ?? 0}/{(req as any).salaryType?.toLowerCase() ?? 'day'}</AppText>
                  </View>
                </View>
                <TextInput
                  style={[pg.wageInput, { backgroundColor: theme.colors.surface1, borderColor: theme.colors.border, color: theme.colors.text }]}
                  value={wageInput}
                  onChangeText={setWageInput}
                  placeholder={`Your quote (min ₹${req.minBudgetPerWorker ?? 0}/${(req as any).salaryType?.toLowerCase() ?? 'day'})`}
                  placeholderTextColor={theme.colors.mutedText}
                  keyboardType="number-pad"
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[pg.expressBtn, { backgroundColor: expressInterestMutation.isPending ? theme.colors.border : BRAND }]}
                  onPress={handleExpressInterest}
                  disabled={expressInterestMutation.isPending || !wageInput}
                  activeOpacity={0.85}
                >
                  <AppText style={pg.expressBtnTxt}>
                    {expressInterestMutation.isPending ? 'Submitting…' : '🤝  Show Interest'}
                  </AppText>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── Assigned to Me (agent view) ───────────────────────────────── */}
        {isAgentOrWorker && isAssignedToMe && (
          <View style={[pg.section, { backgroundColor: '#F0FDF4', borderColor: GREEN_BDR }]}>
            <View style={pg.assignedMeWrap}>
              <AppText style={{ fontSize: 36 }}>🏆</AppText>
              <AppText style={pg.assignedMeTitle}>You're Assigned!</AppText>
              <AppText style={[pg.assignedMeSub, { color: SLATE }]}>
                Agreed wage: ₹{req.finalAgentRequiredWage ?? req.minBudgetPerWorker ?? 0}/{(req as any).salaryType?.toLowerCase() ?? 'day'}
              </AppText>
              <TouchableOpacity style={pg.sowBtn2} onPress={() => setShowSOW(true)} activeOpacity={0.85}>
                <AppText style={pg.sowBtnTxt}>📋  View Statement of Work</AppText>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Action Buttons (employer only) ────────────────────────────── */}
        {!isAgentOrWorker && (
          <View style={pg.actionRow}>
            {isAssigned && (
              <TouchableOpacity style={pg.sowBtn} onPress={() => setShowSOW(true)} activeOpacity={0.88}>
                <AppText style={pg.sowBtnIcon}>📋</AppText>
                <AppText style={pg.sowBtnLabel}>Statement of Work</AppText>
              </TouchableOpacity>
            )}
            {!isClosed && (
              <TouchableOpacity
                style={pg.closeBtn}
                onPress={handleClose}
                disabled={closeMutation.isPending}
                activeOpacity={0.88}
              >
                <AppText style={pg.closeBtnTxt}>
                  {closeMutation.isPending ? 'Closing…' : '🔒  Close Requirement'}
                </AppText>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <SOWModal visible={showSOW} onClose={() => setShowSOW(false)} requirementId={requirementId} employerId={user?.id} />
    </View>
  );
};

// ─── Hero styles ───────────────────────────────────────────────────────────────
const hero = StyleSheet.create({
  wrap:        { backgroundColor: BRAND, paddingHorizontal: 18, paddingBottom: 24, overflow: 'hidden' },
  deco1:       { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,255,255,0.05)', top: -90, right: -70 },
  deco2:       { position: 'absolute', width: 140, height: 140, borderRadius: 70,  backgroundColor: 'rgba(255,255,255,0.05)', bottom: -40, left: -30 },
  navRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  backArrow:   { color: WHITE, fontSize: 18, fontWeight: '600', lineHeight: 22 },
  navTitle:    { flex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', marginHorizontal: 8 },
  ernChip:     { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  ernTxt:      { color: WHITE, fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  titleRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  jobTitle:    { color: WHITE, fontSize: 20, fontWeight: '900', lineHeight: 26, letterSpacing: -0.3 },
  jobSubTitle: { color: 'rgba(255,255,255,0.88)', fontSize: 15, fontWeight: '700', marginTop: 3, lineHeight: 20 },
  jobType:     { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', marginTop: 4 },
  statusBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  pillsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  pillGreen:   { backgroundColor: 'rgba(5,150,105,0.35)' },
  pillIcon:    { fontSize: 12, color: WHITE },
  pillTxt:     { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
});

// ─── Page / section styles ─────────────────────────────────────────────────────
const pg = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: 16, paddingTop: 18, gap: 12 },

  section:  { borderRadius: 18, borderWidth: 1, padding: 16, elevation: 1, shadowColor: NAVY, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  perksWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  perkChip:  { flexDirection: 'row', alignItems: 'center', backgroundColor: GREEN_SOFT, borderRadius: 20, borderWidth: 1, borderColor: GREEN_BDR, paddingHorizontal: 12, paddingVertical: 5 },
  perkTxt:   { fontSize: 12, fontWeight: '700', color: GREEN },

  remarksBox:  { flexDirection: 'row', gap: 10, backgroundColor: AMBER_SOFT, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A', padding: 12 },
  remarksIcon: { fontSize: 18 },
  remarksTxt:  { flex: 1, fontSize: 13, lineHeight: 20, fontWeight: '500' },

  // Assigned agent card
  assignedCard:    { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#F5F3FF', borderRadius: 14, padding: 14 },
  assignedAvatar:  { width: 52, height: 52, borderRadius: 26, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#C4B5FD' },
  assignedInitials:{ fontSize: 18, fontWeight: '800', color: '#7C3AED' },
  assignedName:    { fontSize: 15, fontWeight: '800', marginBottom: 2, textTransform: 'capitalize' },
  assignedWage:    { fontSize: 12, color: GREEN, fontWeight: '700', marginBottom: 3 },
  assignedCallRow: {},
  assignedPhone:   { fontSize: 13, color: BRAND_MID, fontWeight: '600' },
  assignedBadge:   { backgroundColor: '#7C3AED', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  assignedBadgeTxt:{ fontSize: 11, fontWeight: '800', color: WHITE },

  // Interested agents section
  interestedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  countBadge:       { backgroundColor: BRAND, borderRadius: 99, width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  countBadgeTxt:    { color: WHITE, fontSize: 12, fontWeight: '800' },

  noAgentsWrap:    { alignItems: 'center', paddingVertical: 24, gap: 8 },
  noAgentsIconWrap:{ width: 64, height: 64, borderRadius: 32, backgroundColor: BRAND_SOFT, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  noAgentsTitle:   { fontSize: 15, fontWeight: '800' },
  noAgentsSub:     { fontSize: 12, textAlign: 'center', lineHeight: 18 },

  profilesLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },

  // ── Subscription lock card ────────────────────────────────────────────────
  lockCard:       { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: BORDER, marginBottom: 12 },
  lockPreview:    { opacity: 0.35, paddingHorizontal: 4 },
  lockPreviewFade:{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, backgroundColor: 'rgba(248,250,252,0.95)' },
  lockContent:    { alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24, gap: 10, backgroundColor: 'rgba(248,250,252,0.97)' },
  subLockIcon:   { width: 60, height: 60, borderRadius: 30, backgroundColor: BRAND_SOFT, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  subOverlayTitle:{ fontSize: 16, fontWeight: '900', color: NAVY, textAlign: 'center' },
  subOverlaySub:  { fontSize: 13, textAlign: 'center', lineHeight: 19, color: SLATE, maxWidth: 260 },
  subOverlayBtn:  { marginTop: 4, backgroundColor: BRAND, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 13 },
  subOverlayBtnTxt:{ color: WHITE, fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },

  suggestionBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: AMBER_SOFT, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A', padding: 12, marginTop: 12 },
  suggestionTxt:  { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },
  suggestionBold: { fontWeight: '800', color: '#92400E' },

  // Express interest
  interestDone:     { alignItems: 'center', paddingVertical: 20, gap: 8 },
  interestDoneIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: GREEN_SOFT, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  interestDoneTitle:{ fontSize: 15, fontWeight: '800', color: GREEN },
  interestDoneSub:  { fontSize: 12, textAlign: 'center', lineHeight: 18 },

  interestForm:  { gap: 12 },
  minWageRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  minWageLabel:  { fontSize: 12, color: SLATE, fontWeight: '600' },
  minWagePill:   { backgroundColor: GREEN_SOFT, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: GREEN_BDR },
  minWagePillTxt:{ fontSize: 12, fontWeight: '700', color: GREEN },
  wageInput:     { height: 50, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16, fontSize: 15, fontWeight: '600' },
  expressBtn:    { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  expressBtnTxt: { color: WHITE, fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },

  // Assigned to me
  assignedMeWrap:  { alignItems: 'center', paddingVertical: 8, gap: 8 },
  assignedMeTitle: { fontSize: 18, fontWeight: '900', color: GREEN },
  assignedMeSub:   { fontSize: 13, fontWeight: '600' },
  sowBtn2:         { marginTop: 6, backgroundColor: GREEN, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  sowBtnTxt:       { color: WHITE, fontSize: 14, fontWeight: '800' },

  // Action buttons
  actionRow:  { gap: 10 },
  sowBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND, borderRadius: 16, padding: 16 },
  sowBtnIcon: { fontSize: 18 },
  sowBtnLabel:{ color: WHITE, fontSize: 15, fontWeight: '800' },
  closeBtn:   { borderWidth: 1.5, borderColor: RED, borderRadius: 16, padding: 16, alignItems: 'center' },
  closeBtnTxt:{ color: RED, fontSize: 14, fontWeight: '700' },
});
