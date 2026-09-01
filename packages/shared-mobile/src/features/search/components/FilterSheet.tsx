import React, { useMemo, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { categoryValuesForWorkerTier } from '../../../shared/data/supportStaffCategories';
import { indianStates } from '../../../shared/data/stateDistrict';
import { getLocationDisplayName } from '../../../shared/data/locationTranslations';
import i18n from '../../../core/i18n';
import { DropField } from './DropField';
import { PickerModal } from './PickerModal';
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
              <View style={[fsh.cardIcon, { backgroundColor: '#FDECEF' }]}>
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
              onPress={() => (lockState ? handleLockedAttempt() : setPicker('state'))}
              locked={lockState}
            />
            <DropField
              label={t('ws_district')}
              value={multiSummary(f.district, (n) => getLocationDisplayName(n, 'district', i18n.language))}
              placeholder={f.state ? t('ws_select_district') : t('ws_select_state_first')}
              onPress={() => {
                if (lockDistrict) { handleLockedAttempt(); return; }
                if (f.state) setPicker('district');
              }}
              disabled={!f.state}
              locked={lockDistrict}
            />
            {(oneDistrict || f.tehsil) && (
              <DropField
                label={t('ws_tehsil_block')}
                value={f.tehsil ? getLocationDisplayName(f.tehsil, 'block', i18n.language) : ''}
                placeholder={oneDistrict ? t('ws_select_tehsil') : t('ws_select_district_first')}
                onPress={() => oneDistrict && setPicker('tehsil')}
                disabled={!oneDistrict}
              />
            )}
          </View>

          {/* ── Work Type ─────────────────────────────────────────────── */}
          <View style={[fsh.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
            <View style={fsh.cardHeader}>
              <View style={[fsh.cardIcon, { backgroundColor: '#F3EEE6' }]}>
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
            {/* Sub-category — appears once a category is chosen; lists that
                category's sub-skills (Support Staff sub-roles for Diploma/Graduate). */}
            {f.workerType && subCatValues.length > 0 && (
              <DropField
                label={t('ws_sub_category')}
                value={multiSummary(f.subCategory, subcatDisplay)}
                placeholder={t('ws_all_sub_categories')}
                onPress={() => setPicker('subcat')}
              />
            )}
          </View>

          {/* ── Professional Type ─────────────────────────────────────── */}
          <View style={[fsh.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
            <View style={fsh.cardHeader}>
              <View style={[fsh.cardIcon, { backgroundColor: '#EBF8F0' }]}>
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
                    <AppText style={[fsh.typeLabel, { color: active ? WHITE : theme.colors.text }]}>{opt.label}</AppText>
                    <AppText style={[fsh.typeSub, { color: active ? 'rgba(255,255,255,0.65)' : theme.colors.mutedText }]}>{opt.sub}</AppText>
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
              <View style={[fsh.cardIcon, { backgroundColor: '#FDECEF' }]}>
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
              <View style={[fsh.cardIcon, { backgroundColor: '#FDF5E8' }]}>
                <AppText style={{ fontSize: 14 }}>🎓</AppText>
              </View>
              <AppText style={[fsh.cardTitle, { color: theme.colors.text }]}>{t('ws_qualification')}</AppText>
            </View>
            <View style={fsh.typeGrid}>
              {/* Only the two education tiers. Skilled/Unskilled are skill levels (not
                  qualifications); the legacy ITI/Diploma & Graduate are migrated to these. */}
              {[
                { label: t('ws_school_iti'),       sub: t('ws_certificate_holders'), val: '10th/12th/ITI',   icon: '🎓' },
                { label: t('ws_diploma_graduate'), sub: t('ws_bachelors_above'),     val: 'Diploma/Graduate', icon: '📜' },
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
                    <AppText style={[fsh.typeLabel, { color: active ? WHITE : theme.colors.text }]}>{opt.label}</AppText>
                    <AppText style={[fsh.typeSub, { color: active ? 'rgba(255,255,255,0.65)' : theme.colors.mutedText }]}>{opt.sub}</AppText>
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

          {/* ── Has Resume ────────────────────────────────────────────────── */}
          <View style={[fsh.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
            <TouchableOpacity
              onPress={() => set('hasResume', !f.hasResume)}
              activeOpacity={0.8}
              style={fsh.cardHeader}
              accessibilityRole="switch"
              accessibilityState={{ checked: f.hasResume }}
            >
              <View style={[fsh.cardIcon, { backgroundColor: '#EAF7EF' }]}>
                <AppText style={{ fontSize: 14 }}>📄</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={[fsh.cardTitle, { color: theme.colors.text }]}>{t('ws_has_resume')}</AppText>
                <AppText style={[fsh.typeSub, { color: theme.colors.mutedText }]}>{t('ws_has_resume_sub')}</AppText>
              </View>
              <View style={[
                fsh.resumeToggle,
                { borderColor: f.hasResume ? '#16A34A' : theme.colors.border, backgroundColor: f.hasResume ? '#16A34A' : 'transparent' },
              ]}>
                {f.hasResume && <AppText style={{ color: WHITE, fontSize: 11, fontWeight: '900' }}>✓</AppText>}
              </View>
            </TouchableOpacity>
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
          options={subCatValues}
          selected={f.subCategory}
          onSelect={toggleMulti('subCategory')}
          onClose={() => setPicker(null)}
          allLabel={t('ws_all_sub_categories_opt')}
          labelFor={subcatDisplay}
          multiple
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
          onSelect={toggleMulti('district')}
          onClose={() => setPicker(null)}
          allLabel={t('ws_all_districts_opt')}
          labelFor={(name) => getLocationDisplayName(name, 'district', i18n.language)}
          multiple
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
