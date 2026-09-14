import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { FormInput } from '../../../shared/components/forms/FormInput';
import { FormSelect } from '../../../shared/components/forms/FormSelect';
import { FormDatePicker } from '../../../shared/components/forms/FormDateTimePicker';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { useAppTheme } from '../../../core/theme';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { clientCompaniesApi } from '../../../core/api/endpoints/clientCompaniesApi';
import { sitesApi, type Site } from '../../../core/api/endpoints/sitesApi';
import { workforceMasterApi } from '../../../core/api/endpoints/workforceMasterApi';
import { workforceRequirementsApi, type DurationType, type Urgency } from '../../../core/api/endpoints/workforceRequirementsApi';
import { AddSiteSheet } from './AddSiteSheet';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'NewWorkforceRequirement'>;

const BRAND = '#1037A4';

const requirementSchema = z
  .object({
    siteId: z.string().min(1, 'Please select a site'),
    workTypeId: z.string().min(1, 'Please select a work type'),
    subWorkTypeId: z.string().optional(),
    numberOfWorkers: z.string().regex(/^[1-9]\d*$/, 'Enter a valid number'),
    shiftTiming: z.string().optional(),
    urgency: z.enum(['Standard', 'Urgent']),
    durationType: z.enum(['Ongoing', 'FixedTerm']),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    budgetNote: z.string().optional(),
    specialInstructions: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.durationType === 'FixedTerm' && !val.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endDate'],
        message: 'End date is required for a fixed-term requirement',
      });
    }
  });

type FormValues = z.infer<typeof requirementSchema>;

// FormDatePicker works in "DD/MM/YYYY" — the backend needs "YYYY-MM-DD".
const toIsoDate = (v: string): string | undefined => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
};

export const NewWorkforceRequirementScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const toast = useToast();
  const queryClient = useQueryClient();

  const [addSiteVisible, setAddSiteVisible] = useState(false);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);

  const companyQuery = useQuery({
    queryKey: ['wf-my-company'],
    queryFn: () => clientCompaniesApi.getMyCompany(),
    staleTime: 60_000,
  });

  const sitesQuery = useQuery({
    queryKey: ['wf-my-sites'],
    queryFn: () => sitesApi.getMySites(),
    staleTime: 30_000,
  });

  const workTypesQuery = useQuery({
    queryKey: ['wf-work-types'],
    queryFn: () => workforceMasterApi.getWorkTypes(),
    staleTime: 5 * 60_000,
  });

  const skillTagsQuery = useQuery({
    queryKey: ['wf-skill-tags'],
    queryFn: () => workforceMasterApi.getSkillTags(),
    staleTime: 5 * 60_000,
  });

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(requirementSchema),
    defaultValues: {
      siteId: '',
      workTypeId: '',
      subWorkTypeId: '',
      numberOfWorkers: '1',
      shiftTiming: '',
      urgency: 'Standard',
      durationType: 'Ongoing',
      startDate: '',
      endDate: '',
      budgetNote: '',
      specialInstructions: '',
    },
  });

  const siteId = watch('siteId');
  const workTypeId = watch('workTypeId');
  const subWorkTypeId = watch('subWorkTypeId');
  const durationType = watch('durationType');

  const subWorkTypesQuery = useQuery({
    queryKey: ['wf-sub-work-types', workTypeId],
    queryFn: () => workforceMasterApi.getSubWorkTypes(workTypeId),
    enabled: !!workTypeId,
    staleTime: 5 * 60_000,
  });

  const sites = sitesQuery.data ?? [];
  const workTypes = workTypesQuery.data ?? [];
  const subWorkTypes = subWorkTypesQuery.data ?? [];
  const skillTags = skillTagsQuery.data ?? [];

  const accountManagerName = companyQuery.data?.accountOwnerName;
  const accountManagerPhone = companyQuery.data?.accountOwnerPhone;

  const onWorkTypeChange = (v: string): void => {
    setValue('workTypeId', v, { shouldValidate: true });
    setValue('subWorkTypeId', '', { shouldValidate: false });
  };

  const onSiteCreated = (site: Site): void => {
    setValue('siteId', site._id, { shouldValidate: true });
    setAddSiteVisible(false);
  };

  const toggleSkill = (id: string): void => {
    setSelectedSkillIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      workforceRequirementsApi.create({
        siteId: values.siteId,
        workTypeId: values.workTypeId,
        subWorkTypeId: values.subWorkTypeId || undefined,
        skillsRequired: selectedSkillIds.length > 0 ? selectedSkillIds : undefined,
        numberOfWorkers: Number(values.numberOfWorkers),
        shiftTiming: values.shiftTiming || undefined,
        durationType: values.durationType,
        startDate: values.startDate ? toIsoDate(values.startDate) : undefined,
        endDate: values.durationType === 'FixedTerm' && values.endDate ? toIsoDate(values.endDate) : undefined,
        urgency: values.urgency,
        budgetNote: values.budgetNote || undefined,
        specialInstructions: values.specialInstructions || undefined,
      }),
    onSuccess: (requirement) => {
      void queryClient.invalidateQueries({ queryKey: ['wf-requirements-mine'] });
      toast.success(t('wf_submit_success_body', { pwrNumber: requirement.pwrNumber }));
      navigation.replace('WorkforceRequirementDetail', { id: requirement._id });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : t('wf_submit_fail_body'));
    },
  });

  const onSubmit = handleSubmit((values) => mutation.mutate(values));

  const loadingOptions = sitesQuery.isLoading || workTypesQuery.isLoading || skillTagsQuery.isLoading;
  const noSites = !sitesQuery.isLoading && sites.length === 0;
  const noWorkTypes = !workTypesQuery.isLoading && workTypes.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader title={t('wf_new_requirement_title')} onBack={() => navigation.goBack()} />

      {loadingOptions ? (
        <LoadingState message={t('wf_new_requirement_title')} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Site ── */}
          <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <AppText variant="label" style={styles.sectionTitle}>{t('wf_section_site')}</AppText>
            {noSites ? (
              <AppText variant="caption" color={theme.colors.danger} style={styles.warningTxt}>
                {t('wf_no_sites_warning')}
              </AppText>
            ) : (
              <FormSelect
                label={t('wf_site_label')}
                value={siteId}
                options={sites.map((s) => s._id)}
                onChange={(v) => setValue('siteId', v, { shouldValidate: true })}
                renderLabel={(id) => sites.find((s) => s._id === id)?.siteName ?? id}
                errorText={errors.siteId?.message}
              />
            )}
            <TouchableOpacity onPress={() => setAddSiteVisible(true)} activeOpacity={0.8} style={styles.addSiteBtn}>
              <AppText variant="label" color={theme.colors.primary}>{`+ ${t('wf_add_site_cta')}`}</AppText>
            </TouchableOpacity>
            {accountManagerName ? (
              <AppText variant="caption" color={theme.colors.mutedText} style={styles.amHint}>
                {accountManagerPhone
                  ? t('wf_account_manager_hint_with_phone', { name: accountManagerName, phone: accountManagerPhone })
                  : t('wf_account_manager_hint_no_phone', { name: accountManagerName })}
              </AppText>
            ) : null}
          </View>

          {/* ── Work Details ── */}
          <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <AppText variant="label" style={styles.sectionTitle}>{t('wf_section_work_details')}</AppText>
            {noWorkTypes ? (
              <AppText variant="caption" color={theme.colors.danger} style={styles.warningTxt}>
                {t('wf_no_work_types_warning')}
              </AppText>
            ) : (
              <FormSelect
                label={t('wf_work_type_label')}
                value={workTypeId}
                options={workTypes.map((w) => w._id)}
                onChange={onWorkTypeChange}
                renderLabel={(id) => workTypes.find((w) => w._id === id)?.name ?? id}
                errorText={errors.workTypeId?.message}
              />
            )}
            {workTypeId ? (
              <FormSelect
                label={t('wf_sub_work_type_label')}
                value={subWorkTypeId ?? ''}
                options={['', ...subWorkTypes.map((s) => s._id)]}
                onChange={(v) => setValue('subWorkTypeId', v, { shouldValidate: false })}
                renderLabel={(id) => (id ? subWorkTypes.find((s) => s._id === id)?.name ?? id : t('wf_sub_work_type_none'))}
              />
            ) : null}
            {skillTags.length > 0 ? (
              <View style={styles.skillsBlock}>
                <AppText variant="caption" color={theme.colors.mutedText} style={styles.skillsLabel}>
                  {t('wf_skills_label')}
                </AppText>
                <View style={styles.skillsWrap}>
                  {skillTags.map((tag) => {
                    const active = selectedSkillIds.includes(tag._id);
                    return (
                      <TouchableOpacity
                        key={tag._id}
                        onPress={() => toggleSkill(tag._id)}
                        activeOpacity={0.8}
                        style={[
                          styles.skillChip,
                          {
                            backgroundColor: active ? theme.colors.primary + '15' : theme.colors.surface1,
                            borderColor: active ? theme.colors.primary : theme.colors.border,
                          },
                        ]}
                      >
                        <AppText variant="caption" color={active ? theme.colors.primary : theme.colors.text}>
                          {tag.name}
                        </AppText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <FormInput
              control={control}
              name="numberOfWorkers"
              label={t('wf_number_of_workers_label')}
              keyboardType="number-pad"
            />
            <FormInput
              control={control}
              name="shiftTiming"
              label={t('wf_shift_timing_label')}
              placeholder={t('wf_shift_timing_placeholder')}
            />
            <Controller
              control={control}
              name="urgency"
              render={({ field }) => (
                <FormSelect
                  label={t('wf_urgency_label')}
                  value={field.value}
                  options={['Standard', 'Urgent']}
                  onChange={(v) => field.onChange(v as Urgency)}
                  renderLabel={(v) => (v === 'Urgent' ? t('wf_urgency_urgent') : t('wf_urgency_standard'))}
                />
              )}
            />
            <Controller
              control={control}
              name="durationType"
              render={({ field }) => (
                <FormSelect
                  label={t('wf_duration_label')}
                  value={field.value}
                  options={['Ongoing', 'FixedTerm']}
                  onChange={(v) => field.onChange(v as DurationType)}
                  renderLabel={(v) => (v === 'FixedTerm' ? t('wf_duration_fixedterm') : t('wf_duration_ongoing'))}
                />
              )}
            />
            <Controller
              control={control}
              name="startDate"
              render={({ field }) => (
                <FormDatePicker
                  label={t('wf_start_date_label')}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
            />
            {durationType === 'FixedTerm' ? (
              <Controller
                control={control}
                name="endDate"
                render={({ field, fieldState }) => (
                  <FormDatePicker
                    label={t('wf_end_date_label')}
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    errorText={fieldState.error?.message}
                  />
                )}
              />
            ) : null}
          </View>

          {/* ── Additional Info ── */}
          <View style={[styles.section, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <AppText variant="label" style={styles.sectionTitle}>{t('wf_section_additional_info')}</AppText>
            <FormInput
              control={control}
              name="budgetNote"
              label={t('wf_budget_note_label')}
            />
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.helperTxt}>
              {t('wf_budget_note_helper')}
            </AppText>
            <FormInput
              control={control}
              name="specialInstructions"
              label={t('wf_special_instructions_label')}
              placeholder={t('wf_special_instructions_placeholder')}
              multiline
              numberOfLines={3}
            />
          </View>

          <AppButton
            title={mutation.isPending ? t('wf_submitting') : t('wf_submit_requirement_cta')}
            onPress={onSubmit}
            loading={mutation.isPending}
            disabled={mutation.isPending || noSites || noWorkTypes}
            fullWidth
            style={styles.submitBtn}
          />
        </ScrollView>
      )}

      <AddSiteSheet visible={addSiteVisible} onClose={() => setAddSiteVisible(false)} onCreated={onSiteCreated} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  section: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  sectionTitle: { marginBottom: 12 },
  warningTxt: { marginBottom: 8, lineHeight: 18 },
  addSiteBtn: { alignSelf: 'flex-start', marginTop: 2, marginBottom: 4 },
  amHint: { marginTop: 10, lineHeight: 17 },
  helperTxt: { marginTop: -10, marginBottom: 14, lineHeight: 16 },
  skillsBlock: { marginBottom: 14 },
  skillsLabel: { marginBottom: 8, fontWeight: '600' },
  skillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  submitBtn: { marginTop: 4 },
});
