import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppInput } from '../../../shared/components/ui/AppInput';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { loginWithPassword } from '../../../core/api/endpoints/authApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { ROUTES } from '../../../shared/constants/routes';
import type { AuthStackParamList } from '../../../app/navigation/types';
import type { AppRole } from '../../../shared/types/domain';

const schema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList>;
  roleHint?: AppRole;
}

export const PasswordLoginForm = ({ navigation, roleHint }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await loginWithPassword({
        phone: values.phone,
        password: values.password,
        roleHint,
      });

      // Role mismatch — show a clear error instead of silently redirecting
      const actualRole = response.user.role;
      if (roleHint === 'employer' && actualRole !== 'employer') {
        setErrorMessage('No employer account found for this number. Please register as an employer, or use the Worker / Agent app if you have a different account.');
        return;
      }
      if (!roleHint && actualRole === 'employer') {
        setErrorMessage('This number is linked to an Employer account. Please use the BookMyWorker Employer App to log in.');
        return;
      }

      await signIn({
        tokens: {
          accessToken: response.token,
          refreshToken: response.token,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        },
        user: response.user,
        onboardingCompleted: true,
        availableRoles: response.availableRoles,
      });
    } catch (error) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (error instanceof Error ? error.message : 'Invalid phone or password. Please try again.');
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  });

  return (
    <>
      <View style={styles.header}>
        <AppText variant="heading" color={theme.colors.text}>Login with Password 🔑</AppText>
        <AppText variant="body" color={theme.colors.mutedText} style={styles.subtitle}>
          Forgot password? Verify your number via WhatsApp OTP.
        </AppText>
      </View>

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

      <View style={styles.inputGroup}>
        <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.inputLabel}>
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
              placeholder="Enter your password"
              secureTextEntry
              errorText={errors.password?.message}
            />
          )}
        />
      </View>

      <TouchableOpacity
        onPress={() => navigation.navigate(ROUTES.AUTH.FORGOT_PASSWORD, roleHint ? { roleHint } : undefined)}
        style={styles.forgotBtn}
        activeOpacity={0.7}
      >
        <AppText variant="caption" color={theme.colors.primary} style={styles.forgotText}>
          Forgot Password?
        </AppText>
      </TouchableOpacity>

      {errorMessage ? (
        <View style={[styles.errorBanner, { backgroundColor: theme.colors.dangerLight }]}>
          <AppText variant="caption" color={theme.colors.danger}>⚠ {errorMessage}</AppText>
        </View>
      ) : null}

      <AppButton
        title="Login"
        onPress={onSubmit}
        loading={isLoading}
        size="lg"
        fullWidth
        style={styles.cta}
      />
    </>
  );
};

const styles = StyleSheet.create({
  header:     { marginBottom: 24, gap: 6 },
  subtitle:   { lineHeight: 22 },
  inputGroup: { marginBottom: 16, gap: 6 },
  inputLabel: { letterSpacing: 0.3 },
  forgotBtn:  { alignSelf: 'flex-end', marginBottom: 4 },
  forgotText: { fontWeight: '600' },
  errorBanner: { padding: 12, borderRadius: 10, marginBottom: 14 },
  cta:        { marginTop: 4 },
});
