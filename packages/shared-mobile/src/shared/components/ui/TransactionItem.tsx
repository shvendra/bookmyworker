import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../core/theme';
import type { WalletTransaction } from '../../types/domain';
import { AppText } from './AppText';
import { Badge, statusToBadgeVariant } from './Badge';

interface TransactionItemProps {
  transaction: WalletTransaction;
}

// Build the date formatter ONCE (module scope) instead of per-render/per-call —
// Intl construction is expensive under Hermes and this row renders in a list.
const txnDateFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const formatTxnDate = (dateStr: string): string => {
  try {
    return txnDateFmt.format(new Date(dateStr));
  } catch {
    return dateStr;
  }
};

export const TransactionItem = ({ transaction }: TransactionItemProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const isCredit = transaction.direction === 'credit';
  const amountColor = isCredit ? theme.colors.success : theme.colors.danger;

  return (
    <View style={[styles.item, { borderBottomColor: theme.colors.border }]}>
      <View style={styles.left}>
        <View style={[styles.icon, { backgroundColor: amountColor + '15' }]}>
          <AppText variant="body" color={amountColor}>
            {isCredit ? '↓' : '↑'}
          </AppText>
        </View>
        <View style={styles.info}>
          <AppText variant="label">{transaction.description}</AppText>
          <AppText variant="caption" color={theme.colors.mutedText}>
            {formatTxnDate(transaction.createdAt)}
          </AppText>
        </View>
      </View>
      <View style={styles.right}>
        <AppText variant="label" color={amountColor}>
          {isCredit ? '+' : '-'}₹{transaction.amount.toLocaleString('en-IN')}
        </AppText>
        <Badge label={transaction.status} variant={statusToBadgeVariant(transaction.status)} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
});
