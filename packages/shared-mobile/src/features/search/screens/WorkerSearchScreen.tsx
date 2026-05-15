import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useAppTheme } from '../../../core/theme';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import type { RawAgent } from '../../../core/api/endpoints/workerApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { SubscriptionModal } from '../../../shared/components/ui/SubscriptionModal';
import type { MainStackParamList } from '../../../app/navigation/types';
import WORKER_CATEGORIES from '../../../shared/data/categories.json';
import { indianStates } from '../../../shared/data/stateDistrict';
import { ENV } from '../../../core/config/env';

const FILE_BASE = ENV.API_BASE_URL.replace(/\/api\/v1\/?$/, '');
const PAGE_LIMIT = 25;

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  navy:       '#0f172a',
  navyMid:    '#1e3a5f',
  blue:       '#2563eb',
  blueDark:   '#1d4ed8',
  blueSoft:   '#eff6ff',
  blueLight:  '#dbeafe',
  indigo:     '#4f46e5',
  indigoSoft: '#eef2ff',
  green:      '#16a34a',
  greenSoft:  '#f0fdf4',
  greenLight: '#bbf7d0',
  amber:      '#d97706',
  amberSoft:  '#fffbeb',
  amberLight: '#fde68a',
  red:        '#dc2626',
  redSoft:    '#fff1f2',
  slate:      '#64748b',
  slateLight: '#f1f5f9',
  slateXLight:'#f8fafc',
  border:     '#e2e8f0',
  white:      '#ffffff',
  shadow:     '#0f172a',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface CatEntry { label: string; value: string; subcategories?: Array<{ label: string; value: string }> }
const CATEGORIES = WORKER_CATEGORIES as CatEntry[];

interface WorkerFilters {
  workerType: string; subCategory: string; state: string; district: string;
  tehsil: string; gender: string; workerGroup: string; ageMin: string; ageMax: string;
}
const EMPTY_FILTERS: WorkerFilters = {
  workerType: '', subCategory: '', state: '', district: '',
  tehsil: '', gender: '', workerGroup: '', ageMin: '', ageMax: '',
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
  String(text || '').trim().toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ');

const formatName = (name = ''): string =>
  name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const formatAreas = (areas: string[]): string =>
  areas.filter(Boolean).map((a) => String(a || '').trim())
    .filter(Boolean).map((a) => a.charAt(0).toUpperCase() + a.slice(1).toLowerCase())
    .join('  ·  ');

const getAge = (dob?: string | number): string => {
  if (dob == null || dob === '') return '';
  const timestamp = Number(dob);
  if (isNaN(timestamp)) return '';
  if (String(dob).length <= 5) {
    if (timestamp > 1900 && timestamp <= new Date().getFullYear()) return String(new Date().getFullYear() - timestamp);
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
    (c) => normalizeText(c.label) === normalizeText(selected) || normalizeText(c.value) === normalizeText(selected)
  );
  return (cat?.subcategories ?? []).map((s) => normalizeText(s.label || s.value));
};

const getMatchedAreasOfWork = (areas: string[] = [], selected = ''): string[] => {
  const normalized = areas.flatMap((item) => {
    try {
      if (typeof item === 'string' && item.startsWith('[')) return JSON.parse(item) as string[];
      return item;
    } catch { return item; }
  }).filter(Boolean).map((item) => normalizeText(String(item)));
  if (!selected) return normalized;
  const allowed = getCategorySubcategories(selected);
  return normalized.filter((a) => allowed.includes(a));
};

function countActive(f: WorkerFilters): number {
  return [f.workerType, f.subCategory, f.state, f.district, f.tehsil, f.gender, f.workerGroup, f.ageMin, f.ageMax].filter(Boolean).length;
}

// ─── Picker Modal ─────────────────────────────────────────────────────────────
const PickerModal = ({
  visible, title, options, selected, onSelect, onClose, allLabel = 'All',
}: {
  visible: boolean; title: string; options: string[]; selected: string;
  onSelect: (v: string) => void; onClose: () => void; allLabel?: string;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const [q, setQ] = useState('');
  const shown = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[pm.root, { backgroundColor: theme.colors.background }]}>
        <View style={[pm.header, { borderBottomColor: C.border }]}>
          <View>
            <AppText style={pm.title}>{title}</AppText>
            <AppText style={[pm.sub, { color: C.slate }]}>{options.length} options available</AppText>
          </View>
          <TouchableOpacity onPress={onClose} style={pm.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <AppText style={pm.closeTxt}>✕</AppText>
          </TouchableOpacity>
        </View>
        {options.length > 6 && (
          <View style={[pm.searchWrap, { backgroundColor: theme.colors.card, borderColor: C.border }]}>
            <AppText style={pm.searchIcon}>⌕</AppText>
            <TextInput value={q} onChangeText={setQ} placeholder="Search…" placeholderTextColor={C.slate}
              style={[pm.searchInput, { color: theme.colors.text }]} />
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
              <TouchableOpacity onPress={() => { onSelect(val); setQ(''); onClose(); }} activeOpacity={0.7}
                style={[pm.item, { borderBottomColor: C.border, backgroundColor: active ? C.blueSoft : 'transparent' }]}>
                <AppText style={[pm.itemText, { color: active ? C.blue : theme.colors.text, fontWeight: active ? '700' : '400' }]}>
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
  root:        { flex: 1 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 20 : 16, paddingBottom: 14, borderBottomWidth: 1 },
  title:       { fontSize: 17, fontWeight: '800', color: C.navy },
  sub:         { fontSize: 12, marginTop: 1, color: C.slate },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: C.slateLight, alignItems: 'center', justifyContent: 'center' },
  closeTxt:    { fontSize: 13, fontWeight: '700', color: C.slate },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, marginHorizontal: 16, marginVertical: 12 },
  searchIcon:  { fontSize: 18, paddingHorizontal: 12, color: C.slate },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  item:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  itemText:    { fontSize: 15 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  checkTxt:    { color: C.white, fontSize: 12, fontWeight: '800' },
});

// ─── Dropdown Field ───────────────────────────────────────────────────────────
const DropField = ({ label, value, placeholder, onPress, disabled }: {
  label: string; value: string; placeholder: string; onPress: () => void; disabled?: boolean;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const active = !!value;
  return (
    <View style={{ marginBottom: 12 }}>
      <AppText style={[df.label, { color: C.slate }]}>{label}</AppText>
      <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.75}
        style={[df.field, {
          borderColor: active ? C.blue : C.border,
          backgroundColor: active ? C.blueSoft : theme.colors.card,
          opacity: disabled ? 0.45 : 1,
        }]}>
        <AppText style={[df.text, { color: active ? C.blue : C.slate }]} numberOfLines={1}>
          {value || placeholder}
        </AppText>
        <AppText style={[df.chevron, { color: active ? C.blue : C.slate }]}>›</AppText>
      </TouchableOpacity>
    </View>
  );
};
const df = StyleSheet.create({
  label:   { fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6, color: C.slate },
  field:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  text:    { flex: 1, fontSize: 14, fontWeight: '500' },
  chevron: { fontSize: 20, fontWeight: '300' },
});

// ─── Filter Sheet ─────────────────────────────────────────────────────────────
const FilterSheet = ({ visible, initial, onApply, onClose, userState }: {
  visible: boolean; initial: WorkerFilters; userState: string;
  onApply: (f: WorkerFilters) => void; onClose: () => void;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const [f, setF] = useState<WorkerFilters>(initial);
  const [picker, setPicker] = useState<'cat' | 'subcat' | 'state' | 'district' | 'tehsil' | null>(null);
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
  const districtList = useMemo(() => f.state ? Object.keys(indianStates[f.state] ?? {}).sort() : [], [f.state]);
  const tehsilList   = useMemo(() => f.state && f.district ? (indianStates[f.state]?.[f.district] ?? []).sort() : [], [f.state, f.district]);
  const catLabels    = useMemo(() => CATEGORIES.map((c) => c.label), []);
  const subCatLabels = useMemo(() => CATEGORIES.find((c) => c.label === f.workerType)?.subcategories?.map((s) => s.label) ?? [], [f.workerType]);

  const activeCount = countActive(f);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[fsh.root, { backgroundColor: theme.colors.background }]}>
        <View style={[fsh.header, { borderBottomColor: C.border }]}>
          <View style={fsh.headerLeft}>
            <AppText style={fsh.headerTitle}>Filter Workers</AppText>
            <AppText style={[fsh.headerSub, { color: C.slate }]}>
              {activeCount > 0 ? `${activeCount} filter${activeCount > 1 ? 's' : ''} active` : 'Refine your search'}
            </AppText>
          </View>
          <View style={fsh.headerActions}>
            {activeCount > 0 && (
              <TouchableOpacity onPress={() => setF({ ...EMPTY_FILTERS, state: userState })} style={fsh.resetBtn}>
                <AppText style={fsh.resetTxt}>Reset</AppText>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={fsh.closeBtn}>
              <AppText style={fsh.closeTxt}>✕</AppText>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={fsh.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={fsh.section}>
            <View style={fsh.sectionLabelRow}>
              <View style={[fsh.sectionDot, { backgroundColor: C.blue }]} />
              <AppText style={fsh.sectionLabel}>Location</AppText>
            </View>
            <DropField label="State" value={f.state} placeholder="All States" onPress={() => setPicker('state')} />
            <DropField label="District" value={f.district} placeholder={f.state ? 'Select district' : 'Select state first'} onPress={() => f.state && setPicker('district')} disabled={!f.state} />
            {(districtList.length > 0 || f.tehsil) && (
              <DropField label="Tehsil / Block" value={f.tehsil} placeholder={f.district ? 'Select tehsil' : 'Select district first'} onPress={() => f.district && setPicker('tehsil')} disabled={!f.district} />
            )}
          </View>

          <View style={[fsh.divider, { backgroundColor: C.border }]} />

          <View style={fsh.section}>
            <View style={fsh.sectionLabelRow}>
              <View style={[fsh.sectionDot, { backgroundColor: '#8b5cf6' }]} />
              <AppText style={fsh.sectionLabel}>Work Type</AppText>
            </View>
            <DropField label="Category" value={f.workerType} placeholder="All categories" onPress={() => setPicker('cat')} />
            {f.workerType && subCatLabels.length > 0 && (
              <DropField label="Sub-category" value={f.subCategory} placeholder="All sub-categories" onPress={() => setPicker('subcat')} />
            )}
          </View>

          <View style={[fsh.divider, { backgroundColor: C.border }]} />

          <View style={fsh.section}>
            <View style={fsh.sectionLabelRow}>
              <View style={[fsh.sectionDot, { backgroundColor: C.green }]} />
              <AppText style={fsh.sectionLabel}>Worker Type</AppText>
            </View>
            <View style={fsh.chipRow}>
              {[
                { label: 'Individual Worker', val: 'individual', icon: '👤' },
                { label: 'Agent / Group',      val: 'group',      icon: '👥' },
              ].map((opt) => {
                const active = f.workerGroup === opt.val;
                return (
                  <TouchableOpacity key={opt.val} onPress={() => set('workerGroup', active ? '' : opt.val)} activeOpacity={0.8}
                    style={[fsh.chip, { backgroundColor: active ? C.navy : theme.colors.card, borderColor: active ? C.navy : C.border }]}>
                    <AppText style={fsh.chipIcon}>{opt.icon}</AppText>
                    <AppText style={[fsh.chipTxt, { color: active ? C.white : theme.colors.text }]}>{opt.label}</AppText>
                    {active && <AppText style={{ color: C.white, fontSize: 12, marginLeft: 4 }}>✓</AppText>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={[fsh.divider, { backgroundColor: C.border }]} />

          <View style={fsh.section}>
            <View style={fsh.sectionLabelRow}>
              <View style={[fsh.sectionDot, { backgroundColor: C.amber }]} />
              <AppText style={fsh.sectionLabel}>Demographics</AppText>
            </View>
            <AppText style={[df.label, { marginBottom: 8 }]}>Gender</AppText>
            <View style={[fsh.chipRow, { marginBottom: 14 }]}>
              {['Male', 'Female', 'Other'].map((g) => {
                const active = f.gender === g;
                return (
                  <TouchableOpacity key={g} onPress={() => set('gender', active ? '' : g)} activeOpacity={0.8}
                    style={[fsh.genderChip, { backgroundColor: active ? C.blue : theme.colors.card, borderColor: active ? C.blue : C.border }]}>
                    <AppText style={[fsh.genderChipTxt, { color: active ? C.white : theme.colors.text }]}>{g}</AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
            <AppText style={[df.label, { marginBottom: 8 }]}>Age Range</AppText>
            <View style={fsh.ageRow}>
              <View style={[fsh.ageInputWrap, { borderColor: f.ageMin ? C.blue : C.border, backgroundColor: f.ageMin ? C.blueSoft : theme.colors.card }]}>
                <TextInput value={f.ageMin} onChangeText={(v) => set('ageMin', v.replace(/\D/g, ''))}
                  placeholder="Min" placeholderTextColor={C.slate} keyboardType="number-pad"
                  style={[fsh.ageInput, { color: theme.colors.text }]} />
                <AppText style={{ color: C.slate, fontSize: 11, fontWeight: '600' }}>yrs</AppText>
              </View>
              <View style={fsh.ageDash}>
                <AppText style={{ color: C.slate, fontWeight: '600' }}>to</AppText>
              </View>
              <View style={[fsh.ageInputWrap, { borderColor: f.ageMax ? C.blue : C.border, backgroundColor: f.ageMax ? C.blueSoft : theme.colors.card }]}>
                <TextInput value={f.ageMax} onChangeText={(v) => set('ageMax', v.replace(/\D/g, ''))}
                  placeholder="Max" placeholderTextColor={C.slate} keyboardType="number-pad"
                  style={[fsh.ageInput, { color: theme.colors.text }]} />
                <AppText style={{ color: C.slate, fontSize: 11, fontWeight: '600' }}>yrs</AppText>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={[fsh.footer, { borderTopColor: C.border, backgroundColor: theme.colors.background }]}>
          <TouchableOpacity onPress={onClose} style={fsh.cancelBtn} activeOpacity={0.8}>
            <AppText style={[fsh.cancelTxt, { color: theme.colors.text }]}>Cancel</AppText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onApply(f)} style={fsh.applyBtn} activeOpacity={0.88}>
            <AppText style={fsh.applyTxt}>
              {activeCount > 0 ? `Apply  ·  ${activeCount}` : 'Apply Filters'}
            </AppText>
          </TouchableOpacity>
        </View>

        <PickerModal visible={picker === 'cat'}      title="Work Category"   options={catLabels}    selected={f.workerType}  onSelect={(v) => set('workerType', v)}  onClose={() => setPicker(null)} allLabel="All Categories" />
        <PickerModal visible={picker === 'subcat'}   title="Sub-category"    options={subCatLabels} selected={f.subCategory} onSelect={(v) => set('subCategory', v)} onClose={() => setPicker(null)} allLabel="All Sub-categories" />
        <PickerModal visible={picker === 'state'}    title="State"           options={stateList}    selected={f.state}       onSelect={(v) => set('state', v)}        onClose={() => setPicker(null)} allLabel="All States" />
        <PickerModal visible={picker === 'district'} title="District / City" options={districtList} selected={f.district}    onSelect={(v) => set('district', v)}     onClose={() => setPicker(null)} allLabel="All Districts" />
        <PickerModal visible={picker === 'tehsil'}   title="Tehsil / Block"  options={tehsilList}   selected={f.tehsil}      onSelect={(v) => set('tehsil', v)}       onClose={() => setPicker(null)} allLabel="All Blocks" />
      </View>
    </Modal>
  );
};
const fsh = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 20 : 16, paddingBottom: 16, borderBottomWidth: 1 },
  headerLeft:   { flex: 1 },
  headerTitle:  { fontSize: 20, fontWeight: '800', color: C.navy },
  headerSub:    { fontSize: 12, marginTop: 2 },
  headerActions:{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  resetBtn:     { borderWidth: 1, borderColor: C.blue, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  resetTxt:     { fontSize: 13, fontWeight: '700', color: C.blue },
  closeBtn:     { width: 32, height: 32, borderRadius: 16, backgroundColor: C.slateLight, alignItems: 'center', justifyContent: 'center' },
  closeTxt:     { fontSize: 13, fontWeight: '700', color: C.slate },
  body:         { paddingBottom: 24 },
  section:      { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionDot:   { width: 4, height: 16, borderRadius: 2 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: C.navy, letterSpacing: 0.2 },
  divider:      { height: 1, marginHorizontal: 20 },
  chipRow:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:         { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  chipIcon:     { fontSize: 15 },
  chipTxt:      { fontSize: 13, fontWeight: '600' },
  genderChip:   { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 9 },
  genderChipTxt:{ fontSize: 13, fontWeight: '600' },
  ageRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  ageInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 },
  ageInput:     { flex: 1, fontSize: 15, fontWeight: '600' },
  ageDash:      { paddingHorizontal: 12 },
  footer:       { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1 },
  cancelBtn:    { flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center', paddingVertical: 15 },
  cancelTxt:    { fontSize: 15, fontWeight: '700' },
  applyBtn:     { flex: 2, borderRadius: 14, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center', paddingVertical: 15 },
  applyTxt:     { color: C.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
});

// ─── Call Outcome Picker ──────────────────────────────────────────────────────
const CallOutcomePicker = ({ agentId, current, onSave, saving }: {
  agentId: string; current: string; onSave: (id: string, val: string) => void; saving: boolean;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const [show, setShow] = useState(false);
  const label = CALL_OUTCOMES.find((o) => o.value === current)?.label;
  const hasOutcome = !!current;

  return (
    <>
      <TouchableOpacity onPress={() => setShow(true)} disabled={saving} activeOpacity={0.8}
        style={[co.btn, { borderColor: hasOutcome ? C.blue : C.border, backgroundColor: hasOutcome ? C.blueSoft : theme.colors.card }]}>
        <View style={[co.dot, { backgroundColor: hasOutcome ? C.blue : C.slate }]} />
        <AppText style={[co.btnText, { color: hasOutcome ? C.blue : C.slate }]} numberOfLines={1}>
          {saving ? 'Saving…' : (label ?? 'Log Call Outcome')}
        </AppText>
        <AppText style={[co.chevron, { color: hasOutcome ? C.blue : C.slate }]}>›</AppText>
      </TouchableOpacity>

      <Modal visible={show} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShow(false)}>
        <View style={[co.sheet, { backgroundColor: theme.colors.background }]}>
          <View style={[co.sheetHeader, { borderBottomColor: C.border }]}>
            <View>
              <AppText style={co.sheetTitle}>Call Outcome</AppText>
              <AppText style={[co.sheetSub, { color: C.slate }]}>Select the result of your last call</AppText>
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
                <TouchableOpacity onPress={() => { onSave(agentId, item.value); setShow(false); }} activeOpacity={0.7}
                  style={[co.item, { borderBottomColor: C.border, backgroundColor: active ? C.blueSoft : 'transparent' }]}>
                  <AppText style={[co.itemText, { color: active ? C.blue : theme.colors.text, fontWeight: active ? '700' : '400' }]}>{item.label}</AppText>
                  {active && (
                    <View style={co.checkCircle}>
                      <AppText style={{ color: C.white, fontSize: 11, fontWeight: '800' }}>✓</AppText>
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
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 20 : 16, paddingBottom: 14, borderBottomWidth: 1 },
  sheetTitle:  { fontSize: 17, fontWeight: '800', color: C.navy },
  sheetSub:    { fontSize: 12, marginTop: 2 },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: C.slateLight, alignItems: 'center', justifyContent: 'center' },
  closeTxt:    { fontSize: 13, fontWeight: '700', color: C.slate },
  item:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  itemText:    { fontSize: 15 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
});

// ─── Worker Card ──────────────────────────────────────────────────────────────
interface AgentCardProps {
  agent: RawAgent;
  isSubscribed: boolean;
  unlockedPhone?: string;
  loadingUnlock: boolean;
  callStatus: string;
  savingRemark: boolean;
  workerTypeApplied: string;
  onViewContact: () => void;
  onSubscribe: () => void;
  onSaveRemark: (id: string, status: string) => void;
  onPress: () => void;
}

const AgentCard = ({
  agent, isSubscribed, unlockedPhone, loadingUnlock, callStatus, savingRemark,
  workerTypeApplied, onViewContact, onSubscribe, onSaveRemark, onPress,
}: AgentCardProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const photoUrl = agent.profilePhoto ? `${FILE_BASE}/${agent.profilePhoto}`.replace(/([^:]\/)\/+/g, '$1') : undefined;
  const initials = formatName(agent.name ?? '?').split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  const isAgent = String(agent.role ?? '').toLowerCase() === 'agent';
  const matchedAreas = getMatchedAreasOfWork(agent.areasOfWork ?? [], workerTypeApplied);
  const age = getAge(agent.dob);
  const exp = agent.workExperience !== undefined
    ? (Number(agent.workExperience) > 0 ? Number(agent.workExperience) : 3)
    : undefined;
  const accentColor = isAgent ? C.indigo : C.blue;
  const accentBg    = isAgent ? C.indigoSoft : C.blueSoft;
  const roleLabel   = isAgent ? 'Agent' : 'Worker';
  const wage = agent.fixedSalary ?? agent.salaryFrom;
  const wageText = wage ? `₹${wage}${agent.salaryTo && agent.salaryTo !== wage ? `–${agent.salaryTo}` : ''}/day` : null;

  return (
    <View style={[wc.card, {
      backgroundColor: theme.colors.card,
      shadowColor: C.shadow,
    }]}>
      {/* ── Accent bar + content column ─────────────────── */}
      <View style={[wc.accentBar, { backgroundColor: accentColor }]} />

      {/* All card content stacks vertically */}
      <View style={{ flex: 1, flexDirection: 'column' }}>

        {/* ── Top: worker info (tappable) ─────────────────── */}
        <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={wc.infoSection}>
          {/* Avatar */}
          <View style={wc.avatarWrap}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={[wc.avatar, { borderColor: accentColor }]} />
            ) : (
              <View style={[wc.avatarFallback, { backgroundColor: accentBg }]}>
                <AppText style={[wc.initials, { color: accentColor }]}>{initials}</AppText>
              </View>
            )}
            {agent.veryfiedBage && (
              <View style={[wc.verifiedBadge, { backgroundColor: accentColor }]}>
                <AppText style={wc.verifiedTxt}>✓</AppText>
              </View>
            )}
          </View>

          {/* Text info */}
          <View style={{ flex: 1 }}>
            {/* Name + role */}
            <View style={wc.nameRow}>
              <AppText style={[wc.name, { color: theme.colors.text }]} numberOfLines={1}>
                {formatName(agent.name ?? 'Unknown')}
              </AppText>
              <View style={[wc.rolePill, { backgroundColor: accentBg, borderColor: accentColor + '40' }]}>
                <AppText style={[wc.roleTxt, { color: accentColor }]}>{roleLabel}</AppText>
              </View>
            </View>

            {/* Location */}
            {(agent.district || agent.state) && (
              <AppText style={[wc.location, { color: C.slate }]} numberOfLines={1}>
                {[agent.district, agent.state].filter(Boolean).join(', ')}
              </AppText>
            )}

            {/* Meta stats row */}
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
          </View>
        </TouchableOpacity>

        {/* Skills strip */}
        {matchedAreas.length > 0 && (
          <View style={[wc.skillsStrip, { borderTopColor: C.border }]}>
            <AppText style={[wc.skillsTxt, { color: C.slate }]} numberOfLines={1}>
              {formatAreas(matchedAreas)}
            </AppText>
          </View>
        )}

        {/* ── Contact CTA ─────────────────────────────────── */}
        <View style={[wc.ctaSection, { borderTopColor: C.border }]}>
          {unlockedPhone ? (
            <View style={wc.unlockedRow}>
              <TouchableOpacity
                onPress={() => void Linking.openURL(`tel:${unlockedPhone}`)}
                style={wc.callBtn}
                activeOpacity={0.85}
              >
                <AppText style={wc.callBtnTxt}>Call  {unlockedPhone}</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void Linking.openURL(`https://wa.me/91${unlockedPhone}`)}
                style={wc.waBtn}
                activeOpacity={0.85}
              >
                <AppText style={wc.waBtnTxt}>WA</AppText>
              </TouchableOpacity>
            </View>
          ) : isSubscribed ? (
            <TouchableOpacity
              onPress={onViewContact}
              disabled={loadingUnlock}
              style={[wc.viewContactBtn, { opacity: loadingUnlock ? 0.7 : 1 }]}
              activeOpacity={0.85}
            >
              {loadingUnlock
                ? <ActivityIndicator size="small" color={C.white} />
                : <AppText style={wc.viewContactTxt}>View Contact Number</AppText>
              }
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onSubscribe} activeOpacity={0.82} style={wc.lockCta}>
              <View style={[wc.lockIconBox, { backgroundColor: C.amberSoft, borderColor: C.amberLight }]}>
                <AppText style={{ fontSize: 16 }}>🔒</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={wc.lockTitle}>Subscribe to Unlock Contact</AppText>
                <AppText style={[wc.lockSub, { color: C.slate }]}>Get full access to worker contacts</AppText>
              </View>
              <AppText style={[wc.lockChevron, { color: C.amber }]}>›</AppText>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Call outcome (subscribed) ────────────────────── */}
        {isSubscribed && (
          <View style={[wc.remarkRow, { borderTopColor: C.border }]}>
            <CallOutcomePicker agentId={agent._id} current={callStatus} onSave={onSaveRemark} saving={savingRemark} />
          </View>
        )}

        {/* ── Agent group banner ───────────────────────────── */}
        {isAgent && (
          <View style={[wc.agentBanner, { backgroundColor: C.indigoSoft, borderTopColor: '#c7d2fe' }]}>
            <AppText style={{ fontSize: 13 }}>👥</AppText>
            <AppText style={[wc.agentBannerTxt, { color: '#3730a3' }]}>
              Agent-managed groups available · Ideal for bulk hiring
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
};

const wc = StyleSheet.create({
  // Card shell
  card:           { flexDirection: 'row', borderRadius: 16, marginBottom: 12, overflow: 'hidden', elevation: 2, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
  accentBar:      { width: 5 },

  // Info section (tappable top area)
  infoSection:    { flexDirection: 'row', padding: 16, gap: 14 },

  // Avatar
  avatarWrap:     { position: 'relative', alignSelf: 'flex-start' },
  avatar:         { width: 66, height: 66, borderRadius: 33, borderWidth: 2.5 },
  avatarFallback: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  initials:       { fontSize: 22, fontWeight: '800' },
  verifiedBadge:  { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.white },
  verifiedTxt:    { color: C.white, fontSize: 9, fontWeight: '900' },

  // Name + meta
  nameRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name:           { fontSize: 16, fontWeight: '800', flex: 1 },
  rolePill:       { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  roleTxt:        { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  location:       { fontSize: 12, fontWeight: '500', color: C.slate, marginBottom: 7 },
  metaRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip:       { backgroundColor: C.slateXLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.border },
  metaChipTxt:    { fontSize: 11, fontWeight: '600', color: C.slate },
  wageChip:       { backgroundColor: C.greenSoft, borderColor: C.greenLight },
  wageTxt:        { color: C.green, fontWeight: '700' },

  // Skills strip
  skillsStrip:    { paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  skillsTxt:      { fontSize: 12, fontWeight: '500', lineHeight: 18 },

  // CTA section
  ctaSection:     { paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },

  // Unlocked state
  unlockedRow:    { flexDirection: 'row', gap: 8 },
  callBtn:        { flex: 1, backgroundColor: C.navy, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  callBtnTxt:     { color: C.white, fontSize: 14, fontWeight: '800' },
  waBtn:          { width: 52, backgroundColor: '#16a34a', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  waBtnTxt:       { color: C.white, fontSize: 13, fontWeight: '800' },

  // Subscribed — view contact
  viewContactBtn: { backgroundColor: C.blue, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  viewContactTxt: { color: C.white, fontSize: 14, fontWeight: '800' },

  // Lock CTA
  lockCta:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.amberSoft, borderRadius: 12, borderWidth: 1, borderColor: C.amberLight, paddingHorizontal: 12, paddingVertical: 11 },
  lockIconBox:    { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  lockTitle:      { fontSize: 13, fontWeight: '700', color: '#92400e' },
  lockSub:        { fontSize: 11, fontWeight: '500', marginTop: 1 },
  lockChevron:    { fontSize: 22, fontWeight: '300' },

  // Remark row
  remarkRow:      { paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },

  // Agent banner
  agentBanner:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  agentBannerTxt: { fontSize: 12, fontWeight: '600', flex: 1 },
});

// ─── Skeleton Card ────────────────────────────────────────────────────────────
const SkeletonCard = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const bg = theme.mode === 'dark' ? '#1e293b' : '#f1f5f9';
  return (
    <View style={[wc.card, { backgroundColor: theme.colors.card }]}>
      <View style={[wc.accentBar, { backgroundColor: bg }]} />
      <View style={{ flex: 1, padding: 16, flexDirection: 'row', gap: 14 }}>
        <View style={[wc.avatarFallback, { backgroundColor: bg }]} />
        <View style={{ flex: 1, gap: 10 }}>
          <View style={{ height: 16, borderRadius: 8, backgroundColor: bg, width: '65%' }} />
          <View style={{ height: 12, borderRadius: 6, backgroundColor: bg, width: '40%' }} />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <View style={{ height: 22, width: 54, borderRadius: 6, backgroundColor: bg }} />
            <View style={{ height: 22, width: 54, borderRadius: 6, backgroundColor: bg }} />
            <View style={{ height: 22, width: 70, borderRadius: 6, backgroundColor: bg }} />
          </View>
        </View>
      </View>
      <View style={{ height: 44, backgroundColor: bg, margin: 12, borderRadius: 12 }} />
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
type Nav = NativeStackNavigationProp<MainStackParamList>;
interface FullUserProfile { isSubscribed?: boolean; subscriptionExpery?: string; employerType?: string }

export const WorkerSearchScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state: authState } = useAuth();
  const user = authState.session?.user;
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<MainStackParamList, 'WorkerSearch'>>();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const statusBarH = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

  const initialCat = route.params?.workType ?? '';
  const userState  = user?.state ?? '';

  const [appliedFilters, setAppliedFilters] = useState<WorkerFilters>({
    ...EMPTY_FILTERS, workerType: initialCat, state: userState,
  });
  const [showFilters,      setShowFilters]      = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);

  const [unlockedPhones, setUnlockedPhones] = useState<Record<string, string>>({});
  const [loadingUnlock,  setLoadingUnlock]  = useState<Record<string, boolean>>({});
  const [callStatus,     setCallStatus]     = useState<Record<string, string>>({});
  const [savingRemark,   setSavingRemark]   = useState<Record<string, boolean>>({});

  // Profile + subscription
  const profileQuery = useQuery({
    queryKey: ['search-user-profile'],
    queryFn: async () => {
      const { apiClient } = await import('../../../core/api/client');
      const res = await apiClient.get<{ user?: FullUserProfile }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
  const profile      = profileQuery.data;
  const isSubscribed = profile?.isSubscribed === true;

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
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useInfiniteQuery({
      queryKey: ['workers-infinite', appliedFilters],
      queryFn: ({ pageParam = 1 }: { pageParam: number }) =>
        workerApi.getAllAgents({
          workerType: (appliedFilters.subCategory || appliedFilters.workerType) || undefined,
          state:       appliedFilters.state      || undefined,
          district:    appliedFilters.district   || undefined,
          block:       appliedFilters.tehsil     || undefined,
          gender:      appliedFilters.gender     || undefined,
          workerGroup: appliedFilters.workerGroup|| undefined,
          minAge:      appliedFilters.ageMin ? Number(appliedFilters.ageMin) : undefined,
          maxAge:      appliedFilters.ageMax ? Number(appliedFilters.ageMax) : undefined,
          page: pageParam, limit: PAGE_LIMIT,
        }),
      initialPageParam: 1,
      getNextPageParam: (lastPage, allPages) => {
        const next = allPages.length + 1;
        return next <= lastPage.pages ? next : undefined;
      },
      staleTime: 2 * 60 * 1000,
    });

  const allAgents: RawAgent[] = useMemo(() => data?.pages.flatMap((p) => p.rawAgents) ?? [], [data]);
  const totalCount        = data?.pages[0]?.total ?? 0;
  const activeFilterCount = countActive(appliedFilters);

  const handleApply = useCallback((f: WorkerFilters): void => {
    if (!isSubscribed && countActive(f) > 0) { setShowSubscription(true); return; }
    setAppliedFilters(f);
    setShowFilters(false);
  }, [isSubscribed]);

  const handleViewContact = async (agentId: string): Promise<void> => {
    if (loadingUnlock[agentId] || unlockedPhones[agentId]) return;
    try {
      setLoadingUnlock((p) => ({ ...p, [agentId]: true }));
      const res = await workerApi.unlockNumber(agentId);
      if (res.phone) setUnlockedPhones((p) => ({ ...p, [agentId]: res.phone }));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg === 'Contact limit exhausted') {
        Alert.alert('Contact Limit Reached', 'You have reached your contact unlock limit. Please upgrade your plan.', [
          { text: 'View Plans', onPress: () => setShowSubscription(true) },
          { text: 'Dismiss', style: 'cancel' },
        ]);
      } else {
        Alert.alert('Error', msg ?? 'Failed to unlock contact. Please try again.');
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
    } catch {
      Alert.alert('Error', 'Failed to save call outcome.');
    } finally {
      setSavingRemark((p) => ({ ...p, [agentId]: false }));
    }
  };

  const employerType = (() => {
    const l = String(profile?.employerType ?? '').toLowerCase();
    if (l.includes('industry'))   return 'industry' as const;
    if (l.includes('agency'))     return 'agency' as const;
    if (l.includes('contractor')) return 'contractor' as const;
    return 'individual' as const;
  })();

  // Active filter labels for pill bar
  const activePills: Array<{ key: string; label: string; onRemove: () => void }> = [
    appliedFilters.workerType  && { key: 'wt',  label: appliedFilters.workerType,  onRemove: () => setAppliedFilters((p) => ({ ...p, workerType: '', subCategory: '' })) },
    appliedFilters.subCategory && { key: 'sc',  label: appliedFilters.subCategory, onRemove: () => setAppliedFilters((p) => ({ ...p, subCategory: '' })) },
    appliedFilters.state       && { key: 'st',  label: appliedFilters.state,        onRemove: () => setAppliedFilters((p) => ({ ...p, state: userState, district: '', tehsil: '' })) },
    appliedFilters.district    && { key: 'di',  label: appliedFilters.district,     onRemove: () => setAppliedFilters((p) => ({ ...p, district: '', tehsil: '' })) },
    appliedFilters.tehsil      && { key: 'te',  label: appliedFilters.tehsil,       onRemove: () => setAppliedFilters((p) => ({ ...p, tehsil: '' })) },
    appliedFilters.gender      && { key: 'ge',  label: appliedFilters.gender,       onRemove: () => setAppliedFilters((p) => ({ ...p, gender: '' })) },
    appliedFilters.workerGroup && { key: 'wg',  label: appliedFilters.workerGroup === 'group' ? 'Group / Agent' : 'Individual', onRemove: () => setAppliedFilters((p) => ({ ...p, workerGroup: '' })) },
    (appliedFilters.ageMin || appliedFilters.ageMax) && {
      key: 'age',
      label: `Age ${appliedFilters.ageMin || '0'}–${appliedFilters.ageMax || '∞'}`,
      onRemove: () => setAppliedFilters((p) => ({ ...p, ageMin: '', ageMax: '' })),
    },
  ].filter(Boolean) as Array<{ key: string; label: string; onRemove: () => void }>;

  return (
    <View style={[sc.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={[sc.header, { paddingTop: insets.top + statusBarH + 14 }]}>
        {/* Left: back-inspired icon + text */}
        <View style={sc.headerLeft}>
          <AppText style={sc.headerTitle}>Workers & Agents</AppText>
          <AppText style={sc.headerSub} numberOfLines={1}>
            {isLoading
              ? 'Searching for professionals…'
              : appliedFilters.state
                ? `Showing results in ${appliedFilters.state}`
                : 'All India · All professionals'}
          </AppText>
        </View>

        {/* Filter button */}
        <TouchableOpacity
          onPress={() => setShowFilters(true)}
          activeOpacity={0.85}
          style={[sc.filterBtn, activeFilterCount > 0 && sc.filterBtnActive]}
        >
          <AppText style={[sc.filterIcon, activeFilterCount > 0 && { color: C.white }]}>⊟</AppText>
          <AppText style={[sc.filterTxt, activeFilterCount > 0 && { color: C.white }]}>
            {activeFilterCount > 0 ? `Filters  ${activeFilterCount}` : 'Filters'}
          </AppText>
        </TouchableOpacity>
      </View>

      {/* ── Active filter pills ──────────────────────────────────────────── */}
      {activePills.length > 0 && (
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={[sc.pillsBar, { borderBottomColor: C.border, backgroundColor: theme.colors.background }]}
          contentContainerStyle={sc.pillsContent}
        >
          {activePills.map((pill) => (
            <TouchableOpacity key={pill.key} onPress={pill.onRemove} activeOpacity={0.75} style={sc.pill}>
              <AppText style={sc.pillTxt} numberOfLines={1}>{pill.label}</AppText>
              <AppText style={sc.pillClose}>×</AppText>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setAppliedFilters({ ...EMPTY_FILTERS, state: userState })}
            style={sc.pillClear}
          >
            <AppText style={sc.pillClearTxt}>Clear all</AppText>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <ScrollView contentContainerStyle={sc.list} showsVerticalScrollIndicator={false}>
          {Array.from({ length: 5 }, (_, i) => <SkeletonCard key={i} />)}
        </ScrollView>
      ) : isError ? (
        <View style={sc.stateBox}>
          <View style={sc.errorIcon}>
            <AppText style={{ fontSize: 26, color: C.red }}>!</AppText>
          </View>
          <AppText style={[sc.stateTitle, { color: theme.colors.text }]}>Unable to Load</AppText>
          <AppText style={[sc.stateBody, { color: C.slate }]}>
            Something went wrong. Check your connection and try again.
          </AppText>
          <TouchableOpacity onPress={() => void refetch()} style={sc.primaryBtn}>
            <AppText style={sc.primaryBtnTxt}>Retry</AppText>
          </TouchableOpacity>
        </View>
      ) : allAgents.length === 0 ? (
        <View style={sc.stateBox}>
          <View style={[sc.emptyIcon, { backgroundColor: C.blueSoft }]}>
            <AppText style={{ fontSize: 28 }}>⌕</AppText>
          </View>
          <AppText style={[sc.stateTitle, { color: theme.colors.text }]}>No Results Found</AppText>
          <AppText style={[sc.stateBody, { color: C.slate }]}>
            {activeFilterCount > 0
              ? 'No workers match the selected filters. Try broadening your search.'
              : 'No workers are available in this area right now.'}
          </AppText>
          {activeFilterCount > 0 && (
            <TouchableOpacity
              onPress={() => setAppliedFilters({ ...EMPTY_FILTERS, state: userState })}
              style={[sc.primaryBtn, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.blue }]}
            >
              <AppText style={[sc.primaryBtnTxt, { color: C.blue }]}>Clear Filters</AppText>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={allAgents}
          keyExtractor={(item) => item._id}
          contentContainerStyle={sc.list}
          showsVerticalScrollIndicator={false}
          // ── Smooth auto-pagination ──
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) void fetchNextPage(); }}
          onEndReachedThreshold={0.8}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={12}
          removeClippedSubviews={Platform.OS === 'android'}
          renderItem={({ item }) => (
            <AgentCard
              agent={item}
              isSubscribed={isSubscribed}
              unlockedPhone={unlockedPhones[item._id]}
              loadingUnlock={loadingUnlock[item._id] ?? false}
              callStatus={callStatus[item._id] ?? ''}
              savingRemark={savingRemark[item._id] ?? false}
              workerTypeApplied={appliedFilters.workerType}
              onViewContact={() => void handleViewContact(item._id)}
              onSubscribe={() => setShowSubscription(true)}
              onSaveRemark={(id, status) => void handleSaveRemark(id, status)}
              onPress={() => navigation.navigate('WorkerProfile', { workerId: item._id })}
            />
          )}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={sc.loadMore}>
                <ActivityIndicator size="small" color={C.blue} />
                <AppText style={[sc.loadMoreTxt, { color: C.slate }]}>Loading more…</AppText>
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

      {/* ── Subscription Modal ────────────────────────────────────────────── */}
      <SubscriptionModal
        visible={showSubscription}
        onClose={() => setShowSubscription(false)}
        employerType={employerType}
        employerId={user?.id}
        employerName={user?.fullName}
        email={user?.email}
        employerPhone={user?.phone}
      />
    </View>
  );
};

// ─── Screen styles ────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, gap: 12, backgroundColor: C.navy },
  headerLeft:      { flex: 1 },
  headerTitle:     { fontSize: 19, fontWeight: '800', color: C.white, marginBottom: 3 },
  headerSub:       { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  filterBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  filterBtnActive: { backgroundColor: C.blue, borderColor: C.blue },
  filterIcon:      { fontSize: 15, color: 'rgba(255,255,255,0.8)' },
  filterTxt:       { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },

  // Filter pills
  pillsBar:        { flexGrow: 0, borderBottomWidth: 1 },
  pillsContent:    { paddingHorizontal: 14, paddingVertical: 9, gap: 7, flexDirection: 'row' },
  pill:            { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.blueSoft, borderRadius: 20, borderWidth: 1, borderColor: '#bfdbfe', paddingHorizontal: 11, paddingVertical: 5 },
  pillTxt:         { fontSize: 12, fontWeight: '600', color: C.blue, maxWidth: 120 },
  pillClose:       { fontSize: 16, fontWeight: '600', color: '#60a5fa', lineHeight: 18 },
  pillClear:       { borderRadius: 20, borderWidth: 1, borderColor: '#fca5a5', backgroundColor: '#fff1f2', paddingHorizontal: 11, paddingVertical: 5 },
  pillClearTxt:    { fontSize: 12, fontWeight: '700', color: C.red },

  // List
  list:            { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 32 },

  // Loading more spinner
  loadMore:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 20 },
  loadMoreTxt:     { fontSize: 13 },

  // Empty / error states
  stateBox:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  errorIcon:       { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fee2e2', borderWidth: 2, borderColor: '#fca5a5', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyIcon:       { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stateTitle:      { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  stateBody:       { fontSize: 13, textAlign: 'center', lineHeight: 20, color: C.slate },
  primaryBtn:      { marginTop: 8, backgroundColor: C.navy, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 13 },
  primaryBtnTxt:   { color: C.white, fontWeight: '800', fontSize: 14 },
});
