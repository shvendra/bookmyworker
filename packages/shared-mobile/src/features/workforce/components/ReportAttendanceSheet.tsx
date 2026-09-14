import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppSheet } from '../../../shared/components/ui/AppSheet';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppInput } from '../../../shared/components/ui/AppInput';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { useAppTheme } from '../../../core/theme';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { deploymentAttendanceApi, type SubmitAttendanceSummaryPayload } from '../../../core/api/endpoints/deploymentAttendanceApi';
import type { Deployment } from '../../../core/api/endpoints/deploymentsApi';

interface Props {
  visible: boolean;
  deployment: Deployment | null;
  onClose: () => void;
}

// Built as plain zero-padded strings, never via `new Date(...).toISOString()`
// — matches the CRM's AttendanceDialog.jsx month-value convention exactly, so
// the same 'YYYY-MM' string round-trips identically through getCycle/submitSummary.
const currentMonthValue = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const parseMonth = (month: string): { year: number; monthNum: number } => {
  const parts = month.split('-').map(Number);
  return { year: parts[0] ?? 0, monthNum: parts[1] ?? 1 };
};

const shiftMonth = (month: string, delta: number): string => {
  const { year, monthNum } = parseMonth(month);
  const d = new Date(year, monthNum - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Employer's Report Attendance sheet — ports AttendanceDialog.jsx's
 * mode="employer" subset (Summary tab only, no Daily tab, no lock/unlock, no
 * correction-approval — those stay CRM-only, mirroring the exact scope
 * restriction already enforced there and server-side).
 *
 * Opened from DeploymentsSection's "Report Attendance" button for a
 * Deployed/Active/Inactive deployment.
 */
export const ReportAttendanceSheet = ({ visible, deployment, onClose }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const toast = useToast();
  const queryClient = useQueryClient();

  const [month, setMonth] = useState(currentMonthValue());
  const [daysPresent, setDaysPresent] = useState('');
  const [overtimeHours, setOvertimeHours] = useState('');
  const [reportedBy, setReportedBy] = useState('');
  const [remarks, setRemarks] = useState('');
  const [daysPresentError, setDaysPresentError] = useState<string | undefined>(undefined);

  const deploymentId = deployment?._id;
  const clientCompanyId = deployment?.clientCompanyId;

  // Reset to the current month (and clear any stale form state) every time the
  // sheet is opened for a (possibly different) deployment.
  useEffect(() => {
    if (visible) {
      setMonth(currentMonthValue());
      setDaysPresentError(undefined);
    }
  }, [visible, deploymentId]);

  const cycleQuery = useQuery({
    queryKey: ['wf-attendance-cycle', clientCompanyId, month],
    queryFn: () => deploymentAttendanceApi.getCycle(clientCompanyId as string, month),
    enabled: visible && !!clientCompanyId,
  });

  const cycleId = cycleQuery.data?._id;

  const recordsQuery = useQuery({
    queryKey: ['wf-attendance-records', deploymentId, cycleId],
    queryFn: () => deploymentAttendanceApi.list(deploymentId as string, cycleId),
    enabled: visible && !!deploymentId && !!cycleId,
  });

  // Pre-fill from the existing Summary entry for this deployment+cycle, if any
  // — this is an update-in-place, not always a fresh entry (mirrors
  // AttendanceDialog.jsx's fetchAll -> setSummaryForm seeding).
  const existingSummary = (recordsQuery.data ?? []).find((r) => r.entryMode === 'Summary' && !r.correctionOf);

  useEffect(() => {
    if (!visible) return;
    setDaysPresent(existingSummary?.daysPresent != null ? String(existingSummary.daysPresent) : '');
    setOvertimeHours(existingSummary?.overtimeHours ? String(existingSummary.overtimeHours) : '');
    setReportedBy(existingSummary?.reportedBy ?? '');
    setRemarks(existingSummary?.remarks ?? '');
    setDaysPresentError(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, existingSummary?._id, existingSummary?.daysPresent, existingSummary?.overtimeHours, existingSummary?.reportedBy, existingSummary?.remarks]);

  const isLoading = cycleQuery.isLoading || recordsQuery.isLoading;
  const isLoadFailed = cycleQuery.isError || recordsQuery.isError;

  const monthNamesRaw = t('calMonthNames', { returnObjects: true });
  const monthNames = Array.isArray(monthNamesRaw) && monthNamesRaw.length === 12 ? (monthNamesRaw as string[]) : [];
  const { year: yearPart, monthNum: monthPart } = parseMonth(month);
  const monthLabel = monthNames[monthPart - 1] ? `${monthNames[monthPart - 1]} ${yearPart}` : month;
  const atCurrentMonth = month === currentMonthValue();

  const submitMutation = useMutation({
    mutationFn: (payload: SubmitAttendanceSummaryPayload) => deploymentAttendanceApi.submitSummary(payload),
    onSuccess: (res) => {
      if (deploymentId) {
        void queryClient.invalidateQueries({ queryKey: ['wf-attendance-records', deploymentId] });
      }
      if (res.correction) {
        // Cycle was Locked and an entry already existed — this is a
        // pending-approval correction, NOT applied yet. Not a failure: show
        // the backend's own message, don't word it as an error.
        toast.info(res.message || t('wf_attendance_correction_pending_fallback'));
      } else {
        // Plain success ({ attendance }) — the backend never sends a message
        // for this branch, so this copy is always ours, not a "fallback".
        toast.success(t('wf_attendance_saved_toast'));
      }
      onClose();
    },
    onError: (err: unknown) => {
      // Real validation failure (e.g. days exceeding the deployment's
      // active-day count in this cycle) — surface the backend's exact
      // message verbatim, same discipline as Cancel-requirement. Sheet stays
      // open so the employer can correct the number.
      const message = err instanceof Error && err.message ? err.message : t('wf_attendance_save_failed_generic');
      toast.error(message);
    },
  });

  const handleSave = (): void => {
    if (!deployment) return;
    if (!daysPresent.trim()) {
      setDaysPresentError(t('wf_days_present_required_error'));
      return;
    }
    setDaysPresentError(undefined);
    submitMutation.mutate({
      deploymentId: deployment._id,
      month,
      daysPresent: Number(daysPresent),
      overtimeHours: overtimeHours.trim() ? Number(overtimeHours) : undefined,
      reportedBy: reportedBy.trim() || undefined,
      remarks: remarks.trim() || undefined,
    });
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={t('wf_report_attendance_sheet_title', { name: deployment?.workerName ?? '' })}
    >
      <View style={styles.monthRow}>
        <AppText variant="labelSm" color={theme.colors.textSecondary}>
          {t('wf_report_attendance_month_label')}
        </AppText>
        <View style={styles.monthStepper}>
          <Pressable
            onPress={() => setMonth((m) => shiftMonth(m, -1))}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.stepperBtn, { backgroundColor: theme.colors.surface2 }]}
          >
            <AppText variant="bodyMd" color={theme.colors.text}>‹</AppText>
          </Pressable>
          <AppText variant="bodyMd" color={theme.colors.text} style={styles.monthLabel}>
            {monthLabel}
          </AppText>
          <Pressable
            onPress={() => {
              if (!atCurrentMonth) setMonth((m) => shiftMonth(m, 1));
            }}
            disabled={atCurrentMonth}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.stepperBtn, { backgroundColor: theme.colors.surface2, opacity: atCurrentMonth ? 0.4 : 1 }]}
          >
            <AppText variant="bodyMd" color={theme.colors.text}>›</AppText>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : isLoadFailed ? (
        <AppText variant="body" color={theme.colors.danger} style={styles.loadFailedText}>
          {t('wf_attendance_load_failed')}
        </AppText>
      ) : (
        <>
          <AppInput
            label={t('wf_days_present_label')}
            keyboardType="numeric"
            value={daysPresent}
            onChangeText={(v: string) => {
              setDaysPresent(v);
              if (daysPresentError) setDaysPresentError(undefined);
            }}
            errorText={daysPresentError}
          />
          <AppInput
            label={t('wf_overtime_hours_label')}
            keyboardType="numeric"
            value={overtimeHours}
            onChangeText={setOvertimeHours}
          />
          <AppInput
            label={t('wf_reported_by_label')}
            placeholder={t('wf_reported_by_placeholder')}
            value={reportedBy}
            onChangeText={setReportedBy}
          />
          <AppInput
            label={t('wf_remarks_label')}
            value={remarks}
            onChangeText={setRemarks}
            multiline
            numberOfLines={3}
            style={styles.remarksInput}
          />
          <AppButton
            title={t('wf_save_attendance_cta')}
            onPress={handleSave}
            loading={submitMutation.isPending}
            disabled={submitMutation.isPending}
            fullWidth
            style={styles.saveBtn}
          />
        </>
      )}
    </AppSheet>
  );
};

const styles = StyleSheet.create({
  monthRow: { marginBottom: 16 },
  monthStepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 8 },
  stepperBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontWeight: '700', minWidth: 140, textAlign: 'center' },
  loadingWrap: { paddingVertical: 32, alignItems: 'center' },
  loadFailedText: { marginBottom: 8 },
  remarksInput: { minHeight: 72, textAlignVertical: 'top' as const },
  saveBtn: { marginTop: 4, marginBottom: 8 },
});
