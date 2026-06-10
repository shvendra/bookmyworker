import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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
  if (l === 'rejected' || l === 'failed') return '#EF4444';
  return '#F59E0B';
};

// Backend enum → employer-ns i18n key (all 11 languages). Unknown values fall
// back to a humanised version of the raw string so nothing renders blank.
const STATUS_TKEY: Record<string, string> = {
  pending: 'tx_status_pending',
  completed: 'tx_status_completed',
  done: 'tx_status_completed',
  failed: 'tx_status_failed',
  rejected: 'tx_status_rejected',
};
const METHOD_TKEY: Record<string, string> = {
  bank_transfer: 'tx_method_bank_transfer',
  upi: 'tx_method_upi',
  other: 'tx_method_other',
  online: 'tx_method_online',
  cash: 'tx_method_cash',
  credit: 'tx_method_credit',
  debit: 'tx_method_debit',
  subscription: 'tx_method_subscription',
  verifiedbadge: 'tx_method_verifiedbadge',
};
const humanize = (s: string): string =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const txStatusLabel = (raw: string | undefined, t: (k: string) => string): string => {
  const v = (raw || 'pending').toLowerCase();
  const k = STATUS_TKEY[v];
  return k ? t(k) : humanize(raw || 'pending');
};
const txMethodLabel = (raw: string | undefined, t: (k: string) => string): string => {
  if (!raw) return '—';
  const k = METHOD_TKEY[raw.toLowerCase()];
  return k ? t(k) : humanize(raw);
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

// HTML-escape for safe interpolation into the print template.
const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));

interface InvoiceData {
  L: Record<string, string>;        // translated labels
  companyAddress: string; supportEmail: string; companyGst: string;
  userName: string; firmLine: string; userGst: string; userAddress: string;
  invNo: string; date: string; txnId: string;
  base: number; platform: number; gst: number; total: number; gstLabel: string;
}

/** Premium A4 invoice HTML used for Print / Save-as-PDF (mirrors the on-screen
 *  paper). Fully translated via the passed-in label map. */
const buildInvoiceHtml = (d: InvoiceData): string => {
  const money = (n: number): string => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const rows = [
    `<tr><td>${esc(d.L.payment)}</td><td class="r">${esc(money(d.base))}</td></tr>`,
    ...(d.platform > 0 ? [`<tr><td>${esc(d.L.platform)}</td><td class="r">${esc(money(d.platform))}</td></tr>`] : []),
  ].join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
@page { margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif; color:#1e293b; background:#eef2f7; padding:28px 20px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.sheet { max-width:760px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 18px 50px rgba(15,23,42,.16); }
.hdr { background:linear-gradient(135deg,#0f2f8c 0%,#1037a4 60%,#1b54d6 100%); color:#fff; padding:30px 34px; display:flex; justify-content:space-between; align-items:flex-start; }
.brand { font-size:27px; font-weight:800; letter-spacing:.3px; }
.tag { font-size:11.5px; opacity:.82; margin-top:6px; max-width:280px; line-height:1.5; }
.eyebrow { text-align:right; }
.eyebrow .lbl { font-size:13px; letter-spacing:3px; text-transform:uppercase; opacity:.9; font-weight:700; }
.eyebrow .meta { font-size:12px; margin-top:10px; opacity:.92; line-height:1.7; }
.body { padding:30px 34px; }
.cols { display:flex; gap:26px; margin-bottom:26px; }
.col { flex:1; }
.col h4 { font-size:10px; letter-spacing:1.6px; text-transform:uppercase; color:#94a3b8; margin-bottom:9px; font-weight:800; }
.col .nm { font-size:15px; font-weight:700; color:#0f172a; }
.col p { font-size:12px; color:#475569; line-height:1.7; margin-top:3px; }
.gst { display:inline-block; margin-top:9px; background:#eff6ff; color:#1d4ed8; font-size:11px; font-weight:700; padding:4px 10px; border-radius:6px; border:1px solid #bfdbfe; }
table { width:100%; border-collapse:collapse; margin-top:6px; border:1px solid #e8edf3; border-radius:10px; overflow:hidden; }
th { background:#f1f5f9; text-align:left; font-size:11px; letter-spacing:.6px; text-transform:uppercase; color:#475569; padding:13px 16px; font-weight:800; }
th.r, td.r { text-align:right; }
td { padding:14px 16px; font-size:13px; border-top:1px solid #f1f5f9; color:#334155; }
.totals { margin-top:20px; margin-left:auto; width:300px; }
.totals .row { display:flex; justify-content:space-between; padding:7px 4px; font-size:13px; color:#475569; }
.totals .grand { margin-top:8px; padding:15px 18px; background:linear-gradient(135deg,#0f2f8c,#1037a4); color:#fff; border-radius:12px; display:flex; justify-content:space-between; font-size:17px; font-weight:800; }
.thanks { margin-top:30px; text-align:center; font-size:15px; font-weight:800; color:#0f2f8c; }
.disc { margin-top:8px; text-align:center; font-size:11px; color:#94a3b8; font-style:italic; line-height:1.5; }
.foot { border-top:1px solid #e2e8f0; margin-top:22px; padding-top:14px; text-align:center; font-size:10.5px; color:#94a3b8; word-break:break-all; }
</style></head>
<body>
  <div class="sheet">
    <div class="hdr">
      <div><div class="brand">BookMyWorker</div><div class="tag">${esc(d.companyAddress)}</div></div>
      <div class="eyebrow"><div class="lbl">${esc(d.L.taxInvoice)}</div><div class="meta">${esc(d.L.invNo)} ${esc(d.invNo)}<br/>${esc(d.L.date)}: ${esc(d.date)}</div></div>
    </div>
    <div class="body">
      <div class="cols">
        <div class="col"><h4>${esc(d.L.billFrom)}</h4><div class="nm">BookMyWorker</div><p>${esc(d.companyAddress)}<br/>${esc(d.supportEmail)}</p><span class="gst">GSTIN: ${esc(d.companyGst)}</span></div>
        <div class="col"><h4>${esc(d.L.billTo)}</h4><div class="nm">${esc(d.userName)}</div><p>${esc(d.firmLine)}<br/>${esc(d.userAddress)}</p>${d.userGst ? `<span class="gst">GSTIN: ${esc(d.userGst)}</span>` : ''}</div>
      </div>
      <table>
        <thead><tr><th>${esc(d.L.description)}</th><th class="r">${esc(d.L.amount)}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <div class="row"><span>${esc(d.L.subtotal)}</span><span>${esc(money(d.base + d.platform))}</span></div>
        ${d.gst > 0 ? `<div class="row"><span>${esc(d.gstLabel)}</span><span>${esc(money(d.gst))}</span></div>` : ''}
        <div class="grand"><span>${esc(d.L.total)}</span><span>${esc(money(d.total))}</span></div>
      </div>
      <div class="thanks">${esc(d.L.thankYou)}</div>
      <div class="disc">${esc(d.L.disclaimer)}</div>
      <div class="foot">${esc(d.L.txnId)}: ${esc(d.txnId)}</div>
    </div>
  </div>
</body></html>`;
};

const InvoiceModal = ({ txn, userName, userKyc, userAddress, companyAddress, supportEmail, gstNumber, gstLabel, onClose }: InvoiceProps): React.JSX.Element | null => {
  const { t } = useTranslation('employer');
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<null | 'print' | 'share'>(null);

  const platform = txn?.platformCharges ?? 0;
  const gst      = txn?.gstCharges ?? 0;
  const total    = (txn?.amount ?? 0) + platform;
  const base     = total - gst;

  const dateStr  = fmtDate(txn?.createdAt);
  const txnId    = txn?.creditTransactionId || t('jp_invNA');
  const rawId    = String((txn as { _id?: string } | null)?._id ?? txn?.creditTransactionId ?? '');
  const invNo    = rawId ? `INV-${rawId.slice(-8).toUpperCase()}` : '—';
  const firmLine = userKyc?.firmName || t('jp_invNA');
  const userGst  = userKyc?.gstNumber || '';

  const html = useMemo(() => buildInvoiceHtml({
    L: {
      taxInvoice: t('jp_taxInvoice'), invNo: t('jp_invNo'), date: t('jp_invDate'),
      billFrom: t('jp_billFrom'), billTo: t('jp_invBillTo'),
      description: t('jp_invDescription'), amount: t('jp_invAmountRupees'),
      payment: t('jp_invPayment'), platform: t('jp_invPlatformCharges'),
      subtotal: t('jp_subtotal'), total: t('jp_invTotal'),
      thankYou: t('jp_thankYou'), disclaimer: t('jp_invDisclaimer'), txnId: t('jp_invTxnId'),
    },
    companyAddress, supportEmail, companyGst: gstNumber,
    userName, firmLine, userGst, userAddress: userAddress || t('jp_invNA'),
    invNo, date: dateStr, txnId,
    base, platform, gst, total, gstLabel,
  }), [t, companyAddress, supportEmail, gstNumber, userName, firmLine, userGst, userAddress, invNo, dateStr, txnId, base, platform, gst, total, gstLabel]);

  const handlePrint = useCallback(async () => {
    try { setBusy('print'); await Print.printAsync({ html }); }
    catch { Alert.alert('', t('jp_printError')); }
    finally { setBusy(null); }
  }, [html, t]);

  const handleShare = useCallback(async () => {
    try {
      setBusy('share');
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t('jp_invoice') });
      }
    } catch { Alert.alert('', t('jp_printError')); }
    finally { setBusy(null); }
  }, [html, t]);

  if (!txn) return null;

  const Money = (n: number): string => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={onClose}>
      <StatusBar barStyle="dark-content" backgroundColor="#E7ECF3" />
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
          contentContainerStyle={[inv.scroll, { paddingBottom: 24 }]}
        >
          {/* ── Paper sheet ── */}
          <View style={inv.sheet}>
            {/* Header band */}
            <View style={inv.headerBand}>
              <View style={inv.headerLeft}>
                <AppText style={inv.brandName}>BookMyWorker</AppText>
                <AppText style={inv.brandTag} numberOfLines={3}>{companyAddress}</AppText>
              </View>
              <View style={inv.headerRight}>
                <AppText style={inv.eyebrow} maxFontSizeMultiplier={1.2}>{t('jp_taxInvoice')}</AppText>
                <AppText style={inv.eyebrowMeta} numberOfLines={1}>{t('jp_invNo')} {invNo}</AppText>
                <AppText style={inv.eyebrowMeta} numberOfLines={1}>{t('jp_invDate')}: {dateStr}</AppText>
              </View>
            </View>

            <View style={inv.body}>
              {/* Bill From / Bill To */}
              <View style={inv.cols}>
                <View style={inv.col}>
                  <AppText style={inv.colHead}>{t('jp_billFrom')}</AppText>
                  <AppText style={inv.colName}>BookMyWorker</AppText>
                  <AppText style={inv.colP}>{companyAddress}</AppText>
                  <AppText style={inv.colP}>{supportEmail}</AppText>
                  <View style={inv.gstPill}><AppText style={inv.gstTxt}>GSTIN: {gstNumber}</AppText></View>
                </View>
                <View style={inv.col}>
                  <AppText style={inv.colHead}>{t('jp_invBillTo')}</AppText>
                  <AppText style={inv.colName} numberOfLines={2}>{userName || t('jp_invNA')}</AppText>
                  <AppText style={inv.colP} numberOfLines={2}>{firmLine}</AppText>
                  <AppText style={inv.colP} numberOfLines={2}>{userAddress || t('jp_invNA')}</AppText>
                  {!!userGst && <View style={inv.gstPill}><AppText style={inv.gstTxt}>GSTIN: {userGst}</AppText></View>}
                </View>
              </View>

              {/* Items table */}
              <View style={inv.table}>
                <View style={[inv.tRow, inv.tHeadRow]}>
                  <AppText style={[inv.tHeadTxt, { flex: 1 }]}>{t('jp_invDescription')}</AppText>
                  <AppText style={[inv.tHeadTxt, inv.tRight]}>{t('jp_invAmountRupees')}</AppText>
                </View>
                <View style={inv.tRow}>
                  <AppText style={[inv.tLabel, { flex: 1 }]}>{t('jp_invPayment')}</AppText>
                  <AppText style={[inv.tVal, inv.tRight]}>{Money(base)}</AppText>
                </View>
                {platform > 0 && (
                  <View style={inv.tRow}>
                    <AppText style={[inv.tLabel, { flex: 1 }]}>{t('jp_invPlatformCharges')}</AppText>
                    <AppText style={[inv.tVal, inv.tRight]}>{Money(platform)}</AppText>
                  </View>
                )}
              </View>

              {/* Totals */}
              <View style={inv.totals}>
                <View style={inv.totRow}>
                  <AppText style={inv.totKey}>{t('jp_subtotal')}</AppText>
                  <AppText style={inv.totVal}>{Money(base + platform)}</AppText>
                </View>
                {gst > 0 && (
                  <View style={inv.totRow}>
                    <AppText style={inv.totKey} numberOfLines={2}>{gstLabel}</AppText>
                    <AppText style={inv.totVal}>{Money(gst)}</AppText>
                  </View>
                )}
                <View style={inv.grand}>
                  <AppText style={inv.grandKey}>{t('jp_invTotal')}</AppText>
                  <AppText style={inv.grandVal} maxFontSizeMultiplier={1.2} numberOfLines={1}>{Money(total)}</AppText>
                </View>
              </View>

              {/* Thank you + disclaimer */}
              <AppText style={inv.thanks}>{t('jp_thankYou')}</AppText>
              <AppText style={inv.disclaimer}>{t('jp_invDisclaimer')}</AppText>
              <View style={inv.foot}>
                <AppText style={inv.footTxt} numberOfLines={2}>{t('jp_invTxnId')}: {txnId}</AppText>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* ── Action bar ── */}
        <View style={[inv.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity onPress={handleShare} disabled={busy !== null} style={[inv.btnGhost, busy !== null && inv.btnDisabled]} activeOpacity={0.85}>
            {busy === 'share'
              ? <ActivityIndicator color="#1037A4" size="small" />
              : <AppText style={inv.btnGhostTxt} numberOfLines={1}>⬇  {t('jp_savePdf')}</AppText>}
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePrint} disabled={busy !== null} style={[inv.btnPrimary, busy !== null && inv.btnDisabled]} activeOpacity={0.85}>
            {busy === 'print'
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <AppText style={inv.btnPrimaryTxt} numberOfLines={1}>🖨  {t('jp_print')}</AppText>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const inv = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#E7ECF3' },
  topBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#E7ECF3' },
  topTitle:{ fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: 0.2 },
  closeBtn:{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 1, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  closeTxt:{ fontSize: 13, color: '#64748B', fontWeight: '700' },

  scroll:  { paddingHorizontal: Math.max(14, (SCREEN_W - 520) / 2), paddingTop: 6 },

  // ── Paper sheet ──
  sheet:      { backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden', elevation: 8, shadowColor: '#0f2f8c', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 28 },

  // Header band
  headerBand: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#1037A4', paddingHorizontal: 22, paddingVertical: 22, gap: 12 },
  headerLeft: { flex: 1.3 },
  brandName:  { fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 },
  brandTag:   { fontSize: 10.5, color: 'rgba(255,255,255,0.78)', marginTop: 5, lineHeight: 15 },
  headerRight:{ flex: 1, alignItems: 'flex-end' },
  eyebrow:    { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.92)', letterSpacing: 2.5, textTransform: 'uppercase' },
  eyebrowMeta:{ fontSize: 10.5, color: 'rgba(255,255,255,0.85)', marginTop: 6, textAlign: 'right' },

  body:       { paddingHorizontal: 22, paddingVertical: 22 },

  // Columns
  cols:       { flexDirection: 'row', gap: 18, marginBottom: 22 },
  col:        { flex: 1 },
  colHead:    { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 7 },
  colName:    { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  colP:       { fontSize: 11, color: '#475569', lineHeight: 16, marginTop: 2 },
  gstPill:    { alignSelf: 'flex-start', backgroundColor: '#EFF6FF', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4, marginTop: 8, borderWidth: 1, borderColor: '#BFDBFE' },
  gstTxt:     { fontSize: 10.5, fontWeight: '800', color: '#1D4ED8' },

  // Items table
  table:      { borderWidth: 1, borderColor: '#E8EDF3', borderRadius: 12, overflow: 'hidden' },
  tRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 15, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F1F5F9' },
  tHeadRow:   { backgroundColor: '#F1F5F9', borderTopWidth: 0 },
  tHeadTxt:   { fontSize: 10.5, fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
  tLabel:     { fontSize: 13, color: '#334155' },
  tVal:       { fontSize: 13, color: '#1E293B', fontWeight: '700' },
  tRight:     { textAlign: 'right' },

  // Totals
  totals:     { alignSelf: 'flex-end', width: '72%', maxWidth: 320, marginTop: 16 },
  totRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 2 },
  totKey:     { fontSize: 12.5, color: '#64748B', fontWeight: '600', flexShrink: 1 },
  totVal:     { fontSize: 12.5, color: '#1E293B', fontWeight: '700' },
  grand:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1037A4', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, marginTop: 8 },
  grandKey:   { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  grandVal:   { fontSize: 17, fontWeight: '900', color: '#FFFFFF', flexShrink: 1, textAlign: 'right' },

  thanks:     { fontSize: 14, fontWeight: '800', color: '#0F2F8C', textAlign: 'center', marginTop: 24 },
  disclaimer: { fontSize: 11, color: '#94A3B8', textAlign: 'center', fontStyle: 'italic', marginTop: 6, lineHeight: 16, paddingHorizontal: 8 },
  foot:       { borderTopWidth: 1, borderTopColor: '#E2E8F0', marginTop: 18, paddingTop: 12 },
  footTxt:    { fontSize: 10, color: '#94A3B8', textAlign: 'center' },

  // Action bar
  actionBar:  { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFFFFF', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F0' },
  btnGhost:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: '#1037A4', backgroundColor: '#FFFFFF' },
  btnGhostTxt:{ fontSize: 14, fontWeight: '800', color: '#1037A4', letterSpacing: 0.2 },
  btnPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 14, backgroundColor: '#1037A4' },
  btnPrimaryTxt:{ fontSize: 14, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },
  btnDisabled:{ opacity: 0.6 },
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
                {txStatusLabel(txn.creditStatus, t)}
              </AppText>
              <AppText style={[pay.td, { flex: 0.9 }]}>
                {txMethodLabel(txn.creditPaymentMethod || txn.paymentType, t)}
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
