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
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useAuth } from '../../../state/auth/AuthContext';
import { apiClient } from '../../../core/api/client';
import { AppText } from '../../../shared/components/ui/AppText';
import { Badge } from '../../../shared/components/ui/Badge';
import { useAppTheme } from '../../../core/theme';
import { LANGUAGE_OPTIONS } from '../../../core/i18n/translations';
import type { OnboardingStackParamList } from '../../../app/navigation/types';
import { type KycFormValues, kycSchema } from '../../auth/validation/authSchemas';

interface DocState { uri: string; name: string; type: string }

const pickImage = async (): Promise<DocState | null> => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: true,
    aspect: [4, 3],
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const ext = asset.uri.split('.').pop() ?? 'jpg';
  return { uri: asset.uri, name: `id_front.${ext}`, type: asset.mimeType ?? `image/${ext}` };
};

const BRAND      = '#1037A4';
const BRAND_SOFT = '#EBF1FF';
const NAVY       = '#0F172A';
const SLATE      = '#64748B';
const BORDER     = '#E2E8F0';
const WHITE      = '#FFFFFF';
const GREEN      = '#16A34A';
const GREEN_SOFT = '#DCFCE7';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Kyc'>;

export const EmployerKycScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state, setLanguage, updateProfile, completeOnboarding } = useAuth();

  const employerType = state.session?.user.employerType as
    | { individual?: boolean; contractor?: boolean; agency?: boolean; industry?: boolean }
    | undefined;

  // Pure individual = only individual flag is set (or no type stored yet — default safe)
  const isIndividual =
    Boolean(employerType?.individual) &&
    !employerType?.contractor &&
    !employerType?.agency &&
    !employerType?.industry;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [idFront, setIdFront] = useState<DocState | null>(null);

  // GST state (only relevant for non-individual)
  const [hasGst, setHasGst]       = useState<'yes' | 'no' | null>(null);
  const [gstNumber, setGstNumber] = useState('');
  const [firmName, setFirmName]   = useState('');
  const [firmAddress, setFirmAddress] = useState('');

  const kycStatus = state.session?.user.kycStatus ?? 'pending';

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<KycFormValues>({
    resolver: zodResolver(kycSchema),
    defaultValues: {
      fullName: state.session?.user.fullName ?? '',
      language: (state.session?.user.language as KycFormValues['language']) ?? 'en',
    },
  });

  const selectedLang = watch('language');

  const handlePickId = async (): Promise<void> => {
    const doc = await pickImage();
    if (doc) setIdFront(doc);
  };

  // Determine if form is ready to submit
  const needsIdCard = isIndividual || hasGst === 'no';
  const canSubmit = isIndividual
    ? Boolean(idFront)
    : hasGst === 'yes'
      ? gstNumber.trim().length > 0 && firmName.trim().length > 0
      : hasGst === 'no'
        ? Boolean(idFront)
        : false;

  const onSubmit = handleSubmit(async (values) => {
    if (!canSubmit) {
      if (!hasGst && !isIndividual) {
        setErrorMessage('Please choose whether you have GST registration.');
      } else if (needsIdCard && !idFront) {
        setErrorMessage('Please upload a photo of your government ID card to continue.');
      } else if (hasGst === 'yes' && !gstNumber.trim()) {
        setErrorMessage('Please enter your GST number.');
      }
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

      if (hasGst === 'yes') {
        // Submit GST details
        await apiClient.put('/api/v1/user/update', {
          'kyc.gstNumber':   gstNumber.trim(),
          'kyc.firmName':    firmName.trim(),
          'kyc.firmAddress': firmAddress.trim(),
        });
      } else {
        // Submit ID card (individual or non-individual with no GST)
        const formData = new FormData();
        formData.append('aadharFront', { uri: idFront!.uri, name: idFront!.name, type: idFront!.type } as unknown as Blob);
        await apiClient.put('/api/v1/user/update', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      await completeOnboarding();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader title="Complete Your Profile" onBack={() => navigation.goBack()} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step indicator */}
        <View style={s.stepRow}>
          {[1, 2, 3].map((n) => (
            <View key={n} style={[s.stepDot, { backgroundColor: n <= 2 ? BRAND : BORDER }]} />
          ))}
          <AppText style={[s.stepLabel, { color: SLATE }]}>Step 2 of 3</AppText>
        </View>

        <AppText style={[s.title, { color: theme.colors.text }]}>Almost there! 🎉</AppText>
        <AppText style={[s.subtitle, { color: SLATE }]}>
          Confirm your name and choose your preferred language.
        </AppText>

        {/* Verification status */}
        <View style={[
          s.statusBanner,
          { backgroundColor: kycStatus === 'verified' ? '#F0FDF4' : '#FFFBEB',
            borderColor:     kycStatus === 'verified' ? '#86EFAC' : '#FDE68A' },
        ]}>
          <AppText style={s.statusLabel}>Verification Status</AppText>
          <Badge
            label={kycStatus}
            variant={kycStatus === 'verified' ? 'success' : kycStatus === 'rejected' ? 'danger' : 'warning'}
          />
        </View>

        {/* Name card */}
        <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={s.sectionHead}>
            <View style={[s.iconBox, { backgroundColor: BRAND_SOFT }]}>
              <AppText style={s.iconEmoji}>👤</AppText>
            </View>
            <AppText style={[s.sectionTitle, { color: theme.colors.text }]}>Your Name</AppText>
          </View>
          <AppText style={[s.fieldLabel, { color: SLATE }]}>FULL NAME / COMPANY NAME *</AppText>
          <Controller
            control={control}
            name="fullName"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Enter your name or company name"
                placeholderTextColor={SLATE}
                autoCapitalize="words"
                style={[
                  s.input,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.colors.background,
                    borderColor: errors.fullName ? '#DC2626' : value && value.length > 0 ? BRAND : BORDER,
                  },
                ]}
              />
            )}
          />
          {errors.fullName && (
            <AppText style={s.fieldError}>{errors.fullName.message}</AppText>
          )}
        </View>

        {/* Language card */}
        <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={s.sectionHead}>
            <View style={[s.iconBox, { backgroundColor: BRAND_SOFT }]}>
              <AppText style={s.iconEmoji}>🌐</AppText>
            </View>
            <AppText style={[s.sectionTitle, { color: theme.colors.text }]}>Preferred Language</AppText>
          </View>
          <AppText style={[s.langHint, { color: SLATE }]}>
            The app will display in your selected language
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

        {/* ── GST Section (non-individual employers only) ── */}
        {!isIndividual && (
          <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={s.sectionHead}>
              <View style={[s.iconBox, { backgroundColor: '#FEF3C7' }]}>
                <AppText style={s.iconEmoji}>🧾</AppText>
              </View>
              <AppText style={[s.sectionTitle, { color: theme.colors.text }]}>GST Registration</AppText>
            </View>

            <AppText style={[s.fieldLabel, { color: SLATE }]}>DO YOU HAVE GST? *</AppText>
            <View style={s.toggleRow}>
              <TouchableOpacity
                onPress={() => setHasGst('yes')}
                activeOpacity={0.75}
                style={[s.toggleBtn, { borderColor: hasGst === 'yes' ? GREEN : BORDER, backgroundColor: hasGst === 'yes' ? GREEN_SOFT : theme.colors.background }]}
              >
                <AppText style={[s.toggleTxt, { color: hasGst === 'yes' ? GREEN : SLATE, fontWeight: '700' }]}>
                  ✓  Yes, I have GST
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setHasGst('no')}
                activeOpacity={0.75}
                style={[s.toggleBtn, { borderColor: hasGst === 'no' ? '#DC2626' : BORDER, backgroundColor: hasGst === 'no' ? '#FFF1F2' : theme.colors.background }]}
              >
                <AppText style={[s.toggleTxt, { color: hasGst === 'no' ? '#DC2626' : SLATE, fontWeight: '700' }]}>
                  ✗  No GST
                </AppText>
              </TouchableOpacity>
            </View>

            {hasGst === 'yes' && (
              <View style={{ marginTop: 12, gap: 10 }}>
                <View>
                  <AppText style={[s.fieldLabel, { color: SLATE }]}>GST NUMBER *</AppText>
                  <TextInput
                    value={gstNumber}
                    onChangeText={setGstNumber}
                    placeholder="e.g. 22AAAAA0000A1Z5"
                    placeholderTextColor={SLATE}
                    autoCapitalize="characters"
                    style={[s.input, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: gstNumber ? BRAND : BORDER }]}
                  />
                </View>
                <View>
                  <AppText style={[s.fieldLabel, { color: SLATE }]}>FIRM / COMPANY NAME *</AppText>
                  <TextInput
                    value={firmName}
                    onChangeText={setFirmName}
                    placeholder="Registered firm name"
                    placeholderTextColor={SLATE}
                    autoCapitalize="words"
                    style={[s.input, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: firmName ? BRAND : BORDER }]}
                  />
                </View>
                <View>
                  <AppText style={[s.fieldLabel, { color: SLATE }]}>FIRM ADDRESS (optional)</AppText>
                  <TextInput
                    value={firmAddress}
                    onChangeText={setFirmAddress}
                    placeholder="Registered business address"
                    placeholderTextColor={SLATE}
                    multiline
                    numberOfLines={2}
                    style={[s.input, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: firmAddress ? BRAND : BORDER, minHeight: 60, textAlignVertical: 'top' }]}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── ID Card upload (individual always, non-individual when hasGst = 'no') ── */}
        {(isIndividual || hasGst === 'no') && (
          <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: idFront ? BRAND : theme.colors.border }]}>
            <View style={s.sectionHead}>
              <View style={[s.iconBox, { backgroundColor: BRAND_SOFT }]}>
                <AppText style={s.iconEmoji}>🪪</AppText>
              </View>
              <AppText style={[s.sectionTitle, { color: theme.colors.text }]}>
                Upload ID Card <AppText style={{ color: '#DC2626' }}>*</AppText>
              </AppText>
            </View>
            <AppText style={[s.fieldHint, { color: SLATE }]}>
              Upload a clear photo of any government-issued photo ID — Voter ID, PAN Card, Driving Licence, Passport, etc.
            </AppText>
            <Pressable
              onPress={() => void handlePickId()}
              style={({ pressed }) => [
                s.uploadSlot,
                { borderColor: idFront ? BRAND : SLATE, backgroundColor: theme.colors.background, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              {idFront ? (
                <>
                  <Image source={{ uri: idFront.uri }} style={s.uploadPreview} resizeMode="cover" />
                  <View style={s.uploadOverlay}>
                    <AppText style={s.overlayTick}>✓  ID Uploaded — Tap to change</AppText>
                  </View>
                </>
              ) : (
                <View style={s.uploadEmpty}>
                  <View style={[s.camBox, { backgroundColor: BRAND_SOFT }]}>
                    <AppText style={{ fontSize: 22 }}>📷</AppText>
                  </View>
                  <AppText style={[s.uploadLabel, { color: theme.colors.text }]}>Tap to Upload ID Card</AppText>
                  <AppText style={[s.uploadHint, { color: SLATE }]}>JPG, PNG · Max 5 MB</AppText>
                </View>
              )}
            </Pressable>
          </View>
        )}

        {/* Error */}
        {errorMessage ? (
          <View style={[s.errorBox, { backgroundColor: '#FFF1F2', borderColor: '#FCA5A5' }]}>
            <AppText style={[s.errorText, { color: '#DC2626' }]}>⚠ {errorMessage}</AppText>
          </View>
        ) : null}

        {/* CTA */}
        <TouchableOpacity
          onPress={onSubmit}
          disabled={isSubmitting}
          activeOpacity={0.85}
          style={[s.submitBtn, { backgroundColor: isSubmitting ? SLATE : BRAND }]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={WHITE} size="small" />
          ) : (
            <AppText style={s.submitTxt}>Continue to App →</AppText>
          )}
        </TouchableOpacity>

        <AppText style={[s.disclaimer, { color: SLATE }]}>
          Your information is encrypted and used only for verification purposes.
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
  fieldHint:  { fontSize: 12, marginTop: 6, lineHeight: 17, marginBottom: 12 },

  langHint:    { fontSize: 12, marginBottom: 12, lineHeight: 17 },
  langGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langChip:    { width: '30%', flexGrow: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', gap: 2 },
  langNative:  { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  langEnglish: { fontSize: 10, fontWeight: '500', textAlign: 'center' },

  toggleRow:   { flexDirection: 'row', gap: 10 },
  toggleBtn:   { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  toggleTxt:   { fontSize: 13 },

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

  submitBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  submitTxt: { color: WHITE, fontSize: 16, fontWeight: '800', letterSpacing: 0.1 },

  disclaimer: { fontSize: 12, textAlign: 'center', lineHeight: 17, paddingHorizontal: 16 },
});
