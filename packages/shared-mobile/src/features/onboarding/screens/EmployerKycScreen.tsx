import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useAuth } from '../../../state/auth/AuthContext';
import { apiClient } from '../../../core/api/client';
import { resetToMain } from '../../../core/navigation/navigationRef';
import { AppText } from '../../../shared/components/ui/AppText';
import { Badge } from '../../../shared/components/ui/Badge';
import { useAppTheme } from '../../../core/theme';
import { LocationSelector } from '../../../shared/components/forms/LocationSelector';
import { type KycFormValues, kycSchema } from '../../auth/validation/authSchemas';

const BRAND      = '#1037A4';
const BRAND_SOFT = '#EBF1FF';
const NAVY       = '#0F172A';
const SLATE      = '#64748B';
const BORDER     = '#E2E8F0';
const WHITE      = '#FFFFFF';
const GREEN      = '#16A34A';
const GREEN_SOFT = '#DCFCE7';

// Minimal nav interface — avoids cross-package type dependency
interface Props { navigation: { goBack(): void; canGoBack(): boolean } }

export const EmployerKycScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
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

  // Industry employers: GST / firm details are all OPTIONAL (no yes/no toggle, no ID card)
  const isIndustry = Boolean(employerType?.industry);

  const profile = state.session?.user as { state?: string; district?: string; block?: string } | undefined;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Work location — MANDATORY for all employers (state, district/city, block)
  const [locState, setLocState]       = useState(profile?.state ?? '');
  const [locDistrict, setLocDistrict] = useState(profile?.district ?? '');
  const [locBlock, setLocBlock]       = useState(profile?.block ?? '');
  const [locErrors, setLocErrors]     = useState<{ state?: string; district?: string; block?: string }>({});

  // GST state (only relevant for non-individual)
  const [hasGst, setHasGst]       = useState<'yes' | 'no' | null>(null);
  const [gstNumber, setGstNumber] = useState('');
  const [firmName, setFirmName]   = useState('');
  const [firmAddress, setFirmAddress] = useState('');

  const locationComplete = Boolean(locState && locDistrict && locBlock);

  const kycStatus = state.session?.user.kycStatus ?? 'pending';

  const { control, handleSubmit, formState: { errors } } = useForm<KycFormValues>({
    resolver: zodResolver(kycSchema),
    defaultValues: {
      fullName: state.session?.user.fullName ?? '',
      language: (state.session?.user.language as KycFormValues['language']) ?? 'en',
    },
  });

  // Determine if form is ready to submit.
  // Location (state/district/block) is MANDATORY for every employer type.
  // No document upload is required. Industry & individual: location only.
  // Contractor / agency: GST yes/no choice; "yes" requires GST number + firm name.
  const kycReady = isIndustry
    ? true
    : isIndividual
      ? true
      : hasGst === 'yes'
        ? gstNumber.trim().length > 0 && firmName.trim().length > 0
        : hasGst === 'no'
          ? true
          : false;
  const canSubmit = locationComplete && kycReady;

  const validateLocation = (): boolean => {
    const errs: { state?: string; district?: string; block?: string } = {};
    if (!locState)    errs.state    = t('kycLocationRequired');
    if (!locDistrict) errs.district = t('kycLocationRequired');
    if (!locBlock)    errs.block    = t('kycLocationRequired');
    setLocErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = handleSubmit(async (values) => {
    const locOk = validateLocation();
    if (!canSubmit || !locOk) {
      if (!locOk) {
        setErrorMessage(t('kycLocationError'));
      } else if (!hasGst && !isIndividual && !isIndustry) {
        setErrorMessage(t('kycChooseGstError'));
      } else if (hasGst === 'yes' && !gstNumber.trim()) {
        setErrorMessage(t('kycEnterGstError'));
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

      // Location is always saved; GST/firm details added when provided.
      const payload: Record<string, string> = {
        state:    locState,
        district: locDistrict,
        block:    locBlock,
      };
      const wantsGst = isIndustry || hasGst === 'yes';
      if (wantsGst) {
        if (gstNumber.trim())   payload['kyc.gstNumber']   = gstNumber.trim();
        if (firmName.trim())    payload['kyc.firmName']    = firmName.trim();
        if (firmAddress.trim()) payload['kyc.firmAddress'] = firmAddress.trim();
      }
      await apiClient.put('/api/v1/user/update', payload);

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
      <ScreenHeader title={t('wizard_completeProfile')} onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />

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
          <AppText style={[s.stepLabel, { color: SLATE }]}>{t('kycStep2of3')}</AppText>
        </View>

        <AppText style={[s.title, { color: theme.colors.text }]}>{t('almostThere')} 🎉</AppText>
        <AppText style={[s.subtitle, { color: SLATE }]}>
          {t('kycSubtitle')}
        </AppText>

        {/* Verification status */}
        <View style={[
          s.statusBanner,
          { backgroundColor: kycStatus === 'verified' ? '#F0FDF4' : '#FFFBEB',
            borderColor:     kycStatus === 'verified' ? '#86EFAC' : '#FDE68A' },
        ]}>
          <AppText style={s.statusLabel}>{t('verificationStatus')}</AppText>
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
            <AppText style={[s.sectionTitle, { color: theme.colors.text }]}>{t('yourName')}</AppText>
          </View>
          <AppText style={[s.fieldLabel, { color: SLATE }]}>{t('fullNameCompany').toUpperCase()} *</AppText>
          <Controller
            control={control}
            name="fullName"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={t('kycFullNamePlaceholder')}
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

        {/* ── Work Location (MANDATORY for all employers) ── */}
        <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: locationComplete ? BRAND : theme.colors.border }]}>
          <View style={s.sectionHead}>
            <View style={[s.iconBox, { backgroundColor: BRAND_SOFT }]}>
              <AppText style={s.iconEmoji}>📍</AppText>
            </View>
            <AppText style={[s.sectionTitle, { color: theme.colors.text }]}>
              {t('kycLocationSection')} <AppText style={{ color: '#DC2626' }}>*</AppText>
            </AppText>
          </View>
          <AppText style={[s.fieldHint, { color: SLATE }]}>{t('kycLocationHint')}</AppText>
          <LocationSelector
            state={locState}
            district={locDistrict}
            block={locBlock}
            onStateChange={(v) => { setLocState(v); setLocDistrict(''); setLocBlock(''); setLocErrors({}); }}
            onDistrictChange={(v) => { setLocDistrict(v); setLocBlock(''); setLocErrors({}); }}
            onBlockChange={(v) => { setLocBlock(v); setLocErrors({}); }}
            stateError={locErrors.state}
            districtError={locErrors.district}
            blockError={locErrors.block}
            required
          />
        </View>

        {/* ── GST / Firm details ──
            Industry: all OPTIONAL (no toggle, no ID card).
            Contractor / Agency: GST yes/no toggle (existing behaviour). */}
        {isIndustry && (
          <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={s.sectionHead}>
              <View style={[s.iconBox, { backgroundColor: '#FEF3C7' }]}>
                <AppText style={s.iconEmoji}>🧾</AppText>
              </View>
              <AppText style={[s.sectionTitle, { color: theme.colors.text }]}>{t('kycGstSection')}</AppText>
            </View>
            <AppText style={[s.fieldHint, { color: SLATE }]}>{t('kycIndustryGstHint')}</AppText>
            <View style={{ gap: 10 }}>
              <View>
                <AppText style={[s.fieldLabel, { color: SLATE }]}>{t('kycGstNumber').toUpperCase()} {t('kycOptionalTag')}</AppText>
                <TextInput
                  value={gstNumber}
                  onChangeText={setGstNumber}
                  placeholder={t('kycGstPlaceholder')}
                  placeholderTextColor={SLATE}
                  autoCapitalize="characters"
                  style={[s.input, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: gstNumber ? BRAND : BORDER }]}
                />
              </View>
              <View>
                <AppText style={[s.fieldLabel, { color: SLATE }]}>{t('kycFirmName').toUpperCase()} {t('kycOptionalTag')}</AppText>
                <TextInput
                  value={firmName}
                  onChangeText={setFirmName}
                  placeholder={t('kycFirmNamePlaceholder')}
                  placeholderTextColor={SLATE}
                  autoCapitalize="words"
                  style={[s.input, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: firmName ? BRAND : BORDER }]}
                />
              </View>
              <View>
                <AppText style={[s.fieldLabel, { color: SLATE }]}>{t('kycFirmAddress').toUpperCase()}</AppText>
                <TextInput
                  value={firmAddress}
                  onChangeText={setFirmAddress}
                  placeholder={t('kycFirmAddressPlaceholder')}
                  placeholderTextColor={SLATE}
                  multiline
                  numberOfLines={2}
                  style={[s.input, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: firmAddress ? BRAND : BORDER, minHeight: 60, textAlignVertical: 'top' }]}
                />
              </View>
            </View>
          </View>
        )}

        {/* ── GST Section (contractor / agency only — industry handled above) ── */}
        {!isIndividual && !isIndustry && (
          <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={s.sectionHead}>
              <View style={[s.iconBox, { backgroundColor: '#FEF3C7' }]}>
                <AppText style={s.iconEmoji}>🧾</AppText>
              </View>
              <AppText style={[s.sectionTitle, { color: theme.colors.text }]}>{t('kycGstSection')}</AppText>
            </View>

            <AppText style={[s.fieldLabel, { color: SLATE }]}>{t('kycHasGst').toUpperCase()}</AppText>
            <View style={s.toggleRow}>
              <TouchableOpacity
                onPress={() => setHasGst('yes')}
                activeOpacity={0.75}
                style={[s.toggleBtn, { borderColor: hasGst === 'yes' ? GREEN : BORDER, backgroundColor: hasGst === 'yes' ? GREEN_SOFT : theme.colors.background }]}
              >
                <AppText style={[s.toggleTxt, { color: hasGst === 'yes' ? GREEN : SLATE, fontWeight: '700' }]}>
                  {t('kycYesGst')}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setHasGst('no')}
                activeOpacity={0.75}
                style={[s.toggleBtn, { borderColor: hasGst === 'no' ? '#DC2626' : BORDER, backgroundColor: hasGst === 'no' ? '#FFF1F2' : theme.colors.background }]}
              >
                <AppText style={[s.toggleTxt, { color: hasGst === 'no' ? '#DC2626' : SLATE, fontWeight: '700' }]}>
                  {t('kycNoGst')}
                </AppText>
              </TouchableOpacity>
            </View>

            {hasGst === 'yes' && (
              <View style={{ marginTop: 12, gap: 10 }}>
                <View>
                  <AppText style={[s.fieldLabel, { color: SLATE }]}>{t('kycGstNumber').toUpperCase()} *</AppText>
                  <TextInput
                    value={gstNumber}
                    onChangeText={setGstNumber}
                    placeholder={t('kycGstPlaceholder')}
                    placeholderTextColor={SLATE}
                    autoCapitalize="characters"
                    style={[s.input, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: gstNumber ? BRAND : BORDER }]}
                  />
                </View>
                <View>
                  <AppText style={[s.fieldLabel, { color: SLATE }]}>{t('kycFirmName').toUpperCase()} *</AppText>
                  <TextInput
                    value={firmName}
                    onChangeText={setFirmName}
                    placeholder={t('kycFirmNamePlaceholder')}
                    placeholderTextColor={SLATE}
                    autoCapitalize="words"
                    style={[s.input, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: firmName ? BRAND : BORDER }]}
                  />
                </View>
                <View>
                  <AppText style={[s.fieldLabel, { color: SLATE }]}>{t('kycFirmAddress').toUpperCase()}</AppText>
                  <TextInput
                    value={firmAddress}
                    onChangeText={setFirmAddress}
                    placeholder={t('kycFirmAddressPlaceholder')}
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
            <AppText style={s.submitTxt}>{t('continueToApp')} →</AppText>
          )}
        </TouchableOpacity>

        <AppText style={[s.disclaimer, { color: SLATE }]}>
          {t('kycInfoEncrypted')}
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
  statusLabel: { fontSize: 13, fontWeight: '700', color: NAVY, flexShrink: 1, minWidth: 0 },

  card:        { borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  iconBox:     { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  iconEmoji:   { fontSize: 16 },
  sectionTitle:{ fontSize: 15, fontWeight: '800', color: NAVY, flexShrink: 1, minWidth: 0 },

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
