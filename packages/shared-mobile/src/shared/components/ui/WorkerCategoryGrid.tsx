import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import type { TranslationKeys } from '../../../core/i18n/translations';


export interface WorkCategory {
  label: string;               // Display label (English)
  value: string;               // API filter value — matches categories.json value field
  translationKey: TranslationKeys;
  image: string;
}

export const WORK_CATEGORIES: WorkCategory[] = [
  {
    label: 'Manufacturing & Industrial Workers',
    value: 'manufacturing_industrial_workers',
    translationKey: 'cat_manufacturing',
    image: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?auto=format&fit=crop&w=600&q=70',
  },
  {
    label: 'Construction & Project Workers',
    value: 'construction_project_workers',
    translationKey: 'cat_construction',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=70',
  },
  {
    label: 'Transport & Logistics Workers',
    value: 'transport_logistics_workers',
    translationKey: 'cat_transport',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=70',
  },
  {
    label: 'Agriculture & Farming Workers',
    value: 'agriculture_farming_workers',
    translationKey: 'cat_agriculture',
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=600&q=70',
  },
  {
    label: 'Household & Domestic Workers',
    value: 'household_domestic_workers',
    translationKey: 'cat_household',
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=70',
  },
  {
    label: 'Automobile & Workshop Workers',
    value: 'Automobile & Workshop Workers',
    translationKey: 'cat_automobile',
    image: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=600&q=70',
  },
  {
    label: 'Retail & Shop Workers',
    value: 'retail_shop_workers',
    translationKey: 'cat_retail',
    image: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=600&q=70',
  },
  {
    label: 'Hospitality & Service Workers',
    value: 'hospitality_service_workers',
    translationKey: 'cat_hospitality',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=600&q=70',
  },
  {
    label: 'Healthcare Support Workers',
    value: 'Healthcare Support Workers',
    translationKey: 'cat_healthcare',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=70',
  },
  {
    label: 'Security & Facility Worker',
    value: 'Security & Facility Workers',
    translationKey: 'cat_security',
    image: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=70',
  },
  {
    label: 'Skilled Technical Workers',
    value: 'skilled_technical_workers',
    translationKey: 'cat_technical',
    image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=600&q=70',
  },
  {
    label: 'Event & Decoration Workers',
    value: 'event_decoration_workers',
    translationKey: 'cat_event',
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&q=70',
  },
];

interface WorkerCategoryGridProps {
  onCategoryPress: (category: WorkCategory) => void;
  activeCategory?: string;
  /** Number of columns (default 3) */
  columns?: 2 | 3 | 4;
  /** Cell height in px (default 90) */
  cellHeight?: number;
}

export const WorkerCategoryGrid = ({
  onCategoryPress,
  activeCategory,
  columns = 3,
  cellHeight = 90,
}: WorkerCategoryGridProps): React.JSX.Element => {
  const { t } = useTranslation();

  const rows: WorkCategory[][] = [];
  for (let i = 0; i < WORK_CATEGORIES.length; i += columns) {
    rows.push(WORK_CATEGORIES.slice(i, i + columns));
  }

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.row}>
          {row.map((cat) => {
            const isActive = activeCategory === cat.value;
            return (
              <TouchableOpacity
                key={cat.label}
                onPress={() => onCategoryPress(cat)}
                activeOpacity={0.82}
                style={[styles.cell, { height: cellHeight }, isActive && styles.cellActive]}
              >
                <Image
                  source={{ uri: cat.image }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
                <View style={[styles.overlay, isActive && styles.overlayActive]} />
                <AppText style={styles.label} numberOfLines={2}>
                  {t(cat.translationKey)}
                </AppText>
                {isActive && (
                  <View style={styles.activeTick}>
                    <AppText style={styles.activeTickText}>✓</AppText>
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

const styles = StyleSheet.create({
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
  cellActive: {
    borderWidth: 2.5,
    borderColor: '#3B82F6',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
  },
  overlayActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.35)',
  },
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
  activeTickText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 14,
  },
});
