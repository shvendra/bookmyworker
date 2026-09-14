import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppSheet } from '../../../shared/components/ui/AppSheet';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppInput } from '../../../shared/components/ui/AppInput';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { useAppTheme } from '../../../core/theme';

interface Props {
  visible: boolean;
  workerName?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
}

/**
 * Reject-worker confirmation. Same title/body copy and danger framing as the
 * showAlert() confirmation used elsewhere in this screen (Cancel Requirement,
 * Confirm Worker) — but showAlert can't host a text field, and the backend
 * now accepts an optional `{ reason }` on reject (Phase 1 correction), so
 * this one small case uses the other established modal primitive, AppSheet,
 * to add an optional reason input alongside the same Cancel/Reject action pair.
 */
export const RejectDeploymentSheet = ({ visible, workerName, loading = false, onCancel, onConfirm }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  return (
    <AppSheet visible={visible} onClose={onCancel} title={t('wf_reject_worker_title')} scroll={false}>
      <AppText variant="body" color={theme.colors.mutedText} style={styles.body}>
        {t('wf_reject_worker_body', { name: workerName ?? '' })}
      </AppText>

      <AppInput
        label={t('wf_reject_reason_label')}
        placeholder={t('wf_reject_reason_placeholder')}
        value={reason}
        onChangeText={setReason}
        multiline
        numberOfLines={3}
        maxLength={300}
        showCount
        style={styles.reasonInput}
      />

      <View style={styles.buttonRow}>
        <AppButton title={t('cancel')} onPress={onCancel} variant="secondary" style={styles.flexBtn} disabled={loading} />
        <AppButton
          title={t('wf_reject_cta')}
          onPress={() => onConfirm(reason.trim() ? reason.trim() : undefined)}
          variant="danger"
          style={styles.flexBtn}
          loading={loading}
          disabled={loading}
        />
      </View>
    </AppSheet>
  );
};

const styles = StyleSheet.create({
  body: { marginBottom: 16, lineHeight: 21 },
  reasonInput: { minHeight: 80, textAlignVertical: 'top' as const },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  flexBtn: { flex: 1 },
});
