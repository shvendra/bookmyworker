import React, { useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { walletApi, type RawPaymentTransaction, type WithdrawalPayload } from '../../../core/api/endpoints/walletApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { SectionHeader } from '../../../shared/components/ui/SectionHeader';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';

const FILTER_TYPES = ['all', 'payout', 'commission', 'topup', 'charge'] as const;
type FilterType = typeof FILTER_TYPES[number];

const fmtDate = (d: string): string => {
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};
const fmtAmt = (n?: number): string => `₹${(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const txStatusColor = (s?: string): string => {
  const l = (s ?? '').toLowerCase();
  if (l === 'completed' || l === 'done') return '#10B981';
  if (l === 'rejected') return '#EF4444';
  return '#F59E0B';
};

const WalletTxRow = ({ tx, isLast }: { tx: RawPaymentTransaction; isLast: boolean }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const status = tx.creditStatus ?? tx.paymentStatus ?? tx.withdrawalStatus ?? 'pending';
  return (
    <View style={[styles.txRow, { borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }]}>
      <AppText variant="caption" color={theme.colors.mutedText} style={styles.colDate}>{fmtDate(tx.createdAt)}</AppText>
      <AppText variant="caption" style={[styles.colStatus, { color: txStatusColor(status), fontWeight: '600' }]}>
        {status.toUpperCase()}
      </AppText>
      <AppText variant="caption" color={theme.colors.text} style={styles.colMethod}>
        {tx.creditPaymentMethod ?? tx.paymentType ?? '—'}
      </AppText>
      <AppText variant="label" color={theme.colors.success} style={[styles.colAmt, { textAlign: 'right' }]}>
        {fmtAmt(tx.amount)}
      </AppText>
    </View>
  );
};

export const WalletScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterType>('all');

  const user = state.session?.user;
  const userId = user?.id ?? '';
  const role = user?.role;

  const {
    data: balance,
    isLoading: balanceLoading,
  } = useQuery({
    queryKey: ['wallet-balance', userId],
    queryFn: walletApi.getMyWalletBalance,
    staleTime: 2 * 60 * 1000,
    enabled: !!userId,
  });

  const {
    data: txList,
    isLoading: txLoading,
    isError: txError,
    refetch: refetchTx,
  } = useQuery<RawPaymentTransaction[]>({
    queryKey: ['wallet-transactions', userId, role],
    queryFn: async () => {
      if (role === 'employer') {
        const res = await walletApi.getEmployerTransactions(userId);
        return res.transactions ?? [];
      }
      const res = await walletApi.getAgentPayoutSummary(userId);
      return res.debitTransactions ?? [];
    },
    staleTime: 60 * 1000,
    enabled: !!userId,
  });

  const payoutMutation = useMutation({
    mutationFn: (amount: number) => walletApi.requestWithdrawal({ amount } as unknown as WithdrawalPayload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      Alert.alert('Success', 'Withdrawal request submitted. You will receive funds within 24 hours.');
    },
    onError: () => Alert.alert('Error', 'Could not process withdrawal request. Try again.'),
  });

  const handlePayout = (): void => {
    const bal = balance ?? 0;
    if (bal < 100) {
      Alert.alert('Insufficient Balance', 'Minimum payout amount is ₹100.');
      return;
    }
    Alert.alert(
      'Request Payout',
      `Withdraw ₹${bal.toLocaleString('en-IN')} to your linked bank account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => payoutMutation.mutate(bal) },
      ]
    );
  };

  const isLoading = balanceLoading || txLoading;

  const handleRefresh = (): void => {
    void refetchTx();
  };

  const allTransactions: RawPaymentTransaction[] = txList ?? [];
  const transactions =
    filter === 'all'
      ? allTransactions
      : allTransactions.filter((t) => (t.paymentType ?? '').toLowerCase() === filter);

  const balanceDisplay = balance ?? 0;

  const walletTitle = role === 'employer' ? 'Business Wallet' : role === 'agent' ? 'Commission Wallet' : 'My Wallet';
  const payoutLabel = role === 'employer' ? 'Add Funds' : 'Request Payout';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1338B0" />
      <ScreenHeader title="Wallet" />
      <ScrollView
        style={[styles.scroll, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
      {/* Balance Card */}
      <View style={[styles.balanceCard, { backgroundColor: theme.colors.primary }]}>
        <AppText variant="caption" color="rgba(255,255,255,0.8)">{walletTitle}</AppText>
        <AppText variant="title" color="#FFFFFF" style={styles.balanceAmount}>
          ₹{balanceDisplay.toLocaleString('en-IN')}
        </AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.7)" style={styles.balanceSub}>
          Available Balance
        </AppText>

        {(role === 'agent' || role === 'worker') && (
          <AppButton
            title={payoutLabel}
            onPress={handlePayout}
            loading={payoutMutation.isPending}
            variant="ghost"
            style={styles.payoutBtn}
          />
        )}
      </View>

      {/* Role-specific info */}
      {role === 'employer' && (
        <AppCard style={[styles.infoCard, { backgroundColor: theme.colors.warning + '15' }]}>
          <AppText variant="label">💳 Subscription & Payments</AppText>
          <AppText variant="caption" color={theme.colors.mutedText} style={styles.infoText}>
            Your subscription charges and requirement payment history are shown below.
          </AppText>
        </AppCard>
      )}
      {role === 'agent' && (
        <AppCard style={[styles.infoCard, { backgroundColor: theme.colors.success + '15' }]}>
          <AppText variant="label">💰 Commission Earnings</AppText>
          <AppText variant="caption" color={theme.colors.mutedText} style={styles.infoText}>
            Earn commission for every worker you successfully place in a job.
          </AppText>
        </AppCard>
      )}

      {/* Transaction Filters */}
      <SectionHeader title="Transaction History" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTER_TYPES.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.filterChip,
              {
                backgroundColor: filter === f ? theme.colors.primary : theme.colors.card,
                borderColor: filter === f ? theme.colors.primary : theme.colors.border,
              },
            ]}
          >
            <AppText
              variant="caption"
              color={filter === f ? '#FFFFFF' : theme.colors.text}
              style={styles.filterText}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Transaction List */}
      {txLoading ? (
        <LoadingState message="Loading transactions…" />
      ) : txError ? (
        <ErrorState
          title="Unable to Load Transactions"
          message="Something went wrong while fetching your transaction history. Please check your connection and try again."
          onRetry={() => void refetchTx()}
        />
      ) : transactions.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          message={
            role === 'employer'
              ? 'Your payment and subscription history will appear here.'
              : 'Your commission and payout history will appear here.'
          }
        />
      ) : (
        <AppCard style={styles.txCard}>
          {transactions.map((tx, i) => (
            <WalletTxRow
              key={tx._id || i}
              tx={tx}
              isLast={i === transactions.length - 1}
            />
          ))}
        </AppCard>
      )}
    </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  balanceCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  balanceAmount: {
    fontSize: 40,
    lineHeight: 48,
    marginTop: 4,
  },
  balanceSub: { marginTop: 2, marginBottom: 16 },
  payoutBtn: {
    borderColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    width: '100%',
  },
  infoCard: { marginBottom: 20, padding: 14 },
  infoText: { marginTop: 4 },
  filters: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  filterChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  filterText: { fontWeight: '600' },
  txCard: { padding: 0 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  colDate: { flex: 1.2, fontSize: 11 },
  colStatus: { flex: 1.1, fontSize: 11 },
  colMethod: { flex: 0.9, fontSize: 11 },
  colAmt: { flex: 1, fontSize: 12, fontWeight: '700' },
});
