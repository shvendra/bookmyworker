import { zodResolver } from '@hookform/resolvers/zod';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
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
import { useTranslation } from 'react-i18next';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppInput } from '../../../shared/components/ui/AppInput';
import { BrandLogo } from '../../../shared/components/ui/BrandLogo';
import { FormInput } from '../../../shared/components/forms/FormInput';
import { FormSelect } from '../../../shared/components/forms/FormSelect';
import { useAppTheme } from '../../../core/theme';
import {
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
} from '../../../core/api/endpoints/authApi';
import {
  forgotPasswordStep1Schema,
  otpSchema,
  forgotPasswordStep3Schema,
  type ForgotPasswordStep1Values,
  type OtpFormValues,
  type ForgotPasswordStep3Values,
} from '../validation/authSchemas';
import type { RootStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;
type Step = 1 | 2 | 3;

const { height: H } = Dimensions.get('window');
const RESEND_COOLDOWN = 60;
const ROLE_OPTIONS = ['Employer', 'SelfWorker', 'Agent'];

function toBackendRole(hint?: string): 'Employer' | 'Agent' | 'SelfWorker' | '' {
  switch (hint) {
    case 'employer': return 'Employer';
    case 'agent':    return 'Agent';
    case 'worker':   return 'SelfWorker';
    default:         return '';
  }
}

const STEPS_NUMS: Step[] = [1, 2, 3];

export const ForgotPasswordScreen = ({ navigation, route }: Props): React.JSX.Element => {
  const lockedRole = toBackendRole(route.params?.roleHint);
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const isDark = theme.mode === 'dark';

  const STEPS = [
    { num: 1 as Step, label: t('stepVerify') },
    { num: 2 as Step, label: t('stepOtp') },
    { num: 3 as Step, label: t('stepReset') },
  ];

  const insets = useSafeAreaInsets();
  const [step, setStep]                 = useState<Step>(1);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [countdown, setCountdown]       = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [pwVisible, setPwVisible]       = useState(false);
  const [cpVisible, setCpVisible]       = useState(false);

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const phoneRef  = useRef('');
  const roleRef   = useRef('SelfWorker');

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 9, useNativeDriver: true }),
    ]).start();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fadeAnim, slideAnim]);

  const animateStep = (next: Step): void => {
    setError(null);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start();
    setStep(next);
  };

  const step1Form = useForm<ForgotPasswordStep1Values>({
    resolver: zodResolver(forgotPasswordStep1Schema),
    defaultValues: { phone: '', role: lockedRole || 'SelfWorker' },
  });
  const step2Form = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });
  const step3Form = useForm<ForgotPasswordStep3Values>({
    resolver: zodResolver(forgotPasswordStep3Schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const startCountdown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(RESEND_COOLDOWN);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleStep1 = step1Form.handleSubmit(async (values) => {
    setLoading(true);
    setError(null);
    try {
      phoneRef.current = values.phone;
      roleRef.current  = values.role;
      await sendPasswordResetOtp({ phone: values.phone, role: values.role });
      startCountdown();
      animateStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('au_failedSendOtp'));
    } finally {
      setLoading(false);
    }
  });

  const handleResend = async (): Promise<void> => {
    if (countdown > 0) return;
    setResendLoading(true);
    setError(null);
    try {
      await sendPasswordResetOtp({ phone: phoneRef.current, role: roleRef.current });
      startCountdown();
      step2Form.reset({ otp: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('failedResendOtp'));
    } finally {
      setResendLoading(false);
    }
  };

  const handleStep2 = step2Form.handleSubmit(async (values) => {
    setLoading(true);
    setError(null);
    try {
      await verifyPasswordResetOtp({ phone: phoneRef.current, otp: values.otp });
      animateStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('invalidOtpMsg'));
    } finally {
      setLoading(false);
    }
  });

  const handleStep3 = step3Form.handleSubmit(async (values) => {
    setLoading(true);
    setError(null);
    try {
      await resetPassword({ phone: phoneRef.current, password: values.password, role: roleRef.current });
      navigation.navigate('Login');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('au_failedResetPassword'));
    } finally {
      setLoading(false);
    }
  });

  const goBack = (): void => {
    setError(null);
    if (step === 1) navigation.goBack();
    else animateStep((step - 1) as Step);
  };

  return (
    <View style={[s.root, { backgroundColor: isDark ? theme.colors.background : '#F4F6FB' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />

      {/* ── Brand + stepper strip ───────────────────────────────── */}
      <View style={[s.brandStrip, { paddingTop: insets.top + 12 }]}>
        <View style={s.brandContent}>
            <TouchableOpacity onPress={goBack} style={s.backBtn} activeOpacity={0.7}>
              <AppText style={s.backArrow}>←</AppText>
            </TouchableOpacity>
            <View style={s.brandCenter}>
              <View style={s.brandIconWrap}>
                <BrandLogo style={s.brandLogoImg} />
              </View>
              <AppText style={s.brandName}>BookMyWorker</AppText>
            </View>
            {/* Spacer to balance the back button */}
            <View style={{ width: 40 }} />
          </View>

        {/* Step indicator */}
        <View style={s.stepperWrap}>
          {STEPS.map((st, idx) => (
            <React.Fragment key={st.num}>
              <View style={s.stepCol}>
                <View style={[
                  s.stepCircle,
                  step > st.num  && s.stepCircleDone,
                  step === st.num && s.stepCircleActive,
                  step < st.num  && s.stepCirclePending,
                ]}>
                  <AppText style={[
                    s.stepCircleText,
                    step > st.num  && { color: '#fff' },
                    step === st.num && { color: '#1037A4' },
                    step < st.num  && { color: 'rgba(255,255,255,0.45)' },
                  ]}>
                    {step > st.num ? '✓' : String(st.num)}
                  </AppText>
                </View>
                <AppText style={[
                  s.stepLabelText,
                  step === st.num ? { color: '#fff', fontWeight: '700' as const } : { color: 'rgba(255,255,255,0.45)' },
                ]}>
                  {st.label}
                </AppText>
              </View>
              {idx < STEPS.length - 1 && (
                <View style={[
                  s.stepConnector,
                  { backgroundColor: step > st.num ? '#22C55E' : 'rgba(255,255,255,0.2)' },
                ]} />
              )}
            </React.Fragment>
          ))}
        </View>

        <View style={[s.deco, s.deco1]} />
        <View style={[s.deco, s.deco2]} />
      </View>

      {/* ── Scrollable content ────────────────────────────────────── */}
      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[
            s.card,
            { backgroundColor: theme.colors.card, opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] },
            !isDark && s.cardShadow,
          ]}>

            {/* ── Step 1: Phone verification ──────────────────────── */}
            {step === 1 && (
              <>
                <View style={s.stepHeader}>
                  <View style={[s.iconRing, { backgroundColor: theme.colors.primaryLight }]}>
                    <AppText style={s.iconEmoji}>📱</AppText>
                  </View>
                  <AppText variant="heading" color={theme.colors.text} style={s.cardTitle}>
                    {t('verifyIdentity')}
                  </AppText>
                  <AppText variant="body" color={theme.colors.mutedText} style={s.cardSubtitle}>
                    {t('forgotPasswordDesc')}
                  </AppText>
                </View>

                <Controller
                  control={step1Form.control}
                  name="phone"
                  render={({ field: { onChange, onBlur, value }, fieldState: { error: ferr } }) => (
                    <AppInput
                      label={t('mobileNumber')}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="9876543210"
                      keyboardType="phone-pad"
                      leadingIcon="+91"
                      maxLength={10}
                      errorText={ferr?.message}
                    />
                  )}
                />

                {!lockedRole && (
                  <Controller
                    control={step1Form.control}
                    name="role"
                    render={({ field, fieldState }) => (
                      <FormSelect
                        label={t('accountTypeLabel')}
                        value={field.value}
                        options={ROLE_OPTIONS}
                        onChange={field.onChange}
                        errorText={fieldState.error?.message}
                      />
                    )}
                  />
                )}

                <View style={[s.infoNote, { backgroundColor: '#E8F5E9' }]}>
                  <AppText style={s.infoNoteText}>💬 {t('otpViaWhatsApp')}</AppText>
                </View>

                {error ? (
                  <View style={[s.errorBanner, { backgroundColor: theme.colors.dangerLight }]}>
                    <AppText variant="caption" color={theme.colors.danger}>⚠ {error}</AppText>
                  </View>
                ) : null}

                <AppButton
                  title={t('sendOtpViaWhatsApp')}
                  onPress={handleStep1}
                  loading={loading}
                  size="lg"
                  fullWidth
                  style={s.ctaBtn}
                />
              </>
            )}

            {/* ── Step 2: OTP entry ────────────────────────────────── */}
            {step === 2 && (
              <>
                <View style={s.stepHeader}>
                  <View style={[s.iconRing, { backgroundColor: '#E8F5E9' }]}>
                    <AppText style={s.iconEmoji}>💬</AppText>
                  </View>
                  <AppText variant="heading" color={theme.colors.text} style={s.cardTitle}>
                    {t('enterWhatsAppOtp')}
                  </AppText>
                  <AppText variant="body" color={theme.colors.mutedText} style={s.cardSubtitle}>
                    {t('otpCodeSentPrefix')}{' '}
                    <AppText variant="body" color="#25D366" style={{ fontWeight: '700' }}>WhatsApp</AppText>
                    {' '}{t('otpCodeSentTo')}{'\n'}
                    <AppText variant="body" color={theme.colors.text} style={{ fontWeight: '700' }}>
                      +91 {phoneRef.current}
                    </AppText>
                  </AppText>
                </View>

                <View style={[s.whatsappChip, { backgroundColor: '#DCF8C6' }]}>
                  <AppText style={s.whatsappChipText}>📲 {t('checkWhatsApp')}</AppText>
                </View>

                <FormInput
                  control={step2Form.control}
                  name="otp"
                  label={t('sixDigitOtpLabel')}
                  placeholder={t('otpWhatsAppPlaceholder')}
                  keyboardType="number-pad"
                  maxLength={6}
                />

                {error ? (
                  <View style={[s.errorBanner, { backgroundColor: theme.colors.dangerLight }]}>
                    <AppText variant="caption" color={theme.colors.danger}>⚠ {error}</AppText>
                  </View>
                ) : null}

                <AppButton
                  title={t('verifyOtpBtn')}
                  onPress={handleStep2}
                  loading={loading}
                  size="lg"
                  fullWidth
                  style={s.ctaBtn}
                />

                <View style={s.resendRow}>
                  {countdown > 0 ? (
                    <AppText variant="caption" color={theme.colors.mutedText}>
                      {t('resendIn')}{' '}
                      <AppText variant="caption" color={theme.colors.primary} style={{ fontWeight: '700' }}>
                        {countdown}s
                      </AppText>
                    </AppText>
                  ) : (
                    <TouchableOpacity onPress={handleResend} disabled={resendLoading} activeOpacity={0.7}>
                      <AppText variant="caption" color={theme.colors.primary} style={s.resendLink}>
                        {resendLoading ? t('sending') : `↩ ${t('resendOtpBtn')}`}
                      </AppText>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            {/* ── Step 3: New password ─────────────────────────────── */}
            {step === 3 && (
              <>
                <View style={s.stepHeader}>
                  <View style={[s.iconRing, { backgroundColor: '#FEF9C3' }]}>
                    <AppText style={s.iconEmoji}>🔑</AppText>
                  </View>
                  <AppText variant="heading" color={theme.colors.text} style={s.cardTitle}>
                    {t('setNewPassword')}
                  </AppText>
                  <AppText variant="body" color={theme.colors.mutedText} style={s.cardSubtitle}>
                    {t('setNewPasswordDesc')}
                  </AppText>
                </View>

                <View style={[s.infoNote, { backgroundColor: '#DCFCE7' }]}>
                  <AppText style={[s.infoNoteText, { color: '#15803D' }]}>✅ {t('otpVerified')}</AppText>
                </View>

                {/* New password with show/hide toggle */}
                <View style={s.controllerField}>
                  <Controller
                    control={step3Form.control}
                    name="password"
                    render={({ field: { onChange, onBlur, value }, fieldState: { error: ferr } }) => (
                      <AppInput
                        label={t('newPasswordLabel')}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder={t('min6Chars')}
                        secureTextEntry={!pwVisible}
                        trailingIcon={pwVisible ? '👁' : '👁‍🗨'}
                        onTrailingPress={() => setPwVisible((v) => !v)}
                        errorText={ferr?.message}
                      />
                    )}
                  />
                </View>

                {/* Confirm password with show/hide toggle */}
                <View style={s.controllerField}>
                  <Controller
                    control={step3Form.control}
                    name="confirmPassword"
                    render={({ field: { onChange, onBlur, value }, fieldState: { error: ferr } }) => (
                      <AppInput
                        label={t('confirmPasswordLabel')}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder={t('reEnterNewPassword')}
                        secureTextEntry={!cpVisible}
                        trailingIcon={cpVisible ? '👁' : '👁‍🗨'}
                        onTrailingPress={() => setCpVisible((v) => !v)}
                        errorText={ferr?.message}
                      />
                    )}
                  />
                </View>

                {error ? (
                  <View style={[s.errorBanner, { backgroundColor: theme.colors.dangerLight }]}>
                    <AppText variant="caption" color={theme.colors.danger}>⚠ {error}</AppText>
                  </View>
                ) : null}

                <AppButton
                  title={`${t('resetPasswordBtn')} 🔐`}
                  onPress={handleStep3}
                  loading={loading}
                  size="lg"
                  fullWidth
                  style={s.ctaBtn}
                />
              </>
            )}
          </Animated.View>

          {/* Trust badges */}
          <View style={s.trustRow}>
            {[t('forgotTrustBadge1'), t('forgotTrustBadge2'), t('forgotTrustBadge3')].map((badge) => (
              <View key={badge} style={[s.trustBadge, { backgroundColor: theme.colors.primaryLight }]}>
                <AppText variant="micro" color={theme.colors.primary}>{badge}</AppText>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },

  // ── Brand strip ───────────────────────────────────────────────────
  brandStrip: {
    backgroundColor: '#1037A4',
    paddingHorizontal: 24,
    paddingBottom: 24,
    overflow: 'hidden',
    minHeight: 200,
    justifyContent: 'flex-end',
  },
  brandContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { fontSize: 20, color: '#fff', fontWeight: '700', lineHeight: 24 },
  brandCenter:   { alignItems: 'center', gap: 2 },
  brandIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  brandLogoImg:  { width: 28, height: 28 },
  brandName:   { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },

  // ── Step indicator ────────────────────────────────────────────────
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  stepCol: { alignItems: 'center', gap: 5 },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone:    { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  stepCircleActive:  { backgroundColor: '#fff',    borderColor: '#fff' },
  stepCirclePending: { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.25)' },
  stepCircleText: { fontSize: 13, fontWeight: '800' },
  stepLabelText:  { fontSize: 10, fontWeight: '600' },
  stepConnector:  { flex: 1, height: 2, marginHorizontal: 8, marginBottom: 20 },

  deco: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  deco1: { width: 200, height: 200, top: -80, right: -60 },
  deco2: { width: 120, height: 120, bottom: -30, right: 80 },

  // ── Layout ────────────────────────────────────────────────────────
  kav:    { flex: 1 },
  scroll: { padding: 20, paddingBottom: 44 },

  card: {
    borderRadius: 24,
    padding: 24,
    marginTop: 0,
  },
  cardShadow: {
    shadowColor: '#1B4FD8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },

  // ── Step header ───────────────────────────────────────────────────
  stepHeader: { alignItems: 'center', marginBottom: 24, gap: 10 },
  iconRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconEmoji:    { fontSize: 36, lineHeight: 42 },
  cardTitle:    { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  cardSubtitle: { textAlign: 'center', lineHeight: 22 },

  // ── Form elements ─────────────────────────────────────────────────
  controllerField: { marginBottom: 0 },

  infoNote: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 16,
  },
  infoNoteText: { fontSize: 13, color: '#166534', fontWeight: '600' },

  whatsappChip: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  whatsappChipText: { fontSize: 13, color: '#075E54', fontWeight: '600' },

  errorBanner: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },

  ctaBtn: { marginTop: 4 },

  resendRow: { alignItems: 'center', marginTop: 16 },
  resendLink: { fontWeight: '700' },

  // ── Trust row ─────────────────────────────────────────────────────
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 20,
  },
  trustBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
});
