import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText } from './AppText';

// S3 bucket base URL for category images
const FILE_BASE = 'https://bookmyworker.s3.eu-north-1.amazonaws.com';

export interface WorkCategory {
  label: string;
  image: string;       // full URL
  shortLabel: string;  // 2-line display label
}

// Mirrors CRM ServiceBoxGrid — 12 active categories with S3 images
export const WORK_CATEGORIES: WorkCategory[] = [
  {
    label: 'Manufacturing & Industrial Workers',
    shortLabel: 'Manufacturing &\nIndustrial',
    image: `${FILE_BASE}/ImagesWeb/Industrial_Workers.jpg`,
  },
  {
    label: 'Construction & Project Workers',
    shortLabel: 'Construction &\nProject',
    image: `${FILE_BASE}/ImagesWeb/Construction_Workers.jpg`,
  },
  {
    label: 'Transport & Logistics Workers',
    shortLabel: 'Transport &\nLogistics',
    image: `${FILE_BASE}/ImagesWeb/Logistics_Warehouse.jpg`,
  },
  {
    label: 'Agriculture & Farming Workers',
    shortLabel: 'Agriculture &\nFarming',
    image: `${FILE_BASE}/ImagesWeb/Agriculture_Farm_Workers.jpg`,
  },
  {
    label: 'Household & Domestic Workers',
    shortLabel: 'Household &\nDomestic',
    image: `${FILE_BASE}/ImagesWeb/cleaning.png`,
  },
  {
    label: 'Automobile & Workshop Workers',
    shortLabel: 'Automobile &\nWorkshop',
    image: `${FILE_BASE}/ImagesWeb/automobile.png`,
  },
  {
    label: 'Retail & Shop Workers',
    shortLabel: 'Retail &\nShop',
    image: `${FILE_BASE}/ImagesWeb/retail.png`,
  },
  {
    label: 'Hospitality & Service Workers',
    shortLabel: 'Hospitality &\nService',
    image: `${FILE_BASE}/ImagesWeb/hospitality.png`,
  },
  {
    label: 'Healthcare Support Workers',
    shortLabel: 'Healthcare\nSupport',
    image: `${FILE_BASE}/ImagesWeb/healthcare.png`,
  },
  {
    label: 'Security & Facility Worker',
    shortLabel: 'Security &\nFacility',
    image: `${FILE_BASE}/ImagesWeb/security.png`,
  },
  {
    label: 'Skilled Technical Workers',
    shortLabel: 'Skilled\nTechnical',
    image: `${FILE_BASE}/ImagesWeb/Electrical_and_Wiring.jpg`,
  },
  {
    label: 'Event & Decoration Workers',
    shortLabel: 'Event &\nDecoration',
    image: `${FILE_BASE}/ImagesWeb/event_decor.png`,
  },
];

interface WorkerCategoryGridProps {
  onCategoryPress: (category: WorkCategory) => void;
  activeCategory?: string;
}

export const WorkerCategoryGrid = ({ onCategoryPress, activeCategory }: WorkerCategoryGridProps): React.JSX.Element => {
  // Render in rows of 3 (4 rows × 3 cols = 12), matching CRM xs=3-column layout
  const rows: WorkCategory[][] = [];
  for (let i = 0; i < WORK_CATEGORIES.length; i += 3) {
    rows.push(WORK_CATEGORIES.slice(i, i + 3));
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
                style={[styles.cell, isActive && styles.cellActive]}
              >
                <Image
                  source={{ uri: cat.image }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
                <View style={[styles.overlay, isActive && styles.overlayActive]} />
                <AppText style={styles.label} numberOfLines={2}>
                  {cat.shortLabel}
                </AppText>
                {isActive && <View style={styles.activeTick}><AppText style={styles.activeTickText}>✓</AppText></View>}
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
    height: 90,
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
