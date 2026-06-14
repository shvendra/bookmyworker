import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
// Image is still used by the grid mode below
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { useAppTheme } from '../../../core/theme';
import type { TranslationKeys } from '../../../core/i18n/translations';

const { width: SCREEN_W } = Dimensions.get('window');
const CAT_CARD_W = SCREEN_W - 40;
const CAT_CARD_H = 210;
const CAT_CARD_GAP = 12;
const AUTO_SCROLL_INTERVAL = 3800;

export interface WorkCategory {
  label: string;
  value: string;
  translationKey: TranslationKeys;
  /** Professional one-line description shown on the promo slider */
  subtitleKey: TranslationKeys;
  image: string;
  /** Gradient [top color, bottom color] used when image fails or as overlay base */
  gradient: [string, string];
  emoji: string;
  accent: string;
  jobTypes?: number;
  /** Standard daily wage range (INR) shown on the promo slider */
  rateMin: number;
  rateMax: number;
}

export const WORK_CATEGORIES: WorkCategory[] = [
  {
    label: 'Manufacturing & Industrial',
    value: 'manufacturing_industrial_workers',
    translationKey: 'cat_manufacturing',
    subtitleKey: 'cat_sub_manufacturing',
    image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800&q=80&fit=crop',
    gradient: ['#1E3A8A', '#1D4ED8'],
    emoji: '⚙️',
    accent: '#3B82F6',
    jobTypes: 14,
    rateMin: 650,
    rateMax: 900,
  },
  {
    label: 'Construction & Project',
    value: 'construction_project_workers',
    translationKey: 'cat_construction',
    subtitleKey: 'cat_sub_construction',
    image: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&q=80&fit=crop',
    gradient: ['#78350F', '#D97706'],
    emoji: '🏗️',
    accent: '#F59E0B',
    jobTypes: 17,
    rateMin: 700,
    rateMax: 1100,
  },
  {
    label: 'Transport & Logistics',
    value: 'transport_logistics_workers',
    translationKey: 'cat_transport',
    subtitleKey: 'cat_sub_transport',
    image: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=800&q=80&fit=crop',
    gradient: ['#312E81', '#4338CA'],
    emoji: '🚛',
    accent: '#6366F1',
    jobTypes: 18,
    rateMin: 650,
    rateMax: 950,
  },
  {
    label: 'Agriculture & Farming',
    value: 'agriculture_farming_workers',
    translationKey: 'cat_agriculture',
    subtitleKey: 'cat_sub_agriculture',
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&q=80&fit=crop',
    gradient: ['#14532D', '#16A34A'],
    emoji: '🌾',
    accent: '#22C55E',
    jobTypes: 13,
    rateMin: 550,
    rateMax: 750,
  },
  {
    label: 'Household & Domestic',
    value: 'household_domestic_workers',
    translationKey: 'cat_household',
    subtitleKey: 'cat_sub_household',
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&q=80&fit=crop',
    gradient: ['#164E63', '#0891B2'],
    emoji: '🧹',
    accent: '#06B6D4',
    jobTypes: 12,
    rateMin: 500,
    rateMax: 800,
  },
  {
    label: 'Automobile & Workshop',
    value: 'Automobile & Workshop Workers',
    translationKey: 'cat_automobile',
    subtitleKey: 'cat_sub_automobile',
    image: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&q=80&fit=crop',
    gradient: ['#1E293B', '#334155'],
    emoji: '🔧',
    accent: '#64748B',
    jobTypes: 9,
    rateMin: 650,
    rateMax: 1000,
  },
  {
    label: 'Retail & Shop',
    value: 'retail_shop_workers',
    translationKey: 'cat_retail',
    subtitleKey: 'cat_sub_retail',
    image: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800&q=80&fit=crop',
    gradient: ['#92400E', '#D97706'],
    emoji: '🏪',
    accent: '#D97706',
    jobTypes: 14,
    rateMin: 600,
    rateMax: 850,
  },
  {
    label: 'Hospitality & Service',
    value: 'hospitality_service_workers',
    translationKey: 'cat_hospitality',
    subtitleKey: 'cat_sub_hospitality',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80&fit=crop',
    gradient: ['#831843', '#BE185D'],
    emoji: '🛎️',
    accent: '#EC4899',
    jobTypes: 14,
    rateMin: 600,
    rateMax: 900,
  },
  {
    label: 'Healthcare Support',
    value: 'Healthcare Support Workers',
    translationKey: 'cat_healthcare',
    subtitleKey: 'cat_sub_healthcare',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80&fit=crop',
    gradient: ['#7F1D1D', '#DC2626'],
    emoji: '🏥',
    accent: '#EF4444',
    jobTypes: 7,
    rateMin: 700,
    rateMax: 1050,
  },
  {
    label: 'Security & Facility',
    value: 'Security & Facility Workers',
    translationKey: 'cat_security',
    subtitleKey: 'cat_sub_security',
    image: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=800&q=80&fit=crop',
    gradient: ['#0F172A', '#1E293B'],
    emoji: '👮',
    accent: '#475569',
    jobTypes: 9,
    rateMin: 650,
    rateMax: 900,
  },
  {
    label: 'Skilled Technical',
    value: 'skilled_technical_workers',
    translationKey: 'cat_technical',
    subtitleKey: 'cat_sub_technical',
    image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80&fit=crop',
    gradient: ['#064E3B', '#059669'],
    emoji: '🛠️',
    accent: '#10B981',
    jobTypes: 13,
    rateMin: 800,
    rateMax: 1300,
  },
  {
    label: 'Event & Decoration',
    value: 'event_decoration_workers',
    translationKey: 'cat_event',
    subtitleKey: 'cat_sub_event',
    image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80&fit=crop',
    gradient: ['#4C1D95', '#7C3AED'],
    emoji: '🎊',
    accent: '#8B5CF6',
    jobTypes: 11,
    rateMin: 600,
    rateMax: 1000,
  },
  {
    label: 'Specialized & Creative',
    value: 'specialized_creative_workers',
    translationKey: 'cat_creative',
    subtitleKey: 'cat_sub_creative',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80&fit=crop',
    gradient: ['#581C87', '#9333EA'],
    emoji: '🎨',
    accent: '#A855F7',
    jobTypes: 14,
    rateMin: 800,
    rateMax: 1400,
  },
];

interface WorkerCategoryGridProps {
  onCategoryPress: (category: WorkCategory) => void;
  activeCategory?: string;
  /** Renders a full-width snapping horizontal slider instead of a grid */
  horizontal?: boolean;
  /** Number of columns for grid mode (default 3) */
  columns?: 2 | 3 | 4;
  /** Cell height for grid mode in px (default 90) */
  cellHeight?: number;
}

// ── Full-width horizontal category slider ─────────────────────────────────────
const HCatSlider = ({
  onCategoryPress,
  activeCategory,
}: {
  onCategoryPress: (cat: WorkCategory) => void;
  activeCategory?: string;
}): React.JSX.Element => {
  const { t } = useTranslation();
  const step = CAT_CARD_W + CAT_CARD_GAP;

  const scrollRef = useRef<ScrollView>(null);
  const dotAnim = useRef(WORK_CATEGORIES.map(() => new Animated.Value(0))).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentIdx = useRef(0);

  const animateDot = (idx: number): void => {
    dotAnim.forEach((a, i) => {
      Animated.timing(a, {
        toValue: i === idx ? 1 : 0,
        duration: 220,
        useNativeDriver: false,
      }).start();
    });
  };

  const scrollToIndex = (idx: number): void => {
    const safeIdx = idx % WORK_CATEGORIES.length;
    scrollRef.current?.scrollTo({ x: safeIdx * step, animated: true });
    currentIdx.current = safeIdx;
    animateDot(safeIdx);
  };

  const resetTimer = (): void => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => scrollToIndex(currentIdx.current + 1), AUTO_SCROLL_INTERVAL);
  };

  useEffect(() => {
    animateDot(0);
    timerRef.current = setInterval(() => scrollToIndex(currentIdx.current + 1), AUTO_SCROLL_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScrollEnd = (e: { nativeEvent: { contentOffset: { x: number } } }): void => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / step);
    currentIdx.current = idx;
    animateDot(idx);
  };

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={step}
        snapToAlignment="start"
        onMomentumScrollEnd={handleScrollEnd}
        onScrollBeginDrag={resetTimer}
        scrollEventThrottle={16}
        contentContainerStyle={hStyles.scrollContent}
      >
        {WORK_CATEGORIES.map((cat, idx) => {
          const isActive = activeCategory === cat.value;
          return (
            <TouchableOpacity
              key={cat.value}
              onPress={() => onCategoryPress(cat)}
              activeOpacity={0.88}
              style={[
                hStyles.card,
                { backgroundColor: cat.gradient[0] },
                isActive && { borderColor: cat.accent, borderWidth: 3 },
              ]}
            >
              {/* Photo background — real workers on the job */}
              <Image
                source={{ uri: cat.image }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
              {/* Brand-colour tint keeps each category recognisable while the photo shows through */}
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: cat.gradient[0], opacity: 0.40 }]} />
              {/* Top + bottom dark scrims so the white text stays readable over any photo */}
              <View style={hStyles.scrimTop} />
              <View style={hStyles.scrimBottom} />
              {/* Lighter accent bottom-right blob (subtle) */}
              <View style={[hStyles.gradientBlob, { backgroundColor: cat.gradient[1], opacity: 0.28 }]} />

              {/* Accent bar at very bottom */}
              <View style={[hStyles.accentBar, { backgroundColor: cat.accent }]} />

              {/* TOP ROW: small emoji badge + counter */}
              <View style={hStyles.topRow}>
                <View style={[hStyles.emojiBadge, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                  <AppText style={hStyles.emoji}>{cat.emoji}</AppText>
                </View>
                <View style={hStyles.counter}>
                  <AppText style={hStyles.counterTxt}>{idx + 1}/{WORK_CATEGORIES.length}</AppText>
                </View>
              </View>

              {/* BOTTOM BLOCK: name, job-types chip, CTA */}
              <View style={hStyles.bottomBlock}>
                <AppText style={hStyles.catName} numberOfLines={2}>
                  {t(cat.translationKey as TranslationKeys).replace(/\n/g, ' ')}
                </AppText>

                <View style={hStyles.bottomRow}>
                  {cat.jobTypes != null && (
                    <View style={[hStyles.jobPill, { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' }]}>
                      <AppText style={hStyles.jobPillTxt}>
                        {t('catJobTypes', { count: cat.jobTypes })}
                      </AppText>
                    </View>
                  )}
                  <View style={[hStyles.ctaBtn, { backgroundColor: cat.accent }]}>
                    <AppText style={hStyles.ctaTxt}>{t('tab_browse')} →</AppText>
                  </View>
                </View>
              </View>

              {/* Active tick */}
              {isActive && (
                <View style={[hStyles.tick, { backgroundColor: cat.accent }]}>
                  <AppText style={hStyles.tickTxt}>✓</AppText>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

// ── Main exported component ───────────────────────────────────────────────────
export const WorkerCategoryGrid = ({
  onCategoryPress,
  activeCategory,
  horizontal = false,
  columns = 3,
  cellHeight = 90,
}: WorkerCategoryGridProps): React.JSX.Element => {
  const { t } = useTranslation();

  if (horizontal) {
    return (
      <HCatSlider
        onCategoryPress={onCategoryPress}
        activeCategory={activeCategory}
      />
    );
  }

  // ── Grid mode (unchanged) ─────────────────────────────────────────────────
  const rows: WorkCategory[][] = [];
  for (let i = 0; i < WORK_CATEGORIES.length; i += columns) {
    rows.push(WORK_CATEGORIES.slice(i, i + columns));
  }

  return (
    <View style={gStyles.grid}>
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={gStyles.row}>
          {row.map((cat) => {
            const isActive = activeCategory === cat.value;
            return (
              <TouchableOpacity
                key={cat.label}
                onPress={() => onCategoryPress(cat)}
                activeOpacity={0.82}
                style={[gStyles.cell, { height: cellHeight }, isActive && gStyles.cellActive]}
              >
                <Image
                  source={{ uri: cat.image }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
                <View style={[gStyles.overlay, isActive && gStyles.overlayActive]} />
                <AppText style={gStyles.label} numberOfLines={2}>
                  {t(cat.translationKey)}
                </AppText>
                {isActive && (
                  <View style={gStyles.activeTick}>
                    <AppText style={gStyles.activeTickText}>✓</AppText>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
};

// ── Horizontal slider styles ──────────────────────────────────────────────────
const hStyles = StyleSheet.create({
  scrollContent: {
    gap: CAT_CARD_GAP,
    paddingBottom: 4,
    alignItems: 'flex-start',
  },

  card: {
    width: CAT_CARD_W,
    height: CAT_CARD_H,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 10,
  },

  // Dark scrims over the photo so the white text/counter stay readable
  scrimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 88,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  scrimBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.46)',
  },

  // Gradient blob — bottom-right lighter colour splash
  gradientBlob: {
    position: 'absolute',
    bottom: -40,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.55,
  },
  // Decorative circles
  circleL: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  circleS: {
    position: 'absolute',
    bottom: 30,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  // Large emoji on right side as the hero visual
  bigEmojiWrap: {
    position: 'absolute',
    right: 18,
    bottom: 44,
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  bigEmoji: { fontSize: 52, lineHeight: 60 },

  accentBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
  },

  // Top row
  topRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emojiBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  emoji: { fontSize: 24, lineHeight: 28 },

  counter: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  counterTxt: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Bottom block
  bottomBlock: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    right: 16,
    gap: 8,
  },
  catName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 30,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  jobPill: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  jobPillTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.90)',
  },
  ctaBtn: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  ctaTxt: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  // Active tick
  tick: {
    position: 'absolute',
    top: 14,
    right: 66,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickTxt: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', lineHeight: 15 },

  // Dot indicators
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  dot: { height: 5, borderRadius: 3 },
});

// ── Grid styles (unchanged) ───────────────────────────────────────────────────
const gStyles = StyleSheet.create({
  grid: { gap: 6, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 6 },
  cell: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  cellActive: { borderWidth: 2.5, borderColor: '#3B82F6' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
  },
  overlayActive: { backgroundColor: 'rgba(59, 130, 246, 0.35)' },
  label: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  activeTick: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTickText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', lineHeight: 14 },
});
