import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { ageString } from '../../../shared/utils/ageUtils';

// ─── Design tokens ────────────────────────────────────────────────────────────
export const C = {
  navy:      '#0f172a',
  blue:      '#2563eb',
  blueSoft:  '#eff6ff',
  blueLight: '#dbeafe',
  indigo:    '#4f46e5',
  indigoSoft:'#eef2ff',
  green:     '#16a34a',
  greenSoft: '#f0fdf4',
  greenLight:'#bbf7d0',
  amber:     '#d97706',
  amberSoft: '#fffbeb',
  amberLight:'#fde68a',
  red:       '#dc2626',
  slate:     '#64748b',
  slateLight:'#f1f5f9',
  border:    '#e2e8f0',
  white:     '#ffffff',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const formatName = (name = ''): string =>
  name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// Birth year / legacy age / full date string / timestamp → current age string.
export const getAge = (dob?: string | number): string => ageString(dob);

// Handles arrays, JSON-encoded string arrays, underscore_keys, and deduplication
const NULL_STRINGS = new Set(['null', 'undefined', 'nan', 'none', 'n/a', '']);
export const formatAreas = (raw: unknown): string[] => {
  let items: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const s = String(item ?? '').trim();
      if (!s) continue;
      if (s.startsWith('[')) {
        try { const p = JSON.parse(s); if (Array.isArray(p)) { items.push(...p.map(String)); continue; } } catch { /* ignore */ }
      }
      items.push(s);
    }
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try { const p = JSON.parse(trimmed); if (Array.isArray(p)) { items = p.map(String); } } catch { /* ignore */ }
    } else {
      items = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  const seen = new Set<string>();
  return items
    .map((a) => a.replace(/_/g, ' ').trim())
    .filter((a) => !!a && !NULL_STRINGS.has(a.toLowerCase()))
    .map((a) => a.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '))
    .filter((v) => { if (seen.has(v)) return false; seen.add(v); return true; });
};

// ─── Stat tile ────────────────────────────────────────────────────────────────
export const StatTile = ({ value, label, color, bg }: {
  value: string; label: string; color: string; bg: string;
}): React.JSX.Element => (
  <View style={[st.tile, { backgroundColor: bg }]}>
    <AppText style={[st.value, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</AppText>
    <AppText style={st.label}>{label}</AppText>
  </View>
);
const st = StyleSheet.create({
  tile:  { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 3 },
  value: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '600', color: C.slate, textAlign: 'center' },
});

// ─── Info row ─────────────────────────────────────────────────────────────────
export const InfoRow = ({ icon, label, value, iconBg }: {
  icon: string; label: string; value?: string | number | null; iconBg?: string;
}): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  if (value == null || value === '' || value === 0) return null;
  return (
    <View style={[inf.row, { borderBottomColor: C.border }]}>
      <View style={[inf.iconBox, iconBg ? { backgroundColor: iconBg } : {}]}>
        <AppText style={{ fontSize: 14 }}>{icon}</AppText>
      </View>
      <AppText style={[inf.label, { color: C.slate }]}>{label}</AppText>
      <AppText style={[inf.value, { color: theme.colors.text }]}>{String(value)}</AppText>
    </View>
  );
};
const inf = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  iconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.slateLight, alignItems: 'center', justifyContent: 'center' },
  label:   { flex: 1, fontSize: 13, fontWeight: '500', color: C.slate },
  value:   { fontSize: 13, fontWeight: '700', textAlign: 'right', maxWidth: '55%' },
});

// ─── Card section ─────────────────────────────────────────────────────────────
export const Section = ({ title, accent, children }: {
  title: string; accent: string; children: React.ReactNode;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View style={[sec.card, { backgroundColor: theme.colors.card }]}>
      <View style={[sec.titleRow, { borderLeftColor: accent }]}>
        <AppText style={sec.title}>{title}</AppText>
      </View>
      {children}
    </View>
  );
};
const sec = StyleSheet.create({
  card:     { borderRadius: 20, padding: 16, shadowColor: '#142250', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 1 },
  titleRow: { borderLeftWidth: 3, paddingLeft: 10, marginBottom: 14 },
  title:    { fontSize: 14, fontWeight: '800', color: C.navy, letterSpacing: 0.2 },
});

// ─── Document Row ─────────────────────────────────────────────────────────────
export const DocRow = ({ icon, iconBg, name, meta, onPress, isLast = false }: {
  icon: string; iconBg: string; name: string; meta: string;
  onPress: () => void; isLast?: boolean;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[dr.row, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }]}
    >
      <View style={[dr.iconBox, { backgroundColor: iconBg }]}>
        <AppText style={dr.icon}>{icon}</AppText>
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={[dr.name, { color: theme.colors.text }]} numberOfLines={2}>{name}</AppText>
        <AppText style={dr.meta}>{meta}</AppText>
      </View>
      <View style={dr.pill}>
        <AppText style={dr.pillTxt}>{t('wp_view')}</AppText>
      </View>
    </TouchableOpacity>
  );
};
const dr = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  icon:    { fontSize: 18, lineHeight: 22 },
  name:    { fontSize: 13, fontWeight: '700' },
  meta:    { fontSize: 11, color: C.slate, marginTop: 2 },
  pill:    { backgroundColor: '#EBF1FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  pillTxt: { fontSize: 11, fontWeight: '800', color: '#1037A4' },
});

// ─── Loading skeleton ─────────────────────────────────────────────────────────
export const LoadingSkeleton = (): React.JSX.Element => {
  const pulse = C.slateLight;
  return (
    <View style={{ flex: 1, backgroundColor: '#1037A4' }}>
      <View style={{ paddingTop: 16, height: 240, backgroundColor: '#1037A4', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 24, gap: 10 }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <View style={{ width: 140, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <View style={{ width: 100, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.08)' }} />
      </View>
      <View style={{ backgroundColor: '#f8fafc', flex: 1, padding: 14, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[0,1,2,3].map((i) => <View key={i} style={{ flex: 1, height: 72, borderRadius: 14, backgroundColor: pulse }} />)}
        </View>
        <View style={{ height: 140, borderRadius: 16, backgroundColor: pulse }} />
        <View style={{ height: 200, borderRadius: 16, backgroundColor: pulse }} />
      </View>
    </View>
  );
};
