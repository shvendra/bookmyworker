import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import type { TranslationKeys } from '../../../core/i18n/translations';

const FILE_BASE = 'https://bookmyworker.s3.eu-north-1.amazonaws.com';

export interface WorkCategory {
  label: string;         // English label — used for API filter calls, never changes
  translationKey: TranslationKeys; // i18n key for display
  image: string;
}

export const WORK_CATEGORIES: WorkCategory[] = [
  {
    label: 'Manufacturing & Industrial Workers',
    translationKey: 'cat_manufacturing',
    image: `${FILE_BASE}/ImagesWeb/Industrial_Workers.jpg`,
  },
  {
    label: 'Construction & Project Workers',
    translationKey: 'cat_construction',
    image: `${FILE_BASE}/ImagesWeb/Construction_Workers.jpg`,
  },
  {
    label: 'Transport & Logistics Workers',
    translationKey: 'cat_transport',
    image: `${FILE_BASE}/ImagesWeb/Logistics_Warehouse.jpg`,
  },
  {
    label: 'Agriculture & Farming Workers',
    translationKey: 'cat_agriculture',
    image: `${FILE_BASE}/ImagesWeb/Agriculture_Farm_Workers.jpg`,
  },
  {
    label: 'Household & Domestic Workers',
    translationKey: 'cat_household',
    image: `${FILE_BASE}/ImagesWeb/cleaning.png`,
  },
  {
    label: 'Automobile & Workshop Workers',
    translationKey: 'cat_automobile',
    image: `${FILE_BASE}/ImagesWeb/automobile.png`,
  },
  {
    label: 'Retail & Shop Workers',
    translationKey: 'cat_retail',
    image: `${FILE_BASE}/ImagesWeb/retail.png`,
  },
  {
    label: 'Hospitality & Service Workers',
    translationKey: 'cat_hospitality',
    image: `${FILE_BASE}/ImagesWeb/hospitality.png`,
  },
  {
    label: 'Healthcare Support Workers',
    translationKey: 'cat_healthcare',
    image: `${FILE_BASE}/ImagesWeb/healthcare.png`,
  },
  {
    label: 'Security & Facility Worker',
    translationKey: 'cat_security',
    image: `${FILE_BASE}/ImagesWeb/security.png`,
  },
  {
    label: 'Skilled Technical Workers',
    translationKey: 'cat_technical',
    image: `${FILE_BASE}/ImagesWeb/Electrical_and_Wiring.jpg`,
  },
  {
    label: 'Event & Decoration Workers',
    translationKey: 'cat_event',
    image: `${FILE_BASE}/ImagesWeb/event_decor.png`,
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
            const isActive = activeCategory === cat.label;
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
