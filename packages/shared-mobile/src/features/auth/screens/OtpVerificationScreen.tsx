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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { authService } from '../services/authService';
import { useToast } from '../../../shared/state/toast/ToastContext';
import type { AuthStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'OtpVerification'>;

const { width: W } = Dimensions.get('window');
const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;
// Account for scroll padding (20×2=40) + card padding (24×2=48) + breathing room (16)
const BOX_SIZE = Math.floor((W - 104 - (OTP_LENGTH - 1) * 10) / OTP_LENGTH);

export const OtpVerificationScreen = ({ route, navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const toast = useToast();
  const isDark = theme.mode === 'dark';

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [focused, setFocused] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRefs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    inputRefs.current[0]?.focus();
    startCountdown();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const shakeBoxes = (): void => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
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
    // Auto-submit when last digit entered
    if (ch && index === OTP_LENGTH - 1) {
      const full = [...next].join('');
      if (full.length === OTP_LENGTH) void submitOtp(full);
    }
  };

  const handleKeyPress = (index: number, key: string): void => {
    if (key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
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
      const session = await authService.verifyOtp({ phone: route.params.phone, otp, roleHint: route.params.roleHint });
      toast.success('Welcome to BookMyWorker!', 'Login Successful');
      await signIn(session);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Invalid OTP. Please try again.';
      setErrorMessage(msg);
      shakeBoxes();
      setDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => { inputRefs.current[0]?.focus(); setFocused(0); }, 100);
      toast.error(msg, 'Verification Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = (): void => {
    void submitOtp(digits.join(''));
  };

  const handleResend = async (): Promise<void> => {
    if (countdown > 0) return;
    setResendLoading(true);
    try {
      await authService.requestOtp(route.params.phone);
      startCountdown();
      setDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => { inputRefs.current[0]?.focus(); setFocused(0); }, 100);
      toast.success(`OTP resent to +91 ${route.params.phone}`, 'OTP Resent');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resend OTP');
    } finally {
      setResendLoading(false);
    }
  };

  const filled = digits.filter(Boolean).length;

  return (
    <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F5F7FC' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1338B0" />

      {/* Brand strip */}
      <View style={[styles.brandStrip, { paddingTop: insets.top + 12 }]}>
        <View style={styles.brandContent}>
          <View style={styles.brandLogoWrap}>
            <Image source={require('../../../../assets/logo.png')} style={styles.brandLogoImg} resizeMode="contain" />
          </View>
          <View>
            <AppText style={styles.brandName}>BookMyWorker</AppText>
            <AppText style={styles.brandTagline}>Verify your number</AppText>
          </View>
        </View>
        <View style={[styles.deco, styles.deco1]} />
        <View style={[styles.deco, styles.deco2]} />
      </View>

      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View
            style={[
              styles.card,
              { backgroundColor: theme.colors.card, opacity: fadeAnim },
              !isDark && styles.cardShadow,
            ]}
          >
            {/* Header */}
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: theme.colors.primaryLight }]}>
                <AppText style={styles.iconEmoji}>📱</AppText>
              </View>
              <AppText variant="heading" color={theme.colors.text} style={styles.heading}>
                Verify Your Number
              </AppText>
              <AppText variant="body" color={theme.colors.mutedText} center style={styles.subText}>
                We sent a {OTP_LENGTH}-digit OTP via{' '}
                <AppText variant="bodyMd" color="#25D366">WhatsApp</AppText>
                {' '}to{'\n'}
                <AppText variant="bodyMd" color={theme.colors.text}>+91 {route.params.phone}</AppText>
              </AppText>
              <Pressable onPress={() => navigation.goBack()}>
                <AppText variant="caption" color={theme.colors.primary} style={styles.changeLink}>
                  Change number
                </AppText>
              </Pressable>
            </View>

            {/* OTP Boxes */}
            <Animated.View style={[styles.boxRow, { transform: [{ translateX: shakeAnim }] }]}>
              {digits.map((d, i) => {
                const isFocused = focused === i;
                const hasError = !!errorMessage;
                return (
                  <View
                    key={i}
                    style={[
                      styles.box,
                      {
                        width: BOX_SIZE,
                        height: BOX_SIZE + 4,
                        backgroundColor: d
                          ? (isDark ? theme.colors.surface1 : '#F0F4FF')
                          : (isDark ? theme.colors.surface1 : theme.colors.surface2),
                        borderColor: hasError
                          ? theme.colors.danger
                          : isFocused
                          ? theme.colors.primary
                          : d
                          ? theme.colors.primary + '60'
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
                        styles.boxInput,
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
              <View style={[styles.errorBanner, { backgroundColor: theme.colors.dangerLight }]}>
                <AppText variant="caption" color={theme.colors.danger} center>
                  ⚠ {errorMessage}
                </AppText>
              </View>
            ) : null}

            {/* Progress indicator */}
            {filled > 0 && !errorMessage && (
              <View style={[styles.progressBar, { backgroundColor: theme.colors.surface2 }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: theme.colors.primary,
                      width: `${(filled / OTP_LENGTH) * 100}%`,
                    },
                  ]}
                />
              </View>
            )}

            {/* Verify button */}
            <AppButton
              title={isLoading ? 'Verifying…' : 'Verify & Continue →'}
              onPress={handleVerify}
              loading={isLoading}
              disabled={filled < OTP_LENGTH}
              size="lg"
              fullWidth
              style={styles.ctaBtn}
            />

            {/* Resend */}
            <View style={styles.resendRow}>
              {countdown > 0 ? (
                <AppText variant="caption" color={theme.colors.mutedText} center>
                  Resend OTP in{' '}
                  <AppText variant="caption" color={theme.colors.primary} style={{ fontWeight: '700' }}>
                    {countdown}s
                  </AppText>
                </AppText>
              ) : (
                <Pressable onPress={handleResend} disabled={resendLoading}>
                  <AppText variant="caption" color={theme.colors.primary} style={styles.resendLink}>
                    {resendLoading ? 'Sending…' : '↩ Resend OTP'}
                  </AppText>
                </Pressable>
              )}
            </View>
          </Animated.View>

          {/* Trust row */}
          <View style={styles.trustRow}>
            {['🔒 End-to-end encrypted', '💬 Sent via WhatsApp', '✅ Secure verification'].map((item) => (
              <View key={item} style={[styles.trustBadge, { backgroundColor: theme.colors.primaryLight }]}>
                <AppText variant="micro" color={theme.colors.primary}>{item}</AppText>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },

  brandStrip: {
    backgroundColor: '#1338B0',
    paddingHorizontal: 24,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  brandContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 4,
  },
  brandLogoWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoImg: { width: 32, height: 32 },
  brandName:    { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  brandTagline: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  deco: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  deco1: { width: 180, height: 180, top: -80, right: -50 },
  deco2: { width: 100, height: 100, bottom: -20, right: 100 },

  kav: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },

  card: {
    borderRadius: 24,
    padding: 24,
    marginTop: 0,
    alignItems: 'center',
  },
  cardShadow: {
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },

  cardHeader: { alignItems: 'center', marginBottom: 28, gap: 10 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconEmoji: { fontSize: 30, lineHeight: 36 },
  heading: { fontSize: 24, fontWeight: '800' },
  subText: { lineHeight: 22 },
  changeLink: { fontWeight: '700', marginTop: 2 },

  boxRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    justifyContent: 'center',
  },
  box: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  boxInput: {
    width: '100%',
    height: '100%',
    textAlign: 'center',
    fontWeight: '800',
    padding: 0,
  },

  errorBanner: {
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    width: '100%',
  },

  progressBar: {
    height: 3,
    borderRadius: 2,
    width: '100%',
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  ctaBtn: { width: '100%' },

  resendRow: {
    marginTop: 18,
    alignItems: 'center',
  },
  resendLink: { fontWeight: '700' },

  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  trustBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
});
