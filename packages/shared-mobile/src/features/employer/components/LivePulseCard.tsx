import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../../../shared/components/ui/AppText';
import { CountUpText, useReduceMotion } from '../../../shared/components/motion';
import { useLivePulse, type LivePulse } from '../../../core/api/endpoints/livePulseApi';
import { getWorkTypeLabel } from '../../../shared/utils/labelUtils';
import { agoText, eventMessage } from '../utils/livePulseText';

const TICK_MS = 4200;

/** Blinking "live" dot. */
const LiveDot = (): React.JSX.Element => {
  const reduce = useReduceMotion();
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) { o.setValue(1); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 0.25, duration: 800, useNativeDriver: true }),
      Animated.timing(o, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduce, o]);
  return <Animated.View style={[s.dot, { opacity: o }]} />;
};

interface StatProps { icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string; value: number; label: string }
const Stat = ({ icon, tint, bg, value, label }: StatProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View style={[s.stat, { backgroundColor: bg }]}>
      <View style={s.statTop}>
        <Ionicons name={icon} size={14} color={tint} />
        <CountUpText value={value} style={[s.statNum, { color: tint }]} maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} />
      </View>
      <AppText style={[s.statLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2} numberOfLines={2}>{label}</AppText>
    </View>
  );
};

/** One rotating activity line — slides/fades to the next event every few seconds. */
const Ticker = ({ pulse }: { pulse: LivePulse }): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const { t: tDefault } = useTranslation();
  const focused = useIsFocused();
  const reduce = useReduceMotion();
  const [idx, setIdx] = useState(0);
  const p = useRef(new Animated.Value(1)).current;
  const count = pulse.events.length;

  useEffect(() => {
    if (count <= 1 || !focused || reduce) return undefined;
    const id = setInterval(() => {
      Animated.timing(p, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (!finished) return;
        setIdx((i) => (i + 1) % count);
        Animated.timing(p, { toValue: 1, duration: 280, useNativeDriver: true }).start();
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [count, focused, reduce, p]);

  if (count === 0) return null;
  const e = pulse.events[idx % count];
  if (!e) return null;
  const label = e.category
    ? getWorkTypeLabel(e.category, tDefault as Parameters<typeof getWorkTypeLabel>[1]).replace(/\n/g, ' ')
    : '';
  const catText = label && label !== '—' ? label : e.categoryLabel;
  const isReq = e.type === 'requirement';

  return (
    <Animated.View
      style={[s.tick, { backgroundColor: theme.colors.surface1, opacity: p, transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }]}
      accessibilityLiveRegion="polite"
    >
      <View style={[s.tickIcon, { backgroundColor: isReq ? '#FEF3C7' : '#DCFCE7' }]}>
        <Ionicons name={isReq ? 'briefcase' : 'person-add'} size={13} color={isReq ? '#B45309' : '#15803D'} />
      </View>
      <AppText style={[s.tickTxt, { color: theme.colors.text }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
        {eventMessage(e, catText, t as never)}
        <AppText style={[s.tickAgo, { color: theme.colors.mutedText }]}>{`  ·  ${agoText(e.at, t as never)}`}</AppText>
      </AppText>
    </Animated.View>
  );
};

/**
 * "Live on BookMyWorker" — real, anonymised marketplace activity (workers active / joined today,
 * requirements posted today) with a rotating latest-activity line. Renders nothing while loading,
 * on error, or when there is genuinely no activity to show — it never invents numbers.
 */
export const LivePulseCard = ({ enabled = true }: { enabled?: boolean }): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const { data: pulse } = useLivePulse(enabled);
  if (!pulse) return null;
  const hasStats = pulse.activeToday > 0 || pulse.newToday > 0 || pulse.requirementsToday > 0;
  if (!hasStats && pulse.events.length === 0) return null;

  return (
    <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={s.header}>
        <View style={s.livePill}><LiveDot /><AppText style={s.liveTxt} maxFontSizeMultiplier={1.2}>{t('lp_live')}</AppText></View>
        <View style={s.headMid}>
          <AppText style={[s.title, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.25}>{t('lp_title')}</AppText>
          <AppText style={[s.sub, { color: theme.colors.mutedText }]} numberOfLines={1} maxFontSizeMultiplier={1.25}>{t('lp_in', { place: pulse.place })}</AppText>
        </View>
      </View>
      {hasStats && (
        <View style={s.statsRow}>
          <Stat icon="pulse" tint="#16A34A" bg="#ECFDF5" value={pulse.activeToday} label={t('lp_active')} />
          <Stat icon="person-add" tint="#2563EB" bg="#EFF6FF" value={pulse.newToday} label={t('lp_new')} />
          <Stat icon="briefcase" tint="#D97706" bg="#FFFBEB" value={pulse.requirementsToday} label={t('lp_reqs')} />
        </View>
      )}
      <Ticker pulse={pulse} />
    </View>
  );
};

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEE2E2', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#DC2626' },
  liveTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: '#B91C1C' },
  headMid: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '800' },
  sub: { fontSize: 11.5, marginTop: 1 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  stat: { flex: 1, minWidth: 0, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 8 },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statNum: { flexShrink: 1, fontSize: 17, fontWeight: '800' },
  statLabel: { fontSize: 10.5, fontWeight: '600', marginTop: 3, lineHeight: 13 },
  tick: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9, marginTop: 10, minHeight: 40 },
  tickIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tickTxt: { flex: 1, fontSize: 12.5, fontWeight: '600', lineHeight: 17 },
  tickAgo: { fontSize: 11.5, fontWeight: '500' },
});
