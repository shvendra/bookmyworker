import { zodResolver } from '@hookform/resolvers/zod';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { authService } from '../services/authService';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { otpSchema, type OtpFormValues } from '../validation/authSchemas';
import type { AuthStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'RegisterOtp'>;

const { width: W } = Dimensions.get('window');
const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;
const BOX_SIZE = Math.floor((W - 104 - (OTP_LENGTH - 1) * 10) / OTP_LENGTH);

export const RegisterOtpScreen = ({ route, navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const toast = useToast();
  const isDark = theme.mode === 'dark';

  const params = route.params;

  const [digits, setDigits]         = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [focused, setFocused]       = useState(0);
  const [isLoading, setIsLoading]   = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown]   = useState(RESEND_COOLDOWN);
  const [phase, setPhase]           = useState<'register' | 'login'>('register');

  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRefs  = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    inputRefs.current[0]?.focus();
    startCountdown();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shakeBoxes = (): void => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleDigit = (index: number, val: string): void => {
    const ch = val.slice(-1);
    if (!/^\d$/.test(ch) && ch !== '') return;
    const next = [...digits];
    next[index] = ch;
    setDigits(next);
    setErrorMessage(null);
    if (ch && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
      setFocused(index + 1);
    }
    if (ch && index === OTP_LENGTH - 1) {
      const full = [...next].join('');
      if (full.length === OTP_LENGTH) void submitOtp(full);
    }
  };

  const handleKeyPress = (index: number, key: string): void => {
    if (key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits]; next[index] = ''; setDigits(next);
      } else if (index > 0) {
        const next = [...digits]; next[index - 1] = ''; setDigits(next);
        inputRefs.current[index - 1]?.focus();
        setFocused(index - 1);
      }
    }
  };

  const submitOtp = async (otp: string): Promise<void> => {
    if (otp.length < OTP_LENGTH) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (phase === 'register') {
        await authService.verifyOtpForRegistration(params.phone, otp);
        await authService.register({
          name: params.name, phone: params.phone, password: params.password,
          role: params.role, state: params.state, district: params.district,
          block: params.block, pinCode: params.pinCode, email: params.email,
          referredBy: params.referredBy,
          employerType: params.employerType ? (JSON.parse(params.employerType) as { individual?: boolean; contractor?: boolean; agency?: boolean; industry?: boolean }) : undefined,
          gender: params.gender, dob: params.dob,
          address: params.address, areasOfWork: params.areasOfWork, categories: params.categories,
          workExperience: params.workExperience ? Number(params.workExperience.split(' ')[0]) : undefined,
          salaryType: params.salaryType,
          fixedSalary: params.fixedSalary ? Number(params.fixedSalary) : undefined,
          salaryFrom: params.salaryFrom ? Number(params.salaryFrom) : undefined,
          salaryTo: params.salaryTo ? Number(params.salaryTo) : undefined,
        });
        toast.success('Account created!', 'Registration Successful');
        await authService.requestOtp(params.phone);
        setDigits(Array(OTP_LENGTH).fill(''));
        setTimeout(() => { inputRefs.current[0]?.focus(); setFocused(0); }, 100);
        startCountdown();
        setPhase('login');
      } else {
        const roleHint = params.role === 'Employer' ? 'employer' : params.role === 'Agent' ? 'agent' : 'worker';
        const session = await authService.loginAfterRegister(params.phone, otp, roleHint);
        toast.success('Welcome to BookMyWorker!', 'Login Successful');
        await signIn(session);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : (phase === 'register' ? 'Registration failed.' : 'Login failed.');
      setErrorMessage(msg);
      shakeBoxes();
      setDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => { inputRefs.current[0]?.focus(); setFocused(0); }, 100);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = (): void => { void submitOtp(digits.join('')); };

  const resendOtp = async (): Promise<void> => {
    if (countdown > 0) return;
    setResendLoading(true);
    setErrorMessage(null);
    try {
      await authService.requestOtp(params.phone);
      startCountdown();
      setDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => { inputRefs.current[0]?.focus(); setFocused(0); }, 100);
      toast.success(`OTP resent to +91 ${params.phone}`, 'OTP Resent');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resend OTP');
    } finally {
      setResendLoading(false);
    }
  };

  const isRegisterPhase = phase === 'register';
  const filled = digits.filter(Boolean).length;

  return (
    <View style={[s.root, { backgroundColor: isDark ? theme.colors.background : '#F5F7FC' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1338B0" />

      {/* Brand strip */}
      <View style={[s.brandStrip, { paddingTop: insets.top + 12 }]}>
        <View style={s.brandRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
            <AppText style={s.backArrow}>←</AppText>
          </TouchableOpacity>
          <View style={s.brandCenter}>
            <View style={s.brandLogoWrap}>
              <Image source={require('../../../../assets/logo.png')} style={s.brandLogoImg} resizeMode="contain" />
            </View>
            <View>
              <AppText style={s.brandName}>BookMyWorker</AppText>
              <AppText style={s.brandSub}>
                {isRegisterPhase ? 'Step 1 of 2 — Verify & Register' : 'Step 2 of 2 — Log In'}
              </AppText>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Phase dots */}
        <View style={s.phaseRow}>
          <View style={[s.phaseDot, { backgroundColor: '#fff' }]} />
          <View style={[s.phaseLine, { backgroundColor: isRegisterPhase ? 'rgba(255,255,255,0.3)' : '#22C55E' }]} />
          <View style={[s.phaseDot, { backgroundColor: isRegisterPhase ? 'rgba(255,255,255,0.3)' : '#22C55E' }]} />
        </View>

        <View style={[s.deco, s.deco1]} />
        <View style={[s.deco, s.deco2]} />
      </View>

      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[
            s.card,
            { backgroundColor: theme.colors.card, opacity: fadeAnim },
            !isDark && s.cardShadow,
          ]}>
            {/* Header */}
            <View style={s.cardHeader}>
              <View style={[s.iconCircle, { backgroundColor: isRegisterPhase ? theme.colors.primaryLight : '#DCFCE7' }]}>
                <AppText style={s.iconEmoji}>{isRegisterPhase ? '📱' : '✅'}</AppText>
              </View>
              <AppText variant="heading" color={theme.colors.text} style={s.heading}>
                {isRegisterPhase ? 'Verify Your Number' : 'Account Created!'}
              </AppText>
              <AppText variant="body" color={theme.colors.mutedText} style={s.subText}>
                {isRegisterPhase
                  ? `A 6-digit OTP was sent via `
                  : `Account registered! A new OTP was sent via `}
                <AppText variant="body" color="#25D366" style={{ fontWeight: '700' }}>WhatsApp</AppText>
                {' '}to{'\n'}
                <AppText variant="bodyMd" color={theme.colors.text}>+91 {params.phone}</AppText>
              </AppText>
              {isRegisterPhase && (
                <Pressable onPress={() => navigation.goBack()}>
                  <AppText variant="caption" color={theme.colors.primary} style={s.changeLink}>
                    ← Change details
                  </AppText>
                </Pressable>
              )}
            </View>

            {/* OTP Boxes */}
            <Animated.View style={[s.boxRow, { transform: [{ translateX: shakeAnim }] }]}>
              {digits.map((d, i) => {
                const isFocused = focused === i;
                const hasError  = !!errorMessage;
                return (
                  <View
                    key={i}
                    style={[
                      s.box,
                      {
                        width: BOX_SIZE,
                        height: BOX_SIZE + 4,
                        backgroundColor: d
                          ? (isDark ? theme.colors.surface1 : '#F0F4FF')
                          : (isDark ? theme.colors.surface1 : theme.colors.surface2),
                        borderColor: hasError
                          ? theme.colors.danger
                          : isFocused ? theme.colors.primary
                          : d ? theme.colors.primary + '60'
                          : theme.colors.border,
                        borderWidth: isFocused || hasError ? 2 : 1.5,
                      },
                    ]}
                  >
                    <TextInput
                      ref={(r) => { inputRefs.current[i] = r; }}
                      value={d}
                      onChangeText={(v) => handleDigit(i, v)}
                      onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                      onFocus={() => setFocused(i)}
                      keyboardType="number-pad"
                      maxLength={1}
                      style={[
                        s.boxInput,
                        {
                          color: hasError ? theme.colors.danger : theme.colors.text,
                          fontSize: BOX_SIZE * 0.4,
                        },
                      ]}
                      selectTextOnFocus
                    />
                  </View>
                );
              })}
            </Animated.View>

            {/* Error */}
            {errorMessage ? (
              <View style={[s.errorBanner, { backgroundColor: theme.colors.dangerLight }]}>
                <AppText variant="caption" color={theme.colors.danger} center>⚠ {errorMessage}</AppText>
              </View>
            ) : null}

            {/* Progress */}
            {filled > 0 && !errorMessage && (
              <View style={[s.progressBar, { backgroundColor: theme.colors.surface2 }]}>
                <View style={[s.progressFill, { backgroundColor: theme.colors.primary, width: `${(filled / OTP_LENGTH) * 100}%` }]} />
              </View>
            )}

            <AppButton
              title={isLoading ? 'Processing…' : isRegisterPhase ? 'Verify & Register →' : 'Log In to Dashboard →'}
              onPress={handleVerify}
              loading={isLoading}
              disabled={filled < OTP_LENGTH}
              size="lg"
              fullWidth
              style={s.ctaBtn}
            />

            {/* Resend */}
            <View style={s.resendRow}>
              {countdown > 0 ? (
                <AppText variant="caption" color={theme.colors.mutedText} center>
                  Resend OTP in{' '}
                  <AppText variant="caption" color={theme.colors.primary} style={{ fontWeight: '700' }}>{countdown}s</AppText>
                </AppText>
              ) : (
                <Pressable onPress={resendOtp} disabled={resendLoading}>
                  <AppText variant="caption" color={theme.colors.primary} style={s.resendLink}>
                    {resendLoading ? 'Sending…' : '↩ Resend OTP via WhatsApp'}
                  </AppText>
                </Pressable>
              )}
            </View>
          </Animated.View>

          {/* Trust row */}
          <View style={s.trustRow}>
            {['🔒 Secure', '💬 WhatsApp OTP', '✅ Instant'].map((item) => (
              <View key={item} style={[s.trustBadge, { backgroundColor: theme.colors.primaryLight }]}>
                <AppText variant="micro" color={theme.colors.primary}>{item}</AppText>
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

  brandStrip: {
    backgroundColor: '#1338B0',
    paddingHorizontal: 24,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontSize: 20, color: '#fff', fontWeight: '700', lineHeight: 24 },
  brandCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandLogoWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  brandLogoImg: { width: 28, height: 28 },
  brandName:    { fontSize: 14, fontWeight: '800', color: '#fff' },
  brandSub:     { fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 1 },

  phaseRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  phaseDot: { width: 10, height: 10, borderRadius: 5 },
  phaseLine: { flex: 1, height: 2, marginHorizontal: 8 },

  deco: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  deco1: { width: 180, height: 180, top: -80, right: -50 },
  deco2: { width: 100, height: 100, bottom: -20, right: 100 },

  kav:    { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },

  card: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  cardShadow: {
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },

  cardHeader: { alignItems: 'center', marginBottom: 28, gap: 10, width: '100%' },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  iconEmoji:  { fontSize: 30, lineHeight: 36 },
  heading:    { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subText:    { textAlign: 'center', lineHeight: 22 },
  changeLink: { fontWeight: '700', marginTop: 4, textAlign: 'center' },

  boxRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    justifyContent: 'center',
    width: '100%',
  },
  box: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  boxInput: {
    width: '100%', height: '100%',
    textAlign: 'center', fontWeight: '800', padding: 0,
  },

  errorBanner: {
    borderRadius: 10, padding: 10, marginBottom: 12, width: '100%',
  },
  progressBar: {
    height: 3, borderRadius: 2, width: '100%', marginBottom: 16, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },

  ctaBtn: { width: '100%' },

  resendRow:  { marginTop: 18, alignItems: 'center' },
  resendLink: { fontWeight: '700' },

  trustRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 8, marginTop: 20,
  },
  trustBadge: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  
});
