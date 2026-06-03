import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useQuery } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { useAppConfig } from '../../../core/api/endpoints/appConfigApi';
import { usePricingConfig } from '../../../core/api/endpoints/pricingApi';
import { walletApi } from '../../../core/api/endpoints/walletApi';
import type { RawPaymentTransaction } from '../../../core/api/endpoints/walletApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import i18n from '../../../core/i18n';
import { useTranslation } from 'react-i18next';
import { getLocationStr } from '../../../shared/utils/labelUtils';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d?: string): string => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const fmtAmt = (n?: number): string =>
  `₹${(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusColor = (s?: string): string => {
  if (!s) return '#6B7280';
  const l = s.toLowerCase();
  if (l === 'completed' || l === 'done') return '#10B981';
  if (l === 'rejected') return '#EF4444';
  return '#F59E0B';
};

// ─── Invoice Modal ─────────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');

interface InvoiceProps {
  txn: RawPaymentTransaction | null;
  userName: string;
  userKyc?: { firmName?: string; gstNumber?: string };
  userAddress?: string;
  companyAddress: string;
  supportEmail:   string;
  gstNumber:      string;
  gstLabel:       string;
  onClose: () => void;
}

const InvoiceModal = ({ txn, userName, userKyc, userAddress, companyAddress, supportEmail, gstNumber, gstLabel, onClose }: InvoiceProps): React.JSX.Element | null => {
  const { t } = useTranslation('employer');
  const insets = useSafeAreaInsets();
  if (!txn) return null;

  const platform = txn.platformCharges ?? 0;
  const gst      = txn.gstCharges ?? 0;
  const total    = (txn.amount ?? 0) + platform;
  const base     = total - gst;

  const lineItems: Array<{ label: string; value: string; isTotal?: boolean; isHeader?: boolean }> = [
    { label: t('jp_invDescription'), value: t('jp_invAmountRupees'), isHeader: true },
    { label: t('jp_invPayment'), value: base.toFixed(2) },
    ...(platform > 0 ? [{ label: t('jp_invPlatformCharges'), value: platform.toFixed(2) }] : []),
    ...(gst > 0 ? [{ label: gstLabel, value: gst.toFixed(2) }] : []),
    { label: t('jp_invTotal'), value: `₹${total.toFixed(2)}`, isTotal: true },
  ];

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={onClose}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <View style={[inv.root, { paddingTop: insets.top }]}>
        {/* Top bar */}
        <View style={inv.topBar}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={inv.closeBtn}>
            <AppText style={inv.closeTxt}>✕</AppText>
          </TouchableOpacity>
          <AppText style={inv.topTitle}>{t('jp_invoice')}</AppText>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[inv.scroll, { paddingBottom: insets.bottom + 24 }]}
        >
          {/* Brand header */}
          <View style={inv.brandCard}>
            <View style={inv.brandAccent} />
            <View style={inv.brandBody}>
              <AppText style={inv.brandName}>BookMyWorker</AppText>
              <AppText style={inv.brandAddr}>{companyAddress}</AppText>
              <AppText style={inv.brandEmail}>{supportEmail}</AppText>
              <View style={inv.gstPill}>
                <AppText style={inv.gstTxt}>GSTIN: {gstNumber}</AppText>
              </View>
            </View>
          </View>

          {/* Bill to + Invoice meta */}
          <View style={inv.metaRow}>
            {/* Bill to */}
            <View style={[inv.metaCard, { flex: 1.4 }]}>
              <AppText style={inv.metaHead}>{t('jp_invBillTo')}</AppText>
              {([
                [t('jp_invName'), userName],
                [t('jp_invFirm'), userKyc?.firmName || t('jp_invNA')],
                [t('jp_invGst'), userKyc?.gstNumber || t('jp_invNA')],
                [t('jp_invAddress'), userAddress || t('jp_invNA')],
              ] as [string, string][]).map(([k, v]) => (
                <View key={k} style={inv.metaLine}>
                  <AppText style={inv.metaKey}>{k}</AppText>
                  <AppText style={inv.metaVal} numberOfLines={2}>{v}</AppText>
                </View>
              ))}
            </View>

            {/* Invoice details */}
            <View style={[inv.metaCard, { flex: 1, alignItems: 'flex-end' }]}>
              <AppText style={inv.metaHead}>{t('jp_invDetails')}</AppText>
              <AppText style={inv.metaKey}>{t('jp_invDate')}</AppText>
              <AppText style={[inv.metaVal, { textAlign: 'right' }]}>{fmtDate(txn.createdAt)}</AppText>
              <AppText style={[inv.metaKey, { marginTop: 10 }]}>{t('jp_invTxnId')}</AppText>
              <AppText style={[inv.metaVal, { textAlign: 'right', fontSize: 10 }]} numberOfLines={3}>
                {txn.creditTransactionId || t('jp_invNA')}
              </AppText>
            </View>
          </View>

          {/* Line items table */}
          <View style={inv.table}>
            {lineItems.map((item) => (
              <View
                key={item.label}
                style={[
                  inv.tableRow,
                  item.isHeader && inv.tableHeaderRow,
                  item.isTotal && inv.tableTotalRow,
                ]}
              >
                <AppText
                  style={[
                    inv.tableLabel,
                    item.isHeader && inv.tableHeaderTxt,
                    item.isTotal && inv.tableTotalLabel,
                  ]}
                >
                  {item.label}
                </AppText>
                <AppText
                  style={[
                    inv.tableValue,
                    item.isHeader && inv.tableHeaderTxt,
                    item.isTotal && inv.tableTotalValue,
                  ]}
                >
                  {item.value}
                </AppText>
              </View>
            ))}
          </View>

          {/* Disclaimer */}
          <AppText style={inv.disclaimer}>
            {t('jp_invDisclaimer')}
          </AppText>

          {/* Close button */}
          <TouchableOpacity onPress={onClose} style={inv.closeAction} activeOpacity={0.85}>
            <AppText style={inv.closeActionTxt}>{t('jp_close')}</AppText>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

const inv = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#F8FAFC' },
  topBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#F8FAFC', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0' },
  topTitle:{ fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: 0.2 },
  closeBtn:{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  closeTxt:{ fontSize: 13, color: '#64748B', fontWeight: '700' },

  scroll:  { paddingHorizontal: Math.max(16, (SCREEN_W - 480) / 2), paddingTop: 20 },

  // Brand card
  brandCard:  { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
  brandAccent:{ height: 5, backgroundColor: '#1037A4' },
  brandBody:  { padding: 18, alignItems: 'center', gap: 4 },
  brandName:  { fontSize: 20, fontWeight: '900', color: '#1037A4', letterSpacing: 0.3 },
  brandAddr:  { fontSize: 11, color: '#64748B', textAlign: 'center', lineHeight: 16 },
  brandEmail: { fontSize: 11, color: '#64748B' },
  gstPill:    { backgroundColor: '#EFF6FF', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4, borderWidth: 1, borderColor: '#BFDBFE' },
  gstTxt:     { fontSize: 11, fontWeight: '800', color: '#1D4ED8' },

  // Meta row
  metaRow:    { flexDirection: 'row', gap: 10, marginBottom: 12 },
  metaCard:   { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 3 },
  metaHead:   { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  metaLine:   { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  metaKey:    { fontSize: 10, fontWeight: '700', color: '#64748B', minWidth: 50 },
  metaVal:    { fontSize: 11, fontWeight: '600', color: '#1E293B', flex: 1 },

  // Table
  table:        { backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  tableRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F1F5F9' },
  tableHeaderRow:{ backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tableTotalRow: { backgroundColor: '#EFF6FF', borderBottomWidth: 0 },
  tableLabel:   { fontSize: 13, color: '#475569', flex: 1 },
  tableValue:   { fontSize: 13, color: '#1E293B', fontWeight: '600' },
  tableHeaderTxt:{ fontSize: 11, fontWeight: '800', color: '#334155', textTransform: 'uppercase', letterSpacing: 0.3 },
  tableTotalLabel:{ fontSize: 14, fontWeight: '800', color: '#1037A4' },
  tableTotalValue:{ fontSize: 16, fontWeight: '900', color: '#1037A4' },

  disclaimer:  { fontSize: 11, color: '#94A3B8', textAlign: 'center', fontStyle: 'italic', marginBottom: 20, lineHeight: 16, paddingHorizontal: 8 },
  closeAction: { backgroundColor: '#1037A4', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  closeActionTxt:{ fontSize: 15, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
});

// ─── Payments Tab ──────────────────────────────────────────────────────────────
const PaymentsTab = (): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const { config } = useAppConfig();
  const { pricing } = usePricingConfig();
  const gstLabel = t('jp_invGstPercent', { pct: pricing.gstPercentage });
  const user   = state.session?.user;
  const userId = user?.id ?? '';
  const [selectedTxn, setSelectedTxn] = useState<RawPaymentTransaction | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['employer-transactions', userId],
    queryFn: () => walletApi.getEmployerTransactions(userId),
    staleTime: 60 * 1000,
    enabled: !!userId,
  });

  const { data: userFull } = useQuery({
    queryKey: ['employer-full-profile'],
    queryFn: async () => {
      const { apiClient } = await import('../../../core/api/client');
      const res = await apiClient.get<{ user?: { kyc?: { firmName?: string; gstNumber?: string }; block?: string; district?: string; state?: string } }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    staleTime: 10 * 60 * 1000,
  });

  const transactions = data?.transactions ?? [];
  const totalPaid    = transactions.reduce((s, t) => s + (t.amount ?? 0), 0);
  const u            = userFull;
  const userAddress  = getLocationStr({ tehsil: u?.block, district: u?.district, state: u?.state }, i18n.language, '');

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor={theme.colors.primary} />}
    >
      {/* Summary banner */}
      <View style={[pay.banner, { backgroundColor: '#1E40AF' }]}>
        <AppText variant="caption" color="rgba(255,255,255,0.7)">{t('transactionAmount')}</AppText>
        <AppText style={pay.bannerAmt}>{fmtAmt(totalPaid)}</AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.6)">
          {t('jp_txnCount', { count: transactions.length })}
        </AppText>
      </View>

      {isLoading ? (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : transactions.length === 0 ? (
        <EmptyState title={t('noTransactions')} message={t('noTransactions')} />
      ) : (
        <AppCard style={{ padding: 0, overflow: 'hidden' }}>
          <View style={[pay.row, { backgroundColor: '#f8fafc' }]}>
            <AppText style={[pay.th, { flex: 1.2 }]}>{t('transactionDate')}</AppText>
            <AppText style={[pay.th, { flex: 1 }]}>{t('transactionStatus')}</AppText>
            <AppText style={[pay.th, { flex: 0.9 }]}>{t('jp_txnMode')}</AppText>
            <AppText style={[pay.th, { flex: 1, textAlign: 'right' }]}>{t('transactionAmount')}</AppText>
          </View>
          {transactions.map((txn, i) => (
            <TouchableOpacity
              key={txn._id || i}
              onPress={() => setSelectedTxn(txn)}
              activeOpacity={0.75}
              style={[
                pay.row,
                { backgroundColor: i % 2 === 0 ? theme.colors.card : theme.colors.surface },
                i < transactions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
              ]}
            >
              <AppText style={[pay.td, { flex: 1.2, color: theme.colors.mutedText }]}>{fmtDate(txn.createdAt)}</AppText>
              <AppText style={[pay.td, { flex: 1, color: statusColor(txn.creditStatus), fontWeight: '700' }]}>
                {(txn.creditStatus || 'PENDING').toUpperCase()}
              </AppText>
              <AppText style={[pay.td, { flex: 0.9 }]} numberOfLines={1}>
                {txn.creditPaymentMethod || txn.paymentType || '—'}
              </AppText>
              <AppText style={[pay.td, { flex: 1, textAlign: 'right', color: '#16a34a', fontWeight: '700' }]}>
                {fmtAmt(txn.amount)}
              </AppText>
            </TouchableOpacity>
          ))}
        </AppCard>
      )}

      <InvoiceModal
        txn={selectedTxn}
        userName={user?.fullName ?? ''}
        userKyc={u?.kyc}
        userAddress={userAddress}
        companyAddress={config.contact.companyAddress}
        supportEmail={config.contact.supportEmail}
        gstNumber={config.contact.gstNumber}
        gstLabel={gstLabel}
        onClose={() => setSelectedTxn(null)}
      />
    </ScrollView>
  );
};

const pay = StyleSheet.create({
  banner:    { borderRadius: 16, padding: 20, marginBottom: 20, alignItems: 'center', gap: 4 },
  bannerAmt: { color: '#fff', fontSize: 30, fontWeight: '800', lineHeight: 38, marginTop: 2 },
  row:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  th:        { fontSize: 11, fontWeight: '800', color: '#334155' },
  td:        { fontSize: 12 },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export const TransactionScreen = (): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const navigation = useNavigation();

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title={t('transactionsTitle')} onBack={() => navigation.goBack()} />
      <PaymentsTab />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
});
