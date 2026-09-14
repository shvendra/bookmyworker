import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppSheet } from '../../../shared/components/ui/AppSheet';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { Badge, type BadgeVariant } from '../../../shared/components/ui/Badge';
import { useAppTheme } from '../../../core/theme';
import type { PoliceVerificationSummary } from '../../../core/api/endpoints/deploymentsApi';

interface Props {
  visible: boolean;
  workerName?: string;
  policeVerification?: PoliceVerificationSummary;
  onClose: () => void;
}

// Matches PoliceVerificationDialog.jsx's STATUSES ("Not Started" | "Pending" |
// "Verified" | "Rejected"). deploymentsApi types `status` as a bare string
// (backend enum, not re-declared client-side), so fall back gracefully for any
// unrecognised value rather than crashing on a lookup miss.
const STATUS_KEY: Record<string, string> = {
  'Not Started': 'wf_police_verification_status_not_started',
  Pending: 'wf_police_verification_status_pending',
  Verified: 'wf_police_verification_status_verified',
  Rejected: 'wf_police_verification_status_rejected',
};

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  'Not Started': 'neutral',
  Pending: 'warning',
  Verified: 'success',
  Rejected: 'danger',
};

/**
 * Read-only Police Verification detail sheet — Employer app equivalent of
 * PoliceVerificationDialog.jsx's mode="employer" view. Mobile has no
 * dedicated police-verifications API module (Phase 1 built 8 modules, none
 * for this resource); the summary already rides along on each Deployment
 * from listForRequirement, so this sheet is purely a presentational view of
 * that embedded data — no fetch, no upload (upload stays CRM/web-only for now).
 */
export const PoliceVerificationSheet = ({ visible, workerName, policeVerification, onClose }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');

  const status = policeVerification?.status ?? 'Not Started';
  const labelKey = STATUS_KEY[status];
  const variant = STATUS_VARIANT[status] ?? 'neutral';
  // Never assume a report exists — only render the link when the backend
  // actually returned one (matches the CRM's exact visibility rule).
  const reportFileUrl = policeVerification?.reportFileUrl;

  return (
    <AppSheet visible={visible} onClose={onClose} title={t('wf_police_verification_label')} subtitle={workerName}>
      <View style={styles.statusRow}>
        <Badge label={t(labelKey ?? 'wf_police_verification_status_not_started', status)} variant={variant} />
      </View>

      {reportFileUrl ? (
        <AppButton
          title={t('wf_police_verification_view_report')}
          onPress={() => void Linking.openURL(reportFileUrl)}
          variant="secondary"
          icon="📄"
          fullWidth
          style={styles.reportBtn}
        />
      ) : null}

      <AppButton title={t('close')} onPress={onClose} variant="ghost" fullWidth style={styles.closeBtn} />
    </AppSheet>
  );
};

const styles = StyleSheet.create({
  statusRow: { marginBottom: 16 },
  reportBtn: { marginBottom: 10 },
  closeBtn: {},
});
