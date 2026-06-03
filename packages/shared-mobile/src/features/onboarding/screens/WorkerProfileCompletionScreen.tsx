import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Cross-device status bar height helper.
// On some Android devices insets.top returns 0 even though the status bar is
// visible. StatusBar.currentHeight is the reliable Android fallback.
// Math.max ensures we never clip content behind the status bar.
const getStatusBarHeight = (insetsTop: number): number =>
  Math.max(insetsTop, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0);
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../core/theme';
import { useAuth } from '../../../state/auth/AuthContext';
import { updateProfileFields } from '../../../core/api/endpoints/authApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { indianStates } from '../../../shared/data/stateDistrict';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../../app/navigation/types';
import categoriesData from '../../../shared/data/categories.json';
import { LocationSelector } from '../../../shared/components/forms/LocationSelector';

type Props = NativeStackScreenProps<MainStackParamList, 'WorkerProfileCompletion'>;

// ── Category data ─────────────────────────────────────────────────────────────
interface CatRaw {
  label: string; hindilabel?: string; marathilabel?: string; gujaratilabel?: string;
  value: string;
  subcategories: Array<{
    label: string; hindilabel?: string; marathilabel?: string; gujaratilabel?: string; value: string;
  }>;
}
const ALL_CATS: CatRaw[] = categoriesData as CatRaw[];

function getCatLabel(cat: CatRaw, lang: string): string {
  if (lang === 'hi' && cat.hindilabel) return cat.hindilabel;
  if (lang === 'mr' && cat.marathilabel) return cat.marathilabel;
  if (lang === 'gu' && cat.gujaratilabel) return cat.gujaratilabel;
  return cat.label;
}
function getSubLabel(sub: CatRaw['subcategories'][0], lang: string): string {
  if (lang === 'hi' && sub.hindilabel) return sub.hindilabel;
  if (lang === 'mr' && sub.marathilabel) return sub.marathilabel;
  if (lang === 'gu' && sub.gujaratilabel) return sub.gujaratilabel;
  return sub.label;
}

// ── Location data ─────────────────────────────────────────────────────────────

// ── Constants ─────────────────────────────────────────────────────────────────
// All districts flattened for the areasOfWork search step
const ALL_DISTRICTS: { label: string; state: string }[] = [];
Object.entries(indianStates).forEach(([stateName, districts]) => {
  Object.keys(districts).forEach((d) => ALL_DISTRICTS.push({ label: d, state: stateName }));
});

const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;
const TOTAL_STEPS = 7;
// Step 1: Gender  Step 2: Age  Step 3: Experience  Step 4: Category (multi)
// Step 5: SubCategory (multi)  Step 6: Location  Step 7: AreasOfWork (mandatory)

// ── Chip ─────────────────────────────────────────────────────────────────────
const Chip = ({ label, selected, onPress, color }: {
  label: string; selected: boolean; onPress: () => void; color: string;
}) => {
  const { theme } = useAppTheme();
  const isDark = theme.mode === 'dark';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        chipS.chip,
        selected
          ? { backgroundColor: color, borderColor: color }
          : { backgroundColor: isDark ? theme.colors.surface1 : '#F1F5F9', borderColor: isDark ? theme.colors.border : '#DDE3F0' },
      ]}
    >
      <AppText style={[chipS.text, { color: selected ? '#fff' : theme.colors.text }]}>{label}</AppText>
    </TouchableOpacity>
  );
};
const chipS = StyleSheet.create({
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8, marginBottom: 8, flexShrink: 0 },
  text: { fontSize: 13, fontWeight: '600' },
});

// ── Removable tag ─────────────────────────────────────────────────────────────
const Tag = ({ label, onRemove }: { label: string; onRemove: () => void }) => {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onRemove}
      style={[tagS.tag, { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary + '40' }]}
      activeOpacity={0.7}
    >
      <AppText style={[tagS.text, { color: theme.colors.primary }]}>{label}</AppText>
      <AppText style={[tagS.x, { color: theme.colors.primary }]}>×</AppText>
    </TouchableOpacity>
  );
};
const tagS = StyleSheet.create({
  tag:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginRight: 6, marginBottom: 6 },
  text: { fontSize: 12.5, fontWeight: '600', marginRight: 4 },
  x:    { fontSize: 16, fontWeight: '700', lineHeight: 18 },
});

// ── Location summary card (shown in step 5 once state+district are confirmed) ─
const locSummaryS = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 16, padding: 16, marginTop: 20 },
  pin:   { fontSize: 22 },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 },
  text:  { fontSize: 14, fontWeight: '700' },
  check: { fontSize: 22, fontWeight: '700' },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export const WorkerProfileCompletionScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { state, updateProfile, completeOnboarding } = useAuth();
  const isDark = theme.mode === 'dark';
  const lang = i18n.language;

  const user = state.session?.user;

  const [step, setStep] = useState(1);

  // Step 1 — Gender
  const [gender, setGender] = useState(user?.gender ?? '');

  // Step 2 — Age
  const [age, setAge] = useState(user?.dob ? String(user.dob) : '');

  // Step 3 — Work experience (in years; 0 = fresher)
  const [experience, setExperience] = useState(() => {
    const exp = (user as { workExperience?: number | string } | undefined)?.workExperience;
    return exp != null && exp !== '' ? String(exp) : '';
  });

  // Step 3 — Categories (MULTI-select)
  const [selectedCats, setSelectedCats] = useState<string[]>(() => {
    if (!user?.categories?.length) return [];
    // Map saved category values back to parent cat values
    const parentVals: string[] = [];
    for (const cat of ALL_CATS) {
      if (cat.subcategories.some((s) => user.categories!.includes(s.value))) {
        parentVals.push(cat.value);
      }
    }
    return parentVals;
  });

  // Step 4 — Sub-categories (MULTI-select from all selected categories)
  const [selectedSubs, setSelectedSubs] = useState<string[]>(user?.categories ?? []);
  const [subSearch, setSubSearch] = useState('');
  const [subError, setSubError] = useState(false);

  // Step 6 — Areas of work (where they want to work — multiple districts)
  const [areas, setAreas] = useState<string[]>(user?.areasOfWork ?? []);
  const [areaSearch, setAreaSearch] = useState('');

  // Completion state — shows congrats screen after successful save
  const [done, setDone] = useState(false);

  // Step 5 — State / District / Block
  const [selectedState, setSelectedState] = useState(user?.state ?? '');
  const [selectedDistrict, setSelectedDistrict] = useState(user?.district ?? '');
  const [selectedBlock, setSelectedBlock] = useState(user?.block ?? '');
  const [saving, setSaving] = useState(false);

  // Block the Android hardware back button until the user has saved state+district.
  // If they are mid-wizard (step > 1), back goes to the previous step instead.
  // This prevents escaping the mandatory location gate without completing it.
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      const locationSaved = !!(user?.state && user?.district);
      if (locationSaved) return false; // allow normal back once location is saved
      if (step > 1) {
        setStep((s) => s - 1);
        return true; // handled — go to previous step
      }
      return true; // block exit on step 1 when location not yet saved
    });
    return () => handler.remove();
  }, [step, user?.state, user?.district]);

  // All subcategories from all selected categories combined
  const allAvailableSubs = useMemo(() => {
    return ALL_CATS
      .filter((c) => selectedCats.includes(c.value))
      .flatMap((c) => c.subcategories);
  }, [selectedCats]);

  const filteredSubs = useMemo(() => {
    const q = subSearch.trim().toLowerCase();
    if (!q) return allAvailableSubs;
    return allAvailableSubs.filter(
      (s) => s.label.toLowerCase().includes(q) || (s.hindilabel ?? '').toLowerCase().includes(q),
    );
  }, [allAvailableSubs, subSearch]);

  const filteredAreas = useMemo(() => {
    if (!areaSearch.trim()) return [];
    const q = areaSearch.toLowerCase();
    return ALL_DISTRICTS.filter(
      (d) => d.label.toLowerCase().includes(q) || d.state.toLowerCase().includes(q),
    ).slice(0, 30);
  }, [areaSearch]);

  const toggleArea = useCallback((district: string) => {
    setAreas((prev) => prev.includes(district) ? prev.filter((a) => a !== district) : [...prev, district]);
  }, []);

  const toggleCat = useCallback((val: string) => {
    setSelectedCats((prev) => {
      const next = prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val];
      // Remove any selected subs that belong to a deselected category
      if (!next.includes(val)) {
        const removedCat = ALL_CATS.find((c) => c.value === val);
        if (removedCat) {
          const removedSubVals = removedCat.subcategories.map((s) => s.value);
          setSelectedSubs((prevSubs) => prevSubs.filter((s) => !removedSubVals.includes(s)));
        }
      }
      return next;
    });
  }, []);

  const toggleSub = useCallback((val: string) => {
    setSubError(false);
    setSelectedSubs((prev) => prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]);
  }, []);

  const canNext = (): boolean => {
    switch (step) {
      case 1: return gender !== '';
      case 2: return age !== '' && Number(age) >= 15 && Number(age) <= 70;
      case 3: return experience !== '' && Number(experience) >= 0 && Number(experience) <= 60;
      case 4: return selectedCats.length > 0;
      case 5: return selectedSubs.length > 0;
      case 6: return selectedState !== '' && selectedDistrict !== '';
      case 7: return areas.length > 0; // areasOfWork is now mandatory
      default: return true;
    }
  };

  const handleNext = () => {
    if (step === 5 && selectedSubs.length === 0) { setSubError(true); return; }
    if (step < TOTAL_STEPS) { setStep((s) => s + 1); return; }
    void handleSave();
  };

  const handleSave = async () => {
    setSaving(true);
    const updates = {
      gender,
      dob: Number(age),
      categories: selectedSubs,
      state: selectedState,
      district: selectedDistrict,
      areasOfWork: areas,
      ...(selectedBlock ? { block: selectedBlock } : {}),
    };
    try {
      await updateProfile(updates as Parameters<typeof updateProfile>[0]);
      // workExperience isn't part of the local UserProfile session, but is a
      // valid backend field — persist it alongside the rest.
      updateProfileFields({ ...updates, workExperience: Number(experience) } as Parameters<typeof updateProfileFields>[0]).catch(() => {});
      await completeOnboarding();
      setDone(true);
    } catch {
      await completeOnboarding();
      setDone(true);
    } finally {
      setSaving(false);
    }
  };

  const stepLabel = t('wpc_stepOf', { current: step, total: TOTAL_STEPS });

  // ── Congratulations screen ────────────────────────────────────────────────
  if (done) {
    return (
      <View style={[doneS.root, { backgroundColor: theme.colors.primaryDark }]}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.primaryDark} />
        <View style={doneS.deco1} />
        <View style={doneS.deco2} />
        <View style={[doneS.card, { backgroundColor: isDark ? theme.colors.surface : '#fff' }]}>
          <View style={doneS.emojiWrap}>
            <AppText style={doneS.emoji}>🎉</AppText>
          </View>
          <AppText style={[doneS.title, { color: theme.colors.text }]}>{t('wizard_doneTitle')}</AppText>
          <AppText style={[doneS.sub, { color: theme.colors.mutedText }]}>{t('wizard_doneSub')}</AppText>
          <TouchableOpacity
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] })}
            activeOpacity={0.85}
            style={[doneS.btn, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary }]}
          >
            <AppText style={doneS.btnTxt}>{t('wizard_findWork')} →</AppText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primaryDark} />
      <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F5F7FC' }]}>

        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: getStatusBarHeight(insets.top) + 14, backgroundColor: theme.colors.primaryDark }]}>
          <View style={styles.stepRow}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View key={i} style={[styles.stepDot, (i + 1) === step && styles.stepDotActive, (i + 1) < step && styles.stepDotDone]} />
            ))}
          </View>
          <AppText style={styles.headerGreet}>{t('wpc_hey')} {user?.fullName?.split(' ')[0] ?? ''} 👋</AppText>
          <AppText style={styles.headerTitle}>{t('wpc_title')}</AppText>
          <AppText style={styles.headerSub}>{t('wpc_sub')}</AppText>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Step 1: Gender ── */}
          {step === 1 && (
            <View style={styles.section}>
              <AppText style={[styles.stepLabel, { color: theme.colors.primary }]}>{stepLabel}</AppText>
              <AppText style={[styles.question, { color: theme.colors.text }]}>{t('wpc_genderQ')}</AppText>
              <AppText style={[styles.hint, { color: theme.colors.mutedText, marginBottom: 14 }]}>{t('wpc_genderHint')}</AppText>
              <View style={styles.chipRow}>
                {GENDER_OPTIONS.map((g) => (
                  <Chip
                    key={g}
                    label={t(`gender_${g.toLowerCase()}`, g)}
                    selected={gender === g}
                    onPress={() => setGender(g)}
                    color={theme.colors.primary}
                  />
                ))}
              </View>
            </View>
          )}

          {/* ── Step 2: Age ── */}
          {step === 2 && (
            <View style={styles.section}>
              <AppText style={[styles.stepLabel, { color: theme.colors.primary }]}>{stepLabel}</AppText>
              <AppText style={[styles.question, { color: theme.colors.text }]}>{t('wpc_ageQ')}</AppText>
              <TextInput
                style={[
                  styles.ageInput,
                  {
                    backgroundColor: isDark ? theme.colors.surface : '#fff',
                    borderColor: age ? theme.colors.primary : (isDark ? theme.colors.border : '#DDE3F0'),
                    color: theme.colors.text,
                  },
                ]}
                value={age}
                onChangeText={(v) => { if (/^\d{0,2}$/.test(v)) setAge(v); }}
                keyboardType="number-pad"
                maxLength={2}
                placeholder={t('wpc_agePlaceholder')}
                placeholderTextColor={theme.colors.mutedText}
              />
              <AppText style={[styles.hint, { color: theme.colors.mutedText }]}>{t('wpc_ageHint')}</AppText>
            </View>
          )}

          {/* ── Step 3: Work Experience ── */}
          {step === 3 && (
            <View style={styles.section}>
              <AppText style={[styles.stepLabel, { color: theme.colors.primary }]}>{stepLabel}</AppText>
              <AppText style={[styles.question, { color: theme.colors.text }]}>{t('wpc_experienceQ')}</AppText>
              <TextInput
                style={[
                  styles.ageInput,
                  {
                    backgroundColor: isDark ? theme.colors.surface : '#fff',
                    borderColor: experience !== '' ? theme.colors.primary : (isDark ? theme.colors.border : '#DDE3F0'),
                    color: theme.colors.text,
                  },
                ]}
                value={experience}
                onChangeText={(v) => { if (/^\d{0,2}$/.test(v)) setExperience(v); }}
                keyboardType="number-pad"
                maxLength={2}
                placeholder={t('wpc_experiencePlaceholder')}
                placeholderTextColor={theme.colors.mutedText}
              />
              <AppText style={[styles.hint, { color: theme.colors.mutedText }]}>{t('wpc_experienceHint')}</AppText>
            </View>
          )}

          {/* ── Step 4: Work Categories (MULTI-select) ── */}
          {step === 4 && (
            <View style={styles.section}>
              <AppText style={[styles.stepLabel, { color: theme.colors.primary }]}>{stepLabel}</AppText>
              <AppText style={[styles.question, { color: theme.colors.text }]}>{t('wpc_workCatQ')}</AppText>
              <AppText style={[styles.hint, { color: theme.colors.mutedText, marginBottom: 14 }]}>
                {t('wpc_workCatHint')} — {selectedCats.length > 0 ? `${selectedCats.length} ${t('wpc_selected')}` : ''}
              </AppText>
              <View style={styles.catGrid}>
                {ALL_CATS.map((cat) => {
                  const sel = selectedCats.includes(cat.value);
                  return (
                    <TouchableOpacity
                      key={cat.value}
                      onPress={() => toggleCat(cat.value)}
                      activeOpacity={0.8}
                      style={[
                        styles.catCard,
                        {
                          backgroundColor: sel ? theme.colors.primary : (isDark ? theme.colors.surface1 : '#fff'),
                          borderColor: sel ? theme.colors.primary : (isDark ? theme.colors.border : '#DDE3F0'),
                        },
                      ]}
                    >
                      <AppText style={[styles.catLabel, { color: sel ? '#fff' : theme.colors.text }]} numberOfLines={3}>
                        {getCatLabel(cat, lang)}
                      </AppText>
                      {sel && <AppText style={styles.catCheck}>✓</AppText>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Step 5: Sub-categories (MULTI-select from all selected cats) ── */}
          {step === 5 && (
            <View style={styles.section}>
              <AppText style={[styles.stepLabel, { color: theme.colors.primary }]}>{stepLabel}</AppText>
              <AppText style={[styles.question, { color: theme.colors.text }]}>{t('wpc_subCatQ')}</AppText>
              <AppText style={[styles.hint, { color: theme.colors.mutedText }]}>{t('wpc_subCatHint')}</AppText>

              <View style={[styles.searchBox, { backgroundColor: isDark ? theme.colors.surface : '#fff', borderColor: isDark ? theme.colors.border : '#DDE3F0' }]}>
                <AppText style={styles.searchIcon}>🔍</AppText>
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.text }]}
                  value={subSearch}
                  onChangeText={setSubSearch}
                  placeholder={t('wpc_subCatSearch')}
                  placeholderTextColor={theme.colors.mutedText}
                  autoCorrect={false}
                />
                {subSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setSubSearch('')}>
                    <AppText style={{ color: theme.colors.mutedText, fontSize: 15, fontWeight: '700', paddingHorizontal: 4 }}>✕</AppText>
                  </TouchableOpacity>
                )}
              </View>

              {subError && (
                <AppText style={[styles.errorText, { color: theme.colors.danger }]}>{t('wpc_subCatRequired')}</AppText>
              )}

              <View style={[styles.subGrid, { marginTop: 12 }]}>
                {filteredSubs.map((sub) => {
                  const sel = selectedSubs.includes(sub.value);
                  return (
                    <TouchableOpacity
                      key={sub.value}
                      onPress={() => toggleSub(sub.value)}
                      activeOpacity={0.8}
                      style={[
                        styles.subCard,
                        {
                          backgroundColor: sel ? theme.colors.primary : (isDark ? theme.colors.surface1 : '#F1F5F9'),
                          borderColor: sel ? theme.colors.primary : (isDark ? theme.colors.border : '#DDE3F0'),
                        },
                      ]}
                    >
                      <AppText style={[styles.subLabel, { color: sel ? '#fff' : theme.colors.text }]} numberOfLines={2}>
                        {getSubLabel(sub, lang)}
                      </AppText>
                      {sel && <AppText style={styles.subCheck}>✓</AppText>}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {selectedSubs.length > 0 && (
                <View style={[styles.selectedBox, { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary + '30' }]}>
                  <AppText style={[styles.selectedLabel, { color: theme.colors.primary }]}>
                    {t('wpc_subCatSelected')} ({selectedSubs.length}):
                  </AppText>
                  <View style={[styles.chipRow, { marginTop: 6 }]}>
                    {selectedSubs.map((val) => {
                      const sub = allAvailableSubs.find((s) => s.value === val);
                      return (
                        <Tag
                          key={val}
                          label={sub ? getSubLabel(sub, lang) : val}
                          onRemove={() => toggleSub(val)}
                        />
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ── Step 6: State / District / Block ── */}
          {step === 6 && (
            <View style={styles.section}>
              <AppText style={[styles.stepLabel, { color: theme.colors.primary }]}>{stepLabel}</AppText>
              <AppText style={[styles.question, { color: theme.colors.text }]}>{t('wpc_locationQ')}</AppText>
              <AppText style={[styles.hint, { color: theme.colors.mutedText, marginBottom: 12 }]}>{t('wpc_locationHint')}</AppText>

              <LocationSelector
                state={selectedState}
                district={selectedDistrict}
                block={selectedBlock}
                onStateChange={(v) => { setSelectedState(v); setSelectedDistrict(''); setSelectedBlock(''); }}
                onDistrictChange={(v) => { setSelectedDistrict(v); setSelectedBlock(''); }}
                onBlockChange={setSelectedBlock}
              />

              {selectedState !== '' && selectedDistrict !== '' && (
                <View style={[locSummaryS.wrap, {
                  backgroundColor: isDark ? '#15803D18' : '#F0FDF4',
                  borderColor: isDark ? '#22C55E33' : '#BBF7D0',
                }]}>
                  <AppText style={locSummaryS.pin}>📍</AppText>
                  <View style={{ flex: 1 }}>
                    <AppText style={[locSummaryS.title, { color: isDark ? '#4ADE80' : '#15803D' }]}>
                      {t('wpc_locationSummary')}
                    </AppText>
                    <AppText style={[locSummaryS.text, { color: isDark ? '#86EFAC' : '#166534' }]}>
                      {selectedState} › {selectedDistrict}{selectedBlock ? ` › ${selectedBlock}` : ''}
                    </AppText>
                  </View>
                  <AppText style={[locSummaryS.check, { color: isDark ? '#4ADE80' : '#22C55E' }]}>✓</AppText>
                </View>
              )}
            </View>
          )}

          {/* ── Step 7: Where do you want to work? (areasOfWork — mandatory) ── */}
          {step === 7 && (
            <View style={styles.section}>
              <AppText style={[styles.stepLabel, { color: theme.colors.primary }]}>{stepLabel}</AppText>
              <AppText style={[styles.question, { color: theme.colors.text }]}>{t('wpc_areasQ')}</AppText>
              <AppText style={[styles.hint, { color: theme.colors.mutedText }]}>{t('wpc_areasHint')}</AppText>

              <View style={[styles.searchBox, { backgroundColor: isDark ? theme.colors.surface : '#fff', borderColor: isDark ? theme.colors.border : '#DDE3F0' }]}>
                <AppText style={styles.searchIcon}>🔍</AppText>
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.text }]}
                  value={areaSearch}
                  onChangeText={setAreaSearch}
                  placeholder={t('wpc_searchPlaceholder')}
                  placeholderTextColor={theme.colors.mutedText}
                  autoCorrect={false}
                />
                {areaSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setAreaSearch('')}>
                    <AppText style={{ color: theme.colors.mutedText, fontSize: 15, fontWeight: '700', paddingHorizontal: 4 }}>✕</AppText>
                  </TouchableOpacity>
                )}
              </View>

              {filteredAreas.length > 0 && (
                <View style={[styles.dropdownBox, { backgroundColor: isDark ? theme.colors.surface : '#fff', borderColor: isDark ? theme.colors.border : '#DDE3F0' }]}>
                  {filteredAreas.map((d) => {
                    const sel = areas.includes(d.label);
                    return (
                      <TouchableOpacity
                        key={`${d.state}-${d.label}`}
                        style={[
                          styles.dropdownItem,
                          sel && { backgroundColor: isDark ? theme.colors.primary + '22' : theme.colors.primaryLight },
                          { borderBottomColor: isDark ? theme.colors.border : '#F1F5F9' },
                        ]}
                        onPress={() => { toggleArea(d.label); setAreaSearch(''); }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <AppText style={[styles.ddDistrict, { color: sel ? theme.colors.primary : theme.colors.text }]}>{d.label}</AppText>
                          <AppText style={[styles.ddState, { color: theme.colors.mutedText }]}>{d.state}</AppText>
                        </View>
                        {sel && <AppText style={[styles.ddCheck, { color: theme.colors.primary }]}>✓</AppText>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {areaSearch.trim().length > 0 && filteredAreas.length === 0 && (
                <AppText style={[styles.hint, { color: theme.colors.mutedText, marginTop: 12 }]}>{t('wpc_noResults')}</AppText>
              )}

              {areas.length > 0 && (
                <View style={[styles.selectedBox, { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary + '30', marginTop: 14 }]}>
                  <AppText style={[styles.selectedLabel, { color: theme.colors.primary }]}>
                    {t('wpc_selected')} ({areas.length}):
                  </AppText>
                  <View style={[styles.chipRow, { marginTop: 6 }]}>
                    {areas.map((a) => (
                      <Tag key={a} label={a} onRemove={() => setAreas((prev) => prev.filter((x) => x !== a))} />
                    ))}
                  </View>
                </View>
              )}

              {areas.length === 0 && (
                <AppText style={[styles.hint, { color: theme.colors.mutedText, marginTop: 12 }]}>{t('wpc_areasRequired')}</AppText>
              )}
            </View>
          )}

        </ScrollView>

        {/* ── Footer ── */}
        <View style={[
          styles.footer,
          { paddingBottom: insets.bottom + 12, backgroundColor: isDark ? theme.colors.surface : '#fff', borderTopColor: isDark ? theme.colors.border : '#E8EEF6' },
        ]}>
          <View style={styles.footerRow}>
            {step > 1 && (
              <TouchableOpacity
                onPress={() => { setStep((s) => s - 1); }}
                style={[styles.backBtn, { borderColor: isDark ? theme.colors.border : '#DDE3F0' }]}
              >
                <AppText style={[styles.backBtnText, { color: theme.colors.mutedText }]}>← {t('wpc_back')}</AppText>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }}>
              <AppButton
                title={saving ? t('wpc_saving') : step === TOTAL_STEPS ? t('wpc_finish') : t('wpc_next')}
                onPress={handleNext}
                disabled={!canNext() || saving}
                loading={saving}
                fullWidth
              />
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root:    { flex: 1 },
  header:  { paddingHorizontal: 20, paddingBottom: 24 },
  stepRow: { flexDirection: 'row', gap: 5, marginBottom: 12 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  stepDotActive: { backgroundColor: '#fff', width: 18 },
  stepDotDone:   { backgroundColor: 'rgba(255,255,255,0.7)' },
  headerGreet: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  headerSub:   { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },

  content:   { padding: 20 },
  section:   {},
  stepLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  question:  { fontSize: 20, fontWeight: '800', marginBottom: 8, lineHeight: 27 },
  hint:      { fontSize: 12.5 },
  chipRow:   { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  errorText: { fontSize: 12, fontWeight: '600', marginTop: 6 },

  ageInput: {
    fontSize: 36, fontWeight: '900', textAlign: 'center',
    borderWidth: 2, borderRadius: 16, paddingVertical: 18, marginTop: 8, letterSpacing: 2,
  },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  catCard: {
    width: '47%', borderWidth: 1.5, borderRadius: 14, padding: 12,
    alignItems: 'center', justifyContent: 'center', minHeight: 72,
  },
  catLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 16 },
  catCheck: { fontSize: 14, color: '#fff', fontWeight: '800', marginTop: 4 },

  subGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subCard:  { width: '47%', borderWidth: 1.5, borderRadius: 14, padding: 10, alignItems: 'center', justifyContent: 'center', minHeight: 56 },
  subLabel: { fontSize: 12.5, fontWeight: '600', textAlign: 'center', lineHeight: 17 },
  subCheck: { fontSize: 12, color: '#fff', fontWeight: '800', marginTop: 2 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11, marginTop: 12, gap: 8,
  },
  searchIcon:  { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', padding: 0 },

  selectedBox:   { borderWidth: 1, borderRadius: 12, padding: 12 },
  selectedLabel: { fontSize: 13, fontWeight: '700' },

  dropdownBox: { borderWidth: 1, borderRadius: 14, marginTop: 6, maxHeight: 220, overflow: 'hidden' },
  dropdownItem:{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  ddDistrict:  { fontSize: 14, fontWeight: '700' },
  ddState:     { fontSize: 11.5, marginTop: 1 },
  ddCheck:     { fontSize: 18, fontWeight: '800' },

  footer:     { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  footerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn:    { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13 },
  backBtnText:{ fontSize: 14, fontWeight: '600' },
});

const doneS = StyleSheet.create({
  root:  {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 28, overflow: 'hidden',
  },
  deco1: {
    position: 'absolute', width: 360, height: 360, borderRadius: 180,
    top: -140, right: -120, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  deco2: {
    position: 'absolute', width: 240, height: 240, borderRadius: 120,
    bottom: -80, left: -60, backgroundColor: 'rgba(255,255,255,0.05)',
  },
  card:  {
    width: '100%', maxWidth: 380, borderRadius: 32, padding: 36,
    alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2, shadowRadius: 40, elevation: 16,
  },
  emojiWrap: {
    width: 96, height: 96, borderRadius: 28, backgroundColor: '#FFF7ED',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  emoji: { fontSize: 52 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', lineHeight: 34 },
  sub:   { fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 4 },
  btn:   {
    marginTop: 8, borderRadius: 16, width: '100%', height: 56,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  btnTxt:{ color: '#fff', fontSize: 16, fontWeight: '800' },
});
