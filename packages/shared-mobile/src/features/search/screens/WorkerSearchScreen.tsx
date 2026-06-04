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
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useAppTheme } from '../../../core/theme';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import type { RawAgent } from '../../../core/api/endpoints/workerApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { apiClient } from '../../../core/api/client';
import { usePlanFeatures } from '../../../core/hooks/usePlanFeatures';
import { useToast } from '../../../shared/state/toast/ToastContext';
import type { MainStackParamList } from '../../../app/navigation/types';
import WORKER_CATEGORIES from '../../../shared/data/categories.json';
import { indianStates } from '../../../shared/data/stateDistrict';
import { buildPhotoUrl } from '../../../core/config/env';
import i18n from '../../../core/i18n';
import { getLocationStr, getSubCatLabel } from '../../../shared/utils/labelUtils';
import { getLocationDisplayName } from '../../../shared/data/locationTranslations';

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
type SubEntry = { label: string; value: string; [field: string]: string };
interface CatEntry {
  label: string;
  value: string;
  subcategories?: SubEntry[];
}
const CATEGORIES = WORKER_CATEGORIES as CatEntry[];

// Top-level category names have full 11-language translations under the `cat_*`
// keys (default `translation` namespace, shared with the agent app). categories.json
// ships per-language label fields (label/hindilabel/marathilabel/gujaratilabel and
// now tamillabel/telugulabel/kannadalabel/malayalamlabel/banglalabel/odialabel/
// punjabilabel) for all 13 categories AND all 269 subcategories. We translate the 13
// category NAMES via the `cat_*` keys, and the subcategories via `subcatDisplay`
// (below) reading those JSON fields — keeping the English label as the stored filter
// value (the API + worker areasOfWork still match on the English label).
const CAT_KEY_BY_VALUE: Record<string, string> = {
  construction_project_workers: 'cat_construction',
  manufacturing_industrial_workers: 'cat_manufacturing',
  agriculture_farming_workers: 'cat_agriculture',
  event_decoration_workers: 'cat_event',
  household_domestic_workers: 'cat_household',
  hospitality_service_workers: 'cat_hospitality',
  transport_logistics_workers: 'cat_transport',
  retail_shop_workers: 'cat_retail',
  skilled_technical_workers: 'cat_technical',
  specialized_creative_workers: 'cat_creative',
  'Automobile & Workshop Workers': 'cat_automobile',
  'Healthcare Support Workers': 'cat_healthcare',
  'Security & Facility Workers': 'cat_security',
};
const CAT_KEY_BY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES
    .map((c) => [c.label, CAT_KEY_BY_VALUE[c.value]] as const)
    .filter((pair): pair is readonly [string, string] => Boolean(pair[1])),
);

/** Translate a top-level category's English label to the active language via the
 *  shared `cat_*` keys (default `translation` namespace). Falls back to the
 *  English label when unmapped. Reactive: components that subscribe via
 *  useTranslation re-render on language change and re-evaluate this. */
const catDisplay = (label: string): string => {
  const key = CAT_KEY_BY_LABEL[label];
  return key ? i18n.t(key) : label;
};

/** Normalized (lowercase, separators→space) form of a top-level CATEGORY value or
 *  label → its `cat_*` key. Lets us translate a worker's areasOfWork / a chip when
 *  it holds a whole category name (e.g. "construction project workers" or the
 *  underscored "construction_project_workers" / "Construction & Project Workers"). */
const CAT_KEY_BY_NORM: Record<string, string> = (() => {
  // Inline normalizer (normalizeText is declared later → avoid TDZ at module load).
  const norm = (s: string): string => String(s || '').trim().toLowerCase().replace(/[_&/-]+/g, ' ').replace(/\s+/g, ' ');
  const m: Record<string, string> = {};
  for (const [val, key] of Object.entries(CAT_KEY_BY_VALUE)) m[norm(val)] = key;
  CATEGORIES.forEach((c) => {
    const key = CAT_KEY_BY_VALUE[c.value];
    if (key) m[norm(c.label)] = key;
  });
  return m;
})();

/** Translate an occupational label (subcategory OR top-level category) to the
 *  active language. Display-only — the stored filter value and worker areasOfWork
 *  keep the English label. Order: (1) top-level category → shared `cat_*` key
 *  (all 11 langs), else (2) shared `getSubCatLabel` which indexes by value AND
 *  label with fuzzy matching and returns the per-language categories.json field.
 *  Falls back to readable English. Reactive via useTranslation. */
const subcatDisplay = (label: string): string => {
  if (!label) return label;
  const norm = String(label).trim().toLowerCase().replace(/[_&/-]+/g, ' ').replace(/\s+/g, ' ');
  const catKey = CAT_KEY_BY_NORM[norm];
  if (catKey) return i18n.t(catKey);
  return getSubCatLabel(label, (i18n.language || 'en').split('-')[0]);
};

/** Worker-card meta values (gender, qualification/sub-type, agent-type) are stored
 *  as fixed English enums on the backend. Translate the DISPLAY via employer-ns
 *  keys while the stored value (used for filtering/API) stays English. Unmapped
 *  values fall back to raw. */
const META_KEY_BY_VALUE: Record<string, string> = {
  Male: 'ws_male', Female: 'ws_female', Other: 'ws_other',
  'ITI/Diploma': 'ws_iti_diploma', Graduate: 'ws_graduate',
  Skilled: 'ws_skilled', 'Semi-Skilled': 'ws_semiSkilled', 'Semi Skilled': 'ws_semiSkilled', Unskilled: 'ws_unskilled',
  'Group worker supplier':     'ws_agentType_group',
  'Skilled worker supplier':   'ws_agentType_skilled',
  'Unskilled worker supplier': 'ws_agentType_unskilled',
  'Contract worker supplier':  'ws_agentType_contract',
};
const metaDisplay = (val?: string | null): string => {
  if (!val) return '';
  const key = META_KEY_BY_VALUE[val];
  return key ? i18n.t(`employer:${key}`) : val;
};

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
  { value: 'not_picked',            labelKey: 'ws_outcome_not_picked' },
  { value: 'switched_off',          labelKey: 'ws_outcome_switched_off' },
  { value: 'busy',                  labelKey: 'ws_outcome_busy' },
  { value: 'wrong_number',          labelKey: 'ws_outcome_wrong_number' },
  { value: 'invalid_number',        labelKey: 'ws_outcome_invalid_number' },
  { value: 'call_later',            labelKey: 'ws_outcome_call_later' },
  { value: 'follow_up_required',    labelKey: 'ws_outcome_follow_up_required' },
  { value: 'follow_up_done',        labelKey: 'ws_outcome_follow_up_done' },
  { value: 'available_immediately', labelKey: 'ws_outcome_available_immediately' },
  { value: 'available_next_week',   labelKey: 'ws_outcome_available_next_week' },
  { value: 'available_next_month',  labelKey: 'ws_outcome_available_next_month' },
  { value: 'currently_working',     labelKey: 'ws_outcome_currently_working' },
  { value: 'interested',            labelKey: 'ws_outcome_interested' },
  { value: 'highly_interested',     labelKey: 'ws_outcome_highly_interested' },
  { value: 'not_interested',        labelKey: 'ws_outcome_not_interested' },
  { value: 'maybe_interested',      labelKey: 'ws_outcome_maybe_interested' },
  { value: 'relevant',              labelKey: 'ws_outcome_relevant' },
  { value: 'not_relevant',          labelKey: 'ws_outcome_not_relevant' },
  { value: 'job_confirmed',         labelKey: 'ws_outcome_job_confirmed' },
  { value: 'joined_work',           labelKey: 'ws_outcome_joined_work' },
];

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const normalizeText = (text = ''): string =>
  String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ');

const timeAgoDate = (date: Date, t: TFunc): string => {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('ws_time_just_now');
  if (mins < 60) return t('ws_time_minutes_ago', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('ws_time_hours_ago', { count: hrs });
  if (Math.floor(hrs / 24) === 1) return t('ws_time_yesterday');
  return t('ws_time_days_ago', { count: Math.floor(hrs / 24) });
};

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

// All Indian place names (state / district / block) for filtering location values
// that were mis-entered into a worker's areasOfWork (so they don't show as skills).
const PLACE_NAMES: Set<string> = (() => {
  const set = new Set<string>();
  for (const [state, districts] of Object.entries(indianStates)) {
    set.add(state.toLowerCase());
    for (const [district, blocks] of Object.entries(districts as Record<string, string[]>)) {
      set.add(district.toLowerCase());
      (blocks ?? []).forEach((b) => set.add(String(b).toLowerCase()));
    }
  }
  return set;
})();

const isPlaceName = (v: string): boolean => {
  const lc = v.trim().toLowerCase();
  return PLACE_NAMES.has(lc) || PLACE_NAMES.has(lc.replace(/\s+(city|district|tehsil|block)$/, ''));
};

/** De-duplicate skill chips (case-insensitive) and drop location names that were
 *  mistakenly saved as skills — keeps the worker card showing real work types. */
const cleanSkills = (areas: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of areas) {
    const v = String(a).trim();
    if (!v) continue;
    const lc = v.toLowerCase();
    if (seen.has(lc) || isPlaceName(v)) continue;
    seen.add(lc);
    out.push(v);
  }
  return out;
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
  labelFor,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  onClose: () => void;
  allLabel?: string;
  /** Optional display translator — maps an option's stored value → shown text.
   *  Selection still operates on the original `options` value. */
  labelFor?: (value: string) => string;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const display = (o: string): string => (labelFor ? labelFor(o) : o);
  const shown = options.filter((o) => display(o).toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[pm.root, { backgroundColor: theme.colors.background }]}>
        <View style={[pm.header, { borderBottomColor: theme.colors.border, paddingTop: insets.top + 14 }]}>
          <View>
            <AppText style={[pm.title, { color: theme.colors.text }]}>{title}</AppText>
            <AppText style={[pm.sub, { color: theme.colors.mutedText }]}>
              {t('ws_options_available', { count: options.length })}
            </AppText>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[pm.closeBtn, { backgroundColor: theme.colors.surface1 }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <AppText style={[pm.closeTxt, { color: theme.colors.mutedText }]}>✕</AppText>
          </TouchableOpacity>
        </View>
        {options.length > 6 && (
          <View
            style={[
              pm.searchWrap,
              { backgroundColor: theme.colors.card, borderColor: C.border },
            ]}
          >
            <AppText style={[pm.searchIcon, { color: theme.colors.mutedText }]}>⌕</AppText>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t('ws_search_placeholder')}
              placeholderTextColor={C.slate}
              style={[pm.searchInput, { color: theme.colors.text }]}
            />
            {q.length > 0 && (
              <TouchableOpacity onPress={() => setQ('')} style={{ paddingRight: 14 }}>
                <AppText style={{ color: theme.colors.mutedText, fontSize: 14 }}>✕</AppText>
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
                  {item === allLabel ? item : display(item)}
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
  title:      { fontSize: 17, fontWeight: '800' },
  sub:        { fontSize: 12, marginTop: 1 },
  closeBtn:   { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  closeTxt:   { fontSize: 13, fontWeight: '700' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, marginHorizontal: 16, marginVertical: 12 },
  searchIcon: { fontSize: 18, paddingHorizontal: 12 },
  searchInput:{ flex: 1, paddingVertical: 12, fontSize: 15 },
  item:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  itemText:   { flex: 1, fontSize: 15, marginRight: 12 },
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
      <AppText style={[df.label, { color: theme.colors.mutedText }]}>{label}</AppText>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.75}
        style={[
          df.field,
          {
            borderColor: active ? BRAND : theme.colors.border,
            backgroundColor: active ? theme.colors.primaryLight : theme.colors.card,
            opacity: disabled ? 0.45 : 1,
          },
        ]}
      >
        <AppText
          style={[df.text, { color: active ? BRAND : theme.colors.mutedText }]}
          numberOfLines={1}
        >
          {value || placeholder}
        </AppText>
        <AppText style={[df.chevron, { color: active ? BRAND : theme.colors.mutedText }]}>›</AppText>
      </TouchableOpacity>
    </View>
  );
};
const df = StyleSheet.create({
  label:   { fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
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
  userDistrict,
  lockState = false,
  lockDistrict = false,
}: {
  visible: boolean;
  initial: WorkerFilters;
  userState: string;
  userDistrict?: string;
  /** Plan locks the state to the user's own (district/state scope). */
  lockState?: boolean;
  /** Plan locks the district to the user's own (district scope only). */
  lockDistrict?: boolean;
  onApply: (f: WorkerFilters) => void;
  onClose: () => void;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
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

  // Locked location is a plan constraint, not a user-chosen filter — exclude it
  // from the "active filters" count so Reset visibly clears to zero.
  const activeCount =
    countActive(f)
    - (lockState && f.state ? 1 : 0)
    - (lockDistrict && f.district ? 1 : 0);

  const handleReset = (): void =>
    setF({ ...EMPTY_FILTERS, state: lockState ? userState : '', district: lockDistrict ? (userDistrict ?? '') : '' });

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
            <AppText style={[fsh.headerTitle, { color: theme.colors.text }]}>{t('ws_filter_title')}</AppText>
            <AppText style={[fsh.headerSub, { color: theme.colors.mutedText }]}>
              {activeCount > 0
                ? t('ws_filters_active', { count: activeCount })
                : t('ws_filter_subtitle')}
            </AppText>
          </View>
          <View style={fsh.headerActions}>
            {activeCount > 0 && (
              <TouchableOpacity
                onPress={handleReset}
                style={fsh.resetBtn}
              >
                <AppText style={fsh.resetTxt}>{t('ws_reset')}</AppText>
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
          <View style={[fsh.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
            <View style={fsh.cardHeader}>
              <View style={[fsh.cardIcon, { backgroundColor: theme.colors.primaryLight }]}>
                <AppText style={{ fontSize: 14 }}>📍</AppText>
              </View>
              <AppText style={[fsh.cardTitle, { color: theme.colors.text }]}>{t('ws_location')}</AppText>
            </View>
            {(lockState || lockDistrict) && (
              <AppText style={[fsh.lockHint, { color: theme.colors.mutedText }]}>
                🔒 {t('ws_scope_locked')}
              </AppText>
            )}
            <DropField
              label={t('ws_state')}
              value={f.state ? getLocationDisplayName(f.state, 'state', i18n.language) : ''}
              placeholder={t('ws_all_states')}
              onPress={() => setPicker('state')}
              disabled={lockState}
            />
            <DropField
              label={t('ws_district')}
              value={f.district ? getLocationDisplayName(f.district, 'district', i18n.language) : ''}
              placeholder={f.state ? t('ws_select_district') : t('ws_select_state_first')}
              onPress={() => f.state && setPicker('district')}
              disabled={!f.state || lockDistrict}
            />
            {(districtList.length > 0 || f.tehsil) && (
              <DropField
                label={t('ws_tehsil_block')}
                value={f.tehsil ? getLocationDisplayName(f.tehsil, 'block', i18n.language) : ''}
                placeholder={f.district ? t('ws_select_tehsil') : t('ws_select_district_first')}
                onPress={() => f.district && setPicker('tehsil')}
                disabled={!f.district}
              />
            )}
          </View>

          {/* ── Work Type ─────────────────────────────────────────────── */}
          <View style={[fsh.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
            <View style={fsh.cardHeader}>
              <View style={[fsh.cardIcon, { backgroundColor: theme.colors.secondaryLight }]}>
                <AppText style={{ fontSize: 14 }}>💼</AppText>
              </View>
              <AppText style={[fsh.cardTitle, { color: theme.colors.text }]}>{t('ws_work_type')}</AppText>
            </View>
            <DropField
              label={t('ws_category')}
              value={f.workerType ? catDisplay(f.workerType) : ''}
              placeholder={t('ws_all_categories')}
              onPress={() => setPicker('cat')}
            />
            {f.workerType && subCatLabels.length > 0 && (
              <DropField
                label={t('ws_sub_category')}
                value={f.subCategory ? subcatDisplay(f.subCategory) : ''}
                placeholder={t('ws_all_sub_categories')}
                onPress={() => setPicker('subcat')}
              />
            )}
          </View>

          {/* ── Professional Type ─────────────────────────────────────── */}
          <View style={[fsh.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
            <View style={fsh.cardHeader}>
              <View style={[fsh.cardIcon, { backgroundColor: GREEN_SOFT }]}>
                <AppText style={{ fontSize: 14 }}>🧑‍💼</AppText>
              </View>
              <AppText style={[fsh.cardTitle, { color: theme.colors.text }]}>{t('ws_professional_type')}</AppText>
            </View>
            <View style={fsh.typeGrid}>
              {[
                { label: t('ws_individual_worker'), sub: t('ws_single_professional'), val: 'individual', icon: '👤' },
                { label: t('ws_agent_group'),       sub: t('ws_team_or_agency'),      val: 'group',      icon: '👥' },
              ].map((opt) => {
                const active = f.workerGroup === opt.val;
                return (
                  <TouchableOpacity
                    key={opt.val}
                    onPress={() => set('workerGroup', active ? '' : opt.val)}
                    activeOpacity={0.8}
                    style={[fsh.typeCard, {
                      backgroundColor: active ? '#0F1626' : theme.colors.surface1,
                      borderColor: active ? '#0F1626' : theme.colors.border,
                    }]}
                  >
                    <AppText style={fsh.typeIcon}>{opt.icon}</AppText>
                    <AppText style={[fsh.typeLabel, { color: active ? WHITE : theme.colors.text }]} numberOfLines={1}>{opt.label}</AppText>
                    <AppText style={[fsh.typeSub, { color: active ? 'rgba(255,255,255,0.65)' : theme.colors.mutedText }]} numberOfLines={1}>{opt.sub}</AppText>
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
          <View style={[fsh.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
            <View style={fsh.cardHeader}>
              <View style={[fsh.cardIcon, { backgroundColor: theme.colors.warningLight }]}>
                <AppText style={{ fontSize: 14 }}>🎯</AppText>
              </View>
              <AppText style={[fsh.cardTitle, { color: theme.colors.text }]}>{t('ws_demographics')}</AppText>
            </View>

            {/* Gender */}
            <AppText style={[fsh.fieldLabel, { color: theme.colors.mutedText }]}>{t('ws_gender')}</AppText>
            <View style={[fsh.chipRow, { marginBottom: 18 }]}>
              {[
                { value: 'Male',   label: t('ws_male'),   icon: '♂' },
                { value: 'Female', label: t('ws_female'), icon: '♀' },
                { value: 'Other',  label: t('ws_other'),  icon: '⚧' },
              ].map((g) => {
                const active = f.gender === g.value;
                return (
                  <TouchableOpacity
                    key={g.value}
                    onPress={() => set('gender', active ? '' : g.value)}
                    activeOpacity={0.8}
                    style={[fsh.genderChip, {
                      backgroundColor: active ? BRAND : theme.colors.background,
                      borderColor: active ? BRAND : BORDER,
                    }]}
                  >
                    <AppText style={[fsh.genderIcon, { color: active ? WHITE : theme.colors.text }]}>{g.icon}</AppText>
                    <AppText style={[fsh.genderChipTxt, { color: active ? WHITE : theme.colors.text }]}>{g.label}</AppText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Age Range */}
            <AppText style={[fsh.fieldLabel, { color: theme.colors.mutedText }]}>{t('ws_age_range')}</AppText>
            <View style={fsh.ageGrid}>
              <View style={{ flex: 1 }}>
                <AppText style={[fsh.ageColLabel, { color: theme.colors.mutedText }]}>{t('ws_from')}</AppText>
                <View style={[fsh.ageBox, {
                  borderColor: f.ageMin ? BRAND : theme.colors.border,
                  backgroundColor: f.ageMin ? theme.colors.primaryLight : theme.colors.surface1,
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
                  <View style={[fsh.ageSuffixBox, { borderLeftColor: f.ageMin ? BRAND + '30' : theme.colors.border }]}>
                    <AppText style={[fsh.ageSuffixTxt, { color: f.ageMin ? BRAND : theme.colors.mutedText }]}>{t('ws_yrs')}</AppText>
                  </View>
                </View>
              </View>
              <View style={fsh.ageSep}>
                <AppText style={{ color: theme.colors.mutedText, fontWeight: '700', fontSize: 18 }}>–</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={[fsh.ageColLabel, { color: theme.colors.mutedText }]}>{t('ws_to')}</AppText>
                <View style={[fsh.ageBox, {
                  borderColor: f.ageMax ? BRAND : theme.colors.border,
                  backgroundColor: f.ageMax ? theme.colors.primaryLight : theme.colors.surface1,
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
                  <View style={[fsh.ageSuffixBox, { borderLeftColor: f.ageMax ? BRAND + '30' : theme.colors.border }]}>
                    <AppText style={[fsh.ageSuffixTxt, { color: f.ageMax ? BRAND : theme.colors.mutedText }]}>{t('ws_yrs')}</AppText>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ── Qualification ─────────────────────────────────────────────── */}
          <View style={[fsh.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
            <View style={fsh.cardHeader}>
              <View style={[fsh.cardIcon, { backgroundColor: theme.colors.warningLight }]}>
                <AppText style={{ fontSize: 14 }}>🎓</AppText>
              </View>
              <AppText style={[fsh.cardTitle, { color: theme.colors.text }]}>{t('ws_qualification')}</AppText>
            </View>
            <View style={fsh.typeGrid}>
              {[
                { label: t('ws_iti_diploma'), sub: t('ws_certificate_holders'), val: 'ITI/Diploma', icon: '🎓' },
                { label: t('ws_graduate'),    sub: t('ws_bachelors_above'),     val: 'Graduate',    icon: '📜' },
              ].map((opt) => {
                const active = f.qualification === opt.val;
                return (
                  <TouchableOpacity
                    key={opt.val}
                    onPress={() => set('qualification', active ? '' : opt.val)}
                    activeOpacity={0.8}
                    style={[fsh.typeCard, {
                      backgroundColor: active ? '#F97316' : theme.colors.surface1,
                      borderColor: active ? '#F97316' : theme.colors.border,
                    }]}
                  >
                    <AppText style={fsh.typeIcon}>{opt.icon}</AppText>
                    <AppText style={[fsh.typeLabel, { color: active ? WHITE : theme.colors.text }]} numberOfLines={1}>{opt.label}</AppText>
                    <AppText style={[fsh.typeSub, { color: active ? 'rgba(255,255,255,0.65)' : theme.colors.mutedText }]} numberOfLines={1}>{opt.sub}</AppText>
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
          <TouchableOpacity onPress={onClose} style={[fsh.cancelBtn, { borderColor: theme.colors.border }]} activeOpacity={0.8}>
            <AppText style={[fsh.cancelTxt, { color: theme.colors.text }]}>{t('ws_cancel')}</AppText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onApply(f)} style={fsh.applyBtn} activeOpacity={0.88}>
            <AppText style={fsh.applyTxt}>
              {activeCount > 0 ? t('ws_apply_count', { count: activeCount }) : t('ws_apply_filters')}
            </AppText>
          </TouchableOpacity>
        </View>

        <PickerModal
          visible={picker === 'cat'}
          title={t('ws_work_category')}
          options={catLabels}
          selected={f.workerType}
          onSelect={(v) => set('workerType', v)}
          onClose={() => setPicker(null)}
          allLabel={t('ws_all_categories_opt')}
          labelFor={catDisplay}
        />
        <PickerModal
          visible={picker === 'subcat'}
          title={t('ws_sub_category')}
          options={subCatLabels}
          selected={f.subCategory}
          onSelect={(v) => set('subCategory', v)}
          onClose={() => setPicker(null)}
          allLabel={t('ws_all_sub_categories_opt')}
          labelFor={subcatDisplay}
        />
        <PickerModal
          visible={picker === 'state'}
          title={t('ws_state')}
          options={stateList}
          selected={f.state}
          onSelect={(v) => set('state', v)}
          onClose={() => setPicker(null)}
          allLabel={t('ws_all_states_opt')}
          labelFor={(name) => getLocationDisplayName(name, 'state', i18n.language)}
        />
        <PickerModal
          visible={picker === 'district'}
          title={t('ws_district_city')}
          options={districtList}
          selected={f.district}
          onSelect={(v) => set('district', v)}
          onClose={() => setPicker(null)}
          allLabel={t('ws_all_districts_opt')}
          labelFor={(name) => getLocationDisplayName(name, 'district', i18n.language)}
        />
        <PickerModal
          visible={picker === 'tehsil'}
          title={t('ws_tehsil_block')}
          options={tehsilList}
          selected={f.tehsil}
          onSelect={(v) => set('tehsil', v)}
          onClose={() => setPicker(null)}
          allLabel={t('ws_all_blocks_opt')}
          labelFor={(name) => getLocationDisplayName(name, 'block', i18n.language)}
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
  headerTitle:   { fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  headerSub:     { fontSize: 12, marginTop: 3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  resetBtn:      { borderWidth: 1.5, borderColor: BRAND, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  resetTxt:      { fontSize: 12, fontWeight: '800', color: BRAND },
  closeBtn:      { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  closeTxt:      { fontSize: 13, fontWeight: '700' },

  // Body / cards
  body:          { padding: 14, gap: 10, paddingBottom: 28 },
  card:          { borderRadius: 16, borderWidth: 1, padding: 16 },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardIcon:      { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle:     { fontSize: 14, fontWeight: '800', letterSpacing: 0.1 },
  lockHint:      { fontSize: 11, fontWeight: '600', lineHeight: 15, marginTop: -8, marginBottom: 12 },

  // Professional Type grid
  typeGrid:      { flexDirection: 'row', gap: 8 },
  typeCard:      { flex: 1, borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 4, position: 'relative' },
  typeIcon:      { fontSize: 22, marginBottom: 4 },
  typeLabel:     { fontSize: 13, fontWeight: '800' },
  typeSub:       { fontSize: 11 },
  typeCheck:     { position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: 9, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },

  // Demographics
  fieldLabel:    { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  chipRow:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  genderChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  genderIcon:    { fontSize: 14, fontWeight: '700' },
  genderChipTxt: { fontSize: 13, fontWeight: '700' },

  // Age Range
  ageGrid:       { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  ageColLabel:   { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  ageBox:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, overflow: 'hidden' },
  ageBoxInput:   { flex: 1, fontSize: 16, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 13, minWidth: 0 },
  ageSuffixBox:  { borderLeftWidth: 1, paddingHorizontal: 10, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  ageSuffixTxt:  { fontSize: 11, fontWeight: '800' },
  ageSep:        { paddingBottom: 14, alignItems: 'center' },

  // Footer
  footer:        { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  cancelBtn:     { flex: 1, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingVertical: 15 },
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
  remarkTime,
}: {
  agentId: string;
  current: string;
  onSave: (id: string, val: string) => void;
  saving: boolean;
  remarkTime?: Date;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  const outcome = CALL_OUTCOMES.find((o) => o.value === current);
  const label = outcome ? t(outcome.labelKey) : undefined;
  const hasOutcome = !!current;

  return (
    <>
      <TouchableOpacity
        onPress={() => setShow(true)}
        disabled={saving}
        activeOpacity={0.8}
        style={[co.btn, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.card }]}
      >
        <View style={[co.dot, { backgroundColor: hasOutcome ? BRAND : theme.colors.mutedText }]} />
        <AppText style={[co.btnText, { color: hasOutcome ? theme.colors.text : theme.colors.mutedText }]} numberOfLines={1}>
          {saving ? t('ws_saving') : (label ?? t('ws_log_call_outcome'))}
        </AppText>
        {remarkTime && (
          <AppText style={[co.remarkTime, { color: theme.colors.mutedText }]}>{timeAgoDate(remarkTime, t)}</AppText>
        )}
        <AppText style={[co.chevron, { color: theme.colors.mutedText }]}>›</AppText>
      </TouchableOpacity>

      <Modal
        visible={show}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShow(false)}
      >
        <View style={[co.sheet, { backgroundColor: theme.colors.background }]}>
          <View style={[co.sheetHeader, { borderBottomColor: theme.colors.border, paddingTop: insets.top + 14 }]}>
            <View>
              <AppText style={[co.sheetTitle, { color: theme.colors.text }]}>{t('ws_call_outcome')}</AppText>
              <AppText style={[co.sheetSub, { color: theme.colors.mutedText }]}>
                {t('ws_call_outcome_sub')}
              </AppText>
            </View>
            <TouchableOpacity onPress={() => setShow(false)} style={[co.closeBtn, { backgroundColor: theme.colors.surface1 }]}>
              <AppText style={[co.closeTxt, { color: theme.colors.mutedText }]}>✕</AppText>
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
                      borderBottomColor: theme.colors.border,
                      backgroundColor: active ? theme.colors.primaryLight : 'transparent',
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
                    {t(item.labelKey)}
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
  btn:         { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  dot:         { width: 7, height: 7, borderRadius: 3.5 },
  btnText:     { flex: 1, fontSize: 13, fontWeight: '500' },
  remarkTime:  { fontSize: 12 },
  chevron:     { fontSize: 18, fontWeight: '300' },
  sheet:       { flex: 1 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  sheetTitle:  { fontSize: 17, fontWeight: '800' },
  sheetSub:    { fontSize: 12, marginTop: 2 },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  closeTxt:    { fontSize: 13, fontWeight: '700' },
  item:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  itemText:    { flex: 1, fontSize: 15, marginRight: 12 },
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
  remarkTime?: Date;
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
  remarkTime,
  workerTypeApplied,
  appliedDistrict,
  onViewContact,
  onSubscribe,
  onTopup,
  onSaveRemark,
  onPress,
}: AgentCardProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const photoUrl  = buildPhotoUrl(agent.profilePhoto);
  const initials  = formatName(agent.name ?? '?')
    .split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  const isAgent      = String(agent.role ?? '').toLowerCase() === 'agent';
  const matchedAreas = cleanSkills(getMatchedAreasOfWork(agent.areasOfWork ?? [], workerTypeApplied));
  const age          = getAge(agent.dob);
  const exp          = agent.workExperience !== undefined
    ? Number(agent.workExperience) > 0 ? Number(agent.workExperience) : 3
    : undefined;
  const accentColor  = isAgent ? theme.colors.secondary : theme.colors.primary;
  const accentBg     = isAgent ? theme.colors.secondaryLight : theme.colors.primaryLight;
  const locationStr  = getLocationStr(
    { district: appliedDistrict || agent.district, state: agent.state },
    i18n.language, '',
  );
  const wage    = agent.fixedSalary ?? agent.salaryFrom;
  const wageText = wage
    ? t('ws_wage_per_day', {
        amount: `₹${wage}${agent.salaryTo && agent.salaryTo !== wage ? `–${agent.salaryTo}` : ''}`,
      })
    : null;

  return (
    <View style={[wc.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>

      {/* ── Main info row (tappable) ── */}
      <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={wc.infoRow}>
        {/* Avatar */}
        <View style={wc.avatarWrap}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={[wc.avatar, { borderColor: accentColor }]} />
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
          <View style={wc.nameRow}>
            <AppText style={[wc.name, { color: theme.colors.text }]} numberOfLines={1}>
              {agent.name ? formatName(agent.name) : t('ws_unknown')}
            </AppText>
          </View>

          {!!locationStr && (
            <AppText style={[wc.location, { color: theme.colors.mutedText }]} numberOfLines={1}>📍 {locationStr}</AppText>
          )}

          <View style={wc.metaRow}>
            {!!age && <View style={[wc.metaChip, { backgroundColor: theme.colors.surface1 }]}><AppText numberOfLines={1} style={[wc.metaChipTxt, { color: theme.colors.mutedText }]}>{t('ws_meta_age', { age })}</AppText></View>}
            {exp !== undefined && <View style={[wc.metaChip, { backgroundColor: theme.colors.surface1 }]}><AppText numberOfLines={1} style={[wc.metaChipTxt, { color: theme.colors.mutedText }]}>{t('ws_meta_exp', { years: exp })}</AppText></View>}
            {!!agent.gender && <View style={[wc.metaChip, { backgroundColor: theme.colors.surface1 }]}><AppText numberOfLines={1} style={[wc.metaChipTxt, { color: theme.colors.mutedText }]}>{metaDisplay(agent.gender)}</AppText></View>}
            {!!wageText && <View style={[wc.metaChip, wc.wageChip]}><AppText numberOfLines={1} style={[wc.metaChipTxt, wc.wageTxt]}>{wageText}</AppText></View>}
          </View>

          {!!(agent.workerSubType || agent.agentType) && (
            <View style={[wc.subTypeBadge, { backgroundColor: theme.colors.warningLight, borderColor: theme.colors.warning + '50' }]}>
              <AppText style={[wc.subTypeTxt, { color: theme.colors.warning }]}>{metaDisplay(agent.workerSubType ?? agent.agentType)}</AppText>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* ── Last-contact row (only when a call outcome exists) ── */}
      {!!callStatus && (
        <View style={[wc.availRow, { borderTopColor: theme.colors.border }]}>
          <View style={wc.availDot} />
          <AppText style={[wc.lastContactTxt, { color: theme.colors.mutedText }]}>
            {t('ws_last_contact', { time: remarkTime ? timeAgoDate(remarkTime, t) : t('ws_recently') })}
          </AppText>
        </View>
      )}

      {/* ── Skills chips ── */}
      {matchedAreas.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[wc.skillsStrip, { borderTopColor: theme.colors.border }]}
          contentContainerStyle={wc.skillsContent}
        >
          {matchedAreas.map((area, idx) => (
            <View key={`${area}-${idx}`} style={[wc.skillChip, { backgroundColor: theme.colors.primary + '14', borderColor: theme.colors.primary + '2E' }]}>
              <AppText style={wc.skillChipIcon}>🔧</AppText>
              <AppText style={[wc.skillChipTxt, { color: theme.colors.primary }]} numberOfLines={1}>
                {subcatDisplay(area)}
              </AppText>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Documents row (Resume + Labour Licence) — tap chip navigates to profile where docs are viewable */}
      {(!!agent.resumeUrl || !!agent.labourLicenceUrl) && (
        <View style={[wc.docsRow, { borderTopColor: theme.colors.border }]}>
          {!!agent.resumeUrl && (
            <TouchableOpacity onPress={onPress} style={[wc.docChip, { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary + '50' }]} activeOpacity={0.8}>
              <AppText style={wc.resumeIcon}>📄</AppText>
              <AppText style={[wc.docChipTxt, { color: theme.colors.primary }]}>{t('ws_resume')}</AppText>
            </TouchableOpacity>
          )}
          {!!agent.labourLicenceUrl && (
            <TouchableOpacity onPress={onPress} style={[wc.docChip, { backgroundColor: theme.colors.successLight, borderColor: theme.colors.success + '60' }]} activeOpacity={0.8}>
              <AppText style={wc.resumeIcon}>📋</AppText>
              <AppText style={[wc.docChipTxt, { color: theme.colors.success }]}>{t('ws_licence')}</AppText>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Call Agent CTA ── */}
      <View style={[wc.ctaSection, { borderTopColor: theme.colors.border }]}>
        {unlockedPhone ? (
          <View style={wc.unlockedRow}>
            <TouchableOpacity
              onPress={() => void Linking.openURL(`tel:${unlockedPhone}`)}
              style={[wc.callBtn, { backgroundColor: BRAND }]}
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
          <TouchableOpacity onPress={onTopup} activeOpacity={0.82} style={[wc.topupCta, { backgroundColor: theme.colors.warningLight, borderColor: theme.colors.warning + '40' }]}>
            <View style={[wc.lockIconBox, { backgroundColor: theme.colors.accentLight }]}>
              <AppText style={{ fontSize: 16 }}>⚠️</AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={[wc.topupTitle, { color: theme.colors.warningDark }]}>{t('ws_contact_limit_reached')}</AppText>
              <AppText style={[wc.topupSub, { color: theme.colors.mutedText }]}>{t('ws_upgrade_to_unlock')}</AppText>
            </View>
            <AppText style={wc.lockChevron}>›</AppText>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={isSubscribed ? onViewContact : onSubscribe}
            disabled={loadingUnlock}
            style={[wc.callAgentBtn, { opacity: loadingUnlock ? 0.7 : 1 }]}
            activeOpacity={0.85}
          >
            {loadingUnlock ? (
              <ActivityIndicator size="small" color={WHITE} />
            ) : (
              <>
                <AppText style={wc.callAgentIcon}>📞</AppText>
                <AppText style={wc.callAgentTxt}>{t('ws_call_agent')}</AppText>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Log Call Outcome ── */}
      {isSubscribed && (
        <CallOutcomePicker
          agentId={agent._id}
          current={callStatus}
          onSave={onSaveRemark}
          saving={savingRemark}
          remarkTime={remarkTime}
        />
      )}

      {/* Agent group banner */}
      {isAgent && (
        <View style={[wc.agentBanner, { borderTopColor: theme.colors.secondary + '50', backgroundColor: theme.colors.secondaryLight }]}>
          <AppText style={{ fontSize: 13 }}>👥</AppText>
          <AppText style={[wc.agentBannerTxt, { color: theme.colors.secondary }]}>{t('ws_agent_banner')}</AppText>
        </View>
      )}
    </View>
  );
};

const wc = StyleSheet.create({
  card:           { borderRadius: 16, marginBottom: 9, overflow: 'hidden', elevation: 2, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, borderWidth: StyleSheet.hairlineWidth },

  infoRow:        { flexDirection: 'row', padding: 11, gap: 10 },

  avatarWrap:     { position: 'relative', alignSelf: 'flex-start' },
  avatar:         { width: 46, height: 46, borderRadius: 23, borderWidth: 2 },
  avatarFallback: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  initials:       { fontSize: 17, fontWeight: '800' },
  verifiedBadge:  { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: WHITE },
  verifiedTxt:    { color: WHITE, fontSize: 7, fontWeight: '900' },

  nameRow:        { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  name:           { fontSize: 15, fontWeight: '800', flex: 1 },
  rolePill:       { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  roleTxt:        { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  location:       { fontSize: 11, marginBottom: 5 },
  metaRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  metaChip:       { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, flexShrink: 0 },
  metaChipTxt:    { fontSize: 11, fontWeight: '600', lineHeight: 16 },
  wageChip:       { backgroundColor: GREEN_SOFT },
  wageTxt:        { color: GREEN, fontWeight: '800' },

  subTypeBadge:   { marginTop: 4, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  subTypeTxt:     { fontSize: 9.5, fontWeight: '700' },

  // Availability row
  availRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth },
  availDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN, marginRight: 6 },
  availTxt:       { fontSize: 12, fontWeight: '600', color: GREEN },
  availSep:       { fontSize: 12 },
  lastContactTxt: { fontSize: 12 },

  // Skills
  skillsStrip:    { borderTopWidth: StyleSheet.hairlineWidth },
  skillsContent:  { paddingHorizontal: 12, paddingVertical: 9, gap: 7, flexDirection: 'row' },
  skillChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  skillChipIcon:  { fontSize: 10.5 },
  skillChipTxt:   { fontSize: 12, fontWeight: '700' },

  // Documents row (resume + licence chips)
  docsRow:        { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
  docChip:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EBF1FF', borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 10, paddingVertical: 5 },
  docChipTxt:     { fontSize: 11, fontWeight: '700', color: BRAND },
  resumeIcon:     { fontSize: 13 },
  // kept for any remaining reference
  resumeBtn:      { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  resumeTxt:      { flex: 1, fontSize: 11.5, fontWeight: '700', color: BRAND },

  // CTA
  ctaSection:     { paddingHorizontal: 11, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  unlockedRow:    { flexDirection: 'row', gap: 8 },
  callBtn:        { flex: 1, borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  callBtnTxt:     { color: WHITE, fontSize: 14, fontWeight: '800' },
  waBtn:          { flex: 1, backgroundColor: '#25D366', borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingVertical: 11 },
  waBtnTxt:       { color: WHITE, fontSize: 14, fontWeight: '800' },
  callAgentBtn:   { flexDirection: 'row', backgroundColor: BRAND, borderRadius: 11, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', gap: 8 },
  callAgentIcon:  { fontSize: 15 },
  callAgentTxt:   { color: WHITE, fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  viewContactBtn: { backgroundColor: BRAND, borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  viewContactTxt: { color: WHITE, fontSize: 14, fontWeight: '800' },
  lockCta:        { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  lockIconBox:    { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  lockTitle:      { fontSize: 12, fontWeight: '700' },
  lockSub:        { fontSize: 10.5, fontWeight: '500', marginTop: 1 },
  lockChevron:    { fontSize: 20, fontWeight: '300', color: AMBER },
  topupCta:       { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  topupTitle:     { fontSize: 12, fontWeight: '700' },
  topupSub:       { fontSize: 10.5, fontWeight: '500', marginTop: 1 },

  agentBanner:    { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: 1 },
  agentBannerTxt: { fontSize: 11, fontWeight: '600', flex: 1 },
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

// ─── Main Screen ──────────────────────────────────────────────────────────────
type Nav = NativeStackNavigationProp<MainStackParamList>;
interface FullUserProfile {
  isSubscribed?: boolean;
  subscriptionExpery?: string;
  remainingContacts?: number;
  employerType?: string;
}

const scopeBanner = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { fontSize: 14, lineHeight: 18 },
  txt:  { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  cta:  { fontSize: 12, fontWeight: '800' },
});

export const WorkerSearchScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const { state: authState } = useAuth();
  const user = authState.session?.user;
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<MainStackParamList, 'WorkerSearch'>>();
  const qc = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const canGoBack = navigation.canGoBack();

  const initialCat = route.params?.workType ?? '';
  const userState    = user?.state ?? '';
  const userDistrict = user?.district ?? '';

  // ── Plan worker-search scope gate ──────────────────────────────────────────
  const plan = usePlanFeatures();
  // Non-subscriber: default to their own STATE only (state pre-selected, district
  // left open). Subscribers get their plan's scope. 'india' = unrestricted.
  const scope = plan.isSubscribed ? plan.workerSearchScope : 'state'; // 'district' | 'state' | 'india'
  // Only constrain when we actually know the user's location (graceful fallback).
  const districtScoped = scope === 'district' && !!userState && !!userDistrict;
  const stateScoped    = scope === 'state'    && !!userState;
  const isScoped       = districtScoped || stateScoped;
  // Reset should keep the plan-locked location, but clear it when unrestricted.
  const resetState    = isScoped ? userState : '';
  const resetDistrict = districtScoped ? userDistrict : '';

  const [appliedFilters, setAppliedFilters] = useState<WorkerFilters>({
    ...EMPTY_FILTERS,
    workerType: initialCat,
    state: userState,
    district: '',
  });

  // Auto-fill / lock the search location to the plan's allowed scope. Re-runs
  // when the scope resolves (it is permissive 'india' until the profile loads).
  useEffect(() => {
    if (!isScoped) return;
    setAppliedFilters((prev) => {
      const nextState = userState;
      const nextDistrict = districtScoped ? userDistrict : prev.district;
      if (prev.state === nextState && (!districtScoped || prev.district === nextDistrict)) {
        return prev;
      }
      return { ...prev, state: nextState, district: districtScoped ? nextDistrict : prev.district, tehsil: '' };
    });
  }, [isScoped, districtScoped, userState, userDistrict]);
  const [showFilters,      setShowFilters]      = useState(false);
  const [searchQuery,      setSearchQuery]      = useState('');

  const [unlockedPhones,  setUnlockedPhones]  = useState<Record<string, string>>({});
  const [loadingUnlock,   setLoadingUnlock]   = useState<Record<string, boolean>>({});
  const [callStatus,      setCallStatus]      = useState<Record<string, string>>({});
  const [savingRemark,    setSavingRemark]    = useState<Record<string, boolean>>({});
  const [remarkTimes,     setRemarkTimes]     = useState<Record<string, Date>>({});
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

  // Header quick-filter chips removed entirely (per request) — trade filtering is
  // done through the Filters sheet. The list shows all loaded results directly.
  const displayedAgents = filteredAgents;

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
        toast.error(msg ?? t('ws_unlock_failed_msg'), t('ws_unlock_failed_title'));
      }
    } finally {
      setLoadingUnlock((p) => ({ ...p, [agentId]: false }));
    }
  };

  const handleSaveRemark = async (agentId: string, status: string): Promise<void> => {
    setCallStatus((p) => ({ ...p, [agentId]: status }));
    setRemarkTimes((p) => ({ ...p, [agentId]: new Date() }));
    setSavingRemark((p) => ({ ...p, [agentId]: true }));
    try {
      await workerApi.saveWorkerRemark(agentId, status);
      void qc.invalidateQueries({ queryKey: ['worker-remarks'] });
      // Notify the worker about the call outcome update
      void apiClient.post('/api/v1/notifications/call-outcome', { workerId: agentId, outcome: status }).catch(() => {});
      toast.success(t('ws_outcome_saved_msg'), t('ws_saved_title'));
    } catch {
      toast.error(t('ws_outcome_save_failed_msg'), t('ws_save_failed_title'));
    } finally {
      setSavingRemark((p) => ({ ...p, [agentId]: false }));
    }
  };

  // Active filter pills
  const activePills: Array<{ key: string; label: string; onRemove: () => void }> = [
    appliedFilters.workerType && {
      key: 'wt',
      label: catDisplay(appliedFilters.workerType),
      onRemove: () =>
        setAppliedFilters((p) => ({ ...p, workerType: '', subCategory: '' })),
    },
    appliedFilters.subCategory && {
      key: 'sc',
      label: subcatDisplay(appliedFilters.subCategory),
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
      label:
        appliedFilters.gender === 'Male'   ? t('ws_male')
        : appliedFilters.gender === 'Female' ? t('ws_female')
        : appliedFilters.gender === 'Other'  ? t('ws_other')
        : appliedFilters.gender,
      onRemove: () => setAppliedFilters((p) => ({ ...p, gender: '' })),
    },
    appliedFilters.workerGroup && {
      key: 'wg',
      label:
        appliedFilters.workerGroup === 'group' ? t('ws_pill_group') : t('ws_pill_individual'),
      onRemove: () => setAppliedFilters((p) => ({ ...p, workerGroup: '' })),
    },
    appliedFilters.qualification && {
      key: 'ql',
      label: `🎓 ${appliedFilters.qualification}`,
      onRemove: () => setAppliedFilters((p) => ({ ...p, qualification: '' })),
    },
    (appliedFilters.ageMin || appliedFilters.ageMax) && {
      key: 'age',
      label: t('ws_pill_age', { min: appliedFilters.ageMin || '0', max: appliedFilters.ageMax || '∞' }),
      onRemove: () => setAppliedFilters((p) => ({ ...p, ageMin: '', ageMax: '' })),
    },
  ].filter(Boolean) as Array<{ key: string; label: string; onRemove: () => void }>;

  const headerPaddingTop = insets.top + 12;

  const isDark = theme.mode === 'dark';
  return (
    <View style={[sc.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Header (white) ── */}
      <View style={[sc.header, { paddingTop: headerPaddingTop, backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={sc.headerRow1}>
          {canGoBack && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[sc.backBtn, { backgroundColor: theme.colors.surface1 }]}
              activeOpacity={0.7}
            >
              <AppText style={[sc.backTxt, { color: theme.colors.text }]}>←</AppText>
            </TouchableOpacity>
          )}
          <View style={sc.headerTitleBlock}>
            <AppText style={[sc.headerTitle, { color: theme.colors.text }]}>{t('ws_header_title')}</AppText>
            <AppText style={[sc.headerSub, { color: theme.colors.mutedText }]} numberOfLines={1}>
              📍 {appliedFilters.state
                ? t('ws_results_in', { state: getLocationDisplayName(appliedFilters.state, 'state', i18n.language) })
                : t('ws_all_india')}
            </AppText>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.8}
            style={[sc.bellBtn, { backgroundColor: theme.colors.surface1 }]}
          >
            <AppText style={sc.bellIcon}>🔔</AppText>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Plan scope banner ── */}
      {isScoped && (
        <TouchableOpacity
          onPress={() => navigation.navigate('Subscription')}
          activeOpacity={0.85}
          style={[scopeBanner.wrap, { backgroundColor: theme.colors.primaryLight, borderBottomColor: theme.colors.border }]}
        >
          <AppText style={scopeBanner.icon}>📍</AppText>
          <AppText style={[scopeBanner.txt, { color: theme.colors.text }]} numberOfLines={2}>
            {districtScoped
              ? t('pl_scopeDistrict', { district: getLocationDisplayName(userDistrict, 'district', i18n.language) })
              : t('pl_scopeState', { state: getLocationDisplayName(userState, 'state', i18n.language) })}
          </AppText>
          <AppText style={[scopeBanner.cta, { color: BRAND }]}>{t('pl_upgrade')}</AppText>
        </TouchableOpacity>
      )}

      {/* ── Search + chips bar (white) ── */}
      <View style={[sc.searchSection, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        {/* Search bar */}
        <View style={[sc.searchBarWrap, { backgroundColor: theme.colors.surface1, borderColor: theme.colors.border }]}>
          <AppText style={[sc.searchIcon, { color: theme.colors.mutedText }]}>🔍</AppText>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('ws_main_search_placeholder')}
            placeholderTextColor={theme.colors.mutedText}
            style={[sc.searchInput, { color: theme.colors.text }]}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={sc.searchClear}>
              <AppText style={[sc.searchClearTxt, { color: theme.colors.mutedText }]}>✕</AppText>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            activeOpacity={0.85}
            style={[sc.filterBtn, { backgroundColor: activeFilterCount > 0 ? BRAND : theme.colors.surface1 }, activeFilterCount > 0 && sc.filterBtnActive]}
          >
            <AppText style={[sc.filterIcon, { color: activeFilterCount > 0 ? WHITE : theme.colors.mutedText }]}>⊟</AppText>
            {activeFilterCount > 0 && (
              <View style={sc.filterBadge}>
                <AppText style={sc.filterBadgeTxt}>{activeFilterCount}</AppText>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Category quick-filter chips removed (per request) — full category
            filtering still available via the filter button. */}

        {/* Active filter pills */}
        {activePills.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={sc.pillsBar}
            contentContainerStyle={sc.pillsContent}
          >
            {activePills.map((pill) => (
              <TouchableOpacity key={pill.key} onPress={pill.onRemove} activeOpacity={0.75} style={[sc.pill, { backgroundColor: theme.colors.primaryLight, borderColor: BRAND + '40' }]}>
                <AppText style={sc.pillTxt} numberOfLines={1}>{pill.label}</AppText>
                <AppText style={sc.pillClose}>×</AppText>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setAppliedFilters({ ...EMPTY_FILTERS, state: resetState, district: resetDistrict })}
              style={sc.pillClear}
            >
              <AppText style={sc.pillClearTxt}>{t('ws_clear_all')}</AppText>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {/* ── Content ── */}
      {isLoading ? (
        <ScrollView contentContainerStyle={sc.list} showsVerticalScrollIndicator={false}>
          {Array.from({ length: 6 }, (_, i) => (<SkeletonCard key={i} />))}
        </ScrollView>
      ) : isError ? (
        <View style={sc.stateBox}>
          <View style={sc.errorIconWrap}><AppText style={{ fontSize: 28 }}>⚠</AppText></View>
          <AppText style={[sc.stateTitle, { color: theme.colors.text }]}>{t('ws_connection_error')}</AppText>
          <AppText style={[sc.stateBody, { color: theme.colors.mutedText }]}>{t('ws_connection_error_body')}</AppText>
          <TouchableOpacity onPress={() => void refetch()} style={[sc.primaryBtn, { backgroundColor: theme.colors.primary }]}>
            <AppText style={sc.primaryBtnTxt}>{t('ws_retry')}</AppText>
          </TouchableOpacity>
        </View>
      ) : displayedAgents.length === 0 ? (
        <View style={sc.stateBox}>
          <View style={[sc.emptyIconWrap, { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary + '40' }]}><AppText style={{ fontSize: 32 }}>👷</AppText></View>
          <AppText style={[sc.stateTitle, { color: theme.colors.text }]}>{t('ws_no_workers_found')}</AppText>
          <AppText style={[sc.stateBody, { color: theme.colors.mutedText }]}>
            {searchQuery.trim()
              ? t('ws_no_results_query', { query: searchQuery.trim() })
              : activeFilterCount > 0
                ? t('ws_no_match_filters')
                : t('ws_no_workers_area')}
          </AppText>
          {searchQuery.trim() ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={[sc.primaryBtn, sc.outlineBtn, { borderColor: BRAND }]}>
              <AppText style={[sc.primaryBtnTxt, { color: BRAND }]}>{t('ws_clear_search')}</AppText>
            </TouchableOpacity>
          ) : activeFilterCount > 0 ? (
            <TouchableOpacity
              onPress={() => setAppliedFilters({ ...EMPTY_FILTERS, state: resetState, district: resetDistrict })}
              style={[sc.primaryBtn, sc.outlineBtn, { borderColor: BRAND }]}
            >
              <AppText style={[sc.primaryBtnTxt, { color: BRAND }]}>{t('ws_clear_filters')}</AppText>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={displayedAgents}
          keyExtractor={(item) => item._id}
          style={sc.flex1}
          contentContainerStyle={sc.list}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={10}
          removeClippedSubviews={Platform.OS === 'android'}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) void fetchNextPage(); }}
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
              remarkTime={remarkTimes[item._id]}
              workerTypeApplied={appliedFilters.workerType}
              appliedDistrict={appliedFilters.district}
              onViewContact={() => void handleViewContact(item._id)}
              onSubscribe={() => navigation.navigate('Subscription')}
              onTopup={() => navigation.navigate('Subscription')}
              onSaveRemark={(id, status) => void handleSaveRemark(id, status)}
              onPress={() => navigation.navigate('WorkerProfile', { workerId: item._id })}
            />
          )}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={sc.loadMore}>
                <ActivityIndicator size="small" color={BRAND} />
                <AppText style={[sc.loadMoreTxt, { color: theme.colors.mutedText }]}>{t('ws_loading_more')}</AppText>
              </View>
            ) : null
          }
        />
      )}

      <FilterSheet
        visible={showFilters}
        initial={appliedFilters}
        onApply={handleApply}
        onClose={() => setShowFilters(false)}
        userState={userState}
        userDistrict={userDistrict}
        lockState={isScoped}
        lockDistrict={districtScoped}
      />
    </View>
  );
};

// ─── Screen styles ────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  container:       { flex: 1 },
  flex1:           { flex: 1 },

  // Header
  header:          { paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow1:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn:         { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backTxt:         { fontSize: 20, fontWeight: '600', lineHeight: 24 },
  headerTitleBlock:{ flex: 1 },
  headerTitle:     { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  headerSub:       { fontSize: 11, fontWeight: '500' },
  bellBtn:         { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  bellIcon:        { fontSize: 18 },

  // Search section
  searchSection:   { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBarWrap:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 0, height: 46, marginBottom: 0, gap: 8 },
  searchIcon:      { fontSize: 16 },
  searchInput:     { flex: 1, fontSize: 14, paddingVertical: 0 },
  searchClear:     { padding: 4 },
  searchClearTxt:  { fontSize: 18, lineHeight: 22 },
  filterBtn:       { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  filterBtnActive: {},
  filterIcon:      { fontSize: 16 },
  filterBadge:     { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: AMBER, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterBadgeTxt:  { fontSize: 9, fontWeight: '900', color: WHITE },

  // Category chips
  chipsContent:    { gap: 8, paddingBottom: 4 },
  chip:            { borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 7 },
  chipActive:      {},
  chipTxt:         { fontSize: 13, fontWeight: '600' },
  chipTxtActive:   { fontWeight: '700' },

  // Active filter pills
  pillsBar:        { flexGrow: 0, marginTop: 6 },
  pillsContent:    { gap: 7, flexDirection: 'row' },
  pill:            { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  pillTxt:         { fontSize: 12, fontWeight: '600', color: BRAND, maxWidth: 110 },
  pillClose:       { fontSize: 16, fontWeight: '700', color: BRAND, lineHeight: 18 },
  pillClear:       { borderRadius: 20, borderWidth: 1, borderColor: '#fca5a5', backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 5 },
  pillClearTxt:    { fontSize: 12, fontWeight: '700', color: '#dc2626' },

  // Result count bar

  // List
  list:            { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 32 },

  // Loading more
  loadMore:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 20 },
  loadMoreTxt:     { fontSize: 13 },

  // Empty / error states
  stateBox:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  errorIconWrap:   { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fee2e2', borderWidth: 2, borderColor: '#fca5a5', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyIconWrap:   { width: 80, height: 80, borderRadius: 40, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stateTitle:      { fontSize: 19, fontWeight: '800', textAlign: 'center' },
  stateBody:       { fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  primaryBtn:      { marginTop: 4, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 13 },
  outlineBtn:      { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: BRAND },
  primaryBtnTxt:   { color: WHITE, fontWeight: '800', fontSize: 14 },
});
