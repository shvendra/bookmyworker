import { type NativeStackScreenProps, type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { showAlert } from '../../../shared/state/alert/AppAlertContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { RawRequirement } from '../../../core/api/endpoints/requirementsApi';
import { apiClient } from '../../../core/api/client';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import { workerMappingApi } from '../../../core/api/endpoints/workerMappingApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { useAppTheme } from '../../../core/theme';
import { useAuth } from '../../../state/auth/AuthContext';
import i18n from '../../../core/i18n';
import { getLocationStr } from '../../../shared/utils/labelUtils';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { VerifiedBadgeModal } from '../../../shared/components/ui/VerifiedBadgeModal';
import { ratingApi } from '../../../core/api/endpoints/ratingApi';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtLabel = (s?: string | null): string => {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const getSalaryType = (req: RawRequirement): string => {
  const raw = (req as Record<string, unknown>).salaryType;
  if (typeof raw === 'string' && raw.length > 0) return raw.toLowerCase();
  const budget = req.minBudgetPerWorker ?? 0;
  if (budget >= 10000) return 'month';
  if (budget >= 500) return 'day';
  return 'day';
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
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View style={[tile.wrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
      <View style={[tile.iconBox, { backgroundColor: accent ? accent + '18' : BRAND_SOFT }]}>
        <AppText style={tile.emoji}>{emoji}</AppText>
      </View>
      <AppText style={[tile.label, { color: theme.colors.mutedText }]}>{label}</AppText>
      <AppText style={[tile.value, { color: theme.colors.text }, accent ? { color: accent } : {}]} numberOfLines={2}>{value}</AppText>
    </View>
  );
};
const tile = StyleSheet.create({
  wrap:    { width: '48%', borderRadius: 14, borderWidth: 1, padding: 12, gap: 6 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  emoji:   { fontSize: 18 },
  label:   { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  value:   { fontSize: 13, fontWeight: '700', lineHeight: 18 },
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
  const [unlocking,     setUnlocking]     = useState(false);
  const [unlockError,   setUnlockError]   = useState<string | null>(null);
  const [alreadyHired,  setAlreadyHired]  = useState(false);

  const initials = (agent.name || `A${idx + 1}`).slice(0, 2).toUpperCase();
  const location = getLocationStr({ district: agent.district, state: agent.state }, i18n.language, '');
  const colors = [
    { bg: '#EBF1FF', text: BRAND_MID },
    { bg: '#F5F3FF', text: '#7C3AED' },
    { bg: '#ECFDF5', text: GREEN },
    { bg: '#FFF7ED', text: '#EA580C' },
  ];
  const palette = colors[idx % colors.length]!;

  const handleReveal = async (): Promise<void> => {
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
        setAlreadyHired(res.alreadyHired === true);
      } else {
        const msg = res.message ?? 'Unable to view contact. Please check your subscription.';
        setUnlockError(msg);
        toast.error(msg, 'Access Denied');
        if (msg.toLowerCase().includes('subscri') || msg.toLowerCase().includes('expired')) {
          navigation.navigate('Subscription');
        }
      }
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string; code?: string } }; message?: string };
      const data   = errObj?.response?.data;
      const code   = data?.code;
      const msg    = data?.message ?? errObj?.message ?? 'Unable to view contact.';
      setUnlockError(msg);
      if (code === 'SUBSCRIPTION_EXPIRED' || code === 'SUBSCRIPTION_REQUIRED' || code === 'CONTACT_LIMIT') {
        navigation.navigate('Subscription');
      }
    } finally {
      setUnlocking(false);
    }
  };

  // Contact is blocked only when subscription is expired AND worker is not already hired
  const isContactBlocked = !isSubscribed && !alreadyHired && !unlockedPhone;

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
        {isContactBlocked ? (
          <TouchableOpacity
            onPress={() => void handleReveal()}
            style={ac.lockedChip}
            activeOpacity={0.75}
          >
            <AppText style={ac.lockedIcon}>🔒</AppText>
            <AppText style={ac.lockedTxt}>Check</AppText>
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
        <View style={[ac.phoneRevealedRow, alreadyHired && { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' }]}>
          {alreadyHired && (
            <AppText style={ac.hiredBadge}>🤝 Already hired — free</AppText>
          )}
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
      {!!unlockError && !isContactBlocked && (
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
  phoneRevealedRow:   { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', backgroundColor: GREEN_SOFT, borderRadius: 10, borderWidth: 1, borderColor: GREEN_BDR, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8, gap: 8 },
  phoneRevealedLeft:  { flex: 1, minWidth: 120 },
  phoneRevealedLabel: { fontSize: 10, fontWeight: '700', color: GREEN, textTransform: 'uppercase', letterSpacing: 0.5 },
  phoneRevealedNum:   { fontSize: 15, fontWeight: '800', color: '#0f172a', marginTop: 2 },
  hiredBadge:         { width: '100%', fontSize: 11, fontWeight: '700', color: '#059669' },
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

// ─── Status Pipeline ──────────────────────────────────────────────────────────
const PIPE_LABELS = ['Posted', 'Responding', 'Shortlisted', 'Hired', 'Completed'] as const;

function deriveStageIdx(
  req: RawRequirement,
  grouped?: { Shortlisted: unknown[]; Selected: unknown[]; Joined: unknown[] },
): number {
  const s = (req.status ?? '').toLowerCase();
  if (s === 'completed') return 4;
  if ((grouped?.Joined.length ?? 0) > 0) return 3;
  if (s === 'active' && !grouped) return 3;
  if ((grouped?.Shortlisted.length ?? 0) > 0 || (grouped?.Selected.length ?? 0) > 0) return 2;
  if (req.assignedAgentId && !grouped) return 2;
  if ((req.intrestedAgents ?? []).length > 0) return 1;
  return 0;
}

function StatusPipeline({ req, grouped }: {
  req: RawRequirement;
  grouped?: { Shortlisted: unknown[]; Selected: unknown[]; Joined: unknown[] };
}): React.JSX.Element {
  const statusRaw   = (req.status ?? '').toLowerCase();
  const isCancelled = statusRaw === 'cancelled';
  const activeIdx   = isCancelled ? -1 : deriveStageIdx(req, grouped);

  return (
    <View style={pipe.wrap}>
      <View style={pipe.stepsRow}>
        {PIPE_LABELS.map((label, i) => {
          const done    = activeIdx >= 0 && i < activeIdx;
          const current = activeIdx >= 0 && i === activeIdx;
          const filled  = done || current;

          const circleColor = filled ? BRAND : WHITE;
          const ringColor   = filled ? BRAND : isCancelled ? '#9CA3AF' : '#CBD5E1';
          const labelColor  = current ? BRAND : done ? '#475569' : isCancelled ? '#9CA3AF' : '#94A3B8';
          const leftLine    = i > 0 ? (done || current ? BRAND : '#CBD5E1') : 'transparent';
          const rightLine   = i < PIPE_LABELS.length - 1 ? (done ? BRAND : '#CBD5E1') : 'transparent';

          return (
            <View key={label} style={pipe.step}>
              <View style={pipe.connRow}>
                <View style={[pipe.connLine, { backgroundColor: leftLine }]} />
                <View style={[pipe.circle, { backgroundColor: circleColor, borderColor: ringColor }]}>
                  <AppText style={[pipe.circleNum, { color: filled ? WHITE : ringColor }]}>
                    {done ? '✓' : String(i + 1)}
                  </AppText>
                </View>
                <View style={[pipe.connLine, { backgroundColor: rightLine }]} />
              </View>
              <AppText
                style={[pipe.stepLabel, { color: labelColor, fontWeight: current ? '800' : '600' }]}
                numberOfLines={2}
              >
                {label}
              </AppText>
            </View>
          );
        })}
      </View>

      {isCancelled && (
        <View style={pipe.cancelRow}>
          <AppText style={pipe.cancelTxt}>✕  This requirement was cancelled</AppText>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export const RequirementDetailScreen = ({ route, navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const queryClient = useQueryClient();
  const { state: authState } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const user = authState.session?.user;
  const { requirementId } = route.params;
  const [wageInput, setWageInput] = useState('');
  const [badgeModalVisible, setBadgeModalVisible] = useState(false);

  // Propose-worker modal (agent)
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [proposeWorkerName, setProposeWorkerName] = useState('');
  const [proposeWorkerPhone, setProposeWorkerPhone] = useState('');

  // Respond-to-proposal state (employer)
  const [rejectReasonInputId, setRejectReasonInputId] = useState<string | null>(null);
  const [rejectReasonText, setRejectReasonText] = useState('');

  // Rate Workers modal state
  const [showRateModal, setShowRateModal] = useState(false);
  const [ratingStars, setRatingStars] = useState<Record<string, number>>({});
  const [ratingComment, setRatingComment] = useState<Record<string, string>>({});
  const [ratingSaving, setRatingSaving] = useState(false);

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
    if (wage < min) { toast.warning(`Wage must be at least ₹${min}/${getSalaryType(req)}.`); return; }
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

  const proposeWorkerMutation = useMutation({
    mutationFn: ({ workerName, workerPhone }: { workerName: string; workerPhone: string }) =>
      apiClient.post(`/api/v1/mobile/requirements/${requirementId}/propose-worker`, { workerName, workerPhone }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['requirement', requirementId] });
      setShowProposeModal(false);
      setProposeWorkerName('');
      setProposeWorkerPhone('');
      toast.success('Worker proposed successfully. Waiting for employer approval.', 'Proposed');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message ?? 'Failed to propose worker.', 'Error');
    },
  });

  const respondProposalMutation = useMutation({
    mutationFn: ({ workerKey, isPhone, status, rejectionReason }: { workerKey: string; isPhone: boolean; status: 'approved' | 'rejected'; rejectionReason?: string }) =>
      apiClient.put(`/api/v1/mobile/requirements/${requirementId}/worker-response`, {
        ...(isPhone ? { workerPhone: workerKey } : { workerId: workerKey }),
        status,
        rejectionReason,
      }),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['requirement', requirementId] });
      setRejectReasonInputId(null);
      setRejectReasonText('');
      toast.success(`Worker ${vars.status} successfully.`, vars.status === 'approved' ? 'Approved' : 'Rejected');
    },
    onError: () => toast.error('Failed to update worker status. Please try again.', 'Error'),
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

  // Pipeline mapping counts for this requirement — drives the progress stepper
  const { data: mappingData } = useQuery({
    queryKey: ['requirement-mappings', requirementId],
    queryFn: () => workerMappingApi.getRequirementMappings(requirementId),
    enabled: isEmployer,
    staleTime: 60 * 1000,
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
    showAlert('Close Requirement', 'Are you sure you want to close this requirement?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: () => closeMutation.mutate() },
    ]);
  };

  const handleRepost = (): void => {
    if (!req) return;
    navigation.navigate('PostRequirement', {
      prefill: {
        workType:               req.workType,
        subCategory:            req.subCategory,
        reqType:                req.req_type as string | undefined,
        state:                  req.state,
        district:               req.district,
        tehsil:                 req.tehsil,
        workerQuantitySkilled:  req.workerQuantitySkilled,
        salaryType:             req.salaryType,
        budgetPerWorker:        req.budgetPerWorker,
        minBudgetPerWorker:     req.minBudgetPerWorker,
        maxBudgetPerWorker:     req.maxBudgetPerWorker,
        remarks:                req.remarks,
        inTime:                 req.inTime,
        outTime:                req.outTime,
        accommodationAvailable: req.accommodationAvailable,
        foodAvailable:          req.foodAvailable,
        transportProvided:      req.transportProvided,
        weeklyOff:              req.weeklyOff,
        overtimeAvailable:      req.overtimeAvailable,
        incentive:              req.incentive,
        bonus:                  req.bonus,
      },
    });
  };

  // const handleMarkAttendance = (): void => {
  //   if (!req) return;
  //   navigation.navigate('EmployerAttendance', {
  //     requirementId,
  //     requirementTitle: req.workType
  //       ? req.workType.replace(/_/g, ' ') + (req.subCategory ? ` · ${req.subCategory.replace(/_/g, ' ')}` : '')
  //       : undefined,
  //   });
  // };

  const handleDocumentHub = (): void => {
    if (!req) return;
    navigation.navigate('DocumentHub', {
      requirementId,
      requirementTitle: req.workType
        ? req.workType.replace(/_/g, ' ') + (req.subCategory ? ` · ${req.subCategory.replace(/_/g, ' ')}` : '')
        : undefined,
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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
              <AppText style={hero.pillTxt} numberOfLines={1}>{getLocationStr({ district: req.district, state: req.state }, i18n.language, '')}</AppText>
            </View>
          ) : null}
          {(req.minBudgetPerWorker != null) ? (
            <View style={[hero.pill, hero.pillGreen]}>
              <AppText style={hero.pillIcon}>₹</AppText>
              <AppText style={[hero.pillTxt, { color: GREEN_SOFT }]}>
                {req.minBudgetPerWorker}{req.maxBudgetPerWorker ? `–${req.maxBudgetPerWorker}` : ''}/{getSalaryType(req)}
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
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Status Pipeline ──────────────────────────────────────────── */}
        <StatusPipeline req={req} grouped={mappingData?.grouped} />

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
                value={`₹${req.minBudgetPerWorker} – ₹${req.maxBudgetPerWorker ?? req.minBudgetPerWorker}/${getSalaryType(req)}`}
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

        {/* ── Proposed Workers (employer view — after agent assigned) ─── */}
        {isEmployer && isAssigned && (
          <View style={[pg.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={pg.interestedHeader}>
              <SecHead title="Proposed Workers" accent={GREEN} />
              {(req.proposedWorkers ?? []).length > 0 && (
                <View style={[pg.countBadge, { backgroundColor: GREEN }]}>
                  <AppText style={pg.countBadgeTxt}>{(req.proposedWorkers ?? []).length}</AppText>
                </View>
              )}
            </View>

            {(req.proposedWorkers ?? []).length === 0 ? (
              <View style={pg.noAgentsWrap}>
                <View style={pg.noAgentsIconWrap}>
                  <AppText style={{ fontSize: 28 }}>👷</AppText>
                </View>
                <AppText style={[pg.noAgentsTitle, { color: theme.colors.text }]}>No workers proposed yet</AppText>
                <AppText style={[pg.noAgentsSub, { color: theme.colors.mutedText }]}>
                  Your assigned agent will propose workers for your approval.
                </AppText>
              </View>
            ) : (
              (req.proposedWorkers ?? []).map((pw, idx) => {
                const statusColor = pw.status === 'approved' ? GREEN : pw.status === 'rejected' ? RED : AMBER;
                const statusBg    = pw.status === 'approved' ? GREEN_SOFT : pw.status === 'rejected' ? '#FEF2F2' : AMBER_SOFT;
                const statusLabel = pw.status === 'approved' ? '✓ Approved' : pw.status === 'rejected' ? '✗ Rejected' : '● Pending';
                const isPhone     = !pw.workerId;
                const workerKey   = pw.workerId ?? pw.workerPhone ?? String(idx);
                const showRejectInput = rejectReasonInputId === workerKey;

                return (
                  <View key={workerKey} style={pws.row}>
                    <View style={pws.avatar}>
                      <AppText style={pws.initials}>{(pw.workerName ?? 'W').slice(0, 2).toUpperCase()}</AppText>
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <AppText style={pws.name}>{pw.workerName ?? '—'}</AppText>
                      <AppText style={pws.phone}>📞 {pw.workerPhone ?? '—'}</AppText>
                      {pw.status === 'rejected' && pw.rejectionReason ? (
                        <AppText style={pws.reason}>Reason: {pw.rejectionReason}</AppText>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <View style={[pws.statusChip, { backgroundColor: statusBg }]}>
                        <AppText style={[pws.statusTxt, { color: statusColor }]}>{statusLabel}</AppText>
                      </View>

                      {pw.status === 'pending' && !showRejectInput && (
                        <View style={pws.actionBtns}>
                          <TouchableOpacity
                            style={pws.approveBtn}
                            onPress={() => respondProposalMutation.mutate({ workerKey, isPhone, status: 'approved' })}
                            disabled={respondProposalMutation.isPending}
                            activeOpacity={0.8}
                          >
                            <AppText style={pws.approveTxt}>Approve</AppText>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={pws.rejectBtn}
                            onPress={() => { setRejectReasonInputId(workerKey); setRejectReasonText(''); }}
                            activeOpacity={0.8}
                          >
                            <AppText style={pws.rejectTxt}>Reject</AppText>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {showRejectInput && (
                      <View style={pws.rejectInputWrap}>
                        <TextInput
                          style={pws.rejectInput}
                          value={rejectReasonText}
                          onChangeText={setRejectReasonText}
                          placeholder="Reason for rejection (optional)"
                          placeholderTextColor={SLATE}
                          autoFocus
                        />
                        <View style={pws.rejectConfirmRow}>
                          <TouchableOpacity onPress={() => setRejectReasonInputId(null)} style={pws.rejectCancelChip} activeOpacity={0.8}>
                            <AppText style={{ fontSize: 12, color: SLATE, fontWeight: '600' }}>Cancel</AppText>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={pws.rejectConfirmBtn}
                            onPress={() => respondProposalMutation.mutate({ workerKey, isPhone, status: 'rejected', rejectionReason: rejectReasonText.trim() })}
                            disabled={respondProposalMutation.isPending}
                            activeOpacity={0.85}
                          >
                            <AppText style={{ fontSize: 12, color: WHITE, fontWeight: '700' }}>{respondProposalMutation.isPending ? '…' : 'Confirm Reject'}</AppText>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}
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
                    <AppText style={pg.minWagePillTxt}>₹{req.minBudgetPerWorker ?? 0}/{getSalaryType(req)}</AppText>
                  </View>
                </View>
                <TextInput
                  style={[pg.wageInput, { backgroundColor: theme.colors.surface1, borderColor: theme.colors.border, color: theme.colors.text }]}
                  value={wageInput}
                  onChangeText={setWageInput}
                  placeholder={`Your quote (min ₹${req.minBudgetPerWorker ?? 0}/${getSalaryType(req)})`}
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
          <>
            <View style={[pg.section, { backgroundColor: '#F0FDF4', borderColor: GREEN_BDR }]}>
              <View style={pg.assignedMeWrap}>
                <AppText style={{ fontSize: 36 }}>🏆</AppText>
                <AppText style={pg.assignedMeTitle}>You're Assigned!</AppText>
                <AppText style={[pg.assignedMeSub, { color: SLATE }]}>
                  Agreed wage: ₹{req.finalAgentRequiredWage ?? req.minBudgetPerWorker ?? 0}/{getSalaryType(req)}
                </AppText>
              </View>
            </View>

            {/* Propose Workers panel */}
            <View style={[pg.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={[pg.interestedHeader, { marginBottom: 8 }]}>
                <SecHead title="Proposed Workers" accent={BRAND} />
                <TouchableOpacity style={pws.proposeBtn} onPress={() => setShowProposeModal(true)} activeOpacity={0.85}>
                  <AppText style={pws.proposeBtnTxt}>+ Propose</AppText>
                </TouchableOpacity>
              </View>

              {(req.proposedWorkers ?? []).length === 0 ? (
                <AppText style={{ fontSize: 12, color: SLATE, textAlign: 'center', paddingVertical: 16 }}>
                  No workers proposed yet. Tap "+ Propose" to add one.
                </AppText>
              ) : (
                (req.proposedWorkers ?? []).map((pw, idx) => {
                  const statusColor = pw.status === 'approved' ? GREEN : pw.status === 'rejected' ? RED : AMBER;
                  const statusBg    = pw.status === 'approved' ? GREEN_SOFT : pw.status === 'rejected' ? '#FEF2F2' : AMBER_SOFT;
                  const statusLabel = pw.status === 'approved' ? '✓ Approved' : pw.status === 'rejected' ? '✗ Rejected' : '● Pending';
                  const workerKey   = pw.workerId ?? pw.workerPhone ?? String(idx);

                  return (
                    <View key={workerKey} style={[pws.row, { flexWrap: 'nowrap' }]}>
                      <View style={pws.avatar}>
                        <AppText style={pws.initials}>{(pw.workerName ?? 'W').slice(0, 2).toUpperCase()}</AppText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText style={pws.name}>{pw.workerName ?? '—'}</AppText>
                        <AppText style={pws.phone}>📞 {pw.workerPhone ?? '—'}</AppText>
                        {pw.status === 'rejected' && pw.rejectionReason ? (
                          <AppText style={pws.reason}>Reason: {pw.rejectionReason}</AppText>
                        ) : null}
                      </View>
                      <View style={[pws.statusChip, { backgroundColor: statusBg }]}>
                        <AppText style={[pws.statusTxt, { color: statusColor }]}>{statusLabel}</AppText>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        {/* ── Action Buttons (employer only) ────────────────────────────── */}
        {!isAgentOrWorker && (
          <View style={pg.actionRow}>
            {/* Mark Attendance removed */}
            {false && !isClosed && (
              <TouchableOpacity
                style={pg.attendanceBtn}
                onPress={() => {}}
                activeOpacity={0.88}
              >
                <AppText style={pg.attendanceBtnTxt}>📋  Mark Attendance & Track Salary</AppText>
              </TouchableOpacity>
            )}

            {/* Document Hub — always available */}
            <TouchableOpacity
              style={pg.documentsBtn}
              onPress={handleDocumentHub}
              activeOpacity={0.88}
            >
              <AppText style={pg.documentsBtnTxt}>📁  Documents & Agreements</AppText>
            </TouchableOpacity>

            {/* Repost — always available to reuse this requirement config */}
            <TouchableOpacity
              style={pg.repostBtn}
              onPress={handleRepost}
              activeOpacity={0.88}
            >
              <AppText style={pg.repostBtnTxt}>🔁  Repost This Requirement</AppText>
            </TouchableOpacity>

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

            {/* Rate Workers button — shown when requirement is Closed/Completed */}
            {isClosed && (req?.proposedWorkers?.some((pw) => pw.status === 'approved') || (req?.intrestedAgents?.length ?? 0) > 0) && (
              <TouchableOpacity
                style={pg.rateBtn}
                onPress={() => setShowRateModal(true)}
                activeOpacity={0.88}
              >
                <AppText style={pg.rateBtnTxt}>⭐  Rate Your Workers</AppText>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Propose Worker Modal (agent) ──────────────────────────────── */}
      <Modal
        visible={showProposeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowProposeModal(false)}
      >
        <View style={pw.backdrop}>
          <View style={[pw.sheet, { backgroundColor: WHITE }]}>
            <View style={pw.sheetHandle} />
            <AppText style={pw.sheetTitle}>Propose a Worker</AppText>
            <AppText style={pw.sheetSub}>Enter the worker's details. We'll link their account automatically if they're registered.</AppText>

            <AppText style={pw.fieldLabel}>Worker Name</AppText>
            <TextInput
              style={pw.input}
              value={proposeWorkerName}
              onChangeText={setProposeWorkerName}
              placeholder="Full name"
              placeholderTextColor={SLATE}
              autoCapitalize="words"
            />

            <AppText style={pw.fieldLabel}>Mobile Number</AppText>
            <TextInput
              style={pw.input}
              value={proposeWorkerPhone}
              onChangeText={setProposeWorkerPhone}
              placeholder="10-digit mobile number"
              placeholderTextColor={SLATE}
              keyboardType="phone-pad"
              maxLength={10}
            />

            <View style={pw.btnRow}>
              <TouchableOpacity style={pw.cancelBtn} onPress={() => setShowProposeModal(false)} activeOpacity={0.8}>
                <AppText style={pw.cancelTxt}>Cancel</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[pw.submitBtn, (proposeWorkerMutation.isPending || !proposeWorkerName || proposeWorkerPhone.length < 10) && { opacity: 0.55 }]}
                onPress={() => proposeWorkerMutation.mutate({ workerName: proposeWorkerName.trim(), workerPhone: proposeWorkerPhone.trim() })}
                disabled={proposeWorkerMutation.isPending || !proposeWorkerName || proposeWorkerPhone.length < 10}
                activeOpacity={0.85}
              >
                <AppText style={pw.submitTxt}>{proposeWorkerMutation.isPending ? 'Submitting…' : 'Submit'}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Rate Workers Modal ────────────────────────────────────────────── */}
      {isEmployer && showRateModal && req && (
        <Modal visible animationType="slide" transparent onRequestClose={() => setShowRateModal(false)}>
          <View style={rm.overlay}>
            <View style={rm.sheet}>
              {/* Header */}
              <View style={rm.header}>
                <View style={{ flex: 1 }}>
                  <AppText style={rm.headerTitle}>⭐ Rate Your Workers</AppText>
                  <AppText style={rm.headerSub}>How did they perform on this requirement?</AppText>
                </View>
                <TouchableOpacity onPress={() => setShowRateModal(false)} style={rm.closeBtn}>
                  <AppText style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18, fontWeight: '700' }}>✕</AppText>
                </TouchableOpacity>
              </View>

              <ScrollView style={rm.body} showsVerticalScrollIndicator={false}>
                {/* Approved proposed workers */}
                {(req.proposedWorkers ?? []).filter((pw) => pw.status === 'approved').map((pw) => {
                  const key = pw.workerId ?? pw.workerPhone ?? '';
                  if (!key) return null;
                  const stars = ratingStars[key] ?? 0;
                  return (
                    <View key={key} style={rm.workerCard}>
                      <View style={rm.workerRow}>
                        <View style={rm.avatar}>
                          <AppText style={rm.initials}>{(pw.workerName ?? 'W')[0]?.toUpperCase() ?? 'W'}</AppText>
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText style={rm.workerName}>{pw.workerName ?? 'Worker'}</AppText>
                          {pw.workerPhone ? <AppText style={rm.workerPhone}>{pw.workerPhone}</AppText> : null}
                        </View>
                      </View>
                      {/* Star selector */}
                      <View style={rm.starsRow}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <TouchableOpacity key={n} onPress={() => setRatingStars((p) => ({ ...p, [key]: n }))} activeOpacity={0.7}>
                            <AppText style={[rm.star, { color: n <= stars ? '#F59E0B' : '#D1D5DB' }]}>★</AppText>
                          </TouchableOpacity>
                        ))}
                        {stars > 0 && <AppText style={rm.starLabel}>{stars}/5</AppText>}
                      </View>
                      {/* Comment */}
                      {stars > 0 && (
                        <TextInput
                          style={rm.commentInput}
                          placeholder="Add a comment (optional)"
                          placeholderTextColor="#94A3B8"
                          value={ratingComment[key] ?? ''}
                          onChangeText={(t) => setRatingComment((p) => ({ ...p, [key]: t }))}
                          maxLength={300}
                          multiline
                          numberOfLines={2}
                        />
                      )}
                    </View>
                  );
                })}

                {/* Interested agents (assigned agent) */}
                {req.assignedAgentId && !req.proposedWorkers?.some((pw) => pw.status === 'approved') && (
                  <View style={rm.workerCard}>
                    <View style={rm.workerRow}>
                      <View style={rm.avatar}>
                        <AppText style={rm.initials}>{(req.assignedAgentName ?? 'A')[0]?.toUpperCase() ?? 'A'}</AppText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText style={rm.workerName}>{req.assignedAgentName ?? 'Assigned Agent'}</AppText>
                      </View>
                    </View>
                    {(() => {
                      const key = String(req.assignedAgentId);
                      const stars = ratingStars[key] ?? 0;
                      return (
                        <>
                          <View style={rm.starsRow}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <TouchableOpacity key={n} onPress={() => setRatingStars((p) => ({ ...p, [key]: n }))} activeOpacity={0.7}>
                                <AppText style={[rm.star, { color: n <= stars ? '#F59E0B' : '#D1D5DB' }]}>★</AppText>
                              </TouchableOpacity>
                            ))}
                            {stars > 0 && <AppText style={rm.starLabel}>{stars}/5</AppText>}
                          </View>
                          {stars > 0 && (
                            <TextInput
                              style={rm.commentInput}
                              placeholder="Add a comment (optional)"
                              placeholderTextColor="#94A3B8"
                              value={ratingComment[key] ?? ''}
                              onChangeText={(t) => setRatingComment((p) => ({ ...p, [key]: t }))}
                              maxLength={300}
                              multiline
                              numberOfLines={2}
                            />
                          )}
                        </>
                      );
                    })()}
                  </View>
                )}
              </ScrollView>

              <View style={rm.footer}>
                <TouchableOpacity onPress={() => setShowRateModal(false)} style={rm.cancelBtn}>
                  <AppText style={rm.cancelTxt}>Cancel</AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={ratingSaving || Object.keys(ratingStars).length === 0}
                  style={[rm.submitBtn, (ratingSaving || Object.keys(ratingStars).length === 0) && { opacity: 0.5 }]}
                  onPress={async () => {
                    setRatingSaving(true);
                    try {
                      const entries = Object.entries(ratingStars).filter(([, s]) => s > 0);
                      await Promise.allSettled(
                        entries.map(([key, stars]) =>
                          ratingApi.rateWorker({
                            workerId:      key,
                            requirementId: req._id,
                            stars,
                            comment:       ratingComment[key] ?? '',
                          })
                        )
                      );
                      toast.success('Ratings submitted! Workers can now be found by their ratings.', 'Ratings Saved');
                      setShowRateModal(false);
                    } catch {
                      toast.error('Failed to submit ratings. Please try again.');
                    } finally {
                      setRatingSaving(false);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  {ratingSaving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <AppText style={rm.submitTxt}>Submit Ratings ({Object.values(ratingStars).filter((s) => s > 0).length})</AppText>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
};

// ─── Status Pipeline styles ────────────────────────────────────────────────────
const pipe = StyleSheet.create({
  wrap:       { borderRadius: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: WHITE, padding: 14 },
  stepsRow:   { flexDirection: 'row' },
  step:       { flex: 1, alignItems: 'center' },
  connRow:    { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 6 },
  connLine:   { flex: 1, height: 2 },
  circle:     { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  circleNum:  { fontSize: 9, fontWeight: '900', lineHeight: 12 },
  stepLabel:  { fontSize: 9, textAlign: 'center', lineHeight: 13, letterSpacing: 0.1 },
  cancelRow:  { marginTop: 10, backgroundColor: '#FEF2F2', borderRadius: 10, borderWidth: 1, borderColor: '#FECACA', padding: 8, alignItems: 'center' },
  cancelTxt:  { fontSize: 12, fontWeight: '800', color: RED },
});

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
  content:  { padding: 16, paddingTop: 18, paddingBottom: 40, gap: 12 },

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
  // Action buttons
  actionRow:       { gap: 10 },
  attendanceBtn:   { backgroundColor: '#1037A4', borderRadius: 16, padding: 16, alignItems: 'center' },
  attendanceBtnTxt:{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  documentsBtn:    { borderWidth: 1.5, borderColor: '#D97706', borderRadius: 16, padding: 16, alignItems: 'center' },
  documentsBtnTxt: { color: '#D97706', fontSize: 14, fontWeight: '700' },
  repostBtn:       { borderWidth: 1.5, borderColor: '#1037A4', borderRadius: 16, padding: 16, alignItems: 'center' },
  repostBtnTxt:    { color: '#1037A4', fontSize: 14, fontWeight: '700' },
  closeBtn:        { borderWidth: 1.5, borderColor: RED, borderRadius: 16, padding: 16, alignItems: 'center' },
  closeBtnTxt:     { color: RED, fontSize: 14, fontWeight: '700' },
  rateBtn:         { backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#FDE68A' },
  rateBtnTxt:      { color: '#92400E', fontSize: 14, fontWeight: '800' },
});

// ─── Proposed Workers styles ───────────────────────────────────────────────────
const pws = StyleSheet.create({
  row:           { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER, flexWrap: 'wrap' },
  avatar:        { width: 40, height: 40, borderRadius: 20, backgroundColor: BRAND_SOFT, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  initials:      { fontSize: 14, fontWeight: '800', color: BRAND_MID },
  name:          { fontSize: 13, fontWeight: '700', color: NAVY, textTransform: 'capitalize' },
  phone:         { fontSize: 11, color: SLATE, marginTop: 1 },
  reason:        { fontSize: 11, color: RED, marginTop: 2 },
  statusChip:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusTxt:     { fontSize: 11, fontWeight: '700' },
  actionBtns:    { flexDirection: 'row', gap: 6 },
  approveBtn:    { backgroundColor: GREEN, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  approveTxt:    { color: WHITE, fontSize: 11, fontWeight: '700' },
  rejectBtn:     { backgroundColor: '#FEF2F2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#FECACA' },
  rejectTxt:     { color: RED, fontSize: 11, fontWeight: '700' },
  rejectInputWrap:   { width: '100%', gap: 8, paddingTop: 8 },
  rejectInput:       { borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: NAVY },
  rejectConfirmRow:  { flexDirection: 'row', gap: 8 },
  rejectCancelChip:  { borderWidth: 1, borderColor: BORDER, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'center', justifyContent: 'center' },
  rejectConfirmBtn:  { flex: 1, backgroundColor: RED, borderRadius: 8, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  proposeBtn:    { backgroundColor: BRAND, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  proposeBtnTxt: { color: WHITE, fontSize: 12, fontWeight: '800' },
});

// ─── Rate Workers Modal styles ────────────────────────────────────────────────
const rm = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '85%', overflow: 'hidden' },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#D97706' },
  headerTitle:  { fontSize: 16, fontWeight: '800', color: '#fff' },
  headerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  closeBtn:     { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  body:         { maxHeight: 400, paddingHorizontal: 16, paddingTop: 8 },
  workerCard:   { borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, marginBottom: 10, gap: 10 },
  workerRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:       { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FDE68A' },
  initials:     { fontSize: 16, fontWeight: '800', color: '#92400E' },
  workerName:   { fontSize: 14, fontWeight: '700', color: NAVY },
  workerPhone:  { fontSize: 11, color: SLATE, marginTop: 2 },
  starsRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  star:         { fontSize: 30 },
  starLabel:    { fontSize: 13, fontWeight: '700', color: '#92400E', marginLeft: 4 },
  commentInput: { borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: NAVY, backgroundColor: '#F8FAFC', minHeight: 56 },
  footer:       { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER },
  cancelBtn:    { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER, paddingVertical: 14, alignItems: 'center' },
  cancelTxt:    { fontSize: 14, fontWeight: '700', color: SLATE },
  submitBtn:    { flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#D97706' },
  submitTxt:    { fontSize: 14, fontWeight: '800', color: '#fff' },
});

// ─── Propose-worker modal styles ──────────────────────────────────────────────
const pw = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:       { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, gap: 8 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: BORDER, alignSelf: 'center', marginBottom: 8 },
  sheetTitle:  { fontSize: 18, fontWeight: '900', color: NAVY },
  sheetSub:    { fontSize: 12, color: SLATE, lineHeight: 18, marginBottom: 8 },
  fieldLabel:  { fontSize: 11, fontWeight: '700', color: SLATE, textTransform: 'uppercase', letterSpacing: 0.4 },
  input:       { borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: NAVY, backgroundColor: '#F8FAFC' },
  btnRow:      { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn:   { flex: 1, borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  cancelTxt:   { fontSize: 14, fontWeight: '700', color: SLATE },
  submitBtn:   { flex: 2, backgroundColor: BRAND, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  submitTxt:   { fontSize: 14, fontWeight: '800', color: WHITE },
});
