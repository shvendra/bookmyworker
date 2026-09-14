import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { Badge, type BadgeVariant } from '../../../shared/components/ui/Badge';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import { useAppTheme } from '../../../core/theme';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { showAlert } from '../../../shared/state/alert/AppAlertContext';
import {
  deploymentsApi,
  type Deployment,
  type DeploymentStatus,
} from '../../../core/api/endpoints/deploymentsApi';
import { RejectDeploymentSheet } from './RejectDeploymentSheet';
import { PoliceVerificationSheet } from './PoliceVerificationSheet';
import { ReportAttendanceSheet } from './ReportAttendanceSheet';

interface Props {
  requirementId: string;
}

const DEPLOYMENT_STATUS_BADGE_VARIANT: Record<DeploymentStatus, BadgeVariant> = {
  Proposed: 'secondary',
  Confirmed: 'info',
  Deployed: 'primary',
  Active: 'success',
  Inactive: 'warning',
  Replaced: 'accent',
  Completed: 'neutral',
  Rejected: 'danger',
  Withdrawn: 'neutral',
  Terminated: 'danger',
};

const DEPLOYMENT_STATUS_LABEL_KEY: Record<DeploymentStatus, string> = {
  Proposed: 'wf_deployment_status_proposed',
  Confirmed: 'wf_deployment_status_confirmed',
  Deployed: 'wf_deployment_status_deployed',
  Active: 'wf_deployment_status_active',
  Inactive: 'wf_deployment_status_inactive',
  Replaced: 'wf_deployment_status_replaced',
  Completed: 'wf_deployment_status_completed',
  Rejected: 'wf_deployment_status_rejected',
  Withdrawn: 'wf_deployment_status_withdrawn',
  Terminated: 'wf_deployment_status_terminated',
};

const KYC_BADGE_VARIANT: Record<'Verified' | 'Pending', BadgeVariant> = {
  Verified: 'success',
  Pending: 'warning',
};

const KYC_LABEL_KEY: Record<'Verified' | 'Pending', string> = {
  Verified: 'wf_kyc_status_verified',
  Pending: 'wf_kyc_status_pending',
};

const POLICE_STATUS_BADGE_VARIANT: Record<string, BadgeVariant> = {
  'Not Started': 'neutral',
  Pending: 'warning',
  Verified: 'success',
  Rejected: 'danger',
};

const POLICE_STATUS_LABEL_KEY: Record<string, string> = {
  'Not Started': 'wf_police_verification_status_not_started',
  Pending: 'wf_police_verification_status_pending',
  Verified: 'wf_police_verification_status_verified',
  Rejected: 'wf_police_verification_status_rejected',
};

// Statuses at which the Employer can report attendance in the CRM
// (mirrors DeploymentsSection.jsx's ["Deployed", "Active", "Inactive"] list).
const ATTENDANCE_ELIGIBLE_STATUSES: DeploymentStatus[] = ['Deployed', 'Active', 'Inactive'];

/**
 * Embedded within WorkforceRequirementDetailScreen — ports
 * DeploymentsSection.jsx's mode="employer" branch: worker cards with
 * status/KYC/police-verification badges, Confirm/Reject (Proposed only,
 * each behind a confirmation step), and a Report Attendance entry point
 * (opens ReportAttendanceSheet — Phase 4) for Deployed/Active/Inactive rows.
 */
export const DeploymentsSection = ({ requirementId }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const toast = useToast();

  const [pvTarget, setPvTarget] = useState<Deployment | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Deployment | null>(null);
  const [attendanceTarget, setAttendanceTarget] = useState<Deployment | null>(null);

  const {
    data: deployments,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['wf-deployments', requirementId],
    queryFn: () => deploymentsApi.listForRequirement(requirementId),
  });

  const confirmMutation = useMutation({
    mutationFn: (deploymentId: string) => deploymentsApi.confirm(deploymentId),
    onSuccess: () => {
      void refetch();
      toast.success(t('wf_confirm_success_toast'));
    },
    onError: (err: unknown) => {
      const message = err instanceof Error && err.message ? err.message : t('wf_confirm_fail_generic');
      toast.error(message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ deploymentId, reason }: { deploymentId: string; reason?: string }) =>
      deploymentsApi.reject(deploymentId, reason),
    onSuccess: () => {
      void refetch();
      setRejectTarget(null);
      toast.success(t('wf_reject_success_toast'));
    },
    onError: (err: unknown) => {
      const message = err instanceof Error && err.message ? err.message : t('wf_reject_fail_generic');
      toast.error(message);
    },
  });

  const handleConfirmPress = (deployment: Deployment): void => {
    showAlert(t('wf_confirm_worker_title'), t('wf_confirm_worker_body', { name: deployment.workerName }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('confirm'), onPress: () => confirmMutation.mutate(deployment._id) },
    ]);
  };

  const handleAttendancePress = (deployment: Deployment): void => {
    setAttendanceTarget(deployment);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <AppCard style={styles.sectionCard}>
        <AppText variant="subtitle" color={theme.colors.text} style={styles.sectionTitle}>
          {t('wf_deployments_section_title')}
        </AppText>
        <AppText variant="body" color={theme.colors.danger}>
          {t('wf_deployments_load_failed')}
        </AppText>
      </AppCard>
    );
  }

  const list = deployments ?? [];

  return (
    <View style={styles.container}>
      <AppText variant="subtitle" color={theme.colors.text} style={styles.sectionTitle}>
        {t('wf_deployments_section_title')}
      </AppText>

      {list.length === 0 ? (
        <AppCard>
          <EmptyState
            icon="👷"
            title={t('wf_deployments_empty_title')}
            description={t('wf_deployments_empty_body')}
            compact
          />
        </AppCard>
      ) : (
        list.map((deployment) => {
          const kycStatus = deployment.kycStatus ?? 'Pending';
          const policeStatus = deployment.policeVerification?.status ?? 'Not Started';

          return (
            <AppCard key={deployment._id} style={styles.workerCard}>
              <View style={styles.workerHeaderRow}>
                <View style={styles.workerNameCol}>
                  <AppText variant="bodyMd" color={theme.colors.text}>
                    {deployment.workerName}
                  </AppText>
                  <AppText variant="caption" color={theme.colors.mutedText}>
                    {deployment.workerPhone}
                  </AppText>
                </View>
                <Badge
                  label={t(DEPLOYMENT_STATUS_LABEL_KEY[deployment.status] ?? 'wf_deployment_status_proposed')}
                  variant={DEPLOYMENT_STATUS_BADGE_VARIANT[deployment.status] ?? 'neutral'}
                />
              </View>

              <View style={styles.badgeRow}>
                <Badge
                  label={`${t('wf_kyc_label')}: ${t(KYC_LABEL_KEY[kycStatus] ?? 'wf_kyc_status_pending')}`}
                  variant={KYC_BADGE_VARIANT[kycStatus] ?? 'warning'}
                  size="sm"
                />
                <Pressable onPress={() => setPvTarget(deployment)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Badge
                    label={`${t('wf_police_verification_label')}: ${t(
                      POLICE_STATUS_LABEL_KEY[policeStatus] ?? 'wf_police_verification_status_not_started',
                      policeStatus,
                    )}`}
                    variant={POLICE_STATUS_BADGE_VARIANT[policeStatus] ?? 'neutral'}
                    size="sm"
                    outlined
                  />
                </Pressable>
              </View>

              {deployment.status === 'Proposed' ? (
                <View style={styles.actionRow}>
                  <AppButton
                    title={t('confirm')}
                    onPress={() => handleConfirmPress(deployment)}
                    variant="primary"
                    style={styles.flexBtn}
                    loading={confirmMutation.isPending && confirmMutation.variables === deployment._id}
                    disabled={confirmMutation.isPending || rejectMutation.isPending}
                  />
                  <AppButton
                    title={t('wf_reject_cta')}
                    onPress={() => setRejectTarget(deployment)}
                    variant="danger"
                    style={styles.flexBtn}
                    disabled={confirmMutation.isPending || rejectMutation.isPending}
                  />
                </View>
              ) : null}

              {ATTENDANCE_ELIGIBLE_STATUSES.includes(deployment.status) ? (
                <AppButton
                  title={t('wf_report_attendance_cta')}
                  onPress={() => handleAttendancePress(deployment)}
                  variant="outline"
                  icon="🗓️"
                  fullWidth
                  style={styles.attendanceBtn}
                />
              ) : null}
            </AppCard>
          );
        })
      )}

      <PoliceVerificationSheet
        visible={!!pvTarget}
        workerName={pvTarget?.workerName}
        policeVerification={pvTarget?.policeVerification}
        onClose={() => setPvTarget(null)}
      />

      <RejectDeploymentSheet
        visible={!!rejectTarget}
        workerName={rejectTarget?.workerName}
        loading={rejectMutation.isPending}
        onCancel={() => setRejectTarget(null)}
        onConfirm={(reason) => {
          if (!rejectTarget) return;
          rejectMutation.mutate({ deploymentId: rejectTarget._id, reason });
        }}
      />

      <ReportAttendanceSheet
        visible={!!attendanceTarget}
        deployment={attendanceTarget}
        onClose={() => setAttendanceTarget(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  sectionTitle: { marginBottom: 10 },
  sectionCard: { marginBottom: 16 },
  loadingWrap: { paddingVertical: 24, alignItems: 'center' },
  workerCard: { marginBottom: 10 },
  workerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  workerNameCol: { flexShrink: 1 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  flexBtn: { flex: 1 },
  attendanceBtn: { marginTop: 12 },
});
