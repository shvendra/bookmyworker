import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../../../shared/components/ui/AppText';
import { useReduceMotion } from '../../../shared/components/motion';
import { useLivePulse, type LivePulse } from '../../../core/api/endpoints/livePulseApi';
import { getWorkTypeLabel } from '../../../shared/utils/labelUtils';
import { agoText, eventMessage } from '../utils/livePulseText';

const TICK_MS = 4200;

/** One rotating activity line — slides/fades to the next event every few seconds. */
const Ticker = ({ pulse, onPress }: { pulse: LivePulse; onPress?: () => void }): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  const isDark = theme.mode === 'dark';
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

  // Soft blue-tinted card; the icon colour carries the type (green = new worker, amber = new requirement).
  const tint = isReq ? '#B45309' : '#16A34A';
  const tintBg = isReq ? '#FEF3C7' : '#DCFCE7';
  const cardBg = isDark ? theme.colors.card : '#EEF4FD';
  const cardBorder = isDark ? theme.colors.border : '#D6E4F8';

  // The full message is shown (it may wrap to a 2nd line), but the row keeps one FIXED height that
  // always has room for two lines — an auto-height row made everything below it jump up and down
  // as the ticker rotated between short and long messages.
  return (
    <Animated.View
      style={[
        s.tick,
        { backgroundColor: cardBg, borderColor: cardBorder, opacity: p, transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }] },
      ]}
      accessibilityLiveRegion="polite"
    >
      <View style={[s.tickIcon, { backgroundColor: tintBg }]}>
        <Ionicons name={isReq ? 'briefcase' : 'person-add'} size={16} color={tint} />
      </View>
      <View style={[s.divider, { backgroundColor: cardBorder }]} />
      <AppText style={[s.tickTxt, { color: theme.colors.text }]} numberOfLines={2} maxFontSizeMultiplier={1.15}>
        {eventMessage(e, catText, t as never)}
      </AppText>
      <AppText style={[s.agoTxt, { color: theme.colors.mutedText }]} numberOfLines={1} maxFontSizeMultiplier={1.1}>{agoText(e.at, t as never)}</AppText>
      {onPress && (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.8}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={[s.arrowBtn, { backgroundColor: isDark ? theme.colors.surface1 : '#FFFFFF', borderColor: cardBorder }]}
        >
          <Ionicons name="arrow-forward" size={15} color={isDark ? theme.colors.text : '#1E3A8A'} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

/**
 * Real, anonymised marketplace activity as one rotating line ("New worker joined in Rewa · Plumber · 3d ago").
 * Renders nothing while loading, on error, or when there is no activity — it never invents anything.
 */
export const LivePulseCard = ({ enabled = true, onPress }: { enabled?: boolean; onPress?: () => void }): React.JSX.Element | null => {
  const { data: pulse } = useLivePulse(enabled);
  if (!pulse || pulse.events.length === 0) return null;
  return <Ticker pulse={pulse} onPress={onPress} />;
};

const s = StyleSheet.create({
  tick: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 68, borderRadius: 18, borderWidth: 1,
    paddingLeft: 12, paddingRight: 10, marginBottom: 14,
  },
  tickIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  divider: { width: 1, height: 28 },
  tickTxt: { flex: 1, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  agoTxt: { flexShrink: 0, fontSize: 11.5, fontWeight: '500' },
  arrowBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
