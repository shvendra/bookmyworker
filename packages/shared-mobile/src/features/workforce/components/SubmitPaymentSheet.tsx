import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { AppSheet } from '../../../shared/components/ui/AppSheet';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppInput } from '../../../shared/components/ui/AppInput';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { FormSelect } from '../../../shared/components/forms/FormSelect';
import { FormDatePicker } from '../../../shared/components/forms/FormDateTimePicker';
import { useAppTheme } from '../../../core/theme';
import { useToast } from '../../../shared/state/toast/ToastContext';
import {
  paymentSubmissionsApi,
  type PaymentMode,
  type SubmitPaymentPayload,
} from '../../../core/api/endpoints/paymentSubmissionsApi';

interface Props {
  visible: boolean;
  invoiceId: string;
  onClose: () => void;
}

interface ProofFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

const PAYMENT_MODES: PaymentMode[] = ['BankTransfer', 'Cheque', 'Cash', 'UPI', 'Other'];

const PAYMENT_MODE_LABEL_KEY: Record<PaymentMode, string> = {
  BankTransfer: 'wf_payment_mode_banktransfer',
  Cheque: 'wf_payment_mode_cheque',
  Cash: 'wf_payment_mode_cash',
  UPI: 'wf_payment_mode_upi',
  Other: 'wf_payment_mode_other',
};

// FormDatePicker works in "DD/MM/YYYY" — the backend needs an ISO date
// string. Built as a plain zero-padded string (never a `new Date(...)`
// object), so there's no local-timezone shift — mirrors
// NewWorkforceRequirementScreen.tsx's toIsoDate() exactly (same known-good
// pattern already proven elsewhere in this codebase).
const toIsoDate = (v: string): string | undefined => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Employer's Submit Payment sheet — ports PaymentSubmissionDialog.jsx.
 *
 * NON-NEGOTIABLE (Requirement #16 / plan D7): submitting this is a CLAIM,
 * never a payment. The body copy below must never imply the invoice becomes
 * "paid" by submitting — it stays "Pending Verification" until Finance
 * verifies it against the bank statement. Do not regress this wording.
 *
 * Proof upload follows documentApi.ts's proven multipart pattern verbatim
 * (picker → preview → `{ uri, name, type }` FormData part) — see
 * DocumentHubScreen.tsx's UploadModal, cloned here for the `document` field
 * paymentSubmissionsApi.submit() sends, matching what
 * paymentSubmissionController.js's submitPayment() reads as `req.files?.document`.
 */
export const SubmitPaymentSheet = ({ visible, invoiceId, onClose }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const toast = useToast();
  const queryClient = useQueryClient();

  const [amountPaid, setAmountPaid] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('BankTransfer');
  const [utrOrTransactionRef, setUtrOrTransactionRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<ProofFile | null>(null);

  const [amountError, setAmountError] = useState<string | undefined>(undefined);
  const [dateError, setDateError] = useState<string | undefined>(undefined);
  const [utrError, setUtrError] = useState<string | undefined>(undefined);
  const [fileError, setFileError] = useState<string | undefined>(undefined);

  const reset = (): void => {
    setAmountPaid('');
    setPaymentDate('');
    setPaymentMode('BankTransfer');
    setUtrOrTransactionRef('');
    setRemarks('');
    setFile(null);
    setAmountError(undefined);
    setDateError(undefined);
    setUtrError(undefined);
    setFileError(undefined);
  };

  const handleClose = (): void => {
    reset();
    onClose();
  };

  const pickPdf = async (): Promise<void> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0]!;
      setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/pdf', size: asset.size ?? 0 });
      setFileError(undefined);
    } catch {
      toast.error(t('wf_file_picker_error'));
    }
  };

  const pickImage = async (): Promise<void> => {
    // Android 13+ uses the system Photo Picker — no READ_MEDIA_IMAGES permission needed
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0]!;
    const mimeType = asset.mimeType ?? (asset.uri.endsWith('.png') ? 'image/png' : 'image/jpeg');
    const fileName = asset.fileName ?? `payment_proof_${Date.now()}.${mimeType.split('/')[1]}`;
    setFile({ uri: asset.uri, name: fileName, mimeType, size: asset.fileSize ?? 0 });
    setFileError(undefined);
  };

  const submitMutation = useMutation({
    mutationFn: (payload: SubmitPaymentPayload) => paymentSubmissionsApi.submit(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wf-invoice-payments', invoiceId] });
      // Deliberately never says "payment successful" — this is a claim,
      // still pending Finance verification (Requirement #16 / D7).
      toast.success(t('wf_payment_submitted_toast'));
      reset();
      onClose();
    },
    onError: (err: unknown) => {
      // Surface the backend's exact message verbatim (e.g. "invoice not in a
      // submittable status") — same discipline as every prior phase.
      const message = err instanceof Error && err.message ? err.message : t('wf_payment_submit_failed_generic');
      toast.error(message);
    },
  });

  const handleSubmit = (): void => {
    let hasError = false;

    const amountNum = Number(amountPaid);
    if (!amountPaid.trim() || !Number.isFinite(amountNum) || amountNum <= 0) {
      setAmountError(t('wf_amount_required_error'));
      hasError = true;
    } else {
      setAmountError(undefined);
    }

    const isoDate = toIsoDate(paymentDate);
    if (!isoDate) {
      setDateError(t('wf_payment_date_required_error'));
      hasError = true;
    } else {
      setDateError(undefined);
    }

    if (!utrOrTransactionRef.trim()) {
      setUtrError(t('wf_utr_required_error'));
      hasError = true;
    } else {
      setUtrError(undefined);
    }

    if (!file) {
      setFileError(t('wf_proof_required_error'));
      hasError = true;
    } else {
      setFileError(undefined);
    }

    if (hasError || !isoDate || !file) return;

    submitMutation.mutate({
      invoiceId,
      amountPaid: amountNum,
      paymentDate: isoDate,
      paymentMode,
      utrOrTransactionRef: utrOrTransactionRef.trim(),
      remarks: remarks.trim() || undefined,
      fileUri: file.uri,
      fileName: file.name,
      mimeType: file.mimeType,
    });
  };

  return (
    <AppSheet visible={visible} onClose={handleClose} title={t('wf_submit_payment_title')}>
      <AppText variant="caption" color={theme.colors.mutedText} style={styles.introText}>
        {t('wf_submit_payment_body')}
      </AppText>

      <AppInput
        label={t('wf_amount_paid_label')}
        keyboardType="numeric"
        value={amountPaid}
        onChangeText={(v: string) => {
          setAmountPaid(v);
          if (amountError) setAmountError(undefined);
        }}
        errorText={amountError}
      />

      <FormDatePicker
        label={t('wf_payment_date_label')}
        value={paymentDate}
        onChange={(v) => {
          setPaymentDate(v);
          if (dateError) setDateError(undefined);
        }}
        errorText={dateError}
        minYearOffset={-1}
        maxYearOffset={0}
      />

      <FormSelect
        label={t('wf_payment_mode_label')}
        value={paymentMode}
        options={PAYMENT_MODES}
        onChange={(v) => setPaymentMode(v as PaymentMode)}
        renderLabel={(v) => t(PAYMENT_MODE_LABEL_KEY[v as PaymentMode] ?? 'wf_payment_mode_other')}
      />

      <AppInput
        label={t('wf_utr_label')}
        value={utrOrTransactionRef}
        onChangeText={(v: string) => {
          setUtrOrTransactionRef(v);
          if (utrError) setUtrError(undefined);
        }}
        errorText={utrError}
      />

      <AppInput
        label={t('wf_remarks_label')}
        value={remarks}
        onChangeText={setRemarks}
        multiline
        numberOfLines={3}
        style={styles.remarksInput}
      />

      <AppText variant="labelSm" color={theme.colors.textSecondary} style={styles.fieldLabel}>
        {t('wf_attach_proof_label')}
      </AppText>
      {file ? (
        <View style={[styles.filePreview, { borderColor: theme.colors.success, backgroundColor: theme.colors.successLight }]}>
          <AppText variant="labelSm" color={theme.colors.text} numberOfLines={2} style={styles.fileName}>
            {file.name}
          </AppText>
          <TouchableOpacity onPress={() => setFile(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <AppText variant="caption" color={theme.colors.danger} weight="700">
              {t('wf_remove_file_cta')}
            </AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.pickerRow}>
          <TouchableOpacity
            onPress={() => void pickPdf()}
            style={[styles.pickerBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface1 }]}
            activeOpacity={0.8}
          >
            <AppText style={styles.pickerIcon}>📄</AppText>
            <AppText variant="labelSm" color={theme.colors.text}>{t('wf_pick_pdf_cta')}</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => void pickImage()}
            style={[styles.pickerBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface1 }]}
            activeOpacity={0.8}
          >
            <AppText style={styles.pickerIcon}>🖼️</AppText>
            <AppText variant="labelSm" color={theme.colors.text}>{t('wf_pick_image_cta')}</AppText>
          </TouchableOpacity>
        </View>
      )}
      {fileError ? (
        <AppText variant="caption" color={theme.colors.danger} style={styles.fileErrorText}>
          {fileError}
        </AppText>
      ) : null}

      <AppButton
        title={t('wf_submit_payment_submit_cta')}
        onPress={handleSubmit}
        loading={submitMutation.isPending}
        disabled={submitMutation.isPending}
        fullWidth
        style={styles.submitBtn}
      />
    </AppSheet>
  );
};

const styles = StyleSheet.create({
  introText: { marginBottom: 16, lineHeight: 18 },
  fieldLabel: { marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  filePreview: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  fileName: { flex: 1 },
  pickerRow: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  pickerBtn: { flex: 1, borderWidth: 1.5, borderRadius: 14, paddingVertical: 16, alignItems: 'center', gap: 6 },
  pickerIcon: { fontSize: 26 },
  fileErrorText: { marginBottom: 8 },
  remarksInput: { minHeight: 72, textAlignVertical: 'top' as const },
  submitBtn: { marginTop: 8, marginBottom: 8 },
});
