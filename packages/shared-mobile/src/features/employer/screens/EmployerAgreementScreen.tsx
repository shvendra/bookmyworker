import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { useAuth } from '../../../state/auth/AuthContext';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { getMyAgreements, signAgreement } from '../../../core/api/endpoints/agreementApi';
import type { Agreement, AgreementWork } from '../../../core/api/endpoints/agreementApi';
import type { MainStackParamList } from '../../../app/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const BRAND = '#1037A4';

// ── Signature: typed name → PNG via off-screen canvas ─────────────────────────
const SIGNATURE_HTML =
  '<!DOCTYPE html><html><head><meta name="viewport" content="width=600"></head>' +
  '<body style="margin:0"><canvas id="sig" width="600" height="200"></canvas></body></html>';

const renderSignature = (name: string): string => `(function(){
  var c=document.getElementById('sig'); var x=c.getContext('2d');
  x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height);
  x.fillStyle='#0f172a'; x.font='48px "Brush Script MT", cursive'; x.textBaseline='middle';
  x.fillText(${JSON.stringify(name)}, 24, c.height/2);
  window.ReactNativeWebView.postMessage(c.toDataURL('image/png')); true;
})();`;

// ── Work fields rendered (only non-empty ones shown) ──────────────────────────
const WORK_FIELDS: { key: keyof AgreementWork; labelKey: string }[] = [
  { key: 'title', labelKey: 'ag_fTitle' },
  { key: 'description', labelKey: 'ag_fDescription' },
  { key: 'numberOfWorkers', labelKey: 'ag_fNumberOfWorkers' },
  { key: 'location', labelKey: 'ag_fLocation' },
  { key: 'duration', labelKey: 'ag_fDuration' },
  { key: 'dutyHours', labelKey: 'ag_fDutyHours' },
  { key: 'weeklyOff', labelKey: 'ag_fWeeklyOff' },
  { key: 'overtime', labelKey: 'ag_fOvertime' },
  { key: 'wages', labelKey: 'ag_fWages' },
  { key: 'paymentCycle', labelKey: 'ag_fPaymentCycle' },
  { key: 'paymentMode', labelKey: 'ag_fPaymentMode' },
  { key: 'advance', labelKey: 'ag_fAdvance' },
  { key: 'stay', labelKey: 'ag_fStay' },
  { key: 'food', labelKey: 'ag_fFood' },
  { key: 'transport', labelKey: 'ag_fTransport' },
  { key: 'safetyGears', labelKey: 'ag_fSafetyGears' },
  { key: 'experienceLevel', labelKey: 'ag_fExperienceLevel' },
  { key: 'licenseRequired', labelKey: 'ag_fLicenseRequired' },
  { key: 'uniform', labelKey: 'ag_fUniform' },
  { key: 'reportingPerson', labelKey: 'ag_fReportingPerson' },
  { key: 'attendance', labelKey: 'ag_fAttendance' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export const EmployerAgreementScreen = (): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { state: authState } = useAuth();
  const toast = useToast();

  const sessionName = authState.session?.user?.fullName ?? '';

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [typedName, setTypedName] = useState(sessionName);
  const [submitting, setSubmitting] = useState(false);

  const webviewRef = useRef<WebView>(null);
  // Promise resolver awaiting the next onMessage (the signature data URL).
  const pendingSignature = useRef<((dataUrl: string) => void) | null>(null);

  const agreementsQuery = useQuery({
    queryKey: ['employer-agreements'],
    queryFn: getMyAgreements,
    staleTime: 60 * 1000,
  });

  const agreements = agreementsQuery.data ?? [];
  const selected = useMemo(
    () => agreements.find((a) => a._id === selectedId) ?? null,
    [agreements, selectedId],
  );

  const openAgreement = (a: Agreement) => {
    setSelectedId(a._id);
    setChecked(false);
    setTypedName(sessionName);
  };

  const closeDetail = () => {
    setSelectedId(null);
    setChecked(false);
  };

  // Wait for the next WebView postMessage carrying the PNG data URL.
  const captureSignature = useCallback((name: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      if (!webviewRef.current) {
        reject(new Error('webview-not-ready'));
        return;
      }
      pendingSignature.current = resolve;
      webviewRef.current.injectJavaScript(renderSignature(name));
      // Safety timeout so we never hang forever.
      setTimeout(() => {
        if (pendingSignature.current === resolve) {
          pendingSignature.current = null;
          reject(new Error('signature-timeout'));
        }
      }, 8000);
    });
  }, []);

  const onWebViewMessage = useCallback((e: WebViewMessageEvent) => {
    const resolve = pendingSignature.current;
    pendingSignature.current = null;
    if (resolve) resolve(e.nativeEvent.data);
  }, []);

  const handleSign = useCallback(async () => {
    if (!selected) return;
    const name = typedName.trim();
    if (!checked || !name) return;
    setSubmitting(true);
    try {
      const dataUrl = await captureSignature(name);
      await signAgreement(selected._id, dataUrl);
      await agreementsQuery.refetch();
      toast.success(t('ag_signSuccess'), t('ag_signedChip'));
      closeDetail();
    } catch {
      toast.error(t('ag_signError'), t('error'));
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, typedName, checked, captureSignature, toast, t]);

  const canSubmit = checked && typedName.trim().length > 0 && !submitting;

  // ── Off-screen signature canvas (always mounted) ────────────────────────────
  const signatureWebView = (
    <View style={s.hiddenWebView} pointerEvents="none">
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: SIGNATURE_HTML }}
        onMessage={onWebViewMessage}
        javaScriptEnabled
        scrollEnabled={false}
      />
    </View>
  );

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (agreementsQuery.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />
        <ScreenHeader title={t('ag_title')} onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={BRAND} size="large" />
        </View>
        {signatureWebView}
      </View>
    );
  }

  // ── Detail / sign view ──────────────────────────────────────────────────────
  if (selected) {
    const isSigned = !!selected.signedAt;
    const workRows = WORK_FIELDS
      .map((f) => ({ labelKey: f.labelKey, value: selected.work?.[f.key] }))
      .filter((r) => !!r.value && String(r.value).trim().length > 0);

    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />
        <ScreenHeader title={t('ag_title')} onBack={closeDetail} />
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ERN + status */}
          <View style={s.detailHead}>
            <AppText style={[s.ern, { color: theme.colors.text }]}>{selected.ern}</AppText>
            {isSigned ? (
              <View style={[s.chip, { backgroundColor: '#ecfdf5', borderColor: '#6ee7b7' }]}>
                <AppText style={[s.chipTxt, { color: '#047857' }]}>{t('ag_signedChip')}</AppText>
              </View>
            ) : (
              <View style={[s.chip, { backgroundColor: '#fffbeb', borderColor: '#fcd34d' }]}>
                <AppText style={[s.chipTxt, { color: '#b45309' }]}>{t('ag_pendingChip')}</AppText>
              </View>
            )}
          </View>

          {isSigned && (
            <AppText style={[s.signedOn, { color: '#059669' }]}>
              {t('ag_signedOn', { date: formatDate(selected.signedAt) })}
            </AppText>
          )}

          {/* Employer block */}
          {(selected.employer?.name || selected.employer?.company || selected.employer?.phone) && (
            <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <AppText style={[s.cardTitle, { color: theme.colors.text }]}>{t('ag_employerSection')}</AppText>
              {!!selected.employer?.name && (
                <Row label={t('ag_employerName')} value={selected.employer.name} />
              )}
              {!!selected.employer?.company && (
                <Row label={t('ag_employerCompany')} value={selected.employer.company} />
              )}
              {!!selected.employer?.phone && (
                <Row label={t('ag_employerPhone')} value={selected.employer.phone} />
              )}
            </View>
          )}

          {/* Work block */}
          {workRows.length > 0 && (
            <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <AppText style={[s.cardTitle, { color: theme.colors.text }]}>{t('ag_workSection')}</AppText>
              {workRows.map((r) => (
                <Row key={r.labelKey} label={t(r.labelKey)} value={String(r.value)} />
              ))}
            </View>
          )}

          {/* Terms */}
          {selected.terms?.length > 0 && (
            <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <AppText style={[s.cardTitle, { color: theme.colors.text }]}>{t('ag_termsSection')}</AppText>
              {selected.terms.map((term, i) => (
                <View key={i} style={s.clauseRow}>
                  <AppText style={[s.clauseNum, { color: BRAND }]}>{i + 1}.</AppText>
                  <AppText style={[s.clauseTxt, { color: theme.colors.textSecondary }]}>{term}</AppText>
                </View>
              ))}
            </View>
          )}

          {/* Sign controls (only when pending) */}
          {!isSigned && (
            <>
              <TouchableOpacity
                style={s.checkRow}
                onPress={() => setChecked((v) => !v)}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    s.checkbox,
                    {
                      backgroundColor: checked ? BRAND : 'transparent',
                      borderColor: checked ? BRAND : theme.colors.border,
                    },
                  ]}
                >
                  {checked && <AppText style={s.checkMark}>✓</AppText>}
                </View>
                <AppText style={[s.checkLabel, { color: theme.colors.text }]}>{t('ag_agreeCheckbox')}</AppText>
              </TouchableOpacity>

              <AppText style={[s.fieldLabel, { color: theme.colors.textSecondary }]}>{t('ag_typeNameLabel')}</AppText>
              <TextInput
                style={[
                  s.input,
                  { backgroundColor: theme.colors.surface1, borderColor: theme.colors.border, color: theme.colors.text },
                ]}
                placeholder={t('ag_namePlaceholder')}
                placeholderTextColor={theme.colors.mutedText}
                value={typedName}
                onChangeText={setTypedName}
                autoCapitalize="words"
              />

              <TouchableOpacity
                onPress={() => void handleSign()}
                disabled={!canSubmit}
                style={[s.submitBtn, { backgroundColor: canSubmit ? BRAND : theme.colors.border }]}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <AppText style={s.submitTxt}>{t('ag_acceptBtn')}</AppText>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
        {signatureWebView}
      </View>
    );
  }

  // ── List / empty state ──────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader title={t('ag_title')} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {agreements.length === 0 ? (
          <View style={s.emptyBox}>
            <AppText style={s.emptyEmoji}>📄</AppText>
            <AppText style={[s.emptyTitle, { color: theme.colors.text }]}>{t('ag_emptyTitle')}</AppText>
            <AppText style={[s.emptySub, { color: theme.colors.mutedText }]}>{t('ag_emptySub')}</AppText>
          </View>
        ) : (
          agreements.map((a) => {
            const isSigned = !!a.signedAt;
            return (
              <TouchableOpacity
                key={a._id}
                onPress={() => openAgreement(a)}
                disabled={false}
                activeOpacity={0.8}
                style={[s.listCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <AppText style={[s.ern, { color: theme.colors.text }]}>{a.ern}</AppText>
                  <AppText style={[s.listSub, { color: theme.colors.mutedText }]} numberOfLines={1}>
                    {[a.work?.title, a.work?.location].filter(Boolean).join(' · ') || t('ag_noWorkDetails')}
                  </AppText>
                  {isSigned && (
                    <AppText style={[s.listSignedOn, { color: '#059669' }]}>
                      {t('ag_signedOn', { date: formatDate(a.signedAt) })}
                    </AppText>
                  )}
                </View>
                {isSigned ? (
                  <View style={[s.chip, { backgroundColor: '#ecfdf5', borderColor: '#6ee7b7' }]}>
                    <AppText style={[s.chipTxt, { color: '#047857' }]}>{t('ag_signedChip')}</AppText>
                  </View>
                ) : (
                  <View style={[s.chip, { backgroundColor: '#fffbeb', borderColor: '#fcd34d' }]}>
                    <AppText style={[s.chipTxt, { color: '#b45309' }]}>{t('ag_pendingChip')}</AppText>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
      {signatureWebView}
    </View>
  );
};

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  const { theme } = useAppTheme();
  return (
    <View style={s.row}>
      <AppText style={[s.rowLabel, { color: theme.colors.mutedText }]}>{label}</AppText>
      <AppText style={[s.rowValue, { color: theme.colors.text }]}>{value}</AppText>
    </View>
  );
}

const s = StyleSheet.create({
  hiddenWebView: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -9999, top: -9999 },

  // List
  listCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  listSub:      { fontSize: 12.5, fontWeight: '500', marginTop: 4 },
  listSignedOn: { fontSize: 11.5, fontWeight: '600', marginTop: 4 },

  // Empty
  emptyBox:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 10 },
  emptyEmoji:   { fontSize: 44 },
  emptyTitle:   { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptySub:     { fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },

  // Detail
  detailHead:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  ern:          { fontSize: 16, fontWeight: '900' },
  signedOn:     { fontSize: 12.5, fontWeight: '700', marginBottom: 12 },
  chip:         { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5 },
  chipTxt:      { fontSize: 11.5, fontWeight: '800' },

  card:         { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8, marginTop: 14 },
  cardTitle:    { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  row:          { flexDirection: 'row', gap: 10 },
  rowLabel:     { fontSize: 12.5, fontWeight: '700', width: 130 },
  rowValue:     { flex: 1, fontSize: 12.5, fontWeight: '500', lineHeight: 18 },

  clauseRow:    { flexDirection: 'row', gap: 8 },
  clauseNum:    { fontSize: 13, fontWeight: '800', lineHeight: 20 },
  clauseTxt:    { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 20 },

  checkRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 20, marginBottom: 18 },
  checkbox:     { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkMark:    { color: '#fff', fontSize: 14, fontWeight: '900' },
  checkLabel:   { flex: 1, fontSize: 13.5, fontWeight: '600', lineHeight: 20 },
  fieldLabel:   { fontSize: 12.5, fontWeight: '700', marginBottom: 6 },
  input:        { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '600' },
  submitBtn:    { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  submitTxt:    { color: '#fff', fontSize: 15, fontWeight: '800' },
});
