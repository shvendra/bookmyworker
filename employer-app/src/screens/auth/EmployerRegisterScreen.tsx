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
import { authService } from '../../../../packages/shared-mobile/src/features/auth/services/authService';
import {
  registerStep2Schema,
  type RegisterStep2Values,
} from '../../../../packages/shared-mobile/src/features/auth/validation/authSchemas';
import type { EmployerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<EmployerStackParamList, 'Register'>;

type EmployerTypeKey = 'individual' | 'contractor' | 'agency' | 'industry';

const EMPLOYER_TYPES: { key: EmployerTypeKey; label: string; icon: string; desc: string }[] = [
  { key: 'individual', label: 'Individual',      icon: '👤', desc: 'Household / personal hire' },
  { key: 'contractor', label: 'Contractor',      icon: '🔧', desc: 'Civil / site contractor' },
  { key: 'agency',     label: 'Agency',          icon: '🏦', desc: 'Staffing / placement agency' },
  { key: 'industry',   label: 'Company / Factory', icon: '🏭', desc: 'Factory or industry owner' },
];

export const EmployerRegisterScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTypes, setSelectedTypes] = useState<Record<EmployerTypeKey, boolean>>({
    individual: false,
    contractor: false,
    agency: false,
    industry: false,
  });

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
    },
  });

  const stateVal    = watch('state');
  const districtVal = watch('district');
  const blockVal    = watch('block');

  const toggleType = (key: EmployerTypeKey): void => {
    setSelectedTypes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const hasType = Object.values(selectedTypes).some(Boolean);

  const goToStep2 = (): void => {
    if (!hasType) {
      Alert.alert('Select Type', 'Please select at least one employer type to continue.');
      return;
    }
    setStep(2);
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!values.state || !values.district) {
      Alert.alert('Required', 'Please select your state and district.');
      return;
    }
    setIsLoading(true);
    try {
      await authService.requestOtp(values.phone, undefined);
      navigation.navigate('RegisterOtp', {
        phone: values.phone,
        role: 'Employer',
        name: values.name,
        password: values.password,
        state: values.state,
        district: values.district,
        block: values.block,
        pinCode: values.pinCode ?? undefined,
        email: values.email ?? undefined,
        employerType: JSON.stringify(selectedTypes),
      });
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  });

  const isDark  = theme.mode === 'dark';
  const purple  = '#1037A4';

  return (
    <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F9F5FF' }]}>
      <StatusBar barStyle="light-content" backgroundColor={purple} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: purple, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => (step === 2 ? setStep(1) : navigation.goBack())}
          style={styles.backBtn}
        >
          <AppText style={styles.backArrow} color="#FFFFFF">‹</AppText>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.headerIconWrap}>
                  <Image
                source={require('../../../../packages/shared-mobile/assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
          </View>
          <View style={styles.headerTextWrap}>
            <AppText variant="heading" color="#FFFFFF" style={styles.headerTitle}>
              Employer Registration
            </AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.75)">
              {step === 1 ? 'Step 1 of 2 — Select employer type' : 'Step 2 of 2 — Account details'}
            </AppText>
          </View>
        </View>

        {/* Step dots */}
        <View style={styles.stepDots}>
          <View style={[styles.stepDot, { backgroundColor: '#fff' }]} />
          <View style={styles.stepLine} />
          <View style={[styles.stepDot, step === 2 ? { backgroundColor: '#fff' } : styles.stepDotInactive]} />
        </View>

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
          {/* ── Step 1: Employer Type ── */}
          {step === 1 && (
            <View style={[styles.card, { backgroundColor: theme.colors.card }, !isDark && styles.cardShadow]}>
              <AppText variant="subtitle" color={theme.colors.text} style={styles.cardTitle}>
                What type of employer are you?
              </AppText>
              <AppText variant="body" color={theme.colors.mutedText} style={styles.cardSubtitle}>
                Select all that apply. This helps us match you with the right workers.
              </AppText>

              <View style={styles.typeGrid}>
                {EMPLOYER_TYPES.map(({ key, label, icon, desc }) => {
                  const isSelected = selectedTypes[key];
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => toggleType(key)}
                      activeOpacity={0.75}
                      style={[
                        styles.typeCard,
                        {
                          borderColor: isSelected ? purple : theme.colors.border,
                          backgroundColor: isSelected
                            ? (isDark ? '#3D1F7A' : '#F3EEFF')
                            : theme.colors.card,
                        },
                      ]}
                    >
                      <View style={styles.typeCardTop}>
                        <AppText style={styles.typeIcon}>{icon}</AppText>
                        <View style={[styles.typeCheck, {
                          backgroundColor: isSelected ? purple : 'transparent',
                          borderColor: isSelected ? purple : theme.colors.border,
                        }]}>
                          {isSelected ? <AppText style={styles.typeCheckMark}>✓</AppText> : null}
                        </View>
                      </View>
                      <AppText variant="labelSm" color={isSelected ? purple : theme.colors.text} style={styles.typeLabel}>
                        {label}
                      </AppText>
                      <AppText variant="micro" color={theme.colors.mutedText} style={styles.typeDesc}>
                        {desc}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {!hasType && (
                <View style={[styles.hintBanner, { backgroundColor: isDark ? '#2D1B4E' : '#F3EEFF' }]}>
                  <AppText variant="caption" color={purple}>
                    Select at least one type to continue
                  </AppText>
                </View>
              )}

              <AppButton
                title="Next →"
                onPress={goToStep2}
                size="lg"
                fullWidth
                style={styles.submitBtn}
              />
            </View>
          )}

          {/* ── Step 2: Account Details ── */}
          {step === 2 && (
            <View style={[styles.card, { backgroundColor: theme.colors.card }, !isDark && styles.cardShadow]}>
              <AppText variant="subtitle" color={theme.colors.text} style={styles.cardTitle}>
                Create Your Account
              </AppText>

              {/* Name */}
              <View style={styles.field}>
                <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                  Full Name / Company Name
                </AppText>
                <Controller
                  control={control}
                  name="name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <AppInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="e.g. Sharma Industries"
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
                      placeholder="company@email.com"
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

              {/* PIN Code */}
              <View style={styles.field}>
                <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                  PIN Code (optional)
                </AppText>
                <Controller
                  control={control}
                  name="pinCode"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <AppInput
                      value={value ?? ''}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="6-digit PIN"
                      keyboardType="number-pad"
                      maxLength={6}
                      errorText={errors.pinCode?.message}
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
          )}

          {/* Login link */}
          <View style={styles.loginRow}>
            <AppText variant="body" color={theme.colors.mutedText}>
              Already have an account?{' '}
            </AppText>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <AppText variant="body" color={purple} style={styles.loginLink}>
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
  backBtn: { paddingBottom: 4 },
  backArrow: { fontSize: 28, lineHeight: 32, fontWeight: '300' },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 10 },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: { gap: 2, flex: 1 },
  headerTitle: { lineHeight: 26 },

  stepDots: { flexDirection: 'row', alignItems: 'center', gap: 0, paddingBottom: 4 },
  stepDot: { width: 10, height: 10, borderRadius: 5 },
  stepDotInactive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  stepLine: { width: 28, height: 2, backgroundColor: 'rgba(255,255,255,0.35)', marginHorizontal: 4 },

  deco: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)' },
  deco1: { width: 180, height: 180, top: -60, right: -40 },
  deco2: { width: 100, height: 100, bottom: -20, right: 80 },

  kav: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },

  card: {
    borderRadius: 24,
    padding: 24,
    marginTop: -12,
  },
  cardShadow: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  cardTitle:    { marginBottom: 6 },
  cardSubtitle: { marginBottom: 20, lineHeight: 20 },

  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  typeCard: {
    width: '47%',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    gap: 6,
  },
  typeCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  typeIcon:  { fontSize: 26, lineHeight: 30 },
  typeCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeCheckMark: { fontSize: 12, color: '#fff', fontWeight: '800', lineHeight: 16 },
  typeLabel:     { fontWeight: '700', marginTop: 2 },
  typeDesc:      { lineHeight: 16 },

  hintBanner: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    alignItems: 'center',
  },

  field: { marginBottom: 16, gap: 6 },
  label: { letterSpacing: 0.3 },

  submitBtn: { marginTop: 8 },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
  loginLink: { fontWeight: '700' },
  logoImage: { width: 55, height: 55 },
});
