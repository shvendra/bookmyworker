import { zodResolver } from '@hookform/resolvers/zod';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
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
import { AppButton } from '../../../../packages/shared-mobile/src/shared/components/ui/AppButton';
import { AppText } from '../../../../packages/shared-mobile/src/shared/components/ui/AppText';
import { AppInput } from '../../../../packages/shared-mobile/src/shared/components/ui/AppInput';
import { authService } from '../../../../packages/shared-mobile/src/features/auth/services/authService';
import {
  registerStep2Schema,
  type RegisterStep2Values,
} from '../../../../packages/shared-mobile/src/features/auth/validation/authSchemas';
import type { AgentStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AgentStackParamList, 'Register'>;
type Role = 'Agent' | 'SelfWorker';

const BRAND  = '#1037A4';
const ORANGE = '#F97316';

const ROLE_OPTIONS: Array<{ value: Role; labelKey: string; descKey: string; icon: string; color: string; bg: string }> = [
  { value: 'SelfWorker', labelKey: 'roleJobSeeker',      descKey: 'roleJobSeekerDesc',      icon: '👷', color: ORANGE, bg: '#FFF3E8' },
  { value: 'Agent',      labelKey: 'roleAgentSupplier',  descKey: 'roleAgentSupplierDesc',  icon: '🤝', color: BRAND,  bg: '#EBF1FF' },
];

const WORKER_SUB_TYPES: Array<{ value: string; labelKey: string; descKey: string; icon: string }> = [
  { value: 'Skilled',     labelKey: 'workerTypeSkilled',   descKey: 'workerTypeSkilledDesc',   icon: '🔧' },
  { value: 'Unskilled',   labelKey: 'workerTypeUnskilled', descKey: 'workerTypeUnskilledDesc', icon: '🏗️' },
  { value: 'ITI/Diploma', labelKey: 'workerTypeITI',       descKey: 'workerTypeITIDesc',       icon: '🎓' },
  { value: 'Graduate',    labelKey: 'workerTypeGraduate',  descKey: 'workerTypeGraduateDesc',  icon: '📜' },
];

const AGENT_TYPES: Array<{ value: string; labelKey: string; descKey: string; icon: string }> = [
  { value: 'Group worker supplier',     labelKey: 'agentTypeGroupSupplier',     descKey: 'agentTypeGroupSupplierDesc',     icon: '👥' },
  { value: 'Skilled worker supplier',   labelKey: 'agentTypeSkilledSupplier',   descKey: 'agentTypeSkilledSupplierDesc',   icon: '🔧' },
  { value: 'Unskilled worker supplier', labelKey: 'agentTypeUnskilledSupplier', descKey: 'agentTypeUnskilledSupplierDesc', icon: '🏗️' },
  { value: 'Contract worker supplier',  labelKey: 'agentTypeContractSupplier',  descKey: 'agentTypeContractSupplierDesc',  icon: '📋' },
];

export const AgentRegisterScreen = ({ navigation }: Props): React.JSX.Element => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [workerSubType, setWorkerSubType] = useState('');
  const [agentType, setAgentType] = useState('');
  const [resumeUri, setResumeUri] = useState<string | null>(null);
  const [resumeName, setResumeName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterStep2Values>({
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

  const showResume = role === 'SelfWorker' && (workerSubType === 'ITI/Diploma' || workerSubType === 'Graduate');

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
      showAlert('Error', 'Could not pick file. Try again.');
    }
  };

  const goToStep2 = (): void => {
    if (!role) { showAlert('Required', 'Please select your role to continue.'); return; }
    if (role === 'Agent' && !agentType) { showAlert('Required', 'Please select your agent type.'); return; }
    if (role === 'SelfWorker' && !workerSubType) { showAlert('Required', 'Please select your worker type.'); return; }
    setStep(2);
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!role) return;
    setIsLoading(true);
    try {
      await authService.requestOtp(values.phone, undefined);
      const savedLang = await AsyncStorage.getItem(AGENT_LANG_KEY);
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
      showAlert('Error', error instanceof Error ? error.message : 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  });

  const isDark = theme.mode === 'dark';
  const accentColor = role === 'Agent' ? BRAND : ORANGE;

  // ── Step 1: Role + Sub-type ──────────────────────────────────────────────────
  if (step === 1) {
    const subTypes       = role === 'SelfWorker' ? WORKER_SUB_TYPES : role === 'Agent' ? AGENT_TYPES : [];
    const selectedSubVal = role === 'SelfWorker' ? workerSubType : agentType;
    const setSubType     = role === 'SelfWorker' ? setWorkerSubType : setAgentType;

    return (
      <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F0F4FB' }]}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />

        <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
          <View style={[styles.circle, styles.c1]} />
          <View style={[styles.circle, styles.c2]} />
          <View style={[styles.circle, styles.c3]} />
          <View style={styles.orangeStrip} />

          <View style={styles.brandRow}>
            <View style={styles.logoBox}>
              <Image source={require('../../../../packages/shared-mobile/assets/logo.png')} style={styles.logoImg} resizeMode="contain" />
            </View>
            <View>
              <AppText style={styles.brandName} color="#FFFFFF">BookMyWorker</AppText>
              <AppText style={styles.brandSub} color="rgba(255,255,255,0.65)">{t('platformTagline')}</AppText>
            </View>
          </View>

          <AppText style={styles.heroTitle} color="#FFFFFF">{t('joinPlatform')}</AppText>
          <AppText style={styles.heroSub} color="rgba(255,255,255,0.70)">{t('agentHeroSub')}</AppText>
        </View>

        <ScrollView contentContainerStyle={styles.roleScroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionLabel, { color: theme.colors.mutedText }]}>{t('whoAreYou')}</Text>
          <View style={styles.roleOptions}>
            {ROLE_OPTIONS.map(opt => {
              const sel = role === opt.value;
              return (
                <TouchableOpacity key={opt.value} onPress={() => onSelectRole(opt.value)} activeOpacity={0.88}
                  style={[styles.roleCard, {
                    backgroundColor: sel ? opt.bg : (isDark ? theme.colors.surface : '#FFF'),
                    borderColor: sel ? opt.color : (isDark ? theme.colors.border : '#E2E8F0'),
                    borderWidth: sel ? 2 : 1,
                  }]}
                >
                  <View style={[styles.roleIconCircle, { backgroundColor: sel ? opt.color : opt.color + '18' }]}>
                    <Text style={styles.roleIconEmoji}>{opt.icon}</Text>
                  </View>
                  <View style={styles.roleTextBlock}>
                    <Text style={[styles.roleName, { color: sel ? opt.color : theme.colors.text }]}>{t(opt.labelKey)}</Text>
                    <Text style={[styles.roleDesc, { color: theme.colors.mutedText }]}>{t(opt.descKey)}</Text>
                  </View>
                  <View style={[styles.roleCheckBox, {
                    backgroundColor: sel ? opt.color : 'transparent',
                    borderColor: sel ? opt.color : (isDark ? theme.colors.border : '#CBD5E1'),
                  }]}>
                    {sel && <Text style={styles.roleCheckMark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {subTypes.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.colors.mutedText, marginTop: 20 }]}>
                {role === 'SelfWorker' ? t('myWorkType') : t('myRoleAsAgent')}
              </Text>
              <View style={styles.roleOptions}>
                {subTypes.map(st => (
                  <TouchableOpacity key={st.value} onPress={() => setSubType(st.value)} activeOpacity={0.88}
                    style={[styles.subCard, {
                      backgroundColor: isDark ? theme.colors.surface : '#FFF',
                      borderColor: selectedSubVal === st.value ? accentColor : theme.colors.border,
                      borderWidth: selectedSubVal === st.value ? 2 : 1.5,
                    }]}
                  >
                    <Text style={styles.subIcon}>{st.icon}</Text>
                    <View style={styles.subTextWrap}>
                      <Text style={[styles.subLabel, { color: theme.colors.text }]}>{t(st.labelKey)}</Text>
                      <Text style={[styles.subDesc, { color: theme.colors.mutedText }]}>{t(st.descKey)}</Text>
                    </View>
                    <View style={[styles.radioOuter, { borderColor: selectedSubVal === st.value ? accentColor : theme.colors.border }]} />
                  </TouchableOpacity>
                ))}
              </View>

              {showResume && (
                <TouchableOpacity
                  style={[styles.resumeRow, {
                    borderColor: resumeUri ? '#d97706' : theme.colors.border,
                    backgroundColor: resumeUri ? '#fffbeb' : (isDark ? theme.colors.surface : '#f8fafc'),
                  }]}
                  onPress={() => void pickResume()} activeOpacity={0.8}
                >
                  <Text style={styles.resumeEmoji}>{resumeUri ? '📄' : '⬆️'}</Text>
                  <View style={styles.resumeTextWrap}>
                    <Text style={[styles.resumeTitle, { color: resumeUri ? '#d97706' : theme.colors.text }]}>
                      {resumeUri ? 'Resume Uploaded ✓' : 'Upload Resume / CV'}
                    </Text>
                    <Text style={[styles.resumeSub, { color: theme.colors.mutedText }]}>
                      {resumeName ?? 'PDF or Word document (optional but recommended)'}
                    </Text>
                  </View>
                  {resumeUri && (
                    <TouchableOpacity onPress={() => { setResumeUri(null); setResumeName(null); }} style={styles.resumeClear}>
                      <Text style={styles.resumeClearTxt}>✕</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              )}

              <AppButton title={t('continueBtn')} onPress={goToStep2} style={styles.continueBtn} size="lg" fullWidth />
            </>
          )}

          <AppText variant="body" color={theme.colors.mutedText} style={styles.loginRow}>
            {t('alreadyHaveAccount')}{' '}
            <AppText variant="body" color={BRAND} style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
              {t('signIn')}
            </AppText>
          </AppText>
        </ScrollView>
      </View>
    );
  }

  // ── Step 2: Name + Phone + Password only ─────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F0F4FB' }]}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />

      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={[styles.circle, styles.c1]} />
        <View style={[styles.circle, styles.c2]} />
        <View style={[styles.circle, styles.c3]} />
        <View style={styles.orangeStrip} />

        <View style={styles.brandRow}>
          <View style={styles.logoBox}>
            <Image source={require('../../../../packages/shared-mobile/assets/logo.png')} style={styles.logoImg} resizeMode="contain" />
          </View>
          <View style={{ flex: 1 }}>
            <AppText style={styles.brandName} color="#FFFFFF">BookMyWorker</AppText>
            <AppText style={styles.brandSub} color="rgba(255,255,255,0.65)">{t('platformTagline')}</AppText>
          </View>
          <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn} activeOpacity={0.7}>
            <AppText style={styles.backArrow}>←</AppText>
          </TouchableOpacity>
        </View>

        <View style={styles.heroBadgeRow}>
          <View style={styles.heroBadgeDot} />
          <AppText style={styles.heroBadgeText} color={ORANGE}>{t('step2Of2')}</AppText>
        </View>
        <AppText style={styles.heroTitle} color="#FFFFFF">{t('yourDetails')}</AppText>
        <AppText style={styles.heroSub} color="rgba(255,255,255,0.70)">
          {t('registerStep2Sub')}
        </AppText>
      </View>

      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: theme.colors.card }, !isDark && styles.cardShadow]}>
            

            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>{t('fullName')}</AppText>
              <Controller control={control} name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput value={value} onChangeText={onChange} onBlur={onBlur}
                    placeholder={t('enterFullName')} errorText={errors.name?.message} />
                )}
              />
            </View>

            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>{t('mobileNumber')}</AppText>
              <Controller control={control} name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput value={value} onChangeText={onChange} onBlur={onBlur}
                    placeholder="9876543210" keyboardType="phone-pad"
                    leadingIcon="+91" maxLength={10} errorText={errors.phone?.message} />
                )}
              />
            </View>

            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>{t('passwordLabel')}</AppText>
              <Controller control={control} name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput value={value} onChangeText={onChange} onBlur={onBlur}
                    placeholder={t('minSixChars')} secureTextEntry errorText={errors.password?.message} />
                )}
              />
            </View>

            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>{t('confirmPassword')}</AppText>
              <Controller control={control} name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput value={value} onChangeText={onChange} onBlur={onBlur}
                    placeholder={t('reEnterPassword')} secureTextEntry errorText={errors.confirmPassword?.message} />
                )}
              />
            </View>

            <AppButton
              title={t('sendOtpRegister')}
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

  hero: {
    backgroundColor: BRAND,
    paddingHorizontal: 24,
    paddingBottom: 40,
    overflow: 'hidden',
  },
  circle:  { position: 'absolute', borderRadius: 999 },
  c1: { width: 280, height: 280, top: -120, right: -80,  backgroundColor: 'rgba(255,255,255,0.055)' },
  c2: { width: 150, height: 150, bottom: -50, right: 30,  backgroundColor: 'rgba(249,115,22,0.09)' },
  c3: { width: 90,  height: 90,  top: 30,    left: -30,   backgroundColor: 'rgba(255,255,255,0.04)' },
  orangeStrip: { position: 'absolute', bottom: 0, left: 0, width: '38%', height: 4, backgroundColor: ORANGE, borderTopRightRadius: 999 },

  brandRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 22, gap: 14 },
  logoBox:      {
    width: 56, height: 56, borderRadius: 16, backgroundColor: '#FFFFFF', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 6,
  },
  logoImg:      { width: 56, height: 56 },
  brandName:    { fontSize: 19, fontWeight: '800', lineHeight: 24, letterSpacing: -0.3 },
  brandSub:     { fontSize: 12, marginTop: 3 },

  heroTitle: { fontSize: 28, fontWeight: '900', lineHeight: 36, letterSpacing: -0.6 },
  heroSub:   { fontSize: 13.5, lineHeight: 20, marginTop: 4 },

  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  backArrow: { fontSize: 22, color: '#fff', fontWeight: '300', lineHeight: 26 },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  heroBadgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: ORANGE },
  heroBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: ORANGE },

  roleScroll: { padding: 20, paddingBottom: 40, marginTop: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 10, textTransform: 'uppercase' },
  roleOptions:  { gap: 10, marginBottom: 4 },

  roleCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 16, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3 },
  roleIconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  roleIconEmoji:  { fontSize: 28, lineHeight: 36 },
  roleTextBlock:  { flex: 1, gap: 3 },
  roleName:       { fontSize: 17, fontWeight: '800', letterSpacing: -0.2, lineHeight: 22 },
  roleDesc:       { fontSize: 12.5, lineHeight: 18 },
  roleCheckBox:   { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  roleCheckMark:  { color: '#fff', fontSize: 13, fontWeight: '900', lineHeight: 16 },
  radioOuter:     { width: 20, height: 20, borderRadius: 10, borderWidth: 2, flexShrink: 0, marginLeft: 8 },

  subCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  subIcon:    { fontSize: 22, lineHeight: 28, flexShrink: 0 },
  subTextWrap:{ flex: 1, gap: 2 },
  subLabel:   { fontSize: 14, fontWeight: '700', lineHeight: 19 },
  subDesc:    { fontSize: 12, lineHeight: 17 },

  resumeRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, padding: 14, marginTop: 14, gap: 12 },
  resumeEmoji:    { fontSize: 22, lineHeight: 28 },
  resumeTextWrap: { flex: 1, gap: 2 },
  resumeTitle:    { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  resumeSub:      { fontSize: 11, lineHeight: 16 },
  resumeClear:    { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  resumeClearTxt: { fontSize: 12, color: '#dc2626', fontWeight: '700' },

  continueBtn: { marginTop: 20, marginBottom: 4 },

  kav:    { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  card:   { borderRadius: 24, padding: 22, marginTop: 10 },
  cardShadow: {
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  cardTitle: { marginBottom: 16 },

  field:     { marginBottom: 16 },
  label:     { letterSpacing: 0.3, marginBottom: 6 },
  submitBtn: { marginTop: 8 },

  loginRow:  { textAlign: 'center', marginTop: 24 },
  loginLink: { fontWeight: '700' },
});
