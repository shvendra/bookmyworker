import { zodResolver } from '@hookform/resolvers/zod';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
  Alert,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import * as DocumentPicker from 'expo-document-picker';

import { useAppTheme } from '../../../../packages/shared-mobile/src/core/theme';
import { AppButton } from '../../../../packages/shared-mobile/src/shared/components/ui/AppButton';
import { AppText } from '../../../../packages/shared-mobile/src/shared/components/ui/AppText';
import { AppInput } from '../../../../packages/shared-mobile/src/shared/components/ui/AppInput';
import { LocationSelector } from '../../../../packages/shared-mobile/src/shared/components/forms/LocationSelector';
import { FormSelect } from '../../../../packages/shared-mobile/src/shared/components/forms/FormSelect';
import { authService } from '../../../../packages/shared-mobile/src/features/auth/services/authService';
import {
  registerStep2Schema,
  type RegisterStep2Values,
} from '../../../../packages/shared-mobile/src/features/auth/validation/authSchemas';
import type { AgentStackParamList } from '../../navigation/types';
import categoriesData from '../../../../packages/shared-mobile/src/shared/data/categories.json';

type Props = NativeStackScreenProps<AgentStackParamList, 'Register'>;
type Role = 'Agent' | 'SelfWorker';

const BRAND  = '#1037A4';
const ORANGE = '#F97316';

interface CatItem {
  label: string;
  value: string;
  subcategories: Array<{ label: string; value: string }>;
}
const ALL_CATS = categoriesData as CatItem[];

const CAT_SHORT_LABELS: Record<string, string> = {
  construction_project_workers:    'Construction',
  manufacturing_industrial_workers:'Manufacturing',
  agriculture_farming_workers:     'Agriculture',
  event_decoration_workers:        'Events',
  household_domestic_workers:      'Household',
  hospitality_service_workers:     'Hospitality',
  transport_logistics_workers:     'Transport',
  retail_shop_workers:             'Retail',
  skilled_technical_workers:       'Technical',
  specialized_creative_workers:    'Creative',
  'Automobile & Workshop Workers': 'Automobile',
  'Healthcare Support Workers':    'Healthcare',
  'Security & Facility Workers':   'Security',
};

const ROLE_OPTIONS: Array<{ value: Role; label: string; description: string; icon: string; color: string; bg: string; border: string }> = [
  {
    value: 'SelfWorker',
    label: 'Job Seeker',
    description: 'Browse nearby job openings. Get hired quickly. Earn every day.',
    icon: '👷',
    color: ORANGE,
    bg: '#FFF3E8',
    border: '#FDD5B0',
  },
  {
    value: 'Agent',
    label: 'Agent / Supplier',
    description: 'Build your worker network. Get paid every time one of your workers gets placed.',
    icon: '🤝',
    color: BRAND,
    bg: '#EBF1FF',
    border: '#C3D3F5',
  },
];

const WORKER_SUB_TYPES: Array<{ value: string; label: string; description: string; icon: string }> = [
  { value: 'Skilled',     label: 'Skilled',       description: 'Experienced in a specific trade or craft', icon: '🔧' },
  { value: 'Unskilled',   label: 'Unskilled',     description: 'General labour, no specific skill required', icon: '🏗️' },
  { value: 'ITI/Diploma', label: 'ITI / Diploma', description: 'ITI or Diploma certificate holder', icon: '🎓' },
  { value: 'Graduate',    label: 'Graduate',      description: "Bachelor's degree or above", icon: '📜' },
];

const AGENT_TYPES: Array<{ value: string; label: string; description: string; icon: string }> = [
  { value: 'Group worker supplier',     label: 'Group Worker Supplier',     description: 'Supply groups / teams of workers', icon: '👥' },
  { value: 'Skilled worker supplier',   label: 'Skilled Worker Supplier',   description: 'Supply skilled trade workers', icon: '🔧' },
  { value: 'Unskilled worker supplier', label: 'Unskilled Worker Supplier', description: 'Supply unskilled / general workers', icon: '🏗️' },
  { value: 'Contract worker supplier',  label: 'Contract Worker Supplier',  description: 'Supply workers on contract basis', icon: '📋' },
];

const EXPERIENCE_OPTIONS = [
  'Fresher',
  ...Array.from({ length: 20 }, (_, i) => `${i + 1} year${i !== 0 ? 's' : ''}`),
];
const SALARY_TYPE_OPTIONS = ['Fixed', 'Ranged'];

// ── Multi-select chips component ──────────────────────────────────────────────
const MultiSelectChips = ({
  items,
  selected,
  onToggle,
  color,
  emptyText,
}: {
  items: Array<{ label: string; value: string }>;
  selected: string[];
  onToggle: (v: string) => void;
  color: string;
  emptyText?: string;
}): React.JSX.Element => {
  if (items.length === 0 && emptyText) {
    return (
      <View style={msc.empty}>
        <Text style={msc.emptyTxt}>{emptyText}</Text>
      </View>
    );
  }
  return (
    <View style={msc.wrap}>
      {items.map(item => {
        const isSel = selected.includes(item.value);
        return (
          <TouchableOpacity
            key={item.value}
            onPress={() => onToggle(item.value)}
            activeOpacity={0.75}
            style={[
              msc.chip,
              {
                backgroundColor: isSel ? color + '15' : '#f8fafc',
                borderColor: isSel ? color : '#e2e8f0',
                borderWidth: isSel ? 1.5 : 1,
              },
            ]}
          >
            {isSel && <Text style={[msc.checkIcon, { color }]}>✓</Text>}
            <Text style={[msc.chipTxt, { color: isSel ? color : '#374151', fontWeight: isSel ? '700' : '500' }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const msc = StyleSheet.create({
  wrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  checkIcon:{ fontSize: 10, fontWeight: '900', lineHeight: 14 },
  chipTxt:  { fontSize: 12.5, lineHeight: 17 },
  empty:    { paddingVertical: 10 },
  emptyTxt: { fontSize: 12.5, color: '#94a3b8', fontStyle: 'italic' },
});

// ── Section label helper ──────────────────────────────────────────────────────
const SectionLabel = ({
  label,
  count,
  color,
  theme,
}: {
  label: string;
  count?: number;
  color?: string;
  theme: ReturnType<typeof useAppTheme>['theme'];
}): React.JSX.Element => (
  <View style={sl.row}>
    <AppText variant="labelSm" color={theme.colors.textSecondary} style={sl.text}>
      {label}
    </AppText>
    {count !== undefined && count > 0 && (
      <View style={[sl.badge, { backgroundColor: (color ?? BRAND) + '18' }]}>
        <Text style={[sl.badgeTxt, { color: color ?? BRAND }]}>{count} selected</Text>
      </View>
    )}
  </View>
);
const sl = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  text:     { letterSpacing: 0.4, textTransform: 'uppercase', fontSize: 11, fontWeight: '700' },
  badge:    { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 10.5, fontWeight: '700' },
});

// ── Main component ────────────────────────────────────────────────────────────
export const AgentRegisterScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [workerSubType, setWorkerSubType] = useState('');
  const [agentType, setAgentType] = useState('');
  const [resumeUri, setResumeUri] = useState<string | null>(null);
  const [resumeName, setResumeName] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterStep2Values>({
    resolver: zodResolver(registerStep2Schema),
    defaultValues: {
      name: '',
      phone: '',
      password: '',
      confirmPassword: '',
      state: '',
      district: '',
      block: '',
      pinCode: '',
      email: '',
      referredBy: '',
      gender: undefined,
      dob: '',
      address: '',
      workExperience: '',
      salaryType: '',
      fixedSalary: '',
      salaryFrom: '',
      salaryTo: '',
    },
  });

  const stateVal    = watch('state');
  const districtVal = watch('district');
  const blockVal    = watch('block');
  const salaryType  = watch('salaryType');

  // Derived: all subcategories from selected main categories
  const availableSubCategories = useMemo<Array<{ label: string; value: string }>>(
    () =>
      ALL_CATS
        .filter(c => selectedCategories.includes(c.value))
        .flatMap(c => c.subcategories),
    [selectedCategories]
  );

  const handleCategoryToggle = (value: string): void => {
    setSelectedCategories(prev => {
      if (prev.includes(value)) {
        // Deselect: also remove this category's subcategories
        const subVals = new Set(
          ALL_CATS.find(c => c.value === value)?.subcategories.map(s => s.value) ?? []
        );
        setSelectedSubCategories(subs => subs.filter(s => !subVals.has(s)));
        return prev.filter(c => c !== value);
      }
      return [...prev, value];
    });
  };

  const handleSubCategoryToggle = (value: string): void => {
    setSelectedSubCategories(prev =>
      prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]
    );
  };

  const onSelectRole = (r: Role): void => {
    setRole(r);
    setWorkerSubType('');
    setAgentType('');
    setResumeUri(null);
    setResumeName(null);
    setSelectedCategories([]);
    setSelectedSubCategories([]);
  };

  const canProceedFromStep1 = (): boolean => {
    if (!role) return false;
    if (role === 'Agent') return agentType !== '';
    if (role === 'SelfWorker') return workerSubType !== '';
    return false;
  };

  const showResume = role === 'SelfWorker' && (workerSubType === 'ITI/Diploma' || workerSubType === 'Graduate');

  const pickResume = async (): Promise<void> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        setResumeUri(result.assets[0].uri);
        setResumeName(result.assets[0].name);
      }
    } catch {
      Alert.alert('Error', 'Could not pick file. Try again.');
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!role) return;
    if (!values.state || !values.district) {
      Alert.alert('Required', 'Please select your state and district.');
      return;
    }
    setIsLoading(true);
    try {
      await authService.requestOtp(values.phone, undefined);
      navigation.navigate('RegisterOtp', {
        phone: values.phone,
        role,
        name: values.name,
        password: values.password,
        state: values.state,
        district: values.district,
        block: values.block,
        pinCode: values.pinCode ?? undefined,
        email: values.email ?? undefined,
        referredBy: values.referredBy ?? undefined,
        gender: values.gender,
        dob: values.dob,
        address: values.address,
        areasOfWork: selectedCategories.length > 0 ? selectedCategories : undefined,
        categories: selectedSubCategories.length > 0 ? selectedSubCategories : undefined,
        workExperience: values.workExperience,
        salaryType: values.salaryType,
        fixedSalary: values.fixedSalary,
        salaryFrom: values.salaryFrom,
        salaryTo: values.salaryTo,
        workerSubType: workerSubType || undefined,
        agentType: agentType || undefined,
        resumeUri: resumeUri ?? undefined,
        resumeName: resumeName ?? undefined,
      });
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  });

  const isDark = theme.mode === 'dark';
  const primary = theme.colors.primary;
  const insets = useSafeAreaInsets();
  const accentColor = role === 'Agent' ? BRAND : ORANGE;

  // ── Step 1: Role + Sub-type selection ──────────────────────────────────────
  if (step === 1) {
    const subTypes      = role === 'SelfWorker' ? WORKER_SUB_TYPES : role === 'Agent' ? AGENT_TYPES : [];
    const selectedSubVal = role === 'SelfWorker' ? workerSubType : agentType;
    const setSubType    = role === 'SelfWorker' ? setWorkerSubType : setAgentType;

    return (
      <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F4F6FB' }]}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />

        {/* Hero header */}
        <View style={[styles.regHero, { paddingTop: insets.top + 12 }]}>
          <View style={[styles.circle, styles.circle1]} />
          <View style={[styles.circle, styles.circle2]} />
          <View style={[styles.circle, styles.circle3]} />
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

          <View style={styles.heroBlock}>
            <View style={styles.brandTextWrap}>
              <AppText style={styles.brandName} color="#FFFFFF">BookMyWorker</AppText>
              <AppText style={styles.brandSub} color="rgba(255,255,255,0.65)">
                India's #1 Workforce Platform
              </AppText>
            </View>
            <AppText style={styles.regHeroTitle} color="#FFFFFF">Join BookMyWorker</AppText>
            <AppText style={styles.regHeroSub} color="rgba(255,255,255,0.70)">
              Search jobs or Send workers to jobs, Earn.
            </AppText>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.roleScroll} showsVerticalScrollIndicator={false}>

          {/* Role cards */}
          <Text style={[styles.sectionLabel, { color: theme.colors.mutedText }]}>I AM A</Text>
          <View style={styles.roleOptions}>
            {ROLE_OPTIONS.map((opt) => {
              const isSel = role === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => onSelectRole(opt.value)}
                  activeOpacity={0.88}
                  style={[
                    styles.roleCard,
                    {
                      backgroundColor: isSel ? opt.bg : (isDark ? theme.colors.surface : '#FFFFFF'),
                      borderColor: isSel ? opt.color : (isDark ? theme.colors.border : '#E2E8F0'),
                      borderWidth: isSel ? 2 : 1,
                    },
                  ]}
                >
                  <View style={[styles.roleIconCircle, { backgroundColor: isSel ? opt.color : opt.color + '18' }]}>
                    <Text style={styles.roleIconEmoji}>{opt.icon}</Text>
                  </View>
                  <View style={styles.roleTextBlock}>
                    <Text style={[styles.roleName, { color: isSel ? opt.color : theme.colors.text }]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.roleDesc, { color: theme.colors.mutedText }]}>
                      {opt.description}
                    </Text>
                  </View>
                  <View style={[styles.roleCheckBox, {
                    backgroundColor: isSel ? opt.color : 'transparent',
                    borderColor: isSel ? opt.color : (isDark ? theme.colors.border : '#CBD5E1'),
                  }]}>
                    {isSel && <Text style={styles.roleCheckMark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Sub-type selection */}
          {subTypes.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.colors.mutedText, marginTop: 20 }]}>
                {role === 'SelfWorker' ? 'MY WORK TYPE' : 'MY ROLE AS AGENT'}
              </Text>
              <View style={styles.roleOptions}>
                {subTypes.map((st) => (
                  <TouchableOpacity
                    key={st.value}
                    onPress={() => setSubType(st.value)}
                    activeOpacity={0.88}
                    style={[
                      styles.subCard,
                      {
                        backgroundColor: isDark ? theme.colors.surface : '#FFFFFF',
                        borderColor: selectedSubVal === st.value ? accentColor : theme.colors.border,
                        borderWidth: selectedSubVal === st.value ? 2 : 1.5,
                      },
                    ]}
                  >
                    <Text style={styles.subIcon}>{st.icon}</Text>
                    <View style={styles.subTextWrap}>
                      <Text style={[styles.subLabel, { color: theme.colors.text }]}>
                        {st.label}
                      </Text>
                      <Text style={[styles.subDesc, { color: theme.colors.mutedText }]}>
                        {st.description}
                      </Text>
                    </View>
                    <View style={[styles.radioOuter, { borderColor: selectedSubVal === st.value ? accentColor : theme.colors.border }]} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Resume upload */}
              {showResume && (
                <TouchableOpacity
                  style={[styles.resumeRow, {
                    borderColor: resumeUri ? '#d97706' : theme.colors.border,
                    backgroundColor: resumeUri ? '#fffbeb' : (isDark ? theme.colors.surface : '#f8fafc'),
                  }]}
                  onPress={() => void pickResume()}
                  activeOpacity={0.8}
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

              <AppButton
                title="Continue →"
                onPress={() => setStep(2)}
                disabled={!canProceedFromStep1()}
                style={[styles.continueBtn, { opacity: canProceedFromStep1() ? 1 : 0.4 }]}
                size="lg"
                fullWidth
              />
            </>
          )}

          <View style={styles.loginRow}>
            <AppText variant="body" color={theme.colors.mutedText}>Already have an account? </AppText>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <AppText variant="body" color={BRAND} style={styles.loginLink}>Sign In</AppText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Step 2: Registration form ───────────────────────────────────────────────
  const isWorker = role === 'SelfWorker';
  const catLabel    = isWorker ? 'WORK CATEGORIES' : 'AREAS OF WORK';
  const subCatLabel = isWorker ? 'SPECIFIC SKILLS' : 'SPECIFIC SKILLS / TRADES';

  return (
    <View style={[styles.root, { backgroundColor: isDark ? theme.colors.background : '#F4F6FB' }]}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />

      <View style={[styles.regHero, { paddingTop: insets.top + 12 }]}>
        <View style={[styles.circle, styles.circle1]} />
        <View style={[styles.circle, styles.circle2]} />
        <View style={[styles.circle, styles.circle3]} />
        <View style={styles.orangeStrip} />

        <View style={styles.heroBlock}>
          <View style={styles.heroBadge}>
            <View style={styles.heroBadgeDot} />
            <AppText style={styles.heroBadgeText} color={ORANGE}>STEP 2 OF 2</AppText>
          </View>
          <AppText style={styles.regHeroTitle} color="#FFFFFF">Your Details</AppText>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { backgroundColor: theme.colors.card }, !isDark && styles.cardShadow]}>
            <AppText variant="subtitle" color={theme.colors.text} style={styles.cardTitle}>
              Your Details
            </AppText>

            {/* Name */}
            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>Full Name</AppText>
              <Controller
                control={control} name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput value={value} onChangeText={onChange} onBlur={onBlur}
                    placeholder="Enter your full name" errorText={errors.name?.message} />
                )}
              />
            </View>

            {/* Phone */}
            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>Mobile Number</AppText>
              <Controller
                control={control} name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput value={value} onChangeText={onChange} onBlur={onBlur}
                    placeholder="9876543210" keyboardType="phone-pad"
                    leadingIcon="+91" maxLength={10} errorText={errors.phone?.message} />
                )}
              />
            </View>

            {/* Password */}
            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>Password</AppText>
              <Controller
                control={control} name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput value={value} onChangeText={onChange} onBlur={onBlur}
                    placeholder="Min 6 characters" secureTextEntry errorText={errors.password?.message} />
                )}
              />
            </View>

            {/* Confirm Password */}
            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>Confirm Password</AppText>
              <Controller
                control={control} name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput value={value} onChangeText={onChange} onBlur={onBlur}
                    placeholder="Re-enter password" secureTextEntry errorText={errors.confirmPassword?.message} />
                )}
              />
            </View>

            {/* Email */}
            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>Email (optional)</AppText>
              <Controller
                control={control} name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput value={value ?? ''} onChangeText={onChange} onBlur={onBlur}
                    placeholder="your@email.com" keyboardType="email-address"
                    autoCapitalize="none" errorText={errors.email?.message} />
                )}
              />
            </View>

            {/* Location */}
            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>Location</AppText>
              <LocationSelector
                state={stateVal} district={districtVal} block={blockVal}
                onStateChange={(v) => setValue('state', v)}
                onDistrictChange={(v) => setValue('district', v)}
                onBlockChange={(v) => setValue('block', v)}
                stateError={errors.state?.message}
                districtError={errors.district?.message}
                blockError={errors.block?.message}
              />
            </View>

            {/* ── Main Categories (multi-select) ── */}
            <View style={styles.field}>
              <SectionLabel
                label={catLabel}
                count={selectedCategories.length}
                color={accentColor}
                theme={theme}
              />
              <MultiSelectChips
                items={ALL_CATS.map(c => ({ label: CAT_SHORT_LABELS[c.value] ?? c.label, value: c.value }))}
                selected={selectedCategories}
                onToggle={handleCategoryToggle}
                color={accentColor}
              />
            </View>

            {/* ── Subcategories (multi-select, derived from selected categories) ── */}
            {selectedCategories.length > 0 && (
              <View style={styles.field}>
                <SectionLabel
                  label={subCatLabel}
                  count={selectedSubCategories.length}
                  color={accentColor}
                  theme={theme}
                />
                <MultiSelectChips
                  items={availableSubCategories}
                  selected={selectedSubCategories}
                  onToggle={handleSubCategoryToggle}
                  color={accentColor}
                  emptyText="No subcategories for selected category"
                />
              </View>
            )}

            {/* SelfWorker-only fields */}
            {isWorker && (
              <>
                {/* Work Experience */}
                <View style={styles.field}>
                  <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>Work Experience</AppText>
                  <Controller
                    control={control} name="workExperience"
                    render={({ field: { onChange, value } }) => (
                      <FormSelect label="Work Experience" options={EXPERIENCE_OPTIONS}
                        value={value ?? ''} onChange={onChange} placeholder="Select experience" />
                    )}
                  />
                </View>

                {/* Salary Type */}
                <View style={styles.field}>
                  <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>Expected Salary Type (optional)</AppText>
                  <Controller
                    control={control} name="salaryType"
                    render={({ field: { onChange, value } }) => (
                      <FormSelect label="Salary Type" options={SALARY_TYPE_OPTIONS}
                        value={value ?? ''} onChange={onChange} placeholder="Select type" />
                    )}
                  />
                </View>

                {salaryType === 'Fixed' && (
                  <View style={styles.field}>
                    <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>
                      {workerSubType === 'ITI/Diploma' || workerSubType === 'Graduate'
                        ? 'Expected Monthly Salary (₹)' : 'Expected Daily Wage (₹)'}
                    </AppText>
                    <Controller
                      control={control} name="fixedSalary"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <AppInput value={value ?? ''} onChangeText={onChange} onBlur={onBlur}
                          placeholder={workerSubType === 'ITI/Diploma' || workerSubType === 'Graduate' ? 'e.g. 15000' : 'e.g. 500'}
                          keyboardType="number-pad" />
                      )}
                    />
                  </View>
                )}

                {salaryType === 'Ranged' && (
                  <View style={styles.salaryRow}>
                    <View style={[styles.field, styles.salaryHalf]}>
                      <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>Min (₹)</AppText>
                      <Controller
                        control={control} name="salaryFrom"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <AppInput value={value ?? ''} onChangeText={onChange} onBlur={onBlur}
                            placeholder="e.g. 400" keyboardType="number-pad" />
                        )}
                      />
                    </View>
                    <View style={[styles.field, styles.salaryHalf]}>
                      <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>Max (₹)</AppText>
                      <Controller
                        control={control} name="salaryTo"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <AppInput value={value ?? ''} onChangeText={onChange} onBlur={onBlur}
                            placeholder="e.g. 700" keyboardType="number-pad" />
                        )}
                      />
                    </View>
                  </View>
                )}
              </>
            )}

            {/* Referred By */}
            <View style={styles.field}>
              <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.label}>Referred By (optional)</AppText>
              <Controller
                control={control} name="referredBy"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput value={value ?? ''} onChangeText={onChange} onBlur={onBlur}
                    placeholder="Referral mobile number" keyboardType="phone-pad"
                    maxLength={10} errorText={errors.referredBy?.message} />
                )}
              />
            </View>

            <AppButton
              title="Send OTP & Register"
              onPress={onSubmit}
              loading={isLoading}
              size="lg"
              fullWidth
              style={styles.submitBtn}
            />
          </View>

          <View style={styles.loginRow}>
            <AppText variant="body" color={theme.colors.mutedText}>Already have an account? </AppText>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <AppText variant="body" color={primary} style={styles.loginLink}>Sign In</AppText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },

  regHero: {
    backgroundColor: BRAND,
    paddingHorizontal: 24,
    paddingBottom: 34,
    overflow: 'hidden',
  },
  circle:  { position: 'absolute', borderRadius: 999 },
  circle1: { width: 260, height: 260, top: -110, right: -80,  backgroundColor: 'rgba(255,255,255,0.055)' },
  circle2: { width: 140, height: 140, bottom: -50, right: 25,  backgroundColor: 'rgba(249,115,22,0.09)' },
  circle3: { width: 90,  height: 90,  top: 30,    left: -30,   backgroundColor: 'rgba(255,255,255,0.04)' },
  orangeStrip: {
    position: 'absolute', bottom: 0, left: 0,
    width: '38%', height: 4,
    backgroundColor: ORANGE, borderTopRightRadius: 999,
  },

  brandRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 14 },
  logoBox:      { width: 56, height: 56, borderRadius: 16, backgroundColor: '#FFFFFF', overflow: 'hidden', elevation: 6 },
  logoImg:      { width: 56, height: 56 },
  brandTextWrap:{ flex: 1 },
  brandName:    { fontSize: 19, fontWeight: '800', lineHeight: 24, letterSpacing: -0.3 },
  brandSub:     { fontSize: 12, marginTop: 3, letterSpacing: 0.2 },

  heroBlock:    { gap: 7 },
  heroBadge:    {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(249,115,22,0.14)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 2,
  },
  heroBadgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: ORANGE },
  heroBadgeText:{ fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  regHeroTitle: { fontSize: 26, fontWeight: '900', lineHeight: 33, letterSpacing: -0.5 },
  regHeroSub:   { fontSize: 13, lineHeight: 19 },

  roleScroll:   { padding: 20, paddingBottom: 40, marginTop: -18 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 10, textTransform: 'uppercase' },
  roleOptions:  { gap: 10, marginBottom: 4 },

  roleCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18, padding: 16, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  roleIconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  roleIconEmoji:  { fontSize: 28, lineHeight: 36 },
  roleTextBlock:  { flex: 1, gap: 3 },
  roleName:       { fontSize: 17, fontWeight: '800', letterSpacing: -0.2, lineHeight: 22 },
  roleDesc:       { fontSize: 12.5, lineHeight: 18 },
  roleCheckBox:   { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  roleCheckMark:  { color: '#fff', fontSize: 13, fontWeight: '900', lineHeight: 16 },
  radioOuter:     { width: 20, height: 20, borderRadius: 10, borderWidth: 2, flexShrink: 0, marginLeft: 8 },

  subCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, padding: 14, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  subIcon:    { fontSize: 22, lineHeight: 28, flexShrink: 0 },
  subTextWrap:{ flex: 1, gap: 2 },
  subLabel:   { fontSize: 14, fontWeight: '700', lineHeight: 19 },
  subDesc:    { fontSize: 12, lineHeight: 17 },

  resumeRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1.5,
    padding: 14, marginTop: 14, gap: 12,
  },
  resumeEmoji:   { fontSize: 22, lineHeight: 28 },
  resumeTextWrap:{ flex: 1, gap: 2 },
  resumeTitle:   { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  resumeSub:     { fontSize: 11, lineHeight: 16 },
  resumeClear:   { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  resumeClearTxt:{ fontSize: 12, color: '#dc2626', fontWeight: '700' },

  continueBtn: { marginTop: 20, marginBottom: 4 },

  cardShadow: {
    shadowColor: '#1037A4', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 20, elevation: 8,
  },
  kav:       { flex: 1 },
  scroll:    { padding: 20, paddingBottom: 40 },
  card:      { borderRadius: 24, padding: 24, marginTop: -16 },
  cardTitle: { marginBottom: 20 },

  field:      { marginBottom: 16 },
  label:      { letterSpacing: 0.3, marginBottom: 6 },
  salaryRow:  { flexDirection: 'row', gap: 10 },
  salaryHalf: { flex: 1 },
  submitBtn:  { marginTop: 8 },

  loginRow:  { flexDirection: 'row', justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' },
  loginLink: { fontWeight: '700' },
});
