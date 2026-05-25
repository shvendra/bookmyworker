import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useAppTheme } from '../../../core/theme';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import type { RawAgent } from '../../../core/api/endpoints/workerApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { apiClient } from '../../../core/api/client';
import { useToast } from '../../../shared/state/toast/ToastContext';
import type { MainStackParamList } from '../../../app/navigation/types';
import WORKER_CATEGORIES from '../../../shared/data/categories.json';
import { indianStates } from '../../../shared/data/stateDistrict';
import { buildPhotoUrl } from '../../../core/config/env';

const PAGE_LIMIT = 25;

// ─── Design Tokens ────────────────────────────────────────────────────────────
const BRAND       = '#1037A4';
const BRAND_DARK  = '#0d2d8f';
const BRAND_SOFT  = '#e8eeff';
const AGENT_COL   = '#7c3aed';
const AGENT_SOFT  = '#f5f3ff';
const GREEN       = '#16a34a';
const GREEN_SOFT  = '#f0fdf4';
const AMBER       = '#d97706';
const AMBER_SOFT  = '#fffbeb';
const WHITE       = '#ffffff';
const SLATE       = '#64748b';
const SLATE_LT    = '#f1f5f9';
const BORDER      = '#e2e8f0';
const NAVY        = '#0f172a';

// Legacy palette aliases used across sub-components
const C = {
  navy:        NAVY,
  blue:        BRAND,
  blueDark:    BRAND_DARK,
  blueSoft:    BRAND_SOFT,
  blueLight:   '#dbeafe',
  indigo:      AGENT_COL,
  indigoSoft:  AGENT_SOFT,
  green:       GREEN,
  greenSoft:   GREEN_SOFT,
  greenLight:  '#bbf7d0',
  amber:       AMBER,
  amberSoft:   AMBER_SOFT,
  amberLight:  '#fde68a',
  red:         '#dc2626',
  redSoft:     '#fff1f2',
  slate:       SLATE,
  slateLight:  SLATE_LT,
  slateXLight: '#f8fafc',
  border:      BORDER,
  white:       WHITE,
  shadow:      NAVY,
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface CatEntry {
  label: string;
  value: string;
  subcategories?: Array<{ label: string; value: string }>;
}
const CATEGORIES = WORKER_CATEGORIES as CatEntry[];

interface WorkerFilters {
  workerType: string;
  subCategory: string;
  state: string;
  district: string;
  tehsil: string;
  gender: string;
  workerGroup: string;
  ageMin: string;
  ageMax: string;
  qualification: string;
}
const EMPTY_FILTERS: WorkerFilters = {
  workerType: '',
  subCategory: '',
  state: '',
  district: '',
  tehsil: '',
  gender: '',
  workerGroup: '',
  ageMin: '',
  ageMax: '',
  qualification: '',
};

const CALL_OUTCOMES = [
  { value: 'not_picked',            label: 'Not Picked' },
  { value: 'switched_off',          label: 'Switched Off' },
  { value: 'busy',                  label: 'Busy' },
  { value: 'wrong_number',          label: 'Wrong Number' },
  { value: 'invalid_number',        label: 'Invalid Number' },
  { value: 'call_later',            label: 'Call Later' },
  { value: 'follow_up_required',    label: 'Follow Up Required' },
  { value: 'follow_up_done',        label: 'Follow Up Done' },
  { value: 'available_immediately', label: 'Available Immediately' },
  { value: 'available_next_week',   label: 'Available Next Week' },
  { value: 'available_next_month',  label: 'Available Next Month' },
  { value: 'currently_working',     label: 'Currently Working' },
  { value: 'interested',            label: 'Interested' },
  { value: 'highly_interested',     label: 'Highly Interested' },
  { value: 'not_interested',        label: 'Not Interested' },
  { value: 'maybe_interested',      label: 'Maybe Interested' },
  { value: 'relevant',              label: 'Relevant' },
  { value: 'not_relevant',          label: 'Not Relevant' },
  { value: 'job_confirmed',         label: 'Job Confirmed' },
  { value: 'joined_work',           label: 'Joined Work' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const normalizeText = (text = ''): string =>
  String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ');

const formatName = (name = ''): string =>
  name
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const getAge = (dob?: string | number): string => {
  if (dob == null || dob === '') return '';
  const timestamp = Number(dob);
  if (isNaN(timestamp)) return '';
  if (String(dob).length <= 5) {
    if (timestamp > 1900 && timestamp <= new Date().getFullYear())
      return String(new Date().getFullYear() - timestamp);
    return String(timestamp);
  }
  const ms = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
  const birth = new Date(ms);
  if (isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return String(age);
};

const getCategorySubcategories = (selected: string): string[] => {
  if (!selected) return [];
  const cat = CATEGORIES.find(
    (c) =>
      normalizeText(c.label) === normalizeText(selected) ||
      normalizeText(c.value) === normalizeText(selected),
  );
  return (cat?.subcategories ?? []).map((s) => normalizeText(s.label || s.value));
};

const getMatchedAreasOfWork = (areas: string[] = [], selected = ''): string[] => {
  const normalized = areas
    .flatMap((item) => {
      try {
        if (typeof item === 'string' && item.startsWith('['))
          return JSON.parse(item) as string[];
        return item;
      } catch {
        return item;
      }
    })
    .filter(Boolean)
    .map((item) => normalizeText(String(item)));
  if (!selected) return normalized;
  const allowed = getCategorySubcategories(selected);
  return normalized.filter((a) => allowed.includes(a));
};

function countActive(f: WorkerFilters): number {
  return [
    f.workerType,
    f.subCategory,
    f.state,
    f.district,
    f.tehsil,
    f.gender,
    f.workerGroup,
    f.ageMin,
    f.ageMax,
    f.qualification,
  ].filter(Boolean).length;
}

// ─── Picker Modal ─────────────────────────────────────────────────────────────
const PickerModal = ({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  allLabel = 'All',
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
  allLabel?: string;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const shown = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[pm.root, { backgroundColor: theme.colors.background }]}>
        <View style={[pm.header, { borderBottomColor: C.border, paddingTop: insets.top + 14 }]}>
          <View>
            <AppText style={[pm.title, { color: theme.colors.text }]}>{title}</AppText>
            <AppText style={[pm.sub, { color: C.slate }]}>
              {options.length} options available
            </AppText>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={pm.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <AppText style={pm.closeTxt}>✕</AppText>
          </TouchableOpacity>
        </View>
        {options.length > 6 && (
          <View
            style={[
              pm.searchWrap,
              { backgroundColor: theme.colors.card, borderColor: C.border },
            ]}
          >
            <AppText style={pm.searchIcon}>⌕</AppText>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search…"
              placeholderTextColor={C.slate}
              style={[pm.searchInput, { color: theme.colors.text }]}
            />
            {q.length > 0 && (
              <TouchableOpacity onPress={() => setQ('')} style={{ paddingRight: 14 }}>
                <AppText style={{ color: C.slate, fontSize: 14 }}>✕</AppText>
              </TouchableOpacity>
            )}
          </View>
        )}
        <FlatList
          data={[allLabel, ...shown]}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const val = item === allLabel ? '' : item;
            const active = selected === val;
            return (
              <TouchableOpacity
                onPress={() => {
                  onSelect(val);
                  setQ('');
                  onClose();
                }}
                activeOpacity={0.7}
                style={[
                  pm.item,
                  {
                    borderBottomColor: C.border,
                    backgroundColor: active ? C.blueSoft : 'transparent',
                  },
                ]}
              >
                <AppText
                  style={[
                    pm.itemText,
                    {
                      color: active ? C.blue : theme.colors.text,
                      fontWeight: active ? '700' : '400',
                    },
                  ]}
                >
                  {item}
                </AppText>
                {active && (
                  <View style={pm.checkCircle}>
                    <AppText style={pm.checkTxt}>✓</AppText>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
};
const pm = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title:      { fontSize: 17, fontWeight: '800', color: NAVY },
  sub:        { fontSize: 12, marginTop: 1, color: SLATE },
  closeBtn:   { width: 32, height: 32, borderRadius: 16, backgroundColor: SLATE_LT, alignItems: 'center', justifyContent: 'center' },
  closeTxt:   { fontSize: 13, fontWeight: '700', color: SLATE },
  searchWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, marginHorizontal: 16, marginVertical: 12 },
  searchIcon: { fontSize: 18, paddingHorizontal: 12, color: SLATE },
  searchInput:{ flex: 1, paddingVertical: 12, fontSize: 15 },
  item:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  itemText:   { fontSize: 15 },
  checkCircle:{ width: 22, height: 22, borderRadius: 11, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  checkTxt:   { color: WHITE, fontSize: 12, fontWeight: '800' },
});

// ─── Dropdown Field ───────────────────────────────────────────────────────────
const DropField = ({
  label,
  value,
  placeholder,
  onPress,
  disabled,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const active = !!value;
  return (
    <View style={{ marginBottom: 12 }}>
      <AppText style={df.label}>{label}</AppText>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.75}
        style={[
          df.field,
          {
            borderColor: active ? BRAND : BORDER,
            backgroundColor: active ? BRAND_SOFT : theme.colors.card,
            opacity: disabled ? 0.45 : 1,
          },
        ]}
      >
        <AppText
          style={[df.text, { color: active ? BRAND : SLATE }]}
          numberOfLines={1}
        >
          {value || placeholder}
        </AppText>
        <AppText style={[df.chevron, { color: active ? BRAND : SLATE }]}>›</AppText>
      </TouchableOpacity>
    </View>
  );
};
const df = StyleSheet.create({
  label:   { fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6, color: SLATE },
  field:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  text:    { flex: 1, fontSize: 14, fontWeight: '500' },
  chevron: { fontSize: 20, fontWeight: '300' },
});

// ─── Filter Sheet ─────────────────────────────────────────────────────────────
const FilterSheet = ({
  visible,
  initial,
  onApply,
  onClose,
  userState,
}: {
  visible: boolean;
  initial: WorkerFilters;
  userState: string;
  onApply: (f: WorkerFilters) => void;
  onClose: () => void;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [f, setF] = useState<WorkerFilters>(initial);
  const [picker, setPicker] = useState<
    'cat' | 'subcat' | 'state' | 'district' | 'tehsil' | null
  >(null);
  const lastVisible = useRef(false);
  if (visible && !lastVisible.current) setF(initial);
  lastVisible.current = visible;

  const set = <K extends keyof WorkerFilters>(k: K, v: WorkerFilters[K]): void => {
    setF((prev) => {
      const next = { ...prev, [k]: v };
      if (k === 'state') { next.district = ''; next.tehsil = ''; }
      if (k === 'district') { next.tehsil = ''; }
      if (k === 'workerType') { next.subCategory = ''; }
      return next;
    });
  };

  const stateList    = useMemo(() => Object.keys(indianStates).sort(), []);
  const districtList = useMemo(
    () => (f.state ? Object.keys(indianStates[f.state] ?? {}).sort() : []),
    [f.state],
  );
  const tehsilList = useMemo(
    () =>
      f.state && f.district
        ? (indianStates[f.state]?.[f.district] ?? []).sort()
        : [],
    [f.state, f.district],
  );
  const catLabels    = useMemo(() => CATEGORIES.map((c) => c.label), []);
  const subCatLabels = useMemo(
    () =>
      CATEGORIES.find((c) => c.label === f.workerType)?.subcategories?.map(
        (s) => s.label,
      ) ?? [],
    [f.workerType],
  );

  const activeCount = countActive(f);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[fsh.root, { backgroundColor: theme.colors.background }]}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={[fsh.header, { paddingTop: insets.top + 16, backgroundColor: theme.colors.background, borderBottomColor: BORDER }]}>
          <View style={fsh.headerLeft}>
            <AppText style={[fsh.headerTitle, { color: theme.colors.text }]}>Filter Professionals</AppText>
            <AppText style={[fsh.headerSub, { color: SLATE }]}>
              {activeCount > 0
                ? `${activeCount} filter${activeCount > 1 ? 's' : ''} active`
                : 'Narrow down your search'}
            </AppText>
          </View>
          <View style={fsh.headerActions}>
            {activeCount > 0 && (
              <TouchableOpacity
                onPress={() => setF({ ...EMPTY_FILTERS, state: userState })}
                style={fsh.resetBtn}
              >
                <AppText style={fsh.resetTxt}>Reset</AppText>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={fsh.closeBtn}>
              <AppText style={fsh.closeTxt}>✕</AppText>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={fsh.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Location ──────────────────────────────────────────────── */}
          <View style={[fsh.card, { borderColor: BORDER, backgroundColor: theme.colors.card }]}>
            <View style={fsh.cardHeader}>
              <View style={[fsh.cardIcon, { backgroundColor: BRAND_SOFT }]}>
                <AppText style={{ fontSize: 14 }}>📍</AppText>
              </View>
              <AppText style={[fsh.cardTitle, { color: theme.colors.text }]}>Location</AppText>
            </View>
            <DropField
              label="State"
              value={f.state}
              placeholder="All States"
              onPress={() => setPicker('state')}
            />
            <DropField
              label="District"
              value={f.district}
              placeholder={f.state ? 'Select district' : 'Select state first'}
              onPress={() => f.state && setPicker('district')}
              disabled={!f.state}
            />
            {(districtList.length > 0 || f.tehsil) && (
              <DropField
                label="Tehsil / Block"
                value={f.tehsil}
                placeholder={f.district ? 'Select tehsil' : 'Select district first'}
                onPress={() => f.district && setPicker('tehsil')}
                disabled={!f.district}
              />
            )}
          </View>

          {/* ── Work Type ─────────────────────────────────────────────── */}
          <View style={[fsh.card, { borderColor: BORDER, backgroundColor: theme.colors.card }]}>
            <View style={fsh.cardHeader}>
              <View style={[fsh.cardIcon, { backgroundColor: AGENT_SOFT }]}>
                <AppText style={{ fontSize: 14 }}>💼</AppText>
              </View>
              <AppText style={[fsh.cardTitle, { color: theme.colors.text }]}>Work Type</AppText>
            </View>
            <DropField
              label="Category"
              value={f.workerType}
              placeholder="All categories"
              onPress={() => setPicker('cat')}
            />
            {f.workerType && subCatLabels.length > 0 && (
              <DropField
                label="Sub-category"
                value={f.subCategory}
                placeholder="All sub-categories"
                onPress={() => setPicker('subcat')}
              />
            )}
          </View>

          {/* ── Professional Type ─────────────────────────────────────── */}
          <View style={[fsh.card, { borderColor: BORDER, backgroundColor: theme.colors.card }]}>
            <View style={fsh.cardHeader}>
              <View style={[fsh.cardIcon, { backgroundColor: GREEN_SOFT }]}>
                <AppText style={{ fontSize: 14 }}>🧑‍💼</AppText>
              </View>
              <AppText style={[fsh.cardTitle, { color: theme.colors.text }]}>Professional Type</AppText>
            </View>
            <View style={fsh.typeGrid}>
              {[
                { label: 'Individual Worker', sub: 'Single professional', val: 'individual', icon: '👤' },
                { label: 'Agent / Group',     sub: 'Team or agency',      val: 'group',      icon: '👥' },
              ].map((opt) => {
                const active = f.workerGroup === opt.val;
                return (
                  <TouchableOpacity
                    key={opt.val}
                    onPress={() => set('workerGroup', active ? '' : opt.val)}
                    activeOpacity={0.8}
                    style={[fsh.typeCard, {
                      backgroundColor: active ? NAVY : theme.colors.background,
                      borderColor: active ? NAVY : BORDER,
                    }]}
                  >
                    <AppText style={fsh.typeIcon}>{opt.icon}</AppText>
                    <AppText style={[fsh.typeLabel, { color: active ? WHITE : NAVY }]} numberOfLines={1}>{opt.label}</AppText>
                    <AppText style={[fsh.typeSub, { color: active ? 'rgba(255,255,255,0.65)' : SLATE }]} numberOfLines={1}>{opt.sub}</AppText>
                    {active && (
                      <View style={fsh.typeCheck}>
                        <AppText style={{ color: WHITE, fontSize: 9, fontWeight: '900' }}>✓</AppText>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Demographics ──────────────────────────────────────────── */}
          <View style={[fsh.card, { borderColor: BORDER, backgroundColor: theme.colors.card }]}>
            <View style={fsh.cardHeader}>
              <View style={[fsh.cardIcon, { backgroundColor: AMBER_SOFT }]}>
                <AppText style={{ fontSize: 14 }}>🎯</AppText>
              </View>
              <AppText style={[fsh.cardTitle, { color: theme.colors.text }]}>Demographics</AppText>
            </View>

            {/* Gender */}
            <AppText style={fsh.fieldLabel}>Gender</AppText>
            <View style={[fsh.chipRow, { marginBottom: 18 }]}>
              {[
                { label: 'Male',   icon: '♂' },
                { label: 'Female', icon: '♀' },
                { label: 'Other',  icon: '⚧' },
              ].map((g) => {
                const active = f.gender === g.label;
                return (
                  <TouchableOpacity
                    key={g.label}
                    onPress={() => set('gender', active ? '' : g.label)}
                    activeOpacity={0.8}
                    style={[fsh.genderChip, {
                      backgroundColor: active ? BRAND : theme.colors.background,
                      borderColor: active ? BRAND : BORDER,
                    }]}
                  >
                    <AppText style={[fsh.genderIcon, { color: active ? WHITE : SLATE }]}>{g.icon}</AppText>
                    <AppText style={[fsh.genderChipTxt, { color: active ? WHITE : theme.colors.text }]}>{g.label}</AppText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Age Range */}
            <AppText style={fsh.fieldLabel}>Age Range</AppText>
            <View style={fsh.ageGrid}>
              <View style={{ flex: 1 }}>
                <AppText style={fsh.ageColLabel}>FROM</AppText>
                <View style={[fsh.ageBox, {
                  borderColor: f.ageMin ? BRAND : BORDER,
                  backgroundColor: f.ageMin ? BRAND_SOFT : theme.colors.background,
                }]}>
                  <TextInput
                    value={f.ageMin}
                    onChangeText={(v) => set('ageMin', v.replace(/\D/g, ''))}
                    placeholder="18"
                    placeholderTextColor={SLATE}
                    keyboardType="number-pad"
                    maxLength={3}
                    style={[fsh.ageBoxInput, { color: theme.colors.text }]}
                  />
                  <View style={[fsh.ageSuffixBox, { borderLeftColor: f.ageMin ? BRAND + '30' : BORDER }]}>
                    <AppText style={[fsh.ageSuffixTxt, { color: f.ageMin ? BRAND : SLATE }]}>yrs</AppText>
                  </View>
                </View>
              </View>
              <View style={fsh.ageSep}>
                <AppText style={{ color: SLATE, fontWeight: '700', fontSize: 18 }}>–</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={fsh.ageColLabel}>TO</AppText>
                <View style={[fsh.ageBox, {
                  borderColor: f.ageMax ? BRAND : BORDER,
                  backgroundColor: f.ageMax ? BRAND_SOFT : theme.colors.background,
                }]}>
                  <TextInput
                    value={f.ageMax}
                    onChangeText={(v) => set('ageMax', v.replace(/\D/g, ''))}
                    placeholder="60"
                    placeholderTextColor={SLATE}
                    keyboardType="number-pad"
                    maxLength={3}
                    style={[fsh.ageBoxInput, { color: theme.colors.text }]}
                  />
                  <View style={[fsh.ageSuffixBox, { borderLeftColor: f.ageMax ? BRAND + '30' : BORDER }]}>
                    <AppText style={[fsh.ageSuffixTxt, { color: f.ageMax ? BRAND : SLATE }]}>yrs</AppText>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ── Qualification ─────────────────────────────────────────────── */}
          <View style={[fsh.card, { borderColor: BORDER, backgroundColor: theme.colors.card }]}>
            <View style={fsh.cardHeader}>
              <View style={[fsh.cardIcon, { backgroundColor: '#FFF8EC' }]}>
                <AppText style={{ fontSize: 14 }}>🎓</AppText>
              </View>
              <AppText style={[fsh.cardTitle, { color: theme.colors.text }]}>Qualification</AppText>
            </View>
            <View style={fsh.typeGrid}>
              {[
                { label: 'ITI / Diploma', sub: 'Certificate holders', val: 'ITI/Diploma', icon: '🎓' },
                { label: 'Graduate',      sub: "Bachelor's & above",  val: 'Graduate',    icon: '📜' },
              ].map((opt) => {
                const active = f.qualification === opt.val;
                return (
                  <TouchableOpacity
                    key={opt.val}
                    onPress={() => set('qualification', active ? '' : opt.val)}
                    activeOpacity={0.8}
                    style={[fsh.typeCard, {
                      backgroundColor: active ? '#F97316' : theme.colors.background,
                      borderColor: active ? '#F97316' : BORDER,
                    }]}
                  >
                    <AppText style={fsh.typeIcon}>{opt.icon}</AppText>
                    <AppText style={[fsh.typeLabel, { color: active ? WHITE : NAVY }]} numberOfLines={1}>{opt.label}</AppText>
                    <AppText style={[fsh.typeSub, { color: active ? 'rgba(255,255,255,0.65)' : SLATE }]} numberOfLines={1}>{opt.sub}</AppText>
                    {active && (
                      <View style={fsh.typeCheck}>
                        <AppText style={{ color: WHITE, fontSize: 9, fontWeight: '900' }}>✓</AppText>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

        </ScrollView>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <View style={[fsh.footer, { borderTopColor: BORDER, backgroundColor: theme.colors.background }]}>
          <TouchableOpacity onPress={onClose} style={fsh.cancelBtn} activeOpacity={0.8}>
            <AppText style={[fsh.cancelTxt, { color: theme.colors.text }]}>Cancel</AppText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onApply(f)} style={fsh.applyBtn} activeOpacity={0.88}>
            <AppText style={fsh.applyTxt}>
              {activeCount > 0 ? `Apply  ·  ${activeCount}` : 'Apply Filters'}
            </AppText>
          </TouchableOpacity>
        </View>

        <PickerModal
          visible={picker === 'cat'}
          title="Work Category"
          options={catLabels}
          selected={f.workerType}
          onSelect={(v) => set('workerType', v)}
          onClose={() => setPicker(null)}
          allLabel="All Categories"
        />
        <PickerModal
          visible={picker === 'subcat'}
          title="Sub-category"
          options={subCatLabels}
          selected={f.subCategory}
          onSelect={(v) => set('subCategory', v)}
          onClose={() => setPicker(null)}
          allLabel="All Sub-categories"
        />
        <PickerModal
          visible={picker === 'state'}
          title="State"
          options={stateList}
          selected={f.state}
          onSelect={(v) => set('state', v)}
          onClose={() => setPicker(null)}
          allLabel="All States"
        />
        <PickerModal
          visible={picker === 'district'}
          title="District / City"
          options={districtList}
          selected={f.district}
          onSelect={(v) => set('district', v)}
          onClose={() => setPicker(null)}
          allLabel="All Districts"
        />
        <PickerModal
          visible={picker === 'tehsil'}
          title="Tehsil / Block"
          options={tehsilList}
          selected={f.tehsil}
          onSelect={(v) => set('tehsil', v)}
          onClose={() => setPicker(null)}
          allLabel="All Blocks"
        />
      </View>
    </Modal>
  );
};
const fsh = StyleSheet.create({
  root:          { flex: 1 },

  // Header
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  headerLeft:    { flex: 1 },
  headerTitle:   { fontSize: 20, fontWeight: '900', color: NAVY, letterSpacing: -0.3 },
  headerSub:     { fontSize: 12, marginTop: 3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  resetBtn:      { borderWidth: 1.5, borderColor: BRAND, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  resetTxt:      { fontSize: 12, fontWeight: '800', color: BRAND },
  closeBtn:      { width: 32, height: 32, borderRadius: 16, backgroundColor: SLATE_LT, alignItems: 'center', justifyContent: 'center' },
  closeTxt:      { fontSize: 13, fontWeight: '700', color: SLATE },

  // Body / cards
  body:          { padding: 14, gap: 10, paddingBottom: 28 },
  card:          { borderRadius: 16, borderWidth: 1, padding: 16 },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardIcon:      { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle:     { fontSize: 14, fontWeight: '800', color: NAVY, letterSpacing: 0.1 },

  // Professional Type grid
  typeGrid:      { flexDirection: 'row', gap: 8 },
  typeCard:      { flex: 1, borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 4, position: 'relative' },
  typeIcon:      { fontSize: 22, marginBottom: 4 },
  typeLabel:     { fontSize: 13, fontWeight: '800' },
  typeSub:       { fontSize: 11 },
  typeCheck:     { position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: 9, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },

  // Demographics
  fieldLabel:    { fontSize: 11, fontWeight: '800', color: SLATE, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  chipRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  genderChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  genderIcon:    { fontSize: 14, fontWeight: '700' },
  genderChipTxt: { fontSize: 13, fontWeight: '700' },

  // Age Range
  ageGrid:       { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  ageColLabel:   { fontSize: 10, fontWeight: '800', color: SLATE, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  ageBox:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, overflow: 'hidden' },
  ageBoxInput:   { flex: 1, fontSize: 16, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 13, minWidth: 0 },
  ageSuffixBox:  { borderLeftWidth: 1, paddingHorizontal: 10, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  ageSuffixTxt:  { fontSize: 11, fontWeight: '800' },
  ageSep:        { paddingBottom: 14, alignItems: 'center' },

  // Footer
  footer:        { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  cancelBtn:     { flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', paddingVertical: 15 },
  cancelTxt:     { fontSize: 15, fontWeight: '700' },
  applyBtn:      { flex: 2, borderRadius: 14, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', paddingVertical: 15 },
  applyTxt:      { color: WHITE, fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
});

// ─── Call Outcome Picker ──────────────────────────────────────────────────────
const CallOutcomePicker = ({
  agentId,
  current,
  onSave,
  saving,
}: {
  agentId: string;
  current: string;
  onSave: (id: string, val: string) => void;
  saving: boolean;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  const label = CALL_OUTCOMES.find((o) => o.value === current)?.label;
  const hasOutcome = !!current;

  return (
    <>
      <TouchableOpacity
        onPress={() => setShow(true)}
        disabled={saving}
        activeOpacity={0.8}
        style={[
          co.btn,
          {
            borderColor: hasOutcome ? BRAND : BORDER,
            backgroundColor: hasOutcome ? BRAND_SOFT : theme.colors.card,
          },
        ]}
      >
        <View style={[co.dot, { backgroundColor: hasOutcome ? BRAND : SLATE }]} />
        <AppText
          style={[co.btnText, { color: hasOutcome ? BRAND : SLATE }]}
          numberOfLines={1}
        >
          {saving ? 'Saving…' : (label ?? 'Log Call Outcome')}
        </AppText>
        <AppText style={[co.chevron, { color: hasOutcome ? BRAND : SLATE }]}>›</AppText>
      </TouchableOpacity>

      <Modal
        visible={show}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShow(false)}
      >
        <View style={[co.sheet, { backgroundColor: theme.colors.background }]}>
          <View style={[co.sheetHeader, { borderBottomColor: BORDER, paddingTop: insets.top + 14 }]}>
            <View>
              <AppText style={[co.sheetTitle, { color: theme.colors.text }]}>Call Outcome</AppText>
              <AppText style={[co.sheetSub, { color: SLATE }]}>
                Select the result of your last call
              </AppText>
            </View>
            <TouchableOpacity onPress={() => setShow(false)} style={co.closeBtn}>
              <AppText style={co.closeTxt}>✕</AppText>
            </TouchableOpacity>
          </View>
          <FlatList
            data={CALL_OUTCOMES}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const active = current === item.value;
              return (
                <TouchableOpacity
                  onPress={() => {
                    onSave(agentId, item.value);
                    setShow(false);
                  }}
                  activeOpacity={0.7}
                  style={[
                    co.item,
                    {
                      borderBottomColor: BORDER,
                      backgroundColor: active ? BRAND_SOFT : 'transparent',
                    },
                  ]}
                >
                  <AppText
                    style={[
                      co.itemText,
                      {
                        color: active ? BRAND : theme.colors.text,
                        fontWeight: active ? '700' : '400',
                      },
                    ]}
                  >
                    {item.label}
                  </AppText>
                  {active && (
                    <View style={co.checkCircle}>
                      <AppText style={{ color: WHITE, fontSize: 11, fontWeight: '800' }}>
                        ✓
                      </AppText>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
};
const co = StyleSheet.create({
  btn:         { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, gap: 8 },
  dot:         { width: 7, height: 7, borderRadius: 3.5 },
  btnText:     { flex: 1, fontSize: 13, fontWeight: '600' },
  chevron:     { fontSize: 18, fontWeight: '300' },
  sheet:       { flex: 1 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  sheetTitle:  { fontSize: 17, fontWeight: '800', color: NAVY },
  sheetSub:    { fontSize: 12, marginTop: 2 },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: SLATE_LT, alignItems: 'center', justifyContent: 'center' },
  closeTxt:    { fontSize: 13, fontWeight: '700', color: SLATE },
  item:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  itemText:    { fontSize: 15 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
});

// ─── Worker Card ──────────────────────────────────────────────────────────────
interface AgentCardProps {
  agent: RawAgent;
  isSubscribed: boolean;
  isContactsExhausted: boolean;
  unlockedPhone?: string;
  loadingUnlock: boolean;
  callStatus: string;
  savingRemark: boolean;
  workerTypeApplied: string;
  appliedDistrict: string;
  onViewContact: () => void;
  onSubscribe: () => void;
  onTopup: () => void;
  onSaveRemark: (id: string, status: string) => void;
  onPress: () => void;
}

const AgentCard = ({
  agent,
  isSubscribed,
  isContactsExhausted,
  unlockedPhone,
  loadingUnlock,
  callStatus,
  savingRemark,
  workerTypeApplied,
  appliedDistrict,
  onViewContact,
  onSubscribe,
  onTopup,
  onSaveRemark,
  onPress,
}: AgentCardProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const photoUrl = buildPhotoUrl(agent.profilePhoto);
  const initials = formatName(agent.name ?? '?')
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const isAgent     = String(agent.role ?? '').toLowerCase() === 'agent';
  const matchedAreas = getMatchedAreasOfWork(agent.areasOfWork ?? [], workerTypeApplied);
  const age = getAge(agent.dob);
  const exp =
    agent.workExperience !== undefined
      ? Number(agent.workExperience) > 0
        ? Number(agent.workExperience)
        : 3
      : undefined;
  const accentColor = isAgent ? AGENT_COL : BRAND;
  const accentBg    = isAgent ? AGENT_SOFT : BRAND_SOFT;
  const roleLabel   = isAgent ? 'AGENT' : 'WORKER';
  const wage        = agent.fixedSalary ?? agent.salaryFrom;
  const wageText    = wage
    ? `₹${wage}${agent.salaryTo && agent.salaryTo !== wage ? `–${agent.salaryTo}` : ''}/day`
    : null;
  return (
    <View
      style={[
        wc.card,
        {
          backgroundColor: theme.colors.card,
          shadowColor: BRAND,
        },
      ]}
    >
      {/* Left accent bar */}
      <View style={[wc.accentBar, { backgroundColor: accentColor }]} />

      <View style={{ flex: 1 }}>
        {/* ── Top: tappable info row ── */}
        <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={wc.infoSection}>
          {/* Avatar */}
          <View style={wc.avatarWrap}>
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={[wc.avatar, { borderColor: accentColor }]}
              />
            ) : (
              <View style={[wc.avatarFallback, { backgroundColor: accentBg, borderColor: accentColor }]}>
                <AppText style={[wc.initials, { color: accentColor }]}>{initials}</AppText>
              </View>
            )}
            {agent.veryfiedBage && (
              <View style={wc.verifiedBadge}>
                <AppText style={wc.verifiedTxt}>✓</AppText>
              </View>
            )}
          </View>

          {/* Text block */}
          <View style={{ flex: 1 }}>
            {/* Name + role badge */}
            <View style={wc.nameRow}>
              <AppText style={[wc.name, { color: theme.colors.text }]} numberOfLines={1}>
                {formatName(agent.name ?? 'Unknown')}
              </AppText>
              <View style={[wc.rolePill, { backgroundColor: accentBg, borderColor: accentColor + '50' }]}>
                <AppText style={[wc.roleTxt, { color: accentColor }]}>{roleLabel}</AppText>
              </View>
            </View>

            {/* Location — show applied district filter if set, else worker's own district (mirrors CRM finalCitySearch logic) */}
            {((appliedDistrict || agent.district) ?? agent.state) ? (
              <AppText style={wc.location} numberOfLines={1}>
                {'📍 '}
                {[appliedDistrict || agent.district, agent.state].filter(Boolean).join(', ')}
              </AppText>
            ) : null}

            {/* Meta chips */}
            <View style={wc.metaRow}>
              {!!age && (
                <View style={wc.metaChip}>
                  <AppText style={wc.metaChipTxt}>{age} yrs</AppText>
                </View>
              )}
              {exp !== undefined && (
                <View style={wc.metaChip}>
                  <AppText style={wc.metaChipTxt}>{exp}y exp</AppText>
                </View>
              )}
              {!!agent.gender && (
                <View style={wc.metaChip}>
                  <AppText style={wc.metaChipTxt}>{agent.gender}</AppText>
                </View>
              )}
              {!!wageText && (
                <View style={[wc.metaChip, wc.wageChip]}>
                  <AppText style={[wc.metaChipTxt, wc.wageTxt]}>{wageText}</AppText>
                </View>
              )}
            </View>

            {/* workerSubType / agentType badge */}
            {!!(agent.workerSubType || agent.agentType) && (
              <View style={wc.subTypeBadge}>
                <AppText style={wc.subTypeTxt}>{agent.workerSubType ?? agent.agentType}</AppText>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Skills strip */}
        {matchedAreas.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[wc.skillsStrip, { borderTopColor: BORDER }]}
            contentContainerStyle={wc.skillsContent}
          >
            {matchedAreas.map((area, idx) => (
              <View key={`${area}-${idx}`} style={wc.skillChip}>
                <AppText style={wc.skillChipTxt}>
                  {area.charAt(0).toUpperCase() + area.slice(1)}
                </AppText>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Resume button */}
        {!!agent.resumeUrl && (
          <TouchableOpacity
            onPress={() => void Linking.openURL(agent.resumeUrl!)}
            style={[wc.resumeBtn, { borderTopColor: BORDER }]}
            activeOpacity={0.8}
          >
            <AppText style={wc.resumeIcon}>📄</AppText>
            <AppText style={wc.resumeTxt}>View Resume / CV</AppText>
            <AppText style={{ color: BRAND, fontSize: 16 }}>›</AppText>
          </TouchableOpacity>
        )}

        {/* ── Contact CTA ── */}
        <View style={[wc.ctaSection, { borderTopColor: BORDER }]}>
          {unlockedPhone ? (
            // Already unlocked — show call + WhatsApp
            <View style={wc.unlockedRow}>
              <TouchableOpacity
                onPress={() => void Linking.openURL(`tel:${unlockedPhone}`)}
                style={wc.callBtn}
                activeOpacity={0.85}
              >
                <AppText style={wc.callBtnTxt}>📞 {unlockedPhone}</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void Linking.openURL(`https://wa.me/91${unlockedPhone}`)}
                style={wc.waBtn}
                activeOpacity={0.85}
              >
                <AppText style={wc.waBtnTxt}>WhatsApp</AppText>
              </TouchableOpacity>
            </View>
          ) : isContactsExhausted ? (
            // Subscribed but contact limit reached
            <TouchableOpacity onPress={onTopup} activeOpacity={0.82} style={wc.topupCta}>
              <View style={[wc.lockIconBox, { backgroundColor: '#fff7ed' }]}>
                <AppText style={{ fontSize: 16 }}>⚠️</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={wc.topupTitle}>Contact Limit Reached</AppText>
                <AppText style={wc.topupSub}>Upgrade your plan to unlock more contacts</AppText>
              </View>
              <AppText style={wc.lockChevron}>›</AppText>
            </TouchableOpacity>
          ) : isSubscribed ? (
            // Subscribed with remaining contacts — unlock + call
            <TouchableOpacity
              onPress={onViewContact}
              disabled={loadingUnlock}
              style={[wc.callAgentBtn, { opacity: loadingUnlock ? 0.7 : 1 }]}
              activeOpacity={0.85}
            >
              {loadingUnlock ? (
                <ActivityIndicator size="small" color={WHITE} />
              ) : (
                <>
                  <AppText style={wc.callAgentIcon}>💬</AppText>
                  <AppText style={wc.callAgentTxt}>Call Agent</AppText>
                </>
              )}
            </TouchableOpacity>
          ) : (
            // Not subscribed — show Call Agent but opens subscribe flow
            <TouchableOpacity onPress={onSubscribe} activeOpacity={0.82} style={wc.callAgentBtn}>
              <AppText style={wc.callAgentIcon}>💬</AppText>
              <AppText style={wc.callAgentTxt}>Call Agent</AppText>
            </TouchableOpacity>
          )}
        </View>

        {/* Call outcome picker */}
        {isSubscribed && (
          <View style={[wc.remarkRow, { borderTopColor: BORDER }]}>
            <CallOutcomePicker
              agentId={agent._id}
              current={callStatus}
              onSave={onSaveRemark}
              saving={savingRemark}
            />
          </View>
        )}

        {/* Agent group banner */}
        {isAgent && (
          <View style={[wc.agentBanner, { borderTopColor: '#c4b5fd' }]}>
            <AppText style={{ fontSize: 13 }}>👥</AppText>
            <AppText style={wc.agentBannerTxt}>
              Agent-managed groups · Ideal for bulk hiring
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
};

const wc = StyleSheet.create({
  card:          { flexDirection: 'row', borderRadius: 14, marginBottom: 8, overflow: 'hidden', elevation: 3, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER },
  accentBar:     { width: 4, opacity: 0.35 },

  infoSection:   { flexDirection: 'row', padding: 12, gap: 12 },

  avatarWrap:    { position: 'relative', alignSelf: 'flex-start' },
  avatar:        { width: 58, height: 58, borderRadius: 29, borderWidth: 2 },
  avatarFallback:{ width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  initials:      { fontSize: 20, fontWeight: '800' },
  verifiedBadge: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: WHITE },
  verifiedTxt:   { color: WHITE, fontSize: 8, fontWeight: '900' },

  nameRow:       { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 3 },
  name:          { fontSize: 15, fontWeight: '800', flex: 1, letterSpacing: 0.1 },
  rolePill:      { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  roleTxt:       { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  location:      { fontSize: 11, fontWeight: '500', color: SLATE, marginBottom: 5 },
  metaRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  metaChip:      { backgroundColor: SLATE_LT, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: BORDER },
  metaChipTxt:   { fontSize: 10.5, fontWeight: '700', color: SLATE },
  wageChip:      { backgroundColor: GREEN_SOFT, borderColor: '#bbf7d0', borderRadius: 6 },
  wageTxt:       { color: GREEN, fontWeight: '800' },

  subTypeBadge:  { marginTop: 4, alignSelf: 'flex-start', backgroundColor: '#fff7ed', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: '#fed7aa' },
  subTypeTxt:    { fontSize: 9.5, fontWeight: '700', color: '#d97706' },

  resumeBtn:     { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth },
  resumeIcon:    { fontSize: 13 },
  resumeTxt:     { flex: 1, fontSize: 11.5, fontWeight: '700', color: BRAND },

  skillsStrip:   { borderTopWidth: StyleSheet.hairlineWidth },
  skillsContent: { paddingHorizontal: 12, paddingVertical: 7, gap: 5, flexDirection: 'row' },
  skillChip:     { backgroundColor: BRAND_SOFT, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: BRAND + '25' },
  skillChipTxt:  { fontSize: 10.5, fontWeight: '700', color: BRAND },

  ctaSection:    { paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  unlockedRow:   { flexDirection: 'row', gap: 7 },
  callBtn:       { flex: 1, backgroundColor: NAVY, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  callBtnTxt:    { color: WHITE, fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  waBtn:         { flex: 1, backgroundColor: '#25D366', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  waBtnTxt:      { color: WHITE, fontSize: 13, fontWeight: '800' },
  callAgentBtn:  { flex: 1, flexDirection: 'row', backgroundColor: BRAND, borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 7 },
  callAgentIcon: { fontSize: 14, color: WHITE },
  callAgentTxt:  { color: WHITE, fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  viewContactBtn:{ backgroundColor: BRAND, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  viewContactTxt:{ color: WHITE, fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  lockCta:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: AMBER_SOFT, borderRadius: 10, borderWidth: 1, borderColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 9 },
  lockIconBox:   { width: 34, height: 34, borderRadius: 9, borderWidth: 1, borderColor: '#fde68a', backgroundColor: AMBER_SOFT, alignItems: 'center', justifyContent: 'center' },
  lockTitle:     { fontSize: 12, fontWeight: '700', color: '#92400e' },
  lockSub:       { fontSize: 10.5, fontWeight: '500', marginTop: 1, color: SLATE },
  lockChevron:   { fontSize: 20, fontWeight: '300', color: AMBER },
  topupCta:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff7ed', borderRadius: 10, borderWidth: 1, borderColor: '#fed7aa', paddingHorizontal: 10, paddingVertical: 9 },
  topupTitle:    { fontSize: 12, fontWeight: '700', color: '#c2410c' },
  topupSub:      { fontSize: 10.5, fontWeight: '500', marginTop: 1, color: SLATE },

  remarkRow:     { paddingHorizontal: 10, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth },
  agentBanner:   { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 7, borderTopWidth: 1, backgroundColor: AGENT_SOFT },
  agentBannerTxt:{ fontSize: 11, fontWeight: '600', flex: 1, color: '#4c1d95' },
});

// ─── Skeleton Card ────────────────────────────────────────────────────────────
const SkeletonCard = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const bg = theme.mode === 'dark' ? '#1e293b' : SLATE_LT;

  return (
    <Animated.View
      style={[sk.card, { backgroundColor: theme.colors.card, opacity: anim }]}
    >
      <View style={[sk.accentBar, { backgroundColor: bg }]} />
      <View style={{ flex: 1 }}>
        <View style={sk.infoRow}>
          <View style={[sk.avatar, { backgroundColor: bg }]} />
          <View style={{ flex: 1, gap: 10 }}>
            <View style={{ height: 16, borderRadius: 8, backgroundColor: bg, width: '65%' }} />
            <View style={{ height: 12, borderRadius: 6, backgroundColor: bg, width: '45%' }} />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={{ height: 22, width: 56, borderRadius: 6, backgroundColor: bg }} />
              <View style={{ height: 22, width: 56, borderRadius: 6, backgroundColor: bg }} />
              <View style={{ height: 22, width: 72, borderRadius: 6, backgroundColor: bg }} />
            </View>
          </View>
        </View>
        <View style={{ height: 44, backgroundColor: bg, margin: 12, borderRadius: 12 }} />
      </View>
    </Animated.View>
  );
};
const sk = StyleSheet.create({
  card:     { flexDirection: 'row', borderRadius: 14, marginBottom: 10, overflow: 'hidden', elevation: 3, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 12, shadowColor: BRAND },
  accentBar:{ width: 4 },
  infoRow:  { flexDirection: 'row', padding: 16, gap: 14 },
  avatar:   { width: 70, height: 70, borderRadius: 35 },
});

// ─── Result Count Bar ─────────────────────────────────────────────────────────
const ResultBar = ({
  total,
  visible,
}: {
  total: number;
  visible: boolean;
}): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  if (!visible) return null;
  return (
    <View style={rb.bar}>
      <AppText style={[rb.left, { color: theme.colors.text }]}>
        {total.toLocaleString()} Professionals Found
      </AppText>
      <View style={rb.verifiedChip}>
        <AppText style={rb.verifiedTxt}>Verified ✓</AppText>
      </View>
    </View>
  );
};
const rb = StyleSheet.create({
  bar:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: WHITE, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  left:         { fontSize: 13, fontWeight: '800', color: NAVY },
  verifiedChip: { backgroundColor: GREEN_SOFT, borderRadius: 20, borderWidth: 1, borderColor: '#bbf7d0', paddingHorizontal: 10, paddingVertical: 4 },
  verifiedTxt:  { fontSize: 11, fontWeight: '700', color: GREEN },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
type Nav = NativeStackNavigationProp<MainStackParamList>;
interface FullUserProfile {
  isSubscribed?: boolean;
  subscriptionExpery?: string;
  remainingContacts?: number;
  employerType?: string;
}

export const WorkerSearchScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state: authState } = useAuth();
  const user = authState.session?.user;
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<MainStackParamList, 'WorkerSearch'>>();
  const qc = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const canGoBack = navigation.canGoBack();

  const initialCat = route.params?.workType ?? '';
  const userState  = user?.state ?? '';

  const [appliedFilters, setAppliedFilters] = useState<WorkerFilters>({
    ...EMPTY_FILTERS,
    workerType: initialCat,
    state: userState,
  });
  const [showFilters,      setShowFilters]      = useState(false);
  const [searchQuery,      setSearchQuery]      = useState('');

  const [unlockedPhones,  setUnlockedPhones]  = useState<Record<string, string>>({});
  const [loadingUnlock,   setLoadingUnlock]   = useState<Record<string, boolean>>({});
  const [callStatus,      setCallStatus]      = useState<Record<string, string>>({});
  const [savingRemark,    setSavingRemark]    = useState<Record<string, boolean>>({});
  const [isLimitExhausted, setIsLimitExhausted] = useState(false);

  // Profile + subscription
  const profileQuery = useQuery({
    queryKey: ['search-user-profile'],
    queryFn: async () => {
      const res = await apiClient.get<{ user?: FullUserProfile }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    staleTime: 60 * 1000,     // 1 min — subscription changes must reflect quickly
    refetchOnMount: true,
  });
  const profile = profileQuery.data;

  useFocusEffect(
    useCallback(() => {
      if (profileQuery.isStale) {
        void profileQuery.refetch();
      }
    }, [profileQuery]),
  );

  // Mirror the CRM: isSubscribed AND subscriptionExpery in the future
  const isSubscribed = (() => {
    if (!profile?.isSubscribed) return false;
    const exp = profile.subscriptionExpery;
    if (!exp) return true;
    return new Date(exp).getTime() > Date.now();
  })();

  const remainingContacts   = profile?.remainingContacts ?? 0;

  // Sync local exhausted state when profile loads (mirrors CRM's useState(user?.remainingContacts <= 0))
  useEffect(() => {
    if (profileQuery.isSuccess && isSubscribed && remainingContacts <= 0) {
      setIsLimitExhausted(true);
    }
  }, [profileQuery.isSuccess, isSubscribed, remainingContacts]);

  const isContactsExhausted = isLimitExhausted || (profileQuery.isSuccess && isSubscribed && remainingContacts <= 0);

  // Load call remarks
  useQuery({
    queryKey: ['worker-remarks'],
    queryFn: async () => {
      const remarks = await workerApi.getWorkerRemarks();
      const mapped: Record<string, string> = {};
      remarks.forEach((r) => { mapped[r.workerId] = r.status; });
      setCallStatus(mapped);
      return mapped;
    },
    enabled: isSubscribed,
    staleTime: 2 * 60 * 1000,
  });

  // Infinite list
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['workers-infinite', appliedFilters],
    queryFn: ({ pageParam = 1 }: { pageParam: number }) =>
      workerApi.getAllAgents({
        workerType:    (appliedFilters.subCategory || appliedFilters.workerType) || undefined,
        state:         appliedFilters.state         || undefined,
        district:      appliedFilters.district      || undefined,
        block:         appliedFilters.tehsil        || undefined,
        gender:        appliedFilters.gender        || undefined,
        workerGroup:   appliedFilters.workerGroup   || undefined,
        qualification: appliedFilters.qualification || undefined,
        minAge:        appliedFilters.ageMin ? Number(appliedFilters.ageMin) : undefined,
        maxAge:        appliedFilters.ageMax ? Number(appliedFilters.ageMax) : undefined,
        page:          pageParam,
        limit:         PAGE_LIMIT,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      // Use server-reported totalPages when available (respects work-type filter count)
      if (lastPage.pages > 0) {
        const next = allPages.length + 1;
        return next <= lastPage.pages ? next : undefined;
      }
      // Fallback: assume more if a full page was returned
      return lastPage.rawAgents.length >= PAGE_LIMIT ? allPages.length + 1 : undefined;
    },
    staleTime: 2 * 60 * 1000,
  });

  const allAgents: RawAgent[] = useMemo(
    () => data?.pages.flatMap((p) => p.rawAgents) ?? [],
    [data],
  );
  const totalCount        = data?.pages[0]?.total ?? 0;
  const activeFilterCount = countActive(appliedFilters);

  // Client-side search filter
  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allAgents;
    return allAgents.filter((a) => {
      const name  = (a.name ?? '').toLowerCase();
      const areas = (a.areasOfWork ?? []).join(' ').toLowerCase();
      const dist  = (a.district ?? '').toLowerCase();
      return name.includes(q) || areas.includes(q) || dist.includes(q);
    });
  }, [allAgents, searchQuery]);

  const handleApply = useCallback(
    (f: WorkerFilters): void => {
      if (!isSubscribed && countActive(f) > 0) {
        navigation.navigate('Subscription');
        return;
      }
      setAppliedFilters(f);
      setShowFilters(false);
    },
    [isSubscribed],
  );

  const handleViewContact = async (agentId: string): Promise<void> => {
    if (loadingUnlock[agentId] ?? unlockedPhones[agentId]) return;

    // Pre-check: expired or no subscription (mirrors CRM's isSubscriptionExpired guard)
    if (!isSubscribed) {
      navigation.navigate('Subscription');
      return;
    }

    try {
      setLoadingUnlock((p) => ({ ...p, [agentId]: true }));
      const res = await workerApi.unlockNumber(agentId);
      if (res.phone) setUnlockedPhones((p) => ({ ...p, [agentId]: res.phone }));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      if (msg === 'Contact limit exhausted') {
        // Mirror CRM: set local exhausted flag and redirect immediately
        setIsLimitExhausted(true);
        navigation.navigate('Subscription');
      } else {
        toast.error(msg ?? 'Failed to unlock contact. Please try again.', 'Unlock Failed');
      }
    } finally {
      setLoadingUnlock((p) => ({ ...p, [agentId]: false }));
    }
  };

  const handleSaveRemark = async (agentId: string, status: string): Promise<void> => {
    setCallStatus((p) => ({ ...p, [agentId]: status }));
    setSavingRemark((p) => ({ ...p, [agentId]: true }));
    try {
      await workerApi.saveWorkerRemark(agentId, status);
      void qc.invalidateQueries({ queryKey: ['worker-remarks'] });
      // Notify the worker about the call outcome update
      void apiClient.post('/api/v1/notifications/call-outcome', { workerId: agentId, outcome: status }).catch(() => {});
      toast.success('Call outcome saved.', 'Saved');
    } catch {
      toast.error('Failed to save call outcome. Please try again.', 'Save Failed');
    } finally {
      setSavingRemark((p) => ({ ...p, [agentId]: false }));
    }
  };

  // Active filter pills
  const activePills: Array<{ key: string; label: string; onRemove: () => void }> = [
    appliedFilters.workerType && {
      key: 'wt',
      label: appliedFilters.workerType,
      onRemove: () =>
        setAppliedFilters((p) => ({ ...p, workerType: '', subCategory: '' })),
    },
    appliedFilters.subCategory && {
      key: 'sc',
      label: appliedFilters.subCategory,
      onRemove: () => setAppliedFilters((p) => ({ ...p, subCategory: '' })),
    },
    appliedFilters.state && appliedFilters.state !== userState && {
      key: 'st',
      label: appliedFilters.state,
      onRemove: () =>
        setAppliedFilters((p) => ({
          ...p,
          state: userState,
          district: '',
          tehsil: '',
        })),
    },
    appliedFilters.district && {
      key: 'di',
      label: appliedFilters.district,
      onRemove: () => setAppliedFilters((p) => ({ ...p, district: '', tehsil: '' })),
    },
    appliedFilters.tehsil && {
      key: 'te',
      label: appliedFilters.tehsil,
      onRemove: () => setAppliedFilters((p) => ({ ...p, tehsil: '' })),
    },
    appliedFilters.gender && {
      key: 'ge',
      label: appliedFilters.gender,
      onRemove: () => setAppliedFilters((p) => ({ ...p, gender: '' })),
    },
    appliedFilters.workerGroup && {
      key: 'wg',
      label:
        appliedFilters.workerGroup === 'group' ? 'Group / Agent' : 'Individual',
      onRemove: () => setAppliedFilters((p) => ({ ...p, workerGroup: '' })),
    },
    appliedFilters.qualification && {
      key: 'ql',
      label: `🎓 ${appliedFilters.qualification}`,
      onRemove: () => setAppliedFilters((p) => ({ ...p, qualification: '' })),
    },
    (appliedFilters.ageMin || appliedFilters.ageMax) && {
      key: 'age',
      label: `Age ${appliedFilters.ageMin || '0'}–${appliedFilters.ageMax || '∞'}`,
      onRemove: () => setAppliedFilters((p) => ({ ...p, ageMin: '', ageMax: '' })),
    },
  ].filter(Boolean) as Array<{ key: string; label: string; onRemove: () => void }>;

  const headerPaddingTop = insets.top + 14;

  return (
    <View style={[sc.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ── Premium Header ──────────────────────────────────────────────── */}
      <View style={[sc.header, { paddingTop: headerPaddingTop }]}>
        {/* Row 1: back + title + filter */}
        <View style={sc.headerRow1}>
          {canGoBack && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={sc.backBtn}
              activeOpacity={0.7}
            >
              <AppText style={sc.backTxt}>←</AppText>
            </TouchableOpacity>
          )}

          <View style={sc.headerTitleBlock}>
            <AppText style={sc.headerTitle}>Workers & Agents</AppText>
            <AppText style={sc.headerSub} numberOfLines={1}>
              {isLoading
                ? 'Searching…'
                : appliedFilters.state
                  ? `Results in ${appliedFilters.state}`
                  : 'All India'}
            </AppText>
          </View>

          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            activeOpacity={0.85}
            style={[sc.filterBtn, activeFilterCount > 0 && sc.filterBtnActive]}
          >
            <AppText style={sc.filterIcon}>⊟</AppText>
            {activeFilterCount > 0 && (
              <View style={sc.filterBadge}>
                <AppText style={sc.filterBadgeTxt}>{activeFilterCount}</AppText>
              </View>
            )}
          </TouchableOpacity>
        </View>

     

        {/* Active filter pills (inside header, below search) */}
        {activePills.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={sc.pillsBar}
            contentContainerStyle={sc.pillsContent}
          >
            {activePills.map((pill) => (
              <TouchableOpacity
                key={pill.key}
                onPress={pill.onRemove}
                activeOpacity={0.75}
                style={sc.pill}
              >
                <AppText style={sc.pillTxt} numberOfLines={1}>
                  {pill.label}
                </AppText>
                <AppText style={sc.pillClose}>×</AppText>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() =>
                setAppliedFilters({ ...EMPTY_FILTERS, state: userState })
              }
              style={sc.pillClear}
            >
              <AppText style={sc.pillClearTxt}>Clear all</AppText>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {/* <ResultBar
        total={searchQuery.trim() ? filteredAgents.length : totalCount}
        visible={!isLoading && !isError && allAgents.length > 0}
      /> */}

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <ScrollView
          contentContainerStyle={sc.list}
          showsVerticalScrollIndicator={false}
        >
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </ScrollView>
      ) : isError ? (
        <View style={sc.stateBox}>
          <View style={sc.errorIconWrap}>
            <AppText style={{ fontSize: 28 }}>⚠</AppText>
          </View>
          <AppText style={[sc.stateTitle, { color: theme.colors.text }]}>Connection Error</AppText>
          <AppText style={sc.stateBody}>
            Unable to load professionals. Check your internet connection and try again.
          </AppText>
          <TouchableOpacity
            onPress={() => void refetch()}
            style={sc.primaryBtn}
          >
            <AppText style={sc.primaryBtnTxt}>Retry</AppText>
          </TouchableOpacity>
        </View>
      ) : filteredAgents.length === 0 ? (
        <View style={sc.stateBox}>
          <View style={sc.emptyIconWrap}>
            <AppText style={{ fontSize: 32 }}>👷</AppText>
          </View>
          <AppText style={[sc.stateTitle, { color: theme.colors.text }]}>
            No Workers Found
          </AppText>
          <AppText style={sc.stateBody}>
            {searchQuery.trim()
              ? `No results for "${searchQuery.trim()}". Try a different name or skill.`
              : activeFilterCount > 0
                ? 'No workers match the selected filters. Try broadening your search.'
                : 'No workers are available in this area right now.'}
          </AppText>
          {searchQuery.trim() ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={[sc.primaryBtn, sc.outlineBtn]}
            >
              <AppText style={[sc.primaryBtnTxt, { color: BRAND }]}>Clear Search</AppText>
            </TouchableOpacity>
          ) : activeFilterCount > 0 ? (
            <TouchableOpacity
              onPress={() =>
                setAppliedFilters({ ...EMPTY_FILTERS, state: userState })
              }
              style={[sc.primaryBtn, sc.outlineBtn]}
            >
              <AppText style={[sc.primaryBtnTxt, { color: BRAND }]}>Clear Filters</AppText>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={filteredAgents}
          keyExtractor={(item) => item._id}
          style={sc.flex1}
          contentContainerStyle={sc.list}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={10}
          removeClippedSubviews={Platform.OS === 'android'}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          onEndReachedThreshold={0.6}
          renderItem={({ item }) => (
            <AgentCard
              agent={item}
              isSubscribed={isSubscribed}
              isContactsExhausted={isContactsExhausted}
              unlockedPhone={unlockedPhones[item._id]}
              loadingUnlock={loadingUnlock[item._id] ?? false}
              callStatus={callStatus[item._id] ?? ''}
              savingRemark={savingRemark[item._id] ?? false}
              workerTypeApplied={appliedFilters.workerType}
              appliedDistrict={appliedFilters.district}
              onViewContact={() => void handleViewContact(item._id)}
              onSubscribe={() => navigation.navigate('Subscription')}
              onTopup={() => navigation.navigate('Subscription')}
              onSaveRemark={(id, status) => void handleSaveRemark(id, status)}
              onPress={() =>
                navigation.navigate('WorkerProfile', { workerId: item._id })
              }
            />
          )}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={sc.loadMore}>
                <ActivityIndicator size="small" color={BRAND} />
                <AppText style={sc.loadMoreTxt}>Loading more…</AppText>
              </View>
            ) : null
          }
        />
      )}

      {/* ── Filter Sheet ─────────────────────────────────────────────────── */}
      <FilterSheet
        visible={showFilters}
        initial={appliedFilters}
        onApply={handleApply}
        onClose={() => setShowFilters(false)}
        userState={userState}
      />

    </View>
  );
};

// ─── Screen styles ────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  container: { flex: 1 },
  flex1:     { flex: 1 },

  // Header
  header:          { backgroundColor: BRAND, paddingHorizontal: 16, paddingBottom: 12 },
  headerRow1:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  backBtn:         { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  backTxt:         { color: WHITE, fontSize: 20, fontWeight: '600', lineHeight: 24 },
  headerTitleBlock:{ flex: 1 },
  headerTitle:     { fontSize: 18, fontWeight: '800', color: WHITE, marginBottom: 2 },
  headerSub:       { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  filterBtn:       { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: BRAND_DARK, borderColor: BRAND_DARK },
  filterIcon:      { fontSize: 18, color: WHITE },
  filterBadge:     { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: AMBER, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterBadgeTxt:  { fontSize: 9, fontWeight: '900', color: WHITE },

  // Search bar
  searchBarWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 10 },
  searchIcon:      { fontSize: 18, color: 'rgba(255,255,255,0.7)', marginRight: 8 },
  searchInput:     { flex: 1, fontSize: 14, color: WHITE, fontWeight: '500', paddingVertical: 0 },
  searchClear:     { paddingLeft: 8 },
  searchClearTxt:  { fontSize: 22, color: 'rgba(255,255,255,0.7)', lineHeight: 26 },

  // Filter pills (inside header)
  pillsBar:        { flexGrow: 0, marginBottom: 2 },
  pillsContent:    { gap: 7, flexDirection: 'row' },
  pill:            { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 5 },
  pillTxt:         { fontSize: 12, fontWeight: '600', color: WHITE, maxWidth: 110 },
  pillClose:       { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.7)', lineHeight: 18 },
  pillClear:       { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,100,100,0.5)', backgroundColor: 'rgba(220,38,38,0.15)', paddingHorizontal: 10, paddingVertical: 5 },
  pillClearTxt:    { fontSize: 12, fontWeight: '700', color: '#fca5a5' },

  // List
  list:            { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 32 },

  // Loading more
  loadMore:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 20 },
  loadMoreTxt:     { fontSize: 13, color: SLATE },

  // Empty / error states
  stateBox:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  errorIconWrap:   { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fee2e2', borderWidth: 2, borderColor: '#fca5a5', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyIconWrap:   { width: 80, height: 80, borderRadius: 40, backgroundColor: BRAND_SOFT, borderWidth: 2, borderColor: '#c7d2fe', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stateTitle:      { fontSize: 19, fontWeight: '800', textAlign: 'center' },
  stateBody:       { fontSize: 13, textAlign: 'center', lineHeight: 20, color: SLATE, maxWidth: 280 },
  primaryBtn:      { marginTop: 4, backgroundColor: NAVY, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 13 },
  outlineBtn:      { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: BRAND },
  primaryBtnTxt:   { color: WHITE, fontWeight: '800', fontSize: 14 },
});
