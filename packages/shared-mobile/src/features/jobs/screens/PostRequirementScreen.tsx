import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { RequirementType } from '../../../core/api/endpoints/requirementsApi';
import { FormInput } from '../../../shared/components/forms/FormInput';
import { FormSelect } from '../../../shared/components/forms/FormSelect';
import { FormDatePicker, FormTimePicker } from '../../../shared/components/forms/FormDateTimePicker';
import { CategorySelector } from '../../../shared/components/forms/CategorySelector';
import { LocationSelector } from '../../../shared/components/forms/LocationSelector';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { LocationPickerModal } from '../../../shared/components/ui/LocationPickerModal';
import type { PickedLocation } from '../../../shared/components/ui/LocationPickerModal';
import { useAppTheme } from '../../../core/theme';
import { useAppConfig } from '../../../core/api/endpoints/appConfigApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { usePlanFeatures } from '../../../core/hooks/usePlanFeatures';
import type { MainStackParamList } from '../../../app/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type RouteParams = NativeStackScreenProps<MainStackParamList, 'PostRequirement'>['route'];

// ─── Requirement Types ─────────────────────────────────────────────────────────
interface ReqTypeOption {
  value: RequirementType;
  label: string;
  description: string;
  icon: string;
  color: string;
}

const REQ_TYPES: ReqTypeOption[] = [
  {
    value: 'Daily_Wages',
    label: 'Daily Wages',
    description: 'Hire workers on a per-day basis for short-term or recurring work',
    icon: '📅',
    color: '#3B82F6',
  },
  {
    value: 'Contract_Based',
    label: 'Contract Based',
    description: 'Fixed-term contracts for project-based or time-bound work',
    icon: '📋',
    color: '#8B5CF6',
  },
  {
    value: 'Supply_Based',
    label: 'Supply Based',
    description: 'Bulk labour supply for large-scale or ongoing workforce needs',
    icon: '👥',
    color: '#F59E0B',
  },
  {
    value: 'Office_Staff',
    label: 'Office Staff',
    description: 'Hire office administrators, data entry and support personnel',
    icon: '💼',
    color: '#10B981',
  },
];

// ─── Form Schema ──────────────────────────────────────────────────────────────
const AGE_GROUP_OPTIONS = ['18-25', '25-35', '35-45', '45+', 'Any'];
const ESTIMATED_DAYS_OPTIONS = ['1-3 days', '1 week', '2 weeks', '1 month', '2-3 months', '3-6 months', '6+ months'];

const requirementSchema = z.object({
  workType: z.string().min(1, 'Work type is required'),
  subCategory: z.string().min(1, 'Sub-category is required'),
  workerQuantitySkilled: z.string().regex(/^[1-9]\d*$/, 'Enter a valid number'),
  workerQuantityUnskilled: z.string().optional(),
  ageGroup: z.string().optional(),
  state: z.string().min(1, 'State is required'),
  district: z.string().min(1, 'District is required'),
  tehsil: z.string().optional(),
  pinCode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit PIN code').optional().or(z.literal('')),
  workerNeedDate: z.string().min(1, 'Date is required'),
  inTime: z.string().optional(),
  outTime: z.string().optional(),
  remarks: z.string().min(5, 'Please describe the work (min 5 chars)'),
  salaryType: z.enum(['Daily', 'Weekly', 'Monthly']),
  minBudgetPerWorker: z.string().regex(/^\d+$/, 'Enter min budget'),
  maxBudgetPerWorker: z.string().regex(/^\d+$/, 'Enter max budget'),
  estimated_days: z.string().optional(),
  workLocation: z.string().optional(),
  contactPersonName: z.string().optional(),
  contactPersonPhone: z
    .string()
    .regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number')
    .optional()
    .or(z.literal('')),
});

type FormValues = z.infer<typeof requirementSchema>;

const BOOLEAN_FLAGS = [
  { key: 'accommodationAvailable', label: 'Accommodation', icon: '🏠' },
  { key: 'foodAvailable', label: 'Food Provided', icon: '🍱' },
  { key: 'transportProvided', label: 'Transport', icon: '🚌' },
  { key: 'weeklyOff', label: 'Weekly Off', icon: '📆' },
  { key: 'overtimeAvailable', label: 'Overtime', icon: '⏰' },
  { key: 'bonus', label: 'Bonus', icon: '💰' },
  { key: 'incentive', label: 'Incentive', icon: '🎯' },
  { key: 'insuranceAvailable', label: 'Insurance', icon: '🛡️' },
  { key: 'pfAvailable', label: 'PF', icon: '🏦' },
  { key: 'esicAvailable', label: 'ESIC', icon: '💊' },
] as const;

type BooleanFlagKey = (typeof BOOLEAN_FLAGS)[number]['key'];

// ─── Step 1: Type Selection ────────────────────────────────────────────────────
interface TypeSelectionProps {
  onSelect: (type: RequirementType) => void;
  onBack: () => void;
  showBack: boolean;
}

const TypeSelectionStep = ({ onSelect, onBack, showBack }: TypeSelectionProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const { config } = useAppConfig();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.typeContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Premium Hero ─────────────────────────────────────────────────── */}
      <View style={[styles.hero, { paddingTop: insets.top + 14 }]}>
        <View style={styles.heroDeco1} />
        <View style={styles.heroDeco2} />
        <View style={styles.heroDeco3} />
        {showBack && (
          <TouchableOpacity
            onPress={onBack}
            style={[styles.heroBack, { top: insets.top + 8 }]}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppText style={styles.heroBackIcon}>‹</AppText>
          </TouchableOpacity>
        )}
        <View style={styles.heroInner}>
          <View style={styles.heroIconWrap}>
            <AppText style={styles.heroEmoji}>🔊</AppText>
          </View>
          <AppText
            style={styles.heroTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            maxFontSizeMultiplier={1.2}
          >
            {t('typeSelectTitle')}
          </AppText>
          <AppText style={styles.heroSub} maxFontSizeMultiplier={1.3}>{t('typeSelectSubtitle')}</AppText>
        </View>
      </View>

      {/* ── Tagline ──────────────────────────────────────────────────────── */}
      <View style={[styles.taglineRow, { borderBottomColor: theme.colors.border }]}>
        <View style={[styles.taglineDot, { backgroundColor: theme.colors.primary }]} />
        <AppText style={[styles.taglineTxt, { color: theme.colors.mutedText }]}>
          {t('typeSelectTagline')}
        </AppText>
      </View>

      {/* ── Type Cards ───────────────────────────────────────────────────── */}
      <View style={styles.cardsWrap}>
        {REQ_TYPES.map((rt, idx) => (
          <TouchableOpacity
            key={rt.value}
            onPress={() => onSelect(rt.value)}
            activeOpacity={0.78}
            style={[
              styles.typeCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                shadowColor: '#000',
              },
            ]}
          >
            {/* Left accent strip */}
            <View style={[styles.accentBar, { backgroundColor: rt.color }]} />

            {/* Icon box */}
            <View style={[styles.typeIconBox, { backgroundColor: rt.color + '18' }]}>
              <AppText style={styles.typeIconEmoji}>{rt.icon}</AppText>
            </View>

            {/* Body */}
            <View style={styles.typeCardBody}>
              <View style={styles.cardTitleRow}>
                <AppText style={[styles.typeCardTitle, { color: theme.colors.text, flexShrink: 1 }]} maxFontSizeMultiplier={1.2}>
                  {t(`type_${rt.value}_label` as any)}
                </AppText>
                {idx === 0 && (
                  <View style={[styles.popularBadge, { backgroundColor: rt.color + '18' }]}>
                    <AppText style={[styles.popularTxt, { color: rt.color }]} maxFontSizeMultiplier={1.1}>
                      {t('typePopularBadge')}
                    </AppText>
                  </View>
                )}
              </View>
              <AppText style={[styles.typeCardDesc, { color: theme.colors.mutedText }]} maxFontSizeMultiplier={1.3}>
                {t(`type_${rt.value}_desc` as any)}
              </AppText>
              <View style={[styles.tagPill, { backgroundColor: rt.color + '10', borderColor: rt.color + '30' }]}>
                <AppText style={[styles.tagTxt, { color: rt.color }]} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                  {t(`type_${rt.value}_tag` as any)}
                </AppText>
              </View>
            </View>

            {/* Arrow */}
            <AppText style={[styles.typeArrow, { color: rt.color }]}>›</AppText>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Trust Strip ──────────────────────────────────────────────────── */}
      <View style={[styles.trustStrip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <AppText style={styles.trustIcon}>🇮🇳</AppText>
        <AppText style={[styles.trustTxt, { color: theme.colors.mutedText }]}>
          {t('pricingTrustBadge', { count: config.stats.employerCount.toLocaleString('en-IN') })}
        </AppText>
      </View>
    </ScrollView>
  );
};


// ─── Step 2: Requirement Form ──────────────────────────────────────────────────
interface PrefillData {
  workType?: string;
  subCategory?: string;
  reqType?: string;
  state?: string;
  district?: string;
  tehsil?: string;
  workerQuantitySkilled?: number;
  salaryType?: string;
  budgetPerWorker?: number;
  minBudgetPerWorker?: number;
  maxBudgetPerWorker?: number;
  remarks?: string;
  inTime?: string;
  outTime?: string;
  accommodationAvailable?: boolean;
  foodAvailable?: boolean;
  transportProvided?: boolean;
  weeklyOff?: boolean;
  overtimeAvailable?: boolean;
  incentive?: boolean;
  bonus?: boolean;
}

interface FormStepProps {
  reqType: RequirementType;
  onBack: () => void;
  initialWorkType?: string;
  prefill?: PrefillData;
}

// ─── Numeric stepper (− value +) for worker counts ─────────────────────────────
interface StepperProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  min: number;
}

const Stepper = ({ label, required, value, onChange, min }: StepperProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const num = parseInt(value || '0', 10) || 0;
  const set = (n: number): void => onChange(String(Math.max(min, n)));
  const atMin = num <= min;
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={ps.stepperLabelRow}>
        <AppText variant="labelSm" color={theme.colors.textSecondary} style={{ letterSpacing: 0.2 }}>{label}</AppText>
        {required && <AppText style={ps.stepperAsterisk}>*</AppText>}
      </View>
      <View style={[ps.stepperRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
        <TouchableOpacity
          onPress={() => set(num - 1)}
          disabled={atMin}
          activeOpacity={0.7}
          style={[ps.stepperBtn, { backgroundColor: theme.colors.surface1, borderColor: theme.colors.border, opacity: atMin ? 0.45 : 1 }]}
        >
          <AppText style={[ps.stepperBtnTxt, { color: theme.colors.primary }]}>−</AppText>
        </TouchableOpacity>
        <View style={[ps.stepperValueBox, { borderColor: theme.colors.border }]}>
          <AppText style={[ps.stepperValueTxt, { color: theme.colors.text }]}>{num}</AppText>
        </View>
        <TouchableOpacity
          onPress={() => set(num + 1)}
          activeOpacity={0.7}
          style={[ps.stepperBtn, { backgroundColor: theme.colors.surface1, borderColor: theme.colors.border }]}
        >
          <AppText style={[ps.stepperBtnTxt, { color: theme.colors.primary }]}>+</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const RequirementFormStep = ({ reqType, onBack, initialWorkType, prefill }: FormStepProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const navigation = useNavigation<Nav>();
  const { state: authState } = useAuth();
  const user = authState.session?.user;
  const queryClient = useQueryClient();
  const toast = useToast();

  // Fetch user profile for employer details
  const { data: userProfile } = useQuery({
    queryKey: ['employer-full-profile'],
    queryFn: async () => {
      const { apiClient } = await import('../../../core/api/client');
      const res = await apiClient.get<{ user?: { state?: string; district?: string; phone?: string } }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    staleTime: 10 * 60 * 1000,
  });

  // Plan-derived posts quota (degrades gracefully when backend omits the count)
  const plan = usePlanFeatures();
  const postsExhausted = plan.loaded && !plan.unlimitedPosts && plan.remainingPosts != null && plan.remainingPosts <= 0;
  const postsLabel = (() => {
    if (plan.unlimitedPosts) return t('pl_postsUnlimited');
    if (plan.remainingPosts == null) return null;
    return t('pl_postsRemaining', { count: plan.remainingPosts });
  })();

  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const [boolFlags, setBoolFlags] = useState<Record<BooleanFlagKey, boolean>>({
    accommodationAvailable: prefill?.accommodationAvailable ?? false,
    foodAvailable:          prefill?.foodAvailable ?? false,
    transportProvided:      prefill?.transportProvided ?? false,
    weeklyOff:              prefill?.weeklyOff ?? false,
    overtimeAvailable:      prefill?.overtimeAvailable ?? false,
    bonus:                  prefill?.bonus ?? false,
    incentive:              prefill?.incentive ?? false,
    insuranceAvailable: false,
    pfAvailable: false,
    esicAvailable: false,
  });

  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});

  const typeInfo = REQ_TYPES.find((r) => r.value === reqType)!;
  const isDailyWages = reqType === 'Daily_Wages';

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(requirementSchema),
    defaultValues: {
      workType: '',
      subCategory: '',
      workerQuantitySkilled: '1',
      workerQuantityUnskilled: '0',
      ageGroup: '',
      state: userProfile?.state ?? user?.state ?? '',
      district: userProfile?.district ?? user?.district ?? '',
      tehsil: '',
      pinCode: '',
      workerNeedDate: '',
      inTime: '',
      outTime: '',
      remarks: '',
      salaryType: 'Daily' as const,
      minBudgetPerWorker: '',
      maxBudgetPerWorker: '',
      estimated_days: '',
      workLocation: '',
      contactPersonName: '',
      contactPersonPhone: '',
    },
  });

  // Industry / Agency / Contractor employers can name a separate contact person;
  // Individual employers post under their own details, so the fields stay hidden.
  const empType = (user?.employerType ?? {}) as {
    individual?: boolean;
    contractor?: boolean;
    agency?: boolean;
    industry?: boolean;
  };
  const showContactPerson = !!(empType.industry || empType.agency || empType.contractor);

  // Pre-fill workType when navigating from "Hire Again"
  useEffect(() => {
    if (initialWorkType) {
      setValue('workType', initialWorkType, { shouldValidate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWorkType]);

  // Pre-fill all fields when reposting
  useEffect(() => {
    if (!prefill) return;
    if (prefill.workType)              setValue('workType', prefill.workType, { shouldValidate: false });
    if (prefill.subCategory)           setValue('subCategory', prefill.subCategory, { shouldValidate: false });
    if (prefill.state)                 setValue('state', prefill.state, { shouldValidate: false });
    if (prefill.district)              setValue('district', prefill.district, { shouldValidate: false });
    if (prefill.tehsil)                setValue('tehsil', prefill.tehsil, { shouldValidate: false });
    if (prefill.workerQuantitySkilled) setValue('workerQuantitySkilled', String(prefill.workerQuantitySkilled), { shouldValidate: false });
    if (prefill.salaryType)            setValue('salaryType', prefill.salaryType as 'Daily' | 'Weekly' | 'Monthly', { shouldValidate: false });
    if (prefill.minBudgetPerWorker)    setValue('minBudgetPerWorker', String(prefill.minBudgetPerWorker), { shouldValidate: false });
    if (prefill.maxBudgetPerWorker)    setValue('maxBudgetPerWorker', String(prefill.maxBudgetPerWorker), { shouldValidate: false });
    if (prefill.remarks)               setValue('remarks', prefill.remarks, { shouldValidate: false });
    if (prefill.inTime)                setValue('inTime', prefill.inTime, { shouldValidate: false });
    if (prefill.outTime)               setValue('outTime', prefill.outTime, { shouldValidate: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stateVal = watch('state');
  const districtVal = watch('district');
  const tehsilVal = watch('tehsil');
  const workTypeVal = watch('workType');
  const subCategoryVal = watch('subCategory');

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      requirementsApi.create({
        req_type: reqType,
        workType: values.workType,
        subCategory: values.subCategory,
        workerQuantitySkilled: Number(values.workerQuantitySkilled),
        workerQuantityUnskilled: values.workerQuantityUnskilled ? Number(values.workerQuantityUnskilled) : 0,
        ageGroup: values.ageGroup,
        state: values.state,
        district: values.district,
        tehsil: values.tehsil,
        pinCode: values.pinCode ?? undefined,
        workerNeedDate: (() => {
          const d = values.workerNeedDate.trim();
          // Convert DD/MM/YYYY → YYYY-MM-DD so Mongoose can parse the date
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
            const [dd, mm, yyyy] = d.split('/');
            return `${yyyy}-${mm}-${dd}`;
          }
          return d;
        })(),
        inTime: isDailyWages ? values.inTime : undefined,
        outTime: isDailyWages ? values.outTime : undefined,
        remarks: values.remarks,
        salaryType: values.salaryType,
        minBudgetPerWorker: Number(values.minBudgetPerWorker),
        maxBudgetPerWorker: Number(values.maxBudgetPerWorker),
        estimated_days: values.estimated_days,
        workLocation: values.workLocation,
        latitude: coords.lat,
        longitude: coords.lng,
        employerId: user?.id,
        employerName: user?.fullName,
        employerPhone: (userProfile as { phone?: string } | null)?.phone ?? user?.phone,
        contactPersonName: showContactPerson ? (values.contactPersonName || undefined) : undefined,
        contactPersonPhone: showContactPerson ? (values.contactPersonPhone || undefined) : undefined,
        ...boolFlags,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['employer-requirements'] });
      toast.success(t('jp_reqPostedBody'), t('jp_reqPostedTitle'));
      setTimeout(() => navigation.goBack(), 1500);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t('jp_reqPostFailBody'), t('jp_reqPostFailTitle'));
    },
  });

  const onSubmit = handleSubmit((values) => mutation.mutate(values));

  const toggleFlag = (key: BooleanFlagKey): void => {
    setBoolFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Type badge ── */}
      <View style={[ps.typeBanner, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={[ps.typeBannerIcon, { backgroundColor: theme.colors.primaryLight }]}>
          <AppText style={{ fontSize: 22 }}>{typeInfo.icon}</AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText style={[ps.typeBannerLabel, { color: theme.colors.primary }]}>{t(`type_${reqType}_label` as any)}</AppText>
          <AppText style={[ps.typeBannerDesc, { color: theme.colors.mutedText }]} numberOfLines={2}>{t(`type_${reqType}_desc` as any)}</AppText>
        </View>
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.75}
          style={[ps.changeBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface1 }]}
        >
          <AppText style={[ps.changeBtnTxt, { color: theme.colors.primary }]}>{t('post_changeType')}</AppText>
        </TouchableOpacity>
      </View>

      {/* ── 1. Work Type ── */}
      <View style={[ps.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={[ps.sectionHeader, { borderBottomColor: theme.colors.divider }]}>
          <View style={[ps.sectionIconBox, { backgroundColor: '#F3EEE6' }]}>
            <AppText style={ps.sectionIcon}>💼</AppText>
          </View>
          <AppText style={[ps.sectionTitle, { color: theme.colors.text }]}>{t('post_secWorkType')}</AppText>
          <View style={ps.requiredDot}><AppText style={ps.requiredTxt}>{t('required')}</AppText></View>
        </View>
        <View style={ps.sectionBody}>
          <CategorySelector
            category={workTypeVal}
            subCategory={subCategoryVal}
            onCategoryChange={(v) => { setValue('workType', v, { shouldValidate: true }); setValue('subCategory', '', { shouldValidate: true }); }}
            onSubCategoryChange={(v) => setValue('subCategory', v, { shouldValidate: true })}
            categoryError={errors.workType?.message}
            subCategoryError={errors.subCategory?.message}
            required
          />
        </View>
      </View>

      {/* ── 2. Worker Details ── */}
      <View style={[ps.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={[ps.sectionHeader, { borderBottomColor: theme.colors.divider }]}>
          <View style={[ps.sectionIconBox, { backgroundColor: '#EFF3FE' }]}>
            <AppText style={ps.sectionIcon}>👤</AppText>
          </View>
          <AppText style={[ps.sectionTitle, { color: theme.colors.text }]}>{t('post_secWorkerDetails')}</AppText>
        </View>
        <View style={ps.sectionBody}>
          <Controller
            control={control}
            name="workerQuantitySkilled"
            render={({ field: { value, onChange } }) => (
              <Stepper
                label={t('post_skilledWorkers').replace(/\s*\*\s*$/, '')}
                required
                value={value ?? '1'}
                onChange={onChange}
                min={1}
              />
            )}
          />
          <Controller
            control={control}
            name="workerQuantityUnskilled"
            render={({ field: { value, onChange } }) => (
              <Stepper
                label={t('post_helperWorkers').replace(/\s*\*\s*$/, '')}
                value={value ?? '0'}
                onChange={onChange}
                min={0}
              />
            )}
          />
          <Controller
            control={control}
            name="ageGroup"
            render={({ field, fieldState }) => (
              <FormSelect
                label={t('jp_ageGroup')}
                value={field.value ?? ''}
                options={AGE_GROUP_OPTIONS}
                onChange={field.onChange}
                errorText={fieldState.error?.message}
              />
            )}
          />
        </View>
      </View>

      {/* ── 3. Location ── */}
      <View style={[ps.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={[ps.sectionHeader, { borderBottomColor: theme.colors.divider }]}>
          <View style={[ps.sectionIconBox, { backgroundColor: '#FDECEF' }]}>
            <AppText style={ps.sectionIcon}>📍</AppText>
          </View>
          <AppText style={[ps.sectionTitle, { color: theme.colors.text }]}>{t('post_secLocation')}</AppText>
          <View style={ps.requiredDot}><AppText style={ps.requiredTxt}>{t('required')}</AppText></View>
        </View>
        <View style={ps.sectionBody}>
          <LocationSelector
            state={stateVal}
            district={districtVal}
            block={tehsilVal ?? ''}
            onStateChange={(v) => { setValue('state', v, { shouldValidate: true }); setValue('district', '', { shouldValidate: true }); setValue('tehsil', ''); }}
            onDistrictChange={(v) => { setValue('district', v, { shouldValidate: true }); setValue('tehsil', ''); }}
            onBlockChange={(v) => setValue('tehsil', v)}
            stateError={errors.state?.message}
            districtError={errors.district?.message}
            blockLabel={t('pf_blockTehsil')}
            required
          />
          <FormInput
            control={control}
            name="pinCode"
            label={t('pinCode')}
            placeholder={t('jp_phPinCode')}
            keyboardType="number-pad"
            maxLength={6}
          />
          <TouchableOpacity
            onPress={() => setShowLocationPicker(true)}
            activeOpacity={0.8}
            style={[ps.mapBtn, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight }]}
          >
            <AppText style={{ fontSize: 18 }}>🗺</AppText>
            <View style={{ flex: 1 }}>
              <AppText style={[ps.mapBtnLabel, { color: theme.colors.primary }]}>{t('post_pinLocation')}</AppText>
              <AppText style={[ps.mapBtnSub, { color: theme.colors.mutedText }]} numberOfLines={1}>{watch('workLocation') || t('post_gpsHint')}</AppText>
            </View>
            <AppText style={[ps.mapBtnArrow, { color: theme.colors.primary }]}>›</AppText>
          </TouchableOpacity>
          <FormInput
            control={control}
            name="workLocation"
            label={t('post_exactAddress')}
            placeholder={t('jp_phAddress')}
          />
        </View>
      </View>

      {/* ── Contact Person (Industry / Agency / Contractor only) ── */}
      {showContactPerson && (
        <View style={[ps.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={[ps.sectionHeader, { borderBottomColor: theme.colors.divider }]}>
            <View style={[ps.sectionIconBox, { backgroundColor: '#EAF2FF' }]}>
              <AppText style={ps.sectionIcon}>👤</AppText>
            </View>
            <AppText style={[ps.sectionTitle, { color: theme.colors.text }]}>Contact Person</AppText>
          </View>
          <View style={ps.sectionBody}>
            <FormInput
              control={control}
              name="contactPersonName"
              label="Contact Person Name"
              placeholder="e.g. Site supervisor name"
            />
            <FormInput
              control={control}
              name="contactPersonPhone"
              label="Contact Person Mobile Number"
              placeholder="10-digit mobile number"
              keyboardType="number-pad"
              maxLength={10}
            />
            <AppText style={[ps.sectionSub, { color: theme.colors.mutedText, marginTop: 4 }]}>
              Shown to agents on this requirement. Leave blank to use your own number.
            </AppText>
          </View>
        </View>
      )}

      <LocationPickerModal
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        title={t('jp_pickWorkLocation')}
        onPick={(loc: PickedLocation) => {
          setValue('workLocation', loc.address, { shouldValidate: true });
          setCoords({ lat: loc.lat, lng: loc.lng });
          if (loc.state && !watch('state'))       setValue('state', loc.state, { shouldValidate: true });
          if (loc.district && !watch('district')) setValue('district', loc.district, { shouldValidate: true });
          if (loc.pinCode && !watch('pinCode'))   setValue('pinCode', loc.pinCode);
        }}
      />

      {/* ── 4. Schedule & Duration ── */}
      <View style={[ps.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={[ps.sectionHeader, { borderBottomColor: theme.colors.divider }]}>
          <View style={[ps.sectionIconBox, { backgroundColor: '#FDF5E8' }]}>
            <AppText style={ps.sectionIcon}>📅</AppText>
          </View>
          <AppText style={[ps.sectionTitle, { color: theme.colors.text }]}>{t('post_secSchedule')}</AppText>
        </View>
        <View style={ps.sectionBody}>
          <Controller
            control={control}
            name="workerNeedDate"
            render={({ field: { value, onChange }, fieldState: { error } }) => (
              <FormDatePicker
                label={t('post_workerNeedDate')}
                value={value ?? ''}
                onChange={onChange}
                placeholder="DD/MM/YYYY"
                errorText={error?.message}
              />
            )}
          />
          {isDailyWages && (
            <View style={styles.row}>
              <View style={styles.rowHalf}>
                <Controller
                  control={control}
                  name="inTime"
                  render={({ field: { value, onChange }, fieldState: { error } }) => (
                    <FormTimePicker
                      label={t('post_startTime')}
                      value={value ?? ''}
                      onChange={onChange}
                      placeholder="08:00 AM"
                      errorText={error?.message}
                    />
                  )}
                />
              </View>
              <View style={styles.rowHalf}>
                <Controller
                  control={control}
                  name="outTime"
                  render={({ field: { value, onChange }, fieldState: { error } }) => (
                    <FormTimePicker
                      label={t('post_endTime')}
                      value={value ?? ''}
                      onChange={onChange}
                      placeholder="06:00 PM"
                      errorText={error?.message}
                    />
                  )}
                />
              </View>
            </View>
          )}
          <Controller
            control={control}
            name="estimated_days"
            render={({ field }) => (
              <FormSelect
                label={t('post_estimatedDuration')}
                value={field.value ?? ''}
                options={ESTIMATED_DAYS_OPTIONS}
                onChange={field.onChange}
              />
            )}
          />
        </View>
      </View>

      {/* ── 5. Payment ── */}
      <View style={[ps.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={[ps.sectionHeader, { borderBottomColor: theme.colors.divider }]}>
          <View style={[ps.sectionIconBox, { backgroundColor: '#EBF8F0' }]}>
            <AppText style={ps.sectionIcon}>💲</AppText>
          </View>
          <AppText style={[ps.sectionTitle, { color: theme.colors.text }]}>{t('post_secPayment')}{'  '}<AppText style={[ps.sectionSub, { color: theme.colors.mutedText }]}>{t('post_perWorker')}</AppText></AppText>
        </View>
        <View style={ps.sectionBody}>
          {/* Salary type chips */}
          <AppText style={[ps.fieldLabel, { color: theme.colors.mutedText }]}>{t('post_paymentFreq')}</AppText>
          <Controller
            control={control}
            name="salaryType"
            render={({ field: { value, onChange } }) => (
              <View style={[styles.salaryTypeRow, { marginBottom: 14 }]}>
                {(['Daily', 'Weekly', 'Monthly'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => onChange(type)}
                    activeOpacity={0.8}
                    style={[
                      styles.salaryTypeChip,
                      {
                        backgroundColor: value === type ? theme.colors.primary : theme.colors.surface1,
                        borderColor: value === type ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                  >
                    <AppText style={[styles.salaryTypeChipTxt, { color: value === type ? '#fff' : theme.colors.mutedText }]}>
                      {type === 'Daily' ? `📅 ${t('salaryDaily')}` : type === 'Weekly' ? `📆 ${t('salaryWeekly')}` : `🗓 ${t('salaryMonthly')}`}
                    </AppText>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          />
          {/* Budget range */}
          <AppText style={[ps.fieldLabel, { color: theme.colors.mutedText }]}>{t('post_budgetRange')} · {watch('salaryType')?.toLowerCase() ?? 'daily'}</AppText>
          <View style={styles.row}>
            <View style={styles.rowHalf}>
              <FormInput
                control={control}
                name="minBudgetPerWorker"
                label={t('post_minAmount')}
                placeholder={watch('salaryType') === 'Monthly' ? '8000' : watch('salaryType') === 'Weekly' ? '2000' : '400'}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.rowHalf}>
              <FormInput
                control={control}
                name="maxBudgetPerWorker"
                label={t('post_maxAmount')}
                placeholder={watch('salaryType') === 'Monthly' ? '15000' : watch('salaryType') === 'Weekly' ? '4000' : '700'}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>
      </View>

      {/* ── 6. Perks & Benefits ── */}
      <View style={[ps.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={[ps.sectionHeader, { borderBottomColor: theme.colors.divider }]}>
          <View style={[ps.sectionIconBox, { backgroundColor: '#FDECEF' }]}>
            <AppText style={ps.sectionIcon}>🎁</AppText>
          </View>
          <AppText style={[ps.sectionTitle, { color: theme.colors.text }]}>{t('post_secPerks')}</AppText>
          <AppText style={[ps.optionalTag, { color: theme.colors.mutedText }]}>{t('optional')}</AppText>
        </View>
        <View style={[ps.sectionBody, { paddingBottom: 6 }]}>
          <View style={styles.flagsGrid}>
            {BOOLEAN_FLAGS.map((flag) => (
              <TouchableOpacity
                key={flag.key}
                onPress={() => toggleFlag(flag.key)}
                activeOpacity={0.8}
                style={[
                  styles.flagChip,
                  {
                    backgroundColor: boolFlags[flag.key] ? theme.colors.primary + '15' : theme.colors.surface1,
                    borderColor: boolFlags[flag.key] ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <AppText style={styles.flagChipIcon}>{flag.icon}</AppText>
                <AppText
                  variant="caption"
                  color={boolFlags[flag.key] ? theme.colors.primary : theme.colors.text}
                  style={styles.flagChipLabel}
                >
                  {t(`rd_perk_${flag.key}` as any)}
                </AppText>
                {boolFlags[flag.key] && (
                  <AppText style={[styles.flagCheck, { color: theme.colors.primary }]}>✓</AppText>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* ── 7. Work Description ── */}
      <View style={[ps.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={[ps.sectionHeader, { borderBottomColor: theme.colors.divider }]}>
          <View style={[ps.sectionIconBox, { backgroundColor: '#EFF3FE' }]}>
            <AppText style={ps.sectionIcon}>✏️</AppText>
          </View>
          <AppText style={[ps.sectionTitle, { color: theme.colors.text }]}>{t('post_secDescription')}</AppText>
          <View style={ps.requiredDot}><AppText style={ps.requiredTxt}>{t('required')}</AppText></View>
        </View>
        <View style={ps.sectionBody}>
          <FormInput
            control={control}
            name="remarks"
            label={t('post_remarksLabel')}
            placeholder={t('jp_phRemarks')}
            multiline
            numberOfLines={4}
            style={styles.textarea}
          />
        </View>
      </View>

      {/* ── Posts remaining indicator (hidden when count unavailable) ── */}
      {postsLabel && !postsExhausted && (
        <View style={[ppl.indicator, { backgroundColor: theme.colors.surface1, borderColor: theme.colors.border }]}>
          <AppText style={ppl.indicatorIcon}>📝</AppText>
          <AppText style={[ppl.indicatorTxt, { color: theme.colors.textSecondary }]}>{postsLabel}</AppText>
        </View>
      )}

      {/* ── Posts exhausted upgrade prompt (mirror contacts-exhausted UX) ── */}
      {postsExhausted ? (
        <View style={[ppl.upgrade, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <AppText style={ppl.upgradeIcon}>🚫</AppText>
          <AppText style={[ppl.upgradeTitle, { color: theme.colors.text }]}>{t('pl_postsExhaustedTitle')}</AppText>
          <AppText style={[ppl.upgradeSub, { color: theme.colors.mutedText }]}>{t('pl_postsExhaustedDesc')}</AppText>
          <TouchableOpacity
            onPress={() => navigation.navigate('Subscription')}
            style={ppl.upgradeBtn}
            activeOpacity={0.85}
          >
            <AppText style={ppl.upgradeBtnTxt}>{t('pl_upgradeBtn')}</AppText>
          </TouchableOpacity>
        </View>
      ) : (
        /* ── Submit ── */
        <AppButton
          title={mutation.isPending ? t('post_publishing') : `🚀  ${t('post_publishBtn')}`}
          onPress={onSubmit}
          loading={mutation.isPending}
          disabled={mutation.isPending}
          style={styles.submitBtn}
        />
      )}
    </ScrollView>
  );
};

const ppl = StyleSheet.create({
  indicator:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginTop: 20 },
  indicatorIcon:{ fontSize: 15, lineHeight: 19 },
  indicatorTxt: { fontSize: 12.5, fontWeight: '700' },
  upgrade:      { borderRadius: 16, borderWidth: 1, padding: 20, marginTop: 20, alignItems: 'center', gap: 8 },
  upgradeIcon:  { fontSize: 40 },
  upgradeTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  upgradeSub:   { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  upgradeBtn:   { marginTop: 6, backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, width: '100%', alignItems: 'center' },
  upgradeBtnTxt:{ color: '#fff', fontSize: 15, fontWeight: '800' },
});

// ─── Section Label ────────────────────────────────────────────────────────────
const SectionLabel = ({ label, theme }: { label: string; theme: ReturnType<typeof useAppTheme>['theme'] }): React.JSX.Element => (
  <View style={styles.sectionRow}>
    <AppText variant="label" style={[styles.sectionLabel, { color: theme.colors.text }]}>{label}</AppText>
    <View style={[styles.sectionLine, { backgroundColor: theme.colors.border }]} />
  </View>
);

// ─── Subscription Gate ────────────────────────────────────────────────────────
const GATE_BRAND = '#1037A4';
const SubscriptionGate = ({ onBack }: { onBack: () => void }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const navigation = useNavigation<Nav>();
  const benefits = [
    t('jp_gateBenefit1'),
    t('jp_gateBenefit2'),
    t('jp_gateBenefit3'),
    t('jp_gateBenefit4'),
  ];
  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={gate.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[gate.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        {/* Premium icon + PRO badge */}
        <View style={gate.iconWrap}>
          <View style={gate.iconCircle}>
            <AppText style={gate.iconEmoji}>🔒</AppText>
          </View>
          <View style={gate.proPill}>
            <AppText style={gate.proTxt}>★ PRO</AppText>
          </View>
        </View>

        <AppText style={[gate.title, { color: theme.colors.text }]}>{t('jp_gateTitle')}</AppText>
        <AppText style={[gate.sub, { color: theme.colors.mutedText }]}>{t('jp_gateBody')}</AppText>

        {/* Benefits */}
        <View style={gate.benefits}>
          {benefits.map((benefit) => (
            <View key={benefit} style={gate.benefitRow}>
              <View style={gate.checkCircle}>
                <AppText style={gate.checkTick}>✓</AppText>
              </View>
              <AppText style={[gate.benefitTxt, { color: theme.colors.text }]}>{benefit}</AppText>
            </View>
          ))}
        </View>

        {/* Primary CTA */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Subscription')}
          style={gate.cta}
          activeOpacity={0.9}
        >
          <AppText style={gate.ctaTxt}>{t('jp_viewPlansSubscribe')}  →</AppText>
        </TouchableOpacity>

        <TouchableOpacity onPress={onBack} style={gate.laterBtn} activeOpacity={0.7}>
          <AppText style={[gate.laterTxt, { color: theme.colors.mutedText }]}>{t('jp_maybeLater')}</AppText>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const gate = StyleSheet.create({
  content:     { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card:        {
    borderRadius: 24, borderWidth: 1, paddingVertical: 28, paddingHorizontal: 22, alignItems: 'center',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 5,
  },
  iconWrap:    { marginBottom: 18, position: 'relative' },
  iconCircle:  { width: 78, height: 78, borderRadius: 39, backgroundColor: '#EBF1FF', alignItems: 'center', justifyContent: 'center' },
  iconEmoji:   { fontSize: 34 },
  proPill:     {
    position: 'absolute', top: -4, right: -16,
    backgroundColor: '#F59E0B', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 3,
  },
  proTxt:      { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  title:       { fontSize: 22, fontWeight: '900', textAlign: 'center', letterSpacing: -0.4, marginBottom: 8 },
  sub:         { fontSize: 13.5, textAlign: 'center', lineHeight: 20, marginBottom: 22, paddingHorizontal: 4 },
  benefits:    { width: '100%', gap: 14, marginBottom: 26 },
  benefitRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkTick:   { color: '#fff', fontSize: 13, fontWeight: '900', lineHeight: 16 },
  benefitTxt:  { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  cta:         {
    width: '100%', backgroundColor: GATE_BRAND, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 4,
    shadowColor: GATE_BRAND, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  ctaTxt:      { color: '#fff', fontSize: 15.5, fontWeight: '800', letterSpacing: 0.2 },
  laterBtn:    { paddingVertical: 12 },
  laterTxt:    { fontSize: 14, fontWeight: '600' },
});

// ─── Main Export ──────────────────────────────────────────────────────────────
export const PostRequirementScreen = (): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteParams>();
  const { state: authState } = useAuth();
  const user = authState.session?.user;

  const paramReqType  = (route.params?.reqType ?? route.params?.prefill?.reqType ?? null) as RequirementType | null;
  const paramWorkType = route.params?.workType ?? route.params?.prefill?.workType ?? '';
  const prefill       = route.params?.prefill;

  // If repost / "Hire Again" passed a reqType, skip type selection
  const [reqType, setReqType] = useState<RequirementType | null>(paramReqType);

  const isEmployer = user?.role === 'employer';
  const isSubscribed = isEmployer
    ? (!!user?.isSubscribed && (!user.subscriptionExpiry || new Date(user.subscriptionExpiry).getTime() > Date.now()))
    : true; // non-employers (agents) don't need subscription

  const goBack = (): void => { if (navigation.canGoBack()) navigation.goBack(); };

  const title = reqType ? t('postRequirement') : t('jp_selectTypeTitle');

  if (isEmployer && !isSubscribed) {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
        <ScreenHeader title={t('postRequirement')} onBack={goBack} />
        <SubscriptionGate onBack={goBack} />
      </View>
    );
  }

  if (!reqType) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1037A4' }}>
        <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
        <TypeSelectionStep
          onSelect={(type) => setReqType(type)}
          onBack={goBack}
          showBack={navigation.canGoBack()}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title={title} onBack={() => setReqType(null)} />
      <RequirementFormStep
        reqType={reqType}
        onBack={() => setReqType(null)}
        initialWorkType={paramWorkType || undefined}
        prefill={prefill}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },

  // ── Type selection ──────────────────────────────────────────────────────────
  typeContent: { paddingBottom: 40 },

  // Hero
  hero: {
    backgroundColor: '#1037A4',
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  heroDeco1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -60,
    right: -50,
  },
  heroDeco2: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: -30,
    left: -20,
  },
  heroDeco3: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
    top: 20,
    left: '45%',
  },
  heroBack: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  heroBackIcon: { fontSize: 26, color: '#fff', fontWeight: '300', lineHeight: 30, marginLeft: -2 },
  heroInner: { alignItems: 'center', zIndex: 1 },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroEmoji:  { fontSize: 38 },
  heroTitle:  { fontSize: 22, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 8, letterSpacing: -0.5 },
  heroSub:    { fontSize: 14, color: 'rgba(255,255,255,0.72)', textAlign: 'center', lineHeight: 20, maxWidth: 280 },

  // Tagline row
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  taglineDot: { width: 6, height: 6, borderRadius: 3 },
  taglineTxt: { fontSize: 12.5, fontWeight: '600', letterSpacing: 0.2, flex: 1 },

  // Cards wrapper
  cardsWrap: { paddingHorizontal: 16, gap: 12, marginBottom: 20 },

  // Type card
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    paddingRight: 16,
    paddingVertical: 0,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  accentBar: { width: 4, alignSelf: 'stretch' },
  typeIconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 14,
    marginVertical: 16,
    flexShrink: 0,
  },
  typeIconEmoji: { fontSize: 28 },
  typeCardBody: { flex: 1, gap: 5, paddingLeft: 12, paddingVertical: 16 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  typeCardTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  popularBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  popularTxt:   { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  typeCardDesc: { fontSize: 12.5, lineHeight: 17 },
  tagPill: { alignSelf: 'flex-start', maxWidth: '100%', borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4 },
  tagTxt:  { fontSize: 11, fontWeight: '700', lineHeight: 16, paddingRight: 2 },
  typeArrow: { fontSize: 30, lineHeight: 34, paddingLeft: 4 },

  // Trust strip
  trustStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  trustIcon: { fontSize: 22 },
  trustTxt:  { fontSize: 12.5, fontWeight: '600', flex: 1, lineHeight: 17 },

  // ── Form ─────────────────────────────────────────────────────────────────────
  content: { padding: 16, paddingBottom: 48 },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  typeBadgeIcon: { fontSize: 28 },
  formTitle: { marginBottom: 4 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22, marginBottom: 10 },
  sectionLabel: { fontWeight: '700', fontSize: 13 },
  sectionLine: { flex: 1, height: 1 },
  card: { marginBottom: 4 },
  row: { flexDirection: 'row', gap: 10 },
  rowHalf: { flex: 1 },
  // Salary type radio buttons
  salaryTypeRow: { flexDirection: 'row', gap: 10 },
  salaryTypeChip: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5,
  },
  salaryTypeChipTxt: { fontSize: 13, fontWeight: '700' },
  // Perks grid
  flagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  flagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  flagChipIcon: { fontSize: 14 },
  flagChipLabel: { fontWeight: '600' },
  flagCheck: { fontSize: 12, fontWeight: '700' },
  textarea: { height: 100, textAlignVertical: 'top' },
  submitBtn: { marginTop: 24 },
});

const locBtnStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  icon: { fontSize: 22 },
  body: { flex: 1, gap: 2 },
  label: { fontWeight: '700', fontSize: 13 },
  arrow: { fontSize: 22, lineHeight: 26 },
});

// ─── Premium Section Styles ────────────────────────────────────────────────────
const ps = StyleSheet.create({
  // Type banner (replaces old typeBadge — no duplicate title)
  typeBanner:       { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 13, marginBottom: 14, elevation: 1, shadowColor: '#142250', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.05, shadowRadius: 12 },
  typeBannerIcon:   { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  typeBannerLabel:  { fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  typeBannerDesc:   { fontSize: 11.5, fontWeight: '500', marginTop: 2 },
  changeBtn:        { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, flexShrink: 0 },
  changeBtnTxt:     { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.2 },

  // Numeric stepper (worker counts)
  stepperLabelRow:  { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 8 },
  stepperAsterisk:  { color: '#E11D48', fontSize: 13, fontWeight: '700' },
  stepperRow:       { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, overflow: 'hidden', height: 54 },
  stepperBtn:       { width: 56, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  stepperBtnTxt:    { fontSize: 26, fontWeight: '600', lineHeight: 30 },
  stepperValueBox:  { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderRightWidth: 1 },
  stepperValueTxt:  { fontSize: 18, fontWeight: '800' },

  // Section card (Figma: radius 20, soft shadow)
  section:          { borderRadius: 20, borderWidth: 1, marginBottom: 16, overflow: 'hidden', elevation: 1, shadowColor: '#142250', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16 },
  sectionHeader:    { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionIconBox:   { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sectionIcon:      { fontSize: 17, lineHeight: 21 },
  sectionTitle:     { fontSize: 15, fontWeight: '800', flex: 1, letterSpacing: -0.1 },
  sectionSub:       { fontSize: 12, fontWeight: '500' },
  sectionBody:      { padding: 16, gap: 0 },

  // Required / Optional tags (Figma rose)
  requiredDot:      { backgroundColor: '#FEF0F2', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: '#F8D6DD' },
  requiredTxt:      { fontSize: 10, fontWeight: '800', color: '#E11D48', letterSpacing: 0.3 },
  optionalTag:      { fontSize: 11, fontWeight: '500' },

  // Map / GPS picker button (inside section body)
  mapBtn:           { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 10, marginTop: 2 },
  mapBtnLabel:      { fontSize: 13, fontWeight: '700' },
  mapBtnSub:        { fontSize: 11, fontWeight: '400', marginTop: 2 },
  mapBtnArrow:      { fontSize: 22, lineHeight: 26 },

  // Field sub-label inside a section
  fieldLabel:       { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
});
