import { zodResolver } from '@hookform/resolvers/zod';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { Controller, useForm } from 'react-hook-form';
import { useAppTheme } from '../../../core/theme';
import { Screen } from '../../../shared/components/layout/Screen';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { FormInput } from '../../../shared/components/forms/FormInput';
import { FormSelect } from '../../../shared/components/forms/FormSelect';
import { LocationSelector } from '../../../shared/components/forms/LocationSelector';
import { authService } from '../services/authService';
import { registerStep2Schema, type RegisterStep2Values } from '../validation/authSchemas';
import { ROUTES } from '../../../shared/constants/routes';
import type { AuthStackParamList } from '../../../app/navigation/types';
import * as DocumentPicker from 'expo-document-picker';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;
type Role = 'Employer' | 'Agent' | 'SelfWorker';

const ROLES: Array<{ value: Role; label: string; description: string; icon: string }> = [
  { value: 'Employer', label: 'Employer', description: 'Post requirements & hire workers', icon: '🏢' },
  { value: 'Agent', label: 'Agent', description: 'Connect workers with employers & earn commission', icon: '🤝' },
  { value: 'SelfWorker', label: 'Job Seeker', description: 'Find work & earn daily wages', icon: '👷' },
];

const WORKER_SUB_TYPES = [
  { value: 'Skilled', label: 'Skilled', description: 'Experienced in a specific trade or craft', icon: '🔧' },
  { value: 'Unskilled', label: 'Unskilled', description: 'General labour, no specific skill required', icon: '🏗️' },
  { value: 'ITI/Diploma', label: 'ITI / Diploma', description: 'ITI or Diploma certificate holder', icon: '🎓' },
  { value: 'Graduate', label: 'Graduate', description: "Bachelor's degree or above", icon: '📜' },
];

const AGENT_TYPES = [
  { value: 'Group worker supplier', label: 'Group Worker Supplier', description: 'Supply groups / teams of workers', icon: '👥' },
  { value: 'Skilled worker supplier', label: 'Skilled Worker Supplier', description: 'Supply skilled trade workers', icon: '🔧' },
  { value: 'Unskilled worker supplier', label: 'Unskilled Worker Supplier', description: 'Supply unskilled / general workers', icon: '🏗️' },
  { value: 'Contract worker supplier', label: 'Contract Worker Supplier', description: 'Supply workers on contract basis', icon: '📋' },
];

const EXPERIENCE_OPTIONS = ['Fresher', ...Array.from({ length: 20 }, (_, i) => `${i + 1} year${i !== 0 ? 's' : ''}`)];
const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const SALARY_TYPE_OPTIONS = ['Fixed', 'Ranged'];

export const RegisterScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const toast = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [workerSubType, setWorkerSubType] = useState<string>('');
  const [agentType, setAgentType] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [resumeUri, setResumeUri] = useState<string | null>(null);
  const [resumeName, setResumeName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<RegisterStep2Values>({
    resolver: zodResolver(registerStep2Schema),
    defaultValues: {
      name: '', phone: '', password: '', confirmPassword: '',
      state: '', district: '', block: '', pinCode: '',
      email: '', referredBy: '',
      gender: undefined, dob: '', address: '',
      workExperience: '', salaryType: '', fixedSalary: '', salaryFrom: '', salaryTo: '',
    },
  });

  const stateVal = watch('state');
  const districtVal = watch('district');
  const blockVal = watch('block');
  const salaryType = watch('salaryType');

  const toggleSubcategory = (value: string): void => {
    setSelectedSubcategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  const handleCategorySelect = (value: string): void => {
    setSelectedCategory(value);
    setSelectedSubcategories([]);
  };

  const canProceedFromStep1 = (): boolean => {
    if (!role) return false;
    if (role === 'Employer') return true;
    if (role === 'Agent') return agentType !== '';
    if (role === 'SelfWorker') return workerSubType !== '';
    return false;
  };

  const onSelectRole = (r: Role): void => {
    setRole(r);
    setWorkerSubType('');
    setAgentType('');
    if (r === 'Employer') setStep(2);
  };

  const onContinueFromStep1 = (): void => {
    if (canProceedFromStep1()) setStep(2);
  };

  const pickResume = async (): Promise<void> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        setResumeUri(result.assets[0].uri);
        setResumeName(result.assets[0].name);
      }
    } catch {
      toast.error('Could not pick file. Try again.', 'Error');
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!role) return;
    if (!values.state || !values.district) {
      toast.warning('Please select your state and district.', 'Required');
      return;
    }
    setIsLoading(true);
    try {
      await authService.requestOtp(values.phone, undefined);
      navigation.navigate(ROUTES.AUTH.REGISTER_OTP, {
        phone: values.phone, role,
        name: values.name, password: values.password,
        state: values.state, district: values.district, block: values.block,
        pinCode: values.pinCode ?? undefined,
        email: values.email ?? undefined, referredBy: values.referredBy ?? undefined,
        gender: values.gender, dob: values.dob, address: values.address,
        areasOfWork: selectedCategory ? [selectedCategory] : undefined,
        categories: selectedSubcategories.length > 0 ? selectedSubcategories : undefined,
        workExperience: values.workExperience, salaryType: values.salaryType,
        fixedSalary: values.fixedSalary, salaryFrom: values.salaryFrom, salaryTo: values.salaryTo,
        workerSubType: workerSubType || undefined,
        agentType: agentType || undefined,
        resumeUri: resumeUri ?? undefined,
        resumeName: resumeName ?? undefined,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send OTP. Please try again.', 'Error');
    } finally {
      setIsLoading(false);
    }
  });

  const showResume = role === 'SelfWorker' && (workerSubType === 'ITI/Diploma' || workerSubType === 'Graduate');

  // ── Step 1: Role Selection + Sub-type ──
  if (step === 1) {
    const subTypes = role === 'SelfWorker' ? WORKER_SUB_TYPES : role === 'Agent' ? AGENT_TYPES : [];
    const selectedSubTypeVal = role === 'SelfWorker' ? workerSubType : role === 'Agent' ? agentType : '';
    const setSubType = role === 'SelfWorker' ? setWorkerSubType : setAgentType;

    return (
      <Screen scrollable>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <AppText variant="body" color={theme.colors.primary}>← Back</AppText>
        </TouchableOpacity>
        <AppText variant="title" style={styles.title}>Create Account</AppText>
        <AppText variant="body" color={theme.colors.mutedText} style={styles.subtitle}>
          Select how you want to use BookMyWorkers
        </AppText>

        {/* Role cards */}
        <View style={styles.roleList}>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r.value}
              style={[styles.roleCard, {
                borderColor: role === r.value ? theme.colors.primary : theme.colors.border,
                backgroundColor: role === r.value ? theme.colors.primary + '10' : theme.colors.card,
              }]}
              onPress={() => onSelectRole(r.value)}
              activeOpacity={0.75}
            >
              <AppText style={styles.roleIcon}>{r.icon}</AppText>
              <View style={styles.roleContent}>
                <AppText variant="label" color={role === r.value ? theme.colors.primary : theme.colors.text}>
                  {r.label}
                </AppText>
                <AppText variant="caption" color={theme.colors.mutedText} style={styles.roleDesc}>
                  {r.description}
                </AppText>
              </View>
              <View style={[styles.radioOuter, { borderColor: role === r.value ? theme.colors.primary : theme.colors.border }]}>
                {role === r.value && <View style={[styles.radioInner, { backgroundColor: theme.colors.primary }]} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sub-type selection */}
        {subTypes.length > 0 && (
          <>
            <AppText variant="label" style={[styles.subTypeHeading, { color: theme.colors.mutedText }]}>
              {role === 'SelfWorker' ? 'I AM A' : 'MY ROLE AS AGENT'}
            </AppText>
            <View style={styles.roleList}>
              {subTypes.map((st) => (
                <TouchableOpacity
                  key={st.value}
                  style={[styles.roleCard, {
                    borderColor: selectedSubTypeVal === st.value ? '#F97316' : theme.colors.border,
                    backgroundColor: theme.colors.card,
                  }]}
                  onPress={() => setSubType(st.value)}
                  activeOpacity={0.75}
                >
                  <AppText style={styles.roleIcon}>{st.icon}</AppText>
                  <View style={styles.roleContent}>
                    <AppText variant="label" color={theme.colors.text}>
                      {st.label}
                    </AppText>
                    <AppText variant="caption" color={theme.colors.mutedText} style={styles.roleDesc}>
                      {st.description}
                    </AppText>
                  </View>
                  <View style={[styles.radioOuter, { borderColor: selectedSubTypeVal === st.value ? '#F97316' : theme.colors.border }]} />
                </TouchableOpacity>
              ))}
            </View>

            <AppButton
              title="Continue →"
              onPress={onContinueFromStep1}
              style={[styles.continueBtn, { opacity: canProceedFromStep1() ? 1 : 0.4 }]}
              disabled={!canProceedFromStep1()}
            />
          </>
        )}

        <AppText variant="caption" color={theme.colors.mutedText} style={styles.loginHint}>
          Already have an account?{' '}
          <AppText variant="caption" color={theme.colors.primary} onPress={() => navigation.navigate(ROUTES.AUTH.LOGIN)}>
            Log in
          </AppText>
        </AppText>
      </Screen>
    );
  }

  // ── Step 2: Registration Form ──
  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn}>
        <AppText variant="body" color={theme.colors.primary}>← Change Role</AppText>
      </TouchableOpacity>
      <AppText variant="title" style={styles.title}>
        Register as {role === 'SelfWorker' ? 'Job Seeker' : role}
      </AppText>
      {(workerSubType || agentType) && (
        <View style={[styles.subTypeBadge, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '40' }]}>
          <AppText variant="caption" color={theme.colors.primary} style={{ fontWeight: '700' }}>
            {workerSubType || agentType}
          </AppText>
        </View>
      )}
      <AppText variant="body" color={theme.colors.mutedText} style={styles.subtitle}>
        Fill in your details below
      </AppText>

      {/* BASIC INFO */}
      <SectionLabel label="BASIC INFO" theme={theme} />
      <FormInput control={control} name="name" label="Full Name *" placeholder="Ramesh Kumar" />
      <FormInput control={control} name="phone" label="Mobile Number *" placeholder="9876543210" keyboardType="phone-pad" maxLength={10} />
      <FormInput control={control} name="email" label={`Email${role === 'SelfWorker' ? ' (Optional)' : ' *'}`} placeholder="email@example.com" keyboardType="email-address" />

      {/* LOCATION */}
      <SectionLabel label="LOCATION" theme={theme} />
      <LocationSelector
        state={stateVal}
        district={districtVal}
        block={blockVal}
        onStateChange={(v) => { setValue('state', v, { shouldValidate: true }); setValue('district', ''); setValue('block', ''); }}
        onDistrictChange={(v) => { setValue('district', v, { shouldValidate: true }); setValue('block', ''); }}
        onBlockChange={(v) => setValue('block', v, { shouldValidate: true })}
        stateError={errors.state?.message}
        districtError={errors.district?.message}
        blockError={errors.block?.message}
      />
      <FormInput
        control={control}
        name="pinCode"
        label="PIN Code"
        placeholder="6-digit area PIN code"
        keyboardType="number-pad"
        maxLength={6}
      />

      {/* WORK INFO — SelfWorker only */}
      {role === 'SelfWorker' && (
        <>
          <SectionLabel label="WORK INFO" theme={theme} />

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
          <FormInput control={control} name="address" label="Village / Town / Address" placeholder="Your local address" />

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

          {/* Category — single select */}
          <AppText variant="caption" style={[styles.sectionLabel, { color: theme.colors.mutedText }]}>
            WORK CATEGORY {selectedCategory ? `— ${ALL_CATS.find(c => c.value === selectedCategory)?.label ?? ''}` : '(select one)'}
          </AppText>
          <CategoryChips
            items={ALL_CATS.map(c => ({ label: c.label, value: c.value }))}
            selected={selectedCategory ? [selectedCategory] : []}
            onToggle={handleCategorySelect}
            theme={theme}
          />

          {/* Subcategory */}
          {selectedCategory !== '' && (() => {
            const cat = ALL_CATS.find(c => c.value === selectedCategory);
            if (!cat || cat.subcategories.length === 0) return null;
            return (
              <>
                <AppText variant="caption" style={[styles.sectionLabel, { color: theme.colors.mutedText }]}>
                  SUBCATEGORY ({selectedSubcategories.length} selected)
                </AppText>
                <CategoryChips
                  items={cat.subcategories.map(s => ({ label: s.label, value: s.value }))}
                  selected={selectedSubcategories}
                  onToggle={toggleSubcategory}
                  theme={theme}
                />
              </>
            );
          })()}

          {/* Salary */}
          <AppText variant="caption" style={[styles.sectionLabel, { color: theme.colors.mutedText }]}>
            EXPECTED SALARY
          </AppText>
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

          {/* Resume upload — ITI/Diploma & Graduate only */}
          {showResume && (
            <>
              <SectionLabel label="RESUME / CV" theme={theme} />
              <TouchableOpacity
                onPress={() => void pickResume()}
                style={[styles.resumeBtn, {
                  borderColor: resumeUri ? theme.colors.primary : theme.colors.border,
                  backgroundColor: resumeUri ? theme.colors.primary + '10' : theme.colors.card,
                }]}
                activeOpacity={0.75}
              >
                <AppText style={styles.resumeIcon}>{resumeUri ? '📄' : '⬆️'}</AppText>
                <View style={{ flex: 1 }}>
                  <AppText variant="label" color={resumeUri ? theme.colors.primary : theme.colors.text}>
                    {resumeUri ? 'Resume Uploaded' : 'Upload Resume / CV'}
                  </AppText>
                  <AppText variant="caption" color={theme.colors.mutedText} numberOfLines={1}>
                    {resumeName ?? 'PDF or Word document (optional)'}
                  </AppText>
                </View>
                {resumeUri && (
                  <TouchableOpacity onPress={() => { setResumeUri(null); setResumeName(null); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <AppText style={{ color: theme.colors.mutedText, fontSize: 16 }}>✕</AppText>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </>
          )}
        </>
      )}

      {/* SECURITY */}
      <SectionLabel label="SECURITY" theme={theme} />
      <FormInput control={control} name="password" label="Password *" placeholder="Min 6 characters" secureTextEntry />
      <FormInput control={control} name="confirmPassword" label="Confirm Password *" placeholder="Re-enter password" secureTextEntry />

      {/* OPTIONAL */}
      <SectionLabel label="OPTIONAL" theme={theme} />
      <FormInput control={control} name="referredBy" label="Referred By (Agent Mobile)" placeholder="Agent's 10-digit number" keyboardType="phone-pad" maxLength={10} />

      <AppText variant="caption" color={theme.colors.mutedText} style={styles.otpNotice}>
        An OTP will be sent to your mobile via WhatsApp to verify your number.
      </AppText>

      <AppButton title="Continue to OTP" onPress={onSubmit} loading={isLoading} style={styles.submitBtn} />

      <View style={styles.loginLink}>
        <AppText variant="caption" color={theme.colors.mutedText}>Already have an account? </AppText>
        <TouchableOpacity onPress={() => navigation.navigate(ROUTES.AUTH.LOGIN)}>
          <AppText variant="caption" color={theme.colors.primary}>Log in</AppText>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// ── Helper components ────────────────────────────────────────────────────────

const SectionLabel = ({ label, theme }: { label: string; theme: ReturnType<typeof useAppTheme>['theme'] }): React.JSX.Element => (
  <AppText variant="label" style={[styles.sectionLabel, { color: theme.colors.mutedText }]}>{label}</AppText>
);

import categoriesData from '../../../shared/data/categories.json';

interface CatRaw { label: string; value: string; subcategories: Array<{ label: string; value: string }> }
const ALL_CATS: CatRaw[] = categoriesData as CatRaw[];

const CategoryChips = ({
  items, selected, onToggle, theme
}: {
  items: Array<{ label: string; value: string }>;
  selected: string[];
  onToggle: (v: string) => void;
  theme: ReturnType<typeof useAppTheme>['theme'];
}): React.JSX.Element => (
  <View style={styles.chipGrid}>
    {items.map((item) => {
      const isSelected = selected.includes(item.value);
      return (
        <TouchableOpacity
          key={item.value}
          onPress={() => onToggle(item.value)}
          style={[styles.chip, {
            backgroundColor: isSelected ? theme.colors.primary : theme.colors.card,
            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
          }]}
        >
          <AppText variant="caption" color={isSelected ? '#fff' : theme.colors.text} style={styles.chipText} numberOfLines={2}>
            {item.label}
          </AppText>
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  backBtn: { marginBottom: 12 },
  title: { marginBottom: 4 },
  subtitle: { marginBottom: 20 },
  sectionLabel: {
    marginTop: 16, marginBottom: 8,
    textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.8, fontWeight: '700',
  },
  subTypeHeading: {
    marginTop: 20, marginBottom: 10,
    textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.8, fontWeight: '700',
  },
  roleList: { gap: 12 },
  roleCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 14, padding: 16, gap: 12 },
  roleIcon: { fontSize: 24, width: 32 },
  roleContent: { flex: 1 },
  roleDesc: { marginTop: 2 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  loginHint: { textAlign: 'center', marginTop: 24 },
  continueBtn: { marginTop: 20 },
  subTypeBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, maxWidth: '48%' },
  chipText: { fontWeight: '600', textAlign: 'center' },
  rangeRow: { flexDirection: 'row', gap: 10 },
  rangeField: { flex: 1 },
  resumeBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 14, padding: 16, gap: 12, marginBottom: 8 },
  resumeIcon: { fontSize: 24, width: 32 },
  otpNotice: { marginTop: 8, marginBottom: 4, textAlign: 'center' },
  submitBtn: { marginTop: 16 },
  loginLink: { flexDirection: 'row', justifyContent: 'center', marginTop: 16, marginBottom: 8 },
});
