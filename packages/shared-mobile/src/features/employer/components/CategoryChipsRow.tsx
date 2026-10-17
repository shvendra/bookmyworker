import React, { useCallback, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../../../shared/components/ui/AppText';
import { WORK_CATEGORIES } from '../../../shared/components/ui/WorkerCategoryGrid';
import { useReduceMotion } from '../../../shared/components/motion';
import { getWorkTypeLabel } from '../../../shared/utils/labelUtils';

const STEP_MS = 2600;
const RESUME_AFTER_TOUCH_MS = 7000;

interface CategoryChipsRowProps {
  /** Receives the category value, e.g. "construction_project_workers". */
  onSelect: (value: string) => void;
  onViewAll: () => void;
}

/**
 * "Find workers by category" — a gently auto-scrolling row of category chips. Tapping one opens
 * Worker Search already filtered to that category. Auto-scroll pauses while the user is touching it,
 * while the screen is in the background, and under "Reduce motion".
 */
export const CategoryChipsRow = ({ onSelect, onViewAll }: CategoryChipsRowProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const { t: tDefault } = useTranslation();
  const focused = useIsFocused();
  const reduce = useReduceMotion();
  const scrollRef = useRef<ScrollView>(null);
  const xs = useRef<number[]>([]);
  const idx = useRef(0);
  const pausedUntil = useRef(0);

  useEffect(() => {
    if (!focused || reduce) return undefined;
    const id = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      const next = (idx.current + 1) % WORK_CATEGORIES.length;
      idx.current = next;
      scrollRef.current?.scrollTo({ x: next === 0 ? 0 : (xs.current[next] ?? 0) - 4, animated: true });
    }, STEP_MS);
    return () => clearInterval(id);
  }, [focused, reduce]);

  const pause = useCallback(() => { pausedUntil.current = Date.now() + RESUME_AFTER_TOUCH_MS; }, []);

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <AppText style={[s.title, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.25}>{t('cc_title')}</AppText>
        <TouchableOpacity onPress={onViewAll} activeOpacity={0.7} hitSlop={8}>
          <AppText style={s.viewAll} maxFontSizeMultiplier={1.25}>{t('viewAll')}</AppText>
        </TouchableOpacity>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={pause}
        onTouchStart={pause}
        contentContainerStyle={s.row}
      >
        {WORK_CATEGORIES.map((c, i) => (
          <TouchableOpacity
            key={c.value}
            activeOpacity={0.85}
            onPress={() => onSelect(c.value)}
            onLayout={(e) => { xs.current[i] = e.nativeEvent.layout.x; }}
            style={[s.chip, { backgroundColor: c.accent + '14', borderColor: c.accent + '55' }]}
            accessibilityRole="button"
          >
            <AppText style={s.emoji}>{c.emoji}</AppText>
            <AppText style={[s.label, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {getWorkTypeLabel(c.value, tDefault as Parameters<typeof getWorkTypeLabel>[1]).replace(/\n/g, ' ')}
            </AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 2 },
  title: { flex: 1, fontSize: 15, fontWeight: '800', marginRight: 8 },
  viewAll: { fontSize: 12.5, fontWeight: '700', color: '#2563EB' },
  row: { gap: 10, paddingRight: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  emoji: { fontSize: 17 },
  label: { fontSize: 13, fontWeight: '700', maxWidth: 190 },
});
