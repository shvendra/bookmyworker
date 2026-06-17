import { zodResolver } from '@hookform/resolvers/zod';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
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
import { showAlert } from '../../../../packages/shared-mobile/src/shared/state/alert/AppAlertContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useAppTheme } from '../../../../packages/shared-mobile/src/core/theme';
import { AppButton } from '../../../../packages/shared-mobile/src/shared/components/ui/AppButton';
import { AppText } from '../../../../packages/shared-mobile/src/shared/components/ui/AppText';
import { Trademark } from '../../../../packages/shared-mobile/src/shared/components/ui/Trademark';
import { AppInput } from '../../../../packages/shared-mobile/src/shared/components/ui/AppInput';
import { authService } from '../../../../packages/shared-mobile/src/features/auth/services/authService';
import { isGoogleSignInAvailable, signInWithGoogle } from '../../../../packages/shared-mobile/src/core/auth/googleSignIn';
import { useAuth } from '../../../../packages/shared-mobile/src/state/auth/AuthContext';
import { useAppConfig } from '../../../../packages/shared-mobile/src/core/api/endpoints/appConfigApi';
import {
  registerStep2Schema,
  type RegisterStep2Values,
} from '../../../../packages/shared-mobile/src/features/auth/validation/authSchemas';
import type { EmployerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<EmployerStackParamList, 'Register'>;
type EmployerTypeKey = 'individual' | 'contractor' | 'agency' | 'industry';

const BRAND  = '#1037A4';
const ORANGE = '#F97316';

const EMPLOYER_TYPES: { key: EmployerTypeKey; labelKey: string; icon: string; descKey: string }[] = [
  { key: 'individual', labelKey: 'employerTypeIndividual', icon: '👤', descKey: 'employerTypeIndividualDesc' },
  { key: 'contractor', labelKey: 'employerTypeContractor', icon: '🔧', descKey: 'employerTypeContractorDesc' },
  { key: 'agency',     labelKey: 'employerTypeAgency',     icon: '🏦', descKey: 'employerTypeAgencyDesc' },
  { key: 'industry',   labelKey: 'employerTypeIndustry',   icon: '🏭', descKey: 'employerTypeIndustryDesc' },
];

export const EmployerRegisterScreen = ({ navigation }: Props): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  // SuperAdmin toggle — when false, registration skips the WhatsApp OTP step and
  // creates the account directly (otherwise the backend rejects requestOtp and the
  // employer is stuck on an "OTP disabled" error).
  const { config } = useAppConfig();
  const registrationOtpEnabled = config.authFlags.registrationOtpEnabled;
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTypes, setSelectedTypes] = useState<Record<EmployerTypeKey, boolean>>({
    individual: false, contractor: false, agency: false, industry: false,
  });

  // ── Google sign-in state ──
  const googleAvailable = isGoogleSignInAvailable();
  const [googleBusy, setGoogleBusy]     = useState(false);
  const [googleMode, setGoogleMode]     = useState(false);
  const [googleTicket, setGoogleTicket] = useState('');
  const [googleName, setGoogleName]     = useState('');
  const [googlePhone, setGooglePhone]   = useState('');

  const handleGoogle = async (): Promise<void> => {
    /* istanbul ignore next -- defensive re-entrancy guard; the button is disabled while busy */
    if (googleBusy) return;
    /* istanbul ignore next -- defensive; the Google button is disabled until a type is chosen */
    if (!hasType) { showAlert(t('selectAtLeastOneType'), t('selectAtLeastOneType')); return; }
    setGoogleBusy(true);
    try {
      const idToken = await signInWithGoogle();
      if (!idToken) return; // cancelled / unavailable
      const res = await authService.googleStart(idToken, 'employer-app');
      if (res.loggedIn && res.session) {
        await signIn(res.session); // app routes automatically
        return;
      }
      if (res.needsPhone && res.googleTicket) {
        setGoogleTicket(res.googleTicket);
        setGoogleName(res.name || '');
        setGoogleMode(true);
      }
    } catch (error) {
      showAlert(t('alertError'), error instanceof Error ? error.message : t('au_failedSendOtp'));
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleGoogleContinue = async (): Promise<void> => {
    const phone = googlePhone.replace(/\D/g, '');
    if (phone.length !== 10) {
      showAlert(t('alertError'), t('enterValidPhone') || 'Enter a valid 10-digit mobile number');
      return;
    }
    setIsLoading(true);
    try {
      /* istanbul ignore next -- defensive; a type is always selected before reaching this screen */
      const typesToSend = hasType ? selectedTypes : { ...selectedTypes, individual: true };
      if (!registrationOtpEnabled) {
        // OTP disabled by admin → finalize the Google sign-up directly (no OTP step).
        const gSession = await authService.googleRegister({
          googleTicket,
          phone,
          name: googleName || 'Employer',
          employerType: typesToSend,
        });
        gSession.onboardingCompleted = false; // fresh employer → KYC
        await signIn(gSession);
        return;
      }
      await authService.requestOtp(phone, undefined);
      navigation.navigate('RegisterOtp', {
        phone,
        role: 'Employer',
        name: googleName || 'Employer',
        password: '', // not used for Google flow
        employerType: JSON.stringify(typesToSend),
        googleTicket,
      });
    } catch (error) {
      showAlert(t('alertError'), error instanceof Error ? error.message : t('au_failedSendOtp'));
    } finally {
      setIsLoading(false);
    }
  };

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterStep2Values>({
    resolver: zodResolver(registerStep2Schema),
    defaultValues: { name: '', phone: '', password: '', confirmPassword: '' },
  });

  const toggleType = (key: EmployerTypeKey): void =>
    setSelectedTypes(prev => ({ ...prev, [key]: !prev[key] }));

  const hasType = Object.values(selectedTypes).some(Boolean);

  const goToStep2 = (): void => {
    if (!hasType) {
      showAlert(t('selectAtLeastOneType'), t('selectAtLeastOneType'));
      return;
    }
    setStep(2);
  };

  // Direct (no-OTP) registration. Mirrors the post-verify flow in RegisterOtpScreen
  // so the result is identical apart from the skipped OTP step: create the employer,
  // log in with the chosen password, then route to KYC (onboarding incomplete).
  const registerDirectly = async (values: RegisterStep2Values): Promise<void> => {
    const selectedLang = i18n.language ?? 'en';
    await authService.register({
      name: values.name,
      phone: values.phone,
      password: values.password,
      role: 'Employer',
      language: selectedLang,
      employerType: selectedTypes,
    });
    const session = await authService.loginWithPassword(values.phone, values.password, 'employer');
    session.onboardingCompleted = false; // fresh employer → KYC
    await signIn(session);
  };

  const onSubmit = handleSubmit(async (values) => {
    setIsLoading(true);
    try {
      if (!registrationOtpEnabled) {
        // OTP disabled by admin → create the account directly and skip the OTP step.
        await registerDirectly(values);
        return;
      }
      await authService.requestOtp(values.phone, undefined);
      navigation.navigate('RegisterOtp', {
        phone: values.phone,
        role: 'Employer',
        name: values.name,
        password: values.password,
        employerType: JSON.stringify(selectedTypes),
      });
    } catch (error) {
      showAlert(t('alertError'), error instanceof Error ? error.message : t('au_failedSendOtp'));
    } finally {
      setIsLoading(false);
    }
  });

  const isDark = theme.mode === 'dark';

  // ── Google flow: collect the mandatory mobile number ─────────────────────────
  if (googleMode) {
    return (
      <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F0F4FB' }]}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />
        <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
          <View style={[styles.circle, styles.c1]} />
          <View style={[styles.circle, styles.c2]} />
          <View style={styles.orangeStrip} />
          <View style={styles.brandRow}>
            <View style={styles.logoBox}>
              <Image source={require('../../../../packages/shared-mobile/assets/logo.png')} style={styles.logoImg} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={styles.brandName} color="#FFFFFF">BookMyWorker<Trademark onDark size={19} /></AppText>
              <AppText style={styles.brandSub} color="rgba(255,255,255,0.65)">{t('platformTagline')}</AppText>
            </View>
            <TouchableOpacity onPress={() => setGoogleMode(false)} style={styles.backBtn} activeOpacity={0.7}>
              <AppText style={styles.backArrow}>←</AppText>
            </TouchableOpacity>
          </View>
          <AppText style={styles.heroTitle} color="#FFFFFF">{t('yourDetails')}</AppText>
          <AppText style={styles.heroSub} color="rgba(255,255,255,0.70)">
            {t('registerStep2Sub')}
          </AppText>
        </View>

        <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={[styles.card, { backgroundColor: theme.colors.card }, !isDark && styles.cardShadow]}>
              <View style={{ marginBottom: 14, padding: 12, borderRadius: 12, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' }}>
                <AppText variant="body" color="#16A34A" style={{ fontWeight: '600' }}>
                  {googleName ? t('empGoogleSignedInNamed', { name: googleName }) : t('empGoogleSignedIn')}
                </AppText>
              </View>
              <View style={styles.field}>
                <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>{t('mobileNumber')}</AppText>
                <AppInput
                  value={googlePhone}
                  onChangeText={(v: string) => setGooglePhone(v.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  keyboardType="phone-pad"
                  leadingIcon="+91"
                  maxLength={10}
                />
              </View>
              <AppButton title={registrationOtpEnabled ? t('sendOtpRegister') : t('createAccount')} onPress={handleGoogleContinue} loading={isLoading} size="lg" fullWidth style={styles.submitBtn} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Step 1: Employer type selection ──────────────────────────────────────────
  if (step === 1) {
    return (
      <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F0F4FB' }]}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />

        {/* Hero */}
        <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
          <View style={[styles.circle, styles.c1]} />
          <View style={[styles.circle, styles.c2]} />
          <View style={[styles.circle, styles.c3]} />
          <View style={styles.orangeStrip} />

          <View style={styles.brandRow}>
            <View style={styles.logoBox}>
              <Image
                source={require('../../../../packages/shared-mobile/assets/logo.png')}
                style={styles.logoImg}
                resizeMode="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={styles.brandName} color="#FFFFFF">BookMyWorker<Trademark onDark size={19} /></AppText>
              <AppText style={styles.brandSub} color="rgba(255,255,255,0.65)">{t('platformTagline')}</AppText>
            </View>
          </View>

          <AppText style={styles.heroTitle} color="#FFFFFF">{t('employerRegistration')}</AppText>
          <AppText style={styles.heroSub} color="rgba(255,255,255,0.70)">
            {t('selectEmployerTypeHint')}
          </AppText>
        </View>

        <ScrollView contentContainerStyle={styles.roleScroll} showsVerticalScrollIndicator={false}>
          {/* Type cards */}
          <AppText style={[styles.sectionLabel, { color: theme.colors.mutedText }]}>
            {t('whatTypeEmployer').toUpperCase()}
          </AppText>
          <View style={styles.typeGrid}>
            {EMPLOYER_TYPES.map(({ key, labelKey, icon, descKey }) => {
              const sel = selectedTypes[key];
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => toggleType(key)}
                  activeOpacity={0.82}
                  style={[
                    styles.typeCard,
                    {
                      backgroundColor: sel ? '#EBF1FF' : (isDark ? theme.colors.surface : '#FFF'),
                      borderColor: sel ? BRAND : (isDark ? theme.colors.border : '#E2E8F0'),
                      borderWidth: sel ? 2 : 1,
                    },
                  ]}
                >
                  <View style={[styles.typeIconCircle, { backgroundColor: sel ? BRAND : BRAND + '18' }]}>
                    <AppText style={styles.typeIconEmoji}>{icon}</AppText>
                  </View>
                  <View style={styles.typeTextBlock}>
                    <AppText style={[styles.typeName, { color: sel ? BRAND : theme.colors.text }]}>
                      {t(labelKey)}
                    </AppText>
                    <AppText style={[styles.typeDesc, { color: theme.colors.mutedText }]}>
                      {t(descKey)}
                    </AppText>
                  </View>
                  <View style={[styles.typeCheckBox, {
                    backgroundColor: sel ? BRAND : 'transparent',
                    borderColor: sel ? BRAND : (isDark ? theme.colors.border : '#CBD5E1'),
                  }]}>
                    {sel && <AppText style={styles.typeCheckMark}>✓</AppText>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <AppButton
            title={t('continueBtn')}
            onPress={goToStep2}
            disabled={!hasType}
            style={[styles.continueBtn, { opacity: hasType ? 1 : 0.4 }]}
            size="lg"
            fullWidth
          />

          {/* Continue with Google — only after a type is selected, so the rate-
              determining employer type is always captured. Hidden until the
              native module + client ID are configured. */}
          {googleAvailable && (
            <View style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
                <AppText style={{ marginHorizontal: 10, color: theme.colors.mutedText, fontSize: 12 }}>{t('orLabel') || 'or'}</AppText>
                <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
              </View>
              <TouchableOpacity
                onPress={handleGoogle}
                disabled={googleBusy || !hasType}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                  backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E2E8F0',
                  borderRadius: 14, paddingVertical: 14, opacity: (googleBusy || !hasType) ? 0.45 : 1,
                }}
              >
                <Image
                  source={{ uri: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg' }}
                  style={{ width: 18, height: 18 }}
                />
                <AppText style={{ fontSize: 15, fontWeight: '700', color: '#1F2937' }}>
                  {googleBusy ? t('processing') : (t('continueWithGoogle') || 'Continue with Google')}
                </AppText>
              </TouchableOpacity>
              {!hasType && (
                <AppText style={{ marginTop: 8, fontSize: 12, color: theme.colors.mutedText, textAlign: 'center' }}>
                  {t('selectTypeBeforeGoogle') || 'Select your employer type above to continue with Google'}
                </AppText>
              )}
            </View>
          )}

          <AppText variant="body" color={theme.colors.mutedText} style={styles.loginRow}>
            {t('alreadyHaveAccount')}{' '}
            <AppText variant="body" color={BRAND} style={styles.loginLink} onPress={() => navigation.navigate('Login')}>{t('signIn')}</AppText>
          </AppText>
        </ScrollView>
      </View>
    );
  }

  // ── Step 2: Name + Phone + Password only ─────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F0F4FB' }]}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />

      {/* Hero */}
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={[styles.circle, styles.c1]} />
        <View style={[styles.circle, styles.c2]} />
        <View style={[styles.circle, styles.c3]} />
        <View style={styles.orangeStrip} />

        <View style={styles.brandRow}>
          <View style={styles.logoBox}>
            <Image
              source={require('../../../../packages/shared-mobile/assets/logo.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
          <View style={{ flex: 1 }}>
            <AppText style={styles.brandName} color="#FFFFFF">BookMyWorker<Trademark onDark size={19} /></AppText>
            <AppText style={styles.brandSub} color="rgba(255,255,255,0.65)">{t('platformTagline')}</AppText>
          </View>
          <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn} activeOpacity={0.7}>
            <AppText style={styles.backArrow}>←</AppText>
          </TouchableOpacity>
        </View>

        <View style={styles.heroBadgeRow}>
          <View style={styles.heroBadgeDot} />
          <AppText style={styles.heroBadgeText} color={ORANGE}>{t('step2Of2')}</AppText>
        </View>
        <AppText style={styles.heroTitle} color="#FFFFFF">{t('yourDetails')}</AppText>
        <AppText style={styles.heroSub} color="rgba(255,255,255,0.70)">
          {t('registerStep2Sub')}
        </AppText>
      </View>

      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { backgroundColor: theme.colors.card }, !isDark && styles.cardShadow]}>
            <AppText variant="subtitle" color={theme.colors.text} style={styles.cardTitle}>
              {t('createYourAccount')}
            </AppText>

            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                {t('fullNameCompany')}
              </AppText>
              <Controller control={control} name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput value={value} onChangeText={onChange} onBlur={onBlur}
                    placeholder={t('companyNamePlaceholder')} errorText={errors.name?.message} />
                )}
              />
            </View>

            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                {t('mobileNumber')}
              </AppText>
              <Controller control={control} name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput value={value} onChangeText={onChange} onBlur={onBlur}
                    placeholder="9876543210" keyboardType="phone-pad"
                    leadingIcon="+91" maxLength={10} errorText={errors.phone?.message} />
                )}
              />
            </View>

            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                {t('passwordLabel')}
              </AppText>
              <Controller control={control} name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput value={value} onChangeText={onChange} onBlur={onBlur}
                    placeholder={t('minSixChars')} secureTextEntry errorText={errors.password?.message} />
                )}
              />
            </View>

            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                {t('confirmPassword')}
              </AppText>
              <Controller control={control} name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput value={value} onChangeText={onChange} onBlur={onBlur}
                    placeholder={t('reEnterPassword')} secureTextEntry errorText={errors.confirmPassword?.message} />
                )}
              />
            </View>

            <AppButton
              title={registrationOtpEnabled ? t('sendOtpRegister') : t('createAccount')}
              onPress={onSubmit}
              loading={isLoading}
              size="lg"
              fullWidth
              style={styles.submitBtn}
            />
          </View>

          <AppText variant="body" color={theme.colors.mutedText} style={styles.loginRow}>
            {t('alreadyHaveAccount')}{' '}
            <AppText variant="body" color={BRAND} style={styles.loginLink} onPress={() => navigation.navigate('Login')}>{t('signIn')}</AppText>
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },

  hero: {
    backgroundColor: BRAND,
    paddingHorizontal: 24,
    paddingBottom: 40,
    overflow: 'hidden',
  },
  circle: { position: 'absolute', borderRadius: 999 },
  c1: { width: 280, height: 280, top: -120, right: -80,  backgroundColor: 'rgba(255,255,255,0.055)' },
  c2: { width: 150, height: 150, bottom: -50, right: 30,  backgroundColor: 'rgba(249,115,22,0.09)' },
  c3: { width: 90,  height: 90,  top: 30,    left: -30,   backgroundColor: 'rgba(255,255,255,0.04)' },
  orangeStrip: {
    position: 'absolute', bottom: 0, left: 0,
    width: '38%', height: 4,
    backgroundColor: ORANGE, borderTopRightRadius: 999,
  },

  brandRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 22, gap: 14 },
  logoBox:      {
    width: 56, height: 56, borderRadius: 16, backgroundColor: '#FFFFFF', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 6,
  },
  logoImg:      { width: 56, height: 56 },
  brandName:    { fontSize: 19, fontWeight: '800', lineHeight: 24, letterSpacing: -0.3 },
  brandSub:     { fontSize: 12, marginTop: 3 },

  heroTitle: { fontSize: 28, fontWeight: '900', lineHeight: 36, letterSpacing: -0.6 },
  heroSub:   { fontSize: 13.5, lineHeight: 20, marginTop: 4 },

  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontSize: 22, color: '#fff', fontWeight: '300', lineHeight: 26 },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  heroBadgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: ORANGE },
  heroBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: ORANGE },

  // Step 1 scroll
  roleScroll:   { padding: 20, paddingBottom: 40, marginTop: -18 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 12, textTransform: 'uppercase' },

  typeGrid: { gap: 10, marginBottom: 4 },
  typeCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18, padding: 16, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  typeIconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  typeIconEmoji:  { fontSize: 26, lineHeight: 32 },
  typeTextBlock:  { flex: 1, gap: 3 },
  typeName:       { fontSize: 16, fontWeight: '800', letterSpacing: -0.2, lineHeight: 22 },
  typeDesc:       { fontSize: 12.5, lineHeight: 18 },
  typeCheckBox:   { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  typeCheckMark:  { color: '#fff', fontSize: 13, fontWeight: '900', lineHeight: 16 },

  continueBtn: { marginTop: 20, marginBottom: 4 },

  // Step 2
  kav:    { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  card:   { borderRadius: 24, padding: 22, marginTop: -18 },
  cardShadow: {
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  cardTitle: { marginBottom: 16 },
  field:     { marginBottom: 16 },
  label:     { letterSpacing: 0.3, marginBottom: 6 },
  submitBtn: { marginTop: 8 },

  loginRow:  { marginTop: 24, textAlign: 'center' },
  loginLink: { fontWeight: '700' },
});
