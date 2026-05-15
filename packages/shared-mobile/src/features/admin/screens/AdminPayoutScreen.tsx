import React, { useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { walletApi } from '../../../core/api/endpoints/walletApi';
import type { RawPaymentTransaction } from '../../../core/api/endpoints/walletApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';

// ─── Tab definition matches CRM PayoutTabs.jsx ────────────────────────────────
const TABS = [
  { label: 'Pending', paymentType: 'debit' as const, paymentStatus: 'pending' },
  { label: 'Completed', paymentType: 'debit' as const, paymentStatus: 'COMPLETED' },
  { label: 'Rejected', paymentType: 'debit' as const, paymentStatus: 'REJECTED' },
  { label: 'Employer', paymentType: 'credit' as const, creditStatus: 'COMPLETED' },
] as const;

type TabIndex = 0 | 1 | 2 | 3;

const fmtDate = (d: string): string => {
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }); }
  catch { return d; }
};

const fmtAmt = (n?: number): string =>
  `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;

// ─── Editable payout row ──────────────────────────────────────────────────────
interface PayoutRowProps {
  txn: RawPaymentTransaction;
  tabIndex: TabIndex;
  onApprove: (id: string, amount: number, incentive: number, txnId: string, comment: string) => void;
  onReject: (id: string) => void;
}

const PayoutRow = ({ txn, tabIndex, onApprove, onReject }: PayoutRowProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const [amount, setAmount] = useState(String(Math.round(txn.amount ?? 0)));
  const [incentive, setIncentive] = useState(String(txn.incentiveCharges ?? 0));
  const [txnId, setTxnId] = useState(txn.creditTransactionId ?? '');
  const [comment, setComment] = useState(txn.payoutComment ?? '');
  const [expanded, setExpanded] = useState(false);

  const name = tabIndex === 3 ? (txn.employerName ?? '—') : (txn.agentName ?? '—');

  return (
    <AppCard style={styles.rowCard}>
      <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.8}>
        <View style={styles.rowHeader}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="label" numberOfLines={1}>{name}</AppText>
            <AppText variant="caption" color={theme.colors.mutedText}>{fmtDate(txn.createdAt)}</AppText>
          </View>
          <View style={styles.rowRight}>
            <AppText variant="label" color={theme.colors.primary}>{fmtAmt(txn.amount)}</AppText>
            {tabIndex === 3 && txn.ernNumber && (
              <AppText variant="caption" color={theme.colors.mutedText}>{txn.ernNumber}</AppText>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Employer (tab 3) — read-only details */}
      {expanded && tabIndex === 3 && (
        <View style={[styles.expandedBlock, { borderTopColor: theme.colors.border }]}>
          {[
            ['Payment Date', fmtDate(txn.paymentDateTime ?? txn.createdAt)],
            ['Mode', txn.creditPaymentMethod ?? 'N/A'],
            ['Txn ID', txn.creditTransactionId ?? 'N/A'],
            ['Platform Charges', fmtAmt(txn.platformCharges)],
            ['GST Charges', fmtAmt(txn.gstCharges)],
            ['Net Amount', `₹${((txn.amount ?? 0) - (txn.platformCharges ?? 0) - (txn.gstCharges ?? 0)).toFixed(2)}`],
            ['Remarks', txn.payoutComment ?? 'N/A'],
          ].map(([k, v]) => (
            <View key={k} style={styles.detailRow}>
              <AppText variant="caption" color={theme.colors.mutedText} style={styles.detailKey}>{k}:</AppText>
              <AppText variant="caption" color={theme.colors.text} style={{ flex: 1 }}>{v}</AppText>
            </View>
          ))}
        </View>
      )}

      {/* Pending (tab 0) — editable fields + approve/reject */}
      {expanded && tabIndex === 0 && (
        <View style={[styles.expandedBlock, { borderTopColor: theme.colors.border }]}>
          <View style={styles.fieldRow}>
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.fieldLabel}>Amount</AppText>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              style={[styles.fieldInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
            />
          </View>
          <View style={styles.fieldRow}>
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.fieldLabel}>Incentive</AppText>
            <TextInput
              value={incentive}
              onChangeText={setIncentive}
              keyboardType="numeric"
              style={[styles.fieldInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
            />
          </View>
          <View style={styles.fieldRow}>
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.fieldLabel}>Txn ID</AppText>
            <TextInput
              value={txnId}
              onChangeText={setTxnId}
              placeholder="Enter transaction ID"
              placeholderTextColor={theme.colors.mutedText}
              style={[styles.fieldInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
            />
          </View>
          <View style={styles.fieldRow}>
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.fieldLabel}>Comment</AppText>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Add comment"
              placeholderTextColor={theme.colors.mutedText}
              style={[styles.fieldInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
            />
          </View>
          <View style={styles.actionRow}>
            <AppButton
              title="Approve"
              onPress={() => onApprove(txn._id, Number(amount), Number(incentive), txnId, comment)}
              style={[styles.actionBtn, { flex: 1.2 }]}
            />
            <AppButton
              title="Reject"
              variant="secondary"
              onPress={() => onReject(txn._id)}
              style={styles.actionBtn}
            />
          </View>
        </View>
      )}

      {/* Completed / Rejected — read-only details */}
      {expanded && (tabIndex === 1 || tabIndex === 2) && (
        <View style={[styles.expandedBlock, { borderTopColor: theme.colors.border }]}>
          {[
            ['Agent', txn.agentName ?? 'N/A'],
            ['Txn ID', txn.creditTransactionId ?? 'N/A'],
            ['Incentive', fmtAmt(txn.incentiveCharges)],
            ['Comment', txn.payoutComment ?? 'N/A'],
          ].map(([k, v]) => (
            <View key={k} style={styles.detailRow}>
              <AppText variant="caption" color={theme.colors.mutedText} style={styles.detailKey}>{k}:</AppText>
              <AppText variant="caption" color={theme.colors.text} style={{ flex: 1 }}>{v}</AppText>
            </View>
          ))}
        </View>
      )}
    </AppCard>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const AdminPayoutScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const queryClient = useQueryClient();
  const [tabIndex, setTabIndex] = useState<TabIndex>(0);
  const [page] = useState(1);

  const tab = TABS[tabIndex];
  const params = {
    paymentType: tab.paymentType,
    page,
    limit: 10,
    ...('paymentStatus' in tab ? { paymentStatus: tab.paymentStatus } : {}),
    ...('creditStatus' in tab ? { creditStatus: tab.creditStatus } : {}),
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-payouts', tabIndex, page],
    queryFn: () => walletApi.getAdminPayoutList(params),
    staleTime: 30 * 1000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, amount, incentive, txnId, comment }: {
      id: string; amount: number; incentive: number; txnId: string; comment: string;
    }) => walletApi.updatePayout(id, {
      amount,
      incentiveCharges: incentive,
      creditTransactionId: txnId,
      payoutComment: comment,
      paymentStatus: 'COMPLETED',
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
      Alert.alert('Success', 'Payout approved successfully.');
    },
    onError: () => Alert.alert('Error', 'Failed to approve payout.'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => walletApi.updatePayout(id, { paymentStatus: 'REJECTED' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
      Alert.alert('Done', 'Payout rejected.');
    },
    onError: () => Alert.alert('Error', 'Failed to reject payout.'),
  });

  const handleApprove = (id: string, amount: number, incentive: number, txnId: string, comment: string): void => {
    Alert.alert('Confirm Approval', `Approve payout of ${fmtAmt(amount)}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => approveMutation.mutate({ id, amount, incentive, txnId, comment }) },
    ]);
  };

  const handleReject = (id: string): void => {
    Alert.alert('Confirm Rejection', 'Reject this payout request?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => rejectMutation.mutate(id) },
    ]);
  };

  const transactions: RawPaymentTransaction[] = data?.transactions ?? [];

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void refetch()} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Page Header */}
      <View style={styles.pageHeader}>
        <AppText variant="title">Payout Management</AppText>
        <AppText variant="caption" color={theme.colors.mutedText}>Review and approve agent payouts</AppText>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        {TABS.map((t, i) => (
          <TouchableOpacity
            key={t.label}
            onPress={() => setTabIndex(i as TabIndex)}
            style={[
              styles.tab,
              {
                backgroundColor: tabIndex === i ? theme.colors.primary : theme.colors.card,
                borderColor: tabIndex === i ? theme.colors.primary : theme.colors.border,
              },
            ]}
          >
            <AppText
              variant="caption"
              color={tabIndex === i ? '#FFFFFF' : theme.colors.text}
              style={styles.tabLabel}
            >
              {t.label}
            </AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Count */}
      {!isLoading && (
        <AppText variant="caption" color={theme.colors.mutedText} style={styles.countText}>
          {transactions.length} record{transactions.length !== 1 ? 's' : ''}
          {data?.totalCount && data.totalCount > transactions.length ? ` of ${data.totalCount}` : ''}
        </AppText>
      )}

      {/* List */}
      {isLoading ? (
        <LoadingState message="Loading payout requests…" />
      ) : transactions.length === 0 ? (
        <EmptyState title="No records" message={`No ${TABS[tabIndex].label.toLowerCase()} payout requests.`} />
      ) : (
        transactions.map((txn, i) => (
          <PayoutRow
            key={txn._id || i}
            txn={txn}
            tabIndex={tabIndex}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  pageHeader: { marginBottom: 16, gap: 2 },
  tabsRow: { flexDirection: 'row', gap: 8, paddingBottom: 14 },
  tab: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  tabLabel: { fontWeight: '700' },
  countText: { marginBottom: 12 },
  rowCard: { padding: 0, marginBottom: 10, overflow: 'hidden' },
  rowHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  expandedBlock: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  detailRow: { flexDirection: 'row', gap: 6 },
  detailKey: { minWidth: 110, fontWeight: '600' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldLabel: { minWidth: 70, fontWeight: '600' },
  fieldInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { flex: 1 },
});
