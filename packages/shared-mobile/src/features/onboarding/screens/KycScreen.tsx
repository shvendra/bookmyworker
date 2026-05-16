import { zodResolver } from '@hookform/resolvers/zod';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { FormInput } from '../../../shared/components/forms/FormInput';
import { Badge } from '../../../shared/components/ui/Badge';
import { useAppTheme } from '../../../core/theme';
import { LANGUAGE_OPTIONS } from '../../../core/i18n/translations';
import type { OnboardingStackParamList } from '../../../app/navigation/types';
import { type KycFormValues, kycSchema } from '../../auth/validation/authSchemas';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Kyc'>;

export const KycScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state, setLanguage, updateProfile, completeOnboarding } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { control, handleSubmit, watch, setValue } = useForm<KycFormValues>({
    resolver: zodResolver(kycSchema),
    defaultValues: {
      fullName: state.session?.user.fullName ?? '',
      aadhaarLast4: '',
      language: state.session?.user.language ?? 'en',
    },
  });

  const selectedLang = watch('language');
  const kycStatus = state.session?.user.kycStatus ?? 'pending';

  const onSubmit = handleSubmit(async (values) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await Promise.all([
        setLanguage(values.language),
        updateProfile({ fullName: values.fullName, kycStatus: 'pending' }),
      ]);
      await completeOnboarding();
      Alert.alert(
        'KYC Submitted',
        'Your verification details have been submitted. You will be notified once verified.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to complete KYC';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1338B0" />
      <ScreenHeader title="KYC Verification" onBack={() => navigation.goBack()} />
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <AppText variant="title">KYC Verification</AppText>
      <AppText variant="body" color={theme.colors.mutedText} style={styles.subtitle}>
        Complete your identity verification to unlock full platform access.
      </AppText>

      {/* Current Status */}
      <AppCard style={[styles.statusCard, { backgroundColor: kycStatus === 'verified' ? theme.colors.success + '15' : theme.colors.warning + '15' }]}>
        <View style={styles.statusRow}>
          <AppText variant="label">Verification Status</AppText>
          <Badge
            label={kycStatus}
            variant={kycStatus === 'verified' ? 'success' : kycStatus === 'rejected' ? 'danger' : 'warning'}
          />
        </View>
        {kycStatus === 'pending' && (
          <AppText variant="caption" color={theme.colors.mutedText} style={styles.topGap}>
            Submit your details below. Verification usually takes 24-48 hours.
          </AppText>
        )}
        {kycStatus === 'verified' && (
          <AppText variant="caption" color={theme.colors.success} style={styles.topGap}>
            Your identity has been verified. You have full access.
          </AppText>
        )}
        {kycStatus === 'rejected' && (
          <AppText variant="caption" color={theme.colors.danger} style={styles.topGap}>
            Verification was rejected. Please re-submit with correct details.
          </AppText>
        )}
      </AppCard>

      {/* Personal Info */}
      <AppCard style={styles.formCard}>
        <AppText variant="subtitle" style={styles.cardTitle}>Personal Information</AppText>
        <FormInput
          control={control}
          name="fullName"
          label="Full Name (as per Aadhaar) *"
          placeholder="e.g. Ravi Kumar"
        />
        <FormInput
          control={control}
          name="aadhaarLast4"
          label="Last 4 digits of Aadhaar *"
          placeholder="e.g. 1234"
          keyboardType="number-pad"
          maxLength={4}
        />
      </AppCard>

      {/* Language Preference */}
      <AppCard style={styles.formCard}>
        <AppText variant="subtitle" style={styles.cardTitle}>Language Preference</AppText>
        <AppText variant="caption" color={theme.colors.mutedText} style={styles.langSubtitle}>
          Choose the language for your app experience
        </AppText>
        <View style={styles.langGrid}>
          {LANGUAGE_OPTIONS.map((lang) => {
            const isSelected = selectedLang === lang.value;
            return (
              <TouchableOpacity
                key={lang.value}
                onPress={() => setValue('language', lang.value as KycFormValues['language'])}
                style={[
                  styles.langChip,
                  {
                    backgroundColor: isSelected ? theme.colors.primary : theme.colors.card,
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                  },
                ]}
                activeOpacity={0.7}
              >
                <AppText
                  variant="label"
                  color={isSelected ? '#FFFFFF' : theme.colors.text}
                  style={styles.langNative}
                >
                  {lang.nativeLabel}
                </AppText>
                <AppText
                  variant="caption"
                  color={isSelected ? 'rgba(255,255,255,0.8)' : theme.colors.mutedText}
                  style={styles.langEnglish}
                >
                  {lang.englishLabel}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>
      </AppCard>

      {/* Document Upload Placeholder */}
      <AppCard style={[styles.formCard, styles.uploadCard]}>
        <AppText variant="label">📷 Document Upload</AppText>
        <AppText variant="caption" color={theme.colors.mutedText} style={styles.topGap}>
          Upload a photo of your Aadhaar card for faster verification.
        </AppText>
        <AppButton
          title="Upload Aadhaar Photo"
          onPress={() => Alert.alert('Coming Soon', 'Document upload will be available in the next update.')}
          variant="ghost"
          style={styles.uploadBtn}
        />
      </AppCard>

      {errorMessage ? (
        <AppText variant="caption" color={theme.colors.danger} style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      <AppButton
        title={kycStatus === 'rejected' ? 'Re-submit KYC' : 'Submit KYC'}
        onPress={onSubmit}
        loading={isSubmitting}
      />

      <AppText variant="caption" color={theme.colors.mutedText} style={styles.disclaimer}>
        Your Aadhaar details are encrypted and only used for verification purposes.
      </AppText>
    </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  subtitle: { marginTop: 6, marginBottom: 20 },
  statusCard: { marginBottom: 16, padding: 14 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topGap: { marginTop: 6 },
  formCard: { marginBottom: 16 },
  cardTitle: { marginBottom: 12 },
  langSubtitle: { marginBottom: 12 },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langChip: {
    width: '30%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 2,
  },
  langNative: { fontSize: 14, textAlign: 'center' },
  langEnglish: { fontSize: 10, textAlign: 'center' },
  uploadCard: { borderStyle: 'dashed', borderWidth: 1.5 },
  uploadBtn: { marginTop: 10, alignSelf: 'flex-start' },
  error: { marginBottom: 10, textAlign: 'center' },
  disclaimer: { marginTop: 16, textAlign: 'center', paddingHorizontal: 20 },
});
