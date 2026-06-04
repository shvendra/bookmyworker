import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
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
import { getPlatformTermsStatus, acceptPlatformTerms } from '../../../core/api/endpoints/platformTermsApi';
import type { MainStackParamList } from '../../../app/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const BRAND = '#1037A4';

// The platform-terms clauses live in i18n (employer namespace, all 11 languages).
const CLAUSE_KEYS = ['pt_clause1', 'pt_clause2', 'pt_clause3', 'pt_clause4', 'pt_clause5', 'pt_clause6'] as const;

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

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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

  const [checked, setChecked] = useState(false);
  const [typedName, setTypedName] = useState(sessionName);
  const [submitting, setSubmitting] = useState(false);

  const webviewRef = useRef<WebView>(null);
  // Promise resolver awaiting the next onMessage (the signature data URL).
  const pendingSignature = useRef<((dataUrl: string) => void) | null>(null);

  const statusQuery = useQuery({
    queryKey: ['employer-platform-terms'],
    queryFn: getPlatformTermsStatus,
    staleTime: 60 * 1000,
  });

  const status = statusQuery.data ?? null;
  const accepted = !!status?.accepted;

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

  const handleAccept = useCallback(async () => {
    const name = typedName.trim();
    if (!checked || !name) return;
    setSubmitting(true);
    try {
      const dataUrl = await captureSignature(name);
      await acceptPlatformTerms(name, dataUrl);
      await statusQuery.refetch();
      toast.success(t('pt_signSuccess'), t('pt_signedChip'));
    } catch {
      toast.error(t('pt_signError'), t('error'));
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typedName, checked, captureSignature, toast, t]);

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
  if (statusQuery.isLoading) {
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

  // ── Load error ──────────────────────────────────────────────────────────────
  if (statusQuery.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />
        <ScreenHeader title={t('ag_title')} onBack={() => navigation.goBack()} />
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}
          refreshControl={
            <RefreshControl refreshing={statusQuery.isFetching} onRefresh={() => statusQuery.refetch()} tintColor={BRAND} />
          }
        >
          <AppText style={s.emptyEmoji}>⚠️</AppText>
          <AppText style={[s.emptySub, { color: theme.colors.mutedText }]}>{t('pt_loadError')}</AppText>
        </ScrollView>
        {signatureWebView}
      </View>
    );
  }

  // ── Main ────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader title={t('ag_title')} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={statusQuery.isFetching} onRefresh={() => statusQuery.refetch()} tintColor={BRAND} />
        }
      >
        {/* Accepted banner */}
        {accepted && (
          <View style={[s.acceptedCard, { backgroundColor: '#ecfdf5', borderColor: '#6ee7b7' }]}>
            <AppText style={s.acceptedEmoji}>✅</AppText>
            <AppText style={[s.acceptedTitle, { color: '#047857' }]}>{t('pt_acceptedTitle')}</AppText>
            <AppText style={[s.acceptedBody, { color: '#065f46' }]}>{t('pt_acceptedBody')}</AppText>
            {!!status?.name && (
              <AppText style={[s.acceptedMeta, { color: '#047857' }]}>{t('pt_acceptedBy', { name: status.name })}</AppText>
            )}
            {!!status?.acceptedAt && (
              <AppText style={[s.acceptedMeta, { color: '#047857' }]}>
                {t('pt_acceptedOn', { date: formatDate(status.acceptedAt) })}
              </AppText>
            )}
          </View>
        )}

        {/* Heading + intro */}
        <AppText style={[s.heading, { color: theme.colors.text }]}>{t('pt_heading')}</AppText>
        {!accepted && <AppText style={[s.intro, { color: theme.colors.mutedText }]}>{t('pt_intro')}</AppText>}

        {/* Terms clauses */}
        <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          {CLAUSE_KEYS.map((key, i) => (
            <View key={key} style={s.clauseRow}>
              <AppText style={[s.clauseNum, { color: BRAND }]}>{i + 1}.</AppText>
              <AppText style={[s.clauseTxt, { color: theme.colors.textSecondary }]}>{t(key)}</AppText>
            </View>
          ))}
        </View>

        {accepted ? (
          <AppText style={[s.reviewNote, { color: theme.colors.mutedText }]}>{t('pt_reviewNote')}</AppText>
        ) : (
          <>
            {/* Agree checkbox */}
            <TouchableOpacity style={s.checkRow} onPress={() => setChecked((v) => !v)} activeOpacity={0.75}>
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
              <AppText style={[s.checkLabel, { color: theme.colors.text }]}>{t('pt_agreeCheckbox')}</AppText>
            </TouchableOpacity>

            {/* Typed-name signature */}
            <AppText style={[s.fieldLabel, { color: theme.colors.textSecondary }]}>{t('pt_typeNameLabel')}</AppText>
            <TextInput
              style={[
                s.input,
                { backgroundColor: theme.colors.surface1, borderColor: theme.colors.border, color: theme.colors.text },
              ]}
              placeholder={t('pt_namePlaceholder')}
              placeholderTextColor={theme.colors.mutedText}
              value={typedName}
              onChangeText={setTypedName}
              autoCapitalize="words"
            />

            {/* Accept */}
            <TouchableOpacity
              onPress={() => void handleAccept()}
              disabled={!canSubmit}
              style={[s.submitBtn, { backgroundColor: canSubmit ? BRAND : theme.colors.border }]}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <AppText style={s.submitTxt}>{t('pt_acceptBtn')}</AppText>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
      {signatureWebView}
    </View>
  );
};

const s = StyleSheet.create({
  hiddenWebView: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -9999, top: -9999 },

  // Empty / error
  emptyEmoji: { fontSize: 44, textAlign: 'center', marginBottom: 10 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },

  // Accepted banner
  acceptedCard: { borderRadius: 16, borderWidth: 1, padding: 18, alignItems: 'center', gap: 4, marginBottom: 18 },
  acceptedEmoji: { fontSize: 36, marginBottom: 4 },
  acceptedTitle: { fontSize: 17, fontWeight: '900' },
  acceptedBody: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19, marginTop: 2 },
  acceptedMeta: { fontSize: 12, fontWeight: '700', marginTop: 4 },

  // Heading
  heading: { fontSize: 19, fontWeight: '900', marginBottom: 6 },
  intro: { fontSize: 13, fontWeight: '500', lineHeight: 20, marginBottom: 4 },

  // Terms card
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12, marginTop: 14 },
  clauseRow: { flexDirection: 'row', gap: 8 },
  clauseNum: { fontSize: 14, fontWeight: '800', lineHeight: 21 },
  clauseTxt: { flex: 1, fontSize: 13.5, fontWeight: '500', lineHeight: 21 },

  reviewNote: { fontSize: 12.5, fontWeight: '500', textAlign: 'center', lineHeight: 19, marginTop: 16 },

  // Sign controls
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 20, marginBottom: 18 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '900' },
  checkLabel: { flex: 1, fontSize: 13.5, fontWeight: '600', lineHeight: 20 },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', marginBottom: 6 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '600' },
  submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  submitTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
