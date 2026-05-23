import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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

const TypeSelectionStep = ({ onSelect, onBack }: TypeSelectionProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const canGoBack = true;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.typeContent}
      showsVerticalScrollIndicator={false}
    >
      {canGoBack && (
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <AppText variant="body" color={theme.colors.primary}>← Back</AppText>
        </TouchableOpacity>
      )}

      {/* Hero */}
      <View style={styles.typeHero}>
        <AppText style={[styles.typeHeroIcon]}>📣</AppText>
        <AppText variant="title" style={styles.typeHeroTitle}>Post a Requirement</AppText>
        <AppText variant="body" color={theme.colors.mutedText} style={styles.typeHeroSub}>
          What type of workers are you looking for?
        </AppText>
      </View>

      {/* Type cards */}
      <View style={styles.typeGrid}>
        {REQ_TYPES.map((rt) => (
          <TouchableOpacity
            key={rt.value}
            onPress={() => onSelect(rt.value)}
            activeOpacity={0.82}
            style={[styles.typeCard, { backgroundColor: theme.colors.card, borderColor: rt.color + '55' }]}
          >
            <View style={[styles.typeIconWrap, { backgroundColor: rt.color + '18' }]}>
              <AppText style={styles.typeIcon}>{rt.icon}</AppText>
            </View>
            <View style={styles.typeCardBody}>
              <AppText variant="label" color={theme.colors.text} style={styles.typeCardTitle}>{rt.label}</AppText>
              <AppText variant="caption" color={theme.colors.mutedText} style={styles.typeCardDesc} numberOfLines={2}>
                {rt.description}
              </AppText>
            </View>
            <AppText style={[styles.typeArrow, { color: rt.color }]}>›</AppText>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};


// ─── Step 2: Requirement Form ──────────────────────────────────────────────────
interface FormStepProps {
  reqType: RequirementType;
  onBack: () => void;
}

const RequirementFormStep = ({ reqType, onBack }: FormStepProps): React.JSX.Element => {
  const { theme } = useAppTheme();
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
    accommodationAvailable: false,
    foodAvailable: false,
    transportProvided: false,
    weeklyOff: false,
    overtimeAvailable: false,
    bonus: false,
    incentive: false,
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
      {/* Back + type badge */}
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <AppText variant="body" color={theme.colors.primary}>← Change Type</AppText>
      </TouchableOpacity>

      {/* Type badge header */}
      <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + '18', borderColor: typeInfo.color + '44' }]}>
        <AppText style={styles.typeBadgeIcon}>{typeInfo.icon}</AppText>
        <View>
          <AppText variant="label" color={typeInfo.color}>{typeInfo.label}</AppText>
          <AppText variant="caption" color={theme.colors.mutedText}>{typeInfo.description}</AppText>
        </View>
      </View>

      <AppText variant="title" style={styles.formTitle}>Post Requirement</AppText>

      {/* WORK TYPE */}
      <SectionLabel label="Work Type" theme={theme} />
      <CategorySelector
        category={workTypeVal}
        subCategory={subCategoryVal}
        onCategoryChange={(v) => { setValue('workType', v, { shouldValidate: true }); setValue('subCategory', '', { shouldValidate: true }); }}
        onSubCategoryChange={(v) => setValue('subCategory', v, { shouldValidate: true })}
        categoryError={errors.workType?.message}
        subCategoryError={errors.subCategory?.message}
        required
      />

      {/* WORKER DETAILS */}
      <SectionLabel label="Worker Details" theme={theme} />
      <AppCard style={styles.card}>
        <FormInput
          control={control}
          name="workerQuantitySkilled"
          label="Skilled Workers Needed *"
          placeholder="e.g. 5"
          keyboardType="number-pad"
        />
        <FormInput
          control={control}
          name="workerQuantityUnskilled"
          label="Helper / Unskilled Workers"
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
      </AppCard>

      {/* LOCATION */}
      <SectionLabel label="Location" theme={theme} />
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
        label="PIN Code"
        placeholder="6-digit area PIN code"
        keyboardType="number-pad"
        maxLength={6}
      />

      {/* Location Picker */}
      <TouchableOpacity
        onPress={() => setShowLocationPicker(true)}
        activeOpacity={0.8}
        style={[locBtnStyles.btn, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '0E' }]}
      >
        <AppText style={locBtnStyles.icon}>🗺</AppText>
        <View style={locBtnStyles.body}>
          <AppText style={[locBtnStyles.label, { color: theme.colors.primary }]}>Pick Work Location</AppText>
          <AppText variant="caption" color={theme.colors.mutedText}>
            {watch('workLocation') || 'Search or use GPS to set location'}
          </AppText>
        </View>
        <AppText style={[locBtnStyles.arrow, { color: theme.colors.primary }]}>›</AppText>
      </TouchableOpacity>

      <FormInput
        control={control}
        name="workLocation"
        label="Exact Work Location / Address"
        placeholder="e.g. Near NH44, Village Rampur (auto-filled from picker)"
      />

      <LocationPickerModal
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        title="Pick Work Location"
        onPick={(loc: PickedLocation) => {
          setValue('workLocation', loc.address, { shouldValidate: true });
          setCoords({ lat: loc.lat, lng: loc.lng });
          // auto-fill state/district/pin if they are currently empty
          if (loc.state && !watch('state')) {
            setValue('state', loc.state, { shouldValidate: true });
          }
          if (loc.district && !watch('district')) {
            setValue('district', loc.district, { shouldValidate: true });
          }
          if (loc.pinCode && !watch('pinCode')) {
            setValue('pinCode', loc.pinCode);
          }
        }}
      />

      {/* SCHEDULE */}
      <SectionLabel label="Schedule & Duration" theme={theme} />
      <AppCard style={styles.card}>
        <FormInput
          control={control}
          name="workerNeedDate"
          label="Worker Need Date *"
          placeholder="DD/MM/YYYY"
          keyboardType="numbers-and-punctuation"
        />
        {isDailyWages && (
          <View style={styles.row}>
            <View style={styles.rowHalf}>
              <FormInput
                control={control}
                name="inTime"
                label="Start Time"
                placeholder="08:00 AM"
              />
            </View>
            <View style={styles.rowHalf}>
              <FormInput
                control={control}
                name="outTime"
                label="End Time"
                placeholder="06:00 PM"
              />
            </View>
          </View>
        )}
        <Controller
          control={control}
          name="estimated_days"
          render={({ field }) => (
            <FormSelect
              label="Estimated Duration"
              value={field.value ?? ''}
              options={ESTIMATED_DAYS_OPTIONS}
              onChange={field.onChange}
            />
          )}
        />
      </AppCard>

      {/* SALARY TYPE */}
      <SectionLabel label="Payment Type" theme={theme} />
      <AppCard style={styles.card}>
        <Controller
          control={control}
          name="salaryType"
          render={({ field: { value, onChange } }) => (
            <View style={styles.salaryTypeRow}>
              {(['Daily', 'Weekly', 'Monthly'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => onChange(type)}
                  activeOpacity={0.8}
                  style={[
                    styles.salaryTypeChip,
                    {
                      backgroundColor: value === type ? theme.colors.primary : theme.colors.surface,
                      borderColor: value === type ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <AppText
                    style={[
                      styles.salaryTypeChipTxt,
                      { color: value === type ? '#fff' : theme.colors.mutedText },
                    ]}
                  >
                    {type === 'Daily' ? '📅 Daily' : type === 'Weekly' ? '📆 Weekly' : '🗓 Monthly'}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
      </AppCard>

      {/* BUDGET */}
      <SectionLabel label={`Budget (₹ per worker / ${watch('salaryType')?.toLowerCase() ?? 'day'})`} theme={theme} />
      <AppCard style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowHalf}>
            <FormInput
              control={control}
              name="minBudgetPerWorker"
              label="Min Amount *"
              placeholder={watch('salaryType') === 'Monthly' ? '8000' : watch('salaryType') === 'Weekly' ? '2000' : '400'}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.rowHalf}>
            <FormInput
              control={control}
              name="maxBudgetPerWorker"
              label="Max Amount *"
              placeholder={watch('salaryType') === 'Monthly' ? '15000' : watch('salaryType') === 'Weekly' ? '4000' : '700'}
              keyboardType="numeric"
            />
          </View>
        </View>
      </AppCard>

      {/* PERKS */}
      <SectionLabel label="Perks & Benefits" theme={theme} />
      <View style={styles.flagsGrid}>
        {BOOLEAN_FLAGS.map((flag) => (
          <TouchableOpacity
            key={flag.key}
            onPress={() => toggleFlag(flag.key)}
            activeOpacity={0.8}
            style={[
              styles.flagChip,
              {
                backgroundColor: boolFlags[flag.key] ? theme.colors.primary + '15' : theme.colors.card,
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

      {/* DESCRIPTION */}
      <SectionLabel label="Work Description" theme={theme} />
      <FormInput
        control={control}
        name="remarks"
        label="Describe the work, site conditions, requirements *"
        placeholder="e.g. Brick laying work for construction site. Workers should bring their own tools..."
        multiline
        numberOfLines={4}
        style={styles.textarea}
      />

      <AppButton
        title={mutation.isPending ? 'Publishing…' : 'Publish Requirement'}
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
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <AppText variant="body" color={theme.colors.primary}>← Back</AppText>
      </TouchableOpacity>

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
  const { state: authState } = useAuth();
  const user = authState.session?.user;
  const [reqType, setReqType] = useState<RequirementType | null>(null);

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
      />
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  // Type selection
  typeContent: { padding: 20, paddingBottom: 40 },
  typeHero: { alignItems: 'center', marginBottom: 28, marginTop: 8 },
  typeHeroIcon: { fontSize: 48, marginBottom: 10 },
  typeHeroTitle: { textAlign: 'center', marginBottom: 6 },
  typeHeroSub: { textAlign: 'center' },
  typeGrid: { gap: 12 },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  typeIconWrap: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  typeIcon: { fontSize: 26 },
  typeCardBody: { flex: 1, gap: 3 },
  typeCardTitle: { fontSize: 15 },
  typeCardDesc: { lineHeight: 17 },
  typeArrow: { fontSize: 26, lineHeight: 30 },
  // Form
  content: { padding: 16, paddingBottom: 48 },
  backBtn: { marginBottom: 12 },
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
