import React, { useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../../app/navigation/types';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { agentApi } from '../../../core/api/endpoints/agentApi';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { RawRequirement } from '../../../core/api/endpoints/requirementsApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { Badge } from '../../../shared/components/ui/Badge';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { SectionHeader } from '../../../shared/components/ui/SectionHeader';
import { GradientHeader } from '../../../shared/components/ui/GradientHeader';
import { SkeletonCard } from '../../../shared/components/ui/Skeleton';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import { WorkerCategoryGrid } from '../../../shared/components/ui/WorkerCategoryGrid';
import type { WorkCategory } from '../../../shared/components/ui/WorkerCategoryGrid';
import categoriesData from '../../../shared/data/categories.json';

interface CategoryEntry {
  label: string;
  value: string;
  subcategories: Array<{ label: string; value: string }>;
}

const CATEGORIES = categoriesData as CategoryEntry[];


const greet = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const formatDate = (d?: string): string => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
  catch { return '—'; }
};

// ── Open requirement card ─────────────────────────────────────────────────────
interface ReqCardProps {
  req: RawRequirement;
  userId: string;
  wage: string;
  onWageChange: (v: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}

const OpenReqCard = ({ req, userId, wage, onWageChange, onSubmit, isPending }: ReqCardProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const isDark = theme.mode === 'dark';

  const alreadyInterested = req.intrestedAgents?.some(
    (a) => String(a.agentId) === String(userId),
  ) ?? false;

  const minWage = req.minBudgetPerWorker ?? 0;
  const maxWage = req.maxBudgetPerWorker ?? 0;

  return (
    <View
      style={[
        styles.reqCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: isDark ? theme.colors.border : '#E2E8F4',
        },
        !isDark && theme.shadow.sm,
      ]}
    >
      {/* Header row */}
      <View style={styles.reqHeader}>
        <View style={styles.reqHeaderLeft}>
          <View style={[styles.reqCategoryBadge, { backgroundColor: theme.colors.primaryLight }]}>
            <AppText style={[styles.reqCategoryText, { color: theme.colors.primary }]}>
              {req.workType ?? '—'}
            </AppText>
          </View>
          {req.subCategory ? (
            <AppText variant="micro" color={theme.colors.mutedText}>{req.subCategory}</AppText>
          ) : null}
        </View>
        <Badge
          label={req.status ?? 'Open'}
          variant={req.status?.toLowerCase() === 'open' ? 'success' : 'warning'}
          size="sm"
        />
      </View>

      {/* ERN + Date */}
      <View style={styles.reqMeta}>
        {req.ERN_NUMBER ? (
          <AppText variant="micro" color={theme.colors.primary} style={styles.reqErn}>
            #{req.ERN_NUMBER}
          </AppText>
        ) : null}
        <AppText variant="micro" color={theme.colors.mutedText}>
          📅 {formatDate(req.workerNeedDate)}
        </AppText>
      </View>

      {/* Info grid */}
      <View style={styles.reqInfoGrid}>
        <View style={styles.reqInfoItem}>
          <AppText style={styles.reqInfoIcon}>📍</AppText>
          <AppText variant="micro" color={theme.colors.mutedText} numberOfLines={1}>
            {req.district ?? '—'}{req.state ? `, ${req.state}` : ''}
          </AppText>
        </View>
        <View style={styles.reqInfoItem}>
          <AppText style={styles.reqInfoIcon}>👷</AppText>
          <AppText variant="micro" color={theme.colors.mutedText}>
            {(req.workerQuantitySkilled ?? 0) + (req.workerQuantityUnskilled ?? 0)} workers needed
          </AppText>
        </View>
        <View style={styles.reqInfoItem}>
          <AppText style={styles.reqInfoIcon}>💰</AppText>
          <AppText variant="micro" color={theme.colors.success} style={{ fontWeight: '700' }}>
            ₹{minWage}–{maxWage}/day
          </AppText>
        </View>
      </View>

      {/* Express interest row */}
      <View style={[styles.interestRow, { borderTopColor: theme.colors.divider }]}>
        {alreadyInterested ? (
          <View style={[styles.interestDoneWrap, { backgroundColor: theme.colors.successLight }]}>
            <AppText variant="caption" color={theme.colors.success} style={{ fontWeight: '700' }}>
              ✓ Interest Shown
            </AppText>
          </View>
        ) : (
          <>
            <TextInput
              style={[
                styles.wageInput,
                {
                  backgroundColor: theme.colors.surface1,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              value={wage}
              onChangeText={onWageChange}
              placeholder={`Quote per head (min ₹${minWage})`}
              placeholderTextColor={theme.colors.mutedText}
              keyboardType="number-pad"
              returnKeyType="done"
            />
            <AppButton
              title={isPending ? '…' : 'Show Interest'}
              onPress={onSubmit}
              disabled={!wage || isPending}
              size="sm"
              style={styles.interestBtn}
            />
          </>
        )}
      </View>
    </View>
  );
};

// ── Assigned requirement card ─────────────────────────────────────────────────
interface AssignedCardProps {
  req: RawRequirement;
  onPress: () => void;
  onAccept: () => void;
  onReject: () => void;
  accepting: boolean;
}

const AssignedCard = ({ req, onPress, onAccept, onReject, accepting }: AssignedCardProps): React.JSX.Element => {
  const { theme } = useAppTheme();

  // isAgentAccepted comes as string "Yes"/"No" from backend
  const isAccepted = (req.isAgentAccepted as unknown as string) === 'Yes';
  const totalWorkers = (req.workerQuantitySkilled ?? 0) + (req.workerQuantityUnskilled ?? 0);
  const wage = req.finalAgentRequiredWage ?? req.maxBudgetPerWorker ?? 0;
  const startDate = req.workerNeedDate
    ? new Date(req.workerNeedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const PERKS: Array<{ key: keyof RawRequirement; label: string }> = [
    { key: 'accommodationAvailable', label: '🏠 Stay' },
    { key: 'foodAvailable', label: '🍱 Food' },
    { key: 'transportProvided', label: '🚌 Transport' },
    { key: 'weeklyOff', label: '📅 Weekly Off' },
    { key: 'overtimeAvailable', label: '⏰ Overtime' },
    { key: 'bonus', label: '💰 Bonus' },
    { key: 'incentive', label: '🎯 Incentive' },
  ];
  const activePerks = PERKS.filter((p) => req[p.key] === true).map((p) => p.label);

  return (
    <View style={styles.activeCard}>
      {/* Dark gradient header */}
      <View style={styles.activeCardHeader}>
        <View style={styles.activeCardErnRow}>
          <View style={styles.ernBadge}>
            <AppText style={styles.ernBadgeText}>ERN #{req.ERN_NUMBER ?? '—'}</AppText>
          </View>
          <View style={[styles.statusPill, { backgroundColor: isAccepted ? '#22c55e' : '#f59e0b' }]}>
            <AppText style={styles.statusPillText}>{isAccepted ? '✓ Accepted' : 'Pending'}</AppText>
          </View>
        </View>

        <AppText style={styles.activeCardTitle} numberOfLines={1}>
          {req.workType ?? '—'}{req.subCategory ? ` · ${req.subCategory}` : ''}
          {req.remarks ? ` · ${req.remarks}` : ''}
        </AppText>

        <View style={styles.activeCardMeta}>
          <AppText style={styles.activeCardMetaText}>
            📍 {req.district ?? '—'}{req.tehsil ? `, ${req.tehsil}` : ''}{req.workLocation ? ` · ${req.workLocation}` : ''}
          </AppText>
        </View>
      </View>

      {/* Info grid */}
      <View style={styles.activeCardBody}>
        <View style={styles.activeInfoGrid}>
          <View style={styles.activeInfoCell}>
            <AppText style={styles.activeInfoLabel}>Workers</AppText>
            <AppText style={styles.activeInfoValue}>👷 {totalWorkers}</AppText>
          </View>
          <View style={styles.activeInfoDivider} />
          <View style={styles.activeInfoCell}>
            <AppText style={styles.activeInfoLabel}>Per Head</AppText>
            <AppText style={[styles.activeInfoValue, { color: '#22c55e' }]}>₹{Math.round(wage)}/-</AppText>
          </View>
          <View style={styles.activeInfoDivider} />
          <View style={styles.activeInfoCell}>
            <AppText style={styles.activeInfoLabel}>Start Date</AppText>
            <AppText style={styles.activeInfoValue}>{startDate}</AppText>
          </View>
        </View>

        {/* Employer row */}
        <View style={styles.activeEmployerRow}>
          <View style={{ flex: 1 }}>
            <AppText style={styles.activeInfoLabel}>Employer</AppText>
            <AppText style={styles.activeEmployerName} numberOfLines={1}>
              {req.employerName ?? '—'}
            </AppText>
          </View>
          {req.employerPhone ? (
            <TouchableOpacity
              onPress={() => void Linking.openURL(`tel:${req.employerPhone}`)}
              style={styles.callBtn}
              activeOpacity={0.8}
            >
              <AppText style={styles.callBtnText}>📞 Call</AppText>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Perks */}
        {activePerks.length > 0 && (
          <View style={styles.perksRow}>
            {activePerks.map((p) => (
              <View key={p} style={styles.perkChip}>
                <AppText style={styles.perkChipText}>{p}</AppText>
              </View>
            ))}
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.activeCardActions}>
          {!isAccepted ? (
            <>
              <TouchableOpacity
                onPress={onReject}
                disabled={accepting}
                style={[styles.actionBtn, styles.rejectBtn]}
                activeOpacity={0.8}
              >
                <AppText style={[styles.actionBtnText, { color: '#ef4444' }]}>✕ Reject</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onAccept}
                disabled={accepting}
                style={[styles.actionBtn, styles.acceptBtn]}
                activeOpacity={0.8}
              >
                <AppText style={[styles.actionBtnText, { color: '#fff' }]}>
                  {accepting ? 'Processing…' : '✓ Accept'}
                </AppText>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={onPress}
              style={[styles.actionBtn, styles.viewBtn]}
              activeOpacity={0.8}
            >
              <AppText style={[styles.actionBtnText, { color: '#fff' }]}>View Details →</AppText>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

// ── Filter chip row ───────────────────────────────────────────────────────────
interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

const FilterChip = ({ label, active, onPress }: FilterChipProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.filterChip,
        {
          backgroundColor: active ? theme.colors.primary : theme.colors.card,
          borderColor: active ? theme.colors.primary : theme.colors.border,
        },
      ]}
    >
      <AppText
        variant="caption"
        color={active ? '#FFF' : theme.colors.text}
        style={styles.filterChipText}
      >
        {label}
      </AppText>
    </TouchableOpacity>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export const AgentDashboardScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const user = state.session?.user;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const toast = useToast();
  const qc = useQueryClient();

  const isAgent = user?.role === 'agent';

  // Per-requirement wage input state
  const [wageMap, setWageMap] = useState<Record<string, string>>({});

  // Filters
  const [filterWorkType, setFilterWorkType] = useState<string>('');
  const [filterSubCat, setFilterSubCat] = useState<string>('');
  const [filterState, setFilterState] = useState<string>('');
  const [filterCity, setFilterCity] = useState<string>('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const subCategories = useMemo(() => {
    if (!filterWorkType) return [];
    const cat = CATEGORIES.find((c) => c.label === filterWorkType);
    return cat?.subcategories ?? [];
  }, [filterWorkType]);

  const hasActiveFilter = Boolean(filterWorkType || filterSubCat || filterState.trim() || filterCity.trim());

  const clearFilters = (): void => {
    setFilterWorkType('');
    setFilterSubCat('');
    setFilterState('');
    setFilterCity('');
  };

  // ── Queries ─────────────────────────────────────────────────────────────────
  const [statsQuery, leadsQuery, reqsQuery] = useQueries({
    queries: [
      {
        queryKey: ['agent-stats'],
        queryFn: agentApi.getStats,
        staleTime: 2 * 60 * 1000,
      },
      {
        queryKey: ['agent-leads-recent'],
        queryFn: () => agentApi.getMyLeads({ page: 1 }),
        staleTime: 60 * 1000,
        enabled: isAgent,
      },
      {
        // No district/serviceArea sent — backend uses req.user for priority sorting
        // (district first → same state → all India). Explicit user filters override.
        queryKey: ['agent-reqs', user?.id, filterWorkType, filterSubCat, filterState, filterCity],
        queryFn: () =>
          requirementsApi.listForRole({
            role: isAgent ? 'agent' : 'selfworker',
            userId: user?.id,
            // Intentionally not passing district/serviceArea for the dashboard.
            // The backend derives those from req.user and priority-sorts results.
            workType: filterWorkType || undefined,
            subCategory: filterSubCat || undefined,
            state: filterState.trim() || undefined,
            district: filterCity.trim() || undefined,
            page: 1,
            limit: 30,
          }),
        staleTime: 60 * 1000,
      },
    ],
  });

  const isRefreshing = statsQuery.isFetching || reqsQuery.isFetching;

  const handleRefresh = (): void => {
    void statsQuery.refetch();
    void leadsQuery.refetch();
    void reqsQuery.refetch();
  };

  // ── Accept / Reject assignment mutation ────────────────────────────────────
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const acceptReject = useMutation({
    mutationFn: ({ ern, decision }: { ern: string; decision: 'Yes' | 'No' }) =>
      requirementsApi.unassignOrAccept({ agentId: userId, ern, isAgentAccepted: decision }),
    onMutate: ({ ern }) => setAcceptingId(ern),
    onSettled: () => setAcceptingId(null),
    onSuccess: (_, vars) => {
      toast.success(vars.decision === 'Yes' ? 'Assignment accepted!' : 'Assignment rejected.');
      void qc.invalidateQueries({ queryKey: ['agent-reqs'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Action failed. Please try again.');
    },
  });

  // ── Express interest mutation ────────────────────────────────────────────────
  const expressInterest = useMutation({
    mutationFn: ({ id, wage }: { id: string; wage: number }) =>
      requirementsApi.expressInterestWithWage(id, wage),
    onSuccess: (_, vars) => {
      toast.success('Interest submitted! The employer has been notified.', 'Interest Shown');
      setWageMap((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      void qc.invalidateQueries({ queryKey: ['agent-reqs'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to submit interest. Please try again.');
    },
  });

  const handleShowInterest = (req: RawRequirement): void => {
    const wage = parseInt(wageMap[req._id] ?? '0', 10);
    if (!wage || isNaN(wage)) {
      toast.warning('Please enter your per-head wage quote first.');
      return;
    }
    const min = req.minBudgetPerWorker ?? 0;
    if (wage < min) {
      toast.warning(`Wage must be at least ₹${min}.`);
      return;
    }
    expressInterest.mutate({ id: req._id, wage });
  };

  const userId = user?.id ?? '';

  const allReqs: RawRequirement[] = reqsQuery.data?.requirements ?? [];

  // Mirror CRM filter: exclude assigned reqs + this agent's own + Contract_Based + Office_Staff
  const openReqs = allReqs.filter((r) =>
    (r.status ?? '').toLowerCase() !== 'assigned' &&
    String(r.assignedAgentId) !== String(userId) &&
    r.req_type !== 'Contract_Based' &&
    r.req_type !== 'Office_Staff',
  );

  // Active work: requirements assigned to THIS agent
  const assignedReqs = allReqs.filter(
    (r) =>
      (r.status ?? '').toLowerCase() === 'assigned' &&
      String(r.assignedAgentId) === String(userId),
  );

  const stats = statsQuery.data;
  const recentLeads = (leadsQuery.data?.leads ?? []).slice(0, 5);
  const kycPending = user?.kycStatus === 'pending' || user?.kycStatus === 'rejected';
  const myJobsCount = stats?.totalLeads ?? 0;
  const needsWorkers = isAgent && myJobsCount < 10;

  const openCount = reqsQuery.data?.pagination?.totalCount ?? openReqs.length;

  return (
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
      keyboardShouldPersistTaps="handled"
    >
      {/* Gradient header */}
      <GradientHeader
        subtitle={greet()}
        title={user?.fullName ?? (isAgent ? 'Agent' : 'Worker')}
        caption={isAgent ? 'Agent Portal · Grow your network' : 'Worker Portal · Find your next job'}
        avatarName={user?.fullName ?? 'A'}
        onAvatarPress={() => navigation.navigate('Profile' as never)}
        rightIcon="🔔"
        onRightPress={() => navigation.navigate('Notifications')}
      >
        <View style={styles.commStrip}>
          <View style={styles.commItem}>
            <AppText variant="micro" color="rgba(255,255,255,0.65)">
              {isAgent ? 'Pending Commission' : 'Pending Earnings'}
            </AppText>
            <AppText variant="numeric" color="#FFFFFF" style={styles.commAmt}>
              ₹{(stats?.pendingCommission ?? 0).toLocaleString('en-IN')}
            </AppText>
          </View>
          <View style={[styles.commDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
          <View style={styles.commItem}>
            <AppText variant="micro" color="rgba(255,255,255,0.65)">Total Earned</AppText>
            <AppText variant="numeric" color="#4ADE80" style={styles.commAmt}>
              ₹{(stats?.totalCommission ?? 0).toLocaleString('en-IN')}
            </AppText>
          </View>
          <View style={[styles.commDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
          <View style={styles.commItem}>
            <AppText variant="micro" color="rgba(255,255,255,0.65)">Fulfilled</AppText>
            <AppText variant="numeric" color="#FCD34D" style={styles.commAmt}>
              {stats?.fulfilledRequirements ?? 0}
            </AppText>
          </View>
        </View>
      </GradientHeader>

      <View style={styles.body}>

        {/* ── Alerts ──────────────────────────────────────────────────── */}
        {kycPending && (
          <Pressable
            onPress={() => navigation.navigate('Kyc')}
            style={[styles.alertBanner, { backgroundColor: theme.colors.warningLight, borderColor: theme.colors.warning }]}
          >
            <AppText style={styles.alertIcon}>⚠️</AppText>
            <View style={styles.alertText}>
              <AppText variant="labelSm" color={theme.colors.warning}>KYC Pending</AppText>
              <AppText variant="caption" color={theme.colors.mutedText}>
                Complete KYC to unlock full {isAgent ? 'commission' : 'payment'} payouts. Tap to complete.
              </AppText>
            </View>
          </Pressable>
        )}
        {needsWorkers && (
          <Pressable
            onPress={() => navigation.navigate('AddWorker')}
            style={[styles.alertBanner, { backgroundColor: '#EEF2FF', borderColor: '#6366F1' }]}
          >
            <AppText style={styles.alertIcon}>💡</AppText>
            <View style={styles.alertText}>
              <AppText variant="labelSm" color="#6366F1">
                Add more workers ({myJobsCount}/10)
              </AppText>
              <AppText variant="caption" color={theme.colors.mutedText}>
                Register 10+ workers to unlock premium job matches. Tap to add.
              </AppText>
            </View>
          </Pressable>
        )}


        {/* ── My Active Work ──────────────────────────────────────── */}
        <SectionHeader
          title="My Active Work"
          subtitle={assignedReqs.length > 0 ? `${assignedReqs.length} assignment${assignedReqs.length > 1 ? 's' : ''}` : 'Requirements assigned to you'}
          style={styles.section}
        />
        {reqsQuery.isLoading ? (
          <SkeletonCard />
        ) : assignedReqs.length === 0 ? (
          <EmptyState
            compact
            icon="📋"
            title="No active assignments"
            message="Express interest in requirements below. Accepted assignments will appear here."
          />
        ) : (
          assignedReqs.map((req) => (
            <AssignedCard
              key={req._id}
              req={req}
              onPress={() => navigation.navigate('RequirementDetail', { requirementId: req._id })}
              onAccept={() => acceptReject.mutate({ ern: String(req.ERN_NUMBER ?? ''), decision: 'Yes' })}
              onReject={() => acceptReject.mutate({ ern: String(req.ERN_NUMBER ?? ''), decision: 'No' })}
              accepting={acceptingId === String(req.ERN_NUMBER ?? '')}
            />
          ))
        )}


        {/* ── Available Requirements ────────────────────────────────── */}
        <SectionHeader
          title="Available Requirements"
          subtitle={hasActiveFilter ? `Filtered · ${openCount} results` : `${openCount} near you · India-wide`}
          actionLabel="All Jobs"
          onAction={() => navigation.navigate('JobMarketplace')}
          style={styles.section}
        />

        {/* Category grid — tap to filter requirements by work type */}
        <WorkerCategoryGrid
          activeCategory={filterWorkType || undefined}
          onCategoryPress={(cat: WorkCategory) => {
            const next = filterWorkType === cat.label ? '' : cat.label;
            setFilterWorkType(next);
            setFilterSubCat('');
          }}
        />

        {/* Sub-category chips when a category is selected */}
        {subCategories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterBarContent}
            style={[styles.filterBar, { marginTop: 4 }]}
          >
            <FilterChip
              label="All Sub"
              active={!filterSubCat}
              onPress={() => setFilterSubCat('')}
            />
            {subCategories.map((sc) => (
              <FilterChip
                key={sc.value}
                label={sc.label}
                active={filterSubCat === sc.label}
                onPress={() => setFilterSubCat(filterSubCat === sc.label ? '' : sc.label)}
              />
            ))}
          </ScrollView>
        )}

        {/* State / City filter row */}
        <View style={styles.moreFilterRow}>
          <TouchableOpacity
            onPress={() => setShowMoreFilters((v) => !v)}
            style={[styles.moreFilterBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
          >
            <AppText variant="caption" color={theme.colors.primary} style={{ fontWeight: '700' }}>
              {showMoreFilters ? '▲ Less' : '▼ State & City'}
            </AppText>
          </TouchableOpacity>
          {hasActiveFilter && (
            <TouchableOpacity
              onPress={clearFilters}
              style={[styles.clearBtn, { borderColor: '#EF4444' }]}
            >
              <AppText variant="caption" color="#EF4444" style={{ fontWeight: '700' }}>✕ Clear</AppText>
            </TouchableOpacity>
          )}
        </View>

        {showMoreFilters && (
          <View style={[styles.textFilterRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.textFilterItem}>
              <AppText variant="micro" color={theme.colors.mutedText} style={styles.textFilterLabel}>State</AppText>
              <TextInput
                value={filterState}
                onChangeText={(v) => setFilterState(v)}
                placeholder="e.g. Maharashtra"
                placeholderTextColor={theme.colors.mutedText}
                style={[styles.textFilterInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                returnKeyType="done"
                autoCapitalize="words"
              />
            </View>
            <View style={[styles.textFilterDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.textFilterItem}>
              <AppText variant="micro" color={theme.colors.mutedText} style={styles.textFilterLabel}>City / District</AppText>
              <TextInput
                value={filterCity}
                onChangeText={(v) => setFilterCity(v)}
                placeholder="e.g. Pune"
                placeholderTextColor={theme.colors.mutedText}
                style={[styles.textFilterInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                returnKeyType="done"
                autoCapitalize="words"
              />
            </View>
          </View>
        )}

        {/* Requirements list */}
        {reqsQuery.isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : openReqs.length === 0 ? (
          <EmptyState
            compact
            icon="📭"
            title={hasActiveFilter ? 'No matching requirements' : 'No requirements near you'}
            message={
              hasActiveFilter
                ? 'Try clearing some filters or search all jobs.'
                : 'No open requirements in your area yet. Requirements from across India will appear here when available.'
            }
            action={
              hasActiveFilter ? (
                <AppButton title="Clear Filters" onPress={clearFilters} size="sm" variant="outline" />
              ) : undefined
            }
          />
        ) : (
          openReqs.slice(0, 10).map((req) => (
            <OpenReqCard
              key={req._id}
              req={req}
              userId={userId}
              wage={wageMap[req._id] ?? ''}
              onWageChange={(v) => setWageMap((prev) => ({ ...prev, [req._id]: v }))}
              onSubmit={() => handleShowInterest(req)}
              isPending={expressInterest.isPending}
            />
          ))
        )}

        {openReqs.length > 10 && (
          <AppButton
            title={`See all ${openCount} requirements`}
            onPress={() => navigation.navigate('JobMarketplace')}
            variant="outline"
            size="md"
            fullWidth
            style={styles.seeAllBtn}
          />
        )}

      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },

  commStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commItem: { flex: 1, alignItems: 'center', gap: 2 },
  commDivider: { width: 1, height: 32, marginHorizontal: 8 },
  commAmt: { fontSize: 16, lineHeight: 22 },

  body: { padding: 16 },

  alertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  alertIcon: { fontSize: 18, lineHeight: 22 },
  alertText: { flex: 1, gap: 3 },

  sectionFirst: { marginBottom: 12 },
  section: { marginTop: 20, marginBottom: 0 },

  statsGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statBox: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    gap: 4,
    borderWidth: 1,
  },
  statIcon: { fontSize: 22, lineHeight: 26 },
  statValue: { fontSize: 20, lineHeight: 26 },

  // ── Filter bar ────────────────────────────────────────────────────────────
  filterBar: { marginTop: 10 },
  filterBarContent: { paddingHorizontal: 0, paddingVertical: 4, gap: 6, flexDirection: 'row' },
  filterChip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    height: 30,
    justifyContent: 'center',
  },
  filterChipText: { fontWeight: '600', fontSize: 11 },

  moreFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  moreFilterBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  textFilterRow: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  textFilterItem: { flex: 1, padding: 10, gap: 4 },
  textFilterDivider: { width: 1 },
  textFilterLabel: { fontWeight: '600', marginBottom: 2 },
  textFilterInput: {
    fontSize: 13,
    borderBottomWidth: 1,
    paddingVertical: 4,
    fontWeight: '500',
  },

  // ── Open requirement card ─────────────────────────────────────────────────
  reqCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    overflow: 'hidden',
  },
  reqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    paddingBottom: 8,
  },
  reqHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  reqCategoryBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  reqCategoryText: { fontSize: 11, fontWeight: '700' },
  reqMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 6 },
  reqErn: { fontWeight: '700' },
  reqInfoGrid: { paddingHorizontal: 14, paddingBottom: 12, gap: 4 },
  reqInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reqInfoIcon: { fontSize: 13, width: 18, lineHeight: 18 },
  interestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  wageInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  interestBtn: { flexShrink: 0 },
  interestDoneWrap: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },

  // ── Active work card (CRM-matching dark style) ────────────────────────────
  activeCard: {
    borderRadius: 20,
    marginTop: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  activeCardHeader: {
    padding: 14,
    paddingBottom: 12,
    backgroundColor: '#0f172a',
    gap: 6,
  },
  activeCardErnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  ernBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  ernBadgeText: { color: '#aeeaff', fontSize: 11, fontWeight: '700' },
  statusPill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  activeCardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  activeCardMeta: { marginTop: 2 },
  activeCardMetaText: { color: 'rgba(255,255,255,0.72)', fontSize: 11, lineHeight: 16 },
  activeCardBody: {
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 12,
  },
  activeInfoGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activeInfoCell: { flex: 1, alignItems: 'center', gap: 4 },
  activeInfoDivider: { width: 1, height: 32, backgroundColor: '#e2e8f0' },
  activeInfoLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  activeInfoValue: { fontSize: 13, color: '#1e293b', fontWeight: '700' },
  activeEmployerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeEmployerName: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  callBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  callBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  perksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  perkChip: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
  },
  perkChipText: { fontSize: 11, fontWeight: '700', color: '#166534' },
  activeCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  rejectBtn: {
    borderWidth: 1.5,
    borderColor: '#ef4444',
    backgroundColor: 'transparent',
  },
  acceptBtn: { backgroundColor: '#2563eb' },
  viewBtn: { backgroundColor: '#2563eb' },
  actionBtnText: { fontSize: 13, fontWeight: '800' },

  // ── Leads ─────────────────────────────────────────────────────────────────
  leadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    gap: 12,
    borderWidth: 1,
  },
  leadInfo: { flex: 1, gap: 3 },

  seeAllBtn: { marginTop: 12 },
});
