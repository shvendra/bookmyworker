import React, { useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { Badge, type BadgeVariant } from '../../../shared/components/ui/Badge';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { useAppTheme } from '../../../core/theme';
import { clientInvoicesApi, type ClientInvoiceStatus } from '../../../core/api/endpoints/clientInvoicesApi';
import {
  paymentSubmissionsApi,
  type PaymentMode,
  type PaymentSubmission,
  type PaymentSubmissionStatus,
} from '../../../core/api/endpoints/paymentSubmissionsApi';
import { SubmitPaymentSheet } from '../components/SubmitPaymentSheet';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'WorkforceInvoiceDetail'>;

const BRAND = '#1037A4';

const STATUS_BADGE_VARIANT: Record<ClientInvoiceStatus, BadgeVariant> = {
  Draft: 'neutral',
  Issued: 'info',
  PartiallyPaid: 'warning',
  Paid: 'success',
  Cancelled: 'neutral',
  Disputed: 'danger',
};

const STATUS_LABEL_KEY: Record<ClientInvoiceStatus, string> = {
  Draft: 'wf_invoice_status_draft',
  Issued: 'wf_invoice_status_issued',
  PartiallyPaid: 'wf_invoice_status_partiallypaid',
  Paid: 'wf_invoice_status_paid',
  Cancelled: 'wf_invoice_status_cancelled',
  Disputed: 'wf_invoice_status_disputed',
};

// NON-NEGOTIABLE (Requirement #16 / plan D7): a PaymentSubmission is a CLAIM,
// never a receipt. 'Submitted' must render only as "Pending Verification" —
// never anything that could read as "Paid" — until status === 'Verified'.
const PAYMENT_STATUS_BADGE_VARIANT: Record<PaymentSubmissionStatus, BadgeVariant> = {
  Submitted: 'warning',
  Verified: 'success',
  Rejected: 'danger',
};

const PAYMENT_STATUS_LABEL_KEY: Record<PaymentSubmissionStatus, string> = {
  Submitted: 'wf_payment_pending_verification',
  Verified: 'wf_payment_status_verified',
  Rejected: 'wf_payment_status_rejected',
};

const PAYMENT_MODE_LABEL_KEY: Record<PaymentMode, string> = {
  BankTransfer: 'wf_payment_mode_banktransfer',
  Cheque: 'wf_payment_mode_cheque',
  Cash: 'wf_payment_mode_cash',
  UPI: 'wf_payment_mode_upi',
  Other: 'wf_payment_mode_other',
};

// Matches the CRM's InvoiceDetailDialog.jsx exact gating condition for
// mode="employer" — Submit Payment only shows for these two statuses.
const SUBMITTABLE_STATUSES: ClientInvoiceStatus[] = ['Issued', 'PartiallyPaid'];

const formatDate = (d?: string): string => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
};

const formatMoney = (n?: number): string => `₹${(n ?? 0).toLocaleString('en-IN')}`;

/**
 * Ports InvoiceDetailDialog.jsx's mode="employer" branch ONLY — line items,
 * totals, payment-submissions list (read-only status, "View Proof"), refunds
 * (read-only), and "Submit Payment". Verify/Reject/Record-Refund are
 * Finance-only actions and are deliberately NOT built here at all.
 */
export const InvoiceDetailScreen = ({ route, navigation }: Props): React.JSX.Element => {
  const { id } = route.params;
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const [submitSheetVisible, setSubmitSheetVisible] = useState(false);

  const invoiceQuery = useQuery({
    queryKey: ['wf-invoice', id],
    queryFn: () => clientInvoicesApi.getById(id),
  });

  const paymentsQuery = useQuery({
    queryKey: ['wf-invoice-payments', id],
    queryFn: () => paymentSubmissionsApi.listForInvoice(id),
  });

  const refundsQuery = useQuery({
    queryKey: ['wf-invoice-refunds', id],
    queryFn: () => paymentSubmissionsApi.listRefunds(id),
  });

  const invoice = invoiceQuery.data;
  const submissions = paymentsQuery.data ?? [];
  const refunds = refundsQuery.data ?? [];

  const handleViewProof = (sub: PaymentSubmission): void => {
    navigation.navigate('PdfViewer', { url: sub.proofFileUrl, title: t('wf_payment_proof_title') });
  };

  if (invoiceQuery.isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />
        <ScreenHeader title={t('wf_invoice_details_title')} onBack={() => navigation.goBack()} />
        <LoadingState message={t('wf_invoice_loading')} />
      </View>
    );
  }

  if (invoiceQuery.isError || !invoice) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />
        <ScreenHeader title={t('wf_invoice_details_title')} onBack={() => navigation.goBack()} />
        <ErrorState
          title={t('wf_load_failed_title')}
          description={t('wf_invoice_load_failed_body')}
          onRetry={() => void invoiceQuery.refetch()}
        />
      </View>
    );
  }

  const canSubmitPayment = SUBMITTABLE_STATUSES.includes(invoice.status);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader title={invoice.invoiceNumber || t('wf_invoice_draft_fallback')} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.badgeRow}>
          <Badge
            label={t(STATUS_LABEL_KEY[invoice.status] ?? 'wf_invoice_status_draft')}
            variant={STATUS_BADGE_VARIANT[invoice.status] ?? 'neutral'}
          />
          {invoice.dueDate ? (
            <AppText variant="caption" color={theme.colors.mutedText}>
              {t('wf_invoice_due_on', { date: formatDate(invoice.dueDate) })}
            </AppText>
          ) : null}
        </View>

        {invoice.status === 'Cancelled' && invoice.cancelledReason ? (
          <AppCard style={[styles.noticeCard, { backgroundColor: theme.colors.dangerLight }]}>
            <AppText variant="labelSm" color={theme.colors.danger} style={styles.noticeLabel}>
              {t('wf_invoice_cancelled_reason_label')}
            </AppText>
            <AppText variant="body" color={theme.colors.text}>{invoice.cancelledReason}</AppText>
          </AppCard>
        ) : null}

        {/* Line items */}
        <AppCard style={styles.lineItemsCard}>
          <AppText variant="subtitle" color={theme.colors.text} style={styles.sectionTitle}>
            {t('wf_invoice_line_items_title')}
          </AppText>
          {invoice.lineItems.map((item, idx) => (
            <View
              key={idx}
              style={[
                styles.lineItemRow,
                idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
              ]}
            >
              <View style={styles.lineItemDescCol}>
                <AppText variant="bodyMd" color={theme.colors.text} numberOfLines={2}>
                  {item.description}
                </AppText>
                <AppText variant="micro" color={theme.colors.mutedText}>
                  {t('wf_invoice_line_item_meta', { units: item.units, rate: formatMoney(item.rate) })}
                </AppText>
              </View>
              <AppText variant="bodyMd" color={theme.colors.text}>{formatMoney(item.amount)}</AppText>
            </View>
          ))}

          <View style={[styles.totalsBlock, { borderTopColor: theme.colors.divider }]}>
            <View style={styles.totalsRow}>
              <AppText variant="caption" color={theme.colors.mutedText}>{t('wf_invoice_subtotal_label')}</AppText>
              <AppText variant="caption" color={theme.colors.text}>{formatMoney(invoice.subtotal)}</AppText>
            </View>
            <View style={styles.totalsRow}>
              <AppText variant="caption" color={theme.colors.mutedText}>
                {t('wf_invoice_gst_label', { rate: invoice.gstRate })}
              </AppText>
              <AppText variant="caption" color={theme.colors.text}>{formatMoney(invoice.gstAmount)}</AppText>
            </View>
            <View style={[styles.totalsRow, styles.grandTotalRow]}>
              <AppText variant="label" color={theme.colors.text}>{t('wf_invoice_total_label')}</AppText>
              <AppText variant="label" color={theme.colors.text}>{formatMoney(invoice.totalAmount)}</AppText>
            </View>
          </View>
        </AppCard>

        {/* Payments — "Submitted" is ALWAYS shown as Pending Verification,
            never anything that could read as paid (Requirement #16 / D7). */}
        <View style={styles.paymentsHeaderRow}>
          <AppText variant="subtitle" color={theme.colors.text}>{t('wf_invoice_payments_title')}</AppText>
          {canSubmitPayment ? (
            <AppButton title={t('wf_submit_payment_cta')} onPress={() => setSubmitSheetVisible(true)} size="sm" />
          ) : null}
        </View>

        {paymentsQuery.isLoading ? (
          <LoadingState message={t('wf_invoice_payments_loading')} />
        ) : submissions.length === 0 ? (
          <AppText variant="body" color={theme.colors.mutedText} style={styles.emptyPaymentsText}>
            {t('wf_invoice_no_payments')}
          </AppText>
        ) : (
          submissions.map((sub) => (
            <AppCard key={sub._id} style={styles.paymentCard}>
              <View style={styles.paymentHeaderRow}>
                <AppText variant="bodyMd" color={theme.colors.text}>
                  {formatMoney(sub.actualAmountReconciled ?? sub.amountPaid)}
                </AppText>
                <Badge
                  label={t(PAYMENT_STATUS_LABEL_KEY[sub.status] ?? 'wf_payment_pending_verification')}
                  variant={PAYMENT_STATUS_BADGE_VARIANT[sub.status] ?? 'warning'}
                  size="sm"
                />
              </View>
              <AppText variant="caption" color={theme.colors.mutedText} style={styles.paymentMeta}>
                {t(PAYMENT_MODE_LABEL_KEY[sub.paymentMode] ?? 'wf_payment_mode_other')} · {sub.utrOrTransactionRef}
              </AppText>
              {sub.status === 'Rejected' && sub.verificationNotes ? (
                <AppText variant="caption" color={theme.colors.danger} style={styles.paymentMeta}>
                  {sub.verificationNotes}
                </AppText>
              ) : null}
              <AppButton
                title={t('wf_view_proof_cta')}
                onPress={() => handleViewProof(sub)}
                variant="outline"
                size="sm"
                style={styles.viewProofBtn}
              />
            </AppCard>
          ))
        )}

        {/* Refunds — read-only. Record Refund is CRM/Finance-only, not built here. */}
        {refunds.length > 0 ? (
          <View style={styles.refundsSection}>
            <AppText variant="subtitle" color={theme.colors.text} style={styles.sectionTitle}>
              {t('wf_invoice_refunds_title')}
            </AppText>
            {refunds.map((r) => (
              <View key={r._id} style={styles.refundRow}>
                <AppText variant="bodyMd" color={theme.colors.text}>{formatMoney(r.amount)}</AppText>
                <AppText variant="caption" color={theme.colors.mutedText}>
                  {formatDate(r.createdAt)}
                  {r.reference ? ` · ${r.reference}` : ''}
                  {r.note ? ` — ${r.note}` : ''}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <SubmitPaymentSheet
        visible={submitSheetVisible}
        invoiceId={id}
        onClose={() => setSubmitSheetVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  noticeCard: { marginBottom: 14 },
  noticeLabel: { marginBottom: 4 },
  lineItemsCard: { marginBottom: 16 },
  sectionTitle: { marginBottom: 10 },
  lineItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, gap: 10 },
  lineItemDescCol: { flex: 1 },
  totalsBlock: { marginTop: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 4 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  grandTotalRow: { marginTop: 4, paddingTop: 6 },
  paymentsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 },
  emptyPaymentsText: { marginBottom: 16 },
  paymentCard: { marginBottom: 10 },
  paymentHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  paymentMeta: { marginBottom: 4 },
  viewProofBtn: { alignSelf: 'flex-start', marginTop: 6 },
  refundsSection: { marginTop: 6, marginBottom: 20 },
  refundRow: { marginBottom: 8 },
});
