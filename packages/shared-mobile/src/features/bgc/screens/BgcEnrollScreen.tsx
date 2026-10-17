import React, { useCallback, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppInput } from '../../../shared/components/ui/AppInput';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { showAlert } from '../../../shared/state/alert/AppAlertContext';
import { useAppTheme } from '../../../core/theme';
import { bgcApi, bgcError, computeBgcQuote, useBgcConfig, type BgcWorkerInput } from '../../../core/api/endpoints/bgcApi';
import { applyBgcPrefill, bgcInr, emptyBgcWorker, validateBgcWorker, type BgcWorkerRow } from '../bgcShared';
import { BgcWorkerDocs } from '../components/BgcDocUploader';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'BgcEnroll'>;
const BRAND = '#1037A4';
const GENDERS = ['Male', 'Female', 'Other'];

export const BgcEnrollScreen = ({ navigation }: Props): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const { config } = useBgcConfig();
  const [rows, setRows] = useState<BgcWorkerRow[]>([emptyBgcWorker()]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({}); // 'workers.0.name' | 'consent' → message (already translated / from server)
  const [banner, setBanner] = useState('');
  const lastLookup = useRef<Record<number, string>>({});
  const scroll = useRef<ScrollView>(null);
  const cardY = useRef<Record<number, number>>({});
  const max = config.maxWorkersPerOrder ?? 1;
  const quote = useMemo(() => computeBgcQuote(config, rows.length), [config, rows.length]);

  const clearError = useCallback((k: string) => setErrors((cur) => { if (!(k in cur)) return cur; const { [k]: _gone, ...rest } = cur; return rest; }), []);
  // Functional updates only: the lookup resolves later and must not overwrite what was typed meanwhile.
  const patch = useCallback((i: number, fn: (r: BgcWorkerRow) => BgcWorkerRow) => {
    setRows((rs) => rs.map((r, idx) => (idx === i ? fn(r) : r)));
  }, []);

  const onPhone = useCallback((i: number, raw: string) => {
    const phone = raw.replace(/\D/g, '').slice(0, 10);
    clearError(`workers.${i}.phone`);
    patch(i, (r) => ({ ...r, phone, found: phone === r.phone ? r.found : false }));
    if (!/^[6-9]\d{9}$/.test(phone) || lastLookup.current[i] === phone) return;
    lastLookup.current[i] = phone;
    bgcApi.lookupWorker(phone)
      .then((res) => { if (lastLookup.current[i] === phone) patch(i, (r) => applyBgcPrefill(r, res.worker)); })
      .catch(() => { /* lookup is a convenience; manual entry still works */ });
  }, [patch, clearError]);

  const setField = (i: number, k: keyof BgcWorkerRow, v: string): void => { clearError(`workers.${i}.${String(k)}`); patch(i, (r) => ({ ...r, [k]: v })); };
  const setAddr = (i: number, k: keyof BgcWorkerRow['address'], v: string): void => { clearError(`workers.${i}.address.${k}`); patch(i, (r) => ({ ...r, address: { ...r.address, [k]: v } })); };

  const fail = (map: Record<string, string>, message = ''): void => {
    setErrors(map); setBanner(message);
    const first = Object.keys(map)[0] ?? '';
    const m = /^workers\.(\d+)\./.exec(first);
    const y = m ? cardY.current[Number(m[1])] : undefined;
    setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, (y ?? 0) - 12), animated: true }), 30);
  };

  const submit = async (): Promise<void> => {
    const map: Record<string, string> = {};
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      for (const [k, key] of Object.entries(validateBgcWorker(r))) map[`workers.${i}.${k}`] = t(key);
      if (r.phone && seen.has(r.phone) && !map[`workers.${i}.phone`]) map[`workers.${i}.phone`] = t('bgc_errDup', { phone: r.phone });
      seen.add(r.phone);
    });
    if (!consent) map.consent = t('bgc_errConsent');
    if (Object.keys(map).length) { fail(map); return; }
    setErrors({}); setBanner(''); setBusy(true);
    try {
      const workers: BgcWorkerInput[] = rows.map(({ found: _f, documents, ...w }) => ({ ...w, userId: w.userId || undefined, documents: documents.map((d) => d.docRef) }));
      const res = await bgcApi.createOrder(workers);
      navigation.replace('PaymentWebView', { url: res.url, merchantOrderId: res.merchantOrderId, purpose: 'bgc' });
    } catch (e) {
      const b = bgcError(e, t('bgc_errGeneric'));
      if (Object.keys(b.fields).length) fail(b.fields, b.message); else setBanner(b.message);
    } finally {
      setBusy(false);
    }
  };

  const problems = Object.entries(errors).map(([k, m]) => {
    const mm = /^workers\.(\d+)\./.exec(k);
    return mm ? `${t('bgc_workerN', { n: Number(mm[1]) + 1 })}: ${m}` : m;
  });
  const E = (i: number, f: string): string | undefined => errors[`workers.${i}.${f}`];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader title={t('bgc_enrollTitle')} onBack={() => navigation.goBack()} />
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={s.info}>
          <Ionicons name="information-circle" size={18} color="#1e40af" />
          <AppText style={s.infoTxt}>{t('bgc_needs')}</AppText>
        </View>
        {rows.map((r, i) => (
          <View key={i} testID={`bgc-worker-${i}`} onLayout={(e: LayoutChangeEvent) => { cardY.current[i] = e.nativeEvent.layout.y; }}
            style={[s.card, { backgroundColor: theme.colors.card, borderColor: Object.keys(errors).some((k) => k.startsWith(`workers.${i}.`)) ? '#fca5a5' : theme.colors.border }]}>
            <View style={s.head}>
              <AppText style={[s.h, { color: theme.colors.text }]}>{t('bgc_workerN', { n: i + 1 })}</AppText>
              {rows.length > 1 && (
                <TouchableOpacity onPress={() => { setRows((rs) => rs.filter((_, idx) => idx !== i)); setErrors({}); }} accessibilityLabel={t('bgc_remove')}>
                  <Ionicons name="trash-outline" size={18} color="#b91c1c" />
                </TouchableOpacity>
              )}
            </View>
            <AppInput label={`${t('bgc_workerPhone')} *`} value={r.phone} onChangeText={(v) => onPhone(i, v)} keyboardType="number-pad" maxLength={10} errorText={E(i, 'phone')} helperText={t('bgc_phoneHint')} />
            {r.found && <AppText style={s.found}>✓ {t('bgc_foundProfile')}</AppText>}
            <AppInput label={`${t('bgc_fullName')} *`} value={r.name} onChangeText={(v) => setField(i, 'name', v)} errorText={E(i, 'name')} maxLength={80} />
            <AppInput label={`${t('bgc_fatherName')} *`} value={r.fatherName} onChangeText={(v) => setField(i, 'fatherName', v)} errorText={E(i, 'fatherName')} maxLength={80} />
            <View style={s.chips}>
              {GENDERS.map((g) => (
                <TouchableOpacity key={g} onPress={() => setField(i, 'gender', g)} style={[s.chip, r.gender === g && s.chipOn]} accessibilityRole="button">
                  <AppText style={[s.chipTxt, r.gender === g && { color: '#fff' }]}>{t(`bgc_g_${g}`)}</AppText>
                </TouchableOpacity>
              ))}
            </View>
            <AppInput label={`${t('bgc_dob')} *`} value={r.dob} onChangeText={(v) => setField(i, 'dob', v)} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} errorText={E(i, 'dob')} />
            <AppInput label={`${t('bgc_address')} *`} value={r.address.line} onChangeText={(v) => setAddr(i, 'line', v)} multiline errorText={E(i, 'address.line')} maxLength={250} />
            <AppInput label={`${t('bgc_state')} *`} value={r.address.state} onChangeText={(v) => setAddr(i, 'state', v)} errorText={E(i, 'address.state')} />
            <AppInput label={`${t('bgc_district')} *`} value={r.address.district} onChangeText={(v) => setAddr(i, 'district', v)} errorText={E(i, 'address.district')} />
            <AppInput label={`${t('bgc_pincode')} *`} value={r.address.pincode} onChangeText={(v) => setAddr(i, 'pincode', v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} errorText={E(i, 'address.pincode')} />
            <BgcWorkerDocs index={i} docs={r.documents} error={E(i, 'documents')} maxDocs={config.maxDocsPerWorker ?? 8} maxMb={config.docMaxMb ?? 5}
              onChange={(fn) => { clearError(`workers.${i}.documents`); patch(i, (cur) => ({ ...cur, documents: fn(cur.documents) })); }} />
          </View>
        ))}

        {rows.length < max && (
          <TouchableOpacity onPress={() => setRows((rs) => [...rs, emptyBgcWorker()])} style={s.add} accessibilityRole="button">
            <Ionicons name="add-circle-outline" size={18} color={BRAND} />
            <AppText style={s.addTxt}>{t('bgc_addWorker')}</AppText>
          </TouchableOpacity>
        )}
        {config.priceTiers?.some((x) => x.contractOnly) && (
          <AppText style={{ color: theme.colors.mutedText, fontSize: 12.5, marginBottom: 10 }}>
            {t('bgc_contractNote', { count: config.priceTiers.find((x) => x.contractOnly)?.minWorkers })}
          </AppText>
        )}

        <View style={s.pendingKyc}><AppText style={s.pendingKycTxt}>{t('bgc_kycAfterPay')}</AppText></View>

        <TouchableOpacity onPress={() => { setConsent((c) => !c); clearError('consent'); }} accessibilityRole="checkbox" accessibilityState={{ checked: consent }} accessibilityLabel="Consent"
          style={[s.consent, { backgroundColor: theme.colors.card, borderColor: errors.consent ? '#dc2626' : theme.colors.border }]}>
          <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={22} color={BRAND} />
          <View style={{ flex: 1 }}>
            <AppText style={[s.consentH, { color: theme.colors.text }]}>{t('bgc_consentTitle')}</AppText>
            <AppText style={[s.consentTxt, { color: theme.colors.mutedText }]}>{config.consentText || t('bgc_consent')}</AppText>
          </View>
        </TouchableOpacity>
        {!!errors.consent && <AppText accessibilityRole="alert" style={s.err}>{errors.consent}</AppText>}

        <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <AppText style={{ color: theme.colors.mutedText, fontSize: 12.5 }}>
            {quote.count} × {bgcInr(quote.unit)}{quote.discountAmount > 0 ? ` − ${bgcInr(quote.discountAmount)} (${quote.discountPercent}%)` : ''} + {t('bgc_gst', { gst: quote.gstPercent })} {bgcInr(quote.gstAmount)}
          </AppText>
          <AppText testID="bgc-total" style={[s.total, { color: theme.colors.text }]}>{bgcInr(quote.total)}</AppText>
        </View>

        {problems.length > 0 && (
          <View accessibilityRole="alert" style={s.banner}>
            <AppText style={s.bannerH}>{problems.length === 1 ? t('bgc_fixOne') : t('bgc_fixMany', { count: problems.length })}</AppText>
            {!!banner && <AppText style={s.bannerTxt}>{banner}</AppText>}
            {problems.slice(0, 6).map((m, i) => <AppText key={i} style={s.bannerTxt}>• {m}</AppText>)}
            {problems.length > 6 && <AppText style={s.bannerTxt}>• {t('bgc_andMore', { count: problems.length - 6 })}</AppText>}
          </View>
        )}
        {!!banner && problems.length === 0 && <View accessibilityRole="alert" style={s.banner}><AppText style={s.bannerTxt}>{banner}</AppText></View>}

        <AppButton title={t('bgc_pay', { amount: bgcInr(quote.total) })} onPress={() => { void submit(); }} loading={busy} disabled={busy} fullWidth />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const s = StyleSheet.create({
  info:       { flexDirection: 'row', gap: 8, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 12, padding: 12, marginBottom: 12 },
  infoTxt:    { flex: 1, fontSize: 12.5, color: '#1e3a8a', lineHeight: 18 },
  card:       { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  head:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  h:          { fontSize: 15, fontWeight: '800' },
  found:      { color: '#15803d', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  chips:      { flexDirection: 'row', gap: 8, marginVertical: 8 },
  chip:       { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6 },
  chipOn:     { backgroundColor: BRAND, borderColor: BRAND },
  chipTxt:    { fontSize: 12.5, fontWeight: '700', color: '#334155' },
  add:        { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', padding: 12 },
  addTxt:     { color: BRAND, fontWeight: '800', fontSize: 14 },
  consent:    { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  consentH:   { fontSize: 13.5, fontWeight: '800' },
  consentTxt: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  total:      { fontSize: 24, fontWeight: '900', marginTop: 4 },
  err:        { color: '#dc2626', fontSize: 12.5, marginBottom: 8 },
  banner:     { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 12, padding: 12, marginBottom: 12, gap: 2 },
  bannerH:    { color: '#991b1b', fontWeight: '800', fontSize: 13.5 },
  bannerTxt:  { color: '#991b1b', fontSize: 12.5 },
  pendingKyc: { backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 12, padding: 12, marginBottom: 12 },
  pendingKycTxt: { color: '#075985', fontSize: 12.5 },
});
