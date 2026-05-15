import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { walletApi } from '../../../core/api/endpoints/walletApi';
import type { RawPaymentTransaction } from '../../../core/api/endpoints/walletApi';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';

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
interface InvoiceProps {
  txn: RawPaymentTransaction | null;
  userName: string;
  userKyc?: { firmName?: string; gstNumber?: string };
  userAddress?: string;
  onClose: () => void;
}

const InvoiceModal = ({ txn, userName, userKyc, userAddress, onClose }: InvoiceProps): React.JSX.Element | null => {
  if (!txn) return null;
  const base     = (txn.amount ?? 0) / 1.18;
  const platform = txn.platformCharges ?? 0;
  const gst      = txn.amount ? txn.amount - txn.amount / 1.18 : 0;
  const total    = (txn.amount ?? 0) + platform + (txn.gstCharges ?? 0);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={inv.scroll} contentContainerStyle={inv.content}>
        <View style={inv.header}>
          <AppText variant="title" color="#1976D2" style={{ fontSize: 22 }}>BookMyWorker</AppText>
          <AppText variant="caption" color="#64748B" style={{ textAlign: 'center' }}>
            Khasara No 34/1/33, Rewa Semariya Road, Karahiya, Rewa, MP - 486450
          </AppText>
          <AppText variant="caption" color="#64748B">support@bookmyworkers.com</AppText>
          <AppText variant="caption" color="#1E293B" style={{ fontWeight: '700' }}>GSTIN: 23NBJPS3070R1ZQ</AppText>
        </View>

        <View style={inv.meta}>
          <View style={{ flex: 1.4, gap: 5 }}>
            {([['Name', userName], ['Firm', userKyc?.firmName || 'N/A'], ['GST', userKyc?.gstNumber || 'N/A'], ['Address', userAddress || 'N/A']] as [string,string][]).map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', gap: 4 }}>
                <AppText variant="caption" color="#64748B" style={{ fontWeight: '700', minWidth: 55 }}>{k}:</AppText>
                <AppText variant="caption" color="#1E293B" style={{ fontWeight: '600', flex: 1 }}>{v}</AppText>
              </View>
            ))}
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
            <AppText variant="caption" color="#94A3B8" style={{ fontSize: 10, fontWeight: '700' }}>DATE</AppText>
            <AppText variant="caption" color="#1E293B" style={{ fontWeight: '600' }}>{fmtDate(txn.createdAt)}</AppText>
            <AppText variant="caption" color="#94A3B8" style={{ fontSize: 10, fontWeight: '700', marginTop: 8 }}>TXN ID</AppText>
            <AppText variant="caption" color="#1E293B" style={{ fontWeight: '600', textAlign: 'right' }}>{txn.creditTransactionId || 'N/A'}</AppText>
          </View>
        </View>

        <View style={inv.table}>
          {([
            ['Description', 'Amount (₹)', true],
            ['Payment', base.toFixed(2), false],
            ...(platform > 0 ? [['Platform Charges', platform.toFixed(2), false] as [string,string,boolean]] : []),
            ['GST Charges', gst.toFixed(2), false],
            ['Total', total.toFixed(2), true],
          ] as [string, string, boolean][]).map(([k, v, bold]) => (
            <View key={k} style={[inv.row, bold && { backgroundColor: '#F8FAFC' }]}>
              <AppText variant={bold ? 'label' : 'caption'} color="#1E293B" style={{ flex: 1 }}>{k}</AppText>
              <AppText variant={bold ? 'label' : 'caption'} color={bold ? '#1976D2' : '#1E293B'}>{v}</AppText>
            </View>
          ))}
        </View>

        <AppText variant="caption" color="#94A3B8" style={{ textAlign: 'center', fontStyle: 'italic', marginBottom: 16 }}>
          This is a digitally generated invoice and does not require a physical signature.
        </AppText>
        <AppButton title="Close" onPress={onClose} variant="secondary" />
      </ScrollView>
    </Modal>
  );
};

const inv = StyleSheet.create({
  scroll:  { flex: 1, backgroundColor: '#F1F5F9' },
  content: { padding: 16, paddingBottom: 40 },
  header:  { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 12, alignItems: 'center', gap: 4 },
  meta:    { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', gap: 12 },
  table:   { backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  row:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0' },
});

// ─── Work History Tab ─────────────────────────────────────────────────────────
interface WorkEntry {
  _id: string;
  assignedAgentName?: string;
  ERN_NUMBER?: string | number;
  finalAgentRequiredWage?: number;
  createdAt?: string;
}

const WorkHistoryTab = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['employer-work-history'],
    queryFn: () => requirementsApi.getWorkHistory(),
    staleTime: 2 * 60 * 1000,
  });

  const all = (data?.history ?? []) as unknown as WorkEntry[];
  const filtered = search.trim()
    ? all.filter((r) => (r.assignedAgentName ?? '').toLowerCase().includes(search.toLowerCase()))
    : all;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor={theme.colors.primary} />}
    >
      {/* Search */}
      <View style={[wh.searchWrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <AppText style={{ fontSize: 14, color: theme.colors.mutedText }}>🔍</AppText>
        <TextInput
          style={[wh.searchInput, { color: theme.colors.text }]}
          placeholder="Search by agent name…"
          placeholderTextColor={theme.colors.mutedText}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <AppText style={{ color: theme.colors.mutedText, fontSize: 14 }}>✕</AppText>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <AppText variant="caption" color={theme.colors.mutedText} style={{ marginTop: 10 }}>Loading work history…</AppText>
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No results' : 'No work history yet'}
          message={search ? 'Try a different agent name.' : 'Completed work assignments will appear here.'}
        />
      ) : (
        <AppCard style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header */}
          <View style={[wh.row, { backgroundColor: '#f8fafc' }]}>
            <AppText style={[wh.th, { flex: 1.4 }]}>Agent</AppText>
            <AppText style={[wh.th, { flex: 1 }]}>ERN</AppText>
            <AppText style={[wh.th, { flex: 0.8, textAlign: 'right' }]}>Wage</AppText>
            <AppText style={[wh.th, { flex: 1, textAlign: 'right' }]}>Date</AppText>
          </View>
          {filtered.map((item, i) => (
            <View
              key={item._id}
              style={[
                wh.row,
                { backgroundColor: i % 2 === 0 ? theme.colors.card : theme.colors.surface },
                i < filtered.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
              ]}
            >
              <AppText style={[wh.td, { flex: 1.4, color: '#1d4ed8', fontWeight: '700' }]} numberOfLines={1}>
                {item.assignedAgentName || '—'}
              </AppText>
              <AppText style={[wh.td, { flex: 1 }]} numberOfLines={1}>
                {item.ERN_NUMBER ? String(item.ERN_NUMBER) : '—'}
              </AppText>
              <AppText style={[wh.td, { flex: 0.8, textAlign: 'right', color: '#166534', fontWeight: '700' }]}>
                {item.finalAgentRequiredWage != null ? `₹${item.finalAgentRequiredWage}` : '—'}
              </AppText>
              <AppText style={[wh.td, { flex: 1, textAlign: 'right', color: theme.colors.mutedText }]}>
                {fmtDate(item.createdAt)}
              </AppText>
            </View>
          ))}
        </AppCard>
      )}
    </ScrollView>
  );
};

const wh = StyleSheet.create({
  searchWrap:  { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 8, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  th:  { fontSize: 11, fontWeight: '800', color: '#334155' },
  td:  { fontSize: 12, color: '#1e293b' },
});

// ─── Payments Tab ──────────────────────────────────────────────────────────────
const PaymentsTab = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state } = useAuth();
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
  const userAddress  = [u?.block, u?.district, u?.state].filter(Boolean).join(', ');

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => void refetch()} tintColor={theme.colors.primary} />}
    >
      {/* Summary banner */}
      <View style={[pay.banner, { backgroundColor: '#1E40AF' }]}>
        <AppText variant="caption" color="rgba(255,255,255,0.7)">Total Paid</AppText>
        <AppText style={pay.bannerAmt}>{fmtAmt(totalPaid)}</AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.6)">
          {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
        </AppText>
      </View>

      {isLoading ? (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : transactions.length === 0 ? (
        <EmptyState title="No payments yet" message="Your payment history will appear here." />
      ) : (
        <AppCard style={{ padding: 0, overflow: 'hidden' }}>
          <View style={[pay.row, { backgroundColor: '#f8fafc' }]}>
            <AppText style={[pay.th, { flex: 1.2 }]}>Date</AppText>
            <AppText style={[pay.th, { flex: 1 }]}>Status</AppText>
            <AppText style={[pay.th, { flex: 0.9 }]}>Mode</AppText>
            <AppText style={[pay.th, { flex: 1, textAlign: 'right' }]}>Amount</AppText>
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

// ─── Main Screen (tabs) ────────────────────────────────────────────────────────
type Tab = 'history' | 'payments';

export const TransactionScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const [tab, setTab] = useState<Tab>('history');

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* Page header */}
      <View style={[styles.header, { backgroundColor: '#093d71' }]}>
        <AppText style={styles.headerTitle}>History</AppText>
        <AppText style={styles.headerSub}>Work records & payments</AppText>
      </View>

      {/* Tab row */}
      <View style={[styles.tabRow, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        {([
          { value: 'history',  label: '📋 Work History' },
          { value: 'payments', label: '💳 Payments' },
        ] as { value: Tab; label: string }[]).map((t) => {
          const active = tab === t.value;
          return (
            <TouchableOpacity
              key={t.value}
              onPress={() => setTab(t.value)}
              style={[styles.tab, active && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2.5 }]}
            >
              <AppText style={[styles.tabTxt, { color: active ? theme.colors.primary : theme.colors.mutedText }]}>
                {t.label}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {tab === 'history' ? <WorkHistoryTab /> : <PaymentsTab />}
    </View>
  );
};

const styles = StyleSheet.create({
  root:       { flex: 1 },
  header:     { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16, gap: 2 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerSub:  { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  tabRow:     { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab:        { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabTxt:     { fontSize: 13, fontWeight: '700' },
});
