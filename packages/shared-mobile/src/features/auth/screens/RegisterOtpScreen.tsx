import { zodResolver } from '@hookform/resolvers/zod';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../../state/auth/AuthContext';
import { Screen } from '../../../shared/components/layout/Screen';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { FormInput } from '../../../shared/components/forms/FormInput';
import { useAppTheme } from '../../../core/theme';
import { authService } from '../services/authService';
import { otpSchema, type OtpFormValues } from '../validation/authSchemas';
import type { AuthStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'RegisterOtp'>;

const RESEND_COOLDOWN = 60;

export const RegisterOtpScreen = ({ route, navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'register' | 'login'>('register');
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const params = route.params;

  const { control, handleSubmit, reset } = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });

  const startCountdown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(RESEND_COOLDOWN);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    startCountdown();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startCountdown]);

  const onSubmit = handleSubmit(async ({ otp }) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await authService.verifyOtpForRegistration(params.phone, otp);
      await authService.register({
        name: params.name,
        phone: params.phone,
        password: params.password,
        role: params.role,
        state: params.state,
        district: params.district,
        block: params.block,
        pinCode: params.pinCode,
        email: params.email,
        referredBy: params.referredBy,
        gender: params.gender,
        dob: params.dob,
        address: params.address,
        areasOfWork: params.areasOfWork,
        categories: params.categories,
        workExperience: params.workExperience ? Number(params.workExperience.split(' ')[0]) : undefined,
        salaryType: params.salaryType,
        fixedSalary: params.fixedSalary ? Number(params.fixedSalary) : undefined,
        salaryFrom: params.salaryFrom ? Number(params.salaryFrom) : undefined,
        salaryTo: params.salaryTo ? Number(params.salaryTo) : undefined,
      });
      await authService.requestOtp(params.phone);
      reset({ otp: '' });
      startCountdown();
      setPhase('login');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  });

  const onLoginOtpSubmit = handleSubmit(async ({ otp }) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const session = await authService.loginAfterRegister(params.phone, otp);
      await signIn(session);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  });

  const resendOtp = async (): Promise<void> => {
    if (countdown > 0) return;
    setResendLoading(true);
    setResendError(null);
    try {
      await authService.requestOtp(params.phone);
      startCountdown();
    } catch (error) {
      setResendError(error instanceof Error ? error.message : 'Failed to resend OTP');
    } finally {
      setResendLoading(false);
    }
  };

  const isRegisterPhase = phase === 'register';

  return (
    <Screen scrollable={false}>
      <View style={styles.wrapper}>
        <View>
          {/* Phase indicator */}
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, { backgroundColor: theme.colors.primary }]} />
            <View style={[styles.stepLine, { backgroundColor: isRegisterPhase ? theme.colors.border : theme.colors.primary }]} />
            <View style={[styles.stepDot, { backgroundColor: isRegisterPhase ? theme.colors.border : theme.colors.primary }]} />
          </View>
          <AppText variant="caption" color={theme.colors.mutedText} style={styles.stepLabel}>
            {isRegisterPhase ? 'Step 1 of 2 — Verify & Register' : 'Step 2 of 2 — Log In'}
          </AppText>

          <AppText variant="title" style={styles.title}>
            {isRegisterPhase ? 'Verify Phone Number' : 'Account Created!'}
          </AppText>
          <AppText variant="body" color={theme.colors.mutedText} style={styles.description}>
            OTP sent to <AppText variant="body" color={theme.colors.text}>+91 {params.phone}</AppText> via WhatsApp
          </AppText>
          {!isRegisterPhase && (
            <AppText variant="caption" color={theme.colors.success} style={styles.successNote}>
              ✓ Registration successful. Enter the new OTP to log in.
            </AppText>
          )}

          <FormInput
            control={control}
            name="otp"
            label="Enter OTP"
            placeholder="Enter 6-digit OTP"
            keyboardType="number-pad"
            maxLength={6}
          />

          {errorMessage ? (
            <AppText variant="caption" color={theme.colors.danger} style={styles.errorText}>
              {errorMessage}
            </AppText>
          ) : null}

          {isRegisterPhase && (
            <AppButton
              title="← Change details"
              variant="ghost"
              onPress={() => navigation.goBack()}
              style={styles.ghostButton}
            />
          )}
        </View>

        <View style={styles.footerActions}>
          {resendError ? (
            <AppText variant="caption" color={theme.colors.danger} style={styles.resendError}>
              {resendError}
            </AppText>
          ) : null}

          <AppButton
            title={
              resendLoading
                ? 'Sending…'
                : countdown > 0
                  ? `Resend OTP in ${countdown}s`
                  : 'Resend OTP'
            }
            variant="ghost"
            onPress={resendOtp}
            loading={resendLoading}
            disabled={countdown > 0 || resendLoading}
          />
          <AppButton
            title={isRegisterPhase ? 'Register & Continue' : 'Log In to Dashboard'}
            onPress={isRegisterPhase ? onSubmit : onLoginOtpSubmit}
            loading={isLoading}
          />
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  wrapper: { flex: 1, justifyContent: 'space-between' },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  stepDot: { width: 10, height: 10, borderRadius: 5 },
  stepLine: { flex: 1, height: 2, marginHorizontal: 6 },
  stepLabel: { marginBottom: 12 },
  title: { marginBottom: 6 },
  description: { marginBottom: 4 },
  successNote: { marginBottom: 16, marginTop: 4 },
  errorText: { marginTop: 6 },
  ghostButton: { alignSelf: 'flex-start', marginTop: 8 },
  footerActions: { gap: 10, marginBottom: 12 },
  resendError: { textAlign: 'center' },
});
