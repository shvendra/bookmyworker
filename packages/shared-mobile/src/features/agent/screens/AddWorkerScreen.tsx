import React, { useState } from 'react';
import {
  Image,
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
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { agentApi } from '../../../core/api/endpoints/agentApi';
import { FormInput } from '../../../shared/components/forms/FormInput';
import { FormSelect } from '../../../shared/components/forms/FormSelect';
import { LocationSelector } from '../../../shared/components/forms/LocationSelector';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { useToast } from '../../../shared/state/toast/ToastContext';
import type { MainStackParamList } from '../../../app/navigation/types';
import categoriesData from '../../../shared/data/categories.json';
import { getWorkTypeLabel } from '../../../shared/utils/labelUtils';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { indianStates } from '../../../shared/data/stateDistrict';

interface CatEntry { label: string; value: string; subcategories: Array<{ label: string; value: string }> }
const ALL_CATS: CatEntry[] = categoriesData as CatEntry[];

// Flattened list of every district (with its state) for the serviceable-area
// search. serviceArea is what the employer "city" search matches against, so an
// agent-added worker is only findable in these districts (plus their residence).
const ALL_DISTRICTS: { label: string; state: string }[] = [];
Object.entries(indianStates as Record<string, Record<string, unknown>>).forEach(([stateName, districts]) => {
  Object.keys(districts).forEach((d) => ALL_DISTRICTS.push({ label: d, state: stateName }));
});

type Nav = NativeStackNavigationProp<MainStackParamList>;

const BRAND  = '#1037A4';
const ORANGE = '#F97316';

// Canonical option values — stored in form state and sent to the backend as-is.
// Only their *display* labels are translated (see option-mapping helpers below),
// so the data layer is unchanged regardless of the user's language.
const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;
const SALARY_TYPE_OPTIONS = ['Fixed', 'Ranged'] as const;
const EXPERIENCE_OPTIONS = ['Fresher', ...Array.from({ length: 20 }, (_, i) => `${i + 1} year${i !== 0 ? 's' : ''}`)];

// Schema is built per-render so validation messages follow the active language.
const buildAddWorkerSchema = (t: TFunction) =>
  z.object({
    name: z.string().min(3, t('awValName')),
    mobile: z.string().regex(/^[6-9]\d{9}$/, t('awValMobile')),
    gender: z.enum(['Male', 'Female', 'Other']).optional(),
    dob: z.string().optional(),
    address: z.string().optional(),
    pinCode: z.string().regex(/^\d{6}$/, t('awValPin')).optional().or(z.literal('')),
    salaryType: z.string().optional(),
    fixedSalary: z.string().optional(),
    salaryFrom: z.string().optional(),
    salaryTo: z.string().optional(),
    workExperience: z.string().optional(),
    bankAccount: z.string().optional(),
    ifscCode: z.string().optional(),
    bankName: z.string().optional(),
    description: z.string().optional(),
  });

type FormValues = z.infer<ReturnType<typeof buildAddWorkerSchema>>;

const SectionCard = ({ icon, title, children, theme }: {
  icon: string; title: string; children: React.ReactNode;
  theme: ReturnType<typeof useAppTheme>['theme'];
}): React.JSX.Element => (
  <View style={[cardStyles.wrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
    <View style={[cardStyles.header, { borderBottomColor: theme.colors.border }]}>
      <View style={cardStyles.iconCircle}>
        <AppText style={cardStyles.icon}>{icon}</AppText>
      </View>
      <AppText style={[cardStyles.title, { color: theme.colors.text }]}>{title}</AppText>
    </View>
    <View style={cardStyles.body}>{children}</View>
  </View>
);

const cardStyles = StyleSheet.create({
  wrap: {
    borderRadius: 16, borderWidth: 1,
    marginBottom: 14, overflow: 'hidden',
    shadowColor: BRAND, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconCircle: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: 'rgba(16,55,164,0.09)',
    alignItems: 'center', justifyContent: 'center',
  },
  icon:  { fontSize: 18, lineHeight: 22 },
  title: { flexShrink: 1, fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },
  body:  { padding: 16, paddingTop: 14 },
});

export const AddWorkerScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const isDark = theme.mode === 'dark';
  const canGoBack = navigation.canGoBack();

  const [stateVal, setStateVal] = useState('');
  const [districtVal, setDistrictVal] = useState('');
  const [tehsilVal, setTehsilVal] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  // Serviceable areas (districts the worker will work in) → serviceArea.
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [areaSearch, setAreaSearch] = useState('');

  const filteredAreas = React.useMemo(() => {
    const q = areaSearch.trim().toLowerCase();
    if (!q) return [];
    return ALL_DISTRICTS
      .filter((d) => d.label.toLowerCase().includes(q) || d.state.toLowerCase().includes(q))
      .slice(0, 30);
  }, [areaSearch]);

  const toggleArea = (district: string): void => {
    setServiceAreas((prev) =>
      prev.includes(district) ? prev.filter((a) => a !== district) : [...prev, district]
    );
  };

  // ── Option display helpers ──────────────────────────────────────────────
  // Translate only what the user sees; map back to the canonical English value
  // before it ever reaches form state / the API.
  const genderLabel = (v: string): string =>
    v === 'Male' ? t('genderMale') : v === 'Female' ? t('genderFemale') : v === 'Other' ? t('genderOther') : '';
  const genderOptions = React.useMemo(() => GENDER_OPTIONS.map(genderLabel), [t]);
  const genderFromLabel = (label: string): 'Male' | 'Female' | 'Other' | undefined =>
    GENDER_OPTIONS.find((v) => genderLabel(v) === label);

  const salaryTypeLabelOf = (v: string): string =>
    v === 'Fixed' ? t('salaryFixedOpt') : v === 'Ranged' ? t('salaryRangedOpt') : '';
  const salaryTypeOptions = React.useMemo(() => SALARY_TYPE_OPTIONS.map(salaryTypeLabelOf), [t]);
  const salaryTypeFromLabel = (label: string): string =>
    SALARY_TYPE_OPTIONS.find((v) => salaryTypeLabelOf(v) === label) ?? '';

  const experienceLabelOf = (v: string): string => {
    if (v === 'Fresher') return t('expFresher');
    const n = parseInt(v, 10);
    return `${n} ${n === 1 ? t('awYear') : t('awYears')}`;
  };
  const experienceOptions = React.useMemo(() => EXPERIENCE_OPTIONS.map(experienceLabelOf), [t]);
  const experienceFromLabel = (label: string): string =>
    EXPERIENCE_OPTIONS.find((v) => experienceLabelOf(v) === label) ?? '';

  const { control, handleSubmit, watch } = useForm<FormValues>({
    resolver: zodResolver(buildAddWorkerSchema(t)),
    defaultValues: {
      name: '', mobile: '', gender: undefined, dob: '',
      address: '', pinCode: '', salaryType: '', fixedSalary: '', salaryFrom: '', salaryTo: '',
      workExperience: '', bankAccount: '', ifscCode: '', bankName: '', description: '',
    },
  });

  const salaryType = watch('salaryType');

  const toggleCategory = (value: string): void => {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const formData = new FormData();
      formData.append('name', values.name);
      formData.append('phone', values.mobile);
      formData.append('password', values.mobile);
      formData.append('role', 'Worker');
      if (values.gender) formData.append('gender', values.gender);
      // dob stores age as plain Number (e.g. 25)
      if (values.dob) formData.append('dob', String(Number(values.dob)));
      if (values.address) formData.append('address', values.address);
      if (stateVal) formData.append('state', stateVal);
      if (districtVal) formData.append('district', districtVal);
      if (tehsilVal) formData.append('block', tehsilVal);
      if (values.pinCode) formData.append('pinCode', values.pinCode);
      if (values.workExperience) formData.append('workExperience', JSON.stringify(values.workExperience));
      if (selectedCategories.length > 0) formData.append('areasOfWork', JSON.stringify(selectedCategories));
      if (serviceAreas.length > 0) formData.append('serviceArea', JSON.stringify(serviceAreas));
      if (values.salaryType) formData.append('salaryType', values.salaryType);
      if (values.fixedSalary) formData.append('fixedSalary', values.fixedSalary);
      if (values.salaryFrom) formData.append('salaryFrom', values.salaryFrom);
      if (values.salaryTo) formData.append('salaryTo', values.salaryTo);
      if (values.bankAccount) formData.append('bankAccount', values.bankAccount);
      if (values.ifscCode) formData.append('ifscCode', values.ifscCode);
      if (values.bankName) formData.append('bankName', values.bankName);
      if (values.description) formData.append('description', values.description);
      return agentApi.registerWorker(formData);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-stats'] });
      toast.success(t('awSuccessMsg'), t('awSuccessTitle'));
      if (canGoBack) navigation.goBack();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t('awErrorMsg'), t('awErrorTitle'));
    },
  });

  const onSubmit = handleSubmit((values) => {
    if (!stateVal || !districtVal) {
      toast.warning(t('awSelectStateDistrict'), t('awRequiredFields'));
      return;
    }
    if (selectedCategories.length === 0) {
      toast.warning(t('awSelectAreaWork'), t('awRequiredFields'));
      return;
    }
    mutation.mutate(values);
  });

  return (
    <View style={styles.root}>

      {canGoBack && (
        <ScreenHeader title={t('awAddWorkerTitle')} onBack={() => navigation.goBack()} />
      )}

      {/* ── Form body ────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={[styles.scroll, { backgroundColor: isDark ? theme.colors.background : '#F4F8FF' }]}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Basic Info */}
          <SectionCard icon="👤" title={t('awBasicInfo')} theme={theme}>
            <FormInput control={control} name="name" label={t('fullNameRequired')} placeholder={t('awFullNamePh')} />
            <FormInput control={control} name="mobile" label={t('mobileNumberRequired')} placeholder={t('tenDigitMobile')} keyboardType="phone-pad" maxLength={10} />
            <Controller
              control={control}
              name="gender"
              render={({ field, fieldState }) => (
                <FormSelect
                  label={t('genderLabel')}
                  placeholder={t('awSelectPlaceholder')}
                  value={genderLabel(field.value ?? '')}
                  options={genderOptions}
                  onChange={(label) => field.onChange(genderFromLabel(label))}
                  errorText={fieldState.error?.message}
                />
              )}
            />
            <FormInput control={control} name="dob" label={t('ageLabel')} placeholder={t('awAgePh')} keyboardType="number-pad" maxLength={2} />
            <FormInput control={control} name="address" label={t('villageTownAddress')} placeholder={t('awAddressPh')} />
          </SectionCard>

          {/* Location */}
          <SectionCard icon="📍" title={t('awLocation')} theme={theme}>
            <LocationSelector
              state={stateVal}
              district={districtVal}
              block={tehsilVal}
              onStateChange={(v) => { setStateVal(v); setDistrictVal(''); setTehsilVal(''); }}
              onDistrictChange={(v) => { setDistrictVal(v); setTehsilVal(''); }}
              onBlockChange={setTehsilVal}
            />
            <FormInput
              control={control}
              name="pinCode"
              label={t('pinCodeLabel')}
              placeholder={t('sixDigitPinCode')}
              keyboardType="number-pad"
              maxLength={6}
            />
          </SectionCard>

          {/* Serviceable Areas — where the worker will work (drives employer search) */}
          <SectionCard
            icon="🗺️"
            title={`${t('awServiceAreas')}${serviceAreas.length > 0 ? `  ·  ${t('awSelectedCount', { count: serviceAreas.length })}` : ''}`}
            theme={theme}
          >
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.areaHint}>
              {t('awServiceHint')}
            </AppText>

            <View style={[styles.searchBox, {
              backgroundColor: isDark ? theme.colors.surface : '#fff',
              borderColor: isDark ? theme.colors.border : '#DDE3F0',
            }]}>
              <AppText style={styles.searchIcon}>🔍</AppText>
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                value={areaSearch}
                onChangeText={setAreaSearch}
                placeholder={t('awSearchCity')}
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
              <View style={[styles.dropdownBox, {
                backgroundColor: isDark ? theme.colors.surface : '#fff',
                borderColor: isDark ? theme.colors.border : '#DDE3F0',
              }]}>
                {filteredAreas.map((d) => {
                  const sel = serviceAreas.includes(d.label);
                  return (
                    <TouchableOpacity
                      key={`${d.state}-${d.label}`}
                      style={[styles.dropdownItem, { borderBottomColor: isDark ? theme.colors.border : '#F1F5F9' },
                        sel && { backgroundColor: isDark ? BRAND + '22' : '#EBF1FF' }]}
                      onPress={() => { toggleArea(d.label); setAreaSearch(''); }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <AppText style={{ fontSize: 14, fontWeight: '600', color: sel ? BRAND : theme.colors.text }}>{d.label}</AppText>
                        <AppText style={{ fontSize: 11, color: theme.colors.mutedText }}>{d.state}</AppText>
                      </View>
                      {sel && <AppText style={{ fontSize: 15, fontWeight: '800', color: BRAND }}>✓</AppText>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {areaSearch.trim().length > 0 && filteredAreas.length === 0 && (
              <AppText variant="caption" color={theme.colors.mutedText} style={styles.areaHint}>{t('awNoDistricts')}</AppText>
            )}

            {serviceAreas.length > 0 && (
              <View style={styles.chipGrid}>
                {serviceAreas.map((a) => (
                  <TouchableOpacity
                    key={a}
                    onPress={() => toggleArea(a)}
                    activeOpacity={0.75}
                    style={[styles.chip, { backgroundColor: BRAND, borderColor: BRAND }]}
                  >
                    <AppText variant="caption" color="#FFFFFF" style={styles.chipText} numberOfLines={2}>{a}</AppText>
                    <AppText style={styles.chipCheck}>✕</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </SectionCard>

          {/* Areas of Work */}
          <SectionCard
            icon="💼"
            title={`${t('awAreasOfWork')}${selectedCategories.length > 0 ? `  ·  ${t('awSelectedCount', { count: selectedCategories.length })}` : ''}`}
            theme={theme}
          >
            <View style={styles.chipGrid}>
              {ALL_CATS.map((cat) => {
                const selected = selectedCategories.includes(cat.value);
                return (
                  <TouchableOpacity
                    key={cat.value}
                    onPress={() => toggleCategory(cat.value)}
                    activeOpacity={0.75}
                    style={[styles.chip, {
                      backgroundColor: selected ? BRAND : (isDark ? theme.colors.surface : '#EBF1FF'),
                      borderColor: selected ? BRAND : (isDark ? theme.colors.border : '#C3D3F5'),
                    }]}
                  >
                    {selected ? (
                      <AppText style={styles.chipCheck}>✓</AppText>
                    ) : null}
                    <AppText
                      variant="caption"
                      color={selected ? '#FFFFFF' : (isDark ? theme.colors.text : BRAND)}
                      style={styles.chipText}
                      numberOfLines={3}
                    >
                      {getWorkTypeLabel(cat.value, t)}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
            {selectedCategories.length === 0 && (
              <AppText variant="caption" color={theme.colors.mutedText} style={styles.chipHint}>
                {t('awTapCategories')}
              </AppText>
            )}
          </SectionCard>

          {/* Experience */}
          <SectionCard icon="⭐" title={t('awExperienceSkills')} theme={theme}>
            <Controller
              control={control}
              name="workExperience"
              render={({ field, fieldState }) => (
                <FormSelect
                  label={t('workExperienceLabel')}
                  placeholder={t('selectExperience')}
                  value={field.value ? experienceLabelOf(field.value) : ''}
                  options={experienceOptions}
                  onChange={(label) => field.onChange(experienceFromLabel(label))}
                  errorText={fieldState.error?.message}
                />
              )}
            />
          </SectionCard>

          {/* Salary */}
          <SectionCard icon="💰" title={t('awSalaryPref')} theme={theme}>
            <Controller
              control={control}
              name="salaryType"
              render={({ field }) => (
                <FormSelect
                  label={t('salaryTypeLabel')}
                  placeholder={t('selectSalaryType')}
                  value={field.value ? salaryTypeLabelOf(field.value) : ''}
                  options={salaryTypeOptions}
                  onChange={(label) => field.onChange(salaryTypeFromLabel(label))}
                />
              )}
            />
            {salaryType === 'Fixed' && (
              <FormInput control={control} name="fixedSalary" label={t('fixedDailyRate')} placeholder="500" keyboardType="numeric" />
            )}
            {salaryType === 'Ranged' && (
              <View style={styles.rangeRow}>
                <View style={styles.rangeField}>
                  <FormInput control={control} name="salaryFrom" label={t('fromPerDay')} placeholder="400" keyboardType="numeric" />
                </View>
                <View style={styles.rangeField}>
                  <FormInput control={control} name="salaryTo" label={t('toPerDay')} placeholder="700" keyboardType="numeric" />
                </View>
              </View>
            )}
          </SectionCard>

          {/* Bank Details */}
          <SectionCard icon="🏦" title={`${t('awBankDetails')}  ·  ${t('awOptional')}`} theme={theme}>
            <FormInput control={control} name="bankAccount" label={t('accountNumberLabel')} placeholder="123456789012" keyboardType="number-pad" />
            <FormInput control={control} name="ifscCode" label={t('ifscCodeLabel')} placeholder="SBIN0001234" />
            <FormInput control={control} name="bankName" label={t('bankNameLabel')} placeholder="State Bank of India" />
          </SectionCard>

          {/* Notes */}
          <SectionCard icon="📝" title={t('awNotes')} theme={theme}>
            <FormInput
              control={control}
              name="description"
              label={t('additionalDetailsLabel')}
              placeholder={t('awNotesPh')}
              multiline
              numberOfLines={3}
              style={styles.textarea}
            />
          </SectionCard>

          {/* Password info */}
          <View style={[styles.infoCard, {
            backgroundColor: isDark ? theme.colors.surface : '#FFF8EC',
            borderColor: isDark ? theme.colors.border : '#FDD5B0',
          }]}>
            <AppText style={styles.infoIcon}>🔑</AppText>
            <AppText variant="caption" color={isDark ? theme.colors.mutedText : '#92400E'} style={styles.infoText}>
              {t('awPasswordInfo')}
            </AppText>
          </View>

          <AppButton
            title={t('registerWorkerBtn')}
            onPress={onSubmit}
            loading={mutation.isPending}
            size="lg"
            fullWidth
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND },

  hero: {
    backgroundColor: BRAND,
    paddingHorizontal: 20,
    paddingBottom: 30,
    overflow: 'hidden',
  },
  circle: { position: 'absolute', borderRadius: 999 },
  c1: { width: 260, height: 260, top: -100, right: -70, backgroundColor: 'rgba(255,255,255,0.055)' },
  c2: { width: 130, height: 130, bottom: -40, left: 20,  backgroundColor: 'rgba(249,115,22,0.09)' },
  orangeBar: {
    position: 'absolute', bottom: 0, right: 0,
    width: '40%', height: 4,
    backgroundColor: ORANGE, borderTopLeftRadius: 999,
  },

  backBtn:    { alignSelf: 'flex-start', marginBottom: 16 },
  backCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontSize: 26, lineHeight: 30, fontWeight: '300', marginTop: -2 },

  brandRow:      { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logoBox: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: '#FFFFFF', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 6,
  },
  logoImg:       { width: 56, height: 56 },
  brandTextWrap: { flex: 1, gap: 5 },

  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(249,115,22,0.14)',
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 999, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)',
  },
  heroDot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: ORANGE },
  heroBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  heroHeadline:  { fontSize: 22, fontWeight: '900', lineHeight: 28, letterSpacing: -0.4 },
  heroSub:       { fontSize: 13, lineHeight: 18 },

  kav:     { flex: 1 },
  scroll:  { flex: 1 },
  content: { padding: 16, paddingTop: 20, paddingBottom: 50 },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8,
    maxWidth: '48%',
  },
  chipCheck: { fontSize: 11, color: '#FFFFFF', fontWeight: '800' },
  chipText:  { fontWeight: '600', flexShrink: 1 },
  chipHint:  { marginTop: 8, fontStyle: 'italic' },

  areaHint:   { marginBottom: 10, lineHeight: 17 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46,
  },
  searchIcon:  { fontSize: 15 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  dropdownBox: {
    borderWidth: 1, borderRadius: 12, marginTop: 8, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1,
  },

  rangeRow:  { flexDirection: 'row', gap: 10 },
  rangeField: { flex: 1 },
  textarea:  { height: 80, textAlignVertical: 'top' },

  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 14, borderWidth: 1,
    padding: 14, marginBottom: 14,
  },
  infoIcon: { fontSize: 18, lineHeight: 22 },
  infoText: { flex: 1, lineHeight: 18 },

  submitBtn: { marginTop: 4 },
});
