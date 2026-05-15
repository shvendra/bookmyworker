import React, { useState } from 'react';
import {
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { walletApi } from '../../../core/api/endpoints/walletApi';
import type { RawPaymentTransaction } from '../../../core/api/endpoints/walletApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { Badge } from '../../../shared/components/ui/Badge';
import { SectionHeader } from '../../../shared/components/ui/SectionHeader';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import { useToast } from '../../../shared/state/toast/ToastContext';

const maskAccount = (acc?: string): string => {
  if (!acc) return '—';
  return acc.replace(/.(?=.{4})/g, '*');
};

const fmtDate = (d: string): string => {
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const fmtAmt = (n?: number): string => `₹${(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusColor = (s?: string): string => {
  if (!s) return '#6B7280';
  const l = s.toLowerCase();
  if (l === 'completed' || l === 'done') return '#10B981';
  if (l === 'rejected') return '#EF4444';
  return '#F59E0B';
};

// ─── Invoice Modal ──────────────────────────────────────────────────────────
interface InvoiceProps {
  txn: RawPaymentTransaction | null;
  userName: string;
  onClose: () => void;
}

const InvoiceModal = ({ txn, userName, onClose }: InvoiceProps): React.JSX.Element | null => {
  if (!txn) return null;
  const baseAmt = (txn.amount ?? 0) / 1.18;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={styles.invoiceScroll} contentContainerStyle={styles.invoiceContent}>
        {/* Header */}
        <View style={styles.invoiceHeader}>
          <AppText variant="title" color="#1976D2" style={styles.invoiceBrand}>BookMyWorker</AppText>
          <AppText variant="caption" color="#64748B" style={styles.invoiceAddr}>
            Khasara No 34/1/33, Rewa Semariya Road, Karahiya, Rewa, MP - 486450
          </AppText>
          <AppText variant="caption" color="#64748B">support@bookmyworkers.com</AppText>
          <AppText variant="caption" color="#1E293B" style={{ fontWeight: '700' }}>GSTIN: 23NBJPS3070R1ZQ</AppText>
        </View>

        {/* Meta */}
        <View style={styles.invoiceMeta}>
          <View style={styles.invoiceMetaLeft}>
            {[['Name', userName], ['Phone', '—'], ['Address', '—']].map(([k, v]) => (
              <View key={k} style={styles.invoiceMetaRow}>
                <AppText variant="caption" color="#64748B" style={styles.invoiceMetaKey}>{k}:</AppText>
                <AppText variant="caption" color="#1E293B" style={{ fontWeight: '600' }}>{v}</AppText>
              </View>
            ))}
          </View>
          <View style={styles.invoiceMetaRight}>
            <AppText variant="caption" color="#94A3B8" style={styles.invoiceMetaLabel}>DATE</AppText>
            <AppText variant="caption" color="#1E293B" style={{ fontWeight: '600' }}>{fmtDate(txn.createdAt)}</AppText>
            <AppText variant="caption" color="#94A3B8" style={[styles.invoiceMetaLabel, { marginTop: 8 }]}>TRANSACTION ID</AppText>
            <AppText variant="caption" color="#1E293B" style={{ fontWeight: '600' }}>{txn.creditTransactionId || 'N/A'}</AppText>
          </View>
        </View>

        {/* Table */}
        <View style={styles.invoiceTable}>
          <View style={[styles.invoiceTableRow, styles.invoiceTableHead]}>
            <AppText variant="caption" color="#475569" style={[styles.invoiceTableCell, { flex: 2, fontWeight: '700' }]}>Description</AppText>
            <AppText variant="caption" color="#475569" style={[styles.invoiceTableCell, { textAlign: 'right', fontWeight: '700' }]}>Amount (₹)</AppText>
          </View>
          <View style={styles.invoiceTableRow}>
            <AppText variant="caption" color="#1E293B" style={[styles.invoiceTableCell, { flex: 2 }]}>
              {txn.paymentType ? txn.paymentType.charAt(0).toUpperCase() + txn.paymentType.slice(1) : '—'}
            </AppText>
            <AppText variant="caption" color="#1E293B" style={[styles.invoiceTableCell, { textAlign: 'right' }]}>{baseAmt.toFixed(2)}</AppText>
          </View>
          <View style={styles.invoiceTableRow}>
            <AppText variant="caption" color="#1E293B" style={[styles.invoiceTableCell, { flex: 2 }]}>Incentive</AppText>
            <AppText variant="caption" color="#1E293B" style={[styles.invoiceTableCell, { textAlign: 'right' }]}>{(txn.incentiveCharges ?? 0).toFixed(2)}</AppText>
          </View>
          <View style={[styles.invoiceTableRow, { backgroundColor: '#F8FAFC' }]}>
            <AppText variant="label" color="#1E293B" style={[styles.invoiceTableCell, { flex: 2 }]}>Total</AppText>
            <AppText variant="label" color="#1976D2" style={[styles.invoiceTableCell, { textAlign: 'right' }]}>{fmtAmt(txn.amount)}</AppText>
          </View>
        </View>

        <AppText variant="caption" color="#94A3B8" style={styles.invoiceFooter}>
          This is a digitally generated invoice and does not require a physical signature.
        </AppText>

        <AppButton title="Close" onPress={onClose} variant="secondary" style={styles.invoiceClose} />
      </ScrollView>
    </Modal>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────
export const PayoutScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const user = state.session?.user;
  const userId = user?.id ?? '';

  const [selectedTxn, setSelectedTxn] = useState<RawPaymentTransaction | null>(null);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agent-payout', userId],
    queryFn: () => walletApi.getAgentPayoutSummary(userId),
    staleTime: 60 * 1000,
    enabled: !!userId,
  });

  // Fetch full user profile for bank details
  const { data: userFull } = useQuery({
    queryKey: ['user-profile-full'],
    queryFn: async () => {
      const { apiClient } = await import('../../../core/api/client');
      const res = await apiClient.get('/api/v1/user/getuser');
      return res.data as {
        user?: {
          bankDetails?: { accountNumber?: string; ifscCode?: string };
          name?: string;
        };
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const withdrawMutation = useMutation({
    mutationFn: () => {
      const bankDetails = userFull?.user?.bankDetails;
      if (!bankDetails?.accountNumber || !bankDetails?.ifscCode) {
        throw new Error('NO_BANK');
      }
      const available = data?.availableAmount ?? 0;
      if (available <= 0) throw new Error('NO_BALANCE');

      const incentive = data?.incentiveAmount ?? 0;
      return walletApi.requestWithdrawal({
        requirementId: null,
        employerId: null,
        employerName: null,
        agentId: userId,
        agentName: user?.fullName ?? null,
        paymentType: 'debit',
        amount: available,
        creditTransactionId: null,
        creditStatus: 'pending',
        creditPaymentMethod: 'online',
        withdrawalStatus: 'pending',
        platformCharges: 0,
        incentiveCharges: incentive > 500 ? incentive - 500 : 0,
        gstCharges: 0,
        paymentStatus: 'pending',
        isEmployerCredit: false,
        isAgentWithdrawal: true,
      });
    },
    onSuccess: () => {
      setShowWithdraw(false);
      void queryClient.invalidateQueries({ queryKey: ['agent-payout'] });
      toast.success('Withdrawal request submitted. Amount will be credited within 24 hours.');
    },
    onError: (err: Error) => {
      setShowWithdraw(false);
      if (err.message === 'NO_BANK') {
        toast.warning('Please add your bank account details in profile settings before withdrawing.');
      } else if (err.message === 'NO_BALANCE') {
        toast.warning('You have no available balance to withdraw.');
      } else {
        toast.error('Withdrawal failed. Please try again.');
      }
    },
  });

  const handleWithdrawTap = (): void => {
    const bankDetails = userFull?.user?.bankDetails;
    if (!bankDetails?.accountNumber || !bankDetails?.ifscCode) {
      toast.warning('Please add your bank account details in profile settings before withdrawing.');
      return;
    }
    if ((data?.availableAmount ?? 0) <= 0) {
      toast.warning('You have no available balance to withdraw.');
      return;
    }
    setShowWithdraw(true);
  };

  const avail = data?.availableAmount ?? 0;
  const withdrawn = data?.totalDebit ?? 0;
  const incentive = data?.incentiveAmount ?? 0;
  const incentiveWithdrawn = data?.incentiveDebitAmount ?? 0;
  const bankAcc = userFull?.user?.bankDetails?.accountNumber;
  const bankIfsc = userFull?.user?.bankDetails?.ifscCode;
  const transactions = data?.debitTransactions ?? [];

  if (isLoading) return <LoadingState message="Loading payout details…" />;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void refetch()} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Page Title */}
      <View style={styles.pageHeader}>
        <AppText variant="title">Payout Summary</AppText>
        <AppText variant="caption" color={theme.colors.mutedText}>Payout / Transactions</AppText>
      </View>

      {/* Inline error banner */}
      {isError && (
        <TouchableOpacity
          onPress={() => void refetch()}
          style={[styles.errorBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
          activeOpacity={0.8}
        >
          <AppText variant="caption" color="#DC2626" style={{ fontWeight: '700' }}>Unable to load payout details</AppText>
          <AppText variant="caption" color="#EF4444">Check your connection and tap to retry.</AppText>
        </TouchableOpacity>
      )}

      {/* Summary Cards */}
      <AppCard style={styles.summaryCard}>
        <View style={styles.cardTitleRow}>
          <AppText variant="label">💰 Payout Summary</AppText>
        </View>
        <View style={styles.grid2x2}>
          {/* Available */}
          <View style={[styles.statBox, { backgroundColor: '#EEFAF1', borderColor: '#CCEBD3' }]}>
            <AppText variant="caption" color="#2E7D32" style={styles.statLabel}>💰 Available Amount</AppText>
            <AppText variant="title" color="#1B5E20" style={styles.statValue}>{fmtAmt(avail)}</AppText>
          </View>
          {/* Withdrawn */}
          <View style={[styles.statBox, { backgroundColor: '#F7EFFB', borderColor: '#EAD7F7' }]}>
            <AppText variant="caption" color="#7B1FA2" style={styles.statLabel}>📤 Total Withdrawn</AppText>
            <AppText variant="title" color="#4A148C" style={styles.statValue}>{fmtAmt(withdrawn)}</AppText>
          </View>
          {/* Incentive */}
          <View style={[styles.statBox, { backgroundColor: '#FFF7EB', borderColor: '#FFE0AD' }]}>
            <AppText variant="caption" color="#E65100" style={styles.statLabel}>🎁 Total Incentive</AppText>
            <AppText variant="title" color="#EF6C00" style={styles.statValue}>{fmtAmt(incentive)}</AppText>
          </View>
          {/* Incentive Withdrawn */}
          <View style={[styles.statBox, { backgroundColor: '#FFF0F5', borderColor: '#F8C9DC' }]}>
            <AppText variant="caption" color="#C2185B" style={styles.statLabel}>🎯 Incentive Withdrawal</AppText>
            <AppText variant="title" color="#AD1457" style={styles.statValue}>{fmtAmt(incentiveWithdrawn)}</AppText>
          </View>
        </View>

        {/* Bank Details */}
        <View style={styles.bankRow}>
          <View style={[styles.bankBox, { backgroundColor: '#EFF6FF', borderColor: '#CFE3FF' }]}>
            <AppText variant="caption" color="#1565C0" style={styles.statLabel}>🏦 Bank Account</AppText>
            <AppText variant="label" color="#0D47A1">{maskAccount(bankAcc)}</AppText>
          </View>
          <View style={[styles.bankBox, { backgroundColor: '#F4FBEF', borderColor: '#DCEDC8' }]}>
            <AppText variant="caption" color="#2E7D32" style={styles.statLabel}>🔢 IFSC Code</AppText>
            <AppText variant="label" color="#33691E">{bankIfsc || '—'}</AppText>
          </View>
        </View>

        {/* Withdraw Button */}
        <AppButton
          title="🏧 Withdraw"
          onPress={handleWithdrawTap}
          loading={withdrawMutation.isPending}
          style={styles.withdrawBtn}
        />
      </AppCard>

      {/* Transaction History */}
      <SectionHeader title="Transaction History" />
      {transactions.length === 0 ? (
        <EmptyState title="No transactions yet" message="Your withdrawal history will appear here." />
      ) : (
        <AppCard style={styles.txCard}>
          {/* Header row */}
          <View style={[styles.txRow, styles.txHeaderRow, { borderBottomColor: theme.colors.border }]}>
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.txDate}>Date</AppText>
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.txStatus}>Status</AppText>
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.txType}>Type</AppText>
            <AppText variant="caption" color={theme.colors.mutedText} style={[styles.txAmt, { textAlign: 'right' }]}>Amount</AppText>
          </View>
          {transactions.map((txn, i) => (
            <TouchableOpacity
              key={txn._id || i}
              onPress={() => setSelectedTxn(txn)}
              activeOpacity={0.7}
              style={[styles.txRow, { borderBottomColor: theme.colors.border, borderBottomWidth: i < transactions.length - 1 ? StyleSheet.hairlineWidth : 0 }]}
            >
              <AppText variant="caption" color={theme.colors.mutedText} style={styles.txDate}>{fmtDate(txn.createdAt)}</AppText>
              <View style={styles.txStatus}>
                <AppText variant="caption" style={{ color: statusColor(txn.paymentStatus), fontWeight: '600', fontSize: 11 }}>
                  {(txn.paymentStatus || 'pending').toUpperCase()}
                </AppText>
              </View>
              <AppText variant="caption" color={theme.colors.text} style={styles.txType}>
                {txn.isAgentWithdrawal ? 'Withdrawal' : 'Debit'}
              </AppText>
              <AppText variant="label" color={theme.colors.danger} style={[styles.txAmt, { textAlign: 'right' }]}>
                -{fmtAmt(txn.amount)}
              </AppText>
            </TouchableOpacity>
          ))}
        </AppCard>
      )}

      {/* Invoice Modal */}
      <InvoiceModal txn={selectedTxn} userName={user?.fullName ?? ''} onClose={() => setSelectedTxn(null)} />

      {/* Withdraw Confirm Alert */}
      {showWithdraw && (
        <Modal visible animationType="fade" transparent onRequestClose={() => setShowWithdraw(false)}>
          <View style={styles.modalOverlay}>
            <AppCard style={styles.confirmCard}>
              <AppText variant="title" style={{ marginBottom: 8 }}>Confirm Withdrawal</AppText>
              <AppText variant="body" color={theme.colors.mutedText} style={{ marginBottom: 16 }}>
                Withdraw {fmtAmt(avail)} to your linked bank account?
              </AppText>
              <View style={styles.bankRow}>
                <View style={[styles.bankBox, { backgroundColor: '#EFF6FF', borderColor: '#CFE3FF' }]}>
                  <AppText variant="caption" color="#1565C0">Account</AppText>
                  <AppText variant="label" color="#0D47A1">{maskAccount(bankAcc)}</AppText>
                </View>
                <View style={[styles.bankBox, { backgroundColor: '#F4FBEF', borderColor: '#DCEDC8' }]}>
                  <AppText variant="caption" color="#2E7D32">IFSC</AppText>
                  <AppText variant="label" color="#33691E">{bankIfsc}</AppText>
                </View>
              </View>
              <AppText variant="caption" color={theme.colors.mutedText} style={{ marginTop: 12, marginBottom: 20, fontStyle: 'italic' }}>
                💡 Amount will be credited to your bank within 24 hours.
              </AppText>
              <View style={styles.confirmBtns}>
                <AppButton title="Cancel" variant="secondary" onPress={() => setShowWithdraw(false)} style={styles.confirmBtn} />
                <AppButton
                  title="Transfer"
                  onPress={() => withdrawMutation.mutate()}
                  loading={withdrawMutation.isPending}
                  style={styles.confirmBtn}
                />
              </View>
            </AppCard>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  pageHeader: { marginBottom: 20, gap: 2 },
  errorBanner: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 16, gap: 2 },
  summaryCard: { padding: 0, marginBottom: 20, overflow: 'hidden' },
  cardTitleRow: { padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EDF2F7' },
  grid2x2: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 10 },
  statBox: { flex: 1, minWidth: '45%', borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  statLabel: { fontSize: 11, fontWeight: '700' },
  statValue: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  bankRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingBottom: 12 },
  bankBox: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
  withdrawBtn: { marginHorizontal: 12, marginBottom: 14 },
  txCard: { padding: 0 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  txHeaderRow: { backgroundColor: '#F8FAFC' },
  txDate: { flex: 1.2, fontSize: 11 },
  txStatus: { flex: 1, fontSize: 11 },
  txType: { flex: 1, fontSize: 11 },
  txAmt: { flex: 1, fontSize: 12, fontWeight: '700' },
  // Invoice
  invoiceScroll: { flex: 1, backgroundColor: '#F1F5F9' },
  invoiceContent: { padding: 16, paddingBottom: 40 },
  invoiceHeader: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 12, alignItems: 'center', gap: 3 },
  invoiceBrand: { fontSize: 22, color: '#1976D2' },
  invoiceAddr: { textAlign: 'center' },
  invoiceMeta: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', gap: 12 },
  invoiceMetaLeft: { flex: 1.5, gap: 6 },
  invoiceMetaRight: { flex: 1, alignItems: 'flex-end', gap: 2 },
  invoiceMetaRow: { flexDirection: 'row', gap: 4 },
  invoiceMetaKey: { fontWeight: '700', minWidth: 55 },
  invoiceMetaLabel: { fontWeight: '700', letterSpacing: 0.5, fontSize: 10 },
  invoiceTable: { backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  invoiceTableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0' },
  invoiceTableHead: { backgroundColor: '#F8FAFC' },
  invoiceTableCell: { flex: 1 },
  invoiceFooter: { textAlign: 'center', fontStyle: 'italic', marginBottom: 20, marginTop: 4 },
  invoiceClose: { marginTop: 4 },
  // Withdraw Confirm
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  confirmCard: { padding: 20 },
  confirmBtns: { flexDirection: 'row', gap: 10 },
  confirmBtn: { flex: 1 },
});
