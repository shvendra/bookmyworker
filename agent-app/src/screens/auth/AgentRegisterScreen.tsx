import { zodResolver } from '@hookform/resolvers/zod';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const BRAND  = '#1037A4';
const ORANGE = '#F97316';

const ROLE_OPTIONS: Array<{ value: Role; label: string; description: string; icon: string; color: string; bg: string; border: string }> = [
  {
    value: 'Agent',
    label: 'Agent / Supplier',
    description: 'Build your worker network. Get paid every time one of your workers gets placed.',
    icon: '🤝',
    color: BRAND,
    bg: '#EBF1FF',
    border: '#C3D3F5',
  },
  {
    value: 'SelfWorker',
    label: 'Job Seeker',
    description: 'Browse nearby job openings. Get hired quickly. Earn every day.',
    icon: '👷',
    color: ORANGE,
    bg: '#FFF3E8',
    border: '#FDD5B0',
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
  const primary = theme.colors.primary;
  const insets = useSafeAreaInsets();

  // ── Step 1: Role selection ──────────────────────────────────────────────────
  if (step === 1) {
    return (
      <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F4F6FB' }]}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />

        {/* Hero header */}
        <View style={[styles.regHero, { paddingTop: insets.top + 12 }]}>
          <View style={[styles.circle, styles.circle1]} />
          <View style={[styles.circle, styles.circle2]} />
          <View style={[styles.circle, styles.circle3]} />
          <View style={styles.orangeStrip} />

          {/* Back button */}
        

          {/* Brand row */}
          <View style={styles.brandRow}>
            <View style={styles.logoBox}>
              <Image
                source={require('../../../../packages/shared-mobile/assets/logo.png')}
                style={styles.logoImg}
                resizeMode="contain"
              />
            </View>
            <View style={styles.brandTextWrap}>
              <AppText style={styles.brandName} color="#FFFFFF">BookMyWorker</AppText>
              <AppText style={styles.brandSub} color="rgba(255,255,255,0.65)">
                India's #1 Workforce Platform
              </AppText>
            </View>
          </View>

          {/* Page headline */}
          <View style={styles.heroBlock}>
            <View style={styles.heroBadge}>
              <View style={styles.heroBadgeDot} />
              <AppText style={styles.heroBadgeText} color={ORANGE}>CREATE ACCOUNT</AppText>
            </View>
            <AppText style={styles.regHeroTitle} color="#FFFFFF">Join BookMyWorker</AppText>
            <AppText style={styles.regHeroSub} color="rgba(255,255,255,0.70)">
              Register workers & earn commission
            </AppText>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.roleScroll} showsVerticalScrollIndicator={false}>
          <AppText variant="label" color={theme.colors.text} style={styles.rolePrompt}>
            Who are you?
          </AppText>
          <AppText variant="body" color={theme.colors.mutedText} style={styles.roleSub}>
            Select the role that best describes you
          </AppText>

          <View style={styles.roleOptions}>
            {ROLE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => onSelectRole(opt.value)}
                activeOpacity={0.88}
                style={[styles.roleCard, { backgroundColor: opt.bg, borderColor: opt.border }]}
              >
                {/* Top row: icon + text + arrow — use marginLeft instead of gap for RN compatibility */}
                <View style={styles.roleCardTop}>
                  <View style={[styles.roleIconWrap, { backgroundColor: 'rgba(255,255,255,0.75)' }]}>
                    <AppText style={styles.roleIcon}>{opt.icon}</AppText>
                  </View>
                  <View style={styles.roleTextWrap}>
                    <AppText style={[styles.roleLabel, { color: opt.color }]}>{opt.label}</AppText>
                  </View>
                  <Text style={[styles.roleArrow, { color: opt.color }]}>›</Text>
                </View>
                {/* Description */}
                <AppText style={[styles.roleDesc, { color: isDark ? theme.colors.mutedText : '#64748B' }]}>
                  {opt.description}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.loginRow}>
            <AppText variant="body" color={theme.colors.mutedText}>Already have an account? </AppText>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <AppText variant="body" color={BRAND} style={styles.loginLink}>Sign In</AppText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Step 2: Registration form ───────────────────────────────────────────────
  const isWorker = role === 'SelfWorker';

  return (
    <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F4F6FB' }]}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />

      {/* Hero header */}
      <View style={[styles.regHero, { paddingTop: insets.top + 12 }]}>
        <View style={[styles.circle, styles.circle1]} />
        <View style={[styles.circle, styles.circle2]} />
        <View style={[styles.circle, styles.circle3]} />
        <View style={styles.orangeStrip} />

        {/* Brand row */}
        <View style={styles.brandRow}>
          <View style={styles.logoBox}>
            <Image
              source={require('../../../../packages/shared-mobile/assets/logo.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
          <View style={styles.brandTextWrap}>
            <AppText style={styles.brandName} color="#FFFFFF">BookMyWorker</AppText>
            <AppText style={styles.brandSub} color="rgba(255,255,255,0.65)">
              {role === 'Agent' ? 'Agent Registration' : 'Worker Registration'}
            </AppText>
          </View>
        </View>

        {/* Page headline */}
        <View style={styles.heroBlock}>
          <View style={styles.heroBadge}>
            <View style={styles.heroBadgeDot} />
            <AppText style={styles.heroBadgeText} color={ORANGE}>STEP 2 OF 2</AppText>
          </View>
          <AppText style={styles.regHeroTitle} color="#FFFFFF">Your Details</AppText>
          <AppText style={styles.regHeroSub} color="rgba(255,255,255,0.70)">
            {role === 'Agent'
              ? 'Register workers & earn on every placement'
              : 'Find daily wage work near your area'}
          </AppText>
        </View>
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
              <AppText variant="body" color={primary} style={styles.loginLink}>
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

  // Shared hero
  regHero: {
    backgroundColor: BRAND,
    paddingHorizontal: 24,
    paddingBottom: 34,
    overflow: 'hidden',
  },
  circle: { position: 'absolute', borderRadius: 999 },
  circle1: { width: 260, height: 260, top: -110, right: -80, backgroundColor: 'rgba(255,255,255,0.055)' },
  circle2: { width: 140, height: 140, bottom: -50, right: 25,  backgroundColor: 'rgba(249,115,22,0.09)' },
  circle3: { width: 90,  height: 90,  top: 30,   left: -30,   backgroundColor: 'rgba(255,255,255,0.04)' },
  orangeStrip: {
    position: 'absolute', bottom: 0, left: 0,
    width: '38%', height: 4,
    backgroundColor: ORANGE, borderTopRightRadius: 999,
  },
  backBtn: { alignSelf: 'flex-start', marginBottom: 18 },
  backCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontSize: 26, lineHeight: 30, fontWeight: '300', marginTop: -2 },

  // Brand row (logo + name)
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 14 },
  logoBox: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  logoImg: { width: 56, height: 56 },
  brandTextWrap: { flex: 1 },
  brandName: { fontSize: 19, fontWeight: '800', lineHeight: 24, letterSpacing: -0.3 },
  brandSub: { fontSize: 12, marginTop: 3, letterSpacing: 0.2 },

  // Hero headline block
  heroBlock: { gap: 7 },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(249,115,22,0.14)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, marginBottom: 2,
  },
  heroBadgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: ORANGE },
  heroBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  regHeroTitle: { fontSize: 26, fontWeight: '900', lineHeight: 33, letterSpacing: -0.5 },
  regHeroSub: { fontSize: 13, lineHeight: 19 },

  // Role selection
  roleScroll: { padding: 20, paddingBottom: 40, marginTop: -18 },
  rolePrompt: { marginBottom: 4, fontSize: 18, fontWeight: '800' },
  roleSub: { marginBottom: 18, lineHeight: 20 },
  roleOptions: { gap: 14, marginBottom: 4 },
  roleCard: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  roleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  roleIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  roleIcon: { fontSize: 28, lineHeight: 34 },
  roleTextWrap: { flex: 1, marginLeft: 14 },
  roleLabel: { fontSize: 17, fontWeight: '800', lineHeight: 23 },
  roleTagline: { fontSize: 12, fontWeight: '600', lineHeight: 17, marginTop: 2 },
  roleDesc: { fontSize: 13, lineHeight: 19, paddingLeft: 2 },
  roleArrow: { fontSize: 24, lineHeight: 30, fontWeight: '200', marginLeft: 8, flexShrink: 0 },

  // Form step
  cardShadow: {
    shadowColor: '#1037A4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  kav: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  card: { borderRadius: 24, padding: 24, marginTop: -16, backgroundColor: '#fff' },
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
