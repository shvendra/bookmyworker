import { zodResolver } from '@hookform/resolvers/zod';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ROUTES } from '../../../shared/constants/routes';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppInput } from '../../../shared/components/ui/AppInput';
import { useAppTheme } from '../../../core/theme';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { authService } from '../services/authService';
import { loginWithPassword } from '../../../core/api/endpoints/authApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { type PhoneFormValues, phoneSchema } from '../validation/authSchemas';
import { useToast } from '../../../shared/state/toast/ToastContext';
import type { AuthStackParamList } from '../../../app/navigation/types';

const passwordLoginSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number'),
  password: z.string().min(1, 'Password is required'),
});
type PasswordLoginValues = z.infer<typeof passwordLoginSchema>;

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const { height: H } = Dimensions.get('window');

export const LoginScreen = ({ navigation, route }: Props): React.JSX.Element => {
  const roleHint = route.params?.roleHint;
  const { theme } = useAppTheme();
  const toast = useToast();
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'otp' | 'password'>('otp');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 9, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // OTP login form
  const otpForm = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  });
  const { control, handleSubmit, formState: { errors } } = otpForm;

  // Password login form
  const pwForm = useForm<PasswordLoginValues>({
    resolver: zodResolver(passwordLoginSchema),
    defaultValues: { phone: '', password: '' },
  });

  const onSubmitOtp = handleSubmit(async (values) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await authService.requestOtp(values.phone, roleHint);
      toast.success(`OTP sent to +91 ${values.phone}`, 'OTP Sent');
      navigation.navigate(ROUTES.AUTH.OTP_VERIFICATION, { phone: values.phone, roleHint });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to send OTP. Please try again.';
      setErrorMessage(msg);
      toast.error(msg, 'Failed to Send OTP');
    } finally {
      setIsLoading(false);
    }
  });

  const onSubmitPassword = pwForm.handleSubmit(async (values) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await loginWithPassword({ phone: values.phone, password: values.password });
      await signIn({
        tokens: { accessToken: response.token, refreshToken: response.token, expiresAt: Date.now() + 24 * 60 * 60 * 1000 },
        user: response.user,
        onboardingCompleted: true,
        availableRoles: response.availableRoles,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Invalid phone or password. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  });

  const switchMode = (newMode: 'otp' | 'password'): void => {
    setMode(newMode);
    setErrorMessage(null);
  };

  const isDark = theme.mode === 'dark';

  return (
    <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F4F6FB' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1338B0" />

      {/* Top brand strip */}
      <View style={styles.brandStrip}>
        <SafeAreaView>
          <View style={styles.brandContent}>
            <View style={styles.brandLogoWrap}>
              <AppText style={styles.brandLogoEmoji}>🏗️</AppText>
            </View>
            <View style={styles.brandTextWrap}>
              <AppText variant="heading" color="#FFFFFF" style={styles.brandName}>
                BookMyWorker
              </AppText>
              <AppText variant="caption" color="rgba(255,255,255,0.7)">
                India's workforce platform
              </AppText>
            </View>
          </View>
        </SafeAreaView>
        {/* Deco circles */}
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
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.card,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
              !isDark && styles.cardShadow,
            ]}
          >
            {/* Mode tabs */}
            <View style={[styles.modeTabs, { borderColor: theme.colors.border }]}>
              <TouchableOpacity
                onPress={() => switchMode('otp')}
                style={[styles.modeTab, mode === 'otp' && { backgroundColor: theme.colors.primary }]}
                activeOpacity={0.8}
              >
                <AppText variant="labelSm" color={mode === 'otp' ? '#fff' : theme.colors.mutedText}>
                  OTP Login
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => switchMode('password')}
                style={[styles.modeTab, mode === 'password' && { backgroundColor: theme.colors.primary }]}
                activeOpacity={0.8}
              >
                <AppText variant="labelSm" color={mode === 'password' ? '#fff' : theme.colors.mutedText}>
                  Password Login
                </AppText>
              </TouchableOpacity>
            </View>

            {mode === 'otp' ? (
              <>
                {/* OTP mode header */}
                <View style={styles.cardHeader}>
                  <AppText variant="heading" color={theme.colors.text}>Welcome back 👋</AppText>
                  <AppText variant="body" color={theme.colors.mutedText} style={styles.cardSubtitle}>
                    Enter your mobile number to receive an OTP
                  </AppText>
                </View>

                {/* Phone input */}
                <View style={styles.inputGroup}>
                  <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.inputLabel}>
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

                {errorMessage ? (
                  <View style={[styles.errorBanner, { backgroundColor: theme.colors.dangerLight }]}>
                    <AppText variant="caption" color={theme.colors.danger}>⚠ {errorMessage}</AppText>
                  </View>
                ) : null}

                <AppButton title="Send OTP" onPress={onSubmitOtp} loading={isLoading} size="lg" fullWidth style={styles.ctaBtn} />
              </>
            ) : (
              <>
                {/* Password mode header */}
                <View style={styles.cardHeader}>
                  <AppText variant="heading" color={theme.colors.text}>Login with Password 🔑</AppText>
                  <AppText variant="body" color={theme.colors.mutedText} style={styles.cardSubtitle}>
                    Enter your registered mobile number and password
                  </AppText>
                </View>

                {/* Phone */}
                <View style={styles.inputGroup}>
                  <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.inputLabel}>
                    Mobile Number
                  </AppText>
                  <Controller
                    control={pwForm.control}
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
                        errorText={pwForm.formState.errors.phone?.message}
                      />
                    )}
                  />
                </View>

                {/* Password */}
                <View style={styles.inputGroup}>
                  <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.inputLabel}>
                    Password
                  </AppText>
                  <Controller
                    control={pwForm.control}
                    name="password"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <AppInput
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="Enter your password"
                        secureTextEntry
                        errorText={pwForm.formState.errors.password?.message}
                      />
                    )}
                  />
                </View>

                {/* Forgot password link */}
                <TouchableOpacity
                  onPress={() => navigation.navigate(ROUTES.AUTH.FORGOT_PASSWORD, roleHint ? { roleHint } : undefined)}
                  style={styles.forgotInlineBtn}
                  activeOpacity={0.7}
                >
                  <AppText variant="caption" color={theme.colors.primary} style={styles.forgotInlineText}>
                    Forgot Password?
                  </AppText>
                </TouchableOpacity>

                {errorMessage ? (
                  <View style={[styles.errorBanner, { backgroundColor: theme.colors.dangerLight }]}>
                    <AppText variant="caption" color={theme.colors.danger}>⚠ {errorMessage}</AppText>
                  </View>
                ) : null}

                <AppButton title="Login" onPress={onSubmitPassword} loading={isLoading} size="lg" fullWidth style={styles.ctaBtn} />
              </>
            )}
          </Animated.View>

          {/* Register link */}
          <View style={styles.registerRow}>
            <AppText variant="body" color={theme.colors.mutedText}>
              New to BookMyWorker?{' '}
            </AppText>
            <Pressable onPress={() => navigation.navigate(ROUTES.AUTH.REGISTER)}>
              <AppText variant="body" color={theme.colors.primary} style={styles.registerLink}>
                Create account
              </AppText>
            </Pressable>
          </View>

          {/* Trust badges */}
          <View style={styles.trustRow}>
            {['🔒 Secure OTP', '⚡ Instant Access', '✅ Verified Platform'].map((item) => (
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
    paddingBottom: 32,
    overflow: 'hidden',
    minHeight: H * 0.22,
    justifyContent: 'flex-end',
  },
  brandContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 16 : 16,
    paddingBottom: 8,
  },
  brandLogoWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoEmoji: { fontSize: 28, lineHeight: 32 },
  brandTextWrap: { gap: 2 },
  brandName: { lineHeight: 28 },
  deco: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  deco1: { width: 200, height: 200, top: -80, right: -60 },
  deco2: { width: 120, height: 120, bottom: -30, right: 80 },

  kav: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },

  card: {
    borderRadius: 24,
    padding: 24,
    marginTop: -20,
  },
  cardShadow: {
    shadowColor: '#1B4FD8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  cardHeader: { marginBottom: 24, gap: 6 },
  cardSubtitle: { lineHeight: 22 },

  inputGroup: { marginBottom: 16, gap: 6 },
  inputLabel: { letterSpacing: 0.3 },

  errorBanner: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },

  ctaBtn: { marginTop: 4 },

  modeTabs: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 0,
  },

  forgotInlineBtn: { alignSelf: 'flex-end', marginBottom: 4 },
  forgotInlineText: { fontWeight: '600' },

  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
  registerLink: { fontWeight: '700' },

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
