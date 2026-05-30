import React, { useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../../shared/components/ui/AppText';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../core/theme';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { RawRequirement } from '../../../core/api/endpoints/requirementsApi';
import { useAuth } from '../../../state/auth/AuthContext';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'RequirementCalendar'>;

// ── Constants ─────────────────────────────────────────────────────────────────
const BRAND = '#1037A4';
const NAVY  = '#0F172A';
const SLATE = '#64748B';
const WHITE = '#FFFFFF';
const BORDER= '#E2E8F0';

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
// WEEKDAYS now built inside screen with t() — see calendarWeekdays below

// ── Status colours ────────────────────────────────────────────────────────────
function statusDotColor(status?: string): string {
  const s = (status ?? '').toLowerCase();
  if (s === 'completed') return '#94A3B8';
  if (s === 'assigned')  return '#059669';
  if (s === 'closed' || s === 'expired') return '#DC2626';
  return BRAND; // Pending / Active / Open → blue
}
// statusLabel now built inside components that have access to t()
function statusBg(status?: string): string {
  const s = (status ?? '').toLowerCase();
  if (s === 'completed') return '#F1F5F9';
  if (s === 'assigned')  return '#ECFDF5';
  if (s === 'closed' || s === 'expired') return '#FEF2F2';
  return '#EBF1FF';
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function toKey(d: Date): string {
  // 'YYYY-MM-DD'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function reqDateKey(req: RawRequirement): string | null {
  if (!req.workerNeedDate) return null;
  return toKey(new Date(req.workerNeedDate));
}

// ── Calendar grid helpers ─────────────────────────────────────────────────────
function buildCalendarGrid(year: number, month: number): (number | null)[] {
  // month is 0-indexed
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

// ── Requirement status legend ─────────────────────────────────────────────────
function Legend(): React.JSX.Element {
  const { t } = useTranslation('employer');
  const items = [
    { color: BRAND,    label: t('calStatusOpenPending') },
    { color: '#059669', label: t('calStatusAssigned') },
    { color: '#94A3B8', label: t('calStatusCompleted') },
    { color: '#DC2626', label: t('calStatusClosed') },
  ];
  return (
    <View style={leg.row}>
      {items.map((it) => (
        <View key={it.label} style={leg.item}>
          <View style={[leg.dot, { backgroundColor: it.color }]} />
          <AppText style={leg.label}>{it.label}</AppText>
        </View>
      ))}
    </View>
  );
}
const leg = StyleSheet.create({
  row:   { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 14, paddingVertical: 8 },
  item:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:   { width: 9, height: 9, borderRadius: 4.5 },
  label: { fontSize: 11, color: SLATE, fontWeight: '600' },
});

// ── Requirement card in bottom sheet ─────────────────────────────────────────
function ReqCard({
  req,
  onPress,
}: {
  req: RawRequirement;
  onPress: () => void;
}): React.JSX.Element {
  const { t } = useTranslation('employer');
  const color  = statusDotColor(req.status);
  const bg     = statusBg(req.status);
  const s = (req.status ?? '').toLowerCase();
  const label  = s === 'completed' ? t('calStatusCompleted')
                : s === 'assigned'  ? t('calStatusAssigned')
                : (s === 'closed' || s === 'expired') ? t('calStatusClosed')
                : t('calStatusOpen');
  const title  = [req.workType, req.subCategory]
    .filter(Boolean)
    .map((s) => (s ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(' · ');

  return (
    <TouchableOpacity onPress={onPress} style={rcs.card} activeOpacity={0.85}>
      <View style={rcs.top}>
        <View style={{ flex: 1 }}>
          <AppText style={rcs.title} numberOfLines={2}>{title || 'Requirement'}</AppText>
          <AppText style={rcs.sub}>
            ERN #{req.ERN_NUMBER ?? '—'}
            {req.district ? `  ·  ${req.district}` : ''}
            {req.state    ? `, ${req.state}` : ''}
          </AppText>
        </View>
        <View style={[rcs.badge, { backgroundColor: bg }]}>
          <View style={[rcs.badgeDot, { backgroundColor: color }]} />
          <AppText style={[rcs.badgeTxt, { color }]}>{label}</AppText>
        </View>
      </View>
      <View style={rcs.footer}>
        <AppText style={rcs.workers}>
          {t((req.workerQuantitySkilled ?? 0) === 1 ? 'calWorkersNeeded' : 'calWorkersNeeded_plural', { count: req.workerQuantitySkilled ?? 0 })}
        </AppText>
        {req.salaryType && (
          <AppText style={rcs.rate}>
            {req.salaryType} wages
            {req.minBudgetPerWorker ? `  ·  ₹${req.minBudgetPerWorker}+` : ''}
          </AppText>
        )}
      </View>
    </TouchableOpacity>
  );
}
const rcs = StyleSheet.create({
  card:      { borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: WHITE, padding: 12, marginBottom: 8, gap: 8 },
  top:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title:     { fontSize: 14, fontWeight: '800', color: NAVY, lineHeight: 19 },
  sub:       { fontSize: 11.5, color: SLATE, marginTop: 2 },
  badge:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  badgeDot:  { width: 6, height: 6, borderRadius: 3 },
  badgeTxt:  { fontSize: 10, fontWeight: '700' },
  footer:    { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER, paddingTop: 8 },
  workers:   { fontSize: 11.5, color: SLATE, fontWeight: '600' },
  rate:      { fontSize: 11.5, color: '#059669', fontWeight: '700' },
});

// ── Screen ────────────────────────────────────────────────────────────────────
export const RequirementCalendarScreen = ({ navigation }: Props): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { state: authState } = useAuth();
  const userId = authState.session?.user?.id ?? '';

  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // ── Requirements data ─────────────────────────────────────────────────────
  const reqQuery = useQuery({
    queryKey: ['employer-reqs-calendar', userId],
    queryFn: () => requirementsApi.listForRole({ role: 'employer', userId, limit: 200, page: 1 }),
    staleTime: 5 * 60 * 1000,
  });

  // Index requirements by workerNeedDate key
  const reqsByDate = useMemo<Record<string, RawRequirement[]>>(() => {
    const map: Record<string, RawRequirement[]> = {};
    for (const req of reqQuery.data?.requirements ?? []) {
      const key = reqDateKey(req);
      if (key) {
        if (!map[key]) map[key] = [];
        map[key].push(req);
      }
    }
    return map;
  }, [reqQuery.data]);

  // ── Calendar navigation ────────────────────────────────────────────────────
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const grid = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const calendarWeekdays = [t('calSunday'), t('calMonday'), t('calTuesday'), t('calWednesday'), t('calThursday'), t('calFriday'), t('calSaturday')];

  const selectedReqs = selectedKey ? (reqsByDate[selectedKey] ?? []) : [];

  const todayKey = toKey(today);

  // Format selected date for the bottom sheet header
  const selectedDateLabel = useMemo(() => {
    if (!selectedKey) return '';
    const [y, m, d] = selectedKey.split('-').map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d);
    return dt.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }, [selectedKey]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader title={t('requirementCalendarTitle')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={[cal.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={reqQuery.isFetching}
            onRefresh={() => void reqQuery.refetch()}
            tintColor={BRAND}
          />
        }
      >
        {/* Legend */}
        <Legend />

        {/* Calendar card */}
        <View style={[cal.card, { backgroundColor: theme.colors.card }]}>
          {/* Month navigation */}
          <View style={cal.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={cal.navBtn} activeOpacity={0.7}>
              <AppText style={cal.navArrow}>‹</AppText>
            </TouchableOpacity>
            <AppText style={[cal.monthTitle, { color: theme.colors.text }]}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </AppText>
            <TouchableOpacity onPress={nextMonth} style={cal.navBtn} activeOpacity={0.7}>
              <AppText style={cal.navArrow}>›</AppText>
            </TouchableOpacity>
          </View>

          {/* Weekday headers */}
          <View style={cal.weekRow}>
            {calendarWeekdays.map((d) => (
              <View key={d} style={cal.weekCell}>
                <AppText style={cal.weekTxt}>{d}</AppText>
              </View>
            ))}
          </View>

          {/* Day grid */}
          {reqQuery.isLoading ? (
            <View style={cal.loadingBox}>
              <ActivityIndicator color={BRAND} />
            </View>
          ) : (
            <View style={cal.gridWrap}>
              {grid.map((day, idx) => {
                if (day === null) {
                  return <View key={`e-${idx}`} style={cal.cell} />;
                }
                const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const reqs = reqsByDate[key] ?? [];
                const isToday    = key === todayKey;
                const isSelected = key === selectedKey;
                const dotColors  = reqs.slice(0, 3).map((r) => statusDotColor(r.status));

                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      cal.cell,
                      isToday    && cal.cellToday,
                      isSelected && cal.cellSelected,
                    ]}
                    onPress={() => setSelectedKey(isSelected ? null : key)}
                    activeOpacity={0.75}
                  >
                    <AppText style={[
                      cal.dayNum,
                      isToday    && cal.dayNumToday,
                      isSelected && cal.dayNumSelected,
                      { color: isSelected ? WHITE : isToday ? BRAND : theme.colors.text },
                    ]}>
                      {String(day)}
                    </AppText>
                    {/* Status dots */}
                    {dotColors.length > 0 && (
                      <View style={cal.dotsRow}>
                        {dotColors.map((c, i) => (
                          <View key={i} style={[cal.dot, { backgroundColor: c }]} />
                        ))}
                        {reqs.length > 3 && (
                          <AppText style={cal.dotMore}>+{reqs.length - 3}</AppText>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Month summary strip */}
        <View style={cal.summaryRow}>
          {[
            { label: 'Total',     color: NAVY,     count: Object.values(reqsByDate).filter((arr) => {
              const [y, m] = (Object.keys(reqsByDate)[0] ?? '').split('-').map(Number);
              return true;
            }).reduce((sum, arr) => {
              // Only count reqs in current month
              return sum + arr.filter((r) => {
                const k = reqDateKey(r);
                if (!k) return false;
                const [ry, rm] = k.split('-').map(Number);
                return ry === viewYear && (rm ?? 0) - 1 === viewMonth;
              }).length;
            }, 0) },
          ].map((s) => null)}
          {(() => {
            const all = Object.entries(reqsByDate)
              .filter(([k]) => {
                const [y, m] = k.split('-').map(Number);
                return y === viewYear && (m ?? 0) - 1 === viewMonth;
              })
              .flatMap(([, arr]) => arr);

            const open      = all.filter((r) => !['completed','assigned','closed','expired'].includes((r.status ?? '').toLowerCase())).length;
            const assigned  = all.filter((r) => (r.status ?? '').toLowerCase() === 'assigned').length;
            const completed = all.filter((r) => (r.status ?? '').toLowerCase() === 'completed').length;

            return (
              <>
                {[
                  { n: all.length,  label: t('calSummaryThisMonth'), color: NAVY    },
                  { n: open,        label: t('calStatusOpen'),        color: BRAND   },
                  { n: assigned,    label: t('calStatusAssigned'),    color: '#059669' },
                  { n: completed,   label: t('calSummaryDone'),       color: '#94A3B8' },
                ].map((s) => (
                  <View key={s.label} style={cal.summaryCell}>
                    <AppText style={[cal.summaryNum, { color: s.color }]}>{s.n}</AppText>
                    <AppText style={cal.summaryLabel}>{s.label}</AppText>
                  </View>
                ))}
              </>
            );
          })()}
        </View>

        {/* Selected date requirements */}
        {selectedKey && (
          <View style={cal.dayDetailBox}>
            <View style={cal.dayDetailHeader}>
              <AppText style={cal.dayDetailTitle}>{selectedDateLabel}</AppText>
              <AppText style={cal.dayDetailCount}>
                {selectedReqs.length} requirement{selectedReqs.length !== 1 ? 's' : ''}
              </AppText>
            </View>
            {selectedReqs.length === 0 ? (
              <View style={cal.emptyDay}>
                <AppText style={cal.emptyDayEmoji}>📅</AppText>
                <AppText style={cal.emptyDayTxt}>No requirements scheduled for this date.</AppText>
              </View>
            ) : (
              selectedReqs.map((req) => (
                <ReqCard
                  key={String(req._id)}
                  req={req}
                  onPress={() => navigation.navigate('RequirementDetail', { requirementId: String(req._id) })}
                />
              ))
            )}
          </View>
        )}

        {/* All-month list (when nothing selected) */}
        {!selectedKey && (
          <View style={cal.monthListBox}>
            <AppText style={cal.monthListTitle}>
              All Requirements — {MONTH_NAMES[viewMonth]} {viewYear}
            </AppText>
            {(() => {
              const all = Object.entries(reqsByDate)
                .filter(([k]) => {
                  const [y, m] = k.split('-').map(Number);
                  return y === viewYear && (m ?? 0) - 1 === viewMonth;
                })
                .sort(([a], [b]) => a.localeCompare(b))
                .flatMap(([, arr]) => arr);

              if (all.length === 0) {
                return (
                  <View style={cal.emptyMonth}>
                    <AppText style={cal.emptyMonthEmoji}>📋</AppText>
                    <AppText style={cal.emptyMonthTxt}>No requirements scheduled this month.</AppText>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('PostRequirement')}
                      style={cal.postBtn}
                      activeOpacity={0.85}
                    >
                      <AppText style={cal.postBtnTxt}>+ Post a Requirement</AppText>
                    </TouchableOpacity>
                  </View>
                );
              }

              return all.map((req) => (
                <ReqCard
                  key={String(req._id)}
                  req={req}
                  onPress={() => navigation.navigate('RequirementDetail', { requirementId: String(req._id) })}
                />
              ));
            })()}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const cal = StyleSheet.create({
  scroll:         { padding: 14, gap: 12 },
  card:           { borderRadius: 18, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' },

  monthNav:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  navBtn:         { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  navArrow:       { fontSize: 20, fontWeight: '800', color: NAVY, lineHeight: 24 },
  monthTitle:     { fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },

  weekRow:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER },
  weekCell:       { flex: 1, alignItems: 'center', paddingVertical: 8 },
  weekTxt:        { fontSize: 11, fontWeight: '800', color: SLATE, textTransform: 'uppercase', letterSpacing: 0.4 },

  gridWrap:       { flexDirection: 'row', flexWrap: 'wrap' },
  cell:           { width: `${100 / 7}%`, aspectRatio: 0.9, alignItems: 'center', justifyContent: 'center', padding: 2 },
  cellToday:      { backgroundColor: '#EBF1FF', borderRadius: 10 },
  cellSelected:   { backgroundColor: BRAND, borderRadius: 10 },

  dayNum:         { fontSize: 13, fontWeight: '700' },
  dayNumToday:    { fontWeight: '900', color: BRAND },
  dayNumSelected: { color: WHITE, fontWeight: '900' },

  dotsRow:        { flexDirection: 'row', gap: 2, marginTop: 2, alignItems: 'center' },
  dot:            { width: 5, height: 5, borderRadius: 2.5 },
  dotMore:        { fontSize: 8, color: SLATE, fontWeight: '700' },

  loadingBox:     { paddingVertical: 40, alignItems: 'center' },

  summaryRow:     { flexDirection: 'row', gap: 8, marginVertical: 4 },
  summaryCell:    { flex: 1, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: BORDER, padding: 10, alignItems: 'center', gap: 3 },
  summaryNum:     { fontSize: 20, fontWeight: '900' },
  summaryLabel:   { fontSize: 10, fontWeight: '700', color: SLATE, textTransform: 'uppercase', letterSpacing: 0.3 },

  dayDetailBox:   { gap: 8 },
  dayDetailHeader:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dayDetailTitle: { fontSize: 14, fontWeight: '900', color: NAVY, flex: 1, flexWrap: 'wrap' },
  dayDetailCount: { fontSize: 12, fontWeight: '700', color: BRAND },
  emptyDay:       { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyDayEmoji:  { fontSize: 32 },
  emptyDayTxt:    { fontSize: 13, color: SLATE, textAlign: 'center' },

  monthListBox:   { gap: 8, marginTop: 4 },
  monthListTitle: { fontSize: 12, fontWeight: '800', color: SLATE, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  emptyMonth:     { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyMonthEmoji:{ fontSize: 40 },
  emptyMonthTxt:  { fontSize: 13, color: SLATE, textAlign: 'center' },
  postBtn:        { backgroundColor: BRAND, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  postBtnTxt:     { color: WHITE, fontSize: 13, fontWeight: '800' },
});
