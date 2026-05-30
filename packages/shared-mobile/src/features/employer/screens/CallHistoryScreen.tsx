import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../../shared/components/ui/AppText';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useAppTheme } from '../../../core/theme';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../../core/api/client';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'CallHistory'>;

// ── Types ─────────────────────────────────────────────────────────────────────
interface CallHistoryEntry {
  workerId: string;
  status: 'not_picked' | 'switched_off' | 'not_interested' | 'wrong_number' | 'call_later' | 'relevant';
  lastContactedAt: string;
  updatedAt: string;
  workerName: string;
  workerPhone: string;
  workerState: string;
  workerDistrict: string;
  workerBlock: string;
  workerSkills: string[];
  workerVerified: boolean;
  dailyRate: number | null;
}

// ── Status meta ───────────────────────────────────────────────────────────────
// STATUS_META labels are built dynamically with t() inside components that need them

// ── Constants ─────────────────────────────────────────────────────────────────
const BRAND = '#1037A4';
const NAVY  = '#0F172A';
const SLATE = '#64748B';
const WHITE = '#FFFFFF';
const BORDER= '#E2E8F0';
const GREEN = '#059669';

const AVATAR_PALETTES = [
  { bg: '#EBF1FF', text: '#1A56DB' },
  { bg: '#F5F3FF', text: '#7C3AED' },
  { bg: '#ECFDF5', text: GREEN },
  { bg: '#FFF7ED', text: '#EA580C' },
  { bg: '#FEF2F2', text: '#DC2626' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatRelative(dateStr: string): string {
  const now  = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatSkills(skills: string[]): string {
  return skills
    .slice(0, 3)
    .map((s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(', ');
}

// FILTER_OPTIONS labels are built dynamically with t() inside the screen component
const FILTER_KEYS = ['all', 'relevant', 'call_later', 'not_picked', 'not_interested'] as const;

type FilterKey = typeof FILTER_KEYS[number];

// ── Worker Card ───────────────────────────────────────────────────────────────
function WorkerCard({
  entry,
  idx,
  onPress,
}: {
  entry: CallHistoryEntry;
  idx: number;
  onPress: () => void;
}): React.JSX.Element {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const palette = AVATAR_PALETTES[idx % AVATAR_PALETTES.length]!;
  const STATUS_META_T: Record<CallHistoryEntry['status'], { label: string; color: string; bg: string; emoji: string }> = {
    relevant:       { label: t('callStatusRelevant'),      color: '#059669', bg: '#ECFDF5', emoji: '✅' },
    call_later:     { label: t('callStatusCallLater'),     color: '#D97706', bg: '#FFFBEB', emoji: '🔔' },
    not_picked:     { label: t('callStatusNotPicked'),     color: '#64748B', bg: '#F1F5F9', emoji: '📵' },
    switched_off:   { label: t('callStatusSwitchedOff'),   color: '#64748B', bg: '#F1F5F9', emoji: '📴' },
    not_interested: { label: t('callStatusNotInterested'), color: '#DC2626', bg: '#FEF2F2', emoji: '❌' },
    wrong_number:   { label: t('callStatusWrongNumber'),   color: '#DC2626', bg: '#FEF2F2', emoji: '🚫' },
  };
  const meta = STATUS_META_T[entry.status] ?? STATUS_META_T.not_picked;

  const initials = (entry.workerName || 'W')
    .split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();

  const location = [entry.workerDistrict, entry.workerState]
    .filter(Boolean).join(', ');

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[wc.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      activeOpacity={0.88}
    >
      {/* Left accent bar based on status */}
      <View style={[wc.accent, { backgroundColor: meta.color }]} />

      <View style={wc.body}>
        {/* Top row */}
        <View style={wc.topRow}>
          <View style={[wc.avatar, { backgroundColor: palette.bg }]}>
            <AppText style={[wc.initials, { color: palette.text }]}>{initials}</AppText>
            {entry.workerVerified && (
              <View style={wc.verifiedBadge}>
                <AppText style={{ color: WHITE, fontSize: 7, fontWeight: '900' }}>✓</AppText>
              </View>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <View style={wc.nameRow}>
              <AppText style={[wc.name, { color: theme.colors.text }]} numberOfLines={1}>
                {entry.workerName.replace(/\b\w/g, (c) => c.toUpperCase())}
              </AppText>
              {entry.dailyRate != null && (
                <View style={wc.ratePill}>
                  <AppText style={wc.rateTxt}>₹{entry.dailyRate}/day</AppText>
                </View>
              )}
            </View>
            {!!location && (
              <AppText style={wc.location} numberOfLines={1}>📍 {location}</AppText>
            )}
            {entry.workerSkills.length > 0 && (
              <AppText style={wc.skills} numberOfLines={1}>
                🔧 {formatSkills(entry.workerSkills)}
              </AppText>
            )}
          </View>
        </View>

        {/* Bottom row */}
        <View style={wc.bottomRow}>
          <View style={[wc.statusBadge, { backgroundColor: meta.bg }]}>
            <AppText style={wc.statusEmoji}>{meta.emoji}</AppText>
            <AppText style={[wc.statusTxt, { color: meta.color }]}>{meta.label}</AppText>
          </View>
          <AppText style={wc.time}>{formatRelative(entry.lastContactedAt)}</AppText>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const wc = StyleSheet.create({
  card:         { borderRadius: 14, borderWidth: 1, marginBottom: 10, flexDirection: 'row', overflow: 'hidden' },
  accent:       { width: 4 },
  body:         { flex: 1, padding: 12, gap: 8 },
  topRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar:       { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' },
  initials:     { fontSize: 16, fontWeight: '800' },
  verifiedBadge:{ position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: WHITE },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name:         { fontSize: 14, fontWeight: '800', flexShrink: 1 },
  ratePill:     { backgroundColor: '#ECFDF5', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#6EE7B7' },
  rateTxt:      { fontSize: 10, fontWeight: '700', color: GREEN },
  location:     { fontSize: 11.5, color: SLATE, marginTop: 2 },
  skills:       { fontSize: 11.5, color: SLATE, marginTop: 1 },
  bottomRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusEmoji:  { fontSize: 12 },
  statusTxt:    { fontSize: 11, fontWeight: '700' },
  time:         { fontSize: 11, color: SLATE, fontWeight: '600' },
});

// ── Screen ────────────────────────────────────────────────────────────────────
export const CallHistoryScreen = ({ navigation }: Props): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterKey>('all');

  const FILTER_OPTIONS = [
    { key: 'all' as FilterKey,            label: t('filterAll') },
    { key: 'relevant' as FilterKey,       label: t('callStatusRelevant') },
    { key: 'call_later' as FilterKey,     label: t('callStatusCallLater') },
    { key: 'not_picked' as FilterKey,     label: t('callStatusNotPicked') },
    { key: 'not_interested' as FilterKey, label: t('callStatusNotInterested') },
  ];

  const callHistoryQuery = useQuery({
    queryKey: ['my-call-history'],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; history: CallHistoryEntry[] }>('/api/v1/user/my-call-history')
        .then((r) => r.data.history ?? []),
    staleTime: 2 * 60 * 1000,
  });

  useFocusEffect(
    useCallback(() => {
      if (callHistoryQuery.isStale) void callHistoryQuery.refetch();
    }, [callHistoryQuery]),
  );

  const allEntries = callHistoryQuery.data ?? [];
  const filtered = filter === 'all' ? allEntries : allEntries.filter((e) => e.status === filter);

  // Summary counts
  const counts: Record<string, number> = { all: allEntries.length };
  for (const entry of allEntries) {
    counts[entry.status] = (counts[entry.status] ?? 0) + 1;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader title={t('callHistoryTitle')} onBack={() => navigation.goBack()} />

      {/* ── Summary bar ─────────────────────────────────────────────────── */}
      {allEntries.length > 0 && (
        <View style={[sc.summaryBar, { borderBottomColor: BORDER }]}>
          <View style={[sc.summaryCell, { backgroundColor: '#EBF1FF' }]}>
            <AppText style={[sc.summaryNum, { color: BRAND }]}>{allEntries.length}</AppText>
            <AppText style={sc.summaryLabel}>{t('filterAll')}</AppText>
          </View>
          <View style={[sc.summaryCell, { backgroundColor: '#ECFDF5' }]}>
            <AppText style={[sc.summaryNum, { color: GREEN }]}>{counts.relevant ?? 0}</AppText>
            <AppText style={sc.summaryLabel}>{t('callStatusRelevant')}</AppText>
          </View>
          <View style={[sc.summaryCell, { backgroundColor: '#FFFBEB' }]}>
            <AppText style={[sc.summaryNum, { color: '#D97706' }]}>{counts.call_later ?? 0}</AppText>
            <AppText style={sc.summaryLabel}>{t('callStatusCallLater')}</AppText>
          </View>
          <View style={[sc.summaryCell, { backgroundColor: '#F1F5F9' }]}>
            <AppText style={[sc.summaryNum, { color: SLATE }]}>
              {(counts.not_picked ?? 0) + (counts.switched_off ?? 0)}
            </AppText>
            <AppText style={sc.summaryLabel}>{t('callStatusNotPicked')}</AppText>
          </View>
        </View>
      )}

      {/* ── Filter chips ─────────────────────────────────────────────────── */}
      <View style={[sc.filterBar, { borderBottomColor: BORDER }]}>
        {FILTER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setFilter(opt.key as FilterKey)}
            style={[sc.chip, filter === opt.key && sc.chipActive]}
            activeOpacity={0.75}
          >
            <AppText style={[sc.chipTxt, filter === opt.key && sc.chipTxtActive]}>
              {opt.label}
              {counts[opt.key] != null ? ` (${counts[opt.key]})` : ''}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {callHistoryQuery.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={BRAND} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.workerId}
          contentContainerStyle={[sc.listContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={callHistoryQuery.isFetching}
              onRefresh={() => void callHistoryQuery.refetch()}
              tintColor={BRAND}
            />
          }
          ListEmptyComponent={
            <View style={sc.emptyBox}>
              <AppText style={sc.emptyEmoji}>📞</AppText>
              <AppText style={sc.emptyTitle}>
                {filter === 'all' ? t('callNoHistory') : `${FILTER_OPTIONS.find((f) => f.key === filter)?.label}`}
              </AppText>
              <AppText style={sc.emptySub}>{t('callNoHistoryDesc')}</AppText>
              {filter === 'all' && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('WorkerSearch')}
                  style={sc.browseBtn}
                  activeOpacity={0.85}
                >
                  <AppText style={sc.browseBtnTxt}>{t('browseWorkers')}</AppText>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item: entry, index }) => (
            <WorkerCard
              entry={entry}
              idx={index}
              onPress={() => navigation.navigate('WorkerProfile', { workerId: entry.workerId })}
            />
          )}
        />
      )}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  summaryBar:    { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 10, paddingHorizontal: 14, gap: 8 },
  summaryCell:   { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center', gap: 2 },
  summaryNum:    { fontSize: 18, fontWeight: '900' },
  summaryLabel:  { fontSize: 9, fontWeight: '700', color: SLATE, textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },

  filterBar:     { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 10, paddingVertical: 6, gap: 6 },
  chip:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9' },
  chipActive:    { backgroundColor: BRAND },
  chipTxt:       { fontSize: 12, fontWeight: '700', color: SLATE },
  chipTxtActive: { color: WHITE },

  listContent:   { padding: 14 },

  emptyBox:      { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 32, gap: 12 },
  emptyEmoji:    { fontSize: 48 },
  emptyTitle:    { fontSize: 18, fontWeight: '900', color: NAVY, textAlign: 'center' },
  emptySub:      { fontSize: 13, color: SLATE, textAlign: 'center', lineHeight: 20 },
  browseBtn:     { backgroundColor: BRAND, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  browseBtnTxt:  { color: WHITE, fontSize: 13, fontWeight: '800' },
});
