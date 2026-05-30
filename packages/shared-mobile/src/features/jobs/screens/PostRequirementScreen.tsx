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
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { RequirementType } from '../../../core/api/endpoints/requirementsApi';
import { FormInput } from '../../../shared/components/forms/FormInput';
import { FormSelect } from '../../../shared/components/forms/FormSelect';
import { CategorySelector } from '../../../shared/components/forms/CategorySelector';
import { LocationSelector } from '../../../shared/components/forms/LocationSelector';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { LocationPickerModal } from '../../../shared/components/ui/LocationPickerModal';
import type { PickedLocation } from '../../../shared/components/ui/LocationPickerModal';
import { useAppTheme } from '../../../core/theme';
import { useAuth } from '../../../state/auth/AuthContext';
import { useToast } from '../../../shared/state/toast/ToastContext';
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
    icon: '🏗️',
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
}

const TypeSelectionStep = ({ onSelect }: TypeSelectionProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.typeContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Premium Hero ─────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <View style={styles.heroDeco1} />
        <View style={styles.heroDeco2} />
        <View style={styles.heroDeco3} />
        <View style={styles.heroInner}>
          <View style={styles.heroIconWrap}>
            <AppText style={styles.heroEmoji}>📣</AppText>
          </View>
          <AppText style={styles.heroTitle}>{t('typeSelectTitle')}</AppText>
          <AppText style={styles.heroSub}>{t('typeSelectSubtitle')}</AppText>
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
                <AppText style={[styles.typeCardTitle, { color: theme.colors.text }]} numberOfLines={1}>
                  {t(`type_${rt.value}_label` as any)}
                </AppText>
                {idx === 0 && (
                  <View style={[styles.popularBadge, { backgroundColor: rt.color + '18' }]}>
                    <AppText style={[styles.popularTxt, { color: rt.color }]}>
                      {t('typePopularBadge')}
                    </AppText>
                  </View>
                )}
              </View>
              <AppText style={[styles.typeCardDesc, { color: theme.colors.mutedText }]}>
                {t(`type_${rt.value}_desc` as any)}
              </AppText>
              <View style={[styles.tagPill, { backgroundColor: rt.color + '10', borderColor: rt.color + '30' }]}>
                <AppText style={[styles.tagTxt, { color: rt.color }]}>
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
          {t('typeSelectTrustBadge')}
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
    },
  });

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
        ...boolFlags,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['employer-requirements'] });
      toast.success('Your requirement is live. Workers will start applying shortly.', 'Requirement Posted!');
      setTimeout(() => navigation.goBack(), 1500);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not post requirement', 'Post Failed');
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
      <View style={[ps.typeBanner, { backgroundColor: typeInfo.color + '14', borderColor: typeInfo.color + '35' }]}>
        <View style={[ps.typeBannerIcon, { backgroundColor: typeInfo.color + '20' }]}>
          <AppText style={{ fontSize: 22 }}>{typeInfo.icon}</AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText style={[ps.typeBannerLabel, { color: typeInfo.color }]}>{typeInfo.label}</AppText>
          <AppText style={[ps.typeBannerDesc, { color: theme.colors.mutedText }]} numberOfLines={1}>{typeInfo.description}</AppText>
        </View>
      </View>

      {/* ── 1. Work Type ── */}
      <View style={[ps.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={[ps.sectionHeader, { borderBottomColor: theme.colors.divider }]}>
          <View style={[ps.sectionIconBox, { backgroundColor: '#3B82F615' }]}>
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
          <View style={[ps.sectionIconBox, { backgroundColor: '#8B5CF615' }]}>
            <AppText style={ps.sectionIcon}>👷</AppText>
          </View>
          <AppText style={[ps.sectionTitle, { color: theme.colors.text }]}>{t('post_secWorkerDetails')}</AppText>
        </View>
        <View style={ps.sectionBody}>
          <FormInput
            control={control}
            name="workerQuantitySkilled"
            label={t('post_skilledWorkers')}
            placeholder="e.g. 5"
            keyboardType="number-pad"
          />
          <FormInput
            control={control}
            name="workerQuantityUnskilled"
            label={t('post_helperWorkers')}
            placeholder="e.g. 2"
            keyboardType="number-pad"
          />
          <Controller
            control={control}
            name="ageGroup"
            render={({ field, fieldState }) => (
              <FormSelect
                label="Age Group"
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
          <View style={[ps.sectionIconBox, { backgroundColor: '#10B98115' }]}>
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
            blockLabel="Block / Tehsil"
            required
          />
          <FormInput
            control={control}
            name="pinCode"
            label={t('pinCode')}
            placeholder="6-digit area PIN code"
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
            placeholder="e.g. Near NH44, Village Rampur"
          />
        </View>
      </View>

      <LocationPickerModal
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        title="Pick Work Location"
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
          <View style={[ps.sectionIconBox, { backgroundColor: '#F59E0B15' }]}>
            <AppText style={ps.sectionIcon}>📅</AppText>
          </View>
          <AppText style={[ps.sectionTitle, { color: theme.colors.text }]}>{t('post_secSchedule')}</AppText>
        </View>
        <View style={ps.sectionBody}>
          <FormInput
            control={control}
            name="workerNeedDate"
            label={t('post_workerNeedDate')}
            placeholder="DD/MM/YYYY"
            keyboardType="numbers-and-punctuation"
          />
          {isDailyWages && (
            <View style={styles.row}>
              <View style={styles.rowHalf}>
                <FormInput control={control} name="inTime" label="Start Time" placeholder="08:00 AM" />
              </View>
              <View style={styles.rowHalf}>
                <FormInput control={control} name="outTime" label="End Time" placeholder="06:00 PM" />
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
          <View style={[ps.sectionIconBox, { backgroundColor: '#05966915' }]}>
            <AppText style={ps.sectionIcon}>💰</AppText>
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
          <View style={[ps.sectionIconBox, { backgroundColor: '#EC489915' }]}>
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
                  {flag.label}
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
          <View style={[ps.sectionIconBox, { backgroundColor: '#6366F115' }]}>
            <AppText style={ps.sectionIcon}>📝</AppText>
          </View>
          <AppText style={[ps.sectionTitle, { color: theme.colors.text }]}>{t('post_secDescription')}</AppText>
          <View style={ps.requiredDot}><AppText style={ps.requiredTxt}>{t('required')}</AppText></View>
        </View>
        <View style={ps.sectionBody}>
          <FormInput
            control={control}
            name="remarks"
            label={t('post_remarksLabel')}
            placeholder="e.g. Brick laying work for construction site. Workers should bring their own tools. Site is near the highway..."
            multiline
            numberOfLines={4}
            style={styles.textarea}
          />
        </View>
      </View>

      {/* ── Submit ── */}
      <AppButton
        title={mutation.isPending ? t('post_publishing') : `🚀  ${t('post_publishBtn')}`}
        onPress={onSubmit}
        loading={mutation.isPending}
        style={styles.submitBtn}
      />
    </ScrollView>
  );
};

// ─── Section Label ────────────────────────────────────────────────────────────
const SectionLabel = ({ label, theme }: { label: string; theme: ReturnType<typeof useAppTheme>['theme'] }): React.JSX.Element => (
  <View style={styles.sectionRow}>
    <AppText variant="label" style={[styles.sectionLabel, { color: theme.colors.text }]}>{label}</AppText>
    <View style={[styles.sectionLine, { backgroundColor: theme.colors.border }]} />
  </View>
);

// ─── Subscription Gate ────────────────────────────────────────────────────────
const SubscriptionGate = ({ onBack }: { onBack: () => void }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const navigation = useNavigation<Nav>();
  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[styles.typeContent, { alignItems: 'center', justifyContent: 'center', flexGrow: 1 }]}
    >
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <AppText style={{ fontSize: 56, marginBottom: 16 }}>🔐</AppText>
        <AppText variant="title" style={{ textAlign: 'center', color: theme.colors.text, marginBottom: 8 }}>
          Subscription Required
        </AppText>
        <AppText variant="body" color={theme.colors.mutedText} style={{ textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
          You need an active subscription to post job requirements and access worker profiles.
          Subscribe to unlock the full BookMyWorker experience.
        </AppText>

        <View style={{ width: '100%', backgroundColor: theme.colors.card, borderRadius: 16, padding: 18, marginBottom: 24, gap: 10, borderWidth: 1, borderColor: theme.colors.border }}>
          {[
            '✅ Post unlimited job requirements',
            '✅ Access worker contact details',
            '✅ View interested applicants',
            '✅ Priority listing & support',
          ].map((benefit) => (
            <AppText key={benefit} variant="body" color={theme.colors.text} style={{ fontWeight: '600' }}>{benefit}</AppText>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('Subscription')}
          style={{ backgroundColor: '#2563eb', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginBottom: 12 }}
        >
          <AppText style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>View Plans & Subscribe</AppText>
        </TouchableOpacity>

        <TouchableOpacity onPress={onBack}>
          <AppText variant="body" color={theme.colors.mutedText}>Maybe later</AppText>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// ─── Main Export ──────────────────────────────────────────────────────────────
export const PostRequirementScreen = (): React.JSX.Element => {
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

  const title = reqType ? 'Post Requirement' : 'Select Type';

  if (isEmployer && !isSubscribed) {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
        <ScreenHeader title="Post Requirement" onBack={goBack} />
        <SubscriptionGate onBack={goBack} />
      </View>
    );
  }

  if (!reqType) {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
        <ScreenHeader title="Post Requirement" onBack={goBack} />
        <TypeSelectionStep
          onSelect={(type) => setReqType(type)}
          onBack={goBack}
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
  heroTitle:  { fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 8, letterSpacing: -0.5 },
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
  tagPill: { alignSelf: 'flex-start', borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  tagTxt:  { fontSize: 11, fontWeight: '700' },
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
  typeBanner:       { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 14 },
  typeBannerIcon:   { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  typeBannerLabel:  { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  typeBannerDesc:   { fontSize: 11.5, fontWeight: '500', marginTop: 2 },

  // Section card
  section:          { borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: 'hidden', elevation: 1, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  sectionHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionIconBox:   { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sectionIcon:      { fontSize: 16, lineHeight: 20 },
  sectionTitle:     { fontSize: 14, fontWeight: '800', flex: 1, letterSpacing: -0.1 },
  sectionSub:       { fontSize: 12, fontWeight: '500' },
  sectionBody:      { padding: 14, gap: 0 },

  // Required / Optional tags
  requiredDot:      { backgroundColor: '#FEF2F2', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: '#FECACA' },
  requiredTxt:      { fontSize: 9.5, fontWeight: '700', color: '#DC2626', letterSpacing: 0.3 },
  optionalTag:      { fontSize: 11, fontWeight: '500' },

  // Map / GPS picker button (inside section body)
  mapBtn:           { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 10, marginTop: 2 },
  mapBtnLabel:      { fontSize: 13, fontWeight: '700' },
  mapBtnSub:        { fontSize: 11, fontWeight: '400', marginTop: 2 },
  mapBtnArrow:      { fontSize: 22, lineHeight: 26 },

  // Field sub-label inside a section
  fieldLabel:       { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
});
