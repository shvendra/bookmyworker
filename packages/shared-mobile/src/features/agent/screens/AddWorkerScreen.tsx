import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';

interface CatEntry { label: string; value: string; subcategories: Array<{ label: string; value: string }> }
const ALL_CATS: CatEntry[] = categoriesData as CatEntry[];

type Nav = NativeStackNavigationProp<MainStackParamList>;

const BRAND  = '#1037A4';
const ORANGE = '#F97316';

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const SALARY_TYPE_OPTIONS = ['Fixed', 'Ranged'];
const EXPERIENCE_OPTIONS = ['Fresher', ...Array.from({ length: 20 }, (_, i) => `${i + 1} year${i !== 0 ? 's' : ''}`)];

const addWorkerSchema = z.object({
  name: z.string().min(3, 'Name is required'),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  dob: z.string().optional(),
  address: z.string().optional(),
  pinCode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit PIN code').optional().or(z.literal('')),
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

type FormValues = z.infer<typeof addWorkerSchema>;

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
  title: { fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },
  body:  { padding: 16, paddingTop: 14 },
});

export const AddWorkerScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
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

  const { control, handleSubmit, watch } = useForm<FormValues>({
    resolver: zodResolver(addWorkerSchema),
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
      if (values.dob) formData.append('dob', values.dob);
      if (values.address) formData.append('address', values.address);
      if (stateVal) formData.append('state', stateVal);
      if (districtVal) formData.append('district', districtVal);
      if (tehsilVal) formData.append('block', tehsilVal);
      if (values.pinCode) formData.append('pinCode', values.pinCode);
      if (values.workExperience) formData.append('workExperience', JSON.stringify(values.workExperience));
      if (selectedCategories.length > 0) formData.append('areasOfWork', JSON.stringify(selectedCategories));
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
      toast.success('Worker registered successfully. Their password is their mobile number.', 'Worker Added!');
      setTimeout(() => { if (canGoBack) navigation.goBack(); }, 1500);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not register worker', 'Registration Failed');
    },
  });

  const onSubmit = handleSubmit((values) => {
    if (!stateVal || !districtVal) {
      toast.warning('Please select state and district.', 'Required Fields');
      return;
    }
    if (selectedCategories.length === 0) {
      toast.warning('Please select at least one area of work.', 'Required Fields');
      return;
    }
    mutation.mutate(values);
  });

  return (
    <View style={styles.root}>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <View >
    
        {canGoBack && (
        
              <ScreenHeader
                  title="Add Worker"
                  onBack={() => navigation.goBack()}
                  onRightPress={() => navigation.navigate('AddWorker')}
                />
                
        )}

      
      </View>

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
          <SectionCard icon="👤" title="Basic Information" theme={theme}>
            <FormInput control={control} name="name" label="Full Name *" placeholder="Worker's full name" />
            <FormInput control={control} name="mobile" label="Mobile Number *" placeholder="10-digit number" keyboardType="phone-pad" maxLength={10} />
            <Controller
              control={control}
              name="gender"
              render={({ field, fieldState }) => (
                <FormSelect
                  label="Gender"
                  value={field.value ?? ''}
                  options={GENDER_OPTIONS}
                  onChange={(v) => field.onChange(v as 'Male' | 'Female' | 'Other')}
                  errorText={fieldState.error?.message}
                />
              )}
            />
            <FormInput control={control} name="dob" label="Age" placeholder="Age" keyboardType="numbers-and-punctuation" />
            <FormInput control={control} name="address" label="Village / Town / Address" placeholder="Local address" />
          </SectionCard>

          {/* Location */}
          <SectionCard icon="📍" title="Location" theme={theme}>
            <LocationSelector
              state={stateVal}
              district={districtVal}
              block={tehsilVal}
              onStateChange={(v) => { setStateVal(v); setDistrictVal(''); setTehsilVal(''); }}
              onDistrictChange={(v) => { setDistrictVal(v); setTehsilVal(''); }}
              onBlockChange={setTehsilVal}
              blockLabel="Block / Tehsil"
            />
            <FormInput
              control={control}
              name="pinCode"
              label="PIN Code"
              placeholder="6-digit area PIN code"
              keyboardType="number-pad"
              maxLength={6}
            />
          </SectionCard>

          {/* Areas of Work */}
          <SectionCard
            icon="💼"
            title={`Areas of Work${selectedCategories.length > 0 ? `  ·  ${selectedCategories.length} selected` : ''}`}
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
                      numberOfLines={2}
                    >
                      {cat.label}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
            {selectedCategories.length === 0 && (
              <AppText variant="caption" color={theme.colors.mutedText} style={styles.chipHint}>
                Tap to select work categories
              </AppText>
            )}
          </SectionCard>

          {/* Experience */}
          <SectionCard icon="⭐" title="Experience & Skills" theme={theme}>
            <Controller
              control={control}
              name="workExperience"
              render={({ field, fieldState }) => (
                <FormSelect
                  label="Work Experience"
                  value={field.value ?? ''}
                  options={EXPERIENCE_OPTIONS}
                  onChange={field.onChange}
                  errorText={fieldState.error?.message}
                />
              )}
            />
          </SectionCard>

          {/* Salary */}
          <SectionCard icon="💰" title="Salary Preference" theme={theme}>
            <Controller
              control={control}
              name="salaryType"
              render={({ field }) => (
                <FormSelect
                  label="Salary Type"
                  value={field.value ?? ''}
                  options={SALARY_TYPE_OPTIONS}
                  onChange={field.onChange}
                />
              )}
            />
            {salaryType === 'Fixed' && (
              <FormInput control={control} name="fixedSalary" label="Fixed Daily Rate (₹)" placeholder="500" keyboardType="numeric" />
            )}
            {salaryType === 'Ranged' && (
              <View style={styles.rangeRow}>
                <View style={styles.rangeField}>
                  <FormInput control={control} name="salaryFrom" label="From (₹/day)" placeholder="400" keyboardType="numeric" />
                </View>
                <View style={styles.rangeField}>
                  <FormInput control={control} name="salaryTo" label="To (₹/day)" placeholder="700" keyboardType="numeric" />
                </View>
              </View>
            )}
          </SectionCard>

          {/* Bank Details */}
          <SectionCard icon="🏦" title="Bank Details  ·  Optional" theme={theme}>
            <FormInput control={control} name="bankAccount" label="Account Number" placeholder="123456789012" keyboardType="number-pad" />
            <FormInput control={control} name="ifscCode" label="IFSC Code" placeholder="SBIN0001234" />
            <FormInput control={control} name="bankName" label="Bank Name" placeholder="State Bank of India" />
          </SectionCard>

          {/* Notes */}
          <SectionCard icon="📝" title="Notes" theme={theme}>
            <FormInput
              control={control}
              name="description"
              label="Additional Details"
              placeholder="Any notes about this worker…"
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
              The worker's initial login password will be their mobile number. They can change it after first login.
            </AppText>
          </View>

          <AppButton
            title="Register Worker"
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
  chipText:  { fontWeight: '600' },
  chipHint:  { marginTop: 8, fontStyle: 'italic' },

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
