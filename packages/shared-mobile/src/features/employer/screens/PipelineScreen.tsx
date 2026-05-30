import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl,
  ScrollView, StatusBar, StyleSheet, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { AppText } from '../../../shared/components/ui/AppText';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useAppTheme } from '../../../core/theme';
import { useAuth } from '../../../state/auth/AuthContext';
import { apiClient } from '../../../core/api/client';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { RawRequirement } from '../../../core/api/endpoints/requirementsApi';
import { workerMappingApi } from '../../../core/api/endpoints/workerMappingApi';
import { useTranslation } from 'react-i18next';
import type { MainStackParamList } from '../../../app/navigation/types';
import i18n from '../../../core/i18n';
import { getLocationStr } from '../../../shared/utils/labelUtils';

type Props = NativeStackScreenProps<MainStackParamList, 'EmployerPipeline'>;

const BRAND = '#1037A4';
// PIPE_LABELS is now built dynamically inside PipelineStepper using t()
type StageKey = 'Shortlisted' | 'Selected' | 'Joined';
type Counts = Record<StageKey, number>;

function deriveStage(req: RawRequirement, counts: Counts): number {
  const s = (req.status ?? '').toLowerCase();
  if (s === 'completed') return 4;
  if (counts.Joined > 0) return 3;
  if (counts.Shortlisted > 0 || counts.Selected > 0) return 2;
  if ((req.intrestedAgents ?? []).length > 0) return 1;
  return 0;
}

// ─── Progress stepper ─────────────────────────────────────────────────────────
const PipelineStepper = ({ activeIdx }: { activeIdx: number }): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const pipeLabels = [t('stagePosted'), t('stageResponding'), t('stageShortlisted'), t('stageHired'), t('stageCompleted')];
  return (
    <View style={[ps.wrap, { backgroundColor: theme.colors.surface1 }]}>
      {pipeLabels.map((label, i) => {
        const done    = i < activeIdx;
        const current = i === activeIdx;
        const filled  = done || current;
        const leftLine  = i > 0 ? (done || current ? BRAND : theme.colors.border) : 'transparent';
        const rightLine = i < pipeLabels.length - 1 ? (done ? BRAND : theme.colors.border) : 'transparent';
        return (
          <View key={label} style={ps.step}>
            <View style={ps.connRow}>
              <View style={[ps.line, { backgroundColor: leftLine }]} />
              <View style={[ps.circle, {
                backgroundColor: filled ? BRAND : theme.colors.surface,
                borderColor:     filled ? BRAND : theme.colors.border,
              }]}>
                <AppText style={[ps.circleNum, { color: filled ? '#fff' : theme.colors.mutedText }]}>
                  {done ? '✓' : String(i + 1)}
                </AppText>
              </View>
              <View style={[ps.line, { backgroundColor: rightLine }]} />
            </View>
            <AppText style={[ps.label, {
              color:      current ? BRAND : done ? theme.colors.textSecondary : theme.colors.mutedText,
              fontWeight: current ? '800' : '600',
            }]} numberOfLines={1}>
              {label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
};
const ps = StyleSheet.create({
  wrap:      { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, marginVertical: 2 },
  step:      { flex: 1, alignItems: 'center' },
  connRow:   { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 4 },
  line:      { flex: 1, height: 2 },
  circle:    { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  circleNum: { fontSize: 8, fontWeight: '900', lineHeight: 10 },
  label:     { fontSize: 8, textAlign: 'center', lineHeight: 12, letterSpacing: 0.1 },
});

// ─── Requirement card ─────────────────────────────────────────────────────────
const ReqCard = ({
  req, counts, stageIdx, onPress,
}: {
  req: RawRequirement; counts: Counts; stageIdx: number; onPress: () => void;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const title = [req.workType, req.subCategory]
    .filter(Boolean)
    .map(s => capitalize((s ?? '').replace(/_/g, ' ')))
    .join(' · ');
  const location = getLocationStr({ district: req.district, state: req.state }, i18n.language, '');
  const interestedCount = (req.intrestedAgents ?? []).length;
  const statusRaw = (req.status ?? '').toLowerCase();
  const isOpen = statusRaw !== 'closed' && statusRaw !== 'expired' && statusRaw !== 'completed';
  const statusColor = isOpen ? theme.colors.success : theme.colors.mutedText;
  const statusBg    = isOpen ? theme.colors.successLight : theme.colors.surface1;

  const countValues: Record<'Interested' | 'Shortlisted' | 'Selected' | 'Joined', number> = {
    Interested:  interestedCount,
    Shortlisted: counts.Shortlisted,
    Selected:    counts.Selected,
    Joined:      counts.Joined,
  };

  const countStyles = [
    { key: 'Interested' as const,  emoji: '👀', color: theme.colors.warning,   bg: theme.colors.warningLight,   border: theme.colors.warning + '55' },
    { key: 'Shortlisted' as const, emoji: '🔖', color: theme.colors.primary,   bg: theme.colors.primaryLight,   border: theme.colors.primary + '55' },
    { key: 'Selected' as const,    emoji: '✅', color: theme.colors.secondary,  bg: theme.colors.secondaryLight, border: theme.colors.secondary + '55' },
    { key: 'Joined' as const,      emoji: '🤝', color: theme.colors.success,   bg: theme.colors.successLight,   border: theme.colors.success + '55' },
  ];

  return (
    <TouchableOpacity onPress={onPress} style={[rc.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} activeOpacity={0.88}>
      <View style={rc.header}>
        <View style={{ flex: 1 }}>
          <AppText style={[rc.title, { color: theme.colors.text }]} numberOfLines={2}>{title || 'Requirement'}</AppText>
          <AppText style={[rc.sub, { color: theme.colors.mutedText }]} numberOfLines={1}>
            {req.ERN_NUMBER ? `ERN #${req.ERN_NUMBER}` : ''}
            {req.ERN_NUMBER && location ? '  ·  ' : ''}
            {location}
          </AppText>
        </View>
        <View style={[rc.statusBadge, { backgroundColor: statusBg }]}>
          <View style={[rc.statusDot, { backgroundColor: statusColor }]} />
          <AppText style={[rc.statusTxt, { color: statusColor }]}>{req.status ?? 'Open'}</AppText>
        </View>
      </View>

      <PipelineStepper activeIdx={stageIdx} />

      <View style={rc.countsRow}>
        {countStyles.map(cs => (
          <View key={cs.key} style={[rc.countPill, { backgroundColor: cs.bg, borderColor: cs.border }]}>
            <AppText style={rc.countEmoji}>{cs.emoji}</AppText>
            <AppText style={[rc.countNum, { color: cs.color }]}>{countValues[cs.key]}</AppText>
            <AppText style={[rc.countLabel, { color: cs.color }]}>{cs.key}</AppText>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
};
const rc = StyleSheet.create({
  card:        { borderRadius: 18, borderWidth: 1, marginBottom: 12, padding: 14, gap: 10, elevation: 2, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  header:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title:       { fontSize: 14, fontWeight: '800', lineHeight: 20 },
  sub:         { fontSize: 11.5, marginTop: 3 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusTxt:   { fontSize: 10, fontWeight: '700' },
  countsRow:   { flexDirection: 'row', gap: 6 },
  countPill:   { flex: 1, borderRadius: 10, borderWidth: 1, alignItems: 'center', paddingVertical: 7, gap: 1 },
  countEmoji:  { fontSize: 14 },
  countNum:    { fontSize: 15, fontWeight: '900', lineHeight: 19 },
  countLabel:  { fontSize: 7.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export const PipelineScreen = ({ navigation }: Props): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme }  = useAppTheme();
  const insets     = useSafeAreaInsets();
  const { state: authState } = useAuth();
  const userId = authState.session?.user?.id;

  // ── Subscription check ──────────────────────────────────────────────────
  const profileQuery = useQuery({
    queryKey: ['pipeline-profile'],
    queryFn: async () => {
      const res = await apiClient.get<{ user?: { isSubscribed?: boolean; subscriptionExpery?: string } }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const isSubscribed = (() => {
    const p = profileQuery.data;
    if (!p?.isSubscribed) return false;
    const exp = p.subscriptionExpery;
    if (!exp) return true;
    return new Date(exp).getTime() > Date.now();
  })();

  // ── Employer requirements (for interested agent counts) ─────────────────
  const reqListQuery = useQuery({
    queryKey: ['pipeline-req-list', userId],
    queryFn: () => requirementsApi.listForRole({ role: 'employer', userId: userId ?? '', limit: 50, page: 1 }),
    enabled: isSubscribed && profileQuery.isSuccess && !!userId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // ── Pipeline mapping data per requirement ────────────────────────────────
  const pipelineQuery = useQuery({
    queryKey: ['employer-pipeline-full'],
    queryFn: () => workerMappingApi.getEmployerPipelineOverview(),
    enabled: isSubscribed && profileQuery.isSuccess,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // ── Merge requirements + pipeline counts ─────────────────────────────────
  const pipelineByReqId = new Map(
    (pipelineQuery.data?.requirements ?? [])
      .filter(e => e.requirement != null)
      .map(e => [String(e.requirement._id), e]),
  );
  const mergedReqs = (reqListQuery.data?.requirements ?? []).map(req => {
    const entry  = pipelineByReqId.get(String(req._id));
    const counts = entry?.counts ?? { Shortlisted: 0, Selected: 0, Joined: 0 };
    return { req, counts, stageIdx: deriveStage(req, counts) };
  });
  const totals = pipelineQuery.data?.totals ?? { Shortlisted: 0, Selected: 0, Joined: 0 };

  // ── Loading / refreshing ─────────────────────────────────────────────────
  const isLoading  = profileQuery.isLoading || (isSubscribed && (reqListQuery.isLoading || pipelineQuery.isLoading));
  const isFetching = reqListQuery.isFetching || pipelineQuery.isFetching;

  useFocusEffect(
    useCallback(() => {
      if (profileQuery.isStale) void profileQuery.refetch();
    }, [profileQuery]),
  );

  const handleRefresh = useCallback(() => {
    void Promise.all([reqListQuery.refetch(), pipelineQuery.refetch()]);
  }, [reqListQuery, pipelineQuery]);

  // ── Lock screen ───────────────────────────────────────────────────────────
  const renderLock = (): React.JSX.Element => (
    <ScrollView
      contentContainerStyle={[ls.scroll, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={ls.box}>
        <View style={[ls.icon, { backgroundColor: theme.colors.warningLight, borderColor: theme.colors.warning + '55' }]}><AppText style={{ fontSize: 36 }}>🔒</AppText></View>
        <AppText style={[ls.title, { color: theme.colors.text }]}>{t('noActiveSubscription')}</AppText>
        <AppText style={[ls.sub, { color: theme.colors.mutedText }]}>{t('pipelineSubscribeDesc')}</AppText>
        <View style={[ls.benefits, { backgroundColor: theme.colors.surface1 }]}>
          {([t('pipelineBenefit1'), t('pipelineBenefit2'), t('pipelineBenefit3'), t('pipelineBenefit4')] as string[]).map((b, i) => (
            <View key={i} style={ls.row}>
              <View style={ls.dot} />
              <AppText style={[ls.benefitTxt, { color: theme.colors.textSecondary }]}>{b}</AppText>
            </View>
          ))}
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Subscription')} style={[ls.btn, { backgroundColor: theme.colors.text }]} activeOpacity={0.85}>
          <AppText style={ls.btnTxt}>{t('viewSubscriptionPlans')}</AppText>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader title={t('hiringPipeline')} onBack={() => navigation.goBack()} />

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#2563eb" size="large" />
        </View>
      ) : profileQuery.isSuccess && !isSubscribed ? (
        renderLock()
      ) : (
        <FlatList
          data={mergedReqs}
          keyExtractor={(item) => String(item.req._id)}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={handleRefresh}
              tintColor="#2563eb"
            />
          }
          ListHeaderComponent={
            <View>
              {/* Global totals summary */}
              <View style={sg.row}>
                {[
                  { key: 'Shortlisted' as StageKey, color: theme.colors.primary,   bg: theme.colors.primaryLight,   border: theme.colors.primary + '55',   emoji: '🔖' },
                  { key: 'Selected'    as StageKey, color: theme.colors.secondary,  bg: theme.colors.secondaryLight, border: theme.colors.secondary + '55', emoji: '✅' },
                  { key: 'Joined'      as StageKey, color: theme.colors.success,   bg: theme.colors.successLight,   border: theme.colors.success + '55',   emoji: '🤝' },
                ].map(s => (
                  <View key={s.key} style={[sg.cell, { backgroundColor: s.bg, borderColor: s.border }]}>
                    <AppText style={sg.emoji}>{s.emoji}</AppText>
                    <AppText style={[sg.count, { color: s.color }]}>
                      {pipelineQuery.isLoading ? '—' : String(totals[s.key] ?? 0)}
                    </AppText>
                    <AppText style={[sg.label, { color: s.color }]}>{s.key}</AppText>
                  </View>
                ))}
              </View>
              <AppText style={[sg.sectionTitle, { color: theme.colors.mutedText }]}>{t('allRequirements', { count: mergedReqs.length })}</AppText>
            </View>
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={sg.emptyBox}>
                <AppText style={sg.emptyEmoji}>📋</AppText>
                <AppText style={[sg.emptyTitle, { color: theme.colors.text }]}>{t('noRequirementsTitle')}</AppText>
                <AppText style={[sg.emptySub, { color: theme.colors.mutedText }]}>{t('noRequirementsDesc')}</AppText>
                <TouchableOpacity
                  onPress={() => navigation.navigate('PostRequirement')}
                  style={sg.postBtn}
                  activeOpacity={0.85}
                >
                  <AppText style={sg.postBtnTxt}>{t('postARequirement')}</AppText>
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <ReqCard
              req={item.req}
              counts={item.counts}
              stageIdx={item.stageIdx}
              onPress={() => navigation.navigate('RequirementDetail', { requirementId: String(item.req._id) })}
            />
          )}
        />
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const sg = StyleSheet.create({
  row:          { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 4 },
  cell:         { flex: 1, borderRadius: 14, borderWidth: 1.5, padding: 12, alignItems: 'center', gap: 3 },
  emoji:        { fontSize: 18 },
  count:        { fontSize: 22, fontWeight: '900' },
  label:        { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionTitle: { fontSize: 12, fontWeight: '800', marginTop: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyBox:     { alignItems: 'center', paddingVertical: 44, gap: 8 },
  emptyEmoji:   { fontSize: 44 },
  emptyTitle:   { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptySub:     { fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
  postBtn:      { marginTop: 8, backgroundColor: BRAND, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  postBtnTxt:   { fontSize: 13, fontWeight: '800', color: '#fff' },
});

const ls = StyleSheet.create({
  scroll:     { flexGrow: 1, justifyContent: 'center' },
  box:        { alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 40 },
  icon:       { width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  sub:        { fontSize: 13.5, textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 },
  benefits:   { width: '100%', borderRadius: 14, padding: 16, gap: 10 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot:        { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#2563eb', flexShrink: 0 },
  benefitTxt: { fontSize: 13, fontWeight: '500', flex: 1 },
  btn:        { width: '100%', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnTxt:     { color: '#fff', fontSize: 15, fontWeight: '800' },
});
