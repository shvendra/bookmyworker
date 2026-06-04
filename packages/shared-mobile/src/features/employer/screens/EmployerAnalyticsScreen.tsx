import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { apiClient } from '../../../core/api/client';
import { usePlanFeatures } from '../../../core/hooks/usePlanFeatures';
import { getCategoryLabel } from '../../../shared/utils/labelUtils';
import type { MainStackParamList } from '../../../app/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

// ─── Data shapes ──────────────────────────────────────────────────────────────
interface MonthPoint { label: string; posted: number; filled: number }
interface CategoryPoint { name: string; count: number; percent: number }
interface TimeToHirePoint { category: string; avgDays: number; count: number }
interface AnalyticsData {
  monthly:     MonthPoint[];
  categories:  CategoryPoint[];
  timeToHire:  TimeToHirePoint[];
  summary:     { totalPosted: number; totalFilled: number; totalOpen: number; fillRate: number };
}

// ─── Colour palette (monochromatic blue family — professional, mirrors CRM) ─────
const BRAND = '#1037A4';
const BLUE  = '#2563EB';
const GREEN = '#10B981';
const PALETTE = ['#2563EB', '#3B82F6', '#60A5FA', '#1E3A8A', '#93C5FD', '#475569', '#64748B', '#1D4ED8'];

// ─── KPI card (gradient-feel via solid colour + decorative circles) ─────────────
interface Kpi { value: string | number; label: string; icon: string; bg: string }

const KpiCard = ({ value, label, icon, bg }: Kpi): React.JSX.Element => (
  <View style={[kp.card, { backgroundColor: bg }]}>
    <View style={kp.circle1} />
    <View style={kp.circle2} />
    <View style={kp.iconBox}>
      <AppText style={kp.icon}>{icon}</AppText>
    </View>
    <AppText style={kp.value} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>{value}</AppText>
    <AppText style={kp.label} numberOfLines={2} maxFontSizeMultiplier={1.2}>{label}</AppText>
  </View>
);
const kp = StyleSheet.create({
  card:    { width: '48%', borderRadius: 20, padding: 16, minHeight: 116, overflow: 'hidden', justifyContent: 'space-between',
             shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 4 },
  circle1: { position: 'absolute', top: -22, right: -22, width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.10)' },
  circle2: { position: 'absolute', bottom: -28, right: 18, width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.07)' },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  icon:    { fontSize: 20 },
  value:   { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.6, lineHeight: 34 },
  label:   { fontSize: 12.5, fontWeight: '600', color: 'rgba(255,255,255,0.82)', marginTop: 2 },
});

// ─── Section card ─────────────────────────────────────────────────────────────
const Card = ({ title, subtitle, icon, accent = BRAND, children }: {
  title: string; subtitle?: string; icon: string; accent?: string; children: React.ReactNode;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View style={[sc.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={[sc.header, { borderBottomColor: theme.colors.divider, backgroundColor: accent + '0D' }]}>
        <View style={[sc.iconBox, { backgroundColor: accent + '1A', borderColor: accent + '33' }]}>
          <AppText style={sc.icon}>{icon}</AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText style={[sc.title, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{title}</AppText>
          {subtitle ? <AppText style={[sc.subtitle, { color: theme.colors.mutedText }]} maxFontSizeMultiplier={1.3}>{subtitle}</AppText> : null}
        </View>
      </View>
      <View style={sc.body}>{children}</View>
    </View>
  );
};
const sc = StyleSheet.create({
  card:     { borderRadius: 20, borderWidth: 1, overflow: 'hidden',
              shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  header:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBox:  { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  icon:     { fontSize: 16 },
  title:    { fontSize: 14.5, fontWeight: '800', letterSpacing: -0.2 },
  subtitle: { fontSize: 11.5, fontWeight: '500', marginTop: 1 },
  body:     { padding: 16, gap: 14 },
});

// ─── Grouped bar chart (pure RN, responsive) ───────────────────────────────────
const CHART_H = 150;
const LABEL_ROOM = 20;   // headroom above bars for the value label
const BAR_W = 14;

const BarChart = ({ data }: { data: MonthPoint[] }): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const maxVal = useMemo(
    () => Math.max(1, ...data.flatMap((d) => [d.posted, d.filled])),
    [data],
  );
  const usable = CHART_H - LABEL_ROOM;

  return (
    <View style={{ gap: 12 }}>
      {/* Legend */}
      <View style={bc.legend}>
        <View style={bc.legendRow}><View style={[bc.legendDot, { backgroundColor: BLUE }]} /><AppText style={[bc.legendTxt, { color: theme.colors.mutedText }]}>{t('legendPosted')}</AppText></View>
        <View style={bc.legendRow}><View style={[bc.legendDot, { backgroundColor: GREEN }]} /><AppText style={[bc.legendTxt, { color: theme.colors.mutedText }]}>{t('legendFilled')}</AppText></View>
      </View>

      {/* Plot area with gridlines */}
      <View style={{ height: CHART_H }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <View
            key={f}
            pointerEvents="none"
            style={[bc.gridline, { bottom: f * usable, backgroundColor: theme.colors.border }]}
          />
        ))}
        <View style={[bc.row, { height: CHART_H }]}>
          {data.map((d, i) => (
            <View key={i} style={bc.group}>
              <BarCol value={d.posted} h={(d.posted / maxVal) * usable} color={BLUE} />
              <BarCol value={d.filled} h={(d.filled / maxVal) * usable} color={GREEN} />
            </View>
          ))}
        </View>
      </View>

      {/* Month labels (aligned via matching flex:1 columns) */}
      <View style={{ flexDirection: 'row' }}>
        {data.map((d, i) => (
          <AppText key={i} style={[bc.monthLabel, { color: theme.colors.mutedText }]} numberOfLines={1}>{d.label}</AppText>
        ))}
      </View>
    </View>
  );
};

const BarCol = ({ value, h, color }: { value: number; h: number; color: string }): React.JSX.Element => (
  <View style={bc.barCol}>
    {value > 0 ? <AppText style={[bc.barVal, { color }]} maxFontSizeMultiplier={1.1}>{value}</AppText> : null}
    <View style={[bc.bar, { height: Math.max(3, h), backgroundColor: color }]} />
  </View>
);

const bc = StyleSheet.create({
  legend:     { flexDirection: 'row', gap: 18 },
  legendRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendTxt:  { fontSize: 12, fontWeight: '600' },
  gridline:   { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, opacity: 0.7 },
  row:        { flexDirection: 'row', alignItems: 'flex-end' },
  group:      { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 5 },
  barCol:     { alignItems: 'center', justifyContent: 'flex-end' },
  bar:        { width: BAR_W, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  barVal:     { fontSize: 10, fontWeight: '800', marginBottom: 3 },
  monthLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', marginTop: 6 },
});

// ─── Work-type distribution ─────────────────────────────────────────────────────
const CategoryChart = ({ data }: { data: CategoryPoint[] }): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <View style={{ gap: 12 }}>
      {/* Proportional strip */}
      <View style={[cs.strip, { backgroundColor: theme.colors.surface2 }]}>
        {data.map((d, i) => (
          <View key={i} style={{ flex: Math.max(d.count, 0.001), height: '100%', backgroundColor: PALETTE[i % PALETTE.length] }} />
        ))}
      </View>

      {/* Rows */}
      {data.map((d, i) => (
        <View key={i} style={cs.row}>
          <View style={[cs.dot, { backgroundColor: PALETTE[i % PALETTE.length] }]} />
          <AppText style={[cs.name, { color: theme.colors.text }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>{d.name}</AppText>
          <View style={[cs.chip, { backgroundColor: PALETTE[i % PALETTE.length] + '22' }]}>
            <AppText style={[cs.chipTxt, { color: PALETTE[i % PALETTE.length] }]}>{d.count}</AppText>
          </View>
          <AppText style={[cs.pct, { color: theme.colors.mutedText }]}>{d.percent}%</AppText>
        </View>
      ))}

      <AppText style={[cs.total, { color: theme.colors.mutedText }]}>{t('totalRequirements', { count: total })}</AppText>
    </View>
  );
};
const cs = StyleSheet.create({
  strip:   { height: 12, borderRadius: 8, flexDirection: 'row', overflow: 'hidden' },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot:     { width: 11, height: 11, borderRadius: 5.5, flexShrink: 0, marginTop: 2, alignSelf: 'flex-start' },
  name:    { flex: 1, fontSize: 12.5, fontWeight: '600', lineHeight: 17 },
  chip:    { minWidth: 26, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, alignItems: 'center' },
  chipTxt: { fontSize: 11, fontWeight: '800' },
  pct:     { width: 42, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  total:   { fontSize: 11.5, textAlign: 'right', marginTop: 2 },
});

// ─── Avg-days-to-hire bars ──────────────────────────────────────────────────────
const TimeToHireChart = ({ data }: { data: TimeToHirePoint[] }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const maxDays = useMemo(() => Math.max(1, ...data.map((d) => d.avgDays)), [data]);
  return (
    <View style={{ gap: 14 }}>
      {data.map((d, i) => {
        const color = PALETTE[i % PALETTE.length];
        return (
          <View key={i} style={{ gap: 6 }}>
            <View style={tt.head}>
              <AppText style={[tt.cat, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{d.category}</AppText>
              <AppText style={[tt.days, { color }]} maxFontSizeMultiplier={1.2}>{d.avgDays}d</AppText>
            </View>
            <View style={[tt.track, { backgroundColor: theme.colors.surface2 }]}>
              <View style={[tt.fill, { width: `${Math.max(5, (d.avgDays / maxDays) * 100)}%`, backgroundColor: color }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
};
const tt = StyleSheet.create({
  head:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cat:   { flex: 1, fontSize: 12.5, fontWeight: '700' },
  days:  { fontSize: 13, fontWeight: '800' },
  track: { height: 10, borderRadius: 99, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 99 },
});

// ─── Hiring funnel ──────────────────────────────────────────────────────────────
const HiringFunnel = ({ summary }: { summary: AnalyticsData['summary'] }): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const stages = [
    { label: t('legendPosted'), value: summary.totalPosted, color: BLUE,      icon: '📋' },
    { label: t('filled'),       value: summary.totalFilled, color: GREEN,     icon: '✅' },
    { label: t('open'),         value: summary.totalOpen,   color: '#475569', icon: '⏳' },
  ];
  const max = Math.max(1, summary.totalPosted);
  return (
    <View style={{ gap: 16 }}>
      {stages.map((s, i) => {
        const pct = Math.max(6, Math.round((s.value / max) * 100));
        return (
          <View key={i} style={{ gap: 8 }}>
            <View style={fn.head}>
              <View style={fn.left}>
                <View style={[fn.iconBox, { backgroundColor: s.color + '1A', borderColor: s.color + '33' }]}>
                  <AppText style={fn.icon}>{s.icon}</AppText>
                </View>
                <AppText style={[fn.label, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>{s.label}</AppText>
              </View>
              <AppText style={[fn.value, { color: s.color }]} maxFontSizeMultiplier={1.2}>{s.value}</AppText>
            </View>
            <View style={[fn.track, { backgroundColor: theme.colors.surface2 }]}>
              <View style={[fn.fill, { width: `${pct}%`, backgroundColor: s.color }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
};
const fn = StyleSheet.create({
  head:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  left:    { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconBox: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  icon:    { fontSize: 15 },
  label:   { fontSize: 13.5, fontWeight: '700' },
  value:   { fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  track:   { height: 14, borderRadius: 99, overflow: 'hidden' },
  fill:    { height: '100%', borderRadius: 99 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export const EmployerAnalyticsScreen = (): React.JSX.Element => {
  const { t } = useTranslation('employer');
  // Default namespace `t` — work-type category labels (cat_* keys) live there.
  const { t: tCommon } = useTranslation();
  const { theme } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  // ── Plan gate (mirror PipelineScreen lock/upgrade UX) ──────────────────────
  const plan = usePlanFeatures();
  const analyticsLocked = plan.loaded && !plan.analyticsEnabled;
  // Respect the plan's analytics window (Individual = 3 months, others = 12).
  const months = plan.analyticsMonths;

  const { data, isLoading, isError, refetch } = useQuery<AnalyticsData>({
    queryKey: ['employer-analytics', months],
    queryFn: async () => {
      const res = await apiClient.get<AnalyticsData & { success: boolean }>(
        `/api/v1/mobile/employer/analytics?months=${months}`,
      );
      return res.data;
    },
    enabled: !analyticsLocked,
    staleTime: 10 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
  });

  if (analyticsLocked) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />
        <ScreenHeader title={t('analyticsTitle')} onBack={() => navigation.goBack()} />
        <ScrollView
          contentContainerStyle={[al.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={al.box}>
            <View style={[al.icon, { backgroundColor: '#eff6ff', borderColor: '#93c5fd' }]}>
              <AppText style={{ fontSize: 36 }}>📊</AppText>
            </View>
            <AppText style={[al.title, { color: theme.colors.text }]}>{t('pl_analyticsPlanTitle')}</AppText>
            <AppText style={[al.sub, { color: theme.colors.mutedText }]}>{t('pl_analyticsPlanDesc')}</AppText>
            <View style={[al.benefits, { backgroundColor: theme.colors.surface1 }]}>
              {[t('pl_analyticsBenefit1'), t('pl_analyticsBenefit2'), t('pl_analyticsBenefit3'), t('pl_analyticsBenefit4')].map((b, i) => (
                <View key={i} style={al.row}>
                  <View style={al.dot} />
                  <AppText style={[al.benefitTxt, { color: theme.colors.textSecondary }]}>{b}</AppText>
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Subscription')} style={al.btn} activeOpacity={0.85}>
              <AppText style={al.btnTxt}>{t('pl_upgradeBtn')}</AppText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  const summary    = data?.summary;
  const monthly    = data?.monthly    ?? [];
  // Translate dynamic work-type names (all 11 languages) before rendering.
  const categories = useMemo(
    () => (data?.categories ?? []).map((c: CategoryPoint) => ({ ...c, name: getCategoryLabel(c.name, tCommon) })),
    [data?.categories, tCommon],
  );
  const timeToHire = useMemo(
    () => (data?.timeToHire ?? []).map((d: TimeToHirePoint) => ({ ...d, category: getCategoryLabel(d.category, tCommon) })),
    [data?.timeToHire, tCommon],
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />
        <ScreenHeader title={t('analyticsHeaderTitle')} onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={BRAND} />
          <AppText style={{ color: theme.colors.mutedText, marginTop: 12, fontSize: 13 }}>{t('buildingReport')}</AppText>
        </View>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />
        <ScreenHeader title={t('analyticsHeaderTitle')} onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
          <AppText style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>{t('couldntLoadAnalytics')}</AppText>
          <AppText style={{ color: theme.colors.mutedText, textAlign: 'center', lineHeight: 20 }}>{t('checkConnectionRetry')}</AppText>
          <TouchableOpacity onPress={() => void refetch()} style={{ backgroundColor: BRAND, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 }}>
            <AppText style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{t('retry')}</AppText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const hasData = monthly.length > 0 || categories.length > 0 || (summary?.totalPosted ?? 0) > 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader title={t('analyticsHeaderTitle')} onBack={() => navigation.goBack()} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void refetch()} tintColor={BRAND} />}
      >
        {/* ── KPI cards (2×2, responsive) ── */}
        <View style={a.kpiGrid}>
          <KpiCard value={summary?.totalPosted ?? 0}      label={t('totalPosted')} icon="📋" bg="#1E40AF" />
          <KpiCard value={summary?.totalFilled ?? 0}      label={t('filled')}      icon="✅" bg="#15803D" />
          <KpiCard value={summary?.totalOpen ?? 0}        label={t('open')}        icon="⏳" bg="#2563EB" />
          <KpiCard value={`${summary?.fillRate ?? 0}%`}   label={t('fillRate')}    icon="⚡" bg="#334155" />
        </View>

        {/* ── Requirements trend ── */}
        {monthly.length > 0 && (
          <Card title={t('requirementsLastNMonths', { months })} icon="📈" accent={BLUE}>
            <BarChart data={monthly} />
          </Card>
        )}

        {/* ── Work-type distribution ── */}
        {categories.length > 0 && (
          <Card title={t('workTypeDistribution')} icon="🍩" accent="#8B5CF6">
            <CategoryChart data={categories} />
          </Card>
        )}

        {/* ── Avg days to hire ── */}
        {timeToHire.length > 0 && (
          <Card title={t('avgDaysToHire')} subtitle={t('reqPostedToAssigned')} icon="⏱️" accent="#0EA5E9">
            <TimeToHireChart data={timeToHire} />
          </Card>
        )}

        {/* ── Hiring funnel ── */}
        {summary && summary.totalPosted > 0 && (
          <Card title={t('hiringFunnel')} subtitle={t('reqPostedToAssigned')} icon="🎯" accent="#16A34A">
            <HiringFunnel summary={summary} />
          </Card>
        )}

        {/* ── Empty state ── */}
        {!hasData && (
          <View style={{ alignItems: 'center', paddingVertical: 56 }}>
            <AppText style={{ fontSize: 52, marginBottom: 12 }}>📊</AppText>
            <AppText style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text, textAlign: 'center', marginBottom: 8 }}>{t('noDataYet')}</AppText>
            <AppText style={{ color: theme.colors.mutedText, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 }}>
              {t('noDataDesc')}
            </AppText>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const a = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
});

// ─── Plan-lock styles (mirror PipelineScreen) ──────────────────────────────────
const al = StyleSheet.create({
  scroll:     { flexGrow: 1, justifyContent: 'center' },
  box:        { alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 40 },
  icon:       { width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  sub:        { fontSize: 13.5, textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 },
  benefits:   { width: '100%', borderRadius: 14, padding: 16, gap: 10 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot:        { width: 7, height: 7, borderRadius: 3.5, backgroundColor: BRAND, flexShrink: 0 },
  benefitTxt: { fontSize: 13, fontWeight: '500', flex: 1 },
  btn:        { width: '100%', borderRadius: 14, paddingVertical: 16, alignItems: 'center', backgroundColor: BRAND },
  btnTxt:     { color: '#fff', fontSize: 15, fontWeight: '800' },
});
