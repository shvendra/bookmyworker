import React, { useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
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
import { AppCard } from '../../../shared/components/ui/AppCard';
import { useAppTheme } from '../../../core/theme';
import { useToast } from '../../../shared/state/toast/ToastContext';
import type { MainStackParamList } from '../../../app/navigation/types';
import categoriesData from '../../../shared/data/categories.json';

interface CatEntry { label: string; value: string; subcategories: Array<{ label: string; value: string }> }
const ALL_CATS: CatEntry[] = categoriesData as CatEntry[];

type Nav = NativeStackNavigationProp<MainStackParamList>;

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

export const AddWorkerScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const canGoBack = navigation.canGoBack();

  const [stateVal, setStateVal] = useState('');
  const [districtVal, setDistrictVal] = useState('');
  const [tehsilVal, setTehsilVal] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
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
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title="Add Worker" onBack={canGoBack ? () => navigation.goBack() : undefined} />
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <AppText variant="title">Add Worker</AppText>
      <AppText variant="body" color={theme.colors.mutedText} style={styles.subtitle}>
        Register a new worker under your account.
      </AppText>

      {/* BASIC INFO */}
      <SectionLabel label="BASIC INFO" theme={theme} />
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
      <FormInput control={control} name="dob" label="Date of Birth" placeholder="DD/MM/YYYY" keyboardType="numbers-and-punctuation" />
      <FormInput control={control} name="address" label="Village / Town / Address" placeholder="Local address" />

      {/* LOCATION */}
      <SectionLabel label="LOCATION" theme={theme} />
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

      {/* AREAS OF WORK */}
      <SectionLabel label={`AREAS OF WORK (${selectedCategories.length} selected)`} theme={theme} />
      <View style={styles.chipGrid}>
        {ALL_CATS.map((cat) => {
          const selected = selectedCategories.includes(cat.value);
          return (
            <TouchableOpacity
              key={cat.value}
              onPress={() => toggleCategory(cat.value)}
              style={[styles.chip, {
                backgroundColor: selected ? theme.colors.primary : theme.colors.card,
                borderColor: selected ? theme.colors.primary : theme.colors.border,
              }]}
            >
              <AppText variant="caption" color={selected ? '#fff' : theme.colors.text} style={styles.chipText} numberOfLines={2}>
                {cat.label}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* WORK EXPERIENCE */}
      <SectionLabel label="WORK EXPERIENCE" theme={theme} />
      <Controller
        control={control}
        name="workExperience"
        render={({ field, fieldState }) => (
          <FormSelect
            label="Experience"
            value={field.value ?? ''}
            options={EXPERIENCE_OPTIONS}
            onChange={field.onChange}
            errorText={fieldState.error?.message}
          />
        )}
      />

      {/* SALARY */}
      <SectionLabel label="SALARY PREFERENCE" theme={theme} />
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

      {/* BANK DETAILS */}
      <SectionLabel label="BANK DETAILS (Optional)" theme={theme} />
      <AppCard style={styles.card}>
        <FormInput control={control} name="bankAccount" label="Account Number" placeholder="123456789012" keyboardType="number-pad" />
        <FormInput control={control} name="ifscCode" label="IFSC Code" placeholder="SBIN0001234" />
        <FormInput control={control} name="bankName" label="Bank Name" placeholder="State Bank of India" />
      </AppCard>

      {/* NOTES */}
      <SectionLabel label="NOTES / DESCRIPTION" theme={theme} />
      <FormInput
        control={control}
        name="description"
        label="Additional Details"
        placeholder="Any notes about this worker…"
        multiline
        numberOfLines={3}
        style={styles.textarea}
      />

      <AppText variant="caption" color={theme.colors.mutedText} style={styles.notice}>
        The worker's initial password will be their mobile number. They can change it after logging in.
      </AppText>

      <AppButton
        title="Register Worker"
        onPress={onSubmit}
        loading={mutation.isPending}
        style={styles.submitBtn}
      />
    </ScrollView>
    </View>
  );
};

const SectionLabel = ({ label, theme }: { label: string; theme: ReturnType<typeof useAppTheme>['theme'] }): React.JSX.Element => (
  <AppText variant="label" style={[styles.sectionLabel, { color: theme.colors.mutedText }]}>{label}</AppText>
);

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  subtitle: { marginTop: 4, marginBottom: 20 },
  sectionLabel: {
    marginTop: 20, marginBottom: 8,
    textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.8, fontWeight: '700',
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, maxWidth: '48%' },
  chipText: { fontWeight: '600', textAlign: 'center' },
  rangeRow: { flexDirection: 'row', gap: 10 },
  rangeField: { flex: 1 },
  card: { marginBottom: 4 },
  textarea: { height: 80, textAlignVertical: 'top' },
  notice: { textAlign: 'center', marginTop: 12, marginBottom: 4 },
  submitBtn: { marginTop: 16 },
});
