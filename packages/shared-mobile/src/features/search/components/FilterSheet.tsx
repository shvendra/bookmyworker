import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { categoryValuesForWorkerTier } from '../../../shared/data/supportStaffCategories';
import { indianStates } from '../../../shared/data/stateDistrict';
import { getLocationDisplayName } from '../../../shared/data/locationTranslations';
import i18n from '../../../core/i18n';
import { useFilterResultCount } from '../hooks/useFilterResultCount';
import {
  BRAND, BORDER, WHITE, SLATE,
  CATEGORIES,
  catDisplay, subcatDisplay,
  countActive,
  EMPTY_FILTERS,
  type WorkerFilters,
} from './workerSearchShared';

// ─── Filter Sheet ─────────────────────────────────────────────────────────────
export const FilterSheet = ({
  visible,
  initial,
  onApply,
  onClose,
  userState,
  userDistrict,
  lockState = false,
  lockDistrict = false,
  resetDistrict = '',
}: {
  visible: boolean;
  initial: WorkerFilters;
  userState: string;
  userDistrict?: string;
  /** Plan locks the state to the user's own (district/state scope). */
  lockState?: boolean;
  /** Plan locks the district to the user's own (district scope only). */
  lockDistrict?: boolean;
  /** District that Reset returns to (a district-plan employer's own; '' otherwise). */
  resetDistrict?: string;
  onApply: (f: WorkerFilters) => void;
  onClose: () => void;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [f, setF] = useState<WorkerFilters>(initial);

  // Tapping a plan-locked location field explains the limit + nudges an upgrade,
  // instead of silently doing nothing. District-plan shows the district message;
  // state-plan shows the state message. Fully translated (employer namespace).
  const handleLockedAttempt = (): void => {
    if (lockDistrict) {
      toast.error(t('pl_scopeDistrict', {
        district: userDistrict ? getLocationDisplayName(userDistrict, 'district', i18n.language) : '',
      }));
    } else {
      toast.error(t('pl_scopeState', {
        state: userState ? getLocationDisplayName(userState, 'state', i18n.language) : '',
      }));
    }
  };
  const [section, setSection] = useState<SectionKey>('state');
  const lastVisible = useRef(false);
  if (visible && !lastVisible.current) { setF(initial); setSection(lockState ? 'cat' : 'state'); }
  lastVisible.current = visible;

  const set = <K extends keyof WorkerFilters>(k: K, v: WorkerFilters[K]): void => {
    setF((prev) => {
      const next = { ...prev, [k]: v };
      if (k === 'state') { next.district = ''; next.tehsil = ''; }
      if (k === 'district') { next.tehsil = ''; }
      if (k === 'workerType') { next.subCategory = ''; }
      // Switching qualification tier flips the category source (Diploma/Graduate →
      // Support Staff), so any prior category/sub-category pick must be cleared.
      if (k === 'qualification') { next.workerType = ''; next.subCategory = ''; }
      return next;
    });
  };

  // Multi-select fields (district, subCategory) are stored as comma-joined strings
  // (the backend parses them). Toggle one value in/out; '' (the "All" option) clears.
  const toggleMulti = <K extends keyof WorkerFilters>(k: K) => (val: string): void => {
    if (val === '') { set(k, '' as WorkerFilters[K]); return; }
    setF((prev) => {
      const cur = String(prev[k] ?? '');
      const list = cur ? cur.split(',').map((s) => s.trim()).filter(Boolean) : [];
      const nextList = list.includes(val) ? list.filter((x) => x !== val) : [...list, val];
      const next = { ...prev, [k]: nextList.join(',') } as WorkerFilters;
      if (k === 'district') { next.tehsil = ''; }
      return next;
    });
  };
  // "District A +2" summary for a comma-joined multi value.
  const multiSummary = (csv: string, labelFor: (v: string) => string): string => {
    const list = csv ? csv.split(',').map((s) => s.trim()).filter(Boolean) : [];
    if (list.length === 0) return '';
    if (list.length === 1) return labelFor(list[0]);
    return `${labelFor(list[0])} +${list.length - 1}`;
  };
  // Tehsil/Block only applies when exactly ONE district is selected.
  const oneDistrict = !!f.district && !f.district.includes(',');

  const stateList    = useMemo(() => Object.keys(indianStates).sort(), []);
  const districtList = useMemo(
    () => (f.state ? Object.keys(indianStates[f.state] ?? {}).sort() : []),
    [f.state],
  );
  const tehsilList = useMemo(
    () =>
      f.state && f.district && !f.district.includes(',')
        ? (indianStates[f.state]?.[f.district] ?? []).sort()
        : [],
    [f.state, f.district],
  );
  // Tier-aware category list: Diploma/Graduate → Support Staff taxonomy; every
  // other qualification (and none) → regular worker categories. Mirrors the CRM
  // worker filter + the register screen.
  const availableCats = useMemo(() => {
    const allowed = new Set(
      categoryValuesForWorkerTier(f.qualification, CATEGORIES.map((c) => c.value)),
    );
    return CATEGORIES.filter((c) => allowed.has(c.value));
  }, [f.qualification]);
  const catLabels = useMemo(() => availableCats.map((c) => c.label), [availableCats]);
  // Sub-category options are VALUES (not labels) — the backend matches workers by
  // value; subcatDisplay() renders the per-language label for display.
  const subCatValues = useMemo(
    () =>
      availableCats.find((c) => c.label === f.workerType)?.subcategories?.map(
        (s) => s.value,
      ) ?? [],
    [availableCats, f.workerType],
  );

  // The home state / locked location is a default, not a user-chosen filter — exclude it
  // from the "active filters" count so Reset visibly clears to zero.
  const activeCount =
    countActive(f)
    - ((lockState || f.state === userState) && f.state ? 1 : 0)
    - ((lockDistrict || (!!resetDistrict && f.district === resetDistrict)) && f.district ? 1 : 0);

  const resultCount = useFilterResultCount(f, visible);

  const handleReset = (): void =>
    setF({ ...EMPTY_FILTERS, state: userState ?? '', district: lockDistrict ? (userDistrict ?? '') : resetDistrict });

  // ── Two-pane layout: left rail = filter groups (with selected-count badges), right pane = that group's options ──
  const listOf = (csv: string): string[] => (csv ? csv.split(',').map((x) => x.trim()).filter(Boolean) : []);
  const sections: Array<{ key: SectionKey; label: string; icon: string; count: number; locked?: boolean }> = [
    { key: 'state',    label: t('ws_state'),             icon: 'map-outline',        count: f.state ? 1 : 0, locked: lockState },
    { key: 'district', label: t('ws_district'),          icon: 'location-outline',   count: listOf(f.district).length, locked: lockDistrict },
    ...((oneDistrict || f.tehsil) ? [{ key: 'tehsil' as SectionKey, label: t('ws_tehsil_block'), icon: 'business-outline', count: f.tehsil ? 1 : 0 }] : []),
    { key: 'cat',      label: t('ws_category'),          icon: 'briefcase-outline',  count: f.workerType ? 1 : 0 },
    ...((f.workerType && subCatValues.length > 0) ? [{ key: 'subcat' as SectionKey, label: t('ws_sub_category'), icon: 'git-branch-outline', count: listOf(f.subCategory).length }] : []),
    { key: 'ptype',    label: t('ws_professional_type'), icon: 'people-outline',     count: f.workerGroup ? 1 : 0 },
    { key: 'gender',   label: t('ws_gender'),            icon: 'male-female-outline', count: f.gender ? 1 : 0 },
    { key: 'age',      label: t('ws_age_range'),         icon: 'hourglass-outline',  count: (f.ageMin ? 1 : 0) + (f.ageMax ? 1 : 0) },
    { key: 'qual',     label: t('ws_qualification'),     icon: 'school-outline',     count: f.qualification ? 1 : 0 },
    { key: 'resume',   label: t('ws_has_resume'),        icon: 'document-text-outline', count: f.hasResume ? 1 : 0 },
  ];
  // The chosen section can disappear (e.g. Sub-category after clearing Category) → fall back to the first.
  const activeSection: SectionKey = sections.some((x) => x.key === section) ? section : 'state';
  const activeLabel = sections.find((x) => x.key === activeSection)?.label ?? '';

  const radio = (key: keyof WorkerFilters) => (v: string): void => set(key, v as never);
  const genderOpts = ['Male', 'Female', 'Other'];
  const genderLabel = (v: string): string => (v === 'Male' ? t('ws_male') : v === 'Female' ? t('ws_female') : t('ws_other'));
  const ptypeLabel = (v: string): string => (v === 'individual' ? t('ws_individual_worker') : t('ws_agent_group'));
  const qualLabel = (v: string): string => (v === 'Diploma/Graduate' ? t('ws_diploma_graduate') : t('ws_school_iti'));

  let pane: React.JSX.Element;
  switch (activeSection) {
    case 'state':
      pane = (
        <OptionList options={stateList} selected={f.state} onToggle={(v) => (lockState ? handleLockedAttempt() : set('state', v))}
          allLabel={t('ws_all_states_opt')} labelFor={(n) => getLocationDisplayName(n, 'state', i18n.language)} searchable />
      );
      break;
    case 'district':
      pane = f.state ? (
        <OptionList options={districtList} selected={f.district} multiple onToggle={(v) => (lockDistrict ? handleLockedAttempt() : toggleMulti('district')(v))}
          allLabel={t('ws_all_districts_opt')} labelFor={(n) => getLocationDisplayName(n, 'district', i18n.language)} searchable />
      ) : <PaneHint text={t('ws_select_state_first')} />;
      break;
    case 'tehsil':
      pane = oneDistrict ? (
        <OptionList options={tehsilList} selected={f.tehsil} onToggle={radio('tehsil')}
          allLabel={t('ws_all_blocks_opt')} labelFor={(n) => getLocationDisplayName(n, 'block', i18n.language)} searchable />
      ) : <PaneHint text={t('ws_select_district_first')} />;
      break;
    case 'cat':
      pane = <OptionList options={catLabels} selected={f.workerType} onToggle={radio('workerType')} allLabel={t('ws_all_categories_opt')} labelFor={catDisplay} />;
      break;
    case 'subcat':
      pane = <OptionList options={subCatValues} selected={f.subCategory} multiple onToggle={toggleMulti('subCategory')} allLabel={t('ws_all_sub_categories_opt')} labelFor={subcatDisplay} searchable />;
      break;
    case 'ptype':
      pane = <OptionList options={['individual', 'group']} selected={f.workerGroup} onToggle={radio('workerGroup')} allLabel={t('ws_all_opt')} labelFor={ptypeLabel} />;
      break;
    case 'gender':
      pane = <OptionList options={genderOpts} selected={f.gender} onToggle={radio('gender')} allLabel={t('ws_all_opt')} labelFor={genderLabel} />;
      break;
    case 'qual':
      pane = <OptionList options={['10th/12th/ITI', 'Diploma/Graduate']} selected={f.qualification} onToggle={radio('qualification')} allLabel={t('ws_all_opt')} labelFor={qualLabel} />;
      break;
    case 'resume':
      pane = (
        <View style={{ padding: 4 }}>
          <TouchableOpacity accessibilityRole="switch" accessibilityState={{ checked: f.hasResume }} activeOpacity={0.8}
            onPress={() => set('hasResume', !f.hasResume)}
            style={[fsh.optRow, { borderColor: f.hasResume ? BRAND : theme.colors.border, backgroundColor: f.hasResume ? BRAND + '0F' : theme.colors.card }]}>
            <View style={{ flex: 1 }}>
              <AppText style={[fsh.optTxt, { color: f.hasResume ? BRAND : theme.colors.text }]}>{t('ws_has_resume')}</AppText>
              <AppText style={[fsh.typeSub, { color: theme.colors.mutedText }]}>{t('ws_has_resume_sub')}</AppText>
            </View>
            <View style={[fsh.check, { borderColor: f.hasResume ? BRAND : theme.colors.border, backgroundColor: f.hasResume ? BRAND : 'transparent' }]}>
              {f.hasResume && <AppText style={{ color: WHITE, fontSize: 11, fontWeight: '900' }}>✓</AppText>}
            </View>
          </TouchableOpacity>
        </View>
      );
      break;
    default: // age
      pane = (
        <View style={fsh.ageGrid}>
          {([['ageMin', t('ws_from'), '18'], ['ageMax', t('ws_to'), '60']] as const).map(([k, lbl, ph]) => (
            <View key={k} style={{ flex: 1 }}>
              <AppText style={[fsh.ageColLabel, { color: theme.colors.mutedText }]}>{lbl}</AppText>
              <View style={[fsh.ageBox, { borderColor: f[k] ? BRAND : theme.colors.border, backgroundColor: f[k] ? theme.colors.primaryLight : theme.colors.surface1 }]}>
                <TextInput
                  value={f[k]}
                  onChangeText={(v: string) => set(k, v.replace(/\D/g, ''))}
                  placeholder={ph}
                  placeholderTextColor={SLATE}
                  keyboardType="number-pad"
                  maxLength={3}
                  style={[fsh.ageBoxInput, { color: theme.colors.text }]}
                />
                <View style={[fsh.ageSuffixBox, { borderLeftColor: f[k] ? BRAND + '30' : theme.colors.border }]}>
                  <AppText style={[fsh.ageSuffixTxt, { color: f[k] ? BRAND : theme.colors.mutedText }]}>{t('ws_yrs')}</AppText>
                </View>
              </View>
            </View>
          ))}
        </View>
      );
  }

  const applyLabel = resultCount === null
    ? (activeCount > 0 ? t('ws_apply_count', { count: activeCount }) : t('ws_apply_filters'))
    : resultCount === 0 ? t('ws_no_workers_match') : t('ws_show_workers', { count: resultCount });

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
              <TouchableOpacity accessibilityRole="button" onPress={handleReset} style={fsh.resetBtn}>
                <AppText style={fsh.resetTxt}>{t('ws_reset')}</AppText>
              </TouchableOpacity>
            )}
            <TouchableOpacity accessibilityRole="button" onPress={onClose} style={fsh.closeBtn}>
              <AppText style={fsh.closeTxt}>✕</AppText>
            </TouchableOpacity>
          </View>
        </View>

        <View style={fsh.split}>
          {/* ── Left rail: filter groups ─────────────────────────────────── */}
          <View style={[fsh.rail, { borderRightColor: BORDER }]}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={fsh.railContent} showsVerticalScrollIndicator={false}>
            {sections.map((sec) => {
              const on = sec.key === activeSection;
              return (
                <TouchableOpacity
                  key={sec.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  activeOpacity={0.8}
                  onPress={() => setSection(sec.key)}
                  style={[fsh.railItem, on && [fsh.railItemOn, { backgroundColor: theme.colors.card, borderColor: BRAND + '33' }]]}
                >
                  <Ionicons name={sec.icon as never} size={18} color={on ? BRAND : theme.colors.mutedText} />
                  <AppText style={[fsh.railTxt, { color: on ? BRAND : theme.colors.text }]} numberOfLines={2}>{sec.label}</AppText>
                  {sec.locked ? <Ionicons name="lock-closed" size={11} color={theme.colors.mutedText} />
                    : sec.count > 0 ? <View style={fsh.badge}><AppText style={fsh.badgeTxt}>{sec.count}</AppText></View> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          </View>

          {/* ── Right pane: options of the selected group ────────────────── */}
          <View style={fsh.pane}>
            <AppText style={[fsh.paneTitle, { color: theme.colors.text }]} numberOfLines={1}>{activeLabel}</AppText>
            {(lockState || lockDistrict) && (activeSection === 'state' || activeSection === 'district') && (
              <AppText style={[fsh.lockHint, { color: theme.colors.mutedText }]}>🔒 {t('ws_scope_locked')}</AppText>
            )}
            {/* keyed so each group gets its own list/search state */}
            <View key={activeSection} style={{ flex: 1 }}>{pane}</View>
          </View>
        </View>

        {/* ── Footer: live result count on the apply button ──────────────── */}
        <View style={[fsh.footer, { borderTopColor: BORDER, backgroundColor: theme.colors.background }]}>
          <TouchableOpacity accessibilityRole="button" onPress={onClose} style={[fsh.cancelBtn, { borderColor: theme.colors.border }]} activeOpacity={0.8}>
            <AppText style={[fsh.cancelTxt, { color: theme.colors.text }]}>{t('ws_cancel')}</AppText>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => onApply(f)} style={fsh.applyBtn} activeOpacity={0.88} testID="filter-apply">
            <AppText style={fsh.applyTxt} numberOfLines={1}>{applyLabel}</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

type SectionKey = 'state' | 'district' | 'tehsil' | 'cat' | 'subcat' | 'ptype' | 'gender' | 'age' | 'qual' | 'resume';

const PaneHint = ({ text }: { text: string }): React.JSX.Element => {
  const { theme } = useAppTheme();
  return <AppText style={[fsh.paneHint, { color: theme.colors.mutedText }]}>{text}</AppText>;
};

/** Right-pane option list: radio (single) or checkbox (multiple) rows, with an optional search box. */
const OptionList = ({
  options, selected, onToggle, allLabel, labelFor, multiple = false, searchable = false,
}: {
  options: string[];
  selected: string;
  onToggle: (v: string) => void;
  allLabel: string;
  labelFor?: (v: string) => string;
  multiple?: boolean;
  searchable?: boolean;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const [q, setQ] = useState('');
  const display = (o: string): string => (labelFor ? labelFor(o) : o);
  const picked = multiple ? selected.split(',').map((x) => x.trim()).filter(Boolean) : [];
  const needle = q.trim().toLowerCase();
  const shown = needle ? options.filter((o) => o.toLowerCase().includes(needle) || display(o).toLowerCase().includes(needle)) : options;
  return (
    <View style={{ flex: 1 }}>
      {searchable && (
        <View style={[fsh.searchWrap, { backgroundColor: theme.colors.surface1, borderColor: theme.colors.border }]}>
          <Ionicons name="search" size={16} color={theme.colors.mutedText} style={{ marginLeft: 10 }} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t('ws_search_placeholder')}
            placeholderTextColor={SLATE}
            style={[fsh.searchInput, { color: theme.colors.text }]}
          />
          {q.length > 0 && (
            <TouchableOpacity accessibilityRole="button" onPress={() => setQ('')} style={{ paddingHorizontal: 8 }}>
              <Ionicons name="close-circle" size={16} color={theme.colors.mutedText} />
            </TouchableOpacity>
          )}
        </View>
      )}
      <FlatList
        removeClippedSubviews={false}
        data={needle ? shown : [allLabel, ...shown]}
        keyExtractor={(item: string) => item}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
        renderItem={({ item }: { item: string }) => {
          const isAll = !needle && item === allLabel;
          const val = isAll ? '' : item;
          const active = multiple ? (val === '' ? picked.length === 0 : picked.includes(val)) : selected === val;
          return (
            <TouchableOpacity
              accessibilityRole={multiple ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: active }}
              activeOpacity={0.8}
              onPress={() => onToggle(val)}
              style={[fsh.optRow, { borderColor: active ? BRAND : theme.colors.border, backgroundColor: active ? BRAND + '0F' : theme.colors.card }]}
            >
              <AppText style={[fsh.optTxt, { color: active ? BRAND : theme.colors.text }]} numberOfLines={2}>{isAll ? item : display(item)}</AppText>
              <View style={[fsh.check, multiple ? null : fsh.radio, { borderColor: active ? BRAND : theme.colors.border, backgroundColor: active ? BRAND : 'transparent' }]}>
                {active && <AppText style={{ color: WHITE, fontSize: 11, fontWeight: '900' }}>✓</AppText>}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};
const fsh = StyleSheet.create({
  root:          { flex: 1 },

  // Two-pane body
  split:         { flex: 1, flexDirection: 'row' },
  // Rail is a full-height tinted column (reaches the footer); items are inset rounded tabs.
  rail:          { width: 118, flexGrow: 0, alignSelf: 'stretch', backgroundColor: BRAND + '0D', borderRightWidth: StyleSheet.hairlineWidth },
  railContent:   { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 16, gap: 6 },
  railItem:      { paddingVertical: 12, paddingHorizontal: 10, gap: 6, alignItems: 'flex-start', borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  railItemOn:    { elevation: 2, shadowColor: '#142250', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 6 },
  railTxt:       { fontSize: 12.5, fontWeight: '800', lineHeight: 16 },
  badge:         { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeTxt:      { color: '#fff', fontSize: 10.5, fontWeight: '900' },
  pane:          { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  paneTitle:     { fontSize: 16, fontWeight: '900', marginBottom: 12 },
  paneHint:      { fontSize: 13, fontWeight: '600', lineHeight: 19, marginTop: 6 },
  searchWrap:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1.2, borderRadius: 12, height: 44, marginBottom: 12 },
  searchInput:   { flex: 1, paddingHorizontal: 8, fontSize: 13.5, fontWeight: '600' },
  optRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.4, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  optTxt:        { flex: 1, fontSize: 13.5, fontWeight: '700' },
  check:         { width: 22, height: 22, borderRadius: 6, borderWidth: 1.8, alignItems: 'center', justifyContent: 'center' },
  radio:         { borderRadius: 11 },


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
  body:          { padding: 14, gap: 14, paddingBottom: 28 },
  card:          { borderRadius: 20, borderWidth: 1, padding: 16, elevation: 1, shadowColor: '#142250', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 16 },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardIcon:      { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle:     { fontSize: 14, fontWeight: '800', letterSpacing: 0.1 },
  resumeToggle:  { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
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
