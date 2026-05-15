import { zodResolver } from '@hookform/resolvers/zod';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Controller, useForm, type Control } from 'react-hook-form';
import { Screen } from '../../../shared/components/layout/Screen';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
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

const RESEND_COOLDOWN = 60;

const ROLE_OPTIONS = ['Employer', 'SelfWorker', 'Agent'];

// Map AppRole → backend role string
function toBackendRole(hint?: string): 'Employer' | 'Agent' | 'SelfWorker' | '' {
  switch (hint) {
    case 'employer':   return 'Employer';
    case 'agent':      return 'Agent';
    case 'worker':     return 'SelfWorker';
    default:           return '';
  }
}

export const ForgotPasswordScreen = ({ navigation, route }: Props): React.JSX.Element => {
  const lockedRole = toBackendRole(route.params?.roleHint);
  const { theme } = useAppTheme();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persisted across steps
  const phoneRef = useRef('');
  const roleRef = useRef('SelfWorker');

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
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const handleStep1 = step1Form.handleSubmit(async (values) => {
    setLoading(true);
    setError(null);
    try {
      phoneRef.current = values.phone;
      roleRef.current = values.role;
      await sendPasswordResetOtp({ phone: values.phone, role: values.role });
      startCountdown();
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP');
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
      setError(e instanceof Error ? e.message : 'Failed to resend OTP');
    } finally {
      setResendLoading(false);
    }
  };

  const handleStep2 = step2Form.handleSubmit(async (values) => {
    setLoading(true);
    setError(null);
    try {
      await verifyPasswordResetOtp({ phone: phoneRef.current, otp: values.otp });
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  });

  const handleStep3 = step3Form.handleSubmit(async (values) => {
    setLoading(true);
    setError(null);
    try {
      await resetPassword({
        phone: phoneRef.current,
        password: values.password,
        role: roleRef.current,
      });
      navigation.navigate('Login');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  });

  const stepLabels = ['Enter phone', 'Verify OTP', 'New password'];

  return (
    <Screen scrollable>
      <View style={styles.wrapper}>
        {/* Header */}
        <View>
          <TouchableOpacity onPress={() => (step === 1 ? navigation.goBack() : setStep((s) => (s - 1) as Step))} style={styles.backBtn}>
            <AppText variant="body" color={theme.colors.primary}>← Back</AppText>
          </TouchableOpacity>

          <AppText variant="title" style={styles.title}>Forgot Password</AppText>
          <AppText variant="body" color={theme.colors.mutedText} style={styles.subtitle}>
            Reset your BookMyWorker account password
          </AppText>

          {/* Step indicator */}
          <View style={styles.stepRow}>
            {([1, 2, 3] as Step[]).map((s) => (
              <React.Fragment key={s}>
                <View style={[styles.stepDot, { backgroundColor: step >= s ? theme.colors.primary : theme.colors.border }]}>
                  <AppText variant="caption" color={step >= s ? '#fff' : theme.colors.mutedText} style={styles.stepNum}>
                    {s}
                  </AppText>
                </View>
                {s < 3 && (
                  <View style={[styles.stepLine, { backgroundColor: step > s ? theme.colors.primary : theme.colors.border }]} />
                )}
              </React.Fragment>
            ))}
          </View>
          <AppText variant="caption" color={theme.colors.mutedText} style={styles.stepLabel}>
            Step {step} of 3 — {stepLabels[step - 1]}
          </AppText>
        </View>

        {/* Step 1 */}
        {step === 1 && (
          <View style={styles.form}>
            <FormInput
              control={step1Form.control as Control<ForgotPasswordStep1Values>}
              name="phone"
              label="Mobile Number"
              placeholder="9876543210"
              keyboardType="phone-pad"
              maxLength={10}
            />
            {!lockedRole && (
              <Controller
                control={step1Form.control}
                name="role"
                render={({ field, fieldState }) => (
                  <FormSelect
                    label="Account Type"
                    value={field.value}
                    options={ROLE_OPTIONS}
                    onChange={field.onChange}
                    errorText={fieldState.error?.message}
                  />
                )}
              />
            )}
            {error ? <AppText variant="caption" color={theme.colors.danger} style={styles.error}>{error}</AppText> : null}
            <AppButton title="Send OTP" onPress={handleStep1} loading={loading} style={styles.btn} />
          </View>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <View style={styles.form}>
            <AppText variant="body" color={theme.colors.mutedText} style={styles.hint}>
              OTP sent to <AppText variant="body" color={theme.colors.text}>+91 {phoneRef.current}</AppText> via WhatsApp
            </AppText>
            <FormInput
              control={step2Form.control}
              name="otp"
              label="OTP"
              placeholder="Enter 6-digit OTP"
              keyboardType="number-pad"
              maxLength={6}
            />
            {error ? <AppText variant="caption" color={theme.colors.danger} style={styles.error}>{error}</AppText> : null}
            <AppButton title="Verify OTP" onPress={handleStep2} loading={loading} style={styles.btn} />
            <AppButton
              title={
                resendLoading ? 'Sending…' : countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'
              }
              variant="ghost"
              onPress={handleResend}
              loading={resendLoading}
              disabled={countdown > 0 || resendLoading}
            />
          </View>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <View style={styles.form}>
            <AppText variant="body" color={theme.colors.mutedText} style={styles.hint}>
              OTP verified. Set your new password below.
            </AppText>
            <FormInput
              control={step3Form.control}
              name="password"
              label="New Password"
              placeholder="Min. 6 characters"
              secureTextEntry
            />
            <FormInput
              control={step3Form.control}
              name="confirmPassword"
              label="Confirm Password"
              placeholder="Re-enter password"
              secureTextEntry
            />
            {error ? <AppText variant="caption" color={theme.colors.danger} style={styles.error}>{error}</AppText> : null}
            <AppButton title="Reset Password" onPress={handleStep3} loading={loading} style={styles.btn} />
          </View>
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  wrapper: { flex: 1, paddingBottom: 24 },
  backBtn: { marginBottom: 16 },
  title: { marginBottom: 4 },
  subtitle: { marginBottom: 20 },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontWeight: '700', fontSize: 12 },
  stepLine: { flex: 1, height: 2, marginHorizontal: 4 },
  stepLabel: { marginBottom: 24 },
  form: { gap: 12 },
  hint: { marginBottom: 4 },
  error: { marginTop: 4 },
  btn: { marginTop: 8 },
});
