import { zodResolver } from '@hookform/resolvers/zod';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlert } from '../../../../packages/shared-mobile/src/shared/state/alert/AppAlertContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import * as DocumentPicker from 'expo-document-picker';

import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AGENT_LANG_KEY } from '../language/LanguageSelectScreen';
import { useAppTheme } from '../../../../packages/shared-mobile/src/core/theme';
import { useAuth } from '../../../../packages/shared-mobile/src/state/auth/AuthContext';
import { useAppConfig } from '../../../../packages/shared-mobile/src/core/api/endpoints/appConfigApi';
import { workerApi } from '../../../../packages/shared-mobile/src/core/api/endpoints/workerApi';
import { AppButton } from '../../../../packages/shared-mobile/src/shared/components/ui/AppButton';
import { AppText } from '../../../../packages/shared-mobile/src/shared/components/ui/AppText';
import { AppInput } from '../../../../packages/shared-mobile/src/shared/components/ui/AppInput';
import { authService } from '../../../../packages/shared-mobile/src/features/auth/services/authService';
import {
  registerStep2Schema,
  type RegisterStep2Values,
} from '../../../../packages/shared-mobile/src/features/auth/validation/authSchemas';
import { WORKER_QUALIFICATION_TIERS } from '../../../../packages/shared-mobile/src/shared/data/workerQualificationTiers';
import { DIPLOMA_GRADUATE_SUBTYPE } from '../../../../packages/shared-mobile/src/shared/data/supportStaffCategories';
import type { AgentStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AgentStackParamList, 'Register'>;
type Role = 'Agent' | 'SelfWorker';

const BRAND  = '#1037A4';
const ORANGE = '#F97316';
const { width: W } = Dimensions.get('window');
const SUB_GAP    = 10;
const SUB_CARD_W = (W - 40 - SUB_GAP) / 2; // 2-col grid card width

const ROLE_OPTIONS: Array<{ value: Role; labelKey: string; descKey: string; icon: string; color: string; bg: string }> = [
  { value: 'SelfWorker', labelKey: 'roleJobSeeker',     descKey: 'roleJobSeekerDesc',     icon: '👷', color: ORANGE, bg: '#FFF3E8' },
  { value: 'Agent',      labelKey: 'roleAgentSupplier', descKey: 'roleAgentSupplierDesc', icon: '🤝', color: BRAND,  bg: '#EBF1FF' },
];

// Qualification boxes come from the shared WORKER_QUALIFICATION_TIERS source of
// truth so the agent app's register screen stays in sync with onboarding / edit
// (Skilled, Unskilled, 10th/12th/ITI, Diploma/Graduate — all 11 languages).
const WORKER_SUB_TYPES = WORKER_QUALIFICATION_TIERS;

const AGENT_TYPES: Array<{ value: string; labelKey: string; descKey: string; icon: string }> = [
  { value: 'Group worker supplier',     labelKey: 'agentTypeGroupSupplier',     descKey: 'agentTypeGroupSupplierDesc',     icon: '👥' },
  { value: 'Skilled worker supplier',   labelKey: 'agentTypeSkilledSupplier',   descKey: 'agentTypeSkilledSupplierDesc',   icon: '🔧' },
  { value: 'Unskilled worker supplier', labelKey: 'agentTypeUnskilledSupplier', descKey: 'agentTypeUnskilledSupplierDesc', icon: '🏗️' },
  { value: 'Contract worker supplier',  labelKey: 'agentTypeContractSupplier',  descKey: 'agentTypeContractSupplierDesc',  icon: '📋' },
];

export const AgentRegisterScreen = ({ navigation }: Props): React.JSX.Element => {
  const { t, i18n } = useTranslation();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  // SuperAdmin toggle — when false, registration skips the WhatsApp OTP step and
  // creates the account directly (otherwise the backend rejects requestOtp and the
  // user is stuck on an "OTP disabled" error).
  const { config } = useAppConfig();
  const registrationOtpEnabled = config.authFlags.registrationOtpEnabled;

  const [step, setStep]               = useState<1 | 2>(1);
  const [role, setRole]               = useState<Role | null>(null);
  const [workerSubType, setWorkerSubType] = useState('');
  const [agentType, setAgentType]     = useState('');
  const [resumeUri, setResumeUri]     = useState<string | null>(null);
  const [resumeName, setResumeName]   = useState<string | null>(null);
  const [isLoading, setIsLoading]     = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<RegisterStep2Values>({
    resolver: zodResolver(registerStep2Schema),
    defaultValues: { name: '', phone: '', password: '', confirmPassword: '' },
  });

  const onSelectRole = (r: Role): void => {
    setRole(r);
    setWorkerSubType('');
    setAgentType('');
    setResumeUri(null);
    setResumeName(null);
  };

  const showResume = role === 'SelfWorker' && (workerSubType === '10th/12th/ITI' || workerSubType === DIPLOMA_GRADUATE_SUBTYPE);

  const canContinue = (): boolean => {
    if (!role) return false;
    if (role === 'Agent') return agentType !== '';
    if (role === 'SelfWorker') return workerSubType !== '';
    return false;
  };

  const pickResume = async (): Promise<void> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        setResumeUri(result.assets[0].uri);
        setResumeName(result.assets[0].name);
      }
    } catch {
      showAlert(t('alertError'), t('regPickFileError'));
    }
  };

  const goToStep2 = (): void => {
    if (!role) { showAlert(t('alertRequired'), t('regSelectRole')); return; }
    if (role === 'Agent' && !agentType) { showAlert(t('alertRequired'), t('regSelectAgentType')); return; }
    if (role === 'SelfWorker' && !workerSubType) { showAlert(t('alertRequired'), t('regSelectWorkerType')); return; }
    setStep(2);
  };

  // Direct (no-OTP) registration. Mirrors the post-verify flow in RegisterOtpScreen
  // so the experience is identical apart from the skipped OTP step.
  const registerDirectly = async (values: RegisterStep2Values, language?: string): Promise<void> => {
    if (!role) return;
    const selectedLang = language ?? i18n.language ?? 'hi';
    await authService.register({
      name: values.name,
      phone: values.phone,
      password: values.password,
      role,
      language: selectedLang,
      workerSubType: workerSubType || undefined,
      agentType: agentType || undefined,
    });
    // Log in with the password just set — no second OTP. Fresh registrations route
    // through profile completion first, so mark onboarding incomplete.
    const roleHint = role === 'Agent' ? 'agent' : 'worker';
    const session = await authService.loginWithPassword(values.phone, values.password, roleHint);
    session.onboardingCompleted = false;
    if (resumeUri && resumeName) {
      try { await workerApi.uploadResume(resumeUri, resumeName); } catch { /* non-fatal */ }
    }
    if (i18n.language !== selectedLang) await i18n.changeLanguage(selectedLang);
    await signIn(session);
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!role) return;
    setIsLoading(true);
    try {
      const savedLang = await AsyncStorage.getItem(AGENT_LANG_KEY);
      if (!registrationOtpEnabled) {
        // OTP disabled by admin → create the account directly and skip the OTP step.
        await registerDirectly(values, savedLang ?? undefined);
        return;
      }
      await authService.requestOtp(values.phone, undefined);
      navigation.navigate('RegisterOtp', {
        phone: values.phone,
        role,
        name: values.name,
        password: values.password,
        language: savedLang ?? undefined,
        workerSubType: workerSubType || undefined,
        agentType: agentType || undefined,
        resumeUri: resumeUri ?? undefined,
        resumeName: resumeName ?? undefined,
      });
    } catch (error) {
      showAlert(t('alertError'), error instanceof Error ? error.message : t('regOtpFailed'));
    } finally {
      setIsLoading(false);
    }
  });

  const isDark       = theme.mode === 'dark';
  const accentColor  = role === 'Agent' ? BRAND : ORANGE;
  const footerH      = 76 + insets.bottom;

  // ── Step 1: Role + Sub-type ───────────────────────────────────────────────────
  if (step === 1) {
    const subTypes       = role === 'SelfWorker' ? WORKER_SUB_TYPES : role === 'Agent' ? AGENT_TYPES : [];
    const selectedSubVal = role === 'SelfWorker' ? workerSubType : agentType;
    const setSubType     = role === 'SelfWorker' ? setWorkerSubType : setAgentType;
    const useGrid        = role === 'SelfWorker'; // 2-col grid for the 4 compact worker types

    return (
      <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F0F4FB' }]}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />

        {/* ── Compact hero ─────────────────────────────────────────────── */}
        <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          <View style={[styles.circle, styles.c1]} />
          <View style={[styles.circle, styles.c2]} />
          <View style={[styles.circle, styles.c3]} />
          <View style={styles.orangeStrip} />

          <View style={styles.brandRow}>
            <View style={styles.logoBox}>
              <Image
                source={require('../../../../packages/shared-mobile/assets/logo.png')}
                style={styles.logoImg}
                resizeMode="contain"
              />
            </View>
          </View>

          <AppText style={styles.heroTitle} color="#FFFFFF">{t('joinPlatform')}</AppText>
          <AppText style={styles.heroSub}   color="rgba(255,255,255,0.78)">{t('agentHeroSub')}</AppText>
        </View>

        {/* ── Scrollable content ───────────────────────────────────────── */}
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            canContinue() && { paddingBottom: footerH + 8 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Who are you? */}
          <View style={styles.secHeader}>
            <View style={[styles.secDot, { backgroundColor: BRAND }]} />
            <AppText style={[styles.secLabel, { color: theme.colors.mutedText }]}>{t('whoAreYou')}</AppText>
          </View>

          <View style={styles.roleList}>
            {ROLE_OPTIONS.map(opt => {
              const sel = role === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => onSelectRole(opt.value)}
                  activeOpacity={0.85}
                  style={[
                    styles.roleCard,
                    {
                      backgroundColor: sel ? opt.bg : (isDark ? theme.colors.surface : '#FFFFFF'),
                      borderColor: sel ? opt.color : (isDark ? theme.colors.border : '#E2E8F0'),
                      borderWidth: sel ? 2 : 1,
                    },
                  ]}
                >
                  <View style={[styles.roleIconWrap, { backgroundColor: sel ? opt.color : opt.color + '1A' }]}>
                    <AppText style={styles.roleEmoji}>{opt.icon}</AppText>
                  </View>
                  <View style={styles.roleTexts}>
                    <AppText style={[styles.roleName, { color: sel ? opt.color : theme.colors.text }]}>
                      {t(opt.labelKey)}
                    </AppText>
                    <AppText style={[styles.roleDesc, { color: theme.colors.mutedText }]} numberOfLines={3}>
                      {t(opt.descKey)}
                    </AppText>
                  </View>
                  <View style={[styles.checkCircle, {
                    backgroundColor: sel ? opt.color : 'transparent',
                    borderColor: sel ? opt.color : (isDark ? theme.colors.border : '#CBD5E1'),
                  }]}>
                    {sel && <AppText style={styles.checkMark}>✓</AppText>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Sub-type / work type */}
          {subTypes.length > 0 && (
            <>
              <View style={[styles.secHeader, { marginTop: 22 }]}>
                <View style={[styles.secDot, { backgroundColor: accentColor }]} />
                <AppText style={[styles.secLabel, { color: theme.colors.mutedText }]}>
                  {role === 'SelfWorker' ? t('myWorkType') : t('myRoleAsAgent')}
                </AppText>
              </View>

              {useGrid ? (
                /* 2-col grid — worker sub-types */
                <View style={styles.subGrid}>
                  {subTypes.map(st => {
                    const sel = selectedSubVal === st.value;
                    return (
                      <TouchableOpacity
                        key={st.value}
                        onPress={() => setSubType(st.value)}
                        activeOpacity={0.85}
                        style={[
                          styles.subGridCard,
                          {
                            width: SUB_CARD_W,
                            backgroundColor: sel
                              ? accentColor + '14'
                              : (isDark ? theme.colors.surface : '#FFFFFF'),
                            borderColor: sel ? accentColor : (isDark ? theme.colors.border : '#E2E8F0'),
                            borderWidth: sel ? 2 : 1,
                          },
                        ]}
                      >
                        {sel && (
                          <View style={[styles.gridCheckBadge, { backgroundColor: accentColor }]}>
                            <AppText style={styles.gridCheckMark}>✓</AppText>
                          </View>
                        )}
                        <View style={[
                          styles.subGridIconWrap,
                          { backgroundColor: sel ? accentColor + '22' : (isDark ? '#1E293B' : '#F1F5F9') },
                        ]}>
                          <AppText style={styles.subGridEmoji}>{st.icon}</AppText>
                        </View>
                        <AppText style={[styles.subGridLabel, { color: sel ? accentColor : theme.colors.text }]}>
                          {t(st.labelKey)}
                        </AppText>
                        <AppText style={[styles.subGridDesc, { color: theme.colors.mutedText }]} numberOfLines={3}>
                          {t(st.descKey)}
                        </AppText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                /* Single column — agent types */
                <View style={styles.roleList}>
                  {subTypes.map(st => {
                    const sel = selectedSubVal === st.value;
                    return (
                      <TouchableOpacity
                        key={st.value}
                        onPress={() => setSubType(st.value)}
                        activeOpacity={0.85}
                        style={[
                          styles.subCard,
                          {
                            backgroundColor: isDark ? theme.colors.surface : '#FFFFFF',
                            borderColor: sel ? accentColor : (isDark ? theme.colors.border : '#E2E8F0'),
                            borderWidth: sel ? 2 : 1,
                          },
                        ]}
                      >
                        <AppText style={styles.subEmoji}>{st.icon}</AppText>
                        <View style={styles.subTexts}>
                          <AppText style={[styles.subLabel, { color: sel ? accentColor : theme.colors.text }]}>
                            {t(st.labelKey)}
                          </AppText>
                          <AppText style={[styles.subDesc, { color: theme.colors.mutedText }]} numberOfLines={3}>
                            {t(st.descKey)}
                          </AppText>
                        </View>
                        <View style={[styles.radioOuter, {
                          borderColor: sel ? accentColor : (isDark ? theme.colors.border : '#CBD5E1'),
                        }]}>
                          {sel && <View style={[styles.radioInner, { backgroundColor: accentColor }]} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Resume upload (ITI/Graduate only) */}
              {showResume && (
                <TouchableOpacity
                  style={[styles.resumeRow, {
                    borderColor: resumeUri ? '#d97706' : (isDark ? theme.colors.border : '#E2E8F0'),
                    backgroundColor: resumeUri ? '#FFFBEB' : (isDark ? theme.colors.surface : '#F8FAFC'),
                  }]}
                  onPress={() => void pickResume()}
                  activeOpacity={0.8}
                >
                  <AppText style={styles.resumeEmoji}>{resumeUri ? '📄' : '⬆️'}</AppText>
                  <View style={styles.resumeTexts}>
                    <AppText style={[styles.resumeTitle, { color: resumeUri ? '#d97706' : theme.colors.text }]}>
                      {resumeUri ? t('regResumeUploaded') : t('regUploadResume')}
                    </AppText>
                    <AppText style={[styles.resumeSub, { color: theme.colors.mutedText }]} numberOfLines={1}>
                      {resumeName ?? t('regResumeHint')}
                    </AppText>
                  </View>
                  {resumeUri && (
                    <TouchableOpacity
                      onPress={() => { setResumeUri(null); setResumeName(null); }}
                      style={styles.resumeClearBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <AppText style={styles.resumeClearTxt}>✕</AppText>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}

          <AppText variant="body" color={theme.colors.mutedText} style={styles.loginRow}>
            {t('alreadyHaveAccount')}{' '}
            <AppText variant="body" color={BRAND} style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
              {t('signIn')}
            </AppText>
          </AppText>
        </ScrollView>

        {/* ── Sticky Continue button ─────────────────────────────────── */}
        {canContinue() && (
          <View style={[
            styles.stickyFooter,
            {
              paddingBottom: insets.bottom + 14,
              backgroundColor: isDark ? theme.colors.surface : '#FFFFFF',
            },
          ]}>
            <AppButton
              title={t('continueBtn')}
              onPress={goToStep2}
              size="lg"
              fullWidth
            />
          </View>
        )}
      </View>
    );
  }

  // ── Step 2: Name + Phone + Password ──────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F0F4FB' }]}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />

      <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.circle, styles.c1]} />
        <View style={[styles.circle, styles.c2]} />
        <View style={[styles.circle, styles.c3]} />
        <View style={styles.orangeStrip} />

        <View style={styles.brandRow}>
          <View style={styles.logoBox}>
            <Image
              source={require('../../../../packages/shared-mobile/assets/logo.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn} activeOpacity={0.7}>
            <AppText style={styles.backArrow}>←</AppText>
          </TouchableOpacity>
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.badgeDot} />
          <AppText style={styles.badgeText} color={ORANGE}>{t('step2Of2')}</AppText>
        </View>
        <AppText style={styles.heroTitle} color="#FFFFFF">{t('yourDetails')}</AppText>
        <AppText style={styles.heroSub}   color="rgba(255,255,255,0.78)">{t('registerStep2Sub')}</AppText>
      </View>

      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.step2Scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.formCard, { backgroundColor: theme.colors.card }, !isDark && styles.formCardShadow]}>
            <View style={styles.formField}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.fieldLabel}>{t('fullName')}</AppText>
              <Controller control={control} name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput value={value} onChangeText={onChange} onBlur={onBlur}
                    placeholder={t('enterFullName')} errorText={errors.name?.message} />
                )}
              />
            </View>

            <View style={styles.formField}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.fieldLabel}>{t('mobileNumber')}</AppText>
              <Controller control={control} name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput value={value} onChangeText={onChange} onBlur={onBlur}
                    placeholder="9876543210" keyboardType="phone-pad"
                    leadingIcon="+91" maxLength={10} errorText={errors.phone?.message} />
                )}
              />
            </View>

            <View style={styles.formField}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.fieldLabel}>{t('passwordLabel')}</AppText>
              <Controller control={control} name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput value={value} onChangeText={onChange} onBlur={onBlur}
                    placeholder={t('minSixChars')} secureTextEntry errorText={errors.password?.message} />
                )}
              />
            </View>

            <View style={styles.formField}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.fieldLabel}>{t('confirmPassword')}</AppText>
              <Controller control={control} name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput value={value} onChangeText={onChange} onBlur={onBlur}
                    placeholder={t('reEnterPassword')} secureTextEntry errorText={errors.confirmPassword?.message} />
                )}
              />
            </View>

            <AppButton
              title={registrationOtpEnabled ? t('sendOtpRegister') : t('createAccount')}
              onPress={onSubmit}
              loading={isLoading}
              size="lg"
              fullWidth
              style={styles.submitBtn}
            />
          </View>

          <AppText variant="body" color={theme.colors.mutedText} style={styles.loginRow}>
            {t('alreadyHaveAccount')}{' '}
            <AppText variant="body" color={BRAND} style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
              {t('signIn')}
            </AppText>
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Hero (shared by both steps) ──────────────────────────────────────────────
  hero: {
    backgroundColor: BRAND,
    paddingHorizontal: 24,
    paddingBottom: 22,
    overflow: 'hidden',
  },
  circle: { position: 'absolute', borderRadius: 999 },
  c1: { width: 220, height: 220, top: -100, right: -60, backgroundColor: 'rgba(255,255,255,0.055)' },
  c2: { width: 110, height: 110, bottom: -40, right: 36,  backgroundColor: 'rgba(249,115,22,0.09)' },
  c3: { width: 80,  height: 80,  top: 24,    left: -28,   backgroundColor: 'rgba(255,255,255,0.04)' },
  orangeStrip: { position: 'absolute', bottom: 0, left: 0, width: '38%', height: 4, backgroundColor: ORANGE, borderTopRightRadius: 999 },

  brandRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  logoBox:       {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#FFFFFF', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 5,
  },
  logoImg:       { width: 48, height: 48 },

  heroTitle: { fontSize: 22, fontWeight: '900', lineHeight: 30, letterSpacing: -0.4 },
  heroSub:   { fontSize: 12.5, lineHeight: 19, marginTop: 4 },

  // Step 2 only — back button + step badge
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow:  { fontSize: 20, color: '#fff', fontWeight: '300', lineHeight: 24 },
  badgeRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  badgeDot:   { width: 5, height: 5, borderRadius: 3, backgroundColor: ORANGE },
  badgeText:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },

  // ── Step 1 scroll ──────────────────────────────────────────────────────────
  scrollContent: { padding: 20, paddingBottom: 32 },

  // Section header — dot + label (no uppercase transform so all scripts work)
  secHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  secDot:    { width: 7, height: 7, borderRadius: 4 },
  secLabel:  { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.2 },

  // Role cards
  roleList:     { gap: 10 },
  roleCard:     {
    flexDirection: 'row', alignItems: 'center', borderRadius: 18,
    padding: 16, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  roleIconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  roleEmoji:    { fontSize: 26, lineHeight: 34 },
  roleTexts:    { flex: 1, gap: 3 },
  roleName:     { fontSize: 16, fontWeight: '800', letterSpacing: -0.2, lineHeight: 22 },
  roleDesc:     { fontSize: 12, lineHeight: 17.5 },
  checkCircle:  { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkMark:    { color: '#fff', fontSize: 13, fontWeight: '900', lineHeight: 16 },

  // Worker sub-types — 2-col grid
  subGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: SUB_GAP },
  subGridCard:     {
    borderRadius: 16, padding: 14, gap: 7,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6,
    minHeight: 105, position: 'relative', overflow: 'hidden',
  },
  gridCheckBadge:  { position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  gridCheckMark:   { color: '#fff', fontSize: 10, fontWeight: '900' },
  subGridIconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', overflow: 'hidden' },
  subGridEmoji:    { fontSize: 20, lineHeight: 26 },
  subGridLabel:    { fontSize: 13.5, fontWeight: '700', lineHeight: 19 },
  subGridDesc:     { fontSize: 11, lineHeight: 15.5 },

  // Agent types — single column
  subCard:    {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    padding: 14, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  subEmoji:   { fontSize: 22, lineHeight: 28, flexShrink: 0 },
  subTexts:   { flex: 1, gap: 2 },
  subLabel:   { fontSize: 14, fontWeight: '700', lineHeight: 19 },
  subDesc:    { fontSize: 12, lineHeight: 17 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, flexShrink: 0, marginLeft: 8, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },

  // Resume upload row
  resumeRow:      { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, padding: 14, marginTop: 14, gap: 12 },
  resumeEmoji:    { fontSize: 22, lineHeight: 28, flexShrink: 0 },
  resumeTexts:    { flex: 1, gap: 2 },
  resumeTitle:    { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  resumeSub:      { fontSize: 11, lineHeight: 16 },
  resumeClearBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  resumeClearTxt: { fontSize: 12, color: '#DC2626', fontWeight: '700' },

  // Sticky continue footer
  stickyFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingTop: 12, paddingHorizontal: 20,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.07)',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 14,
  },

  // Login hint row
  loginRow:  { textAlign: 'center', marginTop: 24 },
  loginLink: { fontWeight: '700' },

  // ── Step 2 ─────────────────────────────────────────────────────────────────
  kav:            { flex: 1 },
  step2Scroll:    { padding: 20, paddingBottom: 40 },
  formCard:       { borderRadius: 24, padding: 22, marginTop: 10 },
  formCardShadow: {
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  formField:  { marginBottom: 16 },
  fieldLabel: { letterSpacing: 0.3, marginBottom: 6 },
  submitBtn:  { marginTop: 8 },
});
