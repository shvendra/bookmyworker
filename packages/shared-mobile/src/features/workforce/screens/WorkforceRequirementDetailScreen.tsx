import React from 'react';
import { ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { Badge, type BadgeVariant } from '../../../shared/components/ui/Badge';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { useAppTheme } from '../../../core/theme';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { showAlert } from '../../../shared/state/alert/AppAlertContext';
import {
  workforceRequirementsApi,
  type RequirementStatus,
  type PayModel,
} from '../../../core/api/endpoints/workforceRequirementsApi';
import { DeploymentsSection } from '../components/DeploymentsSection';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'WorkforceRequirementDetail'>;

const BRAND = '#1037A4';

const STATUS_BADGE_VARIANT: Record<RequirementStatus, BadgeVariant> = {
  Submitted: 'secondary',
  UnderReview: 'warning',
  Approved: 'success',
  Rejected: 'danger',
  PartiallyFulfilled: 'info',
  Fulfilled: 'success',
  Closed: 'neutral',
  Cancelled: 'neutral',
};

const STATUS_LABEL_KEY: Record<RequirementStatus, string> = {
  Submitted: 'wf_status_submitted',
  UnderReview: 'wf_status_underreview',
  Approved: 'wf_status_approved',
  Rejected: 'wf_status_rejected',
  PartiallyFulfilled: 'wf_status_partiallyfulfilled',
  Fulfilled: 'wf_status_fulfilled',
  Closed: 'wf_status_closed',
  Cancelled: 'wf_status_cancelled',
};

const PAY_MODEL_KEY: Record<PayModel, string> = {
  Monthly: 'wf_pay_model_monthly',
  Daily: 'wf_pay_model_daily',
  Hourly: 'wf_pay_model_hourly',
};

// Requirement refs come back populated (object) for the owning Employer, but
// fall back to a bare id string in some contexts — read defensively either way.
const refLabel = (ref: unknown, keys: string[] = ['name']): string | undefined => {
  if (ref && typeof ref === 'object') {
    for (const k of keys) {
      const v = (ref as Record<string, unknown>)[k];
      if (typeof v === 'string' && v) return v;
    }
  }
  return undefined;
};

const formatDate = (d?: string): string => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
};

interface FieldProps {
  label: string;
  value?: string;
  mutedColor: string;
  textColor: string;
}

const Field = ({ label, value, mutedColor, textColor }: FieldProps): React.JSX.Element => (
  <View style={styles.field}>
    <AppText variant="micro" color={mutedColor} style={styles.fieldLabel}>
      {label.toUpperCase()}
    </AppText>
    <AppText variant="bodyMd" color={textColor}>
      {value || '—'}
    </AppText>
  </View>
);

export const WorkforceRequirementDetailScreen = ({ route, navigation }: Props): React.JSX.Element => {
  const { id } = route.params;
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: req, isLoading, isError, refetch } = useQuery({
    queryKey: ['wf-requirement', id],
    queryFn: () => workforceRequirementsApi.getById(id),
  });

  const cancelMutation = useMutation({
    mutationFn: () => workforceRequirementsApi.updateStatus(id, 'Cancelled'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wf-requirement', id] });
      void queryClient.invalidateQueries({ queryKey: ['wf-requirements-mine'] });
      toast.success(t('wf_cancel_success_toast'));
    },
    onError: (err: unknown) => {
      // CRITICAL: surface the backend's exact message verbatim — e.g. the
      // outstanding-balance block — never a generic "failed to cancel" string.
      const message = err instanceof Error && err.message ? err.message : t('wf_cancel_fail_generic');
      toast.error(message);
    },
  });

  const handleCancelPress = (): void => {
    if (!req) return;
    showAlert(t('wf_cancel_confirm_title'), t('wf_cancel_confirm_body', { pwrNumber: req.pwrNumber }), [
      { text: t('wf_keep_requirement_cta'), style: 'cancel' },
      { text: t('wf_cancel_requirement_cta'), style: 'destructive', onPress: () => cancelMutation.mutate() },
    ]);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />
        <ScreenHeader title={t('wf_requirement_details_title')} onBack={() => navigation.goBack()} />
        <LoadingState message={t('wf_loading_requirement')} />
      </View>
    );
  }

  if (isError || !req) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />
        <ScreenHeader title={t('wf_requirement_details_title')} onBack={() => navigation.goBack()} />
        <ErrorState title={t('wf_load_failed_title')} description={t('wf_load_failed_body')} onRetry={() => void refetch()} />
      </View>
    );
  }

  const canCancel = req.status === 'Submitted' || req.status === 'UnderReview';
  const siteName = refLabel(req.siteId, ['siteName']);
  const workTypeName = refLabel(req.workTypeId, ['name']);
  const subWorkTypeName = refLabel(req.subWorkTypeId, ['name']);
  const skillNames = (req.skillsRequired ?? [])
    .map((s) => refLabel(s, ['name']))
    .filter((n): n is string => !!n)
    .join(', ');
  const amName = refLabel(req.assignedAccountManagerId, ['name']);
  const amPhone = refLabel(req.assignedAccountManagerId, ['phone']);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader title={req.pwrNumber} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.badgeRow}>
          <Badge label={t(STATUS_LABEL_KEY[req.status] ?? 'wf_status_submitted')} variant={STATUS_BADGE_VARIANT[req.status] ?? 'neutral'} />
          {req.urgency === 'Urgent' ? <Badge label={t('wf_urgency_urgent')} variant="danger" outlined /> : null}
        </View>

        {req.status === 'Rejected' && req.rejectionReason ? (
          <AppCard style={[styles.noticeCard, { backgroundColor: theme.colors.dangerLight }]}>
            <AppText variant="labelSm" color={theme.colors.danger} style={styles.noticeLabel}>
              {t('wf_rejection_reason_label')}
            </AppText>
            <AppText variant="body" color={theme.colors.text}>{req.rejectionReason}</AppText>
          </AppCard>
        ) : null}

        {req.status === 'Approved' && req.agreedBillingRate ? (
          <AppCard style={[styles.noticeCard, { backgroundColor: theme.colors.successLight }]}>
            <AppText variant="labelSm" color={theme.colors.success} style={styles.noticeLabel}>
              {t('wf_agreed_billing_rate_label')}
            </AppText>
            <AppText variant="subtitle" color={theme.colors.success}>
              {`₹${req.agreedBillingRate}${req.agreedBillingPayModel ? t(PAY_MODEL_KEY[req.agreedBillingPayModel]) : ''}`}
            </AppText>
          </AppCard>
        ) : null}

        <AppCard style={styles.detailsCard}>
          {siteName ? <Field label={t('wf_field_site')} value={siteName} mutedColor={theme.colors.mutedText} textColor={theme.colors.text} /> : null}
          <Field label={t('wf_field_pwr_number')} value={req.pwrNumber} mutedColor={theme.colors.mutedText} textColor={theme.colors.text} />
          <Field label={t('wf_field_work_type')} value={workTypeName} mutedColor={theme.colors.mutedText} textColor={theme.colors.text} />
          {subWorkTypeName ? (
            <Field label={t('wf_field_sub_work_type')} value={subWorkTypeName} mutedColor={theme.colors.mutedText} textColor={theme.colors.text} />
          ) : null}
          <Field
            label={t('wf_field_number_of_workers')}
            value={String(req.numberOfWorkers)}
            mutedColor={theme.colors.mutedText}
            textColor={theme.colors.text}
          />
          {req.shiftTiming ? (
            <Field label={t('wf_field_shift_timing')} value={req.shiftTiming} mutedColor={theme.colors.mutedText} textColor={theme.colors.text} />
          ) : null}
          <Field
            label={t('wf_field_duration')}
            value={
              req.durationType === 'FixedTerm'
                ? t('wf_duration_fixedterm_range', { start: formatDate(req.startDate), end: formatDate(req.endDate) })
                : t('wf_duration_ongoing')
            }
            mutedColor={theme.colors.mutedText}
            textColor={theme.colors.text}
          />
          {skillNames ? (
            <Field label={t('wf_field_skills_required')} value={skillNames} mutedColor={theme.colors.mutedText} textColor={theme.colors.text} />
          ) : null}
          {req.budgetNote ? (
            <Field label={t('wf_field_budget_note')} value={req.budgetNote} mutedColor={theme.colors.mutedText} textColor={theme.colors.text} />
          ) : null}
          {req.specialInstructions ? (
            <Field
              label={t('wf_field_special_instructions')}
              value={req.specialInstructions}
              mutedColor={theme.colors.mutedText}
              textColor={theme.colors.text}
            />
          ) : null}
          {amName ? (
            <Field
              label={t('wf_field_account_manager')}
              value={amPhone ? `${amName} · ${amPhone}` : amName}
              mutedColor={theme.colors.mutedText}
              textColor={theme.colors.text}
            />
          ) : null}
        </AppCard>

        <DeploymentsSection requirementId={id} />

        {canCancel ? (
          <AppButton
            title={t('wf_cancel_requirement_cta')}
            onPress={handleCancelPress}
            variant="danger"
            loading={cancelMutation.isPending}
            disabled={cancelMutation.isPending}
            fullWidth
            style={styles.cancelBtn}
          />
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  noticeCard: { marginBottom: 14 },
  noticeLabel: { marginBottom: 4 },
  detailsCard: { marginBottom: 16 },
  field: { marginBottom: 14 },
  fieldLabel: { marginBottom: 3, letterSpacing: 0.4 },
  cancelBtn: { marginTop: 4 },
});
