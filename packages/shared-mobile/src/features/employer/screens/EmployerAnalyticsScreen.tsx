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

// ─── Colour palette ───────────────────────────────────────────────────────────
const BRAND = '#1037A4';
const PALETTE = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#EC4899','#14B8A6','#F97316'];
const C = {
  navy:     '#0f172a',
  slate:    '#64748b',
  border:   '#e2e8f0',
  surface:  '#f8fafc',
  white:    '#ffffff',
  green:    '#16a34a',
  greenSoft:'#f0fdf4',
  amber:    '#d97706',
  amberSoft:'#fffbeb',
};

// ─── Summary tile ─────────────────────────────────────────────────────────────
const SummaryTile = ({ value, label, color, bg }: { value: string | number; label: string; color: string; bg: string }) => (
  <View style={[st.tile, { backgroundColor: bg }]}>
    <AppText style={[st.val, { color }]}>{value}</AppText>
    <AppText style={st.lbl}>{label}</AppText>
  </View>
);
const st = StyleSheet.create({
  tile: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 2 },
  val:  { fontSize: 22, fontWeight: '900' },
  lbl:  { fontSize: 11, fontWeight: '600', color: C.slate, textAlign: 'center' },
});

// ─── Bar chart (pure RN) ──────────────────────────────────────────────────────
const BAR_HEIGHT = 140;
const BAR_W_PAIR = 20; // width of one bar

const BarChart = ({ data }: { data: MonthPoint[] }) => {
  const { t } = useTranslation('employer');
  const maxVal = useMemo(() => Math.max(1, ...data.map((d) => Math.max(d.posted, d.filled))), [data]);
  return (
    <View style={bc.wrap}>
      {/* Legend */}
      <View style={bc.legend}>
        <View style={bc.legendRow}><View style={[bc.legendDot, { backgroundColor: BRAND }]} /><AppText style={bc.legendTxt}>{t('legendPosted')}</AppText></View>
        <View style={bc.legendRow}><View style={[bc.legendDot, { backgroundColor: '#10B981' }]} /><AppText style={bc.legendTxt}>{t('legendFilled')}</AppText></View>
      </View>

      {/* Bars */}
      <View style={bc.chart}>
        {data.map((d, i) => {
          const postedH = Math.max(2, (d.posted / maxVal) * BAR_HEIGHT);
          const filledH = Math.max(2, (d.filled / maxVal) * BAR_HEIGHT);
          return (
            <View key={i} style={bc.group}>
              {/* Posted bar */}
              <View style={bc.barWrap}>
                {d.posted > 0 && (
                  <AppText style={[bc.barVal, { color: BRAND }]}>{d.posted}</AppText>
                )}
                <View style={[bc.bar, { height: postedH, backgroundColor: BRAND, opacity: 0.85 }]} />
              </View>
              {/* Filled bar */}
              <View style={bc.barWrap}>
                {d.filled > 0 && (
                  <AppText style={[bc.barVal, { color: '#10B981' }]}>{d.filled}</AppText>
                )}
                <View style={[bc.bar, { height: filledH, backgroundColor: '#10B981', opacity: 0.85 }]} />
              </View>
              <AppText style={bc.monthLabel}>{d.label}</AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const bc = StyleSheet.create({
  wrap:        { gap: 12 },
  legend:      { flexDirection: 'row', gap: 16, paddingLeft: 4 },
  legendRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendTxt:   { fontSize: 11, fontWeight: '600', color: C.slate },
  chart:       { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: BAR_HEIGHT + 30, paddingHorizontal: 2 },
  group:       { alignItems: 'center', gap: 2, flex: 1 },
  barWrap:     { alignItems: 'center', justifyContent: 'flex-end', height: BAR_HEIGHT, width: BAR_W_PAIR },
  bar:         { width: BAR_W_PAIR, borderTopLeftRadius: 5, borderTopRightRadius: 5, minHeight: 2 },
  barVal:      { fontSize: 9, fontWeight: '800', marginBottom: 2 },
  monthLabel:  { fontSize: 9, fontWeight: '700', color: C.slate, marginTop: 4 },
});

// ─── Category pill chart ──────────────────────────────────────────────────────
const CategoryPillChart = ({ data }: { data: CategoryPoint[] }) => {
  const { t } = useTranslation('employer');
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <View style={cp.wrap}>
      {/* Proportional strip */}
      <View style={cp.strip}>
        {data.map((d, i) => (
          <View key={i} style={{ flex: d.count, height: '100%', backgroundColor: PALETTE[i % PALETTE.length], borderRadius: i === 0 ? 8 : i === data.length - 1 ? 8 : 0 }} />
        ))}
      </View>

      {/* Rows */}
      {data.map((d, i) => (
        <View key={i} style={cp.row}>
          <View style={[cp.dot, { backgroundColor: PALETTE[i % PALETTE.length] }]} />
          <AppText style={cp.name} numberOfLines={1}>{d.name}</AppText>
          <AppText style={cp.count}>{d.count}</AppText>
          <View style={cp.barWrap}>
            <View style={[cp.bar, { width: `${d.percent}%`, backgroundColor: PALETTE[i % PALETTE.length] }]} />
          </View>
          <AppText style={[cp.pct, { color: PALETTE[i % PALETTE.length] }]}>{d.percent}%</AppText>
        </View>
      ))}

      <AppText style={cp.total}>{t('totalRequirements', { count: total })}</AppText>
    </View>
  );
};
const cp = StyleSheet.create({
  wrap:    { gap: 10 },
  strip:   { height: 12, borderRadius: 8, flexDirection: 'row', overflow: 'hidden', backgroundColor: C.border, marginBottom: 4 },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:     { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  name:    { flex: 1, fontSize: 12, fontWeight: '600', color: C.navy },
  count:   { width: 22, fontSize: 12, fontWeight: '800', color: C.navy, textAlign: 'right' },
  barWrap: { width: 80, height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  bar:     { height: '100%', borderRadius: 3 },
  pct:     { width: 34, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  total:   { fontSize: 11, color: C.slate, textAlign: 'right', marginTop: 2 },
});

// ─── Time-to-hire bars ────────────────────────────────────────────────────────
const TimeToHireChart = ({ data }: { data: TimeToHirePoint[] }) => {
  const maxDays = useMemo(() => Math.max(1, ...data.map((d) => d.avgDays)), [data]);
  return (
    <View style={th.wrap}>
      {data.map((d, i) => (
        <View key={i} style={th.row}>
          <AppText style={th.cat} numberOfLines={1}>{d.category}</AppText>
          <View style={th.barWrap}>
            <View style={[th.bar, { width: `${Math.max(4, (d.avgDays / maxDays) * 100)}%`, backgroundColor: PALETTE[i % PALETTE.length] }]} />
          </View>
          <AppText style={th.days}>{d.avgDays}d</AppText>
        </View>
      ))}
    </View>
  );
};
const th = StyleSheet.create({
  wrap:    { gap: 10 },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cat:     { width: 80, fontSize: 11, fontWeight: '600', color: C.navy },
  barWrap: { flex: 1, height: 12, backgroundColor: C.border, borderRadius: 6, overflow: 'hidden' },
  bar:     { height: '100%', borderRadius: 6 },
  days:    { width: 32, fontSize: 11, fontWeight: '800', color: C.slate, textAlign: 'right' },
});

// ─── Section card ─────────────────────────────────────────────────────────────
const Card = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const { theme } = useAppTheme();
  return (
    <View style={[sc.card, { backgroundColor: theme.colors.card }]}>
      <View style={sc.titleRow}>
        <AppText style={sc.title}>{title}</AppText>
      </View>
      {children}
    </View>
  );
};
const sc = StyleSheet.create({
  card:     { borderRadius: 18, padding: 16, gap: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  titleRow: { borderLeftWidth: 3, borderLeftColor: BRAND, paddingLeft: 10 },
  title:    { fontSize: 14, fontWeight: '800', color: C.navy },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export const EmployerAnalyticsScreen = (): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch } = useQuery<AnalyticsData>({
    queryKey: ['employer-analytics'],
    queryFn: async () => {
      const res = await apiClient.get<AnalyticsData & { success: boolean }>('/api/v1/mobile/employer/analytics');
      return res.data;
    },
    staleTime: 10 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
  });

  const summary    = data?.summary;
  const monthly    = data?.monthly    ?? [];
  const categories = data?.categories ?? [];
  const timeToHire = data?.timeToHire ?? [];

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />
        <ScreenHeader title={t('analyticsTitle')} onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={BRAND} />
          <AppText style={{ color: C.slate, marginTop: 12, fontSize: 13 }}>{t('buildingReport')}</AppText>
        </View>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />
        <ScreenHeader title={t('analyticsTitle')} onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
          <AppText style={{ fontSize: 18, fontWeight: '800', color: C.navy }}>{t('couldntLoadAnalytics')}</AppText>
          <AppText style={{ color: C.slate, textAlign: 'center', lineHeight: 20 }}>{t('checkConnectionRetry')}</AppText>
          <TouchableOpacity onPress={() => void refetch()} style={{ backgroundColor: BRAND, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 }}>
            <AppText style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{t('retry')}</AppText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
        {/* ── Summary tiles ── */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SummaryTile value={summary?.totalPosted ?? 0} label={t('totalPosted')} color={BRAND} bg="#EBF1FF" />
          <SummaryTile value={summary?.totalFilled ?? 0} label={t('filled')} color={C.green} bg={C.greenSoft} />
          <SummaryTile value={summary?.totalOpen ?? 0} label={t('open')} color={C.amber} bg={C.amberSoft} />
          <SummaryTile value={`${summary?.fillRate ?? 0}%`} label={t('fillRate')} color="#7C3AED" bg="#F5F3FF" />
        </View>

        {/* ── Monthly bar chart ── */}
        {monthly.length > 0 && (
          <Card title={t('requirementsLast6Months')}>
            <BarChart data={monthly} />
          </Card>
        )}

        {/* ── Category breakdown ── */}
        {categories.length > 0 && (
          <Card title={t('workTypeDistribution')}>
            <CategoryPillChart data={categories} />
          </Card>
        )}

        {/* ── Time to hire ── */}
        {timeToHire.length > 0 && (
          <Card title={t('avgDaysToHire')}>
            <AppText style={{ fontSize: 11, color: C.slate, marginBottom: 4 }}>
              {t('reqPostedToAssigned')}
            </AppText>
            <TimeToHireChart data={timeToHire} />
          </Card>
        )}

        {monthly.length === 0 && categories.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <AppText style={{ fontSize: 48, marginBottom: 12 }}>📊</AppText>
            <AppText style={{ fontSize: 18, fontWeight: '800', color: C.navy, textAlign: 'center', marginBottom: 8 }}>{t('noDataYet')}</AppText>
            <AppText style={{ color: C.slate, textAlign: 'center', lineHeight: 20 }}>
              {t('noDataDesc')}
            </AppText>
          </View>
        )}
      </ScrollView>
    </View>
  );
};
