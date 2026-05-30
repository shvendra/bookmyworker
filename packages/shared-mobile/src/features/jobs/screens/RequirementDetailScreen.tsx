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
// Premium extras
const DEEP_NAVY  = '#060E2B';
const CARD_SHADOW = { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 };

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
  const a = accent ?? BRAND;
  return (
    <View style={[tile.wrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={[tile.iconBox, { backgroundColor: a + '14' }]}>
        <AppText style={tile.emoji}>{emoji}</AppText>
      </View>
      <AppText style={[tile.label, { color: theme.colors.mutedText }]}>{label}</AppText>
      <AppText style={[tile.value, { color: accent ? a : theme.colors.text }]} numberOfLines={2}>{value}</AppText>
    </View>
  );
};
const tile = StyleSheet.create({
  wrap:    { width: '48%', borderRadius: 18, borderWidth: 1, padding: 14, gap: 8, ...CARD_SHADOW },
  iconBox: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  emoji:   { fontSize: 20 },
  label:   { fontSize: 9, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: SLATE },
  value:   { fontSize: 14, fontWeight: '800', lineHeight: 19, letterSpacing: -0.1 },
});

// ─── Section header ────────────────────────────────────────────────────────────
const SecHead = ({ title, accent = BRAND }: { title: string; accent?: string }): React.JSX.Element => (
  <View style={sh.row}>
    <View style={[sh.bar, { backgroundColor: accent }]} />
    <AppText style={[sh.text, { color: NAVY }]}>{title}</AppText>
  </View>
);
const sh = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  bar:  { width: 5, height: 22, borderRadius: 3 },
  text: { fontSize: 15, fontWeight: '900', letterSpacing: 0.1 },
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
  cardWrap:           { borderRadius: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 10, overflow: 'hidden', backgroundColor: WHITE },
  card:               { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar:             { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  initials:           { fontSize: 18, fontWeight: '900' },
  name:               { fontSize: 14, fontWeight: '800', color: NAVY, marginBottom: 2, textTransform: 'capitalize' },
  location:           { fontSize: 11, color: SLATE, marginBottom: 4 },
  wagePill:           { alignSelf: 'flex-start', backgroundColor: GREEN_SOFT, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: GREEN_BDR },
  wageText:           { fontSize: 11, fontWeight: '800', color: GREEN },
  unlockError:        { fontSize: 11, color: RED },
  viewBtn:            { backgroundColor: BRAND, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center', minWidth: 68 },
  viewTxt:            { fontSize: 10, fontWeight: '900', color: WHITE, textAlign: 'center', lineHeight: 14 },
  lockedChip:         { backgroundColor: AMBER_SOFT, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center', borderWidth: 1.5, borderColor: AMBER + '55', minWidth: 68, gap: 3 },
  lockedIcon:         { fontSize: 14 },
  lockedTxt:          { fontSize: 10, fontWeight: '900', color: AMBER, textAlign: 'center' },
  phoneRevealedRow:   { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', backgroundColor: GREEN_SOFT, borderTopWidth: 1, borderTopColor: GREEN_BDR, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  phoneRevealedLeft:  { flex: 1, minWidth: 120 },
  phoneRevealedLabel: { fontSize: 9, fontWeight: '800', color: GREEN, textTransform: 'uppercase', letterSpacing: 0.6 },
  phoneRevealedNum:   { fontSize: 15, fontWeight: '900', color: NAVY, marginTop: 3 },
  hiredBadge:         { width: '100%', fontSize: 11, fontWeight: '800', color: GREEN },
  callNowBtn:         { backgroundColor: GREEN, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center' },
  callNowTxt:         { color: WHITE, fontSize: 12, fontWeight: '900' },
  errorRow:           { paddingHorizontal: 14, paddingBottom: 10 },
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
      <AppText style={pipe.heading}>Hiring Progress</AppText>
      <View style={pipe.stepsRow}>
        {PIPE_LABELS.map((label, i) => {
          const done    = activeIdx >= 0 && i < activeIdx;
          const current = activeIdx >= 0 && i === activeIdx;
          const future  = !done && !current;

          const circleColor = done ? BRAND : current ? WHITE : '#F1F5F9';
          const ringColor   = done || current ? BRAND : isCancelled ? '#9CA3AF' : '#CBD5E1';
          const labelColor  = current ? BRAND : done ? '#334155' : isCancelled ? '#9CA3AF' : '#94A3B8';
          const leftLine    = i > 0 ? (done || current ? BRAND : '#E2E8F0') : 'transparent';
          const rightLine   = i < PIPE_LABELS.length - 1 ? (done ? BRAND : '#E2E8F0') : 'transparent';

          return (
            <View key={label} style={pipe.step}>
              <View style={pipe.connRow}>
                <View style={[pipe.connLine, { backgroundColor: leftLine }]} />
                {current ? (
                  <View style={pipe.activeRing}>
                    <View style={[pipe.circle, { backgroundColor: WHITE, borderColor: BRAND, borderWidth: 2.5 }]}>
                      <AppText style={[pipe.circleNum, { color: BRAND, fontSize: 10, fontWeight: '900' }]}>{String(i + 1)}</AppText>
                    </View>
                  </View>
                ) : (
                  <View style={[pipe.circle, { backgroundColor: circleColor, borderColor: ringColor, borderWidth: done ? 0 : 1.5 }]}>
                    <AppText style={[pipe.circleNum, { color: done ? WHITE : future ? '#94A3B8' : ringColor }]}>
                      {done ? '✓' : String(i + 1)}
                    </AppText>
                  </View>
                )}
                <View style={[pipe.connLine, { backgroundColor: rightLine }]} />
              </View>
              <AppText style={[pipe.stepLabel, { color: labelColor, fontWeight: current ? '900' : done ? '700' : '500' }]} numberOfLines={2}>
                {label}
              </AppText>
            </View>
          );
        })}
      </View>

      {isCancelled && (
        <View style={pipe.cancelRow}>
          <AppText style={pipe.cancelTxt}>{'✕'}  This requirement was cancelled</AppText>
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

  // Pipeline filter tab
  const [pipelineFilter, setPipelineFilter] = useState<'All' | 'Shortlisted' | 'Selected' | 'Joined'>('All');
  // Join modal state
  const [joinTarget, setJoinTarget] = useState<{ mappingId: string; workerName: string } | null>(null);
  const [joinRate, setJoinRate] = useState('');
  const [joinRateType, setJoinRateType] = useState<'Daily' | 'Monthly'>('Daily');

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

  const completeMutation = useMutation({
    mutationFn: () => requirementsApi.updateStatus(requirementId, 'Completed'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['requirement', requirementId] });
      void queryClient.invalidateQueries({ queryKey: ['employer-requirements'] });
      toast.success('Requirement marked as completed!', 'Completed');
    },
    onError: () => toast.error('Failed to mark as completed. Please try again.', 'Error'),
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

  const advanceStatusMutation = useMutation({
    mutationFn: ({ mappingId, status, hireRate }: { mappingId: string; status: 'Selected' | 'Joined'; hireRate?: { agreedRate: number; rateType: 'Daily' | 'Monthly' } }) =>
      workerMappingApi.updateMappingStatus(mappingId, status, hireRate),
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['requirement-mappings', requirementId] });
      void queryClient.invalidateQueries({ queryKey: ['employer-pipeline-totals'] });
      setJoinTarget(null);
      setJoinRate('');
      toast.success(`Worker moved to ${vars.status}!`);
    },
    onError: () => toast.error('Failed to update status. Please try again.'),
  });

  const removeShortlistMutation = useMutation({
    mutationFn: (mappingId: string) => workerMappingApi.removeShortlist(mappingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['requirement-mappings', requirementId] });
      void queryClient.invalidateQueries({ queryKey: ['employer-pipeline-totals'] });
      toast.success('Removed from pipeline.');
    },
    onError: () => toast.error('Failed to remove. Please try again.'),
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

  // True when any worker in the pipeline is Selected or Joined — prevents closing
  const hasActiveWorkers =
    (mappingData?.grouped?.Selected?.length ?? 0) > 0 ||
    (mappingData?.grouped?.Joined?.length ?? 0) > 0;

  const handleClose = (): void => {
    showAlert('Close Requirement', 'Are you sure you want to close this requirement?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: () => closeMutation.mutate() },
    ]);
  };

  const handleComplete = (): void => {
    showAlert(
      'Mark as Completed',
      'This will mark the requirement as completed. Workers who joined will be recorded.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark Completed', style: 'default', onPress: () => completeMutation.mutate() },
      ]
    );
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

  const handleMarkAttendance = (): void => {
    if (!req) return;
    navigation.navigate('EmployerAttendance', {
      requirementId,
      requirementTitle: req.workType
        ? req.workType.replace(/_/g, ' ') + (req.subCategory ? ` · ${req.subCategory.replace(/_/g, ' ')}` : '')
        : undefined,
    });
  };

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
        <View style={hero.deco3} />

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
                  isSubscribed ? (
                    <TouchableOpacity
                      onPress={() => void Linking.openURL(`tel:${req.assignedAgentPhone}`)}
                      style={pg.assignedCallRow}
                    >
                      <AppText style={pg.assignedPhone}>📞 {req.assignedAgentPhone}</AppText>
                    </TouchableOpacity>
                  ) : (
                    <AppText style={pg.lockedContact}>🔒 Contact hidden — subscription inactive</AppText>
                  )
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
                      {isSubscribed
                        ? <AppText style={pws.phone}>📞 {pw.workerPhone ?? '—'}</AppText>
                        : <AppText style={pws.phoneLocked}>🔒 Contact hidden</AppText>
                      }
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

        {/* ── Hiring Pipeline (employer only) — Shortlisted / Selected / Joined ─── */}
        {isEmployer && (mappingData?.mappings?.length ?? 0) > 0 && (
          <View style={[pg.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            {/* Header */}
            <View style={pl.headerRow}>
              <SecHead title="Hiring Pipeline" accent="#7C3AED" />
              <View style={[pl.totalBadge, { backgroundColor: '#7C3AED' }]}>
                <AppText style={pl.totalTxt}>{mappingData!.mappings.length}</AppText>
              </View>
            </View>

            {/* Filter chips */}
            <View style={pl.filterRow}>
              {(['All', 'Shortlisted', 'Selected', 'Joined'] as const).map((f) => {
                const cnt = f === 'All'
                  ? mappingData!.mappings.length
                  : (mappingData!.grouped[f]?.length ?? 0);
                const active = pipelineFilter === f;
                const colors: Record<string, { bg: string; text: string; border: string }> = {
                  All:         { bg: '#7C3AED', text: '#fff', border: '#7C3AED' },
                  Shortlisted: { bg: '#2563EB', text: '#fff', border: '#2563EB' },
                  Selected:    { bg: '#7C3AED', text: '#fff', border: '#7C3AED' },
                  Joined:      { bg: '#059669', text: '#fff', border: '#059669' },
                };
                const c = colors[f]!;
                return (
                  <TouchableOpacity
                    key={f}
                    onPress={() => setPipelineFilter(f)}
                    style={[pl.chip, active
                      ? { backgroundColor: c.bg, borderColor: c.border }
                      : { backgroundColor: theme.colors.surface1, borderColor: theme.colors.border }]}
                    activeOpacity={0.75}
                  >
                    <AppText style={[pl.chipTxt, { color: active ? c.text : theme.colors.mutedText }]}>{f}</AppText>
                    <View style={[pl.chipBadge, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : theme.colors.border }]}>
                      <AppText style={[pl.chipBadgeTxt, { color: active ? '#fff' : theme.colors.mutedText }]}>{cnt}</AppText>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Worker rows */}
            {(pipelineFilter === 'All' ? mappingData!.mappings : (mappingData!.grouped[pipelineFilter] ?? [])).map((m, idx) => {
              const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
                Shortlisted: { bg: '#EFF6FF', text: '#2563EB', dot: '#2563EB' },
                Selected:    { bg: '#F5F3FF', text: '#7C3AED', dot: '#7C3AED' },
                Joined:      { bg: '#ECFDF5', text: '#059669', dot: '#059669' },
              };
              const sc = statusColors[m.status] ?? statusColors.Shortlisted;
              const initials = (m.workerName || 'W').slice(0, 2).toUpperCase();
              const palBg = ['#EBF1FF','#F5F3FF','#ECFDF5','#FFF7ED'][idx % 4]!;
              const palText = [BRAND_MID,'#7C3AED',GREEN,'#EA580C'][idx % 4]!;

              return (
                <View key={m._id} style={[pl.workerRow, { borderBottomColor: theme.colors.divider }]}>
                  {/* Avatar */}
                  <View style={[pl.avatar, { backgroundColor: palBg }]}>
                    <AppText style={[pl.initials, { color: palText }]}>{initials}</AppText>
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1, gap: 3 }}>
                    <AppText style={[pl.workerName, { color: theme.colors.text }]} numberOfLines={1}>{m.workerName || '—'}</AppText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[pl.statusPill, { backgroundColor: sc.bg, borderColor: sc.dot + '55' }]}>
                        <View style={[pl.statusDot, { backgroundColor: sc.dot }]} />
                        <AppText style={[pl.statusTxt, { color: sc.text }]}>{m.status}</AppText>
                      </View>
                      {m.agreedRate != null && (
                        <AppText style={pl.rateTxt}>{'₹'}{m.agreedRate}/{m.rateType ?? 'day'}</AppText>
                      )}
                    </View>
                    {m.workerPhone
                      ? isSubscribed
                        ? <AppText style={pl.phoneTxt}>{'📞'} {m.workerPhone}</AppText>
                        : <AppText style={pl.phoneLocked}>{'🔒'} Contact hidden</AppText>
                      : null
                    }
                  </View>

                  {/* Actions */}
                  <View style={{ gap: 6, alignItems: 'flex-end' }}>
                    {m.status === 'Shortlisted' && (
                      <TouchableOpacity
                        style={[pl.advanceBtn, { backgroundColor: '#F5F3FF', borderColor: '#C4B5FD' }]}
                        onPress={() => advanceStatusMutation.mutate({ mappingId: m._id, status: 'Selected' })}
                        disabled={advanceStatusMutation.isPending}
                        activeOpacity={0.8}
                      >
                        <AppText style={[pl.advanceTxt, { color: '#7C3AED' }]}>{'→'} Select</AppText>
                      </TouchableOpacity>
                    )}
                    {m.status === 'Selected' && (
                      <TouchableOpacity
                        style={[pl.advanceBtn, { backgroundColor: '#ECFDF5', borderColor: GREEN_BDR }]}
                        onPress={() => setJoinTarget({ mappingId: m._id, workerName: m.workerName })}
                        activeOpacity={0.8}
                      >
                        <AppText style={[pl.advanceTxt, { color: GREEN }]}>{'→'} Join</AppText>
                      </TouchableOpacity>
                    )}
                    {m.status === 'Joined' && (
                      <View style={[pl.joinedBadge]}>
                        <AppText style={pl.joinedTxt}>{'✓'} Joined</AppText>
                      </View>
                    )}
                    {m.status !== 'Joined' && (
                      <TouchableOpacity
                        onPress={() => removeShortlistMutation.mutate(m._id)}
                        disabled={removeShortlistMutation.isPending}
                        style={pl.removeBtn}
                        activeOpacity={0.7}
                      >
                        <AppText style={pl.removeTxt}>Remove</AppText>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Worker Invitations tracker (employer only) ──────────────── */}
        {isEmployer && (
          <TouchableOpacity
            onPress={() => navigation.navigate('RequirementInvitations', {
              requirementId: req._id,
              requirementTitle: req.workType,
            })}
            activeOpacity={0.85}
            style={[pg.invitationsStrip, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}
          >
            <View style={pg.invitationsLeft}>
              <View style={pg.invitationsIconWrap}>
                <AppText style={{ fontSize: 20 }}>📬</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={pg.invitationsTitle}>Worker Invitations</AppText>
                <AppText style={pg.invitationsSub}>Track who accepted or declined your invites</AppText>
              </View>
            </View>
            <AppText style={pg.invitationsArrow}>›</AppText>
          </TouchableOpacity>
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
            {!isClosed && (
              <TouchableOpacity
                style={pg.attendanceBtn}
                onPress={handleMarkAttendance}
                activeOpacity={0.88}
              >
                <AppText style={pg.attendanceBtnTxt}>📋  {i18n.t('markAttendanceTab', { ns: 'employer' })} & {i18n.t('salarySummaryTab', { ns: 'employer' })}</AppText>
              </TouchableOpacity>
            )}

            {!isClosed && (
              hasActiveWorkers ? (
                /* Workers are Selected/Joined — only allow "Mark Completed", not close */
                <TouchableOpacity
                  style={pg.completeBtn}
                  onPress={handleComplete}
                  disabled={completeMutation.isPending}
                  activeOpacity={0.88}
                >
                  <AppText style={{ fontSize: 18 }}>{'✅'}</AppText>
                  <AppText style={pg.completeBtnTxt}>
                    {completeMutation.isPending ? 'Saving…' : 'Mark as Completed'}
                  </AppText>
                </TouchableOpacity>
              ) : (
                /* No active workers — allow closing */
                <TouchableOpacity
                  style={pg.closeBtn}
                  onPress={handleClose}
                  disabled={closeMutation.isPending}
                  activeOpacity={0.88}
                >
                  <AppText style={{ fontSize: 18 }}>{'🔒'}</AppText>
                  <AppText style={pg.closeBtnTxt}>
                    {closeMutation.isPending ? 'Closing…' : 'Close Requirement'}
                  </AppText>
                </TouchableOpacity>
              )
            )}

            {/* Rate Workers button — shown when requirement is Closed/Completed */}
            {isClosed && (req?.proposedWorkers?.some((pw) => pw.status === 'approved') || (req?.intrestedAgents?.length ?? 0) > 0) && (
              <TouchableOpacity style={pg.rateBtn} onPress={() => setShowRateModal(true)} activeOpacity={0.88}>
                <AppText style={{ fontSize: 18 }}>{'⭐'}</AppText>
                <AppText style={pg.rateBtnTxt}>Rate Your Workers</AppText>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Join Rate Modal ──────────────────────────────────────────────── */}
      {joinTarget && (
        <Modal visible animationType="slide" transparent onRequestClose={() => setJoinTarget(null)}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={pw.backdrop}>
              <View style={[pw.sheet, { backgroundColor: WHITE }]}>
                <View style={pw.sheetHandle} />
                <AppText style={pw.sheetTitle}>Mark as Joined</AppText>
                <AppText style={pw.sheetSub}>{joinTarget.workerName} — enter agreed rate to confirm joining.</AppText>

                <AppText style={pw.fieldLabel}>Agreed Rate (₹)</AppText>
                <TextInput
                  style={pw.input}
                  value={joinRate}
                  onChangeText={setJoinRate}
                  placeholder="e.g. 600"
                  placeholderTextColor={SLATE}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  autoFocus
                />

                <AppText style={pw.fieldLabel}>Rate Type</AppText>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  {(['Daily', 'Monthly'] as const).map((rt) => (
                    <TouchableOpacity
                      key={rt}
                      onPress={() => setJoinRateType(rt)}
                      style={[pw.cancelBtn, joinRateType === rt && { backgroundColor: BRAND, borderColor: BRAND }]}
                      activeOpacity={0.8}
                    >
                      <AppText style={{ fontSize: 13, fontWeight: '700', color: joinRateType === rt ? WHITE : SLATE }}>{rt}</AppText>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={[pw.btnRow, { marginTop: 16 }]}>
                  <TouchableOpacity style={pw.cancelBtn} onPress={() => setJoinTarget(null)} activeOpacity={0.8}>
                    <AppText style={pw.cancelTxt}>Cancel</AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[pw.submitBtn, (!joinRate || advanceStatusMutation.isPending) && { opacity: 0.55 }]}
                    disabled={!joinRate || advanceStatusMutation.isPending}
                    onPress={() => advanceStatusMutation.mutate({
                      mappingId: joinTarget.mappingId,
                      status: 'Joined',
                      hireRate: { agreedRate: parseInt(joinRate, 10), rateType: joinRateType },
                    })}
                    activeOpacity={0.85}
                  >
                    <AppText style={pw.submitTxt}>{advanceStatusMutation.isPending ? 'Saving…' : '✓ Confirm Join'}</AppText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

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
  wrap:       { borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: WHITE, padding: 18, ...CARD_SHADOW },
  heading:    { fontSize: 13, fontWeight: '800', color: SLATE, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 18 },
  stepsRow:   { flexDirection: 'row' },
  step:       { flex: 1, alignItems: 'center' },
  connRow:    { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 8 },
  connLine:   { flex: 1, height: 2.5, borderRadius: 2 },
  circle:     { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  activeRing: { width: 38, height: 38, borderRadius: 19, borderWidth: 2.5, borderColor: BRAND + '30', backgroundColor: BRAND_SOFT, alignItems: 'center', justifyContent: 'center' },
  circleNum:  { fontSize: 10, fontWeight: '900', lineHeight: 13 },
  stepLabel:  { fontSize: 9, textAlign: 'center', lineHeight: 13, letterSpacing: 0.1 },
  cancelRow:  { marginTop: 12, backgroundColor: '#FEF2F2', borderRadius: 12, borderWidth: 1, borderColor: '#FECACA', padding: 10, alignItems: 'center' },
  cancelTxt:  { fontSize: 12, fontWeight: '800', color: RED },
});

// ─── Hero styles ───────────────────────────────────────────────────────────────
const hero = StyleSheet.create({
  wrap:        { backgroundColor: DEEP_NAVY, paddingHorizontal: 18, paddingBottom: 28, overflow: 'hidden' },
  deco1:       { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(26,86,219,0.22)', top: -100, right: -80 },
  deco2:       { position: 'absolute', width: 160, height: 160, borderRadius: 80,  backgroundColor: 'rgba(16,55,164,0.18)', bottom: -50, left: -40 },
  deco3:       { position: 'absolute', width: 100, height: 100, borderRadius: 50,  backgroundColor: 'rgba(255,255,255,0.03)', top: 30, left: '40%' },
  navRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  backArrow:   { color: WHITE, fontSize: 19, fontWeight: '500', lineHeight: 23 },
  navTitle:    { flex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700', marginHorizontal: 8, letterSpacing: 0.3, textTransform: 'uppercase' },
  ernChip:     { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  ernTxt:      { color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  titleRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  jobTitle:    { color: WHITE, fontSize: 24, fontWeight: '900', lineHeight: 30, letterSpacing: -0.5 },
  jobSubTitle: { color: 'rgba(255,255,255,0.78)', fontSize: 14, fontWeight: '600', marginTop: 5, lineHeight: 19 },
  jobType:     { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  statusBadge: { borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  statusDot:   { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  pillsRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  pill:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  pillGreen:   { backgroundColor: 'rgba(5,150,105,0.28)', borderColor: 'rgba(5,150,105,0.4)' },
  pillIcon:    { fontSize: 12 },
  pillTxt:     { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.92)' },
});

// ─── Page / section styles ─────────────────────────────────────────────────────
const pg = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: 16, paddingTop: 20, paddingBottom: 48, gap: 14 },

  section:  { borderRadius: 20, borderWidth: 1, padding: 18, ...CARD_SHADOW },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  perksWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  perkChip:  { flexDirection: 'row', alignItems: 'center', backgroundColor: GREEN_SOFT, borderRadius: 999, borderWidth: 1, borderColor: GREEN_BDR, paddingHorizontal: 14, paddingVertical: 7 },
  perkTxt:   { fontSize: 12, fontWeight: '800', color: GREEN },

  remarksBox:  { flexDirection: 'row', gap: 12, backgroundColor: '#FFFBEB', borderRadius: 14, borderWidth: 1, borderColor: '#FDE68A', padding: 14 },
  remarksIcon: { fontSize: 20 },
  remarksTxt:  { flex: 1, fontSize: 13, lineHeight: 20, fontWeight: '500', color: '#78350F' },

  // Assigned agent card
  assignedCard:    { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#F5F3FF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#DDD6FE' },
  assignedAvatar:  { width: 54, height: 54, borderRadius: 27, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#C4B5FD' },
  assignedInitials:{ fontSize: 20, fontWeight: '900', color: '#7C3AED' },
  assignedName:    { fontSize: 15, fontWeight: '900', marginBottom: 3, textTransform: 'capitalize', color: NAVY },
  assignedWage:    { fontSize: 12, color: GREEN, fontWeight: '700', marginBottom: 3 },
  assignedCallRow: {},
  assignedPhone:   { fontSize: 13, color: BRAND_MID, fontWeight: '700' },
  lockedContact:   { fontSize: 12, color: '#9CA3AF', fontWeight: '600', marginTop: 4 },
  assignedBadge:   { backgroundColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  assignedBadgeTxt:{ fontSize: 11, fontWeight: '900', color: WHITE, letterSpacing: 0.3 },

  // Interested agents section
  interestedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  countBadge:       { backgroundColor: BRAND, borderRadius: 99, minWidth: 28, height: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  countBadgeTxt:    { color: WHITE, fontSize: 12, fontWeight: '900' },

  noAgentsWrap:    { alignItems: 'center', paddingVertical: 28, gap: 10 },
  noAgentsIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: BRAND_SOFT, alignItems: 'center', justifyContent: 'center', marginBottom: 4, borderWidth: 1.5, borderColor: '#BFDBFE' },
  noAgentsTitle:   { fontSize: 16, fontWeight: '900', color: NAVY },
  noAgentsSub:     { fontSize: 12, textAlign: 'center', lineHeight: 18, color: SLATE, maxWidth: 240 },

  profilesLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },

  // ── Worker Invitations strip ──────────────────────────────────────────────
  invitationsStrip:   { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 14, marginHorizontal: 12, marginBottom: 12, gap: 10 },
  invitationsLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  invitationsIconWrap:{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(124,58,237,0.12)', alignItems: 'center', justifyContent: 'center' },
  invitationsTitle:   { fontSize: 13, fontWeight: '800', color: '#4C1D95' },
  invitationsSub:     { fontSize: 11, color: '#7C3AED', marginTop: 2, fontWeight: '500' },
  invitationsArrow:   { fontSize: 24, fontWeight: '600', color: '#7C3AED', opacity: 0.7 },

  // ── Subscription lock card ────────────────────────────────────────────────
  lockCard:       { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: BORDER, marginBottom: 12 },
  lockPreview:    { opacity: 0.3, paddingHorizontal: 4 },
  lockPreviewFade:{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, backgroundColor: 'rgba(248,250,252,0.97)' },
  lockContent:    { alignItems: 'center', paddingHorizontal: 24, paddingTop: 22, paddingBottom: 26, gap: 12, backgroundColor: 'rgba(248,250,252,0.98)' },
  subLockIcon:    { width: 68, height: 68, borderRadius: 34, backgroundColor: BRAND_SOFT, alignItems: 'center', justifyContent: 'center', marginBottom: 4, borderWidth: 1.5, borderColor: '#BFDBFE' },
  subOverlayTitle:{ fontSize: 17, fontWeight: '900', color: NAVY, textAlign: 'center' },
  subOverlaySub:  { fontSize: 13, textAlign: 'center', lineHeight: 20, color: SLATE, maxWidth: 260 },
  subOverlayBtn:  { marginTop: 6, backgroundColor: BRAND, borderRadius: 16, paddingHorizontal: 36, paddingVertical: 14 },
  subOverlayBtnTxt:{ color: WHITE, fontWeight: '900', fontSize: 14, letterSpacing: 0.3 },

  suggestionBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFFBEB', borderRadius: 14, borderWidth: 1, borderColor: '#FDE68A', padding: 14, marginTop: 12 },
  suggestionTxt:  { flex: 1, fontSize: 12, color: '#78350F', lineHeight: 18 },
  suggestionBold: { fontWeight: '900', color: '#92400E' },

  // Express interest
  interestDone:     { alignItems: 'center', paddingVertical: 22, gap: 10 },
  interestDoneIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: GREEN_SOFT, alignItems: 'center', justifyContent: 'center', marginBottom: 4, borderWidth: 1.5, borderColor: GREEN_BDR },
  interestDoneTitle:{ fontSize: 16, fontWeight: '900', color: GREEN },
  interestDoneSub:  { fontSize: 12, textAlign: 'center', lineHeight: 18, maxWidth: 240 },

  interestForm:  { gap: 14 },
  minWageRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  minWageLabel:  { fontSize: 12, color: SLATE, fontWeight: '700' },
  minWagePill:   { backgroundColor: GREEN_SOFT, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: GREEN_BDR },
  minWagePillTxt:{ fontSize: 13, fontWeight: '800', color: GREEN },
  wageInput:     { height: 52, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, fontSize: 15, fontWeight: '700' },
  expressBtn:    { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  expressBtnTxt: { color: WHITE, fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },

  // Assigned to me
  assignedMeWrap:  { alignItems: 'center', paddingVertical: 10, gap: 8 },
  assignedMeTitle: { fontSize: 20, fontWeight: '900', color: GREEN },
  assignedMeSub:   { fontSize: 14, fontWeight: '700', color: SLATE },

  // ── Action buttons — premium style ────────────────────────────────────────
  actionRow:         { gap: 10 },
  documentsBtn:      { backgroundColor: '#FFF7ED', borderRadius: 18, paddingVertical: 17, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: '#FDE68A', ...CARD_SHADOW },
  documentsBtnTxt:   { color: '#B45309', fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  repostBtn:         { backgroundColor: BRAND_SOFT, borderRadius: 18, paddingVertical: 17, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: '#BFDBFE', ...CARD_SHADOW },
  repostBtnTxt:      { color: BRAND, fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  closeBtn:          { backgroundColor: '#FEF2F2', borderRadius: 18, paddingVertical: 17, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: '#FECACA', ...CARD_SHADOW },
  closeBtnTxt:       { color: RED, fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  completeBtn:       { backgroundColor: '#ECFDF5', borderRadius: 18, paddingVertical: 17, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: '#6EE7B7', ...CARD_SHADOW },
  completeBtnTxt:    { color: '#059669', fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  rateBtn:           { backgroundColor: '#FFFBEB', borderRadius: 18, paddingVertical: 17, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: '#FDE68A', ...CARD_SHADOW },
  rateBtnTxt:        { color: '#92400E', fontSize: 14, fontWeight: '900', letterSpacing: 0.2 },
  // unused but kept
  attendanceBtn:     { backgroundColor: BRAND, borderRadius: 18, paddingVertical: 17, alignItems: 'center' },
  attendanceBtnTxt:  { color: WHITE, fontSize: 14, fontWeight: '800' },
});

// ─── Proposed Workers styles ───────────────────────────────────────────────────
const pws = StyleSheet.create({
  row:           { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER, flexWrap: 'wrap' },
  avatar:        { width: 40, height: 40, borderRadius: 20, backgroundColor: BRAND_SOFT, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  initials:      { fontSize: 14, fontWeight: '800', color: BRAND_MID },
  name:          { fontSize: 13, fontWeight: '700', color: NAVY, textTransform: 'capitalize' },
  phone:         { fontSize: 11, color: SLATE, marginTop: 1 },
  phoneLocked:   { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
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

// ─── Hiring Pipeline section styles ───────────────────────────────────────────
const pl = StyleSheet.create({
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  totalBadge:   { borderRadius: 99, minWidth: 28, height: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  totalTxt:     { color: WHITE, fontSize: 12, fontWeight: '900' },

  // Filter chips
  filterRow:    { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginBottom: 14 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 11, paddingVertical: 6 },
  chipTxt:      { fontSize: 11, fontWeight: '800' },
  chipBadge:    { borderRadius: 99, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  chipBadgeTxt: { fontSize: 9, fontWeight: '900' },

  // Worker row
  workerRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar:       { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  initials:     { fontSize: 15, fontWeight: '900' },
  workerName:   { fontSize: 14, fontWeight: '800', letterSpacing: -0.1 },
  statusPill:   { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statusDot:    { width: 6, height: 6, borderRadius: 3 },
  statusTxt:    { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  rateTxt:      { fontSize: 11, fontWeight: '700', color: GREEN },
  phoneTxt:     { fontSize: 11, color: SLATE },
  phoneLocked:  { fontSize: 11, color: '#9CA3AF' },

  // Action buttons on each row
  advanceBtn:   { borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  advanceTxt:   { fontSize: 11, fontWeight: '800' },
  joinedBadge:  { borderRadius: 9, backgroundColor: GREEN_SOFT, borderWidth: 1, borderColor: GREEN_BDR, paddingHorizontal: 10, paddingVertical: 5 },
  joinedTxt:    { fontSize: 11, fontWeight: '800', color: GREEN },
  removeBtn:    { paddingHorizontal: 8, paddingVertical: 4 },
  removeTxt:    { fontSize: 10, fontWeight: '700', color: SLATE },
});
