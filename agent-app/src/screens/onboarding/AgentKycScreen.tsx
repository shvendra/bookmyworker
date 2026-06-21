import { zodResolver } from '@hookform/resolvers/zod';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import i18n from '../../../../packages/shared-mobile/src/core/i18n';
import { ScreenHeader } from '../../../../packages/shared-mobile/src/shared/components/ui/GradientHeader';
import { useAuth } from '../../../../packages/shared-mobile/src/state/auth/AuthContext';
import { getAccessToken } from '../../../../packages/shared-mobile/src/core/storage/authStorage';
import { ENV } from '../../../../packages/shared-mobile/src/core/config/env';
import { resetToMain } from '../../../../packages/shared-mobile/src/core/navigation/navigationRef';
import { AppText } from '../../../../packages/shared-mobile/src/shared/components/ui/AppText';
import { Badge } from '../../../../packages/shared-mobile/src/shared/components/ui/Badge';
import { useAppTheme } from '../../../../packages/shared-mobile/src/core/theme';
import { LANGUAGE_OPTIONS } from '../../../../packages/shared-mobile/src/core/i18n/translations';
import type { AgentStackParamList } from '../../navigation/types';
import {
  type KycFormValues,
  kycSchema,
} from '../../../../packages/shared-mobile/src/features/auth/validation/authSchemas';

interface DocState { uri: string; name: string; type: string }

const pickImage = async (): Promise<DocState | null> => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (result.canceled || !result.assets[0]) return null;

    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() ?? 'jpg';

    return {
      uri: asset.uri,
      name: `id_front.${ext}`,
      type: asset.mimeType ?? `image/${ext}`,
    };
  } catch {
    return null;
  }
};

const BRAND      = '#1037A4';
const BRAND_SOFT = '#EBF1FF';
const NAVY       = '#0F172A';
const SLATE      = '#64748B';
const BORDER     = '#E2E8F0';
const WHITE      = '#FFFFFF';

type Props = NativeStackScreenProps<AgentStackParamList, 'Kyc'>;

export const AgentKycScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const { state, setLanguage, updateProfile, completeOnboarding, signOut } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [idFront, setIdFront] = useState<DocState | null>(null);
  const [consent, setConsent] = useState(false);

  const kycStatus = state.session?.user.kycStatus ?? 'pending';

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<KycFormValues>({
    resolver: zodResolver(kycSchema),
    defaultValues: {
      fullName: state.session?.user.fullName ?? '',
      language: (state.session?.user.language as KycFormValues['language']) ?? (i18n.language as KycFormValues['language']) ?? 'en',
    },
  });

  const selectedLang = watch('language');

  const handlePickId = async (): Promise<void> => {
    const doc = await pickImage();
    if (doc) setIdFront(doc);
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!idFront) {
      setErrorMessage(t('kycUploadIdError'));
      return;
    }
    if (!consent) {
      setErrorMessage(t('kyc_consentRequired'));
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const ops: Promise<unknown>[] = [setLanguage(values.language)];
      if (values.fullName?.trim()) {
        ops.push(updateProfile({ fullName: values.fullName }));
      }
      await Promise.all(ops);

      // ID card upload is non-fatal — admin reviews it async, user can proceed
      try {
        const formData = new FormData();
        formData.append('aadharFront', { uri: idFront.uri, name: idFront.name, type: idFront.type } as unknown as Blob);
        formData.append('kycConsent', 'true');
        const token = await getAccessToken();
        await fetch(`${ENV.API_BASE_URL}/api/v1/user/update`, {
          method: 'PUT',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
      } catch {
        // silently ignore — KYC status stays pending, admin can request re-upload
      }

      await completeOnboarding();
      resetToMain();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('kycSomethingWrong'));
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Language card */}
        <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={s.sectionHead}>
            <View style={[s.iconBox, { backgroundColor: BRAND_SOFT }]}>
              <AppText style={s.iconEmoji}>🌐</AppText>
            </View>
            <AppText style={[s.sectionTitle, { color: theme.colors.text }]}>{t('preferredLanguage')}</AppText>
          </View>
          <AppText style={[s.langHint, { color: SLATE }]}>
            {t('appLanguageNote')}
          </AppText>
          <View style={s.langGrid}>
            {LANGUAGE_OPTIONS.map((lang) => {
              const active = selectedLang === lang.value;
              return (
                <TouchableOpacity
                  key={lang.value}
                  onPress={() => setValue('language', lang.value as KycFormValues['language'])}
                  activeOpacity={0.7}
                  style={[
                    s.langChip,
                    { backgroundColor: active ? BRAND : theme.colors.background,
                      borderColor:     active ? BRAND : BORDER },
                  ]}
                >
                  <AppText style={[s.langNative, { color: active ? WHITE : theme.colors.text }]}>
                    {lang.nativeLabel}
                  </AppText>
                  <AppText style={[s.langEnglish, { color: active ? 'rgba(255,255,255,0.75)' : SLATE }]}>
                    {lang.englishLabel}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ID proof upload card */}
        <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={s.sectionHead}>
            <View style={[s.iconBox, { backgroundColor: BRAND_SOFT }]}>
              <AppText style={s.iconEmoji}>🪪</AppText>
            </View>
            <AppText style={[s.sectionTitle, { color: theme.colors.text }]}>{t('kycIdProof')}</AppText>
          </View>
          <Pressable
            style={[s.uploadSlot, { borderColor: idFront ? BRAND : BORDER }]}
            onPress={() => void handlePickId()}
          >
            {idFront ? (
              <>
                <Image source={{ uri: idFront.uri }} style={s.uploadPreview} resizeMode="cover" />
                <View style={s.uploadOverlay}>
                  <AppText style={s.overlayTick}>✓ {t('kycIdUploaded')}</AppText>
                </View>
              </>
            ) : (
              <View style={s.uploadEmpty}>
                <View style={[s.camBox, { backgroundColor: BRAND_SOFT }]}>
                  <AppText style={s.iconEmoji}>📷</AppText>
                </View>
                <AppText style={[s.uploadLabel, { color: theme.colors.text }]}>{t('kycUploadId')}</AppText>
                <AppText style={[s.uploadHint, { color: SLATE }]}>{t('kycUploadIdHint')}</AppText>
              </View>
            )}
          </Pressable>
        </View>

        {/* Error */}
        {errorMessage ? (
          <View style={[s.errorBox, { backgroundColor: '#FFF1F2', borderColor: '#FCA5A5' }]}>
            <AppText style={[s.errorText, { color: '#DC2626' }]}>⚠ {errorMessage}</AppText>
          </View>
        ) : null}

        {/* Consent (required) */}
        <Pressable onPress={() => setConsent((c) => !c)} style={s.consentRow}>
          <View style={[s.consentBox, { borderColor: consent ? BRAND : BORDER, backgroundColor: consent ? BRAND : 'transparent' }]}>
            {consent ? <AppText style={s.consentTick}>✓</AppText> : null}
          </View>
          <AppText style={[s.consentTxt, { color: SLATE }]}>{t('kyc_consentLabel')}</AppText>
        </Pressable>

        {/* CTA */}
        <TouchableOpacity
          onPress={onSubmit}
          disabled={isSubmitting || !idFront || !consent}
          activeOpacity={0.85}
          style={[s.submitBtn, { backgroundColor: isSubmitting || !idFront || !consent ? SLATE : BRAND }]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={WHITE} size="small" />
          ) : (
            <AppText style={s.submitTxt}>{idFront ? `${t('continueToApp')} →` : t('uploadIdToContinue')}</AppText>
          )}
        </TouchableOpacity>

        <AppText style={[s.disclaimer, { color: SLATE }]}>
          {t('privacyNote')}
        </AppText>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48, gap: 14 },

  stepRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  stepDot:   { width: 8, height: 8, borderRadius: 4 },
  stepLabel: { fontSize: 12, fontWeight: '600', marginLeft: 4 },

  title:    { fontSize: 24, fontWeight: '900', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: -4 },

  statusBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  statusLabel: { fontSize: 13, fontWeight: '700', color: NAVY },

  card:        { borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  iconBox:     { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  iconEmoji:   { fontSize: 16 },
  sectionTitle:{ fontSize: 15, fontWeight: '800', color: NAVY },

  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, color: SLATE },
  input:      { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontWeight: '500' },
  fieldError: { fontSize: 12, color: '#DC2626', marginTop: 4 },
  fieldHint:  { fontSize: 12, lineHeight: 18, marginBottom: 12, color: SLATE },

  langHint:    { fontSize: 12, marginBottom: 12, lineHeight: 17 },
  langGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langChip:    { width: '30%', flexGrow: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', gap: 2 },
  langNative:  { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  langEnglish: { fontSize: 10, fontWeight: '500', textAlign: 'center' },

  uploadSlot:   { height: 130, borderWidth: 1.5, borderRadius: 14, borderStyle: 'dashed', overflow: 'hidden' },
  uploadPreview:{ width: '100%', height: '100%' },
  uploadOverlay:{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(16,55,164,0.85)', padding: 10, alignItems: 'center' },
  overlayTick:  { color: '#fff', fontSize: 13, fontWeight: '700' },
  uploadEmpty:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12 },
  camBox:       { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  uploadLabel:  { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  uploadHint:   { fontSize: 11, textAlign: 'center' },

  errorBox:  { borderRadius: 10, borderWidth: 1, padding: 12 },
  errorText: { fontSize: 13 },

  consentRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 4 },
  consentBox:  { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  consentTick: { color: '#fff', fontSize: 13, fontWeight: '900', lineHeight: 16 },
  consentTxt:  { flex: 1, fontSize: 12, lineHeight: 18 },

  submitBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  submitTxt: { color: WHITE, fontSize: 16, fontWeight: '800', letterSpacing: 0.1 },

  disclaimer: { fontSize: 12, textAlign: 'center', lineHeight: 17, paddingHorizontal: 16 },
});
