import React, {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useAppTheme } from '../../../core/theme';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import { requestReviewOnce } from '../../../core/review/storeReview';
import { hapticSuccess } from '../../../core/haptics';
import type { RawAgent } from '../../../core/api/endpoints/workerApi';
import { useCallReturn } from '../hooks/useCallReturn';
import { CallCheckSheet } from '../components/CallCheckSheet';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { WorkerSafetyNotice } from '../../../shared/components/ui/WorkerSafetyNotice';
import { apiClient } from '../../../core/api/client';
import { usePlanFeatures } from '../../../core/hooks/usePlanFeatures';
import { useContactQuotaNudge } from '../../../core/hooks/useContactQuotaNudge';
import { useToast } from '../../../shared/state/toast/ToastContext';
import type { MainStackParamList } from '../../../app/navigation/types';
import i18n from '../../../core/i18n';
import { getLocationDisplayName } from '../../../shared/data/locationTranslations';
import { SmartMatchStrip } from '../components/SmartMatchStrip';
import { FilterSheet } from '../components/FilterSheet';
import { AgentCard } from '../components/AgentCard';
import { SkeletonCard } from '../components/AgentCard';
import {
  BRAND, WHITE,
  EMPTY_FILTERS,
  catDisplay, subcatDisplay,
  getOutcomeColor, OUTCOME_GREEN, OUTCOME_BLUE,
  countActive,
  type WorkerFilters,
} from '../components/workerSearchShared';

const PAGE_LIMIT = 25;

// ─── Main Screen ──────────────────────────────────────────────────────────────
type Nav = NativeStackNavigationProp<MainStackParamList>;
interface FullUserProfile {
  isSubscribed?: boolean;
  subscriptionExpery?: string;
  remainingContacts?: number;
  employerType?: string | Record<string, boolean>;
  subscriptionTpype?: string;
  freeContactsUsed?: number;
  freeContactsRemaining?: number;
  contactsTotal?: number;
}

const scopeBanner = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { fontSize: 14, lineHeight: 18 },
  txt:  { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  cta:  { fontSize: 12, fontWeight: '800' },
});

export const WorkerSearchScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const { state: authState } = useAuth();
  const user = authState.session?.user;
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<MainStackParamList, 'WorkerSearch'>>();
  const qc = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const canGoBack = navigation.canGoBack();

  const initialCat = route.params?.workType ?? '';
  const userState    = user?.state ?? '';
  const userDistrict = user?.district ?? '';

  // ── Plan worker-search scope gate ──────────────────────────────────────────
  const plan = usePlanFeatures();
  // Non-subscriber: unrestricted ALL-INDIA search (no location lock). Once the
  // employer subscribes, their plan tier's scope applies (district/state/india).
  // 'india' = unrestricted ⇒ isScoped is false ⇒ no auto-lock and no scope banner.
  const scope = plan.isSubscribed ? plan.workerSearchScope : 'india'; // 'district' | 'state' | 'india'
  // Only constrain when we actually know the user's location (graceful fallback).
  const districtScoped = scope === 'district' && !!userState && !!userDistrict;
  const stateScoped    = scope === 'state'    && !!userState;
  const isScoped       = districtScoped || stateScoped;
  // Reset should keep the plan-locked location, but clear it when unrestricted.
  const resetState    = isScoped ? userState : '';
  const resetDistrict = districtScoped ? userDistrict : '';

  const [appliedFilters, setAppliedFilters] = useState<WorkerFilters>({
    ...EMPTY_FILTERS,
    workerType: initialCat,
    // Only pre-seed the location when the plan actually scopes the search.
    // Non-subscribers (and 'india'-tier subscribers) start unrestricted = all-India.
    state: isScoped ? userState : '',
    district: '',
  });

  // Auto-fill / lock the search location to the plan's allowed scope. Re-runs
  // when the scope resolves (it is permissive 'india' until the profile loads).
  useEffect(() => {
    if (!isScoped) return;
    setAppliedFilters((prev) => {
      const nextState = userState;
      const nextDistrict = districtScoped ? userDistrict : prev.district;
      if (prev.state === nextState && (!districtScoped || prev.district === nextDistrict)) {
        return prev;
      }
      return { ...prev, state: nextState, district: districtScoped ? nextDistrict : prev.district, tehsil: '' };
    });
  }, [isScoped, districtScoped, userState, userDistrict]);
  const [showFilters,      setShowFilters]      = useState(false);
  const [searchQuery,      setSearchQuery]      = useState('');

  const [unlockedPhones,  setUnlockedPhones]  = useState<Record<string, string>>({});
  // Worker's optional secondary number per worker, revealed by the SAME unlock.
  const [unlockedAlternates, setUnlockedAlternates] = useState<Record<string, string>>({});
  const [loadingUnlock,   setLoadingUnlock]   = useState<Record<string, boolean>>({});
  const [callStatus,      setCallStatus]      = useState<Record<string, string>>({});
  const [savingRemark,    setSavingRemark]    = useState<Record<string, boolean>>({});
  const [remarkTimes,     setRemarkTimes]     = useState<Record<string, Date>>({});
  const [isLimitExhausted, setIsLimitExhausted] = useState(false);

  // Post-call flow: dial → leave app → return → "did it connect?" sheet.
  // "Yes" bumps outcomeOpen[<id>] so that card's outcome picker auto-opens.
  const callReturn = useCallReturn();
  const { dial: callReturnDial } = callReturn;
  const [outcomeOpen, setOutcomeOpen] = useState<Record<string, number>>({});
  const onDialCallStable = useCallback((w: { id: string; name: string; phone: string }) => {
    callReturnDial(w);
  }, [callReturnDial]);

  // Profile + subscription
  const profileQuery = useQuery({
    queryKey: ['search-user-profile'],
    queryFn: async () => {
      const res = await apiClient.get<{ user?: FullUserProfile }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    staleTime: 60 * 1000,     // 1 min — subscription changes must reflect quickly
    refetchOnMount: true,
  });
  const profile = profileQuery.data;

  // Depend on stable primitives, not the whole query object (new ref every
  // render → focus effect re-runs every render → refetch churn/flicker).
  const { refetch: refetchProfile, isStale: profileStale } = profileQuery;
  useFocusEffect(
    useCallback(() => {
      if (profileStale) {
        void refetchProfile();
      }
    }, [profileStale, refetchProfile]),
  );

  // Mirror the CRM: isSubscribed AND subscriptionExpery in the future
  const isSubscribed = (() => {
    if (!profile?.isSubscribed) return false;
    const exp = profile.subscriptionExpery;
    if (!exp) return true;
    return new Date(exp).getTime() > Date.now();
  })();

  const remainingContacts   = profile?.remainingContacts ?? 0;

  // Contact-quota usage nudges (25/50/75% toasts, redirect at 100%). Employer-only
  // by construction — agents have no quota, so this never fires for them. Emits
  // toasts only; the search UI is unchanged.
  const goToSubscription = useCallback(() => navigation.navigate('Subscription'), [navigation]);
  // NOTE: the app stores role lowercase (authApi maps 'Employer' → 'employer'),
  // so compare case-insensitively — a strict 'Employer' check would never match.
  const isEmployerRole = String(user?.role ?? '').toLowerCase() === 'employer';
  useContactQuotaNudge(
    {
      enabled: profileQuery.isSuccess && isEmployerRole,
      isSubscribed,
      employerType: profile?.employerType,
      subscriptionTpype: profile?.subscriptionTpype,
      remainingContacts,
      freeContactsUsed: profile?.freeContactsUsed ?? 0,
      freeContactsRemaining: profile?.freeContactsRemaining ?? 0,
      contactsTotal: profile?.contactsTotal ?? 0,
    },
    goToSubscription,
  );

  // Sync local exhausted state when profile loads (mirrors CRM's useState(user?.remainingContacts <= 0))
  useEffect(() => {
    if (profileQuery.isSuccess && isSubscribed && remainingContacts <= 0) {
      setIsLimitExhausted(true);
    }
  }, [profileQuery.isSuccess, isSubscribed, remainingContacts]);

  const isContactsExhausted = isLimitExhausted || (profileQuery.isSuccess && isSubscribed && remainingContacts <= 0);

  // FlatList re-renders rows only when `data` or `extraData` changes by reference.
  // Each card reads per-worker state (call status, unlocked phone, loading flags)
  // from these maps — without extraData the rows show STALE values after a
  // mutation (e.g. call outcome change didn't reflect until a manual refresh).
  const listExtraData = useMemo(
    () => ({ callStatus, unlockedPhones, loadingUnlock, savingRemark, remarkTimes, isContactsExhausted, isSubscribed }),
    [callStatus, unlockedPhones, loadingUnlock, savingRemark, remarkTimes, isContactsExhausted, isSubscribed],
  );

  // Load call remarks
  useQuery({
    queryKey: ['worker-remarks'],
    queryFn: async () => {
      const remarks = await workerApi.getWorkerRemarks();
      const mapped: Record<string, string> = {};
      remarks.forEach((r) => { mapped[r.workerId] = r.status; });
      setCallStatus(mapped);
      return mapped;
    },
    enabled: isSubscribed,
    staleTime: 2 * 60 * 1000,
  });

  // Infinite list
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    fetchStatus,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['workers-infinite', appliedFilters],
    queryFn: ({ pageParam = 1 }: { pageParam: number }) =>
      workerApi.getAllAgents({
        workerType:    appliedFilters.workerType    || undefined,
        subCategory:   appliedFilters.subCategory    || undefined,
        state:         appliedFilters.state         || undefined,
        district:      appliedFilters.district      || undefined,
        block:         appliedFilters.tehsil        || undefined,
        gender:        appliedFilters.gender        || undefined,
        workerGroup:   appliedFilters.workerGroup   || undefined,
        qualification: appliedFilters.qualification || undefined,
        minAge:        appliedFilters.ageMin ? Number(appliedFilters.ageMin) : undefined,
        maxAge:        appliedFilters.ageMax ? Number(appliedFilters.ageMax) : undefined,
        hasResume:     appliedFilters.hasResume || undefined,
        page:          pageParam,
        limit:         PAGE_LIMIT,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      // Use server-reported totalPages when available (respects work-type filter count)
      if (lastPage.pages > 0) {
        const next = allPages.length + 1;
        return next <= lastPage.pages ? next : undefined;
      }
      // Fallback: assume more if a full page was returned
      return lastPage.rawAgents.length >= PAGE_LIMIT ? allPages.length + 1 : undefined;
    },
    staleTime: 2 * 60 * 1000,
  });

  const allAgents: RawAgent[] = useMemo(
    () => data?.pages.flatMap((p) => p.rawAgents) ?? [],
    [data],
  );
  const activeFilterCount = countActive(appliedFilters);

  // Client-side search filter. Deferring the query keeps each keystroke smooth:
  // typing updates the input immediately while the (potentially large) list
  // re-filter runs at a lower priority instead of blocking every character.
  const deferredQuery = useDeferredValue(searchQuery);
  const filteredAgents = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return allAgents;
    return allAgents.filter((a) => {
      const name  = (a.name ?? '').toLowerCase();
      const areas = (a.areasOfWork ?? []).join(' ').toLowerCase();
      const dist  = (a.district ?? '').toLowerCase();
      return name.includes(q) || areas.includes(q) || dist.includes(q);
    });
  }, [allAgents, deferredQuery]);

  // Header quick-filter chips removed entirely (per request) — trade filtering is
  // done through the Filters sheet. The list shows all loaded results directly.
  const displayedAgents = filteredAgents;

  const handleApply = useCallback(
    (f: WorkerFilters): void => {
      if (!isSubscribed && countActive(f) > 0) {
        navigation.navigate('Subscription');
        return;
      }
      setAppliedFilters(f);
      setShowFilters(false);
    },
    [isSubscribed],
  );

  const handleViewContact = async (agentId: string): Promise<void> => {
    if (loadingUnlock[agentId] ?? unlockedPhones[agentId]) return;

    // Pre-check: expired or no subscription (mirrors CRM's isSubscriptionExpired guard)
    if (!isSubscribed) {
      navigation.navigate('Subscription');
      return;
    }

    try {
      setLoadingUnlock((p) => ({ ...p, [agentId]: true }));
      const res = await workerApi.unlockNumber(agentId);
      if (res.phone) { setUnlockedPhones((p) => ({ ...p, [agentId]: res.phone })); hapticSuccess(); }
      if (res.alternate) setUnlockedAlternates((p) => ({ ...p, [agentId]: res.alternate! }));
      // Contact consumed → refresh the count everywhere (search header, dashboard,
      // plan features). Mirrors WorkerProfileScreen / PaymentWebViewScreen.
      void qc.invalidateQueries({ queryKey: ['search-user-profile'] });
      void qc.invalidateQueries({ queryKey: ['employer-full-profile'] });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      if (msg === 'Contact limit exhausted') {
        // Mirror CRM: set local exhausted flag and redirect immediately
        setIsLimitExhausted(true);
        navigation.navigate('Subscription');
      } else {
        toast.error(msg ?? t('ws_unlock_failed_msg'), t('ws_unlock_failed_title'));
      }
    } finally {
      setLoadingUnlock((p) => ({ ...p, [agentId]: false }));
    }
  };

  const handleSaveRemark = async (agentId: string, status: string): Promise<void> => {
    setCallStatus((p) => ({ ...p, [agentId]: status }));
    setRemarkTimes((p) => ({ ...p, [agentId]: new Date() }));
    setSavingRemark((p) => ({ ...p, [agentId]: true }));
    try {
      await workerApi.saveWorkerRemark(agentId, status);
      hapticSuccess();
      void qc.invalidateQueries({ queryKey: ['worker-remarks'] });
      // Notify the worker about the call outcome update
      void apiClient.post('/api/v1/notifications/call-outcome', { workerId: agentId, outcome: status }).catch(() => {});
      toast.success(t('ws_outcome_saved_msg'), t('ws_saved_title'));
      // Positive call outcome (green = interested/available, blue = hired/joined)
      // → happy moment. Ask for a review once. Negative/neutral outcomes skip.
      const outcomeColor = getOutcomeColor(status);
      if (outcomeColor === OUTCOME_GREEN || outcomeColor === OUTCOME_BLUE) void requestReviewOnce();
    } catch {
      toast.error(t('ws_outcome_save_failed_msg'), t('ws_save_failed_title'));
    } finally {
      setSavingRemark((p) => ({ ...p, [agentId]: false }));
    }
  };

  // ── Stable callback identities for AgentCard's React.memo ──
  // These wrapper refs never change identity, so memoized rows skip
  // re-rendering when an UNRELATED row updates (unlock / remark / call
  // outcome). Each always invokes the LATEST handler via the ref, so the
  // actual behaviour (payment, unlock, remark) is completely unchanged.
  const cbRef = useRef({ handleViewContact, handleSaveRemark });
  cbRef.current = { handleViewContact, handleSaveRemark };
  const onViewContactStable = useCallback((id: string) => { void cbRef.current.handleViewContact(id); }, []);
  const onSaveRemarkStable = useCallback((id: string, status: string) => { void cbRef.current.handleSaveRemark(id, status); }, []);
  const onOpenProfile = useCallback((id: string) => navigation.navigate('WorkerProfile', { workerId: id }), [navigation]);
  const onGoSubscription = useCallback(() => navigation.navigate('Subscription'), [navigation]);

  // Pull-to-refresh for the worker/agent list
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  }, [refetch]);

  // Active filter pills
  const activePills: Array<{ key: string; label: string; onRemove: () => void }> = [
    appliedFilters.workerType && {
      key: 'wt',
      label: catDisplay(appliedFilters.workerType),
      onRemove: () =>
        setAppliedFilters((p) => ({ ...p, workerType: '', subCategory: '' })),
    },
    appliedFilters.subCategory && {
      key: 'sc',
      label: subcatDisplay(appliedFilters.subCategory),
      onRemove: () => setAppliedFilters((p) => ({ ...p, subCategory: '' })),
    },
    appliedFilters.state && appliedFilters.state !== userState && {
      key: 'st',
      label: appliedFilters.state,
      onRemove: () =>
        setAppliedFilters((p) => ({
          ...p,
          state: userState,
          district: '',
          tehsil: '',
        })),
    },
    appliedFilters.district && {
      key: 'di',
      label: appliedFilters.district,
      onRemove: () => setAppliedFilters((p) => ({ ...p, district: '', tehsil: '' })),
    },
    appliedFilters.tehsil && {
      key: 'te',
      label: appliedFilters.tehsil,
      onRemove: () => setAppliedFilters((p) => ({ ...p, tehsil: '' })),
    },
    appliedFilters.gender && {
      key: 'ge',
      label:
        appliedFilters.gender === 'Male'   ? t('ws_male')
        : appliedFilters.gender === 'Female' ? t('ws_female')
        : appliedFilters.gender === 'Other'  ? t('ws_other')
        : appliedFilters.gender,
      onRemove: () => setAppliedFilters((p) => ({ ...p, gender: '' })),
    },
    appliedFilters.workerGroup && {
      key: 'wg',
      label:
        appliedFilters.workerGroup === 'group' ? t('ws_pill_group') : t('ws_pill_individual'),
      onRemove: () => setAppliedFilters((p) => ({ ...p, workerGroup: '' })),
    },
    appliedFilters.qualification && {
      key: 'ql',
      label: `🎓 ${appliedFilters.qualification}`,
      onRemove: () => setAppliedFilters((p) => ({ ...p, qualification: '' })),
    },
    (appliedFilters.ageMin || appliedFilters.ageMax) && {
      key: 'age',
      label: t('ws_pill_age', { min: appliedFilters.ageMin || '0', max: appliedFilters.ageMax || '∞' }),
      onRemove: () => setAppliedFilters((p) => ({ ...p, ageMin: '', ageMax: '' })),
    },
  ].filter(Boolean) as Array<{ key: string; label: string; onRemove: () => void }>;

  const headerPaddingTop = insets.top + 12;

  const isDark = theme.mode === 'dark';
  return (
    <View style={[sc.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ── Header (blue gradient, Figma) ── */}
      <View style={[sc.header, { paddingTop: headerPaddingTop }]}>
        <View pointerEvents="none" style={sc.headerBlob} />
        <View style={sc.headerRow1}>
          {canGoBack && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={sc.backBtn}
              activeOpacity={0.7}
            >
              <AppText style={sc.backTxt}>←</AppText>
            </TouchableOpacity>
          )}
          <View style={sc.headerTitleBlock}>
            <AppText style={sc.headerTitle} numberOfLines={2}>{t('ws_header_title')}</AppText>
            <AppText style={sc.headerSub} numberOfLines={2}>
              📍 {appliedFilters.state
                ? t('ws_results_in', { state: getLocationDisplayName(appliedFilters.state, 'state', i18n.language) })
                : t('ws_all_india')}
            </AppText>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.8}
            style={sc.bellBtn}
          >
            <AppText style={sc.bellIcon}>🔔</AppText>
            <View style={sc.bellDot} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Plan scope banner ── */}
      {isScoped && (
        <TouchableOpacity
          onPress={() => navigation.navigate('Subscription')}
          activeOpacity={0.85}
          style={[scopeBanner.wrap, { backgroundColor: theme.colors.primaryLight, borderBottomColor: theme.colors.border }]}
        >
          <AppText style={scopeBanner.icon}>📍</AppText>
          <AppText style={[scopeBanner.txt, { color: theme.colors.text }]} numberOfLines={2}>
            {districtScoped
              ? t('pl_scopeDistrict', { district: getLocationDisplayName(userDistrict, 'district', i18n.language) })
              : t('pl_scopeState', { state: getLocationDisplayName(userState, 'state', i18n.language) })}
          </AppText>
          <AppText style={[scopeBanner.cta, { color: BRAND }]}>{t('pl_upgrade')}</AppText>
        </TouchableOpacity>
      )}

      {/* ── Search row — straddles the blue header / light list (blue behind top half) ── */}
      <View style={[sc.searchSection, { backgroundColor: theme.colors.background }, activePills.length === 0 && sc.searchSectionTight]}>
        <View pointerEvents="none" style={sc.searchBlueTop} />
        <View style={sc.searchRow}>
          <View style={sc.searchBarWrap}>
            <Ionicons name="search" size={20} color="#7A839B" style={sc.searchIcon} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('ws_main_search_placeholder')}
              placeholderTextColor="#7A839B"
              style={[sc.searchInput, { color: '#111A2E' }]}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={sc.searchClear}>
                <AppText style={sc.searchClearTxt}>✕</AppText>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            activeOpacity={0.85}
            style={sc.filterBtn}
          >
            <Ionicons name="options-outline" size={24} color="#FFFFFF" />
            {activeFilterCount > 0 && (
              <View style={sc.filterBadge}>
                <AppText style={sc.filterBadgeTxt}>{activeFilterCount}</AppText>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Category quick-filter chips removed (per request) — full category
            filtering still available via the filter button. */}

        {/* Active filter pills */}
        {activePills.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={sc.pillsBar}
            contentContainerStyle={sc.pillsContent}
          >
            {activePills.map((pill) => (
              <TouchableOpacity key={pill.key} onPress={pill.onRemove} activeOpacity={0.75} style={[sc.pill, { backgroundColor: theme.colors.primaryLight, borderColor: BRAND + '40' }]}>
                <AppText style={sc.pillTxt} numberOfLines={1}>{pill.label}</AppText>
                <AppText style={sc.pillClose}>×</AppText>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setAppliedFilters({ ...EMPTY_FILTERS, state: resetState, district: resetDistrict })}
              style={sc.pillClear}
            >
              <AppText style={sc.pillClearTxt}>{t('ws_clear_all')}</AppText>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {/* ── Content ── */}
      {isLoading ? (
        <ScrollView contentContainerStyle={sc.list} showsVerticalScrollIndicator={false}>
          {Array.from({ length: 6 }, (_, i) => (<SkeletonCard key={i} />))}
        </ScrollView>
      ) : isError || (fetchStatus === 'paused' && !data) ? (
        // fetchStatus === 'paused' (with no data yet) means React Query never
        // even got to attempt the request — the device was offline, so the
        // query never resolved to isError, it just parked itself waiting for
        // reconnect. Previously this fell all the way through to the empty
        // "No Workers Found" branch below, which misleadingly told the
        // employer no workers exist when the real problem was their own
        // connection.
        <View style={sc.stateBox}>
          <View style={sc.errorIconWrap}><AppText style={{ fontSize: 28 }}>⚠</AppText></View>
          <AppText style={[sc.stateTitle, { color: theme.colors.text }]}>{t('ws_connection_error')}</AppText>
          <AppText style={[sc.stateBody, { color: theme.colors.mutedText }]}>{t('ws_connection_error_body')}</AppText>
          <TouchableOpacity onPress={() => void refetch()} style={[sc.primaryBtn, { backgroundColor: theme.colors.primary }]}>
            <AppText style={sc.primaryBtnTxt}>{t('ws_retry')}</AppText>
          </TouchableOpacity>
        </View>
      ) : displayedAgents.length === 0 ? (
        <View style={sc.stateBox}>
          <View style={[sc.emptyIconWrap, { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary + '40' }]}><AppText style={{ fontSize: 32 }}>👷</AppText></View>
          <AppText style={[sc.stateTitle, { color: theme.colors.text }]}>{t('ws_no_workers_found')}</AppText>
          <AppText style={[sc.stateBody, { color: theme.colors.mutedText }]}>
            {searchQuery.trim()
              ? t('ws_no_results_query', { query: searchQuery.trim() })
              : activeFilterCount > 0
                ? t('ws_no_match_filters')
                : t('ws_no_workers_area')}
          </AppText>
          {searchQuery.trim() ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={[sc.primaryBtn, sc.outlineBtn, { borderColor: BRAND }]}>
              <AppText style={[sc.primaryBtnTxt, { color: BRAND }]}>{t('ws_clear_search')}</AppText>
            </TouchableOpacity>
          ) : activeFilterCount > 0 ? (
            <TouchableOpacity
              onPress={() => setAppliedFilters({ ...EMPTY_FILTERS, state: resetState, district: resetDistrict })}
              style={[sc.primaryBtn, sc.outlineBtn, { borderColor: BRAND }]}
            >
              <AppText style={[sc.primaryBtnTxt, { color: BRAND }]}>{t('ws_clear_filters')}</AppText>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={displayedAgents}
          extraData={listExtraData}
          keyExtractor={(item) => item._id}
          style={sc.flex1}
          contentContainerStyle={sc.list}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={10}
          // removeClippedSubviews is the #1 cause of the native
          // ReactViewGroup.drawChild IndexOutOfBoundsException crash on the New
          // Architecture (Fabric) — child view indices desync when clipped during
          // scroll. FlatList already virtualises via windowSize/maxToRenderPerBatch,
          // so keep it OFF on Fabric.
          removeClippedSubviews={false}
          ListHeaderComponent={
            <>
              {isEmployerRole && <WorkerSafetyNotice style={sc.safetyNotice} />}
              <SmartMatchStrip
                params={{
                  category: appliedFilters.workerType || undefined,
                  subCategory: appliedFilters.subCategory || undefined,
                  state: appliedFilters.state || undefined,
                  district: appliedFilters.district || undefined,
                }}
                enabled={activeFilterCount > 0}
              />
            </>
          }
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) void fetchNextPage(); }}
          onEndReachedThreshold={0.6}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BRAND]} tintColor={BRAND} />
          }
          renderItem={({ item }) => (
            <AgentCard
              agent={item}
              isSubscribed={isSubscribed}
              isContactsExhausted={isContactsExhausted}
              unlockedPhone={unlockedPhones[item._id]}
              unlockedAlternate={unlockedAlternates[item._id]}
              loadingUnlock={loadingUnlock[item._id] ?? false}
              callStatus={callStatus[item._id] ?? ''}
              savingRemark={savingRemark[item._id] ?? false}
              remarkTime={remarkTimes[item._id]}
              workerTypeApplied={appliedFilters.workerType}
              appliedDistrict={appliedFilters.district}
              onViewContact={onViewContactStable}
              onSubscribe={onGoSubscription}
              onTopup={onGoSubscription}
              onSaveRemark={onSaveRemarkStable}
              onPress={onOpenProfile}
              onDialCall={onDialCallStable}
              outcomeOpenSignal={outcomeOpen[item._id] ?? 0}
            />
          )}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={sc.loadMore}>
                <ActivityIndicator size="small" color={BRAND} />
                <AppText style={[sc.loadMoreTxt, { color: theme.colors.mutedText }]}>{t('ws_loading_more')}</AppText>
              </View>
            ) : null
          }
        />
      )}

      <FilterSheet
        visible={showFilters}
        initial={appliedFilters}
        onApply={handleApply}
        onClose={() => setShowFilters(false)}
        userState={userState}
        userDistrict={userDistrict}
        lockState={isScoped}
        lockDistrict={districtScoped}
      />

      <CallCheckSheet
        worker={callReturn.pending}
        onConnected={(w) => {
          callReturn.dismiss();
          if (isSubscribed) setOutcomeOpen((m) => ({ ...m, [w.id]: Date.now() }));
        }}
        onDismiss={callReturn.dismiss}
      />
    </View>
  );
};

// ─── Screen styles ────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  container:       { flex: 1 },
  flex1:           { flex: 1 },

  // Header (blue)
  header:          { paddingHorizontal: 20, paddingBottom: 18, backgroundColor: '#1037A4', overflow: 'hidden' },
  headerBlob:      { position: 'absolute', width: 240, height: 240, borderRadius: 120, top: -100, right: -80, backgroundColor: 'rgba(255,255,255,0.05)' },
  headerRow1:      { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtn:         { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  backTxt:         { fontSize: 20, fontWeight: '700', lineHeight: 24, color: '#FFFFFF' },
  headerTitleBlock:{ flex: 1 },
  headerTitle:     { fontSize: 21, fontWeight: '800', letterSpacing: -0.3, color: '#FFFFFF' },
  headerSub:       { fontSize: 13, fontWeight: '600', color: '#C5D0F5', marginTop: 4 },
  bellBtn:         { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', position: 'relative' },
  bellIcon:        { fontSize: 18 },
  bellDot:         { position: 'absolute', top: 0, right: 0, width: 11, height: 11, borderRadius: 6, backgroundColor: '#FF8A3D', borderWidth: 2, borderColor: '#1037A4' },

  // Search band — light bg with a blue strip behind only the top half of the input
  searchSection:   { paddingHorizontal: 16, paddingBottom: 14, position: 'relative' },
  // No active filter pills → nothing sits below the input, so the full 14px
  // bottom padding + the list's own paddingTop left the first result card
  // floating with a big blank gap. Tighten the band in that case; the pills
  // path is untouched (pillsBar carries its own marginTop).
  searchSectionTight: { paddingBottom: 4 },
  searchBlueTop:   { position: 'absolute', top: 0, left: 0, right: 0, height: 26, backgroundColor: '#1037A4' },
  searchRow:       { flexDirection: 'row', gap: 10 },
  searchBarWrap:   { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, height: 52, paddingHorizontal: 14, gap: 11, shadowColor: '#142250', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 6 },
  searchIcon:      { marginRight: 0 },
  searchInput:     { flex: 1, fontSize: 15, fontWeight: '600', paddingVertical: 0 },
  searchClear:     { padding: 4 },
  searchClearTxt:  { fontSize: 16, lineHeight: 20, color: '#475069' },
  filterBtn:       { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', position: 'relative', backgroundColor: '#2243BC', shadowColor: '#2243BC', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 6 },
  filterIcon:      { fontSize: 18, color: '#FFFFFF' },
  filterBadge:     { position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#FF8A3D', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderWidth: 2, borderColor: '#EEF1F8' },
  filterBadgeTxt:  { fontSize: 11, fontWeight: '800', color: WHITE },

  // Category chips
  chipsContent:    { gap: 8, paddingBottom: 4 },
  chip:            { borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 7 },
  chipActive:      {},
  chipTxt:         { fontSize: 13, fontWeight: '600' },
  chipTxtActive:   { fontWeight: '700' },

  // Active filter pills
  pillsBar:        { flexGrow: 0, marginTop: 6 },
  pillsContent:    { gap: 7, flexDirection: 'row' },
  pill:            { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  pillTxt:         { fontSize: 13, lineHeight: 19, fontWeight: '600', color: BRAND, flexShrink: 0 },
  pillClose:       { fontSize: 16, fontWeight: '700', color: BRAND, lineHeight: 18 },
  pillClear:       { borderRadius: 20, borderWidth: 1, borderColor: '#fca5a5', backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 7, justifyContent: 'center' },
  pillClearTxt:    { fontSize: 13, lineHeight: 19, fontWeight: '700', color: '#dc2626' },

  // Result count bar

  // List
  list:            { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 32 },
  // Collapses WorkerSafetyNotice's own default marginTop (10) since this
  // list's contentContainerStyle already contributes paddingTop above it —
  // stacking both made the gap under the search bar look oversized.
  safetyNotice:    { marginTop: 0 },

  // Loading more
  loadMore:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 20 },
  loadMoreTxt:     { fontSize: 13 },

  // Empty / error states
  stateBox:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  errorIconWrap:   { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fee2e2', borderWidth: 2, borderColor: '#fca5a5', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyIconWrap:   { width: 80, height: 80, borderRadius: 40, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stateTitle:      { fontSize: 19, fontWeight: '800', textAlign: 'center' },
  stateBody:       { fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  primaryBtn:      { marginTop: 4, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 13 },
  outlineBtn:      { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: BRAND },
  primaryBtnTxt:   { color: WHITE, fontWeight: '800', fontSize: 14 },
});
