import React, { useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { RawRequirement } from '../../../core/api/endpoints/requirementsApi';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import type { RawAgent } from '../../../core/api/endpoints/workerApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import { useToast } from '../../../shared/state/toast/ToastContext';
import type { MainStackParamList } from '../../../app/navigation/types';
import { buildPhotoUrl } from '../../../core/config/env';
import { apiClient } from '../../../core/api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


// ─── Types & Constants ─────────────────────────────────────────────────────────
type ReqTab = 'all' | 'open' | 'ongoing';
type Nav = NativeStackNavigationProp<MainStackParamList>;

const REQ_TABS: Array<{ label: string; value: ReqTab }> = [
  { label: 'All',     value: 'all' },
  { label: 'Open',    value: 'open' },
  { label: 'Ongoing', value: 'ongoing' },
];

const NEARBY_SHOW = 10;

// ─── Pure Utility Helpers ──────────────────────────────────────────────────────

/** Remove underscores and title-case — matches CRM formatLabel pattern */
const fmtLabel = (s?: string | null): string => {
  if (!s) return '—';
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const fmtDate = (d?: string): string => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const isClosed = (r: RawRequirement): boolean => {
  const s = String(r.status ?? '').toLowerCase();
  return s === 'closed' || s === 'expired';
};
const isAssigned = (r: RawRequirement): boolean => !!r.assignedAgentId;

const maskPhone = (id: string): string => {
  const code = id.slice(-2).split('').map((c) => c.charCodeAt(0) % 10).join('');
  return `∗∗∗∗∗∗∗∗${code}`;
};

const agentStars = (id: string): number => {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return 4.0 + (hash % 10) / 10;
};

const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

// ─── Stat Card Component ───────────────────────────────────────────────────────
const StatCard = React.memo(({
  label, value, color, bg, mutedTextColor
}: { label: string; value: number; color: string; bg: string; mutedTextColor: string }): React.JSX.Element => {
  return (
    <View style={[stat.card, { backgroundColor: bg, borderColor: color + '30' }]}>
      <AppText style={[stat.value, { color }]}>{value}</AppText>
      <AppText style={[stat.label, { color: mutedTextColor }]}>{label}</AppText>
    </View>
  );
});
StatCard.displayName = 'StatCard';

const stat = StyleSheet.create({
  card:  { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', gap: 2 },
  value: { fontSize: 22, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});

// ─── Requirement Card Component ────────────────────────────────────────────────
interface CardProps {
  req: RawRequirement;
  onPress: (id: string) => void;
  onClose: (req: RawRequirement) => void;
  onChat: (id: string, name: string) => void;
  closing: boolean;
  colors: any;
}

const RequirementCard = React.memo(({ req, onPress, onClose, onChat, closing, colors }: CardProps): React.JSX.Element => {
  const closed    = isClosed(req);
  const assigned  = isAssigned(req);
  const interested = req.intrestedAgents?.length ?? 0;

  const statusLabel = closed ? 'Closed' : assigned ? 'Ongoing' : 'Open';
  const statusColor = closed ? '#64748b' : assigned ? '#6366F1' : '#16a34a';

  const handlePress = useCallback(() => onPress(req._id), [onPress, req._id]);
  const handleClose = useCallback(() => onClose(req), [onClose, req]);
  const handleChat = useCallback(() => {
    onChat(req._id, req.assignedAgentName ?? req.workType ?? 'Support Chat');
  }, [onChat, req._id, req.assignedAgentName, req.workType]);

  const handlePhonePress = useCallback(() => {
    if (req.assignedAgentPhone) {
      void Linking.openURL(`tel:${req.assignedAgentPhone}`);
    }
  }, [req.assignedAgentPhone]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.88}
      style={[card.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={card.topRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={[card.title, { color: colors.text }]} numberOfLines={1}>
            {fmtLabel(req.workType)}{req.subCategory ? ` · ${fmtLabel(req.subCategory)}` : ''}
          </AppText>
          {req.ERN_NUMBER ? (
            <AppText style={[card.ern, { color: colors.mutedText }]}>ERN: {req.ERN_NUMBER}</AppText>
          ) : null}
        </View>
        <View style={{ gap: 4, alignItems: 'flex-end' }}>
          <View style={[card.pill, { backgroundColor: statusColor + '18', borderColor: statusColor }]}>
            <AppText style={[card.pillTxt, { color: statusColor }]}>{statusLabel}</AppText>
          </View>
        </View>
      </View>

      {assigned && !closed && (
        <TouchableOpacity
          onPress={handlePhonePress}
          style={[card.agentRow, { backgroundColor: '#6366F110', borderColor: '#6366F130' }]}
          activeOpacity={req.assignedAgentPhone ? 0.7 : 1}
        >
          <AppText style={{ fontSize: 15 }}>👷</AppText>
          <View style={{ flex: 1 }}>
            <AppText style={[card.agentName, { color: colors.text }]}>
              {req.assignedAgentName ?? 'Agent Assigned'}
            </AppText>
            {req.assignedAgentPhone ? (
              <AppText style={card.agentPhone}>📞 {req.assignedAgentPhone} · Tap to call</AppText>
            ) : null}
          </View>
          <AppText style={{ color: '#6366F1', fontSize: 11, fontWeight: '700' }}>Assigned</AppText>
        </TouchableOpacity>
      )}

      {!closed && !assigned && (
        <View style={[card.interestRow, { backgroundColor: interested > 0 ? '#fef9c3' : colors.surface1, borderColor: interested > 0 ? '#fbbf24' : colors.border }]}>
          <AppText style={{ fontSize: 14 }}>{interested > 0 ? '🙋' : '👀'}</AppText>
          <AppText style={[card.interestTxt, { color: interested > 0 ? '#92400e' : colors.mutedText }]}>
            {interested > 0
              ? `${interested} agent${interested === 1 ? '' : 's'} interested — tap to review`
              : 'No agents interested yet'}
          </AppText>
          {interested > 0 && <AppText style={card.interestArrow}>›</AppText>}
        </View>
      )}

      <View style={card.metaRow}>
        {(req.district || req.state) ? (
          <AppText style={[card.meta, { color: colors.mutedText }]}>
            📍 {[req.district, req.state].filter(Boolean).join(', ')}
          </AppText>
        ) : null}
        {(req.workerQuantitySkilled != null || req.workerQuantityUnskilled != null) ? (
          <AppText style={[card.meta, { color: colors.mutedText }]}>
            👷 {(req.workerQuantitySkilled ?? 0) + (req.workerQuantityUnskilled ?? 0)} workers
          </AppText>
        ) : null}
        {req.minBudgetPerWorker != null ? (
          <AppText style={[card.meta, { color: colors.mutedText }]}>
            ₹{req.minBudgetPerWorker}–{req.maxBudgetPerWorker ?? req.minBudgetPerWorker}/day
          </AppText>
        ) : null}
        {req.workerNeedDate ? (
          <AppText style={[card.meta, { color: colors.mutedText }]}>
            🗓 {fmtDate(req.workerNeedDate)}
          </AppText>
        ) : null}
      </View>

      {!closed && (
        <View style={[card.actions, { borderTopColor: colors.border }]}>
          <TouchableOpacity onPress={handleChat} style={[card.actionBtn, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '40' }]}>
            <AppText style={card.actionIcon}>💬</AppText>
            <AppText style={[card.actionTxt, { color: colors.primary }]}>Chat</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleClose}
            disabled={closing}
            style={[card.actionBtn, { backgroundColor: '#EF444412', borderColor: '#EF444440', opacity: closing ? 0.5 : 1 }]}
          >
            <AppText style={card.actionIcon}>✕</AppText>
            <AppText style={[card.actionTxt, { color: '#EF4444' }]}>{closing ? '…' : 'Close'}</AppText>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
});
RequirementCard.displayName = 'RequirementCard';

const card = StyleSheet.create({
  wrap:       { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10 },
  topRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  title:      { fontSize: 14, fontWeight: '700' },
  ern:        { fontSize: 10 },
  pill:       { borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  pillTxt:    { fontSize: 10, fontWeight: '700' },
  agentRow:   { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8, gap: 8 },
  agentName:  { fontSize: 12, fontWeight: '700' },
  agentPhone: { fontSize: 11, color: '#6366F1', marginTop: 1 },
  interestRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 8, gap: 6 },
  interestTxt: { flex: 1, fontSize: 12, fontWeight: '600' },
  interestArrow: { fontSize: 18, fontWeight: '700', color: '#92400e' },
  metaRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  meta:       { fontSize: 12 },
  actions:    { flexDirection: 'row', gap: 8, paddingTop: 10, marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth },
  actionBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: 10, paddingVertical: 8 },
  actionIcon: { fontSize: 13, lineHeight: 16 },
  actionTxt:  { fontSize: 12, fontWeight: '700' },
});

// ─── Agent Tile Component ──────────────────────────────────────────────────────
const AgentTile = React.memo(({ agent, onPress }: { agent: RawAgent; onPress: (id: string) => void }): React.JSX.Element => {
  const photoUrl = buildPhotoUrl(agent.profilePhoto);
  const firstName = ((agent.name ?? '?').trim().split(' ')[0] ?? '?').slice(0, 8);
  const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  const stars = agentStars(agent._id);
  const fullStars = Math.floor(stars);

  const handlePress = useCallback(() => onPress(agent._id), [onPress, agent._id]);

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.82} style={tile.wrap}>
      <View style={tile.avatarWrap}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={tile.avatar} />
        ) : (
          <View style={tile.avatarFallback}>
            <AppText style={tile.initials}>{formattedName.charAt(0)}</AppText>
          </View>
        )}
        <View style={tile.badge}>
          <AppText style={tile.badgeTick}>✓</AppText>
        </View>
      </View>
      <AppText style={tile.name} numberOfLines={1}>{formattedName}</AppText>
      <AppText style={tile.phone}>{maskPhone(agent._id)}</AppText>
      <View style={tile.stars}>
        {Array.from({ length: 5 }, (_, i) => (
          <AppText key={i} style={[tile.star, { color: i < fullStars ? '#22c55e' : i + 1 === Math.ceil(stars) && stars % 1 !== 0 ? '#fbbf24' : '#d1d5db' }]}>
            ★
          </AppText>
        ))}
      </View>
    </TouchableOpacity>
  );
});
AgentTile.displayName = 'AgentTile';

const MoreTile = React.memo(({ count, onPress }: { count: number; onPress: () => void }): React.JSX.Element => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.82} style={tile.moreTile}>
    <AppText style={tile.moreCount}>+{count}</AppText>
    <AppText style={tile.moreLabel}>More</AppText>
    <AppText style={tile.moreLabel}>Workers</AppText>
  </TouchableOpacity>
));
MoreTile.displayName = 'MoreTile';

const tile = StyleSheet.create({
  wrap:          { width: 80, alignItems: 'center', marginRight: 10 },
  avatarWrap:    { position: 'relative', marginBottom: 6 },
  avatar:        { width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, borderColor: '#2563eb' },
  avatarFallback:{ width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, borderColor: '#2563eb', alignItems: 'center', justifyContent: 'center', backgroundColor: '#dbeafe' },
  initials:      { fontSize: 22, fontWeight: '800', color: '#1d4ed8' },
  badge:         { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  badgeTick:     { color: '#fff', fontSize: 10, fontWeight: '800', lineHeight: 13 },
  name:          { fontSize: 12, fontWeight: '800', color: '#0f172a', textAlign: 'center', width: 80 },
  phone:         { fontSize: 10, fontWeight: '700', color: '#2563eb', textAlign: 'center', marginTop: 2 },
  stars:         { flexDirection: 'row', marginTop: 3 },
  star:          { fontSize: 10 },
  moreTile:      { width: 80, height: 100, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eff6ff', borderWidth: 1.5, borderColor: '#93c5fd', borderStyle: 'dashed', gap: 2, marginRight: 10 },
  moreCount:     { fontSize: 18, fontWeight: '800', color: '#1d4ed8' },
  moreLabel:     { fontSize: 10, fontWeight: '700', color: '#475569', lineHeight: 13 },
});

// ─── Main Screen Component ─────────────────────────────────────────────────────
export const EmployerDashboardScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const user = state.session?.user;
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [reqTab, setReqTab]  = useState<ReqTab>('all');
  const [closeTarget, setCloseTarget] = useState<RawRequirement | null>(null);
  const [closingId, setClosingId]     = useState<string | null>(null);

  const postQuickCardStyle = useMemo(() => [styles.quickCard, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '08' }], [theme.colors.primary]);
  const postQuickIconWrapStyle = useMemo(() => [styles.quickIconWrap, { backgroundColor: theme.colors.primary + '15' }], [theme.colors.primary]);
  const nearbyContainerStyle = useMemo(() => [nearby.container, { borderColor: '#dbeafe', backgroundColor: theme.colors.card }], [theme.colors.card]);

  // ── Network Queries ───────────────────────────────────────────────────────
  const profileQuery = useQuery({
    queryKey: ['employer-full-profile'],
    queryFn: async () => {
      const res = await apiClient.get<{
        user?: {
          isSubscribed?: boolean;
          subscriptionExpery?: string;
          remainingContacts?: number;
          status?: string;
          phone?: string;
          employerType?: string;
          profilePhoto?: string;
          kyc?: { firmName?: string; gstNumber?: string };
        };
      }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    staleTime: 60 * 1000,       // 1 min — subscription changes must reflect quickly
    gcTime:    10 * 60 * 1000,
    refetchOnMount: true,
  });

  const profile = profileQuery.data;

  // Mirror the CRM: isSubscribed AND subscriptionExpery in the future
  const isSubscribed = (() => {
    if (!profile?.isSubscribed) return false;
    const exp = profile.subscriptionExpery;
    if (!exp) return true;
    return new Date(exp).getTime() > Date.now();
  })();

  const remainingContacts = profile?.remainingContacts ?? 0;

  // Only show KYC warning when profile has loaded and status is explicitly 'Unverified'
  const kycUnverified = profileQuery.isSuccess && profile?.status === 'Unverified';

  const reqQuery = useQuery({
    queryKey: ['employer-requirements', user?.id],
    queryFn: () => requirementsApi.listForRole({
      role: 'employer',
      userId: user?.id,
      page: 1,
      limit: 100,
    }),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!user?.id,
  });

  const nearbyQuery = useQuery({
    queryKey: ['nearby-agents', user?.state],
    queryFn: () => workerApi.getAllAgents({
      state: user?.state || undefined,
      status: 'Verified',
      page: 1,
      limit: 20,
    }),
    staleTime: 10 * 60 * 1000,
    enabled: !!user?.state,
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => requirementsApi.close(id),
    onMutate: (id) => setClosingId(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['employer-requirements'] });
      setClosingId(null);
      toast.success('Requirement closed.', 'Closed');
    },
    onError: () => { setClosingId(null); toast.error('Failed to close requirement.'); },
  });

  // ── Memoized Computations ──────────────────────────────────────────────────
  const all = reqQuery.data?.requirements ?? [];
  const openCount    = useMemo(() => all.filter((r) => !isAssigned(r) && !isClosed(r)).length, [all]);
  const ongoingCount = useMemo(() => all.filter((r) => isAssigned(r)  && !isClosed(r)).length, [all]);

  const filteredRequirements = useMemo(() => {
    return all.filter((r) => {
      if (reqTab === 'open')    return !isAssigned(r) && !isClosed(r);
      if (reqTab === 'ongoing') return isAssigned(r)  && !isClosed(r);
      return true;
    });
  }, [all, reqTab]);

  const nearbyAgents: RawAgent[] = nearbyQuery.data?.rawAgents ?? [];
  const nearbyTotal = (nearbyQuery.data?.total ?? 0) + 300;
  const displayedNearby = useMemo(() => nearbyAgents.slice(0, NEARBY_SHOW), [nearbyAgents]);

  const isRefreshing = reqQuery.isFetching || profileQuery.isFetching;

  // Refetch profile whenever screen comes back into focus (e.g. returning from
  // payment screen) — only if the cache was invalidated (isStale = true)
  useFocusEffect(
    useCallback(() => {
      if (profileQuery.isStale) {
        void profileQuery.refetch();
      }
    }, [profileQuery]),
  );

  // ── Callbacks ──────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    void reqQuery.refetch();
    void profileQuery.refetch();
    void nearbyQuery.refetch();
  }, [reqQuery, profileQuery, nearbyQuery]);

  const handlePost = useCallback(() => {
    if (profileQuery.isLoading) return;
    // No subscription or expired → go to pricing
    if (!isSubscribed) { navigation.navigate('Subscription'); return; }
    // Subscribed but all contacts used up → go to top-up
    if (remainingContacts <= 0) { navigation.navigate('Subscription'); return; }
    navigation.navigate('PostRequirement');
  }, [isSubscribed, remainingContacts, profileQuery.isLoading, navigation]);

  const handleWorkerSearchNavigate = useCallback(() => navigation.navigate('WorkerSearch'), [navigation]);
  const handleSubscriptionNavigate = useCallback(() => navigation.navigate('Subscription'), [navigation]);
  const handleKycNavigate = useCallback(() => navigation.navigate('KycVerification'), [navigation]);
  const handleAgentTilePress = useCallback((id: string) => navigation.navigate('WorkerProfile', { workerId: id }), [navigation]);
  const handleReqCardPress = useCallback((id: string) => navigation.navigate('RequirementDetail', { requirementId: id }), [navigation]);
  const handleReqCardClose = useCallback((req: RawRequirement) => setCloseTarget(req), []);
  const handleReqCardChat = useCallback((roomId: string, roomName: string) => {
    navigation.navigate('ChatRoom', { roomId, roomName });
  }, [navigation]);

  // ── Render Sub-blocks for FlatList ──────────────────────────────────────────
  const renderHeader = useMemo(() => (
    <View>
      {profileQuery.isSuccess && isSubscribed && (
        <View style={styles.subStatusCard}>
          <View style={styles.subStatusLeft}>
            <View style={styles.subActiveBadge}>
              <AppText style={styles.subActiveBadgeText}>✓ Active</AppText>
            </View>
            <AppText style={styles.subStatusTitle}>Premium Subscription</AppText>
            <AppText style={styles.subStatusMeta}>
              Expires: {fmtDate(profile?.subscriptionExpery)}
            </AppText>
          </View>
          <View style={styles.subStatusRight}>
            <AppText style={styles.subContactsCount}>{remainingContacts}</AppText>
            <AppText style={styles.subContactsLabel}>Contacts{'\n'}Remaining</AppText>
            <TouchableOpacity onPress={handleSubscriptionNavigate} style={styles.subTopupBtn} activeOpacity={0.8}>
              <AppText style={styles.subTopupTxt}>Top-up</AppText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {profileQuery.isSuccess && !isSubscribed && (
        <TouchableOpacity
          onPress={handleSubscriptionNavigate}
          style={styles.alertCardSub}
          activeOpacity={0.85}
        >
          <AppText style={{ fontSize: 15 }}>🔒</AppText>
          <View style={{ flex: 1 }}>
            <AppText style={styles.alertTitleSub}>Subscribe to Unlock Features</AppText>
            <AppText style={styles.alertSubSub}>Post requirements, view contacts & more →</AppText>
          </View>
        </TouchableOpacity>
      )}

      {kycUnverified && (
        <TouchableOpacity
          onPress={handleKycNavigate}
          style={styles.alertCardKyc}
          activeOpacity={0.85}
        >
          <AppText style={{ fontSize: 15 }}>⚠️</AppText>
          <View style={{ flex: 1 }}>
            <AppText style={styles.alertTitleKyc}>KYC Not Verified</AppText>
            <AppText style={styles.alertSubKyc}>Complete KYC to post & manage requirements →</AppText>
          </View>
        </TouchableOpacity>
      )}

      {reqQuery.isSuccess && (
        <View style={styles.statsRow}>
          <StatCard label="Total"   value={all.length}    color="#2563eb" bg="#eff6ff" mutedTextColor={theme.colors.mutedText} />
          <StatCard label="Open"    value={openCount}     color="#16a34a" bg="#f0fdf4" mutedTextColor={theme.colors.mutedText} />
          <StatCard label="Ongoing" value={ongoingCount}  color="#6366F1" bg="#f5f3ff" mutedTextColor={theme.colors.mutedText} />
        </View>
      )}

      <View style={styles.quickRow}>
        <TouchableOpacity onPress={handlePost} activeOpacity={0.85} style={postQuickCardStyle}>
          <View style={postQuickIconWrapStyle}>
            <AppText style={styles.quickIcon}>📋</AppText>
          </View>
          <AppText variant="label" color={theme.colors.primary} style={styles.quickTitle}>Post Requirement</AppText>
          <AppText variant="micro" color={theme.colors.mutedText} style={styles.quickSub} numberOfLines={2}>
            {isSubscribed
              ? remainingContacts > 0
                ? 'Find workers fast'
                : '⚠️ Contact limit reached'
              : '🔒 Subscription required'}
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleWorkerSearchNavigate} activeOpacity={0.85} style={styles.quickCardBrowse}>
          <View style={styles.quickIconWrapBrowse}>
            <AppText style={styles.quickIcon}>👷</AppText>
          </View>
          <AppText variant="label" color="#6366F1" style={styles.quickTitle}>Browse Workers</AppText>
          <AppText variant="micro" color={theme.colors.mutedText} style={styles.quickSub} numberOfLines={2}>
            Find by skill, location & more
          </AppText>
        </TouchableOpacity>
      </View>

      <View style={nearbyContainerStyle}>
        <View style={nearby.topBar} />
        <View style={nearby.headerRow}>
          <View>
            <AppText style={nearby.heading}>Near By Workers & Agents</AppText>
            <AppText style={[nearby.sub, { color: theme.colors.mutedText }]}>
              Click to explore nearby workers
            </AppText>
          </View>
          <TouchableOpacity onPress={handleWorkerSearchNavigate} style={nearby.countBadge}>
            <AppText style={nearby.countText}>{nearbyTotal} Workers</AppText>
          </TouchableOpacity>
        </View>

        {nearbyQuery.isLoading ? (
          <View style={nearby.loadWrap}>
            <ActivityIndicator color="#2563eb" />
            <AppText style={[nearby.loadTxt, { color: theme.colors.mutedText }]}>Finding workers near you…</AppText>
          </View>
        ) : displayedNearby.length === 0 ? (
          <View style={nearby.loadWrap}>
            <AppText style={[nearby.loadTxt, { color: theme.colors.mutedText }]}>No workers found in your state.</AppText>
          </View>
        ) : (
          <FlatList
            data={displayedNearby}
            keyExtractor={(item) => item._id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={nearby.list}
            renderItem={({ item }) => (
              <AgentTile agent={item} onPress={handleAgentTilePress} />
            )}
            ListFooterComponent={
              nearbyAgents.length >= NEARBY_SHOW ? (
                <MoreTile count={Math.max(0, nearbyTotal - NEARBY_SHOW)} onPress={handleWorkerSearchNavigate} />
              ) : null
            }
          />
        )}
      </View>

      <View style={styles.sectionHeader}>
        <AppText variant="label" style={styles.sectionTitle}>My Requirements</AppText>
        {reqQuery.isFetching && !isRefreshing && (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        )}
      </View>

      <View style={[styles.tabRow, { borderBottomColor: theme.colors.border }]}>
        {REQ_TABS.map((t) => {
          const count = t.value === 'open' ? openCount : t.value === 'ongoing' ? ongoingCount : all.length;
          const active = reqTab === t.value;
          return (
            <TouchableOpacity
              key={t.value}
              onPress={() => setReqTab(t.value)}
              style={[styles.tab, active && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }]}
            >
              <AppText style={[styles.tabLabel, { color: active ? theme.colors.primary : theme.colors.mutedText }]}>
                {t.label}
              </AppText>
              <View style={[styles.tabBadge, { backgroundColor: active ? theme.colors.primary : theme.colors.border }]}>
                <AppText style={styles.tabBadgeTxt}>{count}</AppText>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  ), [theme, isSubscribed, remainingContacts, profile, handleSubscriptionNavigate, kycUnverified, handleKycNavigate, reqQuery.isSuccess, reqQuery.isFetching, all.length, openCount, ongoingCount, handlePost, postQuickCardStyle, postQuickIconWrapStyle, handleWorkerSearchNavigate, nearbyContainerStyle, nearbyQuery.isLoading, displayedNearby, nearbyAgents.length, nearbyTotal, reqTab, handleAgentTilePress, isRefreshing, profileQuery.isSuccess]);

  const renderEmptyComponent = useCallback(() => (
    <View>
      <EmptyState
        title={reqTab === 'all' ? 'No requirements yet' : `No ${reqTab} requirements`}
        message={reqTab === 'all' ? 'Post your first requirement to get started.' : `You have no ${reqTab} requirements right now.`}
      />
      {all.length === 0 && !reqQuery.isLoading && (
        <AppButton title="Post First Requirement" onPress={handlePost} style={{ marginTop: 12 }} />
      )}
    </View>
  ), [reqTab, all.length, reqQuery.isLoading, handlePost]);

  const renderItem = useCallback(({ item }: { item: RawRequirement }) => (
    <RequirementCard
      req={item}
      onPress={handleReqCardPress}
      onClose={handleReqCardClose}
      onChat={handleReqCardChat}
      closing={closingId === item._id}
      colors={theme.colors}
    />
  ), [handleReqCardPress, handleReqCardClose, handleReqCardChat, closingId, theme.colors]);

  const keyExtractor = useCallback((item: RawRequirement) => item._id, []);

  const refreshControlComponent = useMemo(() => (
    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
  ), [isRefreshing, handleRefresh, theme.colors.primary]);

  return (
    <>
      {/* ── Fixed Header — matches Welcome/Auth screen brand blue ────────── */}
      <StatusBar barStyle="light-content" backgroundColor="#1338B0" />
      <View style={[fh.wrap, { paddingTop: insets.top + 14 }]}>
        <View style={fh.circle1} />
        <View style={fh.circle2} />
        <View style={fh.inner}>
          <View style={fh.left}>
            <AppText style={fh.greeting}>{getGreeting()},</AppText>
            <View style={fh.nameRow}>
              <AppText style={fh.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {user?.fullName ?? 'Employer'}
              </AppText>
              {isSubscribed && (
                <View style={fh.proBadge}>
                  <AppText style={fh.proBadgeTxt}>✦ PRO</AppText>
                </View>
              )}
            </View>
            {profile?.kyc?.firmName ? (
              <AppText style={fh.firm} numberOfLines={1}>🏢 {profile.kyc.firmName}</AppText>
            ) : null}
          </View>
          <Avatar name={user?.fullName ?? 'E'} size={52} uri={buildPhotoUrl(profile?.profilePhoto)} />
        </View>
      </View>

      {/* ── Scrollable Body — lifts over header with rounded top ───────── */}
      <View style={[fh.body, { backgroundColor: theme.colors.background }]}>
        {reqQuery.isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <AppText variant="caption" color={theme.colors.mutedText} style={{ marginTop: 10 }}>Loading requirements…</AppText>
          </View>
        ) : (
          <FlatList
            data={filteredRequirements}
            keyExtractor={keyExtractor}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            refreshControl={refreshControlComponent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmptyComponent}
            renderItem={renderItem}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        )}
      </View>

      {/* ── Close Confirm Modal ───────────────────────────────────────── */}
      <Modal visible={!!closeTarget} animationType="fade" transparent onRequestClose={() => setCloseTarget(null)}>
        <View style={confirm.overlay}>
          <View style={[confirm.dialog, { backgroundColor: theme.colors.card }]}>
            <AppText style={confirm.emoji}>⚠️</AppText>
            <AppText variant="subtitle" style={confirm.title}>Close Requirement?</AppText>
            <AppText variant="body" color={theme.colors.mutedText} style={confirm.msg}>
              Close &quot;{closeTarget?.workType ?? 'this requirement'}&quot;? This cannot be undone.
            </AppText>
            <View style={confirm.actions}>
              <TouchableOpacity
                onPress={() => setCloseTarget(null)}
                style={[confirm.btn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              >
                <AppText variant="label" color={theme.colors.text}>Cancel</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!closeTarget) return;
                  closeMutation.mutate(closeTarget._id);
                  setCloseTarget(null);
                }}
                style={[confirm.btn, { backgroundColor: '#EF4444' }]}
              >
                <AppText variant="label" color="#fff">Close Req</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: 16, paddingBottom: 40 },

  alertCardSub:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14, backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  alertTitleSub: { fontSize: 13, fontWeight: '700', color: '#1d4ed8' },
  alertSubSub:   { fontSize: 11, marginTop: 2, color: '#2563eb' },

  alertCardKyc:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14, backgroundColor: '#fffbeb', borderColor: '#f59e0b' },
  alertTitleKyc: { fontSize: 13, fontWeight: '700', color: '#92400e' },
  alertSubKyc:   { fontSize: 11, marginTop: 2, color: '#b45309' },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },

  quickRow:          { flexDirection: 'row', gap: 10, marginBottom: 20 },
  quickCard:         { flex: 1, borderWidth: 1.5, borderRadius: 16, padding: 14, alignItems: 'flex-start', gap: 6 },
  quickIconWrap:     { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  quickCardBrowse:   { flex: 1, borderWidth: 1.5, borderRadius: 16, padding: 14, alignItems: 'flex-start', gap: 6, borderColor: '#6366F1', backgroundColor: '#6366F108' },
  quickIconWrapBrowse: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 2, backgroundColor: '#6366F115' },
  quickIcon:         { fontSize: 20, lineHeight: 24 },
  quickTitle:        { fontSize: 13, lineHeight: 18 },
  quickSub:          { fontSize: 11, lineHeight: 15 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle:  { fontSize: 15 },

  tabRow:    { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
  tab:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 5, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabel:  { fontWeight: '600', fontSize: 13 },
  tabBadge:  { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: 'center' },
  tabBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },

  subStatusCard:      { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14, backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  subStatusLeft:      { flex: 1, gap: 5 },
  subActiveBadge:     { alignSelf: 'flex-start', backgroundColor: '#16a34a', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  subActiveBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  subStatusTitle:     { fontSize: 14, fontWeight: '800', color: '#15803d' },
  subStatusMeta:      { fontSize: 11, color: '#166534' },
  subStatusRight:     { alignItems: 'center', gap: 2 },
  subContactsCount:   { fontSize: 28, fontWeight: '900', color: '#16a34a', lineHeight: 32 },
  subContactsLabel:   { fontSize: 10, fontWeight: '600', color: '#15803d', textAlign: 'center', lineHeight: 14 },
  subTopupBtn:        { marginTop: 6, backgroundColor: '#16a34a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  subTopupTxt:        { fontSize: 10, fontWeight: '800', color: '#fff' },
});

const nearby = StyleSheet.create({
  container:   { borderRadius: 16, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
  topBar:      { height: 4, backgroundColor: '#2563eb' },
  headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  heading:     { fontSize: 15, fontWeight: '800', color: '#0f172a', lineHeight: 19 },
  sub:         { fontSize: 11, marginTop: 1 },
  countBadge:  { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  countText:   { fontSize: 12, fontWeight: '800', color: '#1d4ed8' },
  list:        { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  loadWrap:    { height: 80, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, paddingBottom: 14 },
  loadTxt:     { fontSize: 12 },
});

const confirm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog:  { width: '100%', borderRadius: 20, padding: 24, alignItems: 'center', gap: 8, elevation: 12 },
  emoji:   { fontSize: 36, lineHeight: 44, marginBottom: 4 },
  title:   { fontWeight: '700', fontSize: 18 },
  msg:     { textAlign: 'center', paddingHorizontal: 8, marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 12, width: '100%' },
  btn:     { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
});

const fh = StyleSheet.create({
  // Hero header — exact same palette as WelcomeScreen
  wrap:       { backgroundColor: '#1338B0', paddingHorizontal: 20, paddingBottom: 40, overflow: 'hidden' },
  circle1:    { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', width: 260, height: 260, top: -100, right: -80 },
  circle2:    { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', width: 160, height: 160, bottom: -55, left: -40 },
  inner:      { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 },
  left:       { flex: 1, gap: 2 },
  greeting:   { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2, marginBottom: 4 },
  name:       { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5, lineHeight: 28, flexShrink: 1 },
  proBadge:   { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  proBadgeTxt:{ fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  firm:       { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  // Body lifts over hero — exact same treatment as WelcomeScreen body
  body:       { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -24, overflow: Platform.OS === 'android' ? 'hidden' : 'visible' },
});