import { zodResolver } from '@hookform/resolvers/zod';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';

import { useAppTheme } from '../../../../packages/shared-mobile/src/core/theme';
import { AppButton } from '../../../../packages/shared-mobile/src/shared/components/ui/AppButton';
import { AppText } from '../../../../packages/shared-mobile/src/shared/components/ui/AppText';
import { AppInput } from '../../../../packages/shared-mobile/src/shared/components/ui/AppInput';
import { LocationSelector } from '../../../../packages/shared-mobile/src/shared/components/forms/LocationSelector';
import { FormSelect } from '../../../../packages/shared-mobile/src/shared/components/forms/FormSelect';
import { CategorySelector } from '../../../../packages/shared-mobile/src/shared/components/forms/CategorySelector';
import { authService } from '../../../../packages/shared-mobile/src/features/auth/services/authService';
import {
  registerStep2Schema,
  type RegisterStep2Values,
} from '../../../../packages/shared-mobile/src/features/auth/validation/authSchemas';
import type { AgentStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AgentStackParamList, 'Register'>;
type Role = 'Agent' | 'SelfWorker';

const ROLE_OPTIONS: Array<{ value: Role; label: string; description: string; icon: string }> = [
  {
    value: 'Agent',
    label: 'Agent',
    description: 'Connect workers with employers & earn commission',
    icon: '🤝',
  },
  {
    value: 'SelfWorker',
    label: 'Job Seeker',
    description: 'Find work opportunities & earn daily wages',
    icon: '👷',
  },
];

const EXPERIENCE_OPTIONS = [
  'Fresher',
  ...Array.from({ length: 20 }, (_, i) => `${i + 1} year${i !== 0 ? 's' : ''}`),
];
const SALARY_TYPE_OPTIONS = ['Fixed', 'Ranged'];

export const AgentRegisterScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterStep2Values>({
    resolver: zodResolver(registerStep2Schema),
    defaultValues: {
      name: '',
      phone: '',
      password: '',
      confirmPassword: '',
      state: '',
      district: '',
      block: '',
      pinCode: '',
      email: '',
      referredBy: '',
      gender: undefined,
      dob: '',
      address: '',
      workExperience: '',
      salaryType: '',
      fixedSalary: '',
      salaryFrom: '',
      salaryTo: '',
    },
  });

  const stateVal = watch('state');
  const districtVal = watch('district');
  const blockVal = watch('block');
  const salaryType = watch('salaryType');

  const onSelectRole = (r: Role): void => {
    setRole(r);
    setStep(2);
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!role) return;
    if (!values.state || !values.district) {
      Alert.alert('Required', 'Please select your state and district.');
      return;
    }
    setIsLoading(true);
    try {
      await authService.requestOtp(values.phone, undefined);
      navigation.navigate('RegisterOtp', {
        phone: values.phone,
        role,
        name: values.name,
        password: values.password,
        state: values.state,
        district: values.district,
        block: values.block,
        pinCode: values.pinCode ?? undefined,
        email: values.email ?? undefined,
        referredBy: values.referredBy ?? undefined,
        gender: values.gender,
        dob: values.dob,
        address: values.address,
        areasOfWork: selectedCategory ? [selectedCategory] : undefined,
        categories: selectedSubCategory ? [selectedSubCategory] : undefined,
        workExperience: values.workExperience,
        salaryType: values.salaryType,
        fixedSalary: values.fixedSalary,
        salaryFrom: values.salaryFrom,
        salaryTo: values.salaryTo,
      });
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  });

  const isDark = theme.mode === 'dark';
  const teal = '#0891B2';

  // ── Step 1: Role selection ──────────────────────────────────────────────────
  if (step === 1) {
    return (
      <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F0FDFF' }]}>
        <StatusBar barStyle="light-content" backgroundColor={teal} />

        {/* Header */}
        <View style={[styles.header, { backgroundColor: teal }]}>
          <SafeAreaView>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <AppText style={styles.backArrow} color="#FFFFFF">‹</AppText>
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <View style={styles.headerIconWrap}>
                <AppText style={styles.headerIcon}>📋</AppText>
              </View>
              <View style={styles.headerTextWrap}>
                <AppText variant="heading" color="#FFFFFF" style={styles.headerTitle}>
                  Join BookMyWorker
                </AppText>
                <AppText variant="caption" color="rgba(255,255,255,0.75)">
                  Choose how you want to participate
                </AppText>
              </View>
            </View>
          </SafeAreaView>
          <View style={[styles.deco, styles.deco1]} />
          <View style={[styles.deco, styles.deco2]} />
        </View>

        <ScrollView
          contentContainerStyle={styles.roleScroll}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.roleCard,
              { backgroundColor: theme.colors.card },
              !isDark && styles.cardShadow,
            ]}
          >
            <AppText variant="subtitle" color={theme.colors.text} style={styles.roleTitle}>
              I want to...
            </AppText>
            <AppText variant="body" color={theme.colors.mutedText} style={styles.roleSub}>
              Select the role that describes you best
            </AppText>

            <View style={styles.roleOptions}>
              {ROLE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => onSelectRole(opt.value)}
                  activeOpacity={0.85}
                  style={[
                    styles.roleOption,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <View style={[styles.roleIconWrap, { backgroundColor: teal + '18' }]}>
                    <AppText style={styles.roleIcon}>{opt.icon}</AppText>
                  </View>
                  <View style={styles.roleTextWrap}>
                    <AppText variant="label" color={theme.colors.text}>
                      {opt.label}
                    </AppText>
                    <AppText variant="caption" color={theme.colors.mutedText} style={styles.roleDesc}>
                      {opt.description}
                    </AppText>
                  </View>
                  <AppText style={[styles.roleArrow, { color: teal }]}>›</AppText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.loginRow}>
            <AppText variant="body" color={theme.colors.mutedText}>
              Already have an account?{' '}
            </AppText>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <AppText variant="body" color={teal} style={styles.loginLink}>
                Sign In
              </AppText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Step 2: Registration form ───────────────────────────────────────────────
  const isWorker = role === 'SelfWorker';

  return (
    <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F0FDFF' }]}>
      <StatusBar barStyle="light-content" backgroundColor={teal} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: teal }]}>
        <SafeAreaView>
          <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn}>
            <AppText style={styles.backArrow} color="#FFFFFF">‹</AppText>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.headerIconWrap}>
              <AppText style={styles.headerIcon}>
                {role === 'Agent' ? '🤝' : '👷'}
              </AppText>
            </View>
            <View style={styles.headerTextWrap}>
              <AppText variant="heading" color="#FFFFFF" style={styles.headerTitle}>
                {role === 'Agent' ? 'Agent Registration' : 'Job Seeker Registration'}
              </AppText>
              <AppText variant="caption" color="rgba(255,255,255,0.75)">
                {role === 'Agent'
                  ? 'Register as an agent to earn commissions'
                  : 'Register to find work opportunities'}
              </AppText>
            </View>
          </View>
        </SafeAreaView>
        <View style={[styles.deco, styles.deco1]} />
        <View style={[styles.deco, styles.deco2]} />
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.card },
              !isDark && styles.cardShadow,
            ]}
          >
            <AppText variant="subtitle" color={theme.colors.text} style={styles.cardTitle}>
              Your Details
            </AppText>

            {/* Name */}
            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                Full Name
              </AppText>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Enter your full name"
                    errorText={errors.name?.message}
                  />
                )}
              />
            </View>

            {/* Phone */}
            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                Mobile Number
              </AppText>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="9876543210"
                    keyboardType="phone-pad"
                    leadingIcon="+91"
                    maxLength={10}
                    errorText={errors.phone?.message}
                  />
                )}
              />
            </View>

            {/* Password */}
            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                Password
              </AppText>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Min 6 characters"
                    secureTextEntry
                    errorText={errors.password?.message}
                  />
                )}
              />
            </View>

            {/* Confirm Password */}
            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                Confirm Password
              </AppText>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Re-enter password"
                    secureTextEntry
                    errorText={errors.confirmPassword?.message}
                  />
                )}
              />
            </View>

            {/* Email */}
            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                Email (optional)
              </AppText>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="your@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    errorText={errors.email?.message}
                  />
                )}
              />
            </View>

            {/* Location */}
            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                Location
              </AppText>
              <LocationSelector
                state={stateVal}
                district={districtVal}
                block={blockVal}
                onStateChange={(v) => setValue('state', v)}
                onDistrictChange={(v) => setValue('district', v)}
                onBlockChange={(v) => setValue('block', v)}
                stateError={errors.state?.message}
                districtError={errors.district?.message}
                blockError={errors.block?.message}
              />
            </View>

            {/* Worker-specific fields */}
            {isWorker && (
              <>
                {/* Work Category */}
                <View style={styles.field}>
                  <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                    Work Category
                  </AppText>
                  <CategorySelector
                    category={selectedCategory}
                    subCategory={selectedSubCategory}
                    onCategoryChange={(v) => { setSelectedCategory(v); setSelectedSubCategory(''); }}
                    onSubCategoryChange={(v) => setSelectedSubCategory(v)}
                  />
                </View>

                {/* Work Experience */}
                <View style={styles.field}>
                  <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                    Work Experience
                  </AppText>
                  <Controller
                    control={control}
                    name="workExperience"
                    render={({ field: { onChange, value } }) => (
                      <FormSelect
                        label="Work Experience"
                        options={EXPERIENCE_OPTIONS}
                        value={value ?? ''}
                        onChange={onChange}
                        placeholder="Select experience"
                      />
                    )}
                  />
                </View>

                {/* Salary Type */}
                <View style={styles.field}>
                  <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                    Expected Salary Type (optional)
                  </AppText>
                  <Controller
                    control={control}
                    name="salaryType"
                    render={({ field: { onChange, value } }) => (
                      <FormSelect
                        label="Salary Type"
                        options={SALARY_TYPE_OPTIONS}
                        value={value ?? ''}
                        onChange={onChange}
                        placeholder="Select type"
                      />
                    )}
                  />
                </View>

                {salaryType === 'Fixed' && (
                  <View style={styles.field}>
                    <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                      Expected Daily Wage (₹)
                    </AppText>
                    <Controller
                      control={control}
                      name="fixedSalary"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <AppInput
                          value={value ?? ''}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          placeholder="e.g. 500"
                          keyboardType="number-pad"
                        />
                      )}
                    />
                  </View>
                )}

                {salaryType === 'Ranged' && (
                  <View style={styles.salaryRow}>
                    <View style={[styles.field, styles.salaryHalf]}>
                      <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                        Min (₹)
                      </AppText>
                      <Controller
                        control={control}
                        name="salaryFrom"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <AppInput
                            value={value ?? ''}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            placeholder="e.g. 400"
                            keyboardType="number-pad"
                          />
                        )}
                      />
                    </View>
                    <View style={[styles.field, styles.salaryHalf]}>
                      <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                        Max (₹)
                      </AppText>
                      <Controller
                        control={control}
                        name="salaryTo"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <AppInput
                            value={value ?? ''}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            placeholder="e.g. 700"
                            keyboardType="number-pad"
                          />
                        )}
                      />
                    </View>
                  </View>
                )}
              </>
            )}

            {/* Referred By */}
            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                Referred By (optional)
              </AppText>
              <Controller
                control={control}
                name="referredBy"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Referral mobile number"
                    keyboardType="phone-pad"
                    maxLength={10}
                    errorText={errors.referredBy?.message}
                  />
                )}
              />
            </View>

            <AppButton
              title="Send OTP & Register"
              onPress={onSubmit}
              loading={isLoading}
              size="lg"
              fullWidth
              style={styles.submitBtn}
            />
          </View>

          <View style={styles.loginRow}>
            <AppText variant="body" color={theme.colors.mutedText}>
              Already have an account?{' '}
            </AppText>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <AppText variant="body" color={teal} style={styles.loginLink}>
                Sign In
              </AppText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    overflow: 'hidden',
    minHeight: 160,
    justifyContent: 'flex-end',
  },
  backBtn: { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 8, paddingBottom: 4 },
  backArrow: { fontSize: 28, lineHeight: 32, fontWeight: '300' },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 8 },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: { fontSize: 26, lineHeight: 30 },
  headerTextWrap: { gap: 2, flex: 1 },
  headerTitle: { lineHeight: 26 },
  deco: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)' },
  deco1: { width: 180, height: 180, top: -60, right: -40 },
  deco2: { width: 100, height: 100, bottom: -20, right: 80 },

  // Role selection
  roleScroll: { padding: 20, paddingBottom: 40 },
  roleCard: { borderRadius: 24, padding: 24, marginTop: -12 },
  cardShadow: {
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  roleTitle: { marginBottom: 6 },
  roleSub: { marginBottom: 20, lineHeight: 20 },
  roleOptions: { gap: 12 },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  roleIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  roleIcon: { fontSize: 24, lineHeight: 28 },
  roleTextWrap: { flex: 1, gap: 3 },
  roleDesc: { lineHeight: 18 },
  roleArrow: { fontSize: 24, lineHeight: 28, fontWeight: '300' },

  // Form
  kav: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  card: { borderRadius: 24, padding: 24, marginTop: -12 },
  cardTitle: { marginBottom: 20 },

  field: { marginBottom: 16, gap: 6 },
  label: { letterSpacing: 0.3 },
  salaryRow: { flexDirection: 'row', gap: 10 },
  salaryHalf: { flex: 1 },

  submitBtn: { marginTop: 8 },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
  loginLink: { fontWeight: '700' },
});
