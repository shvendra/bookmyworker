import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Linking, RefreshControl, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { ErrorState } from '../../../shared/components/feedback/ErrorState';
import { showAlert } from '../../../shared/state/alert/AppAlertContext';
import { useAppTheme } from '../../../core/theme';
import { bgcApi, bgcError, type BgcCase, type BgcCaseDoc, type BgcOrder } from '../../../core/api/endpoints/bgcApi';
import { BgcRequestResponder } from '../components/BgcRequestResponder';
import { bgcDateTime, bgcFmtSize, bgcInr, bgcStatusColors } from '../bgcShared';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'BgcOrders'>;
const BRAND = '#1037A4';

const openLink = async (get: () => Promise<string>, failMsg: string): Promise<void> => {
  try { await Linking.openURL(await get()); } catch (e) { showAlert('', bgcError(e, failMsg).message); }
};

function CaseRow({ c: initial, onChanged }: { c: BgcCase; onChanged: () => void }): React.JSX.Element {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState<BgcCase | null>(null);
  const c = fresh && fresh._id === initial._id ? fresh : initial;
  const openReqs = (c.requests ?? []).filter((r) => r.status === 'open');
  const sent = (c.requests ?? []).some((r) => r.status === 'submitted');
  const col = bgcStatusColors(c.status);
  return (
    <View style={s.case}>
      <TouchableOpacity onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityLabel={c.worker?.name}>
        <View style={s.rowBetween}>
          <AppText style={[s.worker, { color: theme.colors.text }]} numberOfLines={1}>{c.worker?.name}</AppText>
          <View style={[s.pill, { backgroundColor: col.bg }]}><AppText style={[s.pillTxt, { color: col.color }]}>{t(`bgc_status_${c.status}`, { defaultValue: c.statusLabel })}</AppText></View>
        </View>
        <AppText style={[s.sub, { color: theme.colors.mutedText }]}>{c.caseNumber} · {c.worker?.phone}</AppText>
        {openReqs.length > 0 && (
          <View style={s.action} testID="bgc-action-banner">
            <Ionicons name="alert-circle" size={16} color="#92400e" />
            <AppText style={s.actionTxt}>{t('bgc_actionRequired', { count: openReqs.length })}</AppText>
          </View>
        )}
        {sent && openReqs.length === 0 && <AppText style={s.received}>{t('bgc_receivedReview')}</AppText>}
      </TouchableOpacity>
      {open && (
        <View style={{ marginTop: 8 }}>
          {!!c.customerMessage && <AppText style={[s.msg, { color: theme.colors.text }]}>{t(`bgc_msg_${c.status}`, { defaultValue: c.customerMessage })}</AppText>}
          {openReqs.map((r) => (
            <View key={r._id} testID="bgc-action-required" style={s.reqBox}>
              <AppText style={s.reqTitle}>{r.title}</AppText>
              {!!r.message && <AppText style={s.reqMsg}>{r.message}</AppText>}
              {r.rejectCount > 0 && <AppText style={s.rejected}>{t('bgc_lastRejected', { reason: r.lastRejectReason })}</AppText>}
              <BgcRequestResponder caseId={c._id} request={r} onDone={(nc) => { setFresh(nc); onChanged(); }} />
            </View>
          ))}
          <AppText style={[s.sec, { color: theme.colors.text }]}>{t('bgc_documents')}</AppText>
          {(c.documents ?? []).length === 0 && <AppText style={[s.sub, { color: theme.colors.mutedText }]}>{t('bgc_noDocs')}</AppText>}
          {(c.documents ?? []).map((d: BgcCaseDoc) => (
            <View key={d._id} style={[s.doc, { borderColor: d.status === 'rejected' ? '#fca5a5' : theme.colors.border }]}>
              <View style={{ flex: 1 }}>
                <AppText numberOfLines={1} style={[s.tlTitle, { color: theme.colors.text }]}>{d.label} · {d.fileName}</AppText>
                <AppText style={[s.sub, { color: theme.colors.mutedText }]}>{bgcFmtSize(d.size)} · {bgcDateTime(d.uploadedAt)} · {t(`bgc_docStatus_${d.status}`)}</AppText>
                {d.status === 'rejected' && !!d.rejectReason && <AppText style={s.rejected}>{d.rejectReason}</AppText>}
              </View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${t('bgc_view')} ${d.fileName}`} onPress={() => { void openLink(() => bgcApi.documentLink(c._id, d._id), t('bgc_errGeneric')); }}>
                <AppText style={s.linkTxt}>{t('bgc_view')}</AppText>
              </TouchableOpacity>
            </View>
          ))}
          <AppText style={[s.sec, { color: theme.colors.text }]}>{t('bgc_updates')}</AppText>
          {c.timeline.map((x, i) => (
            <View key={i} style={s.tl}>
              <View style={s.dot} />
              <View style={{ flex: 1 }}>
                <AppText style={[s.tlTitle, { color: theme.colors.text }]}>{x.type === 'comment' ? t('bgc_note') : t(`bgc_status_${x.status}`, { defaultValue: x.label })}</AppText>
                {!!x.comment && <AppText style={[s.sub, { color: theme.colors.mutedText }]}>{x.comment}</AppText>}
                <AppText style={s.when}>{bgcDateTime(x.at)}</AppText>
              </View>
            </View>
          ))}
          {c.hasCertificate && (
            <AppButton title={t('bgc_certificate')} icon="download-outline" size="sm" onPress={() => { void openLink(() => bgcApi.certificateLink(c._id), t('bgc_errGeneric')); }} style={{ marginTop: 8 }} />
          )}
        </View>
      )}
    </View>
  );
}

export const BgcOrdersScreen = ({ navigation }: Props): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['bgc-orders'], queryFn: bgcApi.listOrders, retry: 2 });
  const orders = q.data ?? [];
  // The buyer's own KYC
  const kycQ = useQuery({ queryKey: ['bgc-kyc'], queryFn: bgcApi.getKyc, retry: 1 });
  const kyc = kycQ.data;
  const kycNeeded = !!kyc?.required && (kyc.status === 'missing' || kyc.status === 'rejected');
  const pay = async (o: BgcOrder): Promise<void> => {
    try {
      const r = await bgcApi.payAgain(o._id);
      navigation.navigate('PaymentWebView', { url: r.url, merchantOrderId: r.merchantOrderId, purpose: 'bgc' });
    } catch (e) { showAlert('', bgcError(e, t('bgc_errGeneric')).message); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader title={t('bgc_myVerifications')} onBack={() => navigation.goBack()} />
      {q.isLoading ? (
        <View style={s.center}><ActivityIndicator color={BRAND} /></View>
      ) : q.isError && orders.length === 0 ? (
        <ErrorState onRetry={() => { void q.refetch(); }} />
      ) : (
        <FlatList
          ListHeaderComponent={(
            <View>
              {kyc?.required && kyc.status === 'pending' && (
                <View testID="bgc-kyc-pending" style={s.kycPending}><AppText style={s.kycPendingH}>{t('bgc_kycPendingTitle')}</AppText><AppText style={s.kycPendingTxt}>{t('bgc_kycPendingBody')}</AppText></View>
              )}
              {kycNeeded && (
                <View testID="bgc-kyc-needed" style={[s.kycNeeded, kyc?.status === 'rejected' && { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}>
                  <AppText style={s.kycNeededH}>{kyc?.status === 'rejected' ? t('bgc_kycRejectedTitle') : t('bgc_kycNeededTitle')}</AppText>
                  <AppText style={s.kycNeededTxt}>{kyc?.status === 'rejected' && kyc.reason ? `${kyc.reason}. ` : ''}{t('bgc_kycNeededBody')}</AppText>
                  <AppText style={s.kycNeededTxt}>{t('bgc_kycHowTo')}</AppText>
                  <AppButton title={kyc?.status === 'rejected' ? t('bgc_kycResubmit') : t('bgc_kycComplete')} size="sm" onPress={() => navigation.navigate('KycVerification')} style={{ marginTop: 8 }} />
                </View>
              )}
            </View>
          )}
          data={orders}
          keyExtractor={(o) => o._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void qc.invalidateQueries({ queryKey: ['bgc-orders'] }); }} />}
          ListEmptyComponent={<AppText style={[s.empty, { color: theme.colors.mutedText }]}>{t('bgc_noOrders')}</AppText>}
          renderItem={({ item: o }) => (
            <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={s.rowBetween}>
                <AppText style={[s.worker, { color: theme.colors.text }]}>{o.orderNumber}</AppText>
                <AppText style={[s.worker, { color: theme.colors.text }]}>{bgcInr(o.pricing?.total)}</AppText>
              </View>
              <AppText style={[s.sub, { color: theme.colors.mutedText }]}>
                {bgcDateTime(o.createdAt)} · {t('bgc_workersCount', { count: o.workerCount })} · {t(`bgc_pay_${o.paymentStatus}`, { defaultValue: o.paymentStatus })}
              </AppText>
              {o.canPay && <AppButton title={t('bgc_payNow')} size="sm" onPress={() => { void pay(o); }} style={{ marginTop: 8 }} />}
              {o.hasInvoice && (
                <TouchableOpacity onPress={() => { void openLink(() => bgcApi.invoiceLink(o._id), t('bgc_errGeneric')); }} style={{ marginTop: 8 }} accessibilityRole="button">
                  <AppText style={s.linkTxt}>{t('bgc_invoice')} {o.invoiceNumber}</AppText>
                </TouchableOpacity>
              )}
              {o.cases.map((c) => <CaseRow key={c._id} c={c} onChanged={() => { void qc.invalidateQueries({ queryKey: ['bgc-orders'] }); }} />)}
            </View>
          )}
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:      { textAlign: 'center', marginTop: 40, fontSize: 14 },
  card:       { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  case:       { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#cbd5e1', marginTop: 10, paddingTop: 10 },
  worker:     { fontSize: 14, fontWeight: '800', flexShrink: 1 },
  sub:        { fontSize: 12, marginTop: 2 },
  pill:       { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  pillTxt:    { fontSize: 10.5, fontWeight: '800' },
  msg:        { fontSize: 12.5, marginBottom: 6 },
  tl:         { flexDirection: 'row', gap: 8, marginTop: 6 },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND, marginTop: 5 },
  tlTitle:    { fontSize: 12.5, fontWeight: '700' },
  when:       { fontSize: 10.5, color: '#94a3b8', marginTop: 1 },
  linkTxt:    { color: BRAND, fontWeight: '800', fontSize: 12.5 },
  kycPending: { backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 12, padding: 12, marginBottom: 12 },
  kycPendingH:{ color: '#075985', fontWeight: '800', fontSize: 13.5 },
  kycPendingTxt:{ color: '#075985', fontSize: 12.5, marginTop: 2 },
  kycNeeded:  { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 12, padding: 12, marginBottom: 12 },
  kycNeededH: { color: '#78350f', fontWeight: '800', fontSize: 13.5 },
  kycNeededTxt:{ color: '#92400e', fontSize: 12.5, marginTop: 2 },
  action:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fef3c7', borderRadius: 8, padding: 8, marginTop: 8 },
  actionTxt:  { flex: 1, fontSize: 12, fontWeight: '700', color: '#92400e' },
  received:   { fontSize: 11.5, fontWeight: '700', color: '#0369a1', marginTop: 6 },
  reqBox:     { borderWidth: 1.5, borderColor: '#f59e0b', backgroundColor: '#fffbeb', borderRadius: 12, padding: 10, marginBottom: 10 },
  reqTitle:   { fontSize: 13.5, fontWeight: '800', color: '#78350f' },
  reqMsg:     { fontSize: 12.5, color: '#92400e', marginTop: 2 },
  rejected:   { fontSize: 12, color: '#b91c1c', marginTop: 4 },
  sec:        { fontSize: 13, fontWeight: '800', marginTop: 10, marginBottom: 4 },
  doc:        { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, padding: 8, marginTop: 6 },
});
