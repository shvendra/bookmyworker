import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useTranslation } from 'react-i18next';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppInput } from '../../../shared/components/ui/AppInput';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { loginWithPassword } from '../../../core/api/endpoints/authApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { ROUTES } from '../../../shared/constants/routes';
import type { AuthStackParamList } from '../../../app/navigation/types';
import type { AppRole } from '../../../shared/types/domain';
import type { AppContext } from '../../../core/api/endpoints/authApi';
import { WrongAppNotice } from '../components/WrongAppNotice';
import { parseWrongApp, appForRole, type WrongAppInfo } from '../../../shared/constants/crossApp';

const schema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList>;
  roleHint?: AppRole;
  appContext?: AppContext;
}

export const PasswordLoginForm = ({ navigation, roleHint, appContext }: Props): React.JSX.Element => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [wrongApp, setWrongApp] = useState<WrongAppInfo | null>(null);

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setIsLoading(true);
    setErrorMessage(null);
    setWrongApp(null);
    try {
      const response = await loginWithPassword({
        phone: values.phone,
        password: values.password,
        roleHint,
        appContext,
      });

      // Role mismatch — the backend normally 403s first (see catch → parseWrongApp),
      // but keep a client-side guard for older backends / the no-appContext path.
      const actualRole = response.user.role;
      if (appContext === 'employer-app' && actualRole !== 'employer') {
        setWrongApp({ registeredRole: actualRole, correctApp: appForRole(actualRole) });
        return;
      }
      if (appContext === 'agent-app' && actualRole === 'employer') {
        setWrongApp({ registeredRole: actualRole, correctApp: appForRole(actualRole) });
        return;
      }
      // Legacy checks (no appContext)
      if (!appContext && roleHint === 'employer' && actualRole !== 'employer') {
        setWrongApp({ registeredRole: actualRole, correctApp: appForRole(actualRole) });
        return;
      }
      if (!appContext && !roleHint && actualRole === 'employer') {
        setWrongApp({ registeredRole: actualRole, correctApp: appForRole(actualRole) });
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
      const wa = parseWrongApp(error);
      if (wa) {
        setWrongApp(wa);
        return;
      }
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
     

      <View style={styles.inputGroup}>
        <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.inputLabel}>
          {t('mobileNumber')}
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
          {t('passwordLabel')}
        </AppText>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <AppInput
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('enterPasswordPlaceholder')}
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
          {t('forgotPasswordLink')}
        </AppText>
      </TouchableOpacity>

      {wrongApp ? (
        <WrongAppNotice
          registeredRole={wrongApp.registeredRole}
          correctApp={wrongApp.correctApp}
          fallbackMessage={wrongApp.message}
          onDismiss={() => setWrongApp(null)}
        />
      ) : errorMessage ? (
        <View style={[styles.errorBanner, { backgroundColor: theme.colors.dangerLight }]}>
          <AppText variant="caption" color={theme.colors.danger}>⚠ {errorMessage}</AppText>
        </View>
      ) : null}

      {!wrongApp ? (
        <AppButton
          title={t('login')}
          onPress={onSubmit}
          loading={isLoading}
          size="lg"
          fullWidth
          style={styles.cta}
        />
      ) : null}
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
