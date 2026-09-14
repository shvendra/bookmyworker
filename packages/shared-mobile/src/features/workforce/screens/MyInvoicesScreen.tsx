import React from 'react';
import { FlatList, RefreshControl, StatusBar, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { Badge, type BadgeVariant } from '../../../shared/components/ui/Badge';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { LoadingState } from '../../../shared/components/feedback/LoadingState';
import { useAppTheme } from '../../../core/theme';
import { clientCompaniesApi } from '../../../core/api/endpoints/clientCompaniesApi';
import {
  clientInvoicesApi,
  type ClientInvoice,
  type ClientInvoiceStatus,
} from '../../../core/api/endpoints/clientInvoicesApi';
import { paymentSubmissionsApi } from '../../../core/api/endpoints/paymentSubmissionsApi';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'MyWorkforceInvoices'>;

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

const formatDate = (d?: string): string => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
};

const formatMoney = (n?: number): string => `₹${(n ?? 0).toLocaleString('en-IN')}`;

interface RowProps {
  item: ClientInvoice;
  onPress: () => void;
}

const InvoiceRow = React.memo(({ item, onPress }: RowProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const statusVariant = STATUS_BADGE_VARIANT[item.status] ?? 'neutral';
  const statusLabel = t(STATUS_LABEL_KEY[item.status] ?? 'wf_invoice_status_draft');

  return (
    <AppCard onPress={onPress} style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <AppText variant="label" color={theme.colors.text} style={styles.invoiceNumber} numberOfLines={1}>
          {item.invoiceNumber || t('wf_invoice_draft_fallback')}
        </AppText>
        <Badge label={statusLabel} variant={statusVariant} size="sm" />
      </View>
      <AppText variant="numeric" color={theme.colors.text} style={styles.amount}>
        {formatMoney(item.totalAmount)}
      </AppText>
      <AppText variant="caption" color={theme.colors.mutedText}>
        {t('wf_invoice_due_on', { date: formatDate(item.dueDate) })}
      </AppText>
    </AppCard>
  );
});
InvoiceRow.displayName = 'InvoiceRow';

interface LedgerTileProps {
  label: string;
  value: number;
  color: string;
}

const LedgerTile = ({ label, value, color }: LedgerTileProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <AppText variant="micro" color={theme.colors.mutedText} style={styles.tileLabel}>
        {label.toUpperCase()}
      </AppText>
      <AppText
        variant="label"
        color={color}
        style={styles.tileValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {formatMoney(value)}
      </AppText>
    </View>
  );
};

/**
 * Ports MyInvoicesPage.jsx → InvoicesSection.jsx's employer-facing list +
 * ledger strip. Reuses the exact "no company yet" gating pattern from
 * MyWorkforceRequirementsScreen.tsx (Phase 2) — same query key
 * ('wf-my-company'), so the cache is shared and no extra round-trip happens
 * when both screens are visited in one session.
 */
export const MyInvoicesScreen = ({ navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');

  const companyQuery = useQuery({
    queryKey: ['wf-my-company'],
    queryFn: () => clientCompaniesApi.getMyCompany(),
    staleTime: 60_000,
  });

  const hasCompany = !!companyQuery.data;
  const clientCompanyId = companyQuery.data?._id;

  const invoicesQuery = useQuery({
    queryKey: ['wf-invoices-mine', clientCompanyId],
    queryFn: () => clientInvoicesApi.listMine(clientCompanyId as string),
    enabled: hasCompany && !!clientCompanyId,
    staleTime: 30_000,
  });

  const ledgerQuery = useQuery({
    queryKey: ['wf-ledger', clientCompanyId],
    queryFn: () => paymentSubmissionsApi.getLedger(clientCompanyId as string),
    enabled: hasCompany && !!clientCompanyId,
    staleTime: 30_000,
  });

  const invoices = invoicesQuery.data ?? [];
  const ledger = ledgerQuery.data;

  const goToDetail = (id: string): void => navigation.navigate('WorkforceInvoiceDetail', { id });

  if (companyQuery.isLoading) {
    return <LoadingState message={t('wf_invoices_title')} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader title={t('wf_invoices_title')} onBack={() => navigation.goBack()} />

      {companyQuery.isError ? (
        <ErrorState onRetry={() => void companyQuery.refetch()} />
      ) : !hasCompany ? (
        <EmptyState icon="🏢" title={t('wf_not_setup_title')} description={t('wf_not_setup_body')} />
      ) : invoicesQuery.isLoading ? (
        <LoadingState message={t('wf_invoices_title')} />
      ) : invoicesQuery.isError ? (
        <ErrorState
          title={t('wf_load_invoices_failed')}
          description={t('wf_load_invoices_failed_body')}
          onRetry={() => void invoicesQuery.refetch()}
        />
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item: ClientInvoice) => item._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={invoicesQuery.isFetching || ledgerQuery.isFetching}
              onRefresh={() => {
                void invoicesQuery.refetch();
                void ledgerQuery.refetch();
              }}
            />
          }
          ListHeaderComponent={
            ledger ? (
              <View style={styles.ledgerRow}>
                <LedgerTile label={t('wf_ledger_invoiced')} value={ledger.totalInvoiced} color={theme.colors.text} />
                <LedgerTile label={t('wf_ledger_verified_paid')} value={ledger.totalVerifiedPaid} color={theme.colors.success} />
                <LedgerTile label={t('wf_ledger_outstanding')} value={ledger.totalOutstanding} color={theme.colors.warning} />
                <LedgerTile label={t('wf_ledger_credit_balance')} value={ledger.creditBalance} color={theme.colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState icon="🧾" title={t('wf_invoices_empty')} description={t('wf_invoices_empty_body')} />
          }
          renderItem={({ item }: { item: ClientInvoice }) => (
            <InvoiceRow item={item} onPress={() => goToDetail(item._id)} />
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 40 },
  ledgerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  tile: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  tileLabel: { marginBottom: 4, letterSpacing: 0.4 },
  tileValue: {},
  card: { marginBottom: 12 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 },
  invoiceNumber: { flex: 1 },
  amount: { marginBottom: 2 },
});
