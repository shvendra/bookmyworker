import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
import { SubscriptionModal } from '../../../shared/components/ui/SubscriptionModal';
import type { MainStackParamList } from '../../../app/navigation/types';
import { ENV } from '../../../core/config/env';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FILE_BASE = ENV.API_BASE_URL.replace(/\/api\/v1\/?$/, '');

// ─── Types ─────────────────────────────────────────────────────────────────────
type ReqTab = 'all' | 'open' | 'ongoing';
type Nav = NativeStackNavigationProp<MainStackParamList>;

const REQ_TABS: Array<{ label: string; value: ReqTab }> = [
  { label: 'All',     value: 'all' },
  { label: 'Open',    value: 'open' },
  { label: 'Ongoing', value: 'ongoing' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
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

// ─── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({
  label, value, color, bg,
}: { label: string; value: number; color: string; bg: string }): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View style={[stat.card, { backgroundColor: bg, borderColor: color + '30' }]}>
      <AppText style={[stat.value, { color }]}>{value}</AppText>
      <AppText style={[stat.label, { color: theme.colors.mutedText }]}>{label}</AppText>
    </View>
  );
};
const stat = StyleSheet.create({
  card:  { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', gap: 2 },
  value: { fontSize: 22, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});

// ─── Requirement Card ──────────────────────────────────────────────────────────
interface CardProps {
  req: RawRequirement;
  onPress: () => void;
  onClose: () => void;
  onChat: () => void;
  closing: boolean;
}

const RequirementCard = ({ req, onPress, onClose, onChat, closing }: CardProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const closed    = isClosed(req);
  const assigned  = isAssigned(req);
  const interested = req.intrestedAgents?.length ?? 0;

  const statusLabel = closed ? 'Closed' : assigned ? 'Ongoing' : 'Open';
  const statusColor = closed ? '#64748b' : assigned ? '#6366F1' : '#16a34a';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[card.wrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
    >
      {/* Top row */}
      <View style={card.topRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={[card.title, { color: theme.colors.text }]} numberOfLines={1}>
            {req.workType ?? '—'}{req.subCategory ? ` · ${req.subCategory}` : ''}
          </AppText>
          {req.ERN_NUMBER ? (
            <AppText style={[card.ern, { color: theme.colors.mutedText }]}>ERN: {req.ERN_NUMBER}</AppText>
          ) : null}
        </View>
        <View style={{ gap: 4, alignItems: 'flex-end' }}>
          <View style={[card.pill, { backgroundColor: statusColor + '18', borderColor: statusColor }]}>
            <AppText style={[card.pillTxt, { color: statusColor }]}>{statusLabel}</AppText>
          </View>
        </View>
      </View>

      {/* Assigned agent row */}
      {assigned && !closed && (
        <TouchableOpacity
          onPress={() => req.assignedAgentPhone ? void Linking.openURL(`tel:${req.assignedAgentPhone}`) : undefined}
          style={[card.agentRow, { backgroundColor: '#6366F1' + '10', borderColor: '#6366F1' + '30' }]}
          activeOpacity={req.assignedAgentPhone ? 0.7 : 1}
        >
          <AppText style={{ fontSize: 15 }}>👷</AppText>
          <View style={{ flex: 1 }}>
            <AppText style={[card.agentName, { color: theme.colors.text }]}>
              {req.assignedAgentName ?? 'Agent Assigned'}
            </AppText>
            {req.assignedAgentPhone ? (
              <AppText style={card.agentPhone}>📞 {req.assignedAgentPhone} · Tap to call</AppText>
            ) : null}
          </View>
          <AppText style={{ color: '#6366F1', fontSize: 11, fontWeight: '700' }}>Assigned</AppText>
        </TouchableOpacity>
      )}

      {/* Interested agents badge — only for open requirements */}
      {!closed && !assigned && (
        <View style={[card.interestRow, { backgroundColor: interested > 0 ? '#fef9c3' : theme.colors.surface1, borderColor: interested > 0 ? '#fbbf24' : theme.colors.border }]}>
          <AppText style={{ fontSize: 14 }}>{interested > 0 ? '🙋' : '👀'}</AppText>
          <AppText style={[card.interestTxt, { color: interested > 0 ? '#92400e' : theme.colors.mutedText }]}>
            {interested > 0
              ? `${interested} agent${interested === 1 ? '' : 's'} interested — tap to review`
              : 'No agents interested yet'}
          </AppText>
          {interested > 0 && <AppText style={card.interestArrow}>›</AppText>}
        </View>
      )}

      {/* Meta row */}
      <View style={card.metaRow}>
        {(req.district || req.state) ? (
          <AppText style={[card.meta, { color: theme.colors.mutedText }]}>
            📍 {[req.district, req.state].filter(Boolean).join(', ')}
          </AppText>
        ) : null}
        {(req.workerQuantitySkilled != null || req.workerQuantityUnskilled != null) ? (
          <AppText style={[card.meta, { color: theme.colors.mutedText }]}>
            👷 {(req.workerQuantitySkilled ?? 0) + (req.workerQuantityUnskilled ?? 0)} workers
          </AppText>
        ) : null}
        {req.minBudgetPerWorker != null ? (
          <AppText style={[card.meta, { color: theme.colors.mutedText }]}>
            ₹{req.minBudgetPerWorker}–{req.maxBudgetPerWorker ?? req.minBudgetPerWorker}/day
          </AppText>
        ) : null}
        {req.workerNeedDate ? (
          <AppText style={[card.meta, { color: theme.colors.mutedText }]}>
            🗓 {fmtDate(req.workerNeedDate)}
          </AppText>
        ) : null}
      </View>

      {/* Actions */}
      {!closed && (
        <View style={[card.actions, { borderTopColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onChat} style={[card.actionBtn, { backgroundColor: theme.colors.primary + '12', borderColor: theme.colors.primary + '40' }]}>
            <AppText style={card.actionIcon}>💬</AppText>
            <AppText style={[card.actionTxt, { color: theme.colors.primary }]}>Chat</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
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
};

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

// ─── Nearby Agents ─────────────────────────────────────────────────────────────
const maskPhone = (id: string): string => {
  // deterministic last 2 digits from agent id
  const code = id.slice(-2).split('').map((c) => c.charCodeAt(0) % 10).join('');
  return `∗∗∗∗∗∗∗∗${code}`;
};

const agentStars = (id: string): number => {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return 4.0 + (hash % 10) / 10;
};

const AgentTile = ({ agent, onPress }: { agent: RawAgent; onPress: () => void }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const photoUrl = agent.profilePhoto
    ? `${FILE_BASE}/${agent.profilePhoto}`.replace(/([^:]\/)\/+/g, '$1')
    : undefined;
  const firstName = ((agent.name ?? '?').trim().split(' ')[0] ?? '?').slice(0, 8);
  const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  const stars = agentStars(agent._id);
  const fullStars = Math.floor(stars);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82} style={tile.wrap}>
      {/* Avatar with verified badge */}
      <View style={tile.avatarWrap}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={tile.avatar} />
        ) : (
          <View style={[tile.avatarFallback, { backgroundColor: '#dbeafe' }]}>
            <AppText style={tile.initials}>{formattedName.charAt(0)}</AppText>
          </View>
        )}
        <View style={tile.badge}>
          <AppText style={tile.badgeTick}>✓</AppText>
        </View>
      </View>

      {/* Name */}
      <AppText style={tile.name} numberOfLines={1}>{formattedName}</AppText>

      {/* Masked phone */}
      <AppText style={tile.phone}>{maskPhone(agent._id)}</AppText>

      {/* Stars */}
      <View style={tile.stars}>
        {Array.from({ length: 5 }, (_, i) => (
          <AppText key={i} style={[tile.star, { color: i < fullStars ? '#22c55e' : i + 1 === Math.ceil(stars) && stars % 1 !== 0 ? '#fbbf24' : '#d1d5db' }]}>
            ★
          </AppText>
        ))}
      </View>
    </TouchableOpacity>
  );
};

const MoreTile = ({ count, onPress }: { count: number; onPress: () => void }): React.JSX.Element => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.82} style={tile.moreTile}>
    <AppText style={tile.moreCount}>+{count}</AppText>
    <AppText style={tile.moreLabel}>More</AppText>
    <AppText style={tile.moreLabel}>Workers</AppText>
  </TouchableOpacity>
);

const tile = StyleSheet.create({
  wrap:          { width: 80, alignItems: 'center', marginRight: 10 },
  avatarWrap:    { position: 'relative', marginBottom: 6 },
  avatar:        { width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, borderColor: '#2563eb' },
  avatarFallback:{ width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, borderColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
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

// ─── Main Screen ───────────────────────────────────────────────────────────────
export const EmployerDashboardScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const user = state.session?.user;
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [reqTab, setReqTab]  = useState<ReqTab>('all');
  const [showSub, setShowSub] = useState(false);
  const [closeTarget, setCloseTarget] = useState<RawRequirement | null>(null);
  const [closingId, setClosingId]     = useState<string | null>(null);

  // ── Profile (lightweight — only fetch what we need) ───────────────────────
  const profileQuery = useQuery({
    queryKey: ['employer-full-profile'],
    queryFn: async () => {
      const { apiClient } = await import('../../../core/api/client');
      const res = await apiClient.get<{
        user?: {
          isSubscribed?: boolean;
          subscriptionExpery?: string;
          status?: string;
          phone?: string;
          employerType?: string;
          kyc?: { firmName?: string; gstNumber?: string };
        };
      }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    staleTime: 10 * 60 * 1000, // 10 min — profile doesn't change often
    gcTime: 30 * 60 * 1000,
  });

  const profile      = profileQuery.data;
  const isSubscribed = profile?.isSubscribed === true;
  const kycUnverified = profile?.status === 'Unverified' || user?.kycStatus === 'pending';

  // ── Requirements ──────────────────────────────────────────────────────────
  const reqQuery = useQuery({
    queryKey: ['employer-requirements', user?.id],
    queryFn: () => requirementsApi.listForRole({
      role: 'employer',
      userId: user?.id,
      page: 1,
      limit: 100,
    }),
    staleTime: 60 * 1000,  // 1 min
    gcTime: 5 * 60 * 1000,
    enabled: !!user?.id,
  });

  // ── Close mutation ────────────────────────────────────────────────────────
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

  // ── Derived data ──────────────────────────────────────────────────────────
  const all = reqQuery.data?.requirements ?? [];

  const openCount    = all.filter((r) => !isAssigned(r) && !isClosed(r)).length;
  const ongoingCount = all.filter((r) => isAssigned(r)  && !isClosed(r)).length;

  const filtered = all.filter((r) => {
    if (reqTab === 'open')    return !isAssigned(r) && !isClosed(r);
    if (reqTab === 'ongoing') return isAssigned(r)  && !isClosed(r);
    return true;
  });

  const isRefreshing = reqQuery.isFetching || profileQuery.isFetching;

  const handleRefresh = (): void => {
    void reqQuery.refetch();
    void profileQuery.refetch();
    void nearbyQuery.refetch();
  };

  const handlePost = (): void => {
    if (!isSubscribed) { setShowSub(true); return; }
    navigation.navigate('PostRequirement');
  };

  // ── Nearby Agents ─────────────────────────────────────────────────────────
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

  const nearbyAgents: RawAgent[] = nearbyQuery.data?.rawAgents ?? [];
  const nearbyTotal = (nearbyQuery.data?.total ?? 0) + 300;
  // Show 10 tiles + 1 "more" tile
  const NEARBY_SHOW = 10;
  const displayedNearby = useMemo(() => nearbyAgents.slice(0, NEARBY_SHOW), [nearbyAgents]);

  const employerType = (() => {
    const l = String(profile?.employerType ?? '').toLowerCase();
    if (l.includes('industry'))   return 'industry' as const;
    if (l.includes('agency'))     return 'agency' as const;
    if (l.includes('contractor')) return 'contractor' as const;
    return 'individual' as const;
  })();

  return (
    <>
      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={{ gap: 2 }}>
            <AppText variant="caption" color={theme.colors.mutedText}>Welcome back,</AppText>
            <AppText variant="title" style={{ fontSize: 20 }}>{user?.fullName ?? 'Employer'}</AppText>
          </View>
          <Avatar name={user?.fullName ?? 'E'} size={44} />
        </View>

        {/* ── KYC Alert ──────────────────────────────────────────────── */}
        {kycUnverified && (
          <TouchableOpacity
            onPress={() => navigation.navigate('KycVerification')}
            style={[styles.alertCard, { backgroundColor: '#fffbeb', borderColor: '#f59e0b' }]}
            activeOpacity={0.85}
          >
            <AppText style={{ fontSize: 15 }}>⚠️</AppText>
            <View style={{ flex: 1 }}>
              <AppText style={[styles.alertTitle, { color: '#92400e' }]}>KYC Not Verified</AppText>
              <AppText style={[styles.alertSub, { color: '#b45309' }]}>Complete KYC to post & manage requirements →</AppText>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Stats strip ────────────────────────────────────────────── */}
        {reqQuery.isSuccess && (
          <View style={styles.statsRow}>
            <StatCard label="Total"   value={all.length}    color="#2563eb" bg="#eff6ff" />
            <StatCard label="Open"    value={openCount}     color="#16a34a" bg="#f0fdf4" />
            <StatCard label="Ongoing" value={ongoingCount}  color="#6366F1" bg="#f5f3ff" />
          </View>
        )}

        {/* ── Quick Actions ──────────────────────────────────────────── */}
        <View style={styles.quickRow}>
          {/* Post Requirement */}
          <TouchableOpacity
            onPress={handlePost}
            activeOpacity={0.85}
            style={[styles.quickCard, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '08' }]}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: theme.colors.primary + '15' }]}>
              <AppText style={styles.quickIcon}>📋</AppText>
            </View>
            <AppText variant="label" color={theme.colors.primary} style={styles.quickTitle}>Post Requirement</AppText>
            <AppText variant="micro" color={theme.colors.mutedText} style={styles.quickSub} numberOfLines={2}>
              {isSubscribed ? 'Find workers fast' : '🔒 Subscription required'}
            </AppText>
          </TouchableOpacity>

          {/* Browse Workers */}
          <TouchableOpacity
            onPress={() => navigation.navigate('WorkerSearch')}
            activeOpacity={0.85}
            style={[styles.quickCard, { borderColor: '#6366F1', backgroundColor: '#6366F108' }]}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: '#6366F115' }]}>
              <AppText style={styles.quickIcon}>👷</AppText>
            </View>
            <AppText variant="label" color="#6366F1" style={styles.quickTitle}>Browse Workers</AppText>
            <AppText variant="micro" color={theme.colors.mutedText} style={styles.quickSub} numberOfLines={2}>
              Find by skill, location & more
            </AppText>
          </TouchableOpacity>
        </View>

        {/* ── Agents Near You ────────────────────────────────────────── */}
        <View style={[nearby.container, { borderColor: '#dbeafe', backgroundColor: theme.colors.card }]}>
          {/* Blue top bar */}
          <View style={nearby.topBar} />

          {/* Header row */}
          <View style={nearby.headerRow}>
            <View>
              <AppText style={nearby.heading}>Agents Near You</AppText>
              <AppText style={[nearby.sub, { color: theme.colors.mutedText }]}>
                {user?.state ? `Workers in ${user.state}` : 'Skilled workers in your area'}
              </AppText>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('WorkerSearch')}
              style={nearby.countBadge}
            >
              <AppText style={nearby.countText}>{nearbyTotal} Workers</AppText>
            </TouchableOpacity>
          </View>

          {/* Agent tiles */}
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
                <AgentTile
                  agent={item}
                  onPress={() => navigation.navigate('WorkerProfile', { workerId: item._id })}
                />
              )}
              ListFooterComponent={
                nearbyAgents.length >= NEARBY_SHOW ? (
                  <MoreTile
                    count={Math.max(0, nearbyTotal - NEARBY_SHOW)}
                    onPress={() => navigation.navigate('WorkerSearch')}
                  />
                ) : null
              }
            />
          )}
        </View>

        {/* ── My Requirements section ────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <AppText variant="label" style={styles.sectionTitle}>My Requirements</AppText>
          {reqQuery.isFetching && !isRefreshing && (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          )}
        </View>

        {/* Tabs */}
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

        {/* Requirement list */}
        <View style={{ marginTop: 4 }}>
          {reqQuery.isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <AppText variant="caption" color={theme.colors.mutedText} style={{ marginTop: 10 }}>Loading requirements…</AppText>
            </View>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={reqTab === 'all' ? 'No requirements yet' : `No ${reqTab} requirements`}
              message={reqTab === 'all' ? 'Post your first requirement to get started.' : `You have no ${reqTab} requirements right now.`}
            />
          ) : (
            filtered.map((req) => (
              <RequirementCard
                key={req._id}
                req={req}
                onPress={() => navigation.navigate('RequirementDetail', { requirementId: req._id })}
                onClose={() => setCloseTarget(req)}
                onChat={() => navigation.navigate('ChatRoom', {
                  roomId: req._id,
                  roomName: req.assignedAgentName ?? req.workType ?? 'Support Chat',
                })}
                closing={closingId === req._id}
              />
            ))
          )}

          {all.length === 0 && !reqQuery.isLoading && (
            <AppButton title="Post First Requirement" onPress={handlePost} style={{ marginTop: 12 }} />
          )}
        </View>
      </ScrollView>

      {/* ── Subscription Modal ────────────────────────────────────────── */}
      <SubscriptionModal
        visible={showSub}
        onClose={() => setShowSub(false)}
        employerType={employerType}
        employerId={user?.id}
        employerName={user?.fullName}
        email={user?.email}
        employerPhone={profile?.phone}
      />

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
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },

  alertCard:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  alertTitle: { fontSize: 13, fontWeight: '700' },
  alertSub:   { fontSize: 11, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },

  quickRow:      { flexDirection: 'row', gap: 10, marginBottom: 20 },
  quickCard:     { flex: 1, borderWidth: 1.5, borderRadius: 16, padding: 14, alignItems: 'flex-start', gap: 6 },
  quickIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  quickIcon:     { fontSize: 20, lineHeight: 24 },
  quickTitle:    { fontSize: 13, lineHeight: 18 },
  quickSub:      { fontSize: 11, lineHeight: 15 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle:  { fontSize: 15 },

  tabRow:    { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
  tab:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 5, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabel:  { fontWeight: '600', fontSize: 13 },
  tabBadge:  { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: 'center' },
  tabBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },

  loadingWrap: { alignItems: 'center', paddingVertical: 40 },
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
  title:   { fontWeight: '700', textAlign: 'center' },
  msg:     { textAlign: 'center', lineHeight: 22, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16, width: '100%' },
  btn:     { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 14, alignItems: 'center' },
});
