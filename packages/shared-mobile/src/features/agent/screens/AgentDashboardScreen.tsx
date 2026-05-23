import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../../app/navigation/types';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../core/api/client';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../../../core/theme';
import { usePricingConfig } from '../../../core/api/endpoints/pricingApi';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { SectionHeader } from '../../../shared/components/ui/SectionHeader';
import { GradientHeader } from '../../../shared/components/ui/GradientHeader';
import { SkeletonCard } from '../../../shared/components/ui/Skeleton';
import { WorkerCategoryGrid } from '../../../shared/components/ui/WorkerCategoryGrid';
import type { WorkCategory } from '../../../shared/components/ui/WorkerCategoryGrid';
import { VerifiedBadgeModal } from '../../../shared/components/ui/VerifiedBadgeModal';

// ── Helpers ───────────────────────────────────────────────────────────────────
const getGreetKey = (): 'goodMorning' | 'goodAfternoon' | 'goodEvening' => {
  const h = new Date().getHours();
  if (h < 12) return 'goodMorning';
  if (h < 17) return 'goodAfternoon';
  return 'goodEvening';
};

const VERIFIED_BADGE_SHOWN_KEY = 'verifiedBadgeShown_v1';

// ── Activity ──────────────────────────────────────────────────────────────────
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

const ACTION_COLOR: Record<string, { bg: string; color: string; border: string; symbol: string }> = {
  CREATE: { bg: '#dcfce7', color: '#16a34a', border: '#86efac', symbol: '+' },
  UPDATE: { bg: '#dbeafe', color: '#2563eb', border: '#93c5fd', symbol: '✎' },
  DELETE: { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5', symbol: '×' },
  VIEW:   { bg: '#f5f3ff', color: '#7c3aed', border: '#c4b5fd', symbol: '◉' },
  LOGIN:  { bg: '#f0fdf4', color: '#16a34a', border: '#86efac', symbol: '→' },
  LOGOUT: { bg: '#fff7ed', color: '#ea580c', border: '#fdba74', symbol: '←' },
};

const AgentActivityRow = ({ item, isLast }: { item: ActivityItem; isLast: boolean }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const cfg = ACTION_COLOR[item.action] ?? ACTION_COLOR.UPDATE;
  return (
    <View style={[agAct.row, isLast && { borderBottomWidth: 0 }]}>
      <View style={[agAct.dot, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
        <AppText style={[agAct.dotTxt, { color: cfg.color }]}>{cfg.symbol}</AppText>
      </View>
      <View style={agAct.body}>
        <View style={agAct.topRow}>
          <View style={[agAct.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
            <AppText style={[agAct.badgeTxt, { color: cfg.color }]}>{item.action}</AppText>
          </View>
          <AppText style={[agAct.entity, { color: theme.colors.text }]}>{item.entity}</AppText>
        </View>
        <AppText style={agAct.desc} numberOfLines={1}>{item.description ?? item.action}</AppText>
        <AppText style={agAct.time}>{timeAgo(item.createdAt)}</AppText>
      </View>
    </View>
  );
};

// ── Stat Widget Card ──────────────────────────────────────────────────────────
interface StatWidgetProps {
  emoji: string;
  label: string;
  sub: string | null;
  gradient: readonly [string, string];
  onPress: () => void;
  isLoading?: boolean;
}

const StatWidget = ({ emoji, label, sub, gradient, onPress, isLoading }: StatWidgetProps): React.JSX.Element => (
  <Pressable
    onPress={onPress}
    style={({ pressed }: { pressed: boolean }) => [
      styles.statWidget,
      { backgroundColor: gradient[0], opacity: pressed ? 0.88 : 1 },
    ]}
    android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
  >
    {/* Gradient layer */}
    <View style={[styles.statWidgetGrad, { backgroundColor: gradient[1] }]} pointerEvents="none" />
    <View style={styles.statWidgetInner}>
      <AppText style={styles.statEmoji}>{emoji}</AppText>
      <AppText style={styles.statLabel}>{label}</AppText>
      {isLoading ? (
        <View style={styles.statSubSkeleton} />
      ) : (
        sub !== null && <AppText style={styles.statSub} numberOfLines={1}>{sub}</AppText>
      )}
    </View>
  </Pressable>
);

// ── Main Screen ───────────────────────────────────────────────────────────────
export const AgentDashboardScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const { t } = useTranslation();
  const { pricing } = usePricingConfig();
  const user = state.session?.user;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  const isAgent = user?.role === 'agent';
  // Both 'SelfWorker' and 'Worker' backend roles map to 'worker' in the frontend — same dashboard
  const userId = user?.id ?? '';

  // Verified badge popup — show once per install for unverified agents/selfworkers
  const [badgeModalVisible, setBadgeModalVisible] = useState(false);

  useEffect(() => {
    if (!userId || user?.role !== 'agent' || user?.veryfiedBage) return;
    void AsyncStorage.getItem(VERIFIED_BADGE_SHOWN_KEY).then((shown) => {
      if (!shown) {
        setBadgeModalVisible(true);
        void AsyncStorage.setItem(VERIFIED_BADGE_SHOWN_KEY, '1');
      }
    });
  }, [userId, user?.role, user?.veryfiedBage]);

  // ── Queries ─────────────────────────────────────────────────────────────────
  // Single query: backend returns both totalCount (all reqs) and myInterestsCount in one response
  const reqsQuery = useQuery({
    queryKey: ['agent-reqs-dash', userId],
    queryFn: () =>
      requirementsApi.listForRole({
        role: isAgent ? 'agent' : 'selfworker',
        userId,
        page: 1,
        limit: 1,
      }),
    staleTime: 60 * 1000,
    enabled: !!userId,
  });

  const activityQuery = useQuery({
    queryKey: ['agent-activity-dash', userId],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; activities?: ActivityItem[] }>('/api/v1/activity/my', { params: { limit: 5 } });
      return res.data.activities ?? [];
    },
    staleTime: 60 * 1000,
    enabled: !!userId,
  });

  const isRefreshing = reqsQuery.isFetching || activityQuery.isFetching;

  const handleRefresh = (): void => {
    void reqsQuery.refetch();
    void activityQuery.refetch();
  };

  const totalCount = reqsQuery.data?.pagination?.totalCount ?? 0;
  const myInterestsCount = reqsQuery.data?.myInterestsCount ?? 0;

  const kycPending = user?.kycStatus === 'pending' || user?.kycStatus === 'rejected';
  const greetKey = getGreetKey();

  // ── Stat widgets config ──────────────────────────────────────────────────────
  const statWidgets: StatWidgetProps[] = [
    {
      emoji: '📋',
      label: t('allRequirements'),
      sub: reqsQuery.isLoading ? null : `${totalCount} ${t('openReqs')}`,
      gradient: ['#1E3A8A', '#2563EB'] as const,
      isLoading: reqsQuery.isLoading,
      onPress: () => navigation.navigate('JobMarketplace'),
    },
    {
      emoji: '❤️',
      label: t('myInterests'),
      sub: reqsQuery.isLoading ? null : `${myInterestsCount} ${t('applied')}`,
      gradient: ['#7C2D12', '#EA580C'] as const,
      isLoading: reqsQuery.isLoading,
      onPress: () => navigation.navigate('JobMarketplace', { myInterests: true }),
    },
    ...(!isAgent ? [
      {
        emoji: '➕',
        label: t('registerWorker'),
        sub: t('findWorkNearYou'),
        gradient: ['#064E3B', '#059669'] as const,
        onPress: () => navigation.navigate('AddWorker'),
      } as StatWidgetProps,
      {
        emoji: '🔍',
        label: 'Browse Jobs',
        sub: 'Find work near you',
        gradient: ['#1E3A8A', '#2563EB'] as const,
        onPress: () => navigation.navigate('JobMarketplace'),
      } as StatWidgetProps,
    ] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />

      {/* ── Verified Badge Popup ────────────────────────────────── */}
      <VerifiedBadgeModal
        visible={badgeModalVisible}
        onDismiss={() => setBadgeModalVisible(false)}
        userRole={user?.role ?? ''}
        userId={userId}
        userName={user?.fullName ?? ''}
        userEmail={user?.email ?? ''}
        userPhone={user?.phone ?? ''}
      />

      {/* ── Hero Header ─────────────────────────────────────────── */}
      <GradientHeader
        subtitle={t(greetKey)}
        title={user?.fullName ?? (isAgent ? 'Agent' : 'Worker')}
        caption={kycPending ? `⚠️ ${t('verificationPending')}` : `✓ Verified`}
        avatarName={user?.fullName ?? 'U'}
        avatarUri={user?.profileImage}
        onAvatarPress={() => navigation.navigate('Profile')}
        rightIcon="🔔"
        onRightPress={() => navigation.navigate('Notifications')}
      />

      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>

          {/* ── KYC alert ───────────────────────────────────────── */}
          {kycPending && (
            <Pressable
              onPress={() => navigation.navigate('Kyc')}
              style={[styles.alertBanner, { backgroundColor: theme.colors.warningLight, borderColor: theme.colors.warning }]}
            >
              <AppText style={styles.alertIcon}>⚠️</AppText>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="labelSm" color={theme.colors.warning}>{t('kycPendingTitle')}</AppText>
                <AppText variant="caption" color={theme.colors.mutedText}>{t('kycPendingMsg')}</AppText>
              </View>
            </Pressable>
          )}

          {/* ── Verified badge upsell (agent only, not yet verified) ── */}
          {isAgent && !user?.veryfiedBage && (
            <Pressable
              onPress={() => setBadgeModalVisible(true)}
              style={styles.verifyBanner}
            >
              <View style={styles.verifyBannerLeft}>
                <AppText style={styles.verifyBannerIcon}>🏆</AppText>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="labelSm" color="#15803D">Become a Verified Agent</AppText>
                  <AppText variant="caption" color={theme.colors.mutedText}>Just ₹{pricing.verifiedBadge.agent} · Boost your earnings & visibility</AppText>
                </View>
              </View>
              <AppText style={styles.verifyBannerArrow}>→</AppText>
            </Pressable>
          )}

          {/* ── 4 Stat Widgets (2×2 grid) ───────────────────────── */}
          <View style={styles.widgetGrid}>
            {statWidgets.map((w, i) => (
              <StatWidget key={i} {...w} />
            ))}
          </View>

          {/* ── Browse Work Categories ───────────────────────────── */}
          <SectionHeader
            title={t('browseCategories')}
            subtitle={t('browseCategoriesSubtitle')}
            style={styles.sectionGap}
          />
          {reqsQuery.isLoading ? (
            <SkeletonCard />
          ) : (
            <WorkerCategoryGrid
              onCategoryPress={(cat) => navigation.navigate('JobMarketplace', { workType: cat.label })}
              columns={3}
              cellHeight={100}
            />
          )}

          {/* ── Recent Activity ──────────────────────────────────── */}
          <View style={[styles.actCard, { backgroundColor: theme.colors.card }]}>
            <View style={styles.actHeader}>
              <AppText style={[styles.actTitle, { color: theme.colors.text }]}>Recent Activity</AppText>
              <TouchableOpacity onPress={() => navigation.navigate('MyActivity')} activeOpacity={0.7}>
                <AppText style={styles.actViewAll}>View All  ›</AppText>
              </TouchableOpacity>
            </View>
            {activityQuery.isLoading ? (
              <View style={styles.actLoadWrap}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : (activityQuery.data?.length ?? 0) === 0 ? (
              <View style={styles.actEmpty}>
                <AppText style={styles.actEmptyIcon}>📋</AppText>
                <AppText style={styles.actEmptyTxt}>No activity recorded yet.</AppText>
              </View>
            ) : (
              <>
                {(activityQuery.data ?? []).map((item, i) => (
                  <AgentActivityRow
                    key={item._id}
                    item={item}
                    isLast={i === (activityQuery.data!.length - 1)}
                  />
                ))}
                <TouchableOpacity
                  onPress={() => navigation.navigate('MyActivity')}
                  style={styles.actFooter}
                  activeOpacity={0.7}
                >
                  <AppText style={styles.actFooterTxt}>See full activity log  →</AppText>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ── Quick links row ──────────────────────────────────── */}
          <View style={styles.quickRow}>
            <Pressable
              onPress={() => navigation.navigate('JobMarketplace')}
              style={[styles.quickBtn, { backgroundColor: theme.colors.primaryLight }]}
            >
              <AppText style={[styles.quickBtnText, { color: theme.colors.primary }]}>
                📋 {t('allRequirements')}
              </AppText>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('JobMarketplace', { myInterests: true })}
              style={[styles.quickBtn, { backgroundColor: '#FEF3F2', borderColor: '#FCA5A5' }]}
            >
              <AppText style={[styles.quickBtnText, { color: '#DC2626' }]}>
                ❤️ {t('myInterests')}
              </AppText>
            </Pressable>
          </View>

        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },
  body: { padding: 16 },

  // ── Alerts ────────────────────────────────────────────────────────────────
  alertBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 12,
  },
  alertIcon: { fontSize: 18, lineHeight: 22 },

  verifyBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F0FDF4', borderRadius: 14, borderWidth: 1, borderColor: '#86EFAC',
    padding: 14, marginBottom: 16, gap: 10,
  },
  verifyBannerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  verifyBannerIcon: { fontSize: 20, lineHeight: 24 },
  verifyBannerArrow: { fontSize: 18, color: '#15803D', fontWeight: '700' },

  // ── 2×2 stat widget grid ──────────────────────────────────────────────────
  widgetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  statWidget: {
    width: '47.5%',
    borderRadius: 20,
    overflow: 'hidden',
    minHeight: 110,
    padding: 16,
    position: 'relative',
  },
  statWidgetGrad: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.42,
    borderRadius: 20,
  },
  statWidgetInner: { gap: 6, zIndex: 1 },
  statEmoji: { fontSize: 26, lineHeight: 30 },
  statLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', lineHeight: 16 },
  statSub: { color: 'rgba(255,255,255,0.80)', fontSize: 11, fontWeight: '500' },
  statSubSkeleton: {
    width: '60%', height: 10, borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 2,
  },

  sectionGap: { marginTop: 20, marginBottom: 10 },

  // ── Activity card ─────────────────────────────────────────────────────────
  actCard:      { borderRadius: 20, overflow: 'hidden', marginTop: 20, marginBottom: 4 },
  actHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  actTitle:     { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  actViewAll:   { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  actLoadWrap:  { paddingVertical: 24, alignItems: 'center' },
  actEmpty:     { paddingVertical: 20, alignItems: 'center', gap: 6 },
  actEmptyIcon: { fontSize: 28, lineHeight: 34 },
  actEmptyTxt:  { fontSize: 13, color: '#94a3b8' },
  actFooter:    { paddingVertical: 12, alignItems: 'center' },
  actFooterTxt: { fontSize: 13, fontWeight: '700', color: '#2563eb' },

  // ── Quick links ───────────────────────────────────────────────────────────
  quickRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  quickBtn: {
    flex: 1, borderRadius: 14, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: 'transparent',
  },
  quickBtnText: { fontSize: 13, fontWeight: '700' },
});

// ── Activity section styles ───────────────────────────────────────────────────
const agAct = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f1f5f9' },
  dot:      { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dotTxt:   { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  body:     { flex: 1, gap: 2 },
  topRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge:    { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  badgeTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  entity:   { fontSize: 13, fontWeight: '700', color: '#0f172a', flex: 1 },
  desc:     { fontSize: 11, color: '#475569', lineHeight: 15 },
  time:     { fontSize: 10, color: '#94a3b8' },
});
