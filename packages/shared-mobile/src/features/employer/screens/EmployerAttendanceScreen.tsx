import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../../shared/components/ui/AppText';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useAppTheme } from '../../../core/theme';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { useTranslation } from 'react-i18next';
import { attendanceApi } from '../../../core/api/endpoints/attendanceApi';
import type { AttendanceRecord, JoinedWorker, WorkerSummary } from '../../../core/api/endpoints/attendanceApi';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'EmployerAttendance'>;

// ── Constants ─────────────────────────────────────────────────────────────────
const BRAND  = '#1037A4';
const GREEN  = '#059669';
const RED    = '#DC2626';
const AMBER  = '#D97706';
const SLATE  = '#64748B';
const NAVY   = '#0F172A';
const WHITE  = '#FFFFFF';
const BORDER = '#E2E8F0';

// ── Date helpers ──────────────────────────────────────────────────────────────
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}
function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function todayStr(): string {
  return toDateStr(new Date());
}

// ── Attendance state for the day (mappingId → present) ───────────────────────
type DayAttendance = Record<string, { present: boolean; note: string }>;

function seedFromRecords(
  joinedWorkers: JoinedWorker[],
  existing: AttendanceRecord[],
  date: string,
): DayAttendance {
  const initial: DayAttendance = {};
  for (const w of joinedWorkers) {
    initial[w._id] = { present: true, note: '' };
  }
  // Overlay with any already-saved records for this date
  const dayRecords = existing.filter((r) => r.date.slice(0, 10) === date);
  for (const r of dayRecords) {
    initial[r.mappingId] = { present: r.present, note: r.note ?? '' };
  }
  return initial;
}

// ── Date Picker (simple inline bar) ──────────────────────────────────────────
function DatePickerBar({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (d: string) => void;
}): React.JSX.Element {
  const { theme } = useAppTheme();
  const today = new Date();
  // Show last 14 days
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return toDateStr(d);
  });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={dp.row}
    >
      {days.map((d) => {
        const isSelected = d === selected;
        const dt = new Date(d + 'T00:00:00Z');
        const dayLabel = dt.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' });
        const dateLabel = dt.getUTCDate();
        return (
          <TouchableOpacity
            key={d}
            onPress={() => onSelect(d)}
            style={[dp.cell, { backgroundColor: theme.colors.surface1, borderColor: 'transparent' }, isSelected && dp.cellActive]}
            activeOpacity={0.75}
          >
            <AppText style={[dp.dayTxt, { color: theme.colors.mutedText }, isSelected && dp.activeTxt]}>{dayLabel}</AppText>
            <AppText style={[dp.dateTxt, { color: theme.colors.text }, isSelected && dp.activeTxt]}>{dateLabel}</AppText>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
const dp = StyleSheet.create({
  row:       { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  cell:      { width: 52, height: 60, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1.5 },
  cellActive:{ backgroundColor: BRAND, borderColor: BRAND },
  dayTxt:    { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  dateTxt:   { fontSize: 18, fontWeight: '900' },
  activeTxt: { color: WHITE },
});

// ── Worker attendance row ─────────────────────────────────────────────────────
function WorkerRow({
  worker,
  value,
  onChange,
}: {
  worker: JoinedWorker;
  value: { present: boolean; note: string };
  onChange: (v: { present: boolean; note: string }) => void;
}): React.JSX.Element {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const initials = (worker.workerName ?? 'W')
    .split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();

  return (
    <View style={[wr.wrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={wr.top}>
        <View style={[wr.avatar, { backgroundColor: value.present ? '#ECFDF5' : '#FEF2F2' }]}>
          <AppText style={[wr.initials, { color: value.present ? GREEN : RED }]}>{initials}</AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText style={[wr.name, { color: theme.colors.text }]} numberOfLines={1}>
            {worker.workerName}
          </AppText>
          <AppText style={[wr.sub, { color: theme.colors.mutedText }]}>
            {worker.agreedRate ? `₹${worker.agreedRate}/${worker.rateType === 'Monthly' ? 'month' : 'day'}` : t('rateNotSet')}
          </AppText>
        </View>
        <View style={wr.switchWrap}>
          <AppText style={[wr.switchLabel, { color: value.present ? GREEN : RED }]}>
            {value.present ? t('presentLabel') : t('absentLabel')}
          </AppText>
          <Switch
            value={value.present}
            onValueChange={(v) => onChange({ ...value, present: v })}
            trackColor={{ false: '#FECACA', true: '#6EE7B7' }}
            thumbColor={value.present ? GREEN : RED}
            ios_backgroundColor="#FECACA"
          />
        </View>
      </View>
      {/* Optional note */}
      <TextInput
        style={[wr.noteInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surface1 }]}
        placeholder={t('addNoteHint')}
        placeholderTextColor={theme.colors.mutedText}
        value={value.note}
        onChangeText={(t) => onChange({ ...value, note: t })}
        maxLength={120}
      />
    </View>
  );
}
const wr = StyleSheet.create({
  wrap:       { borderRadius: 14, borderWidth: 1, padding: 12, gap: 8, marginBottom: 10 },
  top:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:     { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  initials:   { fontSize: 15, fontWeight: '800' },
  name:       { fontSize: 14, fontWeight: '800', lineHeight: 19 },
  sub:        { fontSize: 11.5, color: SLATE, marginTop: 2 },
  switchWrap: { alignItems: 'center', gap: 4 },
  switchLabel:{ fontSize: 10, fontWeight: '700' },
  noteInput:  { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12, marginTop: 2 },
});

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({ s }: { s: WorkerSummary }): React.JSX.Element {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const initials = (s.workerName ?? 'W')
    .split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  const pct = s.totalDaysMarked > 0 ? Math.round((s.daysPresent / s.totalDaysMarked) * 100) : 0;
  const pctColor = pct >= 80 ? GREEN : pct >= 50 ? AMBER : RED;

  return (
    <View style={[sc.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={sc.row}>
        <View style={[sc.avatar, { backgroundColor: theme.colors.primaryLight }]}>
          <AppText style={[sc.initials, { color: BRAND }]}>{initials}</AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText style={[sc.name, { color: theme.colors.text }]} numberOfLines={1}>{s.workerName}</AppText>
          <AppText style={[sc.sub, { color: theme.colors.mutedText }]}>
            {s.agreedRate ? `₹${s.agreedRate}/${s.rateType === 'Monthly' ? 'month' : 'day'}` : t('rateNotSet')}
          </AppText>
        </View>
        <View style={sc.salaryBox}>
          <AppText style={[sc.salaryLabel, { color: theme.colors.mutedText }]}>{t('estimatedLabel')}</AppText>
          <AppText style={[sc.salaryAmt, { color: theme.colors.text }]}>₹{s.estimatedSalary.toLocaleString('en-IN')}</AppText>
        </View>
      </View>

      {/* Stats bar */}
      <View style={sc.statsRow}>
        <View style={[sc.statCell, { backgroundColor: theme.colors.surface1 }]}>
          <AppText style={[sc.statNum, { color: GREEN }]}>{s.daysPresent}</AppText>
          <AppText style={[sc.statLabel, { color: theme.colors.mutedText }]}>{t('presentStat')}</AppText>
        </View>
        <View style={[sc.statCell, { backgroundColor: theme.colors.surface1 }]}>
          <AppText style={[sc.statNum, { color: RED }]}>{s.daysAbsent}</AppText>
          <AppText style={[sc.statLabel, { color: theme.colors.mutedText }]}>{t('absentStat')}</AppText>
        </View>
        <View style={[sc.statCell, { backgroundColor: theme.colors.surface1 }]}>
          <AppText style={[sc.statNum, { color: theme.colors.mutedText }]}>{s.totalDaysMarked}</AppText>
          <AppText style={[sc.statLabel, { color: theme.colors.mutedText }]}>{t('totalDaysStat')}</AppText>
        </View>
        <View style={[sc.statCell, { backgroundColor: theme.colors.surface1, borderWidth: 1.5, borderColor: pctColor, borderRadius: 10 }]}>
          <AppText style={[sc.statNum, { color: pctColor }]}>{pct}%</AppText>
          <AppText style={[sc.statLabel, { color: pctColor }]}>{t('attendanceStat')}</AppText>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[sc.progressBg, { backgroundColor: theme.colors.surface2 }]}>
        <View style={[sc.progressFill, { width: `${pct}%`, backgroundColor: pctColor }]} />
      </View>
    </View>
  );
}
const sc = StyleSheet.create({
  card:       { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10, marginBottom: 12 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  initials:   { fontSize: 16, fontWeight: '900' },
  name:       { fontSize: 14, fontWeight: '800', lineHeight: 19 },
  sub:        { fontSize: 11, marginTop: 1 },
  salaryBox:  { alignItems: 'flex-end' },
  salaryLabel:{ fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  salaryAmt:  { fontSize: 17, fontWeight: '900' },
  statsRow:   { flexDirection: 'row', gap: 8 },
  statCell:   { flex: 1, alignItems: 'center', borderRadius: 10, paddingVertical: 8, gap: 2 },
  statNum:    { fontSize: 18, fontWeight: '900' },
  statLabel:  { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  progressBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill:{ height: 6, borderRadius: 3 },
});

// ── Screen ────────────────────────────────────────────────────────────────────
export const EmployerAttendanceScreen = ({ route, navigation }: Props): React.JSX.Element => {
  const { requirementId, requirementTitle } = route.params;
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<'mark' | 'summary'>('mark');
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [dayAttendance, setDayAttendance] = useState<DayAttendance>({});
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // ── Data ─────────────────────────────────────────────────────────────────
  const attendanceQuery = useQuery({
    queryKey: ['employer-attendance', requirementId],
    queryFn: () => attendanceApi.getByRequirement(requirementId),
    staleTime: 60 * 1000,
  });

  const summaryQuery = useQuery({
    queryKey: ['employer-attendance-summary', requirementId],
    queryFn: () => attendanceApi.getSummary(requirementId),
    enabled: activeTab === 'summary',
    staleTime: 60 * 1000,
  });

  const joinedWorkers = attendanceQuery.data?.joinedWorkers ?? [];
  const allRecords    = attendanceQuery.data?.records ?? [];

  // Seed attendance state whenever date or workers change
  const seeded = useMemo(
    () => seedFromRecords(joinedWorkers, allRecords, selectedDate),
    [joinedWorkers, allRecords, selectedDate],
  );
  // Only update the local state once on first load / date change
  const handleDateChange = useCallback(
    (d: string) => {
      setSelectedDate(d);
      setDayAttendance(seedFromRecords(joinedWorkers, allRecords, d));
    },
    [joinedWorkers, allRecords],
  );

  // Initialise on first load
  useFocusEffect(
    useCallback(() => {
      if (attendanceQuery.isSuccess && joinedWorkers.length > 0) {
        setDayAttendance(seedFromRecords(joinedWorkers, allRecords, selectedDate));
      }
    }, [attendanceQuery.isSuccess]),
  );

  const updateWorker = (mappingId: string, val: { present: boolean; note: string }) => {
    setDayAttendance((prev) => ({ ...prev, [mappingId]: val }));
  };

  // ── Submit for the day ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (joinedWorkers.length === 0) {
      toast.error('No joined workers to mark attendance for.', 'Nothing to mark');
      return;
    }
    setSubmitting(true);
    try {
      const records = joinedWorkers.map((w) => ({
        mappingId: w._id,
        present:   (dayAttendance[w._id] ?? seeded[w._id])?.present ?? true,
        note:      (dayAttendance[w._id] ?? seeded[w._id])?.note ?? '',
      }));
      await attendanceApi.markDay(requirementId, selectedDate, records);
      await qc.invalidateQueries({ queryKey: ['employer-attendance', requirementId] });
      await qc.invalidateQueries({ queryKey: ['employer-attendance-summary', requirementId] });
      toast.success(`Attendance saved for ${formatDisplayDate(selectedDate)}.`, 'Saved');
    } catch {
      toast.error('Failed to save attendance. Please try again.', 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Mark-all shortcuts ────────────────────────────────────────────────────
  const markAll = (present: boolean) => {
    const updated: DayAttendance = {};
    for (const w of joinedWorkers) {
      updated[w._id] = { present, note: dayAttendance[w._id]?.note ?? '' };
    }
    setDayAttendance(updated);
  };

  // ── History data for current date ─────────────────────────────────────────
  const historyDates = useMemo(() => {
    const dateSet = new Set(allRecords.map((r) => r.date.slice(0, 10)));
    return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  }, [allRecords]);

  // ── Empty joined workers ──────────────────────────────────────────────────
  const renderEmptyJoined = () => (
    <View style={styles.emptyBox}>
      <AppText style={styles.emptyEmoji}>👷</AppText>
      <AppText style={[styles.emptyTitle, { color: theme.colors.text }]}>{t('noJoinedWorkers')}</AppText>
      <AppText style={[styles.emptySub, { color: theme.colors.mutedText }]}>{t('noJoinedWorkersSub')}</AppText>
    </View>
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  const isLoading = attendanceQuery.isLoading;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader
        title={requirementTitle ? `${t('attendanceStat')} · ${requirementTitle}` : t('markAttendanceTab')}
        onBack={() => navigation.goBack()}
      />

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <View style={[styles.tabBar, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        {(['mark', 'summary'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            activeOpacity={0.75}
          >
            <AppText style={[styles.tabTxt, { color: theme.colors.mutedText }, activeTab === tab && styles.tabTxtActive]}>
              {tab === 'mark' ? t('markAttendanceTab') : t('salarySummaryTab')}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={BRAND} />
        </View>
      ) : activeTab === 'mark' ? (
        // ── MARK ATTENDANCE TAB ────────────────────────────────────────────
        <View style={{ flex: 1 }}>
          {/* Date picker */}
          <View style={[styles.dateSection, { borderBottomColor: theme.colors.border }]}>
            <AppText style={[styles.sectionLabel, { color: theme.colors.mutedText }]}>{t('selectDate')}</AppText>
            <DatePickerBar selected={selectedDate} onSelect={handleDateChange} />
          </View>

          {joinedWorkers.length === 0 ? (
            <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
              {renderEmptyJoined()}
            </ScrollView>
          ) : (
            <FlatList
              data={joinedWorkers}
              keyExtractor={(w) => w._id}
              contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={attendanceQuery.isFetching}
                  onRefresh={() => void attendanceQuery.refetch()}
                  tintColor={BRAND}
                />
              }
              ListHeaderComponent={
                <View>
                  {/* Date header + mark-all shortcuts */}
                  <View style={styles.dayHeader}>
                    <View>
                      <AppText style={[styles.dayHeaderDate, { color: theme.colors.text }]}>{formatDisplayDate(selectedDate)}</AppText>
                      <AppText style={[styles.dayHeaderSub, { color: theme.colors.mutedText }]}>{t('workerCount', { count: joinedWorkers.length })}</AppText>
                    </View>
                    <View style={styles.markAllRow}>
                      <TouchableOpacity onPress={() => markAll(true)} style={[styles.markAllBtn, { backgroundColor: theme.colors.successLight, borderColor: '#6EE7B7' }]} activeOpacity={0.75}>
                        <AppText style={[styles.markAllTxt, { color: GREEN }]}>{t('allPresent')}</AppText>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => markAll(false)} style={[styles.markAllBtn, { backgroundColor: theme.colors.dangerLight, borderColor: '#FECACA' }]} activeOpacity={0.75}>
                        <AppText style={[styles.markAllTxt, { color: RED }]}>{t('allAbsent')}</AppText>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              }
              renderItem={({ item: worker }) => (
                <WorkerRow
                  worker={worker}
                  value={dayAttendance[worker._id] ?? seeded[worker._id] ?? { present: true, note: '' }}
                  onChange={(v) => updateWorker(worker._id, v)}
                />
              )}
            />
          )}

          {/* Sticky submit */}
          {joinedWorkers.length > 0 && (
            <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
              <TouchableOpacity
                onPress={() => void handleSubmit()}
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                activeOpacity={0.85}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color={WHITE} size="small" />
                  : <AppText style={styles.submitTxt}>{t('saveAttendanceBtn', { date: formatDisplayDate(selectedDate) })}</AppText>
                }
              </TouchableOpacity>

              {/* History toggle */}
              <TouchableOpacity
                onPress={() => setShowHistory(true)}
                style={styles.historyBtn}
                activeOpacity={0.75}
              >
                <AppText style={styles.historyTxt}>{t('viewHistoryBtn', { count: historyDates.length })}</AppText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        // ── SALARY SUMMARY TAB ─────────────────────────────────────────────
        <View style={{ flex: 1 }}>
          {summaryQuery.isLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={BRAND} />
            </View>
          ) : (
            <FlatList
              data={summaryQuery.data?.summary ?? []}
              keyExtractor={(s) => s.mappingId}
              contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 32 }]}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={summaryQuery.isFetching}
                  onRefresh={() => void summaryQuery.refetch()}
                  tintColor={BRAND}
                />
              }
              ListHeaderComponent={
                summaryQuery.data && summaryQuery.data.summary.length > 0 ? (
                  <View style={styles.grandTotalCard}>
                    <AppText style={styles.gtLabel}>{t('totalPayrollLabel')}</AppText>
                    <AppText style={styles.gtAmount}>
                      ₹{(summaryQuery.data?.grandTotal ?? 0).toLocaleString('en-IN')}
                    </AppText>
                    <AppText style={styles.gtSub}>{t('payrollDisclaimer')}</AppText>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                !summaryQuery.isLoading ? (
                  <View style={styles.emptyBox}>
                    <AppText style={styles.emptyEmoji}>📊</AppText>
                    <AppText style={[styles.emptyTitle, { color: theme.colors.text }]}>{t('noSummaryYet')}</AppText>
                    <AppText style={[styles.emptySub, { color: theme.colors.mutedText }]}>{t('noSummaryYetSub')}</AppText>
                  </View>
                ) : null
              }
              renderItem={({ item: s }) => <SummaryCard s={s} />}
            />
          )}
        </View>
      )}

      {/* ── History Modal ──────────────────────────────────────────────────── */}
      <Modal
        visible={showHistory}
        animationType="slide"
        transparent
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={hm.overlay}>
          <View style={[hm.sheet, { backgroundColor: theme.colors.card, paddingBottom: insets.bottom + 16 }]}>
            <View style={[hm.header, { borderBottomColor: theme.colors.border }]}>
              <AppText style={[hm.title, { color: theme.colors.text }]}>{t('attendanceHistoryTitle')}</AppText>
              <TouchableOpacity onPress={() => setShowHistory(false)} style={[hm.closeBtn, { backgroundColor: theme.colors.surface1 }]}>
                <AppText style={{ color: theme.colors.mutedText, fontSize: 18, fontWeight: '700' }}>✕</AppText>
              </TouchableOpacity>
            </View>

            {historyDates.length === 0 ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <AppText style={{ color: theme.colors.mutedText, fontSize: 13, textAlign: 'center' }}>{t('noAttendanceMarked')}</AppText>
              </View>
            ) : (
              <FlatList
                data={historyDates}
                keyExtractor={(d) => d}
                contentContainerStyle={{ padding: 14, gap: 8 }}
                renderItem={({ item: date }) => {
                  const dayRecords = allRecords.filter((r) => r.date.slice(0, 10) === date);
                  const presentCount = dayRecords.filter((r) => r.present).length;
                  const total = dayRecords.length;
                  const badgeBg = presentCount === total ? theme.colors.successLight : presentCount === 0 ? theme.colors.dangerLight : theme.colors.warningLight;
                  const badgeColor = presentCount === total ? GREEN : presentCount === 0 ? RED : AMBER;
                  return (
                    <TouchableOpacity
                      onPress={() => { setShowHistory(false); handleDateChange(date); }}
                      style={[hm.dayRow, { backgroundColor: theme.colors.surface1, borderColor: theme.colors.border }]}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <AppText style={[hm.dayDate, { color: theme.colors.text }]}>{formatDisplayDate(date)}</AppText>
                        <AppText style={[hm.daySub, { color: theme.colors.mutedText }]}>{t('presentCount', { present: presentCount, total })}</AppText>
                      </View>
                      <View style={[hm.badge, { backgroundColor: badgeBg }]}>
                        <AppText style={[hm.badgeTxt, { color: badgeColor }]}>
                          {presentCount}/{total}
                        </AppText>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  tabBar:        { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn:        { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabBtnActive:  { borderBottomColor: BRAND },
  tabTxt:        { fontSize: 13, fontWeight: '700' },
  tabTxtActive:  { color: BRAND },

  dateSection:   { borderBottomWidth: 1, paddingTop: 10 },
  sectionLabel:  { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, paddingHorizontal: 16 },

  listContent:   { padding: 14 },

  dayHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dayHeaderDate: { fontSize: 15, fontWeight: '900' },
  dayHeaderSub:  { fontSize: 11.5, marginTop: 2 },
  markAllRow:    { flexDirection: 'row', gap: 6 },
  markAllBtn:    { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  markAllTxt:    { fontSize: 11, fontWeight: '800' },

  footer:        { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, borderTopWidth: 1, gap: 8 },
  submitBtn:     { backgroundColor: BRAND, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  submitTxt:     { color: WHITE, fontSize: 14, fontWeight: '800' },
  historyBtn:    { alignItems: 'center', paddingVertical: 4 },
  historyTxt:    { fontSize: 12, color: BRAND, fontWeight: '700' },

  grandTotalCard:{ backgroundColor: BRAND, borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 16, gap: 4 },
  gtLabel:       { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 0.4 },
  gtAmount:      { fontSize: 32, fontWeight: '900', color: WHITE },
  gtSub:         { fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 16 },

  emptyBox:      { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 10 },
  emptyEmoji:    { fontSize: 44 },
  emptyTitle:    { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptySub:      { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});

const hm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%' },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1 },
  title:   { fontSize: 17, fontWeight: '900' },
  closeBtn:{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayRow:  { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, borderWidth: 1 },
  dayDate: { fontSize: 14, fontWeight: '800' },
  daySub:  { fontSize: 11.5, marginTop: 2 },
  badge:   { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  badgeTxt:{ fontSize: 13, fontWeight: '900' },
});
