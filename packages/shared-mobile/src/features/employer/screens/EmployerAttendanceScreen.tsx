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
import { subcatDisplay } from '../../../shared/data/categoryLabels';
import i18n from '../../../core/i18n';
import { useAppTheme } from '../../../core/theme';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { useTranslation } from 'react-i18next';
import { attendanceApi } from '../../../core/api/endpoints/attendanceApi';
import type { AttendanceRecord, JoinedWorker, WorkerSummary } from '../../../core/api/endpoints/attendanceApi';
import type { MainStackParamList } from '../../../app/navigation/types';
import { usePlanFeatures } from '../../../core/hooks/usePlanFeatures';

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
const EN_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  // Localize the month to the active language (reuses the shared calMonthNames).
  const months = i18n.t('calMonthNames', { ns: 'employer', returnObjects: true });
  const mArr = Array.isArray(months) && months.length === 12 ? (months as string[]) : EN_MONTHS_SHORT;
  return `${d.getUTCDate()} ${mArr[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function todayStr(): string {
  return toDateStr(new Date());
}

// ── Attendance state for the day (mappingId → status) ────────────────────────
type AttStatus = 'present' | 'half_day' | 'absent';
type DayAttendance = Record<string, { status: AttStatus; note: string }>;

function seedFromRecords(
  joinedWorkers: JoinedWorker[],
  existing: AttendanceRecord[],
  date: string,
): DayAttendance {
  const initial: DayAttendance = {};
  for (const w of joinedWorkers) {
    initial[w._id] = { status: 'present', note: '' };
  }
  const dayRecords = existing.filter((r) => r.date.slice(0, 10) === date);
  for (const r of dayRecords) {
    // backward compat: use status if available, else derive from present boolean
    const st: AttStatus = (r as any).status || (r.present ? 'present' : 'absent');
    initial[r.mappingId] = { status: st, note: r.note ?? '' };
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
  const { t } = useTranslation('employer');
  const wkShort = t('calWeekdaysShort', { returnObjects: true });
  const weekdays = Array.isArray(wkShort) && wkShort.length === 7
    ? (wkShort as string[])
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
        const dayLabel = weekdays[dt.getUTCDay()];
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
  value: { status: AttStatus; note: string };
  onChange: (v: { status: AttStatus; note: string }) => void;
}): React.JSX.Element {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const initials = (worker.workerName ?? 'W')
    .split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  const avatarBg = value.status === 'present' ? '#ECFDF5' : value.status === 'half_day' ? '#FFFBEB' : '#FEF2F2';
  const avatarColor = value.status === 'present' ? GREEN : value.status === 'half_day' ? AMBER : RED;

  const BTN_DATA: { key: AttStatus; labelKey: string; active: string; activeTxt: string; idleBorder: string }[] = [
    { key: 'present',  labelKey: 'presentStat',  active: GREEN, activeTxt: WHITE, idleBorder: '#6EE7B7' },
    { key: 'half_day', labelKey: 'halfDayStat',   active: AMBER, activeTxt: WHITE, idleBorder: '#FCD34D' },
    { key: 'absent',   labelKey: 'absentStat',   active: RED,   activeTxt: WHITE, idleBorder: '#FCA5A5' },
  ];

  return (
    <View style={[wr.wrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={wr.top}>
        <View style={[wr.avatar, { backgroundColor: avatarBg }]}>
          <AppText style={[wr.initials, { color: avatarColor }]}>{initials}</AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText style={[wr.name, { color: theme.colors.text }]} numberOfLines={2}>
            {worker.workerName}
          </AppText>
          <AppText style={[wr.sub, { color: theme.colors.mutedText }]}>
            {worker.agreedRate ? `₹${worker.agreedRate}${worker.rateType === 'Monthly' ? t('perMonth') : t('perDay')}` : t('rateNotSet')}
          </AppText>
        </View>
      </View>
      {/* 3-way status selector */}
      <View style={wr.btnRow}>
        {BTN_DATA.map(({ key, labelKey, active, activeTxt, idleBorder }) => {
          const isActive = value.status === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => onChange({ ...value, status: key })}
              style={[wr.btn, {
                backgroundColor: isActive ? active : 'transparent',
                borderColor: isActive ? active : idleBorder,
              }]}
              activeOpacity={0.75}
            >
              <AppText
                style={[wr.btnTxt, { color: isActive ? activeTxt : active }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                maxFontSizeMultiplier={1.3}
              >
                {t(labelKey)}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>
      {/* Optional note */}
      <TextInput
        style={[wr.noteInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surface1 }]}
        placeholder={t('addNoteHint')}
        placeholderTextColor={theme.colors.mutedText}
        value={value.note}
        onChangeText={(txt) => onChange({ ...value, note: txt })}
        maxLength={120}
      />
    </View>
  );
}
const wr = StyleSheet.create({
  wrap:    { borderRadius: 14, borderWidth: 1, padding: 12, gap: 8, marginBottom: 10 },
  top:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:  { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  initials:{ fontSize: 15, fontWeight: '800' },
  name:    { fontSize: 14, fontWeight: '800', lineHeight: 19 },
  sub:     { fontSize: 11.5, color: SLATE, marginTop: 2 },
  btnRow:  { flexDirection: 'row', gap: 6 },
  btn:     { flex: 1, borderWidth: 1.5, borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
  btnTxt:  { fontSize: 11, fontWeight: '800' },
  noteInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12, marginTop: 2 },
});

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({ s }: { s: WorkerSummary }): React.JSX.Element {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const initials = (s.workerName ?? 'W')
    .split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  const effectiveDays = (s.daysPresent || 0) + ((s as any).daysHalfDay || 0) * 0.5;
  const pct = s.totalDaysMarked > 0 ? Math.round((effectiveDays / s.totalDaysMarked) * 100) : 0;
  const pctColor = pct >= 80 ? GREEN : pct >= 50 ? AMBER : RED;

  return (
    <View style={[sc.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={sc.row}>
        <View style={[sc.avatar, { backgroundColor: theme.colors.primaryLight }]}>
          <AppText style={[sc.initials, { color: BRAND }]}>{initials}</AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText style={[sc.name, { color: theme.colors.text }]} numberOfLines={2}>{s.workerName}</AppText>
          <AppText style={[sc.sub, { color: theme.colors.mutedText }]}>
            {s.agreedRate ? `₹${s.agreedRate}${s.rateType === 'Monthly' ? t('perMonth') : t('perDay')}` : t('rateNotSet')}
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
          <AppText style={[sc.statNum, { color: AMBER }]}>{(s as any).daysHalfDay || 0}</AppText>
          <AppText style={[sc.statLabel, { color: theme.colors.mutedText }]}>{t('halfDayStat')}</AppText>
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
  // Localize the requirement name (work-type · sub-category) to the active
  // language — all 11. subcatDisplay falls back to readable English per part.
  const localizedTitle = requirementTitle
    ? requirementTitle.split(' · ').map((p) => subcatDisplay(p.trim())).join(' · ')
    : '';
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<'mark' | 'summary'>('mark');
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [dayAttendance, setDayAttendance] = useState<DayAttendance>({});
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // ── Plan gate (mirror Analytics/Pipeline lock UX) ──────────────────────────
  const plan = usePlanFeatures();
  const attendanceLocked = plan.loaded && !plan.attendanceEnabled;

  // ── Data ─────────────────────────────────────────────────────────────────
  const attendanceQuery = useQuery({
    queryKey: ['employer-attendance', requirementId],
    queryFn: () => attendanceApi.getByRequirement(requirementId),
    enabled: !attendanceLocked,
    staleTime: 60 * 1000,
  });

  const summaryQuery = useQuery({
    queryKey: ['employer-attendance-summary', requirementId],
    queryFn: () => attendanceApi.getSummary(requirementId),
    enabled: activeTab === 'summary' && !attendanceLocked,
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

  const updateWorker = (mappingId: string, val: { status: AttStatus; note: string }) => {
    setDayAttendance((prev) => ({ ...prev, [mappingId]: val }));
  };

  // ── Submit for the day ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (joinedWorkers.length === 0) {
      toast.error(t('att_noWorkersMsg'), t('att_noWorkersTitle'));
      return;
    }
    setSubmitting(true);
    try {
      const records = joinedWorkers.map((w) => ({
        mappingId: w._id,
        status:    (dayAttendance[w._id] ?? seeded[w._id])?.status ?? 'present',
        note:      (dayAttendance[w._id] ?? seeded[w._id])?.note ?? '',
      }));
      await attendanceApi.markDay(requirementId, selectedDate, records);
      await qc.invalidateQueries({ queryKey: ['employer-attendance', requirementId] });
      await qc.invalidateQueries({ queryKey: ['employer-attendance-summary', requirementId] });
      toast.success(t('att_savedMsg', { date: formatDisplayDate(selectedDate) }), t('att_savedTitle'));
    } catch {
      toast.error(t('att_saveFailMsg'), t('att_saveFailTitle'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Mark-all shortcuts ────────────────────────────────────────────────────
  const markAll = (status: AttStatus) => {
    const updated: DayAttendance = {};
    for (const w of joinedWorkers) {
      updated[w._id] = { status, note: dayAttendance[w._id]?.note ?? '' };
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

  if (attendanceLocked) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />
        <ScreenHeader title={t('attendanceStat')} onBack={() => navigation.goBack()} />
        <ScrollView
          contentContainerStyle={[lock.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={lock.box}>
            <View style={lock.icon}>
              <AppText style={{ fontSize: 36 }}>🗓️</AppText>
            </View>
            <AppText style={[lock.title, { color: theme.colors.text }]}>{t('att_lockTitle')}</AppText>
            <AppText style={[lock.sub, { color: theme.colors.mutedText }]}>{t('att_lockDesc')}</AppText>
            <View style={[lock.benefits, { backgroundColor: theme.colors.surface1 }]}>
              {[t('att_lockBenefit1'), t('att_lockBenefit2'), t('att_lockBenefit3')].map((b, i) => (
                <View key={i} style={lock.row}>
                  <View style={lock.dot} />
                  <AppText style={[lock.benefitTxt, { color: theme.colors.textSecondary }]}>{b}</AppText>
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Subscription')} style={lock.btn} activeOpacity={0.85}>
              <AppText style={lock.btnTxt}>{t('pl_upgradeBtn')}</AppText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader
        title={localizedTitle || t('markAttendanceTab')}
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
                      <TouchableOpacity onPress={() => markAll('present')} style={[styles.markAllBtn, { backgroundColor: theme.colors.successLight, borderColor: '#6EE7B7' }]} activeOpacity={0.75}>
                        <AppText style={[styles.markAllTxt, { color: GREEN }]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>{t('allPresent')}</AppText>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => markAll('half_day')} style={[styles.markAllBtn, { backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }]} activeOpacity={0.75}>
                        <AppText style={[styles.markAllTxt, { color: AMBER }]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>{t('allHalf')}</AppText>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => markAll('absent')} style={[styles.markAllBtn, { backgroundColor: theme.colors.dangerLight, borderColor: '#FECACA' }]} activeOpacity={0.75}>
                        <AppText style={[styles.markAllTxt, { color: RED }]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>{t('allAbsent')}</AppText>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              }
              renderItem={({ item: worker }) => (
                <WorkerRow
                  worker={worker}
                  value={dayAttendance[worker._id] ?? seeded[worker._id] ?? { status: 'present' as AttStatus, note: '' }}
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
                  const presentCount = dayRecords.filter((r) => ((r as any).status || (r.present ? 'present' : 'absent')) !== 'absent').length;
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

  // Date block stacked above a full-width mark-all row so the three buttons
  // each get equal space and never clip their (localized) labels.
  dayHeader:     { marginBottom: 12 },
  dayHeaderDate: { fontSize: 15, fontWeight: '900' },
  dayHeaderSub:  { fontSize: 11.5, marginTop: 2 },
  markAllRow:    { flexDirection: 'row', gap: 6, marginTop: 10 },
  markAllBtn:    { flex: 1, alignItems: 'center', borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6 },
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

// ── Plan-lock upgrade wall (mirrors Analytics/Pipeline) ─────────────────────────
const lock = StyleSheet.create({
  scroll:    { flexGrow: 1, justifyContent: 'center', padding: 24 },
  box:       { alignItems: 'center' },
  icon:      { width: 88, height: 88, borderRadius: 24, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#93c5fd', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title:     { fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  sub:       { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  benefits:  { alignSelf: 'stretch', borderRadius: 16, padding: 16, gap: 12, marginBottom: 24 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: BRAND },
  benefitTxt:{ flex: 1, fontSize: 13.5, fontWeight: '600' },
  btn:       { alignSelf: 'stretch', backgroundColor: BRAND, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnTxt:    { color: WHITE, fontSize: 15, fontWeight: '800' },
});
