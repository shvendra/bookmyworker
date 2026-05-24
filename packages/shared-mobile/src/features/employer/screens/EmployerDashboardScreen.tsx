import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { shortlistStorage } from '../../../core/storage/shortlistStorage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { useAppConfig, formatStat } from '../../../core/api/endpoints/appConfigApi';
import { usePricingConfig } from '../../../core/api/endpoints/pricingApi';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { RawRequirement, PastWorker } from '../../../core/api/endpoints/requirementsApi';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import type { RawAgent } from '../../../core/api/endpoints/workerApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { workerMappingApi } from '../../../core/api/endpoints/workerMappingApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { BrandLogo } from '../../../shared/components/ui/BrandLogo';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import { useToast } from '../../../shared/state/toast/ToastContext';
import type { MainStackParamList } from '../../../app/navigation/types';
import { buildPhotoUrl } from '../../../core/config/env';
import { apiClient } from '../../../core/api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmployerSubscriptionModal } from '../../payment/components/EmployerSubscriptionModal';

const EMPLOYER_SUB_MODAL_KEY = 'employer_sub_modal_shown';


// ─── Types & Constants ─────────────────────────────────────────────────────────
type ReqTab = 'all' | 'open' | 'closed';
type Nav = NativeStackNavigationProp<MainStackParamList>;

const REQ_TABS: Array<{ label: string; value: ReqTab }> = [
  { label: 'All',   value: 'all' },
  { label: 'Open',  value: 'open' },
  { label: 'Close', value: 'closed' },
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
  closing: boolean;
  colors: any;
}

const RequirementCard = React.memo(({ req, onPress, onClose, closing, colors }: CardProps): React.JSX.Element => {
  const closed    = isClosed(req);
  const assigned  = isAssigned(req);
  const interested = req.intrestedAgents?.length ?? 0;

  const statusLabel = closed ? 'Closed' : assigned ? 'Ongoing' : 'Open';
  const statusColor = closed ? '#64748B' : assigned ? '#7C3AED' : '#059669';
  const accentColor = closed ? '#94A3B8' : assigned ? '#7C3AED' : '#059669';

  const handlePress    = useCallback(() => onPress(req._id), [onPress, req._id]);
  const handleClose    = useCallback(() => onClose(req), [onClose, req]);
  const handlePhonePress = useCallback(() => {
    if (req.assignedAgentPhone) void Linking.openURL(`tel:${req.assignedAgentPhone}`);
  }, [req.assignedAgentPhone]);

  const totalWorkers = (req.workerQuantitySkilled ?? 0) + (req.workerQuantityUnskilled ?? 0);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.86}
      style={[card.wrap, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: accentColor }]}
    >
      {/* Left accent strip */}
      <View style={[card.accentStrip, { backgroundColor: accentColor }]} />

      <View style={card.inner}>
        {/* ── Header row ── */}
        <View style={card.topRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText style={[card.title, { color: colors.text }]} numberOfLines={2}>
              {fmtLabel(req.workType)}
            </AppText>
            {req.subCategory ? (
              <AppText style={[card.subTitle, { color: colors.mutedText }]}>
                {fmtLabel(req.subCategory)}
              </AppText>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <View style={[card.statusPill, { backgroundColor: statusColor + '15', borderColor: statusColor + '40' }]}>
              <View style={[card.statusDot, { backgroundColor: statusColor }]} />
              <AppText style={[card.statusTxt, { color: statusColor }]}>{statusLabel}</AppText>
            </View>
            {req.ERN_NUMBER ? (
              <View style={[card.ernChip, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
                <AppText style={[card.ernTxt, { color: colors.mutedText }]}>#{req.ERN_NUMBER}</AppText>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Assigned agent row ── */}
        {assigned && !closed && (
          <TouchableOpacity
            onPress={handlePhonePress}
            style={[card.agentRow, { backgroundColor: '#EDE9FE', borderColor: '#C4B5FD' }]}
            activeOpacity={req.assignedAgentPhone ? 0.72 : 1}
          >
            <View style={card.agentAvatar}>
              <AppText style={{ fontSize: 14 }}>👷</AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={[card.agentName, { color: '#4C1D95' }]}>
                {req.assignedAgentName ?? 'Agent Assigned'}
              </AppText>
              {req.assignedAgentPhone ? (
                <AppText style={card.agentPhone}>📞 {req.assignedAgentPhone}</AppText>
              ) : null}
            </View>
            <View style={card.agentBadge}>
              <AppText style={card.agentBadgeTxt}>Tap to call</AppText>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Interested agents banner ── */}
        {!closed && !assigned && (
          <View style={[
            card.interestBanner,
            interested > 0
              ? { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' }
              : { backgroundColor: colors.surface1, borderColor: colors.border },
          ]}>
            <View style={[card.interestIconWrap, { backgroundColor: interested > 0 ? '#FEF3C7' : colors.surface }]}>
              <AppText style={{ fontSize: 14, lineHeight: 18 }}>{interested > 0 ? '🙋' : '👀'}</AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={[card.interestPrimary, { color: interested > 0 ? '#92400E' : colors.text }]}>
                {interested > 0 ? `${interested} Agent${interested === 1 ? '' : 's'} Interested` : 'No agents yet'}
              </AppText>
              <AppText style={[card.interestSub, { color: interested > 0 ? '#B45309' : colors.mutedText }]}>
                {interested > 0 ? 'Tap to review and take action' : 'Share your requirement to get responses'}
              </AppText>
            </View>
            {interested > 0 && (
              <View style={card.interestChevron}>
                <AppText style={{ color: '#92400E', fontSize: 16, fontWeight: '700' }}>›</AppText>
              </View>
            )}
          </View>
        )}

        {/* ── Meta chips ── */}
        <View style={[card.metaRow, { borderTopColor: colors.divider }]}>
          {(req.district || req.state) ? (
            <View style={[card.metaChip, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
              <AppText style={[card.metaTxt, { color: colors.mutedText }]}>
                📍 {[req.district, req.state].filter(Boolean).join(', ')}
              </AppText>
            </View>
          ) : null}
          {totalWorkers > 0 ? (
            <View style={[card.metaChip, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
              <AppText style={[card.metaTxt, { color: colors.mutedText }]}>👷 {totalWorkers}</AppText>
            </View>
          ) : null}
          {req.minBudgetPerWorker != null ? (
            <View style={[card.metaChip, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
              <AppText style={[card.metaTxt, { color: '#166534', fontWeight: '700' }]}>
                ₹{req.minBudgetPerWorker}–{req.maxBudgetPerWorker ?? req.minBudgetPerWorker}/day
              </AppText>
            </View>
          ) : null}
          {req.workerNeedDate ? (
            <View style={[card.metaChip, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
              <AppText style={[card.metaTxt, { color: colors.mutedText }]}>🗓 {fmtDate(req.workerNeedDate)}</AppText>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});
RequirementCard.displayName = 'RequirementCard';

const card = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  accentStrip: { width: 4 },
  inner:       { flex: 1, padding: 14, gap: 10 },
  topRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  title:       { fontSize: 15, fontWeight: '800', lineHeight: 20, letterSpacing: -0.1 },
  subTitle:    { fontSize: 12, fontWeight: '600', marginTop: 1 },
  statusPill:  { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4, gap: 5 },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusTxt:   { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  ernChip:     { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  ernTxt:      { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  // Assigned agent
  agentRow:    { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 10, gap: 10 },
  agentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#C4B5FD', alignItems: 'center', justifyContent: 'center' },
  agentName:   { fontSize: 13, fontWeight: '800', textTransform: 'capitalize' },
  agentPhone:  { fontSize: 11, color: '#6D28D9', marginTop: 2, fontWeight: '600' },
  agentBadge:  { backgroundColor: '#7C3AED', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  agentBadgeTxt:{ fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  // Interest banner
  interestBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 10, gap: 10 },
  interestIconWrap:{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  interestPrimary: { fontSize: 13, fontWeight: '800' },
  interestSub:     { fontSize: 11, fontWeight: '500', marginTop: 1 },
  interestChevron: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  // Meta
  metaRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 2 },
  metaChip:    { flexDirection: 'row', alignItems: 'center', borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  metaTxt:     { fontSize: 11, fontWeight: '600' },
  // unused but kept to avoid TS errors on old references
  actions:     { flexDirection: 'row', gap: 8, paddingTop: 10, marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth },
  actionBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: 10, paddingVertical: 8 },
  actionIcon:  { fontSize: 13, lineHeight: 16 },
  actionTxt:   { fontSize: 12, fontWeight: '700' },
});

// ─── Agent Tile Component ──────────────────────────────────────────────────────
const AgentTile = React.memo(({ agent, onPress }: { agent: RawAgent; onPress: (id: string) => void }): React.JSX.Element => {
  const { theme } = useAppTheme();
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
      <AppText style={[tile.name, { color: theme.colors.text }]} numberOfLines={1}>{formattedName}</AppText>
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
  name:          { fontSize: 12, fontWeight: '800', color: '#0f172a', textAlign: 'center', width: 80, textTransform: 'capitalize' },
  phone:         { fontSize: 10, fontWeight: '700', color: '#2563eb', textAlign: 'center', marginTop: 2 },
  stars:         { flexDirection: 'row', marginTop: 3 },
  star:          { fontSize: 10 },
  moreTile:      { width: 80, height: 100, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eff6ff', borderWidth: 1.5, borderColor: '#93c5fd', borderStyle: 'dashed', gap: 2, marginRight: 10 },
  moreCount:     { fontSize: 18, fontWeight: '800', color: '#1d4ed8' },
  moreLabel:     { fontSize: 10, fontWeight: '700', color: '#475569', lineHeight: 13 },
});

// ─── Activity Types & Utils ────────────────────────────────────────────────────
interface ActivityItem {
  _id: string;
  action: string;
  entity: string;
  description?: string;
  createdAt: string;
}

const timeAgo = (date: string): string => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const ACTION_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  CREATE: { bg: '#dcfce7', color: '#16a34a', border: '#86efac' },
  UPDATE: { bg: '#dbeafe', color: '#2563eb', border: '#93c5fd' },
  DELETE: { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
  VIEW:   { bg: '#f5f3ff', color: '#7c3aed', border: '#c4b5fd' },
  LOGIN:  { bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
  LOGOUT: { bg: '#fff7ed', color: '#ea580c', border: '#fdba74' },
};

// ─── Nearby Worker List Card ───────────────────────────────────────────────────
const NearbyWorkerCard = React.memo(({
  agent, onPress,
}: { agent: RawAgent; onPress: (id: string) => void }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const photoUrl = buildPhotoUrl(agent.profilePhoto);
  const firstName = (agent.name ?? '?').trim().split(' ')[0] ?? '?';
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  const handlePress = useCallback(() => onPress(agent._id), [onPress, agent._id]);

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.82} style={nwc.wrap}>
      <View style={nwc.avatarWrap}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={nwc.avatar} />
        ) : (
          <View style={nwc.avatarFallback}>
            <AppText style={nwc.initials}>{displayName.charAt(0)}</AppText>
          </View>
        )}
      </View>
      <View style={nwc.info}>
        <View style={nwc.nameRow}>
          <AppText style={[nwc.name, { color: theme.colors.text }]} numberOfLines={1}>{agent.name ?? displayName}</AppText>
          {agent.veryfiedBage && (
            <View style={nwc.verifiedBadge}>
              <AppText style={nwc.verifiedTxt}>✓ Verified</AppText>
            </View>
          )}
        </View>
        {agent.role ? <AppText style={nwc.role} numberOfLines={1}>{agent.role}</AppText> : null}
        {(agent as any).categories?.length > 0 && (
          <AppText style={nwc.cats} numberOfLines={1}>
            {((agent as any).categories as string[]).slice(0, 2).join(' · ')}
          </AppText>
        )}
      </View>
      <AppText style={nwc.chevron}>›</AppText>
    </TouchableOpacity>
  );
});
NearbyWorkerCard.displayName = 'NearbyWorkerCard';

const nwc = StyleSheet.create({
  wrap:           { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f1f5f9' },
  avatarWrap:     {},
  avatar:         { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: '#2563eb' },
  avatarFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#2563eb' },
  initials:       { fontSize: 16, fontWeight: '800', color: '#1d4ed8' },
  info:           { flex: 1, gap: 1 },
  nameRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name:           { fontSize: 13, fontWeight: '700', color: '#0f172a', flexShrink: 1, textTransform: 'capitalize' },
  verifiedBadge:  { backgroundColor: '#f0fdf4', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: '#86efac' },
  verifiedTxt:    { fontSize: 9, fontWeight: '700', color: '#15803d' },
  role:           { fontSize: 11, color: '#64748b' },
  cats:           { fontSize: 10, color: '#94a3b8' },
  chevron:        { fontSize: 18, color: '#cbd5e1', fontWeight: '600' },
});

// ─── Activity Row ──────────────────────────────────────────────────────────────
const ActivityRow = React.memo(({
  item, isLast,
}: { item: ActivityItem; isLast: boolean }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const cfg = ACTION_COLOR[item.action] ?? ACTION_COLOR.UPDATE;
  return (
    <View style={[ar.row, isLast && { borderBottomWidth: 0 }]}>
      <View style={[ar.dot, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
        <AppText style={[ar.dotTxt, { color: cfg.color }]}>
          {item.action === 'CREATE' ? '+' : item.action === 'DELETE' ? '×' : item.action === 'VIEW' ? '◉' : '✎'}
        </AppText>
      </View>
      <View style={ar.body}>
        <View style={ar.topRow}>
          <View style={[ar.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
            <AppText style={[ar.badgeTxt, { color: cfg.color }]}>{item.action}</AppText>
          </View>
          <AppText style={ar.entity}>{item.entity}</AppText>
        </View>
        <AppText style={[ar.desc, { color: theme.colors.text }]} numberOfLines={1}>{item.description ?? item.action}</AppText>
        <AppText style={ar.time}>{timeAgo(item.createdAt)}</AppText>
      </View>
    </View>
  );
});
ActivityRow.displayName = 'ActivityRow';

const ar = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f1f5f9' },
  dot:      { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dotTxt:   { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  body:     { flex: 1, gap: 2 },
  topRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  badge:    { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1 },
  badgeTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  entity:   { fontSize: 10, color: '#94a3b8' },
  desc:     { fontSize: 12, fontWeight: '600', color: '#0f172a' },
  time:     { fontSize: 10, color: '#94a3b8' },
});

// ─── Quick Action Card ─────────────────────────────────────────────────────────
interface QuickActionProps {
  title: string;
  subtitle: string;
  count: string | null;
  label: string;
  emoji: string;
  accentColor: string;
  iconBg: string;
  isLoading: boolean;
  onPress: () => void;
}
const QuickActionCard = React.memo(({
  title, subtitle, count, label, emoji, accentColor, iconBg, isLoading, onPress,
}: QuickActionProps): React.JSX.Element => (
  <TouchableOpacity onPress={isLoading ? undefined : onPress} activeOpacity={0.85} style={[qa.card]}>
    <View style={[qa.topAccent, { backgroundColor: accentColor }]} />
    <View style={qa.inner}>
      <View style={qa.topRow}>
        <View style={[qa.iconWrap, { backgroundColor: iconBg }]}>
          <AppText style={qa.emoji}>{emoji}</AppText>
        </View>
        <AppText style={qa.chevron}>›</AppText>
      </View>
      {isLoading || count === null ? (
        <View style={qa.skeleton} />
      ) : (
        <AppText style={qa.count} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{count}</AppText>
      )}
      <AppText style={qa.label} numberOfLines={1}>{label}</AppText>
      <AppText style={qa.title} numberOfLines={1}>{title}</AppText>
      <AppText style={qa.subtitle} numberOfLines={2}>{subtitle}</AppText>
    </View>
  </TouchableOpacity>
));
QuickActionCard.displayName = 'QuickActionCard';

const qa = StyleSheet.create({
  card:      { width: '48%', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', marginBottom: 12, overflow: 'hidden', elevation: 2, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  topAccent: { height: 4 },
  inner:     { padding: 14 },
  topRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  iconWrap:  { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  emoji:     { fontSize: 22, lineHeight: 26 },
  chevron:   { fontSize: 22, color: '#94a3b8', fontWeight: '600', lineHeight: 26 },
  skeleton:  { height: 26, width: '55%', borderRadius: 8, backgroundColor: '#e2e8f0', marginBottom: 4 },
  count:     { fontSize: 22, fontWeight: '900', color: '#0f172a', lineHeight: 26, marginBottom: 2 },
  label:     { fontSize: 10, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  title:     { fontSize: 13, fontWeight: '800', color: '#0f172a', marginBottom: 3 },
  subtitle:  { fontSize: 11, color: '#64748b', lineHeight: 15 },
});

// ─── Main Screen Component ─────────────────────────────────────────────────────
export const EmployerDashboardScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const { config } = useAppConfig();
  const { pricing } = usePricingConfig();
  const user = state.session?.user;
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [reqTab, setReqTab]  = useState<ReqTab>('all');
  const [closeTarget, setCloseTarget] = useState<RawRequirement | null>(null);
  const [closingId, setClosingId]     = useState<string | null>(null);
  const [subModalVisible, setSubModalVisible] = useState(false);
  const [shortlistCount, setShortlistCount] = useState(0);


  // ── Network Queries ───────────────────────────────────────────────────────
  const dashQuery = useQuery({
    queryKey: ['employer-dashboard'],
    queryFn: async () => {
      const res = await apiClient.get<{ totalWorkerCount?: number }>('/api/v1/employer/dashboard');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

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
      workerGroup: 'individual',
      page: 1,
      limit: 20,
    }),
    staleTime: 10 * 60 * 1000,
    enabled: !!user?.state,
  });

  const activityQuery = useQuery({
    queryKey: ['employer-activity'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; activities?: ActivityItem[] }>('/api/v1/activity/my', { params: { limit: 6 } });
      return res.data.activities ?? [];
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const pastWorkersQuery = useQuery<PastWorker[]>({
    queryKey: ['employer-past-workers'],
    queryFn: () => requirementsApi.getHiredWorkers(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!user?.id,
  });

  const pipelineQuery = useQuery({
    queryKey: ['employer-pipeline-totals'],
    queryFn: async () => {
      const res = await workerMappingApi.getEmployerPipelineOverview();
      return res.totals;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: isSubscribed,
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
  const openCount   = useMemo(() => all.filter((r) => !isAssigned(r) && !isClosed(r)).length, [all]);
  const closedCount = useMemo(() => all.filter((r) => isClosed(r)).length, [all]);

  const filteredRequirements = useMemo(() => {
    return all.filter((r) => {
      if (reqTab === 'open')   return !isAssigned(r) && !isClosed(r);
      if (reqTab === 'closed') return isClosed(r);
      return true;
    });
  }, [all, reqTab]);

  const nearbyAgents: RawAgent[] = nearbyQuery.data?.rawAgents ?? [];
  const nearbyTotal = (nearbyQuery.data?.total ?? 0) + 300;
  const displayedNearby = useMemo(() => nearbyAgents.slice(0, NEARBY_SHOW), [nearbyAgents]);

  const interestedCount = useMemo(
    () => all.reduce((sum, r) => sum + (r.intrestedAgents?.length ?? 0), 0),
    [all],
  );

  const totalWorkersDisplay = formatStat(config.stats.workerCount);

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

  // Refresh shortlist badge count on every focus
  useFocusEffect(
    useCallback(() => {
      void shortlistStorage.getAll().then((ids) => setShortlistCount(ids.length));
    }, []),
  );

  // Auto-show subscription modal once for non-subscribed employers
  useEffect(() => {
    if (!profileQuery.isSuccess || isSubscribed) return;
    void AsyncStorage.getItem(EMPLOYER_SUB_MODAL_KEY).then((shown) => {
      if (!shown) {
        setSubModalVisible(true);
        void AsyncStorage.setItem(EMPLOYER_SUB_MODAL_KEY, '1');
      }
    });
  }, [profileQuery.isSuccess, isSubscribed]);

  // ── Callbacks ──────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    void reqQuery.refetch();
    void profileQuery.refetch();
    void nearbyQuery.refetch();
    void dashQuery.refetch();
    void activityQuery.refetch();
    void pastWorkersQuery.refetch();
    if (isSubscribed) void pipelineQuery.refetch();
  }, [reqQuery, profileQuery, nearbyQuery, dashQuery, activityQuery, pastWorkersQuery, pipelineQuery, isSubscribed]);

  const handlePost = useCallback(() => {
    if (profileQuery.isLoading) return;
    // No subscription or expired → go to pricing
    if (!isSubscribed) { navigation.navigate('Subscription'); return; }
    // Subscribed but all contacts used up → go to top-up
    if (remainingContacts <= 0) { navigation.navigate('Subscription'); return; }
    navigation.navigate('PostRequirement');
  }, [isSubscribed, remainingContacts, profileQuery.isLoading, navigation]);

  const handleWorkerSearchNavigate = useCallback(() => navigation.navigate('WorkerSearch'), [navigation]);
  const handlePipelineNavigate = useCallback(() => navigation.navigate('EmployerPipeline'), [navigation]);
  const handleSubscriptionNavigate = useCallback(() => navigation.navigate('Subscription'), [navigation]);
  const handleOpenSubModal = useCallback(() => setSubModalVisible(true), []);
  const handleKycNavigate = useCallback(() => navigation.navigate('KycVerification'), [navigation]);
  const handleAgentTilePress = useCallback((id: string) => navigation.navigate('WorkerProfile', { workerId: id }), [navigation]);
  const handleReqCardPress = useCallback((id: string) => navigation.navigate('RequirementDetail', { requirementId: id }), [navigation]);
  const handleReqCardClose = useCallback((req: RawRequirement) => setCloseTarget(req), []);

  // ── Render Sub-blocks for FlatList ──────────────────────────────────────────
  const renderHeader = useMemo(() => (
    <View>
      {/* ── Greeting card ── */}
      <View style={[styles.greetCard, { backgroundColor: theme.colors.card }]}>
        <View style={styles.greetTop}>
          <View style={{ flex: 1 }}>
            <AppText style={[styles.greetTitle, { color: theme.colors.text }]}>
              {getGreeting()}, {(user?.fullName ?? 'Employer').split(' ')[0]}!
            </AppText>
            <AppText style={[styles.greetSub, { color: theme.colors.mutedText }]}>
              {kycUnverified
                ? 'Your profile is pending verification.'
                : isSubscribed
                ? `Premium active · ${remainingContacts} contacts remaining`
                : 'Welcome to BookMyWorker'}
            </AppText>
          </View>
          <AppText style={styles.greetEmoji}>👋</AppText>
        </View>
        {kycUnverified && (
          <TouchableOpacity onPress={handleKycNavigate} style={[styles.greetBtn, { borderColor: theme.colors.primary }]} activeOpacity={0.8}>
            <AppText style={[styles.greetBtnTxt, { color: theme.colors.primary }]}>Complete Verification</AppText>
          </TouchableOpacity>
        )}
        {profileQuery.isSuccess && !isSubscribed && !kycUnverified && (
          <TouchableOpacity onPress={handleSubscriptionNavigate} style={[styles.greetBtn, { borderColor: '#ea580c' }]} activeOpacity={0.8}>
            <AppText style={[styles.greetBtnTxt, { color: '#ea580c' }]}>🔓 Subscribe to Unlock Features</AppText>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Subscription upsell banner (non-subscribed only) ── */}
      {profileQuery.isSuccess && !isSubscribed && (
        <TouchableOpacity onPress={handleOpenSubModal} activeOpacity={0.85} style={subBanner.wrap}>
          <View style={subBanner.iconWrap}>
            <AppText style={subBanner.icon}>⭐</AppText>
          </View>
          <View style={subBanner.body}>
            <AppText style={subBanner.title}>Unlock Premium Access</AppText>
            <AppText style={subBanner.sub}>From ₹{pricing.subscription.individual['1m']}/month · Post jobs & connect with workers</AppText>
          </View>
          <AppText style={subBanner.arrow}>→</AppText>
        </TouchableOpacity>
      )}

      {/* ── Quick Action Cards ── */}
      <View style={styles.qaRow}>
        {/* Post Requirement */}
        <TouchableOpacity onPress={handlePost} activeOpacity={0.88} style={[styles.qaCard, styles.qaCardBlue]}>
          <View style={styles.qaCardInner}>
            <View style={styles.qaIconWrap}>
              <AppText style={styles.qaIcon}>⚡</AppText>
            </View>
            <View style={styles.qaNewBadge}>
              <AppText style={styles.qaNewTxt}>
                {openCount > 0 ? 'ACTIVE' : 'POST NEW'}
              </AppText>
            </View>
          </View>
          <AppText style={styles.qaCount}>
            {reqQuery.isLoading ? '—' : String(openCount)}
          </AppText>
          <AppText style={styles.qaTitle}>Post Requirement</AppText>
          <AppText style={styles.qaSub}>
            {openCount > 0 ? `${openCount} active requirement${openCount !== 1 ? 's' : ''}` : 'Publish a new\nworker requirement'}
          </AppText>
          <View style={styles.qaArrow}>
            <AppText style={styles.qaArrowTxt}>→</AppText>
          </View>
        </TouchableOpacity>

        {/* Browse Workers */}
        <TouchableOpacity onPress={handleWorkerSearchNavigate} activeOpacity={0.88} style={[styles.qaCard, styles.qaCardGreen]}>
          <View style={styles.qaCardInner}>
            <View style={[styles.qaIconWrap, styles.qaIconWrapGreen]}>
              <AppText style={styles.qaIcon}>👷</AppText>
            </View>
            <View style={[styles.qaNewBadge, styles.qaNewBadgeGreen]}>
              <AppText style={[styles.qaNewTxt, { color: '#065f46' }]}>AVAILABLE</AppText>
            </View>
          </View>
          <AppText style={[styles.qaCount, styles.qaCountGreen]}>{totalWorkersDisplay}</AppText>
          <AppText style={[styles.qaTitle, styles.qaTitleGreen]}>Browse Workers</AppText>
          <AppText style={[styles.qaSub, styles.qaSubGreen]}>Explore verified{'\n'}workers & agents</AppText>
          <View style={[styles.qaArrow, styles.qaArrowGreen]}>
            <AppText style={[styles.qaArrowTxt, { color: '#065f46' }]}>→</AppText>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Subscription status card (if subscribed) ── */}
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

      {/* ── Hiring Pipeline strip (subscribed only) ── */}
      {isSubscribed && (
        <TouchableOpacity onPress={handlePipelineNavigate} activeOpacity={0.85} style={pip.card}>
          <View style={pip.header}>
            <AppText style={pip.title}>Hiring Pipeline</AppText>
            <AppText style={pip.viewAll}>View All  ›</AppText>
          </View>
          <View style={pip.row}>
            {([
              { key: 'Shortlisted' as const, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', emoji: '🔖' },
              { key: 'Selected'    as const, color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe', emoji: '✅' },
              { key: 'Joined'      as const, color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', emoji: '🤝' },
            ] as const).map((s) => (
              <View key={s.key} style={[pip.cell, { backgroundColor: s.bg, borderColor: s.border }]}>
                <AppText style={{ fontSize: 16, marginBottom: 2 }}>{s.emoji}</AppText>
                <AppText style={[pip.count, { color: s.color }]}>
                  {pipelineQuery.isLoading ? '—' : String(pipelineQuery.data?.[s.key] ?? 0)}
                </AppText>
                <AppText style={[pip.label, { color: s.color }]}>{s.key}</AppText>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      )}

      {/* ── Pending Tasks ── */}
      {(kycUnverified || !isSubscribed) && (
        <View style={[styles.pendingSection, { backgroundColor: theme.colors.card }]}>
          <AppText style={[styles.pendingTitle, { color: theme.colors.text }]}>Pending Tasks</AppText>
          {kycUnverified && (
            <TouchableOpacity onPress={handleKycNavigate} style={styles.pendingTask} activeOpacity={0.8}>
              <View style={styles.pendingTaskIcon}>
                <AppText style={{ fontSize: 20 }}>🪪</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={[styles.pendingTaskTitle, { color: theme.colors.text }]}>KYC Verification — <AppText style={{ color: '#d97706' }}>Important</AppText></AppText>
                <AppText style={[styles.pendingTaskSub, { color: theme.colors.mutedText }]}>Complete KYC to unlock full features</AppText>
              </View>
              <TouchableOpacity onPress={handleKycNavigate} style={styles.pendingTaskBtn} activeOpacity={0.8}>
                <AppText style={styles.pendingTaskBtnTxt}>Submit documents</AppText>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          {profileQuery.isSuccess && !isSubscribed && (
            <TouchableOpacity onPress={handleSubscriptionNavigate} style={styles.pendingTask} activeOpacity={0.8}>
              <View style={styles.pendingTaskIcon}>
                <AppText style={{ fontSize: 20 }}>🔒</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={[styles.pendingTaskTitle, { color: theme.colors.text }]}>Activate Subscription</AppText>
                <AppText style={[styles.pendingTaskSub, { color: theme.colors.mutedText }]}>Post requirements & view contacts</AppText>
              </View>
              <TouchableOpacity onPress={handleSubscriptionNavigate} style={styles.pendingTaskBtn} activeOpacity={0.8}>
                <AppText style={styles.pendingTaskBtnTxt}>Subscribe</AppText>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Nearby Workers — CRM NearbyWorkersSection style ── */}
      <View style={[nws.card, { backgroundColor: theme.colors.card }]}>
        {/* Header */}
        <View style={nws.header}>
          <View style={nws.headerLeft}>
            <AppText style={[nws.title, { color: theme.colors.text }]}>Workers Near You</AppText>
            {nearbyQuery.isSuccess && nearbyTotal > 0 && (
              <View style={nws.countPill}>
                <AppText style={nws.countPillTxt}>
                  {nearbyTotal >= 1000
                    ? `${(nearbyTotal / 1000).toFixed(1).replace(/\.0$/, '')}K+`
                    : String(nearbyTotal)}
                </AppText>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={handleWorkerSearchNavigate} activeOpacity={0.7}>
            <AppText style={nws.viewAllTxt}>View All  ›</AppText>
          </TouchableOpacity>
        </View>
        <AppText style={[nws.sub, { color: theme.colors.mutedText }]}>
          Verified workers in {user?.district ?? user?.state ?? 'your area'}
        </AppText>

        {nearbyQuery.isLoading ? (
          <View style={nws.loadWrap}>
            <ActivityIndicator color="#ea580c" size="small" />
          </View>
        ) : displayedNearby.length === 0 ? (
          <View style={nws.emptyWrap}>
            <AppText style={nws.emptyTxt}>No verified workers found near {user?.district ?? 'your location'}.</AppText>
            <TouchableOpacity onPress={handleWorkerSearchNavigate} style={nws.browseBtn} activeOpacity={0.8}>
              <AppText style={nws.browseBtnTxt}>Browse All Workers  ›</AppText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {displayedNearby.map((agent) => (
              <NearbyWorkerCard key={agent._id} agent={agent} onPress={handleAgentTilePress} />
            ))}
            {/* Footer */}
            <View style={nws.footer}>
              <AppText style={nws.footerTxt}>
                {nearbyTotal.toLocaleString('en-IN')} workers available near you
              </AppText>
              <TouchableOpacity onPress={handleWorkerSearchNavigate} activeOpacity={0.7}>
                <AppText style={nws.footerLink}>View All Workers  ›</AppText>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <AppText style={[styles.sectionTitle, { color: theme.colors.text }]}>New Requirements</AppText>
        {reqQuery.isFetching && !isRefreshing && (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        )}
      </View>

      <View style={[styles.tabRow, { borderBottomColor: theme.colors.border }]}>
        {REQ_TABS.map((t) => {
          const count = t.value === 'open' ? openCount : t.value === 'closed' ? closedCount : all.length;
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
  ), [theme, user, isSubscribed, remainingContacts, profile, handleSubscriptionNavigate, handleOpenSubModal, kycUnverified, handleKycNavigate, reqQuery.isSuccess, reqQuery.isLoading, reqQuery.isFetching, all.length, openCount, closedCount, interestedCount, handlePost, handleWorkerSearchNavigate, nearbyQuery.isLoading, nearbyQuery.isSuccess, displayedNearby, nearbyTotal, reqTab, handleAgentTilePress, isRefreshing, profileQuery.isSuccess, profileQuery.isLoading, dashQuery.isSuccess, dashQuery.isLoading, totalWorkersDisplay, navigation, shortlistCount, handlePipelineNavigate, pipelineQuery.isLoading, pipelineQuery.data]);

  const renderFooter = useMemo(() => (
    <View>
      {/* ── Recent Activity ── */}
      <View style={[act.card, { backgroundColor: theme.colors.card }]}>
        <View style={act.header}>
          <AppText style={[act.title, { color: theme.colors.text }]}>Recent Activity</AppText>
          <TouchableOpacity onPress={() => navigation.navigate('MyActivity')} activeOpacity={0.7}>
            <AppText style={act.viewAll}>View All  ›</AppText>
          </TouchableOpacity>
        </View>

        {activityQuery.isLoading ? (
          <View style={act.loadWrap}>
            <ActivityIndicator size="small" color="#2563eb" />
          </View>
        ) : (activityQuery.data?.length ?? 0) === 0 ? (
          <View style={act.emptyWrap}>
            <AppText style={act.emptyIcon}>📋</AppText>
            <AppText style={act.emptyTxt}>No activity recorded yet.</AppText>
            <AppText style={act.emptySub}>Actions you take will appear here.</AppText>
          </View>
        ) : (
          <>
            {(activityQuery.data ?? []).map((item: ActivityItem, i: number) => (
              <ActivityRow
                key={item._id}
                item={item}
                isLast={i === (activityQuery.data!.length - 1)}
              />
            ))}
            <TouchableOpacity
              onPress={() => navigation.navigate('MyActivity')}
              style={act.footer}
              activeOpacity={0.7}
            >
              <AppText style={act.footerTxt}>See full activity log  →</AppText>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Upgrade Banner (non-subscribers only) ── */}
      {profileQuery.isSuccess && !isSubscribed && (
        <View style={ub.card}>
          <View style={ub.iconWrap}>
            <AppText style={ub.icon}>🚀</AppText>
          </View>
          <View style={ub.body}>
            <AppText style={[ub.title, { color: theme.colors.text }]}>Upgrade to Premium & Hire Better!</AppText>
            <AppText style={ub.desc}>
              Boost your job visibility, get more applications and connect with verified & experienced workers.
            </AppText>
            <View style={ub.features}>
              {['Top priority in search', 'Featured employer badge', 'Unlimited job posts', 'Priority support'].map((f) => (
                <View key={f} style={ub.featureRow}>
                  <AppText style={ub.featureTick}>✅</AppText>
                  <AppText style={ub.featureTxt}>{f}</AppText>
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={handleSubscriptionNavigate} style={ub.btn} activeOpacity={0.85}>
              <AppText style={ub.btnTxt}>⭐  Upgrade Now</AppText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Past Workers ── */}
      {(pastWorkersQuery.isLoading || (pastWorkersQuery.data?.length ?? 0) > 0) && (
        <View style={[pw.card, { backgroundColor: theme.colors.card }]}>
          <View style={pw.header}>
            <View style={pw.headerLeft}>
              <AppText style={[pw.title, { color: theme.colors.text }]}>Past Workers</AppText>
              {(pastWorkersQuery.data?.length ?? 0) > 0 && (
                <View style={pw.countPill}>
                  <AppText style={pw.countPillTxt}>{pastWorkersQuery.data!.length}</AppText>
                </View>
              )}
            </View>
            <AppText style={pw.sub}>Workers you've hired before</AppText>
          </View>

          {pastWorkersQuery.isLoading ? (
            <View style={pw.loadWrap}>
              <ActivityIndicator size="small" color="#1037A4" />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pw.listContent}>
              {(pastWorkersQuery.data ?? []).map((worker, idx) => {
                const initials = (worker.workerName || 'W')
                  .split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
                const skill = worker.areasOfWork?.[0] || worker.workType || '—';
                const hireDate = worker.lastHireDate
                  ? new Date(worker.lastHireDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—';
                const PALETTES = [
                  { bg: '#EBF1FF', text: '#1A56DB' },
                  { bg: '#F5F3FF', text: '#7C3AED' },
                  { bg: '#ECFDF5', text: '#059669' },
                  { bg: '#FFF7ED', text: '#EA580C' },
                ];
                const pal = PALETTES[idx % PALETTES.length]!;

                return (
                  <TouchableOpacity
                    key={worker.workerId ?? worker.workerPhone ?? String(idx)}
                    style={pw.workerCard}
                    onPress={() => worker.workerId
                      ? navigation.navigate('WorkerProfile', { workerId: worker.workerId })
                      : undefined
                    }
                    activeOpacity={worker.workerId ? 0.85 : 1}
                  >
                    <View style={[pw.avatar, { backgroundColor: pal.bg }]}>
                      <AppText style={[pw.initials, { color: pal.text }]}>{initials}</AppText>
                    </View>
                    <AppText style={[pw.workerName, { color: theme.colors.text }]} numberOfLines={1}>
                      {(worker.workerName || 'Unknown').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}
                    </AppText>
                    <AppText style={pw.workerSkill} numberOfLines={1}>{skill}</AppText>
                    <AppText style={pw.workerDate}>{hireDate}</AppText>
                    {worker.workerId && (
                      <View style={pw.viewBtn}>
                        <AppText style={pw.viewBtnTxt}>View</AppText>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* ── Support Footer ── */}
      <View style={sf.card}>
        {[
          { emoji: '🎧', title: 'Need help?', desc: 'Our support team is here for you.' },
          { emoji: '💬', title: 'Support', desc: config.contact.supportEmail },
          { emoji: '💼', title: 'Business Support', desc: config.contact.businessEmail },
        ].map(({ emoji, title, desc }) => (
          <View key={title} style={sf.row}>
            <AppText style={sf.emoji}>{emoji}</AppText>
            <View style={sf.text}>
              <AppText style={[sf.title, { color: theme.colors.text }]}>{title}</AppText>
              <AppText style={sf.desc}>{desc}</AppText>
            </View>
          </View>
        ))}
      </View>
    </View>
  ), [theme, activityQuery.isLoading, activityQuery.data, profileQuery.isSuccess, isSubscribed, handleSubscriptionNavigate, navigation, pastWorkersQuery.isLoading, pastWorkersQuery.data]);

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
      closing={closingId === item._id}
      colors={theme.colors}
    />
  ), [handleReqCardPress, handleReqCardClose, closingId, theme.colors]);

  const keyExtractor = useCallback((item: RawRequirement) => item._id, []);

  const refreshControlComponent = useMemo(() => (
    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
  ), [isRefreshing, handleRefresh, theme.colors.primary]);

  return (
    <>
      {/* ── Fixed Hero Header ────────────────────────────────────────────── */}
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <View style={[fh.wrap, { paddingTop: insets.top + 8 }]}>
        <View style={fh.circle1} />
        <View style={fh.circle2} />
        {/* Top brand bar */}
        <View style={fh.brandRow}>
          <View style={fh.brandLeft}>
            <BrandLogo style={fh.brandLogoImg} />
            <AppText style={fh.brandLogo}>BookMyWorker</AppText>
          </View>
          <View style={fh.headerActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('EmployerPipeline')}
              style={fh.shortlistBtn}
              activeOpacity={0.8}
            >
              <AppText style={fh.shortlistIcon}>❤️</AppText>
              {shortlistCount > 0 && (
                <View style={fh.shortlistBadge}>
                  <AppText style={fh.shortlistBadgeTxt}>{shortlistCount}</AppText>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('ChatRoom', {
                roomId: `support_${user?.id ?? ''}`,
                roomName: 'Support Chat',
              })}
              style={fh.shortlistBtn}
              activeOpacity={0.8}
            >
              <AppText style={fh.shortlistIcon}>💬</AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Notifications')} activeOpacity={0.8}>
              <Avatar name={user?.fullName ?? 'E'} size={38} uri={buildPhotoUrl(profile?.profilePhoto)} ring ringColor="rgba(255,255,255,0.55)" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Subscription Upsell Modal ──────────────────────────────────── */}
      <EmployerSubscriptionModal
        visible={subModalVisible}
        onDismiss={() => setSubModalVisible(false)}
        userName={user?.fullName ?? 'Employer'}
      />

      {/* ── Scrollable Body — lifts over header with rounded top ───────── */}
      <View style={[fh.body, { backgroundColor: theme.colors.background }]}>
        <FlatList
          data={filteredRequirements}
          keyExtractor={keyExtractor}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={refreshControlComponent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmptyComponent}
          renderItem={renderItem}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      </View>

      {/* ── Close Confirm Modal ───────────────────────────────────────── */}
      <Modal visible={!!closeTarget} animationType="fade" transparent onRequestClose={() => setCloseTarget(null)}>
        <View style={confirm.overlay}>
          <View style={[confirm.dialog, { backgroundColor: theme.colors.card }]}>
            {/* Red warning header */}
            <View style={confirm.header}>
              <View style={confirm.iconWrap}>
                <AppText style={confirm.iconEmoji}>⚠️</AppText>
              </View>
              <AppText style={confirm.headerTitle}>Close Requirement?</AppText>
            </View>

            {/* Body */}
            <View style={confirm.body}>
              <AppText style={[confirm.reqName, { color: theme.colors.text }]}>
                "{closeTarget?.workType ?? 'This requirement'}"
              </AppText>
              <AppText style={[confirm.bodyMsg, { color: theme.colors.mutedText }]}>
                This will permanently close the requirement. Interested agents will no longer be able to apply. This action cannot be undone.
              </AppText>
            </View>

            {/* Actions */}
            <View style={confirm.actions}>
              <TouchableOpacity
                onPress={() => setCloseTarget(null)}
                style={[confirm.btn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              >
                <AppText style={[confirm.btnTxt, { color: theme.colors.text }]}>Cancel</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!closeTarget) return;
                  closeMutation.mutate(closeTarget._id);
                  setCloseTarget(null);
                }}
                style={[confirm.btn, confirm.btnDanger]}
              >
                <AppText style={[confirm.btnTxt, { color: '#fff' }]}>Yes, Close It</AppText>
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

  // Greeting card
  greetCard:    { borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, marginBottom: 14, gap: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  greetTop:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  greetTitle:   { fontSize: 17, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  greetSub:     { fontSize: 12, lineHeight: 17 },
  greetEmoji:   { fontSize: 28, lineHeight: 34 },
  greetBtn:     { borderWidth: 1.5, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  greetBtnTxt:  { fontSize: 13, fontWeight: '700' },

  // ── Quick Action Cards ──────────────────────────────────────────────────────
  qaRow:          { flexDirection: 'row', gap: 12, marginBottom: 16 },
  qaCard:         { flex: 1, borderRadius: 20, padding: 16, overflow: 'hidden', elevation: 4, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12, minHeight: 160 },
  qaCardBlue:     { backgroundColor: '#1037A4', shadowColor: '#1037A4' },
  qaCardGreen:    { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', shadowColor: '#059669', elevation: 2, shadowOpacity: 0.08 },
  qaCardInner:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  qaIconWrap:     { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  qaIconWrapGreen:{ backgroundColor: '#D1FAE5' },
  qaIcon:         { fontSize: 20, lineHeight: 24 },
  qaNewBadge:     { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  qaNewBadgeGreen:{ backgroundColor: '#A7F3D0' },
  qaNewTxt:       { fontSize: 8, fontWeight: '900', color: 'rgba(255,255,255,0.9)' },
  qaCount:        { fontSize: 22, fontWeight: '900', color: '#FFFFFF', lineHeight: 26, marginBottom: 2 },
  qaCountGreen:   { color: '#065F46', fontSize: 18 },
  qaTitle:        { fontSize: 13, fontWeight: '800', color: '#FFFFFF', marginBottom: 3 },
  qaTitleGreen:   { color: '#065F46' },
  qaSub:          { fontSize: 10, color: 'rgba(255,255,255,0.72)', lineHeight: 14, flex: 1 },
  qaSubGreen:     { color: '#047857' },
  qaArrow:        { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end', marginTop: 8 },
  qaArrowGreen:   { backgroundColor: '#A7F3D0' },
  qaArrowTxt:     { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  // Pending Tasks section
  pendingSection: { borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14, overflow: 'hidden' },
  pendingTitle:   { fontSize: 14, fontWeight: '800', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  pendingTask:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f1f5f9' },
  pendingTaskIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fffbeb', alignItems: 'center', justifyContent: 'center' },
  pendingTaskTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  pendingTaskSub:  { fontSize: 11 },
  pendingTaskBtn:  { backgroundColor: '#1037A4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  pendingTaskBtnTxt: { fontSize: 11, fontWeight: '700', color: '#fff' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle:  { fontSize: 16, fontWeight: '800' },

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

// ─── Nearby Workers Section Styles ────────────────────────────────────────────
const nws = StyleSheet.create({
  card:       { borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20, overflow: 'hidden' },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  title:      { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  countPill:  { backgroundColor: '#fff7ed', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#fed7aa' },
  countPillTxt:{ fontSize: 11, fontWeight: '700', color: '#ea580c' },
  sub:        { fontSize: 11, paddingHorizontal: 14, paddingBottom: 10 },
  viewAllTxt: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  loadWrap:   { paddingVertical: 28, alignItems: 'center' },
  emptyWrap:  { paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', gap: 10 },
  emptyTxt:   { fontSize: 13, color: '#64748b', textAlign: 'center' },
  browseBtn:  { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#ea580c' },
  browseBtnTxt:{ fontSize: 12, fontWeight: '700', color: '#ea580c' },
  footer:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f1f5f9' },
  footerTxt:  { fontSize: 11, color: '#94a3b8', fontWeight: '500', flex: 1 },
  footerLink: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
});

// ─── Activity Section Styles ───────────────────────────────────────────────────
const act = StyleSheet.create({
  card:     { borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16, overflow: 'hidden' },
  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f1f5f9' },
  title:    { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  viewAll:  { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  loadWrap: { paddingVertical: 24, alignItems: 'center' },
  emptyWrap:{ paddingVertical: 24, alignItems: 'center', gap: 4 },
  emptyIcon:{ fontSize: 28, marginBottom: 4 },
  emptyTxt: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  emptySub: { fontSize: 11, color: '#94a3b8' },
  footer:   { paddingVertical: 12, alignItems: 'center', backgroundColor: '#f8fafc', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f1f5f9' },
  footerTxt:{ fontSize: 12, fontWeight: '600', color: '#2563eb' },
});

// ─── Upgrade Banner Styles ─────────────────────────────────────────────────────
const ub = StyleSheet.create({
  card:        { borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', backgroundColor: '#fff', padding: 18, marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  iconWrap:    { width: 60, height: 60, borderRadius: 30, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  icon:        { fontSize: 28 },
  body:        { flex: 1, gap: 6 },
  title:       { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  desc:        { fontSize: 12, color: '#64748b', lineHeight: 17 },
  features:    { gap: 6, marginTop: 4 },
  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureTick: { fontSize: 13 },
  featureTxt:  { fontSize: 12, color: '#374151' },
  btn:         { marginTop: 10, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  btnTxt:      { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
});

// ─── Support Footer Styles ─────────────────────────────────────────────────────
const pw = StyleSheet.create({
  card:        { borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', paddingTop: 16, paddingBottom: 4, marginBottom: 12, elevation: 1, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
  header:      { paddingHorizontal: 16, marginBottom: 12 },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  title:       { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  countPill:   { backgroundColor: '#1037A4', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  countPillTxt:{ color: '#fff', fontSize: 11, fontWeight: '800' },
  sub:         { fontSize: 11, color: '#64748b', fontWeight: '500' },
  loadWrap:    { paddingVertical: 24, alignItems: 'center' },
  listContent: { paddingHorizontal: 12, paddingBottom: 16, gap: 10 },
  workerCard:  { width: 120, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', padding: 12, alignItems: 'center', gap: 6, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  avatar:      { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  initials:    { fontSize: 18, fontWeight: '800' },
  workerName:  { fontSize: 12, fontWeight: '800', textAlign: 'center', textTransform: 'capitalize' },
  workerSkill: { fontSize: 10, color: '#64748b', textAlign: 'center', fontWeight: '600' },
  workerDate:  { fontSize: 9, color: '#94a3b8', textAlign: 'center' },
  viewBtn:     { backgroundColor: '#1037A4', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginTop: 2 },
  viewBtnTxt:  { color: '#fff', fontSize: 10, fontWeight: '800' },
});

const sf = StyleSheet.create({
  card:  { borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', backgroundColor: '#fff', paddingVertical: 4, marginBottom: 8 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f8fafc' },
  emoji: { fontSize: 20, width: 28, textAlign: 'center' },
  text:  { flex: 1 },
  title: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  desc:  { fontSize: 11, color: '#64748b', marginTop: 1 },
});

const confirm = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog:      { width: '100%', borderRadius: 20, overflow: 'hidden', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20 },
  header:      { backgroundColor: '#B91C1C', paddingVertical: 20, paddingHorizontal: 24, alignItems: 'center', gap: 10 },
  iconWrap:    { width: 52, height: 52, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  iconEmoji:   { fontSize: 26, lineHeight: 32 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff', textAlign: 'center' },
  body:        { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16, gap: 6, alignItems: 'center' },
  reqName:     { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  bodyMsg:     { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  actions:     { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 4 },
  btn:         { flex: 1, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  btnDanger:   { backgroundColor: '#DC2626', borderColor: 'transparent', shadowColor: '#DC2626', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnTxt:      { fontSize: 14, fontWeight: '700' },
});

// ─── Subscription Upsell Banner ───────────────────────────────────────────────
const subBanner = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1037A4', borderRadius: 14, padding: 12, marginBottom: 14 },
  iconWrap:{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  icon:    { fontSize: 18, lineHeight: 22 },
  body:    { flex: 1, gap: 1 },
  title:   { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  sub:     { fontSize: 11, color: 'rgba(255,255,255,0.72)' },
  arrow:   { fontSize: 18, color: 'rgba(255,255,255,0.8)', fontWeight: '700' },
});

// ─── Pipeline Strip Styles ─────────────────────────────────────────────────────
const pip = StyleSheet.create({
  card:   { borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', padding: 14, marginBottom: 14, elevation: 1, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title:  { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  viewAll:{ fontSize: 12, fontWeight: '700', color: '#2563eb' },
  row:    { flexDirection: 'row', gap: 8 },
  cell:   { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 10, alignItems: 'center', gap: 2 },
  count:  { fontSize: 20, fontWeight: '900', lineHeight: 24 },
  label:  { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
});

const fh = StyleSheet.create({
  wrap:          { backgroundColor: '#1037A4', paddingHorizontal: 20, paddingBottom: 32, overflow: 'hidden' },
  circle1:       { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', width: 220, height: 220, top: -80, right: -60 },
  circle2:       { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', width: 140, height: 140, bottom: -45, left: -30 },
  // Brand bar: logo + actions + avatar
  brandRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  brandLeft:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandLogoImg:      { width: 28, height: 28, borderRadius: 6 },
  brandLogo:         { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  headerActions:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shortlistBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  shortlistIcon:     { fontSize: 19, lineHeight: 22 },
  shortlistBadge:    { position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#1037A4' },
  shortlistBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '900', lineHeight: 12 },
  // User + verification status
  userBar:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name:          { fontSize: 17, fontWeight: '800', color: '#fff', flex: 1 },
  pendingBadge:  { backgroundColor: '#f59e0b', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  pendingBadgeTxt:{ fontSize: 11, fontWeight: '800', color: '#fff' },
  proBadge:      { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  proBadgeTxt:   { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  // Body lifts over hero
  body:          { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -20, overflow: Platform.OS === 'android' ? 'hidden' : 'visible' },
});