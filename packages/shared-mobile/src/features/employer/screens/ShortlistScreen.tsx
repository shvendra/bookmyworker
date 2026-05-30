import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppTheme } from '../../../core/theme';
import { shortlistStorage } from '../../../core/storage/shortlistStorage';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import type { WorkerDetail } from '../../../core/api/endpoints/workerApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { useToast } from '../../../shared/state/toast/ToastContext';
import type { MainStackParamList } from '../../../app/navigation/types';
import i18n from '../../../core/i18n';
import { useTranslation } from 'react-i18next';
import { getLocationStr } from '../../../shared/utils/labelUtils';

type Props = NativeStackScreenProps<MainStackParamList, 'Shortlist'>;

// ─── Design tokens ─────────────────────────────────────────────────────────────
const BRAND      = '#1037A4';
const BRAND_MID  = '#1A56DB';
const BRAND_SOFT = '#EBF1FF';
const NAVY       = '#0F172A';
const SLATE      = '#64748B';
const BORDER     = '#E2E8F0';
const GREEN      = '#059669';
const GREEN_SOFT = '#ECFDF5';
const GREEN_BDR  = '#6EE7B7';
const RED        = '#DC2626';
const WHITE      = '#FFFFFF';

const AVATAR_PALETTES = [
  { bg: '#EBF1FF', text: BRAND_MID },
  { bg: '#F5F3FF', text: '#7C3AED' },
  { bg: '#ECFDF5', text: GREEN },
  { bg: '#FFF7ED', text: '#EA580C' },
  { bg: '#FEF2F2', text: '#DC2626' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatAreas = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return (raw as string[])
    .map((a) => String(a).replace(/_/g, ' ').trim())
    .map((a) => a.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '))
    .filter((v) => v && !seen.has(v) && seen.add(v));
};

// ─── Worker Card ──────────────────────────────────────────────────────────────
function WorkerCard({
  worker,
  idx,
  onPress,
  onRemove,
  removing,
}: {
  worker: WorkerDetail;
  idx: number;
  onPress: () => void;
  onRemove: () => void;
  removing: boolean;
}): React.JSX.Element {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const palette = AVATAR_PALETTES[idx % AVATAR_PALETTES.length]!;
  const name = worker.name ?? 'Unknown';
  const initials = name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  const areas = formatAreas(worker.areasOfWork ?? []);
  const location = getLocationStr({ tehsil: worker.block, district: worker.district, state: worker.state }, i18n.language, '');
  const wage = worker.fixedSalary ?? worker.salaryFrom;
  const isVerified = worker.status === 'Verified' || worker.veryfiedBage === true;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[wc.wrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
    >
      {/* Avatar + info */}
      <View style={wc.top}>
        <View style={[wc.avatar, { backgroundColor: palette.bg }]}>
          <AppText style={[wc.initials, { color: palette.text }]}>{initials}</AppText>
          {isVerified && (
            <View style={wc.verifiedDot}>
              <AppText style={{ color: WHITE, fontSize: 8, fontWeight: '900' }}>✓</AppText>
            </View>
          )}
        </View>

        <View style={{ flex: 1, gap: 3 }}>
          <AppText style={[wc.name, { color: theme.colors.text }]} numberOfLines={1}>
            {name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
          </AppText>
          {!!location && (
            <AppText style={[wc.location, { color: theme.colors.mutedText }]} numberOfLines={1}>📍 {location}</AppText>
          )}
          {wage != null && (
            <View style={[wc.wagePill, { backgroundColor: theme.colors.successLight, borderColor: GREEN_BDR }]}>
              <AppText style={wc.wageTxt}>₹{wage}/day</AppText>
            </View>
          )}
        </View>

        {/* Remove button */}
        <TouchableOpacity
          onPress={onRemove}
          style={wc.removeBtn}
          activeOpacity={0.75}
          disabled={removing}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {removing
            ? <ActivityIndicator size="small" color={RED} />
            : <AppText style={wc.removeIcon}>♥</AppText>
          }
        </TouchableOpacity>
      </View>

      {/* Skills chips */}
      {areas.length > 0 && (
        <View style={wc.skillsRow}>
          {areas.slice(0, 3).map((skill) => (
            <View key={skill} style={[wc.skillChip, { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary + '55' }]}>
              <AppText style={[wc.skillTxt, { color: theme.colors.primary }]}>{skill}</AppText>
            </View>
          ))}
          {areas.length > 3 && (
            <View style={[wc.skillChip, { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary + '55' }]}>
              <AppText style={[wc.skillTxt, { color: theme.colors.primary }]}>+{areas.length - 3}</AppText>
            </View>
          )}
        </View>
      )}

      {/* Footer */}
      <View style={[wc.footer, { borderTopColor: theme.colors.divider }]}>
        <AppText style={[wc.viewProfile, { color: theme.colors.primary }]}>{t('viewProfile')}</AppText>
      </View>
    </TouchableOpacity>
  );
}

const wc = StyleSheet.create({
  wrap:        { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10, elevation: 1, shadowColor: NAVY, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  top:         { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar:      { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' },
  initials:    { fontSize: 18, fontWeight: '800' },
  verifiedDot: { position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: WHITE },
  name:        { fontSize: 15, fontWeight: '800', textTransform: 'capitalize' },
  location:    { fontSize: 12 },
  wagePill:    { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  wageTxt:     { fontSize: 11, fontWeight: '700', color: GREEN },
  removeBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FECACA', flexShrink: 0 },
  removeIcon:  { fontSize: 18, color: RED },
  skillsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skillChip:   { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  skillTxt:    { fontSize: 11, fontWeight: '600' },
  footer:      { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  viewProfile: { fontSize: 12, fontWeight: '700', textAlign: 'right' },
});

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyShortlist(): React.JSX.Element {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  return (
    <View style={es.wrap}>
      <View style={[es.iconWrap, { backgroundColor: theme.colors.dangerLight }]}>
        <AppText style={es.icon}>🤍</AppText>
      </View>
      <AppText style={[es.title, { color: theme.colors.text }]}>{t('shortlistEmpty')}</AppText>
      <AppText style={[es.sub, { color: theme.colors.mutedText }]}>{t('shortlistEmptyDesc')}</AppText>
      <View style={[es.tipRow, { backgroundColor: theme.colors.warningLight, borderColor: theme.colors.warning + '66' }]}>
        <AppText style={es.tipIcon}>💡</AppText>
        <AppText style={[es.tipTxt, { color: theme.colors.warning }]}>{t('shortlistTip')}</AppText>
      </View>
    </View>
  );
}

const es = StyleSheet.create({
  wrap:    { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 14 },
  iconWrap:{ width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  icon:    { fontSize: 42 },
  title:   { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  sub:     { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  tipRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 8 },
  tipIcon: { fontSize: 16 },
  tipTxt:  { flex: 1, fontSize: 12, lineHeight: 18 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export const ShortlistScreen = ({ navigation }: Props): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [workers, setWorkers] = useState<WorkerDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadShortlist = useCallback(async () => {
    setLoading(true);
    try {
      const ids = await shortlistStorage.getAll();
      if (ids.length === 0) { setWorkers([]); return; }

      const results = await Promise.allSettled(ids.map((id) => workerApi.getWorkerById(id)));
      const loaded = results
        .filter((r): r is PromiseFulfilledResult<WorkerDetail> => r.status === 'fulfilled')
        .map((r) => r.value);
      setWorkers(loaded);
    } catch {
      toast.error('Failed to load shortlist.', 'Error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Reload every time the screen comes into focus
  useFocusEffect(
    useCallback(() => { void loadShortlist(); }, [loadShortlist]),
  );

  const handleRemove = async (id: string): Promise<void> => {
    setRemovingId(id);
    try {
      await shortlistStorage.remove(id);
      setWorkers((prev) => prev.filter((w) => w._id !== id));
      toast.success(t('removedFromShortlist'), '');
    } catch {
      toast.error(t('failedToRemove'), t('error'));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={[hdr.wrap, { paddingTop: insets.top + 8 }]}>
        <View style={hdr.deco1} />
        <View style={hdr.deco2} />
        <View style={hdr.row}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={hdr.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <AppText style={hdr.backArrow}>←</AppText>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <AppText style={hdr.title}>{t('shortlistTitle')}</AppText>
            <AppText style={hdr.sub}>
              {loading ? t('shortlistLoading') : workers.length === 0 ? t('shortlistEmpty') : t(workers.length === 1 ? 'shortlistSaved' : 'shortlistSaved_plural', { count: workers.length })}
            </AppText>
          </View>
          <View style={hdr.heartWrap}>
            <AppText style={{ fontSize: 28 }}>❤️</AppText>
          </View>
        </View>
      </View>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={BRAND} />
          <AppText style={{ marginTop: 12, fontSize: 13, color: theme.colors.mutedText }}>{t('shortlistLoading')}</AppText>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={sc.content}
          showsVerticalScrollIndicator={false}
        >
          {workers.length === 0 ? (
            <EmptyShortlist />
          ) : (
            workers.map((worker, idx) => (
              <WorkerCard
                key={worker._id}
                worker={worker}
                idx={idx}
                onPress={() => navigation.navigate('WorkerProfile', { workerId: worker._id })}
                onRemove={() => void handleRemove(worker._id)}
                removing={removingId === worker._id}
              />
            ))
          )}
          <View style={{ height: insets.bottom + 24 }} />
        </ScrollView>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const hdr = StyleSheet.create({
  wrap:     { backgroundColor: BRAND, paddingHorizontal: 18, paddingBottom: 22, overflow: 'hidden' },
  deco1:    { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.05)', top: -80, right: -60 },
  deco2:    { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -30, left: -20 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  backArrow:{ color: WHITE, fontSize: 18, fontWeight: '600', lineHeight: 22 },
  title:    { color: WHITE, fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  sub:      { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  heartWrap:{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});

const sc = StyleSheet.create({
  content: { padding: 16, gap: 12 },
});
