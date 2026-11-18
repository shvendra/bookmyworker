import { SafeBoundary } from '../../../shared/components/feedback/SafeBoundary';
import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, Platform, RefreshControl, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { UpgradeBanner } from '../components/UpgradeBanner';
import { shortlistStorage } from '../../../core/storage/shortlistStorage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { useAppConfig } from '../../../core/api/endpoints/appConfigApi';
import { BgcPromoCard } from '../../bgc/components/BgcPromoCard';
import { usePricingConfig } from '../../../core/api/endpoints/pricingApi';
import type { EmployerTypeKey } from '../../../core/api/endpoints/pricingApi';
import { usePlanFeatures } from '../../../core/hooks/usePlanFeatures';
import { SuggestedWorkersModal } from '../components/SuggestedWorkersModal';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { RawRequirement } from '../../../core/api/endpoints/requirementsApi';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import type { RawAgent } from '../../../core/api/endpoints/workerApi';
import { useAuth } from '../../../state/auth/AuthContext';
// Profile-completion nudge disabled for now — mandatory completion is enforced
// via the post-OTP WorkerProfileCompletionScreen instead.
// import { ProfileCompletionModal } from '../../../shared/components/ui/ProfileCompletionModal';
import { GuidedTour } from '../../../shared/components/ui/GuidedTour';
import { workerMappingApi } from '../../../core/api/endpoints/workerMappingApi';
import { clientCompaniesApi } from '../../../core/api/endpoints/clientCompaniesApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { type CompletenessField } from '../../../shared/components/ui/ProfileCompletenessCard';
import { NeedsAttentionCard, type AttentionItem } from '../../../shared/components/ui/NeedsAttentionCard';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { useToast } from '../../../shared/state/toast/ToastContext';
import type { MainStackParamList } from '../../../app/navigation/types';
import { buildPhotoUrl } from '../../../core/config/env';
import { useFeedbackNudge } from '../utils/useFeedbackNudge';
import { apiClient } from '../../../core/api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmployerSubscriptionModal } from '../../payment/components/EmployerSubscriptionModal';
import { FadeInView, CountUpText } from '../../../shared/components/motion';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import { LivePulseCard } from '../components/LivePulseCard';
import { CategoryChipsRow } from '../components/CategoryChipsRow';
import { OffersBanner } from '../components/OffersBanner';
import { HappyCustomersCard, isNeverSubscribed } from '../components/HappyCustomersCard';
import i18n from '../../../core/i18n';
import { useTranslation } from 'react-i18next';
import { getWorkTypeLabel } from '../../../shared/utils/labelUtils';
import { describeLoadError, firstQueryError } from '../../../shared/utils/describeLoadError';
import { FestivalWishesModal } from '../../../shared/components/ui/FestivalWishesModal';
import { PlanExpiredModal } from '../components/PlanExpiredModal';
import { maxDiscountPct, planExpiredKey } from '../utils/planExpiredOffer';

import { BRAND } from '../../../core/theme/brand';
// Festival wishes popup is shown at most once per app session (not on every
// dashboard remount). SuperAdmin's festivalMode toggle still gates it entirely.
let festivalShownThisSession = false;

const EMPLOYER_SUB_MODAL_KEY = 'employer_sub_modal_shown';
// How long the employer must dwell on the dashboard before the one-time
// subscription modal auto-opens. The timer resets every time they leave.
const SUB_MODAL_DELAY_MS = 30_000;
const PLAN_EXPIRED_DELAY_MS = 3_000;


// ─── Types & Constants ─────────────────────────────────────────────────────────
type ReqTab = 'all' | 'open' | 'closed';
type Nav = NativeStackNavigationProp<MainStackParamList>;

// REQ_TABS is built inside the screen using t() — see renderHeader

import { RequirementCarousel } from '../components/dashboard/RequirementWidgets';
import { NearbyWorkersSlider, nws } from '../components/dashboard/NearbyWorkers';
import { SubscriptionStatusWidget } from '../components/dashboard/SubscriptionStatusWidget';
import { NEARBY_SHOW, isClosed, isCompleted, isAssigned, getGreetingKey } from '../components/dashboard/dashboardShared';
// ─── Main Screen Component ─────────────────────────────────────────────────────
export const EmployerDashboardScreen = (): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { t: tDefault } = useTranslation(); // cat_* keys live in the default namespace
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const { config } = useAppConfig();
  const { pricing } = usePricingConfig();

  // ── Help chat (category → subcategory → question, escalate to agent/email/call) ──

  // ── Festival wishes popup (SuperAdmin-gated, once per app session) ──────────
  const [showFestival, setShowFestival] = useState(false);
  useEffect(() => {
    const p = config.promotions;
    if (!p?.festivalMode || !p.festivalImageUrl) return;
    if (p.festivalEndsAt && new Date(p.festivalEndsAt).getTime() <= Date.now()) return; // end time passed
    if (festivalShownThisSession) return;
    // Open only once the banner image is really downloaded — otherwise the dialog shows as an
    // empty dark box. A failed/slow load just skips the popup (and retries next dashboard visit).
    let cancelled = false;
    let tmr: ReturnType<typeof setTimeout> | undefined;
    Image.prefetch(p.festivalImageUrl)
      .then((ok) => {
        if (cancelled || !ok || festivalShownThisSession) return;
        festivalShownThisSession = true;
        tmr = setTimeout(() => { if (!cancelled) setShowFestival(true); }, 600);
      })
      .catch(() => { /* never block the dashboard */ });
    return () => { cancelled = true; if (tmr) clearTimeout(tmr); };
  }, [config.promotions]);

  const REQ_TABS: Array<{ label: string; value: ReqTab }> = [
    { label: t('tabAll'),    value: 'all' },
    { label: t('tabOpen'),   value: 'open' },
    { label: t('tabClosed'), value: 'closed' },
  ];
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
          lastsubscriptionDate?: string | null;
          remainingContacts?: number;
          freeContactsRemaining?: number;
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

  // True when they were subscribed but the expiry date has passed
  const isExpired = (() => {
    if (!profileQuery.isSuccess || !profile?.isSubscribed) return false;
    const exp = profile.subscriptionExpery;
    if (!exp) return false;
    return new Date(exp).getTime() <= Date.now();
  })();

  // Quarterly "How is BookMyWorker working for you?" — only for a running paid plan; the server decides whether they are due.
  useFeedbackNudge(isSubscribed, () => navigation.navigate('EmployerFeedback', { fromPrompt: true }));

  const remainingContacts = profile?.remainingContacts ?? 0;
  // Gifted free contacts still available (SuperAdmin-configured). Shown as a
  // banner when > 0 so employers know they can unlock contacts at no cost.
  const freeContactsRemaining = Math.max(0, profile?.freeContactsRemaining ?? 0);

  // Plan-derived feature flags + posts-remaining (degrades gracefully when absent)
  const plan = usePlanFeatures();
  const remainingPostsLabel = useMemo(() => {
    // Hide entirely when not subscribed, unlimited plan, or backend omits the count.
    if (!isSubscribed) return null;
    if (plan.unlimitedPosts) return t('pl_postsUnlimited');
    if (plan.remainingPosts == null) return null;
    return t('pl_postsRemaining', { count: plan.remainingPosts });
  }, [isSubscribed, plan.unlimitedPosts, plan.remainingPosts, t]);

  // Resolve employerType string to one of the four known EmployerTypeKey values
  const resolvedEmployerType: EmployerTypeKey = (
    (['industry', 'agency', 'contractor', 'individual'] as const)
      .find((t) => String(profile?.employerType ?? user?.employerType ?? '').toLowerCase().includes(t))
  ) ?? 'individual';


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

  // ── Boost quota + handler ──────────────────────────────────────────────────
  const boostQuotaQuery = useQuery({
    queryKey: ['employer-boost-quota', user?.id],
    queryFn: () => requirementsApi.getBoostQuota(),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!user?.id && isSubscribed,
  });
  const boostInfo = boostQuotaQuery.data;
  const boostEnabled = !!boostInfo?.enabled && isSubscribed;
  const boostRemaining = boostInfo?.remaining ?? 0;
  const [boostingId, setBoostingId] = useState<string | null>(null);

  const handleBoost = useCallback((req: RawRequirement) => {
    Alert.alert(
      t('req_boostConfirmTitle'),
      t('req_boostConfirmBody', { days: boostInfo?.durationDays ?? 30, remaining: boostRemaining }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('req_boostToTop'),
          onPress: async () => {
            setBoostingId(req._id);
            try {
              await requirementsApi.boostRequirement(req._id);
              toast.success(t('req_boostSuccess'));
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['employer-requirements', user?.id] }),
                queryClient.invalidateQueries({ queryKey: ['employer-boost-quota', user?.id] }),
              ]);
            } catch (e: any) {
              toast.error(e?.response?.data?.message || t('req_boostFailed'));
            } finally {
              setBoostingId(null);
            }
          },
        },
      ],
    );
  }, [boostInfo?.durationDays, boostRemaining, t, toast, queryClient, user?.id]);

  const nearbyQuery = useQuery({
    queryKey: ['nearby-agents', user?.state, user?.district, 'photoFirst'],
    queryFn: () => workerApi.getAllAgents({
      state: user?.state || undefined,
      district: user?.district || undefined,
      workerGroup: 'individual',
      photoFirst: true,   // backend lists workers WITH a photo first, then the rest — so the strip is never empty
      page: 1,
      limit: 20,
    }),
    staleTime: 10 * 60 * 1000,
    enabled: !!user?.state,
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

  // Gates the "Private Workforce" quick-action tile below — same query key as
  // MyWorkforceRequirementsScreen/MyInvoicesScreen so the cache is shared and
  // this never fires a duplicate network call when the employer taps through.
  const wfCompanyQuery = useQuery({
    queryKey: ['wf-my-company'],
    queryFn: () => clientCompaniesApi.getMyCompany(),
    staleTime: 60_000,
  });
  const hasWorkforceCompany = !!wfCompanyQuery.data;

  const closeMutation = useMutation({
    mutationFn: (id: string) => requirementsApi.close(id),
    onMutate: (id) => setClosingId(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['employer-requirements'] });
      setClosingId(null);
      toast.success(t('requirementClosed'), t('closedToast'));
    },
    onError: () => { setClosingId(null); toast.error(t('failedToClose')); },
  });

  // ── Memoized Computations ──────────────────────────────────────────────────
  const all = reqQuery.data?.requirements ?? [];
  // Completed/fulfilled requirements count as INACTIVE — grouped with closed, never "open".
  const openCount   = useMemo(() => all.filter((r) => !isAssigned(r) && !isClosed(r) && !isCompleted(r)).length, [all]);
  const closedCount = useMemo(() => all.filter((r) => isClosed(r) || isCompleted(r)).length, [all]);

  const filteredRequirements = useMemo(() => {
    return all.filter((r) => {
      if (reqTab === 'open')   return !isAssigned(r) && !isClosed(r) && !isCompleted(r);
      if (reqTab === 'closed') return isClosed(r) || isCompleted(r);
      return true;
    });
  }, [all, reqTab]);

  const nearbyAgents: RawAgent[] = nearbyQuery.data?.rawAgents ?? [];
  const nearbyTotal = nearbyQuery.data?.total ?? 0;
  // Workers with a profile photo come first (backend `photoFirst`); no-photo workers only fill the rest.
  const displayedNearby = useMemo(
    () => nearbyAgents.slice(0, NEARBY_SHOW),   // photo workers already come first from the backend
    [nearbyAgents],
  );

  const interestedCount = useMemo(
    () => all.reduce((sum, r) => sum + (r.intrestedAgents?.length ?? 0), 0),
    [all],
  );

  // Exact live figure with Indian digit grouping (e.g. "6,70,695+"), not a
  // rounded "6.7L+" — matches the CRM dashboard and the true directory size.
  const totalWorkersDisplay = `${(config.stats.workerCount ?? 0).toLocaleString('en-IN')}+`;

  const isRefreshing = reqQuery.isFetching || profileQuery.isFetching;

  // Refetch profile whenever screen comes back into focus (e.g. returning from
  // payment screen) — only if the cache was invalidated (isStale = true)
  useFocusEffect(
    useCallback(() => {
      // Always refetch on focus so contact + free-contact counts reflect any
      // unlock that just happened on another screen (real-time balance).
      void profileQuery.refetch();
    }, [profileQuery]),
  );

  // Refresh shortlist badge count on every focus
  useFocusEffect(
    useCallback(() => {
      void shortlistStorage.getAll().then((ids) => setShortlistCount(ids.length));
    }, []),
  );

  // Auto-show the subscription modal once for non-subscribed employers — but
  // never immediately. It only appears after the employer has stayed on the
  // dashboard for SUB_MODAL_DELAY_MS. Leaving the dashboard before then cancels
  // the timer; it starts fresh (again, not immediate) the next time they land
  // back on the dashboard. Once shown, the AsyncStorage flag stops it forever.
  const subModalShownRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!profileQuery.isSuccess || isSubscribed || subModalShownRef.current) return;

      let timer: ReturnType<typeof setTimeout> | undefined;
      let cancelled = false;

      void AsyncStorage.getItem(EMPLOYER_SUB_MODAL_KEY).then((shown) => {
        if (cancelled || shown || subModalShownRef.current) return;
        timer = setTimeout(() => {
          subModalShownRef.current = true;
          setSubModalVisible(true);
          void AsyncStorage.setItem(EMPLOYER_SUB_MODAL_KEY, '1');
        }, SUB_MODAL_DELAY_MS);
      });

      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }, [profileQuery.isSuccess, isSubscribed]),
  );

  // "Your plan has expired" popup (mirrors the CRM's PlanExpiredDialog): once per expiry, a few
  // seconds after the dashboard opens, never on top of the festival popup. Closing it — or tapping
  // Renew — marks it seen, so it never nags again for the same expiry.
  const [planExpiredVisible, setPlanExpiredVisible] = useState(false);
  const planExpiredShownRef = useRef(false);
  const expiryKey = user?.id && profile?.subscriptionExpery ? planExpiredKey(String(user.id), profile.subscriptionExpery) : null;
  useFocusEffect(
    useCallback(() => {
      if (!isExpired || !expiryKey || planExpiredShownRef.current) return undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let cancelled = false;
      void AsyncStorage.getItem(expiryKey).then((seen) => {
        if (cancelled || seen) return;
        timer = setTimeout(() => {
          if (cancelled || planExpiredShownRef.current || showFestival) return;
          planExpiredShownRef.current = true;
          setPlanExpiredVisible(true);
        }, PLAN_EXPIRED_DELAY_MS);
      }).catch(() => { /* storage failure → just skip the popup */ });
      return () => { cancelled = true; if (timer) clearTimeout(timer); };
    }, [isExpired, expiryKey, showFestival]),
  );
  const closePlanExpired = useCallback((): void => {
    setPlanExpiredVisible(false);
    if (expiryKey) void AsyncStorage.setItem(expiryKey, '1').catch(() => {});
  }, [expiryKey]);
  const planExpiredDiscount = useMemo(
    () => maxDiscountPct(profile?.employerType ?? user?.employerType, pricing),
    [profile?.employerType, user?.employerType, pricing],
  );

  // ── Callbacks ──────────────────────────────────────────────────────────────
  // Pull-to-refresh spinner is driven ONLY by an explicit user pull — never by
  // background/initial query fetching. Tying RefreshControl to `isFetching` left
  // the spinner stuck on the dashboard hero whenever a query refetched on mount.
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await Promise.all([
        reqQuery.refetch(),
        profileQuery.refetch(),
        nearbyQuery.refetch(),
        dashQuery.refetch(),
        isSubscribed ? pipelineQuery.refetch() : Promise.resolve(),
      ]);
    } finally {
      setManualRefreshing(false);
    }
  }, [reqQuery, profileQuery, nearbyQuery, dashQuery, pipelineQuery, isSubscribed]);

  // Surface a retry affordance when primary data sources fail, instead of
  // silently rendering empty lists / zero counts on the employer home screen.
  const hasLoadError =
    reqQuery.isError ||
    dashQuery.isError ||
    nearbyQuery.isError ||
    profileQuery.isError ||
    (isSubscribed && pipelineQuery.isError);

  // Explain WHY the refresh failed (slow internet / server busy / session) so
  // the banner isn't just "couldn't refresh" with no reason.
  const loadErrorReason = describeLoadError(
    firstQueryError([profileQuery, reqQuery, dashQuery, nearbyQuery, isSubscribed ? pipelineQuery : null]),
    t,
  );

  const handlePost = useCallback(() => {
    if (profileQuery.isLoading) return;
    // No subscription or expired → go to pricing
    if (!isSubscribed) { navigation.navigate('Subscription'); return; }
    // Subscribed but all contacts used up → go to top-up
    if (remainingContacts <= 0) { navigation.navigate('Subscription'); return; }
    navigation.navigate('PostRequirement');
  }, [isSubscribed, remainingContacts, profileQuery.isLoading, navigation]);

  const handleWorkerSearchNavigate  = useCallback(() => navigation.navigate('WorkerSearch'), [navigation]);
  const handlePipelineNavigate      = useCallback(() => navigation.navigate('EmployerPipeline'), [navigation]);
  const handleCalendarNavigate      = useCallback(() => navigation.navigate('RequirementCalendar'), [navigation]);
  const handleAnalyticsNavigate     = useCallback(() => navigation.navigate('EmployerAnalytics'), [navigation]);
  const handleAgreementNavigate     = useCallback(() => navigation.navigate('EmployerAgreement'), [navigation]);
  const handleWorkforceNavigate     = useCallback(() => navigation.navigate('MyWorkforceRequirements'), [navigation]);
  const handleSubscriptionNavigate = useCallback(() => navigation.navigate('Subscription'), [navigation]);
  const handleOpenSubModal = useCallback(() => setSubModalVisible(true), []);
  const handleAgentTilePress = useCallback((id: string) => navigation.navigate('WorkerProfile', { workerId: id }), [navigation]);
  const handleReqCardPress = useCallback((id: string) => navigation.navigate('RequirementDetail', { requirementId: id }), [navigation]);
  const handleReqCardClose = useCallback((req: RawRequirement) => setCloseTarget(req), []);
  // Invite-workers modal (opened from a requirement card; same-category suggestions)
  const [inviteReq, setInviteReq] = useState<RawRequirement | null>(null);
  const handleInviteReq = useCallback((req: RawRequirement) => setInviteReq(req), []);

  // ── Profile completeness fields (employer) — chips on the Profile Strength card.
  // KYC counts as done when GST or firm details exist (Industry employers verify via
  // GST, not Aadhaar). Labels come from the default namespace (shared pf_* keys).
  const completenessFields = useMemo<CompletenessField[]>(() => {
    const kyc = (profile?.kyc ?? {}) as { gstNumber?: string; firmName?: string };
    const hasKyc = !!(kyc.gstNumber || kyc.firmName || profile?.status === 'approved' || profile?.status === 'verified');
    return [
      { key: 'name',     label: tDefault('pf_name'),         done: !!user?.fullName?.trim() },
      { key: 'phone',    label: tDefault('pf_phone'),        done: !!user?.phone },
      { key: 'email',    label: tDefault('pf_email'),        done: !!user?.email?.trim() },
      { key: 'state',    label: tDefault('pf_state'),        done: !!user?.state?.trim() },
      { key: 'district', label: tDefault('pf_district'),     done: !!user?.district?.trim() },
      { key: 'etype',    label: tDefault('pf_employerType'), done: !!resolvedEmployerType },
      { key: 'photo',    label: tDefault('pf_photo'),        done: !!(user?.profileImage || profile?.profilePhoto) },
      { key: 'kyc',      label: tDefault('pf_kyc'),          done: hasKyc },
      { key: 'sub',      label: tDefault('pf_subscription'), done: isSubscribed },
    ];
  }, [tDefault, user?.fullName, user?.phone, user?.email, user?.state, user?.district, user?.profileImage, profile?.profilePhoto, profile?.kyc, profile?.status, resolvedEmployerType, isSubscribed]);

  // ── Needs-attention items (employer) — prioritized pending actions.
  // Only surfaces actionable BUSINESS alerts (subscribe, expiry, low contacts,
  // responses). Profile-completion nags (KYC / photo / email) are intentionally
  // NOT shown here — they cluttered the dashboard; profile completeness lives on
  // the My Profile page (header avatar still shows the %). The card auto-hides
  // when there are no items, keeping the dashboard clean.
  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    if (!isSubscribed) {
      items.push({ key: 'sub', emoji: '🔒', title: t('na_emp_subscribe_t'), desc: t('na_emp_subscribe_d'), priority: 'high', onPress: () => navigation.navigate('Subscription') });
    } else {
      const exp = profile?.subscriptionExpery ? new Date(profile.subscriptionExpery).getTime() : null;
      if (exp != null && !Number.isNaN(exp)) {
        const days = Math.ceil((exp - Date.now()) / 86400000);
        if (days <= 7) items.push({ key: 'exp', emoji: '⏳', title: t('na_emp_subExpiry_t'), desc: t('na_emp_subExpiry_d'), priority: days <= 3 ? 'high' : 'medium', onPress: () => navigation.navigate('Subscription') });
      }
      if (remainingContacts <= 3) items.push({ key: 'contacts', emoji: '📉', title: t('na_emp_lowContacts_t'), desc: t('na_emp_lowContacts_d'), priority: remainingContacts <= 0 ? 'high' : 'medium', onPress: () => navigation.navigate('Subscription') });
    }
    if (interestedCount > 0) items.push({ key: 'resp', emoji: '🙋', title: t('na_emp_responses_t'), desc: t('na_emp_responses_d'), priority: 'high', onPress: () => navigation.navigate('EmployerPipeline') });
    const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return items.sort((a, b) => rank[a.priority] - rank[b.priority]);
  }, [t, isSubscribed, profile?.subscriptionExpery, remainingContacts, interestedCount, navigation]);

  // Profile completeness % shown as a badge on the header avatar.
  const profilePct = useMemo(() => {
    const d = completenessFields.filter((f) => f.done).length;
    return completenessFields.length ? Math.round((d / completenessFields.length) * 100) : 0;
  }, [completenessFields]);

  // ── Render Sub-blocks for FlatList ──────────────────────────────────────────
  const renderHeader = useMemo(() => (
    <View>
      {/* ── Subscription Status Widget (always shown once profile loaded) ── */}
      <FadeInView>
      <SafeBoundary scope="dashboard.subscriptionStatus">
      <SubscriptionStatusWidget
        isSubscribed={isSubscribed}
        isExpired={isExpired}
        profileLoaded={profileQuery.isSuccess}
        remainingContacts={remainingContacts}
        subscriptionExpery={profile?.subscriptionExpery}
        postsLabel={remainingPostsLabel}
        onSubscribe={handleOpenSubModal}
        onRenew={handleSubscriptionNavigate}
        onTopUp={handleSubscriptionNavigate}
        onFindWorkers={handleWorkerSearchNavigate}
        onPost={handlePost}
        workerCountLabel={totalWorkersDisplay}
      />
      </SafeBoundary>
      </FadeInView>

      {/* ── Free contacts banner (gifted unlocks remaining) ──
          Hidden for subscribed employers: free contacts apply only when there's
          no active subscription. */}
      {!isSubscribed && freeContactsRemaining > 0 && (
        <TouchableOpacity accessibilityRole="button"
          activeOpacity={0.9}
          onPress={handleWorkerSearchNavigate}
          style={styles.freeBanner}
        >
          <Ionicons name="gift" size={24} color="#137A38" style={styles.freeBannerEmoji} />
          <View style={{ flex: 1 }}>
            <AppText style={styles.freeBannerTitle} maxFontSizeMultiplier={1.3} numberOfLines={1}>
              {t('dashFreeContactsTitle', { count: freeContactsRemaining })}
            </AppText>
            <AppText style={styles.freeBannerSub} maxFontSizeMultiplier={1.3} numberOfLines={2}>
              {t('dashFreeContactsSub')}
            </AppText>
          </View>
          <AppText style={styles.freeBannerChevron}>›</AppText>
        </TouchableOpacity>
      )}

      {/* ── Quick Action Cards ── */}
      <FadeInView delay={90}>
      <View style={styles.qaRow}>
        {/* Post Requirement */}
        <TouchableOpacity accessibilityRole="button" onPress={handlePost} activeOpacity={0.88} style={[styles.qaCard, styles.qaCardBlue]}>
          {/* Top: icon + status pill */}
          <View style={styles.qaTop}>
            <View style={styles.qaIconWrap}>
              <Ionicons name="flash" size={20} color="#FFC24B" />
            </View>
            <View style={styles.qaNewBadge}>
              <AppText style={styles.qaNewTxt}>
                {openCount > 0 ? t('badgeActive') : t('badgePostNew')}
              </AppText>
            </View>
          </View>
          {/* Big number */}
          {reqQuery.isLoading ? (
            <AppText style={styles.qaCount} maxFontSizeMultiplier={1.2} numberOfLines={1}>—</AppText>
          ) : (
            <CountUpText value={openCount} style={styles.qaCount} maxFontSizeMultiplier={1.2} numberOfLines={1} />
          )}
          {/* Title + arrow */}
          <View style={styles.qaTitleRow}>
            <AppText style={[styles.qaTitle, styles.qaTitleFlex]} numberOfLines={2}>{t('postRequirement')}</AppText>
            <View style={styles.qaArrow}>
              <AppText style={styles.qaArrowTxt}>→</AppText>
            </View>
          </View>
          {/* Description */}
          <AppText style={styles.qaSub} numberOfLines={2}>
            {openCount > 0 ? t(openCount === 1 ? 'activeRequirements' : 'activeRequirements_plural', { count: openCount }) : t('publishNew')}
          </AppText>
        </TouchableOpacity>

        {/* Browse Workers */}
        <TouchableOpacity accessibilityRole="button" onPress={handleWorkerSearchNavigate} activeOpacity={0.88} style={[styles.qaCard, styles.qaCardGreen]}>
          {/* Top: icon + status pill */}
          <View style={styles.qaTop}>
            <View style={[styles.qaIconWrap, styles.qaIconWrapGreen]}>
              <Ionicons name="people" size={20} color="#16A34A" />
            </View>
            <View style={[styles.qaNewBadge, styles.qaNewBadgeGreen]}>
              <AppText style={[styles.qaNewTxt, { color: '#065f46' }]}>{t('badgeAvailable')}</AppText>
            </View>
          </View>
          {/* Big number — full digits (e.g. "6,70,695+"); shrink to fit the tile */}
          <CountUpText value={config.stats.workerCount ?? 0} suffix="+" style={[styles.qaCount, styles.qaCountGreen]} maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} />
          {/* Title + arrow */}
          <View style={styles.qaTitleRow}>
            <AppText style={[styles.qaTitle, styles.qaTitleGreen, styles.qaTitleFlex]} numberOfLines={2}>{t('browseWorkers')}</AppText>
            <View style={[styles.qaArrow, styles.qaArrowGreen]}>
              <AppText style={[styles.qaArrowTxt, { color: '#065f46' }]}>→</AppText>
            </View>
          </View>
          {/* Description */}
          <AppText style={[styles.qaSub, styles.qaSubGreen]} numberOfLines={2}>{t('exploreVerified')}</AppText>
        </TouchableOpacity>
      </View>

      </FadeInView>

      {/* ── Live marketplace pulse + category shortcuts + offers (all self-hide when empty) ── */}
      <FadeInView delay={180}>
        <SafeBoundary scope="dashboard.livePulse"><LivePulseCard onPress={handleWorkerSearchNavigate} onWorkerPress={handleAgentTilePress} /></SafeBoundary>
        <SafeBoundary scope="dashboard.categoryChips">
          <CategoryChipsRow
            onSelect={(value) => navigation.navigate('WorkerSearch', { workType: value })}
            onViewAll={handleWorkerSearchNavigate}
          />
        </SafeBoundary>
        <SafeBoundary scope="dashboard.offers"><OffersBanner /></SafeBoundary>
      </FadeInView>

      {/* ── Needs Attention — only for employers with an ACTIVE subscription ──
          (Profile Strength card lives on the My Profile page; the header avatar
          still shows the completeness %.) */}
      {isSubscribed && <SafeBoundary scope="dashboard.needsAttention"><NeedsAttentionCard items={attentionItems} /></SafeBoundary>}

      {/* Social proof — only for employers who have never taken a plan */}
      {profileQuery.isSuccess && isNeverSubscribed(profile) && <SafeBoundary scope="dashboard.happyCustomers"><HappyCustomersCard onViewPlans={handleSubscriptionNavigate} /></SafeBoundary>}

      {/* Police Verification advertisement — self-hides unless SuperAdmin enabled it */}
      <SafeBoundary scope="dashboard.bgcPromo"><BgcPromoCard onPress={() => navigation.navigate('BgcHome')} /></SafeBoundary>

      {/* ── Nearby Workers — hidden when the employer has an active (open) requirement ── */}
      {openCount === 0 && (
      <View style={[nws.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        {/* Header */}
        <View style={nws.header}>
          <View style={nws.headerLeft}>
            <AppText style={[nws.title, { color: theme.colors.text }]} numberOfLines={1}>{t('workersNearYou')}</AppText>
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
          <TouchableOpacity accessibilityRole="button" onPress={handleWorkerSearchNavigate} activeOpacity={0.7}>
            <AppText style={nws.viewAllTxt}>{t('viewAll')}</AppText>
          </TouchableOpacity>
        </View>
        <AppText style={[nws.sub, { color: theme.colors.mutedText }]}>
          {t('verifiedWorkersIn', { location: user?.district ?? user?.state ?? t('dashYourArea') })}
        </AppText>

        {nearbyQuery.isLoading ? (
          <View style={nws.skelRow}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={nws.skelTile}>
                <Skeleton width={56} height={56} borderRadius={28} />
                <Skeleton width={64} height={11} borderRadius={6} style={{ marginTop: 8 }} />
                <Skeleton width={44} height={9} borderRadius={5} style={{ marginTop: 5 }} />
              </View>
            ))}
          </View>
        ) : displayedNearby.length === 0 ? (
          <View style={nws.emptyWrap}>
            <AppText style={[nws.emptyTxt, { color: theme.colors.mutedText }]}>{t('noWorkersNear', { location: user?.district ?? t('dashYourArea') })}</AppText>
            <TouchableOpacity accessibilityRole="button" onPress={handleWorkerSearchNavigate} style={nws.browseBtn} activeOpacity={0.8}>
              <AppText style={nws.browseBtnTxt}>{t('browseAllWorkers')}</AppText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <SafeBoundary scope="dashboard.nearbyWorkers" fallback="inline">
              <NearbyWorkersSlider
                workers={displayedNearby}
                nearbyTotal={nearbyTotal}
                onWorkerPress={handleAgentTilePress}
                onViewAll={handleWorkerSearchNavigate}
              />
            </SafeBoundary>
          </>
        )}
      </View>
      )}

      {/* ── Requirements Card — only when there's an active (open) requirement;
             when all are closed/completed (or none), show Workers Near You instead ── */}
      {(reqQuery.isLoading || openCount > 0) && (
      <View style={[reqCard.wrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>

        {/* Card header */}
        <View style={reqCard.header}>
          <View style={reqCard.headerLeft}>
            <AppText style={[reqCard.title, { color: theme.colors.text }]}>{t('newRequirements')}</AppText>
            {all.length > 0 && (
              <View style={[reqCard.countPill, { backgroundColor: theme.colors.primary + '18', borderColor: theme.colors.primary + '40' }]}>
                <AppText style={[reqCard.countPillTxt, { color: theme.colors.primary }]}>{all.length}</AppText>
              </View>
            )}
            {reqQuery.isFetching && !isRefreshing && (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            )}
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={handlePost} activeOpacity={0.8} style={[reqCard.postBtn, { backgroundColor: theme.colors.primary }]}>
            <AppText style={reqCard.postBtnTxt} numberOfLines={1}>＋ {t('postShort')}</AppText>
          </TouchableOpacity>
        </View>

        {/* Tab row — segmented pill group (Figma) */}
        <View style={[reqCard.tabRow, { backgroundColor: theme.colors.surface1 }]}>
          {REQ_TABS.map((t) => {
            const count = t.value === 'open' ? openCount : t.value === 'closed' ? closedCount : all.length;
            const active = reqTab === t.value;
            return (
              <TouchableOpacity accessibilityRole="button"
                key={t.value}
                onPress={() => setReqTab(t.value)}
                activeOpacity={0.85}
                style={[reqCard.tab, active && [reqCard.tabActive, { backgroundColor: theme.colors.card }]]}
              >
                <AppText numberOfLines={1} style={[reqCard.tabLabel, { color: active ? theme.colors.primary : theme.colors.mutedText }]}>
                  {t.label}
                </AppText>
                <View style={[reqCard.tabBadge, { backgroundColor: active ? theme.colors.primary : theme.colors.border }]}>
                  <AppText style={[reqCard.tabBadgeTxt, { color: active ? '#FFFFFF' : theme.colors.textSecondary }]}>{count}</AppText>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Carousel */}
        <RequirementCarousel
          requirements={filteredRequirements}
          onPress={handleReqCardPress}
          onClose={handleReqCardClose}
          closingId={closingId}
          isLoading={reqQuery.isLoading}
          onPost={handlePost}
          tab={reqTab}
          allCount={all.length}
          t={t}
          themeColors={theme.colors}
          canInvite={plan.inviteEnabled}
          onInvite={handleInviteReq}
          boostEnabled={boostEnabled}
          boostRemaining={boostRemaining}
          boostingId={boostingId}
          onBoost={handleBoost}
        />
      </View>
      )}

      {/* ── Hiring Pipeline strip (subscribed only) ── */}
      {isSubscribed && (
        <TouchableOpacity accessibilityRole="button"
          onPress={handlePipelineNavigate}
          activeOpacity={0.85}
          style={[pip.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
          <View style={pip.header}>
            <View style={pip.titleRow}>
              <View style={pip.titleDot} />
              <AppText style={[pip.title, { color: theme.colors.text }]} numberOfLines={2}>{t('hiringPipeline')}</AppText>
            </View>
            <View style={pip.viewAllRow}>
              <AppText style={pip.viewAll} numberOfLines={1}>{t('viewAll')}{' ›'}</AppText>
            </View>
          </View>
          <View style={pip.row}>
            {([
              { key: 'Shortlisted' as const, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', darkBg: '#1E3A8A22', darkBorder: '#3B82F655', icon: 'bookmark' as const },
              { key: 'Selected'    as const, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', darkBg: '#5B21B622', darkBorder: '#8B5CF655', icon: 'checkmark-circle' as const },
              { key: 'Joined'      as const, color: '#059669', bg: '#ECFDF5', border: '#6EE7B7', darkBg: '#06543622', darkBorder: '#34D39955', icon: 'briefcase' as const },
            ] as const).map((s) => {
              const isDark = theme.mode === 'dark';
              const cellBg = isDark ? s.darkBg : s.bg;
              const cellBorder = isDark ? s.darkBorder : s.border;
              return (
                <View key={s.key} style={[pip.cell, { backgroundColor: cellBg, borderColor: cellBorder }]}>
                  <Ionicons name={s.icon} size={17} color={s.color} style={pip.cellEmoji} />
                  <AppText style={[pip.count, { color: s.color }]}>
                    {pipelineQuery.isLoading ? '—' : String(pipelineQuery.data?.[s.key] ?? 0)}
                  </AppText>
                  <AppText style={[pip.label, { color: s.color }]}>
                    {t(s.key.toLowerCase() as 'shortlisted' | 'selected' | 'joined')}
                  </AppText>
                </View>
              );
            })}
          </View>
        </TouchableOpacity>
      )}

      {/* ── Requirement Calendar strip ── */}
      <TouchableOpacity accessibilityRole="button"
        onPress={handleCalendarNavigate}
        activeOpacity={0.85}
        style={[calStrip.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      >
        <View style={calStrip.left}>
          <View style={[calStrip.iconWrap, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="calendar" size={20} color="#2563EB" style={calStrip.icon} />
          </View>
          <View style={calStrip.text}>
            <AppText numberOfLines={2} style={[calStrip.title, { color: theme.colors.text }]}>{t('requirementCalendar')}</AppText>
            <AppText numberOfLines={2} style={[calStrip.sub, { color: theme.colors.mutedText }]}>{t('calendarSubtitle')}</AppText>
          </View>
        </View>
        <AppText style={[calStrip.arrow, { color: theme.colors.mutedText }]}>›</AppText>
      </TouchableOpacity>

      {/* ── Hiring Analytics strip ── */}
      <TouchableOpacity accessibilityRole="button"
        onPress={handleAnalyticsNavigate}
        activeOpacity={0.85}
        style={[calStrip.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      >
        <View style={calStrip.left}>
          <View style={[calStrip.iconWrap, { backgroundColor: '#F5F3FF' }]}>
            <AppText style={calStrip.icon}>📊</AppText>
          </View>
          <View style={calStrip.text}>
            <AppText numberOfLines={2} style={[calStrip.title, { color: theme.colors.text }]}>{t('pl_analyticsStripTitle')}</AppText>
            <AppText numberOfLines={2} style={[calStrip.sub, { color: theme.colors.mutedText }]}>{t('pl_analyticsStripSub')}</AppText>
          </View>
        </View>
        <AppText style={[calStrip.arrow, { color: theme.colors.mutedText }]}>›</AppText>
      </TouchableOpacity>

      {/* ── Sign Agreement strip ── */}
      <TouchableOpacity accessibilityRole="button"
        onPress={handleAgreementNavigate}
        activeOpacity={0.85}
        style={[calStrip.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      >
        <View style={calStrip.left}>
          <View style={[calStrip.iconWrap, { backgroundColor: '#FEF3C7' }]}>
            <AppText style={calStrip.icon}>📝</AppText>
          </View>
          <View style={calStrip.text}>
            <AppText numberOfLines={2} style={[calStrip.title, { color: theme.colors.text }]}>{t('ag_stripTitle')}</AppText>
            <AppText numberOfLines={2} style={[calStrip.sub, { color: theme.colors.mutedText }]}>{t('ag_stripSub')}</AppText>
          </View>
        </View>
        <AppText style={[calStrip.arrow, { color: theme.colors.mutedText }]}>›</AppText>
      </TouchableOpacity>

      {/* ── Private Workforce strip (only for employers with a linked ClientCompany —
          avoids advertising a feature this employer can't use; mirrors D1/Section 5
          of docs/workforce-management-mobile-plan.md) ── */}
      {hasWorkforceCompany && (
        <TouchableOpacity accessibilityRole="button"
          onPress={handleWorkforceNavigate}
          activeOpacity={0.85}
          style={[calStrip.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
          <View style={calStrip.left}>
            <View style={[calStrip.iconWrap, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="business" size={20} color="#059669" style={calStrip.icon} />
            </View>
            <View style={calStrip.text}>
              <AppText numberOfLines={2} style={[calStrip.title, { color: theme.colors.text }]}>{i18n.t('wf_menu_label', { ns: 'employer' })}</AppText>
              <AppText numberOfLines={2} style={[calStrip.sub, { color: theme.colors.mutedText }]}>{t('wf_dashboard_strip_sub')}</AppText>
            </View>
          </View>
          <AppText style={[calStrip.arrow, { color: theme.colors.mutedText }]}>›</AppText>
        </TouchableOpacity>
      )}

    </View>
  ), [t, theme, user, isSubscribed, handleSubscriptionNavigate, handleOpenSubModal, reqQuery.isSuccess, reqQuery.isLoading, reqQuery.isFetching, all.length, openCount, closedCount, interestedCount, handlePost, handleWorkerSearchNavigate, nearbyQuery.isLoading, nearbyQuery.isSuccess, displayedNearby, nearbyTotal, reqTab, handleAgentTilePress, isRefreshing, profileQuery.isSuccess, totalWorkersDisplay, shortlistCount, handlePipelineNavigate, handleCalendarNavigate, handleAnalyticsNavigate, handleAgreementNavigate, handleWorkforceNavigate, hasWorkforceCompany, pipelineQuery.isLoading, pipelineQuery.data, filteredRequirements, handleReqCardPress, handleReqCardClose, closingId, remainingPostsLabel, plan.inviteEnabled, handleInviteReq, freeContactsRemaining, boostEnabled, boostRemaining, boostingId, handleBoost, attentionItems, completenessFields, profilePct, navigation]);

  const renderFooter = useMemo(() => (
    <View>
      {/* ── Upgrade Banner (non-subscribers only) ── */}
      {profileQuery.isSuccess && !isSubscribed && (
        <SafeBoundary scope="dashboard.upgradeBanner"><UpgradeBanner onUpgrade={handleSubscriptionNavigate} /></SafeBoundary>
      )}

      {/* ── Support Footer ── */}
      <View style={[sf.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <AppText style={[sf.sectionLabel, { color: theme.colors.mutedText }]}>{t('support')}</AppText>
        {[
          { emoji: '🎧', title: t('needHelp'),         desc: t('supportTeamReady'),            iconBg: '#EBF1FF', iconColor: BRAND },
          { emoji: '💬', title: t('support'),           desc: config.contact.supportEmail,       iconBg: '#ECFDF5', iconColor: '#059669' },
          { emoji: '💼', title: t('businessSupport'),   desc: config.contact.businessEmail,      iconBg: '#FFF7ED', iconColor: '#D97706' },
        ].map(({ emoji, title, desc, iconBg, iconColor }, i, arr) => (
          <View key={title} style={[sf.row, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider }]}>
            <View style={[sf.iconBox, { backgroundColor: iconBg }]}>
              <AppText style={sf.iconEmoji}>{emoji}</AppText>
            </View>
            <View style={sf.text}>
              <AppText style={[sf.title, { color: theme.colors.text }]}>{title}</AppText>
              <AppText style={[sf.desc, { color: theme.colors.mutedText }]}>{desc}</AppText>
            </View>
            <AppText style={[sf.chevron, { color: theme.colors.mutedText }]}>›</AppText>
          </View>
        ))}
      </View>
    </View>
  ), [t, theme, profileQuery.isSuccess, isSubscribed, handleSubscriptionNavigate, navigation]);

  const refreshControlComponent = useMemo(() => (
    <RefreshControl refreshing={manualRefreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
  ), [manualRefreshing, handleRefresh, theme.colors.primary]);

  return (
    <>
      {/* ── Fixed Hero Header ────────────────────────────────────────────── */}
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <View style={[fh.wrap, { paddingTop: insets.top + 8 }]}>
        <View style={fh.circle1} />
        <View style={fh.circle2} />
        {/* Top brand bar — greeting + name + status replaces the wordmark */}
        <View style={fh.brandRow}>
          <View style={fh.brandLeft}>
            {/* Big two-line greeting — full first name always shows, wraps to a second line */}
            <AppText style={fh.greetName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
              {t(getGreetingKey())}, {(user?.fullName ?? 'Employer').split(' ')[0]}!
            </AppText>
          </View>
          <View style={fh.headerActions}>
            {/* Notification bell — opens the notifications page */}
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('notifications')} onPress={() => navigation.navigate('Notifications')} style={fh.shortlistBtn} activeOpacity={0.8}>
              <AppText style={fh.shortlistIcon}>🔔</AppText>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button"
              accessibilityLabel={t('helpchat_title')}
              onPress={() => navigation.navigate('EmployerHelp')}
              style={fh.shortlistBtn}
              activeOpacity={0.8}
            >
              <AppText style={fh.shortlistIcon}>💬</AppText>
              <View style={fh.shortlistDot} />
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('EditProfile')} activeOpacity={0.8} style={fh.avatarBtn}>
              <Avatar name={user?.fullName ?? 'E'} size={38} uri={buildPhotoUrl(profile?.profilePhoto)} ring ringColor="rgba(255,255,255,0.55)" />
              <View style={[fh.pctBadge, { backgroundColor: profilePct >= 90 ? '#10B981' : profilePct >= 70 ? '#3B82F6' : profilePct >= 40 ? '#F59E0B' : '#EF4444' }]}>
                <AppText style={fh.pctBadgeTxt}>{profilePct}%</AppText>
              </View>
            </TouchableOpacity>
          </View>
        </View>
        {/* Status pill intentionally removed — header kept clean & premium (greeting only) */}
      </View>

      {/* ── Subscription Upsell Modal ──────────────────────────────────── */}
      <EmployerSubscriptionModal
        visible={subModalVisible}
        onDismiss={() => setSubModalVisible(false)}
        userName={user?.fullName ?? 'Employer'}
        employerType={resolvedEmployerType}
      />

      {/* ── Scrollable Body — lifts over header with rounded top ───────── */}
      <View style={[fh.body, { backgroundColor: theme.colors.background }]}>
        {hasLoadError && (
          <TouchableOpacity accessibilityRole="button"
            onPress={handleRefresh}
            activeOpacity={0.85}
            disabled={isRefreshing}
            style={errBanner.wrap}
          >
            <AppText style={errBanner.icon}>⚠️</AppText>
            <View style={errBanner.textCol}>
              <AppText style={errBanner.msg} numberOfLines={1}>{t('dashboardLoadError', { ns: 'translation' })}</AppText>
              {!!loadErrorReason && (
                <AppText style={errBanner.reason} numberOfLines={3}>{loadErrorReason}</AppText>
              )}
            </View>
            <View style={errBanner.cta}>
              {isRefreshing
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <AppText style={errBanner.ctaTxt}>{t('retry', { ns: 'translation' })}</AppText>}
            </View>
          </TouchableOpacity>
        )}
        <FlatList
          // Fabric: clipped-subview child indices desync during scroll → ReactViewGroup.drawChild IndexOutOfBounds (Play Console crash)
          removeClippedSubviews={false}
          data={[]}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={refreshControlComponent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          renderItem={() => null}
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
              <AppText style={confirm.headerTitle}>{t('closeRequirementTitle')}</AppText>
            </View>

            {/* Body */}
            <View style={confirm.body}>
              <AppText style={[confirm.reqName, { color: theme.colors.text }]}>
                "{getWorkTypeLabel(closeTarget?.workType, tDefault as Parameters<typeof getWorkTypeLabel>[1]).replace(/\n/g, ' ')}"
              </AppText>
              <AppText style={[confirm.bodyMsg, { color: theme.colors.mutedText }]}>
                {t('closeRequirementBody')}
              </AppText>
            </View>

            {/* Actions */}
            <View style={confirm.actions}>
              <TouchableOpacity accessibilityRole="button"
                onPress={() => setCloseTarget(null)}
                style={[confirm.btn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              >
                <AppText numberOfLines={1} style={[confirm.btnTxt, { color: theme.colors.text }]}>{t('cancel')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button"
                onPress={() => {
                  if (!closeTarget) return;
                  closeMutation.mutate(closeTarget._id);
                  setCloseTarget(null);
                }}
                style={[confirm.btn, confirm.btnDanger]}
              >
                <AppText numberOfLines={1} style={[confirm.btnTxt, { color: '#fff' }]}>{t('yesCloseIt')}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Invite Workers (same-category suggestions for a requirement) ── */}
      {!!inviteReq && (
        <SuggestedWorkersModal
          visible={!!inviteReq}
          onClose={() => setInviteReq(null)}
          requirementId={inviteReq._id}
          workType={inviteReq.workType}
          reqState={inviteReq.state}
          reqDistrict={inviteReq.district}
          titleLabel={(inviteReq.workType || '').replace(/_/g, ' ')}
        />
      )}

      {/* Festival wishes popup — renders only when SuperAdmin enables Festival Mode */}
      <SafeBoundary scope="dashboard.festival">
        <FestivalWishesModal
          visible={showFestival}
          festivalImageUrl={config.promotions.festivalImageUrl}
          onClose={() => setShowFestival(false)}
        />
      </SafeBoundary>

      <PlanExpiredModal
        visible={planExpiredVisible}
        discountPct={planExpiredDiscount}
        onClose={closePlanExpired}
        onRenew={() => { closePlanExpired(); handleSubscriptionNavigate(); }}
      />

      {/* Profile-completion popup disabled for now. */}
      {/* {user && <ProfileCompletionModal user={user} />} */}


      <SafeBoundary scope="dashboard.guidedTour">
      <GuidedTour
        tourKey="employer_tour_v1"
        steps={[
          { icon: t('tour_emp_1_icon'), title: t('tour_emp_1_title'), desc: t('tour_emp_1_desc') },
          { icon: t('tour_emp_2_icon'), title: t('tour_emp_2_title'), desc: t('tour_emp_2_desc') },
          { icon: t('tour_emp_3_icon'), title: t('tour_emp_3_title'), desc: t('tour_emp_3_desc') },
          { icon: t('tour_emp_4_icon'), title: t('tour_emp_4_title'), desc: t('tour_emp_4_desc') },
          { icon: t('tour_emp_5_icon'), title: t('tour_emp_5_title'), desc: t('tour_emp_5_desc') },
        ]}
        skipLabel={t('tour_skip')}
        nextLabel={t('tour_next')}
        backLabel={t('tour_back')}
        finishLabel={t('tour_getStarted')}
        stepOfLabel={t('tour_stepOf')}
      />
      </SafeBoundary>
    </>
  );
};

const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  // Gutter (20) matches the hero header so card edges line up with the greeting;
  // generous top padding lets the first card breathe below the rounded sheet edge.
  content:  { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 44 },

  // ── Free contacts banner ────────────────────────────────────────────────────
  freeBanner:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#6EE7B7', borderRadius: 16, padding: 16, marginBottom: 20 },
  freeBannerEmoji:   { fontSize: 24 },
  freeBannerTitle:   { fontSize: 14, fontWeight: '800', color: '#137A38' },
  freeBannerSub:     { fontSize: 11.5, fontWeight: '600', color: '#0E7A3A', marginTop: 2, opacity: 0.9 },
  freeBannerChevron: { fontSize: 26, fontWeight: '800', color: '#137A38', marginLeft: 2 },

  // ── Quick Action Cards ──────────────────────────────────────────────────────
  qaRow:          { flexDirection: 'row', gap: 12, marginBottom: 20, alignItems: 'stretch' },
  qaCard:         { flex: 1, minHeight: 156, borderRadius: 20, padding: 16, overflow: 'hidden', elevation: 4, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12 },
  qaCardBlue:     { backgroundColor: '#2243BC', shadowColor: '#1B379A' },
  qaCardGreen:    { backgroundColor: '#E8F7EE', borderWidth: 1, borderColor: '#CBEBD6', shadowColor: '#16A34A', elevation: 2, shadowOpacity: 0.08 },
  qaTop:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qaIconWrap:     { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,194,75,0.22)', alignItems: 'center', justifyContent: 'center' },
  qaIconWrapGreen:{ backgroundColor: '#FFFFFF' },
  qaIcon:         { fontSize: 19, lineHeight: 23 },
  qaNewBadge:     { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  qaNewBadgeGreen:{ backgroundColor: '#FFFFFF' },
  qaNewTxt:       { fontSize: 9, fontWeight: '900', letterSpacing: 0.4, color: 'rgba(255,255,255,0.92)' },
  qaCount:        { fontSize: 25, fontWeight: '900', color: '#FFFFFF', lineHeight: 30, letterSpacing: -0.5, marginTop: 13 },
  qaCountGreen:   { color: '#065F46' },
  qaTitle:        { fontSize: 15, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2, marginTop: 4 },
  qaTitleGreen:   { color: '#0E3A22' },
  qaTitleRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  qaTitleFlex:    { flexShrink: 1 },
  qaSub:          { fontSize: 11.5, color: 'rgba(197,208,245,0.95)', lineHeight: 15, marginTop: 5, minHeight: 30 },
  qaSubGreen:     { color: '#3C7A55' },
  qaArrow:        { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  qaArrowGreen:   { backgroundColor: '#FFFFFF' },
  qaArrowTxt:     { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle:  { fontSize: 16, fontWeight: '800' },

  tabRow:    { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
  tab:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 5, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabel:  { fontWeight: '600', fontSize: 13 },
  tabBadge:  { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: 'center' },
  tabBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },

});

// ─── Nearby Workers Section Styles ────────────────────────────────────────────


// ─── Upgrade Banner Styles ─────────────────────────────────────────────────────
// ─── Support Footer Styles ─────────────────────────────────────────────────────
const sf = StyleSheet.create({
  card:         { borderRadius: 20, borderWidth: 1, padding: 4, marginTop: 8, marginBottom: 8, elevation: 2, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 },
  sectionLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  iconBox:      { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconEmoji:    { fontSize: 18 },
  text:         { flex: 1 },
  title:        { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  desc:         { fontSize: 11, lineHeight: 15, fontWeight: '500' },
  chevron:      { fontSize: 20, opacity: 0.35 },
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
  btn:         { flex: 1, minHeight: 46, paddingVertical: 6, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  btnDanger:   { backgroundColor: '#DC2626', borderColor: 'transparent', shadowColor: '#DC2626', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnTxt:      { fontSize: 14, fontWeight: '700' },
});

const errBanner = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginHorizontal: 16, marginTop: 12 },
  icon:    { fontSize: 18 },
  textCol: { flex: 1, gap: 2 },
  msg:     { fontSize: 13, fontWeight: '800', color: '#991B1B' },
  reason:  { fontSize: 11, fontWeight: '500', color: '#B91C1C', lineHeight: 15 },
  cta:     { backgroundColor: '#DC2626', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  ctaTxt:  { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
});

// ─── Subscription Upsell Banner ───────────────────────────────────────────────
const subBanner = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: BRAND, borderRadius: 14, padding: 12, marginBottom: 14 },
  iconWrap:{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  icon:    { fontSize: 18, lineHeight: 22 },
  body:    { flex: 1, gap: 1 },
  title:   { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  sub:     { fontSize: 11, color: 'rgba(255,255,255,0.72)' },
  arrow:   { fontSize: 18, color: 'rgba(255,255,255,0.8)', fontWeight: '700' },
});

// ── Subscription expired banner ────────────────────────────────────────────────
const expBanner = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF7ED', borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1.5, borderColor: '#FED7AA' },
  iconWrap:{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center' },
  icon:    { fontSize: 18, lineHeight: 22 },
  body:    { flex: 1, gap: 1 },
  title:   { fontSize: 13, fontWeight: '800', color: '#C2410C' },
  sub:     { fontSize: 11, color: '#EA580C', lineHeight: 15 },
  btn:     { backgroundColor: '#EA580C', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  btnTxt:  { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
});

// ─── Pipeline Strip Styles ─────────────────────────────────────────────────────
const calStrip = StyleSheet.create({
  card:     { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 1, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
  left:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  icon:     { fontSize: 20, lineHeight: 24 },
  text:     { flex: 1, gap: 2 },
  title:    { fontSize: 14, fontWeight: '800' },
  sub:      { fontSize: 11, fontWeight: '500' },
  arrow:    { fontSize: 22, fontWeight: '700', opacity: 0.5 },
});

const pip = StyleSheet.create({
  card:       { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14, marginBottom: 14, elevation: 2, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  titleRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
  titleDot:   { width: 5, height: 16, borderRadius: 3, backgroundColor: '#7C3AED' },
  title:      { fontSize: 15, fontWeight: '900', letterSpacing: 0.1, lineHeight: 18, flexShrink: 1 },
  // Never let the "View ›" link shrink or clip — title truncates instead.
  viewAllRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, paddingLeft: 8 },
  viewAll:    { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  row:        { flexDirection: 'row', gap: 10 },
  cell:       { flex: 1, borderRadius: 16, borderWidth: 1.5, paddingVertical: 12, alignItems: 'center', gap: 3 },
  cellEmoji:  { fontSize: 15, lineHeight: 18 },
  count:      { fontSize: 18, fontWeight: '900', lineHeight: 21 },
  label:      { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
});

const fh = StyleSheet.create({
  wrap:          { backgroundColor: BRAND, paddingHorizontal: 16, paddingBottom: 40, overflow: 'hidden' },
  circle1:       { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', width: 220, height: 220, top: -80, right: -60 },
  circle2:       { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', width: 140, height: 140, bottom: -45, left: -30 },
  // Brand bar: logo + actions + avatar
  brandRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  // minWidth:0 lets the greeting text truncate instead of pushing the action buttons (RN flexbox gotcha).
  brandLeft:         { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  brandGreet:        { flex: 1, minWidth: 0 },
  brandLogoImg:      { width: 32, height: 32, borderRadius: 7 },
  // flexShrink:0 keeps the chat + avatar at full size no matter how long the name is.
  headerActions:     { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  shortlistBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  shortlistIcon:     { fontSize: 19, lineHeight: 22 },
  // Static red notification dot on the chat bubble
  shortlistDot:      { position: 'absolute', top: 1, right: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', borderWidth: 1.5, borderColor: BRAND },
  avatarBtn:         { position: 'relative', alignItems: 'center' },
  pctBadge:          { position: 'absolute', bottom: -7, paddingHorizontal: 5, paddingVertical: 0.5, borderRadius: 999, borderWidth: 1.5, borderColor: BRAND },
  pctBadgeTxt:       { fontSize: 9, fontWeight: '800', color: '#fff', lineHeight: 12 },
  shortlistBadge:    { position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: BRAND },
  shortlistBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '900', lineHeight: 12 },
  // User + verification status
  userBar:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name:          { fontSize: 17, fontWeight: '800', color: '#fff', flex: 1 },
  pendingBadge:  { backgroundColor: '#f59e0b', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  pendingBadgeTxt:{ fontSize: 11, fontWeight: '800', color: '#fff' },
  proBadge:      { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  proBadgeTxt:   { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  // Greeting row inside the hero header
  greetNameRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  greetName:     { fontSize: 24, lineHeight: 29, fontWeight: '800', color: '#fff', letterSpacing: -0.4, flexShrink: 1 },
  greetWave:     { fontSize: 24, flexShrink: 0 },
  greetStatus:   { fontSize: 12, color: 'rgba(255,255,255,0.82)', fontWeight: '500' },
  // Verification / status pill below the greeting
  statusPillPending:  { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, marginTop: 14 },
  statusPill:         { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, marginTop: 14 },
  statusDot:          { width: 16, height: 16, borderRadius: 8, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' },
  statusDotTxt:       { color: '#fff', fontSize: 11, fontWeight: '900', lineHeight: 13 },
  statusPillTxtPending: { fontSize: 12.5, fontWeight: '700', color: '#fbbf24', flexShrink: 1 },
  statusPillTxt:      { fontSize: 12.5, fontWeight: '600', color: 'rgba(255,255,255,0.92)', flexShrink: 1 },
  // Body lifts over hero
  body:          { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -20, overflow: Platform.OS === 'android' ? 'hidden' : 'visible' },
});

// ─── Requirements Card (unified section wrapper) ──────────────────────────────
const reqCard = StyleSheet.create({
  wrap:        { borderRadius: 20, borderWidth: 1, marginBottom: 20, overflow: 'hidden', elevation: 2, shadowColor: '#142250', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16 },

  // Header row
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  title:       { flexShrink: 1, fontSize: 15, lineHeight: 20, fontWeight: '800', letterSpacing: -0.1 },
  countPill:   { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, flexShrink: 0 },
  countPillTxt:{ fontSize: 11, fontWeight: '800' },

  // Post button
  postBtn:     { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, flexShrink: 0 },
  postBtnTxt:  { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },

  // Tab row
  tabRow:      { flexDirection: 'row', borderRadius: 13, padding: 5, gap: 6, marginBottom: 14, marginHorizontal: 16 },
  tab:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 36, paddingVertical: 4, borderRadius: 9, gap: 6 },
  tabActive:   { shadowColor: '#142250', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 2 },
  tabLabel:    { fontWeight: '800', fontSize: 13, flexShrink: 1 },
  tabBadge:    { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  tabBadgeTxt: { fontSize: 11, fontWeight: '800' },
});

