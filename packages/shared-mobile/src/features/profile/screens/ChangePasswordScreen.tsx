import { zodResolver } from '@hookform/resolvers/zod';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ScrollView, StatusBar, StyleSheet } from 'react-native';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { updateProfile } from '../../../core/api/endpoints/authApi';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { FormInput } from '../../../shared/components/forms/FormInput';
import { useAppTheme } from '../../../core/theme';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'ChangePassword'>;

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Required'),
  newPassword: z.string().min(6, 'Min 6 characters'),
  confirmPassword: z.string().min(1, 'Required'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

// Dedicated Change Password screen — Profile → Change Password, just above
// Sign Out. Posts ONLY the three password fields to the same safe,
// old-password-verified /api/v1/user/update endpoint EditProfileScreen used
// to call inline (backend's `updateUser`: requires all three, bcrypt-checks
// oldPassword against the stored hash, 401s with "Old password incorrect" if
// it doesn't match). Every other field on the account falls back to its
// existing stored value when omitted from the request, so a password-only
// submit here never touches name/email/bank details/etc.
export const ChangePasswordScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, reset } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('oldPassword', values.oldPassword);
      formData.append('newPassword', values.newPassword);
      formData.append('confirmPassword', values.confirmPassword);
      await updateProfile(formData);
      reset({ oldPassword: '', newPassword: '', confirmPassword: '' });
      toast.success(t('changepw_success'));
      navigation.goBack();
    } catch (e) {
      // Backend messages are already user-facing: "Old password incorrect",
      // "Fill all password fields", "New password and confirm password must match".
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message ?? t('changepw_genericError'));
    } finally {
      setLoading(false);
    }
  });

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title={t('profile_changePassword')} onBack={() => navigation.goBack()} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="body" color={theme.colors.mutedText} style={styles.subtitle}>
          {t('changepw_subtitle')}
        </AppText>

        <AppCard style={styles.card}>
          <FormInput control={control} name="oldPassword" label={t('ep_currentPassword')} placeholder={t('ep_currentPasswordPlaceholder')} secureTextEntry />
          <FormInput control={control} name="newPassword" label={t('ep_newPassword')} placeholder={t('ep_newPasswordPlaceholder')} secureTextEntry />
          <FormInput control={control} name="confirmPassword" label={t('ep_confirmPassword')} placeholder={t('ep_confirmPasswordPlaceholder')} secureTextEntry />
        </AppCard>

        {error ? (
          <AppText variant="caption" color={theme.colors.danger} style={styles.error}>{error}</AppText>
        ) : null}

        <AppButton title={t('changepw_submit')} onPress={onSubmit} loading={loading} style={styles.submitBtn} />
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  subtitle: { marginBottom: 16 },
  card: { marginBottom: 16 },
  error: { marginBottom: 12 },
  submitBtn: { marginTop: 4 },
});
