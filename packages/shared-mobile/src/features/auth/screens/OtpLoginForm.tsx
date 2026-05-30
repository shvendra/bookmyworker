import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';

import { useTranslation } from 'react-i18next';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppInput } from '../../../shared/components/ui/AppInput';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { authService } from '../services/authService';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { ROUTES } from '../../../shared/constants/routes';
import { phoneSchema, type PhoneFormValues } from '../validation/authSchemas';
import type { AuthStackParamList } from '../../../app/navigation/types';
import type { AppRole } from '../../../shared/types/domain';
import type { AppContext } from '../../../core/api/endpoints/authApi';

interface Props {
  navigation: NativeStackNavigationProp<AuthStackParamList>;
  roleHint?: AppRole;
  appContext?: AppContext;
}

export const OtpLoginForm = ({ navigation, roleHint, appContext }: Props): React.JSX.Element => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { control, handleSubmit, formState: { errors } } = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await authService.requestOtp(values.phone, roleHint, appContext);
      toast.success(`OTP sent to +91 ${values.phone}`, 'OTP Sent');
      navigation.navigate(ROUTES.AUTH.OTP_VERIFICATION, { phone: values.phone, roleHint, appContext });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to send OTP. Please try again.';
      setErrorMessage(msg);
      toast.error(msg, 'Failed to Send OTP');
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

      {errorMessage ? (
        <View style={[styles.errorBanner, { backgroundColor: theme.colors.dangerLight }]}>
          <AppText variant="caption" color={theme.colors.danger}>⚠ {errorMessage}</AppText>
        </View>
      ) : null}

      <AppButton
        title={t('sendOtpViaWhatsApp')}
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
  errorBanner: { padding: 12, borderRadius: 10, marginBottom: 14 },
  cta:        { marginTop: 4 },
});
