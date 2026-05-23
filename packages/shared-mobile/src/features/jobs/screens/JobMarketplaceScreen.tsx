import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { useAuth } from '../../../state/auth/AuthContext';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { RawRequirement } from '../../../core/api/endpoints/requirementsApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { Badge } from '../../../shared/components/ui/Badge';
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
  onInterest: (req: RawRequirement) => void;
}

const ReqCard = ({ req, isAgent, alreadyInterested, onInterest }: ReqCardProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <AppCard style={styles.reqCard}>
      <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.8}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="label" numberOfLines={1}>
              {fmtLabel(req.workType)}{req.subCategory ? ` · ${fmtLabel(req.subCategory)}` : ''}
            </AppText>
            <AppText variant="caption" color={theme.colors.mutedText}>
              {[req.district, req.state].filter(Boolean).join(', ') || '—'}
            </AppText>
          </View>
          <Badge label="Approved" variant="success" />
        </View>

        {/* Key info chips */}
        <View style={styles.infoRow}>
          <View style={[styles.infoChip, { backgroundColor: theme.colors.primary + '15' }]}>
            <AppText variant="caption" color={theme.colors.primary} style={styles.infoChipText}>
              ₹{req.minBudgetPerWorker ?? 0}–{req.maxBudgetPerWorker ?? 0}/{(req as any).salaryType?.toLowerCase() ?? 'day'}
            </AppText>
          </View>
          <View style={[styles.infoChip, { backgroundColor: '#10B98115' }]}>
            <AppText variant="caption" color="#10B981" style={styles.infoChipText}>
              {totalWorkers(req)} workers
            </AppText>
          </View>
          {req.ERN_NUMBER && (
            <View style={[styles.infoChip, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 }]}>
              <AppText variant="caption" color={theme.colors.mutedText} style={styles.infoChipText}>
                ERN: {req.ERN_NUMBER}
              </AppText>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Expanded details */}
      {expanded && (
        <View style={[styles.expandedBlock, { borderTopColor: theme.colors.border }]}>
          {[
            ['Employer', req.employerName],
            ['Need Date', fmtDate(req.workerNeedDate)],
            ['Timing', req.inTime && req.outTime ? `${req.inTime} – ${req.outTime}` : null],
            ['Work Location', req.workLocation],
            ['Remarks', req.remarks],
          ].filter(([, v]) => Boolean(v)).map(([k, v]) => (
            <View key={k as string} style={styles.detailRow}>
              <AppText variant="caption" color={theme.colors.mutedText} style={styles.detailKey}>{k}:</AppText>
              <AppText variant="caption" color={theme.colors.text} style={{ flex: 1 }} numberOfLines={2}>{v as string}</AppText>
            </View>
          ))}

          {/* Perks */}
          <View style={styles.perksRow}>
            {req.accommodationAvailable && <View style={styles.perk}><AppText variant="caption" color={theme.colors.primary} style={styles.perkText}>🏠 Stay</AppText></View>}
            {req.foodAvailable && <View style={styles.perk}><AppText variant="caption" color={theme.colors.primary} style={styles.perkText}>🍱 Food</AppText></View>}
            {req.transportProvided && <View style={styles.perk}><AppText variant="caption" color={theme.colors.primary} style={styles.perkText}>🚌 Transport</AppText></View>}
            {req.bonus && <View style={styles.perk}><AppText variant="caption" color={theme.colors.primary} style={styles.perkText}>🎁 Bonus</AppText></View>}
            {req.incentive && <View style={styles.perk}><AppText variant="caption" color={theme.colors.primary} style={styles.perkText}>⭐ Incentive</AppText></View>}
          </View>

          {isAgent && (
            <AppButton
              title={alreadyInterested ? 'Interest Shown ✓' : 'Express Interest'}
              onPress={() => !alreadyInterested && onInterest(req)}
              variant={alreadyInterested ? 'secondary' : 'primary'}
              style={styles.interestBtn}
            />
          )}
        </View>
      )}
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

  useEffect(() => { if (visible) setWage(''); }, [visible]);

  const minWage = req?.minBudgetPerWorker ?? 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.modalBox, { backgroundColor: theme.colors.surface }]}>
          <AppText variant="subtitle" style={styles.modalTitle}>Express Interest</AppText>
          <AppText variant="caption" color={theme.colors.mutedText} style={{ marginBottom: 14 }}>
            {fmtLabel(req?.workType)}{req?.subCategory ? ` · ${fmtLabel(req.subCategory)}` : ''} · {req?.district ?? ''}
          </AppText>

          <AppText variant="caption" color={theme.colors.mutedText} style={styles.fieldLabel}>
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
              title="Submit"
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

  const user = authState.session?.user;
  const role = user?.role ?? 'worker';
  const isAgent = role === 'agent' || role === 'selfworker' || role === 'worker';

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(route.params?.workType ?? '');
  const [selectedSubCat, setSelectedSubCat] = useState<string>(route.params?.subCategory ?? '');
  const showMyInterests = route.params?.myInterests === true;

  // Debounce search
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (text: string): void => {
    setSearch(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(text);
    }, 500);
  };

  // Subcategories for selected category (selectedCategory is now a value, not label)
  const subCategories = useMemo(() => {
    if (!selectedCategory) return [];
    const cat = CATEGORIES.find((c) => c.value === selectedCategory);
    return cat?.subcategories ?? [];
  }, [selectedCategory]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['requirements-role', role, user?.id, selectedCategory, selectedSubCat, debouncedSearch, showMyInterests],
    queryFn: ({ pageParam = 1 }) => requirementsApi.listForRole({
      role,
      userId: user?.id,
      // selectedCategory is now the category value (e.g. "construction_project_workers")
      // which matches exactly what CategorySelector stores in the DB
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
  });

  const requirements: RawRequirement[] = useMemo(
    () => data?.pages.flatMap((p) => p.requirements) ?? [],
    [data],
  );
  const totalCount = data?.pages[0]?.pagination.totalCount ?? 0;

  // Track interested requirements locally (optimistic)
  const [interestedIds, setInterestedIds] = useState<Set<string>>(new Set());
  const [wageModalReq, setWageModalReq] = useState<RawRequirement | null>(null);

  const interestMutation = useMutation({
    mutationFn: ({ reqId, wage }: { reqId: string; wage: number }) =>
      requirementsApi.expressInterestWithWage(reqId, wage),
    onSuccess: (_, { reqId }) => {
      setInterestedIds((prev) => new Set([...prev, reqId]));
      setWageModalReq(null);
      void queryClient.invalidateQueries({ queryKey: ['requirements-role'] });
      Alert.alert('Success', 'Interest expressed successfully!');
    },
    onError: () => Alert.alert('Error', 'Could not express interest. Please try again.'),
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

  if (isLoading) return <LoadingState message="Loading requirements…" />;
  if (isError) return <ErrorState title="Unable to Load Requirements" message="Could not fetch job requirements. Please check your connection and try again." onRetry={() => void refetch()} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title={showMyInterests ? 'My Interests' : selectedCategory ? (CATEGORIES.find((c) => c.value === selectedCategory)?.label?.replace(/ Workers?$/, '').trim() ?? selectedCategory) : 'Job Marketplace'} />
      {/* Search bar */}
      <View style={[styles.searchRow, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <AppText variant="body" style={styles.searchIcon}>🔍</AppText>
          <TextInput
            value={search}
            onChangeText={handleSearchChange}
            placeholder="Search work type, sub-category, district, state…"
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
      </View>

      {/* Work Type (category) filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterBar, { borderBottomColor: theme.colors.border }]}
        contentContainerStyle={styles.filterBarContent}
      >
        <TouchableOpacity
          onPress={() => handleCategorySelect('')}
          style={[styles.filterChip, {
            backgroundColor: !selectedCategory ? theme.colors.primary : theme.colors.card,
            borderColor: !selectedCategory ? theme.colors.primary : theme.colors.border,
          }]}
        >
          <AppText variant="caption" color={!selectedCategory ? '#FFF' : theme.colors.text} style={styles.chipText}>All</AppText>
        </TouchableOpacity>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            onPress={() => handleCategorySelect(cat.value)}
            style={[styles.filterChip, {
              backgroundColor: selectedCategory === cat.value ? theme.colors.primary : theme.colors.card,
              borderColor: selectedCategory === cat.value ? theme.colors.primary : theme.colors.border,
            }]}
          >
            <AppText
              variant="caption"
              color={selectedCategory === cat.value ? '#FFF' : theme.colors.text}
              style={styles.chipText}
              numberOfLines={1}
            >
              {cat.label.replace(' Workers', '').replace(' Worker', '')}
            </AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* SubCategory filter — shown when a category is selected */}
      {subCategories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.filterBar, { borderBottomColor: theme.colors.border }]}
          contentContainerStyle={styles.filterBarContent}
        >
          <TouchableOpacity
            onPress={() => { setSelectedSubCat(''); }}
            style={[styles.filterChip, styles.subChip, {
              backgroundColor: !selectedSubCat ? '#6366F1' : theme.colors.card,
              borderColor: !selectedSubCat ? '#6366F1' : theme.colors.border,
            }]}
          >
            <AppText variant="caption" color={!selectedSubCat ? '#FFF' : theme.colors.text} style={styles.chipText}>All Sub</AppText>
          </TouchableOpacity>
          {subCategories.map((sc) => (
            <TouchableOpacity
              key={sc.value}
              onPress={() => { setSelectedSubCat(sc.value); }}
              style={[styles.filterChip, styles.subChip, {
                backgroundColor: selectedSubCat === sc.value ? '#6366F1' : theme.colors.card,
                borderColor: selectedSubCat === sc.value ? '#6366F1' : theme.colors.border,
              }]}
            >
              <AppText variant="caption" color={selectedSubCat === sc.value ? '#FFF' : theme.colors.text} style={styles.chipText} numberOfLines={1}>
                {sc.label}
              </AppText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Result count + refresh indicator */}
      <View style={styles.resultHeader}>
        <AppText variant="caption" color={theme.colors.mutedText}>
          {totalCount > 0 ? `${totalCount} requirements found` : `${requirements.length} requirements found`}
        </AppText>
        {isFetching && !isFetchingNextPage && <ActivityIndicator size="small" color={theme.colors.primary} />}
      </View>

      {/* Requirements list */}
      {requirements.length === 0 ? (
        <EmptyState
          title="No requirements found"
          message={selectedCategory ? `No open work for "${selectedCategory}" in your area.` : 'No open requirements at the moment.'}
        />
      ) : (
        <FlatList
          data={requirements}
          keyExtractor={(item, i) => item._id || String(i)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading && !isFetchingNextPage} onRefresh={() => void refetch()} />}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) void fetchNextPage(); }}
          onEndReachedThreshold={0.3}
          renderItem={({ item }) => (
            <ReqCard
              req={item}
              isAgent={isAgent}
              alreadyInterested={isInterested(item)}
              onInterest={handleInterest}
            />
          )}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.loadMore}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : null
          }
        />
      )}

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
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBox: {
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
  filterBar: { maxHeight: 50, borderBottomWidth: StyleSheet.hairlineWidth },
  filterBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  filterChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 5, height: 32, justifyContent: 'center' },
  subChip: { paddingHorizontal: 10 },
  chipText: { fontWeight: '600', fontSize: 12 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  list: { padding: 12, paddingBottom: 40 },
  reqCard: { padding: 0, marginBottom: 10, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 10 },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingBottom: 12 },
  infoChip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  infoChipText: { fontWeight: '600', fontSize: 11 },
  expandedBlock: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  detailRow: { flexDirection: 'row', gap: 6 },
  detailKey: { minWidth: 95, fontWeight: '600', fontSize: 12 },
  perksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  perk: { borderRadius: 6, backgroundColor: '#6366F115', paddingHorizontal: 8, paddingVertical: 4 },
  perkText: { fontSize: 11, fontWeight: '600' },
  interestBtn: { marginTop: 8 },
  loadMore: { paddingVertical: 20, alignItems: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  modalTitle: { marginBottom: 4 },
  fieldLabel: { marginBottom: 6, fontWeight: '600' },
  wageInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 10 },
});
