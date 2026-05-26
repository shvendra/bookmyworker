import React from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import type { TranslationKeys } from '../../../core/i18n/translations';

const { width: SCREEN_W } = Dimensions.get('window');
// Full-width card (matches job slider width — body has padding:16 each side + 8px gap breathing room)
const CAT_CARD_W = SCREEN_W - 40;
const CAT_CARD_H = 190;
const CAT_CARD_GAP = 12;

export interface WorkCategory {
  label: string;
  value: string;
  translationKey: TranslationKeys;
  image: string;
  emoji: string;
  accent: string;
}

export const WORK_CATEGORIES: WorkCategory[] = [
  {
    label: 'Manufacturing & Industrial',
    value: 'manufacturing_industrial_workers',
    translationKey: 'cat_manufacturing',
    image: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?auto=format&fit=crop&w=800&q=80',
    emoji: '⚙️',
    accent: '#3B82F6',
  },
  {
    label: 'Construction & Project',
    value: 'construction_project_workers',
    translationKey: 'cat_construction',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
    emoji: '🏗️',
    accent: '#F59E0B',
  },
  {
    label: 'Transport & Logistics',
    value: 'transport_logistics_workers',
    translationKey: 'cat_transport',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
    emoji: '🚛',
    accent: '#6366F1',
  },
  {
    label: 'Agriculture & Farming',
    value: 'agriculture_farming_workers',
    translationKey: 'cat_agriculture',
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80',
    emoji: '🌾',
    accent: '#22C55E',
  },
  {
    label: 'Household & Domestic',
    value: 'household_domestic_workers',
    translationKey: 'cat_household',
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80',
    emoji: '🧹',
    accent: '#06B6D4',
  },
  {
    label: 'Automobile & Workshop',
    value: 'Automobile & Workshop Workers',
    translationKey: 'cat_automobile',
    image: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=800&q=80',
    emoji: '🚗',
    accent: '#64748B',
  },
  {
    label: 'Retail & Shop',
    value: 'retail_shop_workers',
    translationKey: 'cat_retail',
    image: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=800&q=80',
    emoji: '🏪',
    accent: '#D97706',
  },
  {
    label: 'Hospitality & Service',
    value: 'hospitality_service_workers',
    translationKey: 'cat_hospitality',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80',
    emoji: '🛎️',
    accent: '#EC4899',
  },
  {
    label: 'Healthcare Support',
    value: 'Healthcare Support Workers',
    translationKey: 'cat_healthcare',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80',
    emoji: '🏥',
    accent: '#EF4444',
  },
  {
    label: 'Security & Facility',
    value: 'Security & Facility Workers',
    translationKey: 'cat_security',
    image: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=800&q=80',
    emoji: '👮',
    accent: '#475569',
  },
  {
    label: 'Skilled Technical',
    value: 'skilled_technical_workers',
    translationKey: 'cat_technical',
    image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=800&q=80',
    emoji: '🛠️',
    accent: '#10B981',
  },
  {
    label: 'Event & Decoration',
    value: 'event_decoration_workers',
    translationKey: 'cat_event',
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80',
    emoji: '🎊',
    accent: '#8B5CF6',
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
  const step = CAT_CARD_W + CAT_CARD_GAP;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={step}
        snapToAlignment="start"
        contentContainerStyle={hStyles.scrollContent}
      >
        {WORK_CATEGORIES.map((cat, idx) => {
          const isActive = activeCategory === cat.value;
          return (
            <TouchableOpacity
              key={cat.value}
              onPress={() => onCategoryPress(cat)}
              activeOpacity={0.88}
              style={[hStyles.card, isActive && { borderColor: cat.accent, borderWidth: 3 }]}
            >
              {/* Background image — high res, fully visible */}
              <Image
                source={{ uri: cat.image }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />

              {/* Very subtle full-card tint so colors stay vibrant */}
              <View style={hStyles.tint} />

              {/* Bottom gradient block for text legibility */}
              <View style={hStyles.gradBottom} />

              {/* Accent bar at very bottom */}
              <View style={[hStyles.accentBar, { backgroundColor: cat.accent }]} />

              {/* TOP ROW: emoji pill + index counter */}
              <View style={hStyles.topRow}>
                <View style={[hStyles.emojiBadge, { backgroundColor: cat.accent }]}>
                  <AppText style={hStyles.emoji}>{cat.emoji}</AppText>
                </View>
                <View style={[hStyles.counter, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
                  <AppText style={hStyles.counterTxt}>{idx + 1}/{WORK_CATEGORIES.length}</AppText>
                </View>
              </View>

              {/* BOTTOM: category name + CTA */}
              <View style={hStyles.bottomBlock}>
                <AppText style={hStyles.catName} numberOfLines={1}>{cat.label}</AppText>
                <AppText style={[hStyles.ctaTxt, { color: cat.accent === '#475569' ? '#CBD5E1' : cat.accent }]}>
                  Browse jobs  →
                </AppText>
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
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.20,
    shadowRadius: 14,
    elevation: 8,
  },

  // Very light full-card tint — keeps image vibrant but slightly deepened
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },

  // Bottom 50% darkening for text contrast
  gradBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '52%',
    backgroundColor: 'rgba(5,10,30,0.78)',
  },

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
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  emoji: { fontSize: 22, lineHeight: 26 },

  counter: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterTxt: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Bottom text block
  bottomBlock: {
    position: 'absolute',
    bottom: 18,
    left: 16,
    right: 16,
    gap: 5,
  },
  catName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 27,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  ctaTxt: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    letterSpacing: 0.1,
  },

  // Active tick (top-right)
  tick: {
    position: 'absolute',
    top: 14,
    right: 56,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickTxt: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', lineHeight: 15 },

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
