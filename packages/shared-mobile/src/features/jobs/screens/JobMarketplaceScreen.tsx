import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { useAuth } from '../../../state/auth/AuthContext';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { RawRequirement } from '../../../core/api/endpoints/requirementsApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import type { MainStackParamList } from '../../../app/navigation/types';
import categoriesData from '../../../shared/data/categories.json';

type RouteProps = RouteProp<MainStackParamList, 'JobMarketplace'>;

interface CategoryEntry {
  label: string;
  value: string;
  subcategories: Array<{ label: string; value: string }>;
}

const CATEGORIES = (categoriesData as CategoryEntry[]);

// ── Work type visual mapping ──────────────────────────────────────────────────
interface WorkVisual { emoji: string; color: string; bg: string }

const WORK_TYPE_VISUALS: Record<string, WorkVisual> = {
  // snake_case values (from categories.json)
  construction_project_workers:     { emoji: '🏗️', color: '#92400E', bg: '#FEF3C7' },
  manufacturing_industrial_workers: { emoji: '⚙️', color: '#1D4ED8', bg: '#DBEAFE' },
  agriculture_farming_workers:      { emoji: '🌾', color: '#15803D', bg: '#DCFCE7' },
  event_decoration_workers:         { emoji: '🎊', color: '#7C3AED', bg: '#EDE9FE' },
  household_domestic_workers:       { emoji: '🧹', color: '#0E7490', bg: '#CFFAFE' },
  hospitality_service_workers:      { emoji: '🛎️', color: '#BE185D', bg: '#FCE7F3' },
  transport_logistics_workers:      { emoji: '🚛', color: '#1E40AF', bg: '#DBEAFE' },
  retail_shop_workers:              { emoji: '🏪', color: '#92400E', bg: '#FEF3C7' },
  skilled_technical_workers:        { emoji: '🛠️', color: '#065F46', bg: '#D1FAE5' },
  specialized_creative_workers:     { emoji: '🎨', color: '#6D28D9', bg: '#EDE9FE' },
  'Automobile & Workshop Workers':  { emoji: '🚗', color: '#374151', bg: '#F3F4F6' },
  'Healthcare Support Workers':     { emoji: '🏥', color: '#DC2626', bg: '#FEE2E2' },
  'Security & Facility Workers':    { emoji: '👮', color: '#1F2937', bg: '#F1F5F9' },
  // Label-string aliases (for legacy DB records that stored display labels)
  'Construction & Project Workers':     { emoji: '🏗️', color: '#92400E', bg: '#FEF3C7' },
  'Manufacturing & Industrial Workers': { emoji: '⚙️', color: '#1D4ED8', bg: '#DBEAFE' },
  'Agriculture & Farming Workers':      { emoji: '🌾', color: '#15803D', bg: '#DCFCE7' },
  'Event & Decoration Workers':         { emoji: '🎊', color: '#7C3AED', bg: '#EDE9FE' },
  'Household & Domestic Workers':       { emoji: '🧹', color: '#0E7490', bg: '#CFFAFE' },
  'Hospitality & Service Workers':      { emoji: '🛎️', color: '#BE185D', bg: '#FCE7F3' },
  'Transport & Logistics Workers':      { emoji: '🚛', color: '#1E40AF', bg: '#DBEAFE' },
  'Retail & Shop Workers':              { emoji: '🏪', color: '#92400E', bg: '#FEF3C7' },
  'Retail & Service Workers':           { emoji: '🏪', color: '#92400E', bg: '#FEF3C7' },
  'Skilled Technical Workers':          { emoji: '🛠️', color: '#065F46', bg: '#D1FAE5' },
  'Specialized & Creative Workers':     { emoji: '🎨', color: '#6D28D9', bg: '#EDE9FE' },
  'Security & Facility Worker':         { emoji: '👮', color: '#1F2937', bg: '#F1F5F9' },
};
const DEFAULT_VISUAL: WorkVisual = { emoji: '👷', color: '#1037A4', bg: '#EBF1FF' };

// Subcategory keyword → emoji overrides (applied on top of work-type base visual)
const SUB_EMOJI_RULES: Array<{ pattern: RegExp; emoji: string }> = [
  { pattern: /clean|sweep|maid|janitor|housekeep|sanit/i, emoji: '🧹' },
  { pattern: /cook|chef|kitchen|catering/i,               emoji: '👨‍🍳' },
  { pattern: /security|guard|watchman|bouncer/i,          emoji: '👮' },
  { pattern: /driver|chauffeur/i,                         emoji: '🚗' },
  { pattern: /electrician|electric|wiring/i,              emoji: '⚡' },
  { pattern: /plumber|plumbing/i,                         emoji: '🔧' },
  { pattern: /carpenter|woodwork|furniture/i,             emoji: '🪚' },
  { pattern: /painter|painting/i,                         emoji: '🖌️' },
  { pattern: /welder|welding/i,                           emoji: '🔥' },
  { pattern: /nurse|patient care|caregiv/i,               emoji: '👩‍⚕️' },
  { pattern: /garden|landscap/i,                          emoji: '🌿' },
  { pattern: /delivery|courier|dispatch/i,                emoji: '📦' },
  { pattern: /packer|packaging/i,                         emoji: '📦' },
  { pattern: /tailor|sewing|stitch/i,                     emoji: '🧵' },
  { pattern: /barber|salon|hair/i,                        emoji: '✂️' },
  { pattern: /loader|loading/i,                           emoji: '💪' },
];

const getVisual = (workType?: string | null, subCategory?: string | null): WorkVisual => {
  const base = (workType && WORK_TYPE_VISUALS[workType]) ? WORK_TYPE_VISUALS[workType] : DEFAULT_VISUAL;
  if (subCategory) {
    const rule = SUB_EMOJI_RULES.find(({ pattern }) => pattern.test(subCategory));
    if (rule) return { ...base, emoji: rule.emoji };
  }
  return base;
};

const getSalaryType = (req: RawRequirement): string => {
  if (req.salaryType) return req.salaryType.toLowerCase();
  return (req.minBudgetPerWorker ?? 0) >= 1500 ? 'month' : 'day';
};

const fmtDate = (d?: string): string => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const fmtLabel = (s?: string | null): string => {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const totalWorkers = (r: RawRequirement): number =>
  (r.workerQuantitySkilled ?? 0) + (r.workerQuantityUnskilled ?? 0);

// ── Requirement card ──────────────────────────────────────────────────────────
interface ReqCardProps {
  req: RawRequirement;
  isAgent: boolean;
  alreadyInterested: boolean;
  isLiked: boolean;
  onInterest: (req: RawRequirement) => void;
  onLike: (id: string) => void;
}

const ReqCard = ({ req, isAgent, alreadyInterested, isLiked, onInterest, onLike }: ReqCardProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const visual = getVisual(req.workType, req.subCategory);
  const isDark = theme.mode === 'dark';

  const hasPerks = req.accommodationAvailable || req.foodAvailable || req.transportProvided || req.bonus || req.incentive;
  const locationStr = [req.district, req.state].filter(Boolean).join(', ') || '—';
  const workers = totalWorkers(req);
  const salaryText = `₹${req.minBudgetPerWorker ?? 0}–${req.maxBudgetPerWorker ?? 0}`;
  const salaryType = getSalaryType(req);
  const jobTitle = req.subCategory ? fmtLabel(req.subCategory) : fmtLabel(req.workType);

  const handleShare = async (): Promise<void> => {
    try {
      const msg = [
        `🔔 Job Available: ${jobTitle}`,
        `📍 ${locationStr}`,
        `💰 ${salaryText} per ${salaryType}`,
        workers > 0 ? `👷 ${workers} workers needed` : null,
        hasPerks ? `✅ Benefits: ${[
          req.accommodationAvailable && '🏠 Stay',
          req.foodAvailable && '🍱 Food',
          req.transportProvided && '🚌 Transport',
          req.bonus && '🎁 Bonus',
          req.incentive && '⭐ Incentive',
        ].filter(Boolean).join(' · ')}` : null,
        req.workerNeedDate ? `📅 Start: ${fmtDate(req.workerNeedDate)}` : null,
        '',
        'Apply on BookMyWorker App',
      ].filter((l) => l !== null).join('\n');
      await Share.share({ message: msg, title: `Job: ${jobTitle}` });
    } catch {
      // user dismissed
    }
  };

  return (
    <AppCard style={styles.reqCard}>
      {/* ── Coloured banner ─────────────────────────────────── */}
      <View style={[styles.banner, { backgroundColor: isDark ? theme.colors.surface : visual.bg }]}>
        <View style={styles.bannerLeft}>
          <AppText style={styles.bannerEmoji}>{visual.emoji}</AppText>
          <View style={{ flex: 1 }}>
            <AppText style={[styles.bannerTitle, { color: isDark ? theme.colors.text : visual.color }]} numberOfLines={1}>
              {jobTitle}
            </AppText>
            {req.subCategory && (
              <AppText style={[styles.bannerSub, { color: isDark ? theme.colors.mutedText : visual.color + 'BB' }]} numberOfLines={1}>
                {fmtLabel(req.workType)}
              </AppText>
            )}
          </View>
        </View>
        <View style={[styles.salaryPill, { backgroundColor: isDark ? theme.colors.card : visual.color }]}>
          <AppText style={styles.salaryText}>{salaryText}</AppText>
          <AppText style={styles.salaryPer}>/{salaryType}</AppText>
        </View>
      </View>

      {/* ── Location + workers on one line ─────────────────── */}
      <View style={styles.metaRow}>
        <AppText style={styles.metaIcon}>📍</AppText>
        <AppText variant="caption" color={theme.colors.mutedText} numberOfLines={1} style={{ flex: 1 }}>
          {locationStr}
        </AppText>
        {workers > 0 && (
          <View style={styles.workersBadge}>
            <AppText style={styles.metaIcon}>👷</AppText>
            <AppText variant="caption" color={theme.colors.mutedText}>{workers} needed</AppText>
          </View>
        )}
      </View>

      {/* ── Perks (always visible if any) ──────────────────── */}
      {hasPerks && (
        <View style={[styles.perksRow, { borderTopColor: theme.colors.border }]}>
          {req.accommodationAvailable && <View style={[styles.perk, { backgroundColor: isDark ? theme.colors.card : '#F0FDF4' }]}><AppText style={styles.perkText}>🏠 Stay</AppText></View>}
          {req.foodAvailable && <View style={[styles.perk, { backgroundColor: isDark ? theme.colors.card : '#FFF7ED' }]}><AppText style={styles.perkText}>🍱 Food</AppText></View>}
          {req.transportProvided && <View style={[styles.perk, { backgroundColor: isDark ? theme.colors.card : '#EFF6FF' }]}><AppText style={styles.perkText}>🚌 Transport</AppText></View>}
          {req.bonus && <View style={[styles.perk, { backgroundColor: isDark ? theme.colors.card : '#FDF4FF' }]}><AppText style={styles.perkText}>🎁 Bonus</AppText></View>}
          {req.incentive && <View style={[styles.perk, { backgroundColor: isDark ? theme.colors.card : '#FFFBEB' }]}><AppText style={styles.perkText}>⭐ Incentive</AppText></View>}
        </View>
      )}

      {/* ── Details (expandable) ────────────────────────────── */}
      {expanded && (
        <View style={[styles.expandedBlock, { borderTopColor: theme.colors.border }]}>
          {[
            ['Employer', req.employerName],
            ['Start Date', fmtDate(req.workerNeedDate)],
            ['Timing', req.inTime && req.outTime ? `${req.inTime} – ${req.outTime}` : null],
            ['Work Location', req.workLocation],
            ['Remarks', req.remarks],
            req.ERN_NUMBER ? ['ERN', req.ERN_NUMBER] : null,
          ].filter((row): row is [string, string] => Boolean(row) && Boolean(row![1])).map(([k, v]) => (
            <View key={k} style={styles.detailRow}>
              <AppText variant="caption" color={theme.colors.mutedText} style={styles.detailKey}>{k}:</AppText>
              <AppText variant="caption" color={theme.colors.text} style={{ flex: 1 }} numberOfLines={2}>{v}</AppText>
            </View>
          ))}
        </View>
      )}

      {/* ── Action row ─────────────────────────────────────── */}
      <View style={[styles.actionRow, { borderTopColor: theme.colors.border }]}>
        {/* Expand toggle */}
        <TouchableOpacity
          onPress={() => setExpanded((v) => !v)}
          style={styles.detailsBtn}
          activeOpacity={0.7}
        >
          <AppText variant="caption" color={theme.colors.mutedText} style={styles.detailsBtnText}>
            {expanded ? 'Hide details ▲' : 'See details ▼'}
          </AppText>
        </TouchableOpacity>

        <View style={styles.actionBtns}>
          {/* Like button */}
          <TouchableOpacity
            onPress={() => onLike(req._id)}
            activeOpacity={0.75}
            style={[styles.iconBtn, { backgroundColor: isLiked ? '#FEE2E2' : theme.colors.card, borderColor: isLiked ? '#FCA5A5' : theme.colors.border }]}
          >
            <AppText style={styles.iconBtnText}>{isLiked ? '❤️' : '🤍'}</AppText>
          </TouchableOpacity>

          {/* Share button */}
          <TouchableOpacity
            onPress={() => { void handleShare(); }}
            style={[styles.iconBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
            activeOpacity={0.75}
          >
            <AppText style={styles.iconBtnText}>📤</AppText>
          </TouchableOpacity>

          {/* Apply button */}
          {isAgent && (
            <TouchableOpacity
              onPress={() => !alreadyInterested && onInterest(req)}
              activeOpacity={alreadyInterested ? 1 : 0.8}
              style={[styles.applyBtn, { backgroundColor: alreadyInterested ? '#10B981' : visual.color }]}
            >
              <AppText style={styles.applyBtnText}>
                {alreadyInterested ? 'Applied ✓' : 'Apply Now'}
              </AppText>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </AppCard>
  );
};

// ── Wage modal ────────────────────────────────────────────────────────────────
interface WageModalProps {
  visible: boolean;
  req: RawRequirement | null;
  onClose: () => void;
  onSubmit: (reqId: string, wage: number) => void;
  loading: boolean;
}

const WageModal = ({ visible, req, onClose, onSubmit, loading }: WageModalProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const [wage, setWage] = useState('');
  const visual = getVisual(req?.workType, req?.subCategory);

  useEffect(() => { if (visible) setWage(''); }, [visible]);

  const minWage = req?.minBudgetPerWorker ?? 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.modalBox, { backgroundColor: theme.colors.surface }]}>
          {/* Job banner inside modal */}
          <View style={[styles.modalBanner, { backgroundColor: visual.bg }]}>
            <AppText style={styles.modalBannerEmoji}>{visual.emoji}</AppText>
            <View style={{ flex: 1 }}>
              <AppText style={[styles.modalBannerTitle, { color: visual.color }]} numberOfLines={1}>
                {req?.subCategory ? fmtLabel(req.subCategory) : fmtLabel(req?.workType)}
              </AppText>
              <AppText variant="caption" style={{ color: visual.color + '99' }}>
                {req?.district ?? ''} · ₹{minWage}+ per {req ? getSalaryType(req) : 'day'}
              </AppText>
            </View>
          </View>

          <AppText variant="caption" color={theme.colors.mutedText} style={[styles.fieldLabel, { marginTop: 16 }]}>
            Your Required Wage per Worker/Day (min ₹{minWage})
          </AppText>
          <TextInput
            value={wage}
            onChangeText={setWage}
            keyboardType="numeric"
            placeholder={`Enter amount (≥ ₹${minWage})`}
            placeholderTextColor={theme.colors.mutedText}
            style={[styles.wageInput, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]}
          />

          <View style={styles.modalActions}>
            <AppButton title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <AppButton
              title="Submit Application"
              loading={loading}
              onPress={() => {
                const n = Number(wage);
                if (!n || n < minWage) {
                  Alert.alert('Invalid Wage', `Minimum wage is ₹${minWage}`);
                  return;
                }
                if (req?._id) onSubmit(req._id, n);
              }}
              style={{ flex: 1 }}
            />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export const JobMarketplaceScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state: authState } = useAuth();
  const queryClient = useQueryClient();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();

  const user = authState.session?.user;
  const role = user?.role ?? 'worker';
  const isAgent = role === 'agent' || role === 'selfworker' || role === 'worker';

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(route.params?.workType ?? '');
  const [selectedSubCat, setSelectedSubCat] = useState<string>(route.params?.subCategory ?? '');
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const showMyInterests = route.params?.myInterests === true;
  const showLikedOnly = route.params?.likedOnly === true;

  // Debounce search
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (text: string): void => {
    setSearch(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(text);
    }, 500);
  };

  // Subcategories for selected category
  const subCategories = useMemo(() => {
    if (!selectedCategory) return [];
    const cat = CATEGORIES.find((c) => c.value === selectedCategory);
    return cat?.subcategories ?? [];
  }, [selectedCategory]);

  // ── Liked-only mode: flat query ─────────────────────────────────────────────
  const likedQuery = useInfiniteQuery({
    queryKey: ['requirements-liked', user?.id],
    queryFn: ({ pageParam = 1 }) => requirementsApi.getLiked(pageParam as number, 50),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { currentPage, totalPages } = lastPage.pagination;
      return currentPage < totalPages ? currentPage + 1 : undefined;
    },
    staleTime: 30_000,
    enabled: showLikedOnly,
  });

  const {
    data,
    isLoading: allLoading,
    isError: allError,
    refetch: allRefetch,
    isFetching: allFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['requirements-role', role, user?.id, selectedCategory, selectedSubCat, debouncedSearch, showMyInterests],
    queryFn: ({ pageParam = 1 }) => requirementsApi.listForRole({
      role,
      userId: user?.id,
      workType: selectedCategory || undefined,
      subCategory: selectedSubCat || undefined,
      search: debouncedSearch || undefined,
      myInterests: showMyInterests || undefined,
      page: pageParam as number,
      limit: 50,
    }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { currentPage, totalPages } = lastPage.pagination;
      return currentPage < totalPages ? currentPage + 1 : undefined;
    },
    staleTime: 30_000,
    enabled: !showLikedOnly,
  });

  // Resolve active query based on mode
  const isLoading = showLikedOnly ? likedQuery.isLoading : allLoading;
  const isError   = showLikedOnly ? likedQuery.isError   : allError;
  const isFetching = showLikedOnly ? likedQuery.isFetching : allFetching;
  const refetch = showLikedOnly ? likedQuery.refetch : allRefetch;

  const requirements: RawRequirement[] = useMemo(() => {
    const src = showLikedOnly ? likedQuery.data : data;
    return src?.pages.flatMap((p) => p.requirements) ?? [];
  }, [showLikedOnly, likedQuery.data, data]);

  const totalCount = showLikedOnly
    ? (likedQuery.data?.pages[0]?.pagination.totalCount ?? 0)
    : (data?.pages[0]?.pagination.totalCount ?? 0);

  // Track interested requirements (optimistic)
  const [interestedIds, setInterestedIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [wageModalReq, setWageModalReq] = useState<RawRequirement | null>(null);

  // Seed liked IDs from server data (likedBy field on each requirement)
  useEffect(() => {
    if (!user?.id) return;
    setLikedIds((prev) => {
      const next = new Set(prev);
      requirements.forEach((r) => {
        if (r.likedBy?.includes(user.id)) next.add(r._id);
      });
      return next;
    });
  }, [requirements, user?.id]);

  // Like mutation — optimistic with rollback
  const likeMutation = useMutation({
    mutationFn: (reqId: string) => requirementsApi.toggleLike(reqId),
    onMutate: (reqId) => {
      setLikedIds((prev) => {
        const next = new Set(prev);
        next.has(reqId) ? next.delete(reqId) : next.add(reqId);
        return next;
      });
    },
    onError: (_, reqId) => {
      setLikedIds((prev) => {
        const next = new Set(prev);
        next.has(reqId) ? next.delete(reqId) : next.add(reqId);
        return next;
      });
    },
  });

  const handleLike = useCallback((id: string): void => { likeMutation.mutate(id); }, [likeMutation]);

  const interestMutation = useMutation({
    mutationFn: ({ reqId, wage }: { reqId: string; wage: number }) =>
      requirementsApi.expressInterestWithWage(reqId, wage),
    onSuccess: (_, { reqId }) => {
      setInterestedIds((prev) => new Set([...prev, reqId]));
      setWageModalReq(null);
      void queryClient.invalidateQueries({ queryKey: ['requirements-role'] });
      Alert.alert('Applied! 🎉', 'Your application was submitted successfully.');
    },
    onError: () => Alert.alert('Error', 'Could not submit application. Please try again.'),
  });

  const handleInterest = useCallback((req: RawRequirement): void => {
    setWageModalReq(req);
  }, []);

  const isInterested = (req: RawRequirement): boolean =>
    interestedIds.has(req._id) ||
    Boolean(req.intrestedAgents?.some((a) => a.agentId === user?.id));

  const handleCategorySelect = (value: string): void => {
    const next = selectedCategory === value ? '' : value;
    setSelectedCategory(next);
    setSelectedSubCat('');
  };

  if (isLoading) return <LoadingState message="Loading jobs…" />;
  if (isError) return <ErrorState title="Unable to Load Jobs" message="Could not fetch jobs. Please check your connection and try again." onRetry={() => void refetch()} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader
        title={
          showLikedOnly ? 'Liked Jobs ❤️' :
          showMyInterests ? 'My Applications' :
          selectedCategory ? (CATEGORIES.find((c) => c.value === selectedCategory)?.label?.replace(/ Workers?$/, '').trim() ?? selectedCategory) :
          'Find Work Near You'
        }
        onBack={() => navigation.goBack()}
      />
      {/* Search bar + Filter button */}
      <View style={[styles.searchRow, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <AppText variant="body" style={styles.searchIcon}>🔍</AppText>
          <TextInput
            value={search}
            onChangeText={handleSearchChange}
            placeholder="Search work type, location…"
            placeholderTextColor={theme.colors.mutedText}
            style={[styles.searchInput, { color: theme.colors.text }]}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setDebouncedSearch(''); }}>
              <AppText variant="caption" color={theme.colors.mutedText}>✕</AppText>
            </TouchableOpacity>
          )}
        </View>
        {!showLikedOnly && (
          <TouchableOpacity
            onPress={() => setFilterSheetVisible(true)}
            style={[styles.filterIconBtn, {
              backgroundColor: (selectedCategory || selectedSubCat) ? theme.colors.primary : theme.colors.card,
              borderColor: (selectedCategory || selectedSubCat) ? theme.colors.primary : theme.colors.border,
            }]}
            activeOpacity={0.8}
          >
            <AppText style={styles.filterIconText}>⚙️</AppText>
            {(selectedCategory || selectedSubCat) && <View style={styles.filterActiveDot} />}
          </TouchableOpacity>
        )}
      </View>

      {/* Active filter chips summary */}
      {!showLikedOnly && (selectedCategory || selectedSubCat) && (
        <View style={[styles.activeFiltersRow, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          {selectedCategory && (
            <View style={[styles.activeChip, { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary }]}>
              <AppText style={[styles.activeChipText, { color: theme.colors.primary }]}>
                {(WORK_TYPE_VISUALS[selectedCategory] ?? DEFAULT_VISUAL).emoji} {CATEGORIES.find(c => c.value === selectedCategory)?.label?.replace(/ Workers?$/, '') ?? selectedCategory}
              </AppText>
              <TouchableOpacity onPress={() => { setSelectedCategory(''); setSelectedSubCat(''); }} hitSlop={8}>
                <AppText style={[styles.activeChipX, { color: theme.colors.primary }]}>✕</AppText>
              </TouchableOpacity>
            </View>
          )}
          {selectedSubCat && (
            <View style={[styles.activeChip, { backgroundColor: '#EDE9FE', borderColor: '#6366F1' }]}>
              <AppText style={[styles.activeChipText, { color: '#6366F1' }]}>
                {subCategories.find(s => s.value === selectedSubCat)?.label ?? selectedSubCat}
              </AppText>
              <TouchableOpacity onPress={() => setSelectedSubCat('')} hitSlop={8}>
                <AppText style={[styles.activeChipX, { color: '#6366F1' }]}>✕</AppText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Result count */}
      <View style={styles.resultHeader}>
        <AppText variant="caption" color={theme.colors.mutedText}>
          {totalCount > 0 ? `${totalCount} jobs found` : `${requirements.length} jobs found`}
        </AppText>
        {isFetching && !isFetchingNextPage && !likedQuery.isFetchingNextPage && <ActivityIndicator size="small" color={theme.colors.primary} />}
      </View>

      {/* Job list */}
      {requirements.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            title={showLikedOnly ? 'No liked jobs yet' : 'No jobs found'}
            message={
              showLikedOnly
                ? 'Tap ❤️ on any job to save it here.'
                : selectedCategory
                  ? 'No open jobs for this work type in your area.'
                  : 'No open jobs at the moment. Check back soon!'
            }
          />
        </View>
      ) : (
        <FlatList
          data={requirements}
          keyExtractor={(item, i) => item._id || String(i)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading && !isFetchingNextPage} onRefresh={() => void refetch()} />}
          onEndReached={() => {
            if (showLikedOnly) {
              if (likedQuery.hasNextPage && !likedQuery.isFetchingNextPage) void likedQuery.fetchNextPage();
            } else {
              if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.3}
          renderItem={({ item }) => (
            <ReqCard
              req={item}
              isAgent={isAgent}
              alreadyInterested={isInterested(item)}
              isLiked={likedIds.has(item._id)}
              onInterest={handleInterest}
              onLike={handleLike}
            />
          )}
          ListFooterComponent={
            (isFetchingNextPage || likedQuery.isFetchingNextPage) ? (
              <View style={styles.loadMore}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : null
          }
        />
      )}

      {/* Filter bottom sheet */}
      <Modal
        visible={filterSheetVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterSheetVisible(false)}
      >
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setFilterSheetVisible(false)} />
        <View style={[styles.sheetContainer, { backgroundColor: theme.colors.surface }]}>
          {/* Handle */}
          <View style={[styles.sheetHandle, { backgroundColor: theme.colors.border }]} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <AppText style={[styles.sheetTitle, { color: theme.colors.text }]}>Filter Jobs</AppText>
            {(selectedCategory || selectedSubCat) && (
              <TouchableOpacity onPress={() => { setSelectedCategory(''); setSelectedSubCat(''); }}>
                <AppText style={styles.sheetClear}>Clear All</AppText>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {/* Work Category */}
            <AppText style={[styles.sheetSection, { color: theme.colors.mutedText }]}>WORK CATEGORY</AppText>
            <TouchableOpacity
              onPress={() => { setSelectedCategory(''); setSelectedSubCat(''); }}
              style={[styles.sheetRow, { borderBottomColor: theme.colors.divider }]}
            >
              <AppText style={styles.sheetRowEmoji}>🔍</AppText>
              <AppText style={[styles.sheetRowLabel, { color: theme.colors.text }]}>All Categories</AppText>
              {!selectedCategory && <AppText style={styles.sheetRowCheck}>✓</AppText>}
            </TouchableOpacity>
            {CATEGORIES.map((cat) => {
              const v = WORK_TYPE_VISUALS[cat.value] ?? DEFAULT_VISUAL;
              const active = selectedCategory === cat.value;
              return (
                <TouchableOpacity
                  key={cat.value}
                  onPress={() => { setSelectedCategory(active ? '' : cat.value); setSelectedSubCat(''); }}
                  style={[styles.sheetRow, { borderBottomColor: theme.colors.divider, backgroundColor: active ? theme.colors.primaryLight : 'transparent' }]}
                >
                  <AppText style={styles.sheetRowEmoji}>{v.emoji}</AppText>
                  <AppText style={[styles.sheetRowLabel, { color: active ? theme.colors.primary : theme.colors.text, fontWeight: active ? '700' : '500' }]}>
                    {cat.label.replace(/ Workers?$/, '')}
                  </AppText>
                  {active && <AppText style={styles.sheetRowCheck}>✓</AppText>}
                </TouchableOpacity>
              );
            })}

            {/* Sub-category */}
            {subCategories.length > 0 && (
              <>
                <AppText style={[styles.sheetSection, { color: theme.colors.mutedText, marginTop: 16 }]}>SUB CATEGORY</AppText>
                <TouchableOpacity
                  onPress={() => setSelectedSubCat('')}
                  style={[styles.sheetRow, { borderBottomColor: theme.colors.divider }]}
                >
                  <AppText style={[styles.sheetRowLabel, { color: theme.colors.text }]}>All Sub-categories</AppText>
                  {!selectedSubCat && <AppText style={styles.sheetRowCheck}>✓</AppText>}
                </TouchableOpacity>
                {subCategories.map((sc) => {
                  const active = selectedSubCat === sc.value;
                  return (
                    <TouchableOpacity
                      key={sc.value}
                      onPress={() => setSelectedSubCat(active ? '' : sc.value)}
                      style={[styles.sheetRow, { borderBottomColor: theme.colors.divider, backgroundColor: active ? '#EDE9FE' : 'transparent' }]}
                    >
                      <AppText style={[styles.sheetRowLabel, { color: active ? '#6366F1' : theme.colors.text, fontWeight: active ? '700' : '500' }]}>
                        {sc.label}
                      </AppText>
                      {active && <AppText style={[styles.sheetRowCheck, { color: '#6366F1' }]}>✓</AppText>}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={[styles.sheetFooter, { borderTopColor: theme.colors.border }]}>
            <AppButton title="Apply Filters" onPress={() => setFilterSheetVisible(false)} fullWidth />
          </View>
        </View>
      </Modal>

      {/* Wage modal */}
      <WageModal
        visible={Boolean(wageModalReq)}
        req={wageModalReq}
        onClose={() => setWageModalReq(null)}
        onSubmit={(reqId, wage) => interestMutation.mutate({ reqId, wage })}
        loading={interestMutation.isPending}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },

  // Filter button in search row
  filterIconBtn: {
    width: 44, height: 44, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  filterIconText: { fontSize: 18, lineHeight: 22 },
  filterActiveDot: {
    position: 'absolute', top: 6, right: 6,
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444',
  },

  // Active filter summary row
  activeFiltersRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  activeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 999, borderWidth: 1.5,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  activeChipText: { fontSize: 12, fontWeight: '700' },
  activeChipX: { fontSize: 11, fontWeight: '800' },

  // Filter bottom sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetContainer: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%', overflow: 'hidden',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800' },
  sheetClear: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  sheetBody: { paddingHorizontal: 0 },
  sheetSection: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
  },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetRowEmoji: { fontSize: 20, lineHeight: 24, width: 28, textAlign: 'center' },
  sheetRowLabel: { flex: 1, fontSize: 14 },
  sheetRowCheck: { fontSize: 16, fontWeight: '800', color: '#1037A4' },
  sheetFooter: {
    padding: 16, borderTopWidth: StyleSheet.hairlineWidth,
  },

  // Result header
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },

  // List
  list: { padding: 12, paddingBottom: 40 },

  // Card
  reqCard: { padding: 0, marginBottom: 12, overflow: 'hidden', borderRadius: 16 },

  // Banner
  banner: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  bannerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerEmoji: { fontSize: 36, lineHeight: 44 },
  bannerTitle: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  bannerSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  salaryPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  salaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', lineHeight: 17 },
  salaryPer: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '500', lineHeight: 13 },

  // Meta row — location + workers always on same line
  metaRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  metaIcon: { fontSize: 12, lineHeight: 16, flexShrink: 0 },
  workersBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },

  // Perks
  perksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingBottom: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  perk: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  perkText: { fontSize: 11, fontWeight: '600', color: '#374151' },

  // Expanded
  expandedBlock: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  detailRow: { flexDirection: 'row', gap: 6 },
  detailKey: { minWidth: 90, fontWeight: '600', fontSize: 12 },

  // Action row
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  detailsBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  detailsBtnText: { fontSize: 11, fontWeight: '600' },
  actionBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 16, lineHeight: 20 },
  applyBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  applyBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  // Load more
  loadMore: { paddingVertical: 20, alignItems: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  modalBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, gap: 12, marginBottom: 4 },
  modalBannerEmoji: { fontSize: 30, lineHeight: 38 },
  modalBannerTitle: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  fieldLabel: { marginBottom: 6, fontWeight: '600' },
  wageInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 10 },
});
