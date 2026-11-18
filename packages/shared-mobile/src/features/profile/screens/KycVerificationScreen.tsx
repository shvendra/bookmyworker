import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../../../shared/state/toast/ToastContext';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../core/theme';
import { useAuth } from '../../../state/auth/AuthContext';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { Badge } from '../../../shared/components/ui/Badge';
import { apiClient } from '../../../core/api/client';
import { buildPhotoUrl } from '../../../core/config/env';
import type { KycStatus } from '../../../shared/types/domain';

import { BRAND } from '../../../core/theme/brand';
// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  navy:      '#0f172a',
  blue:      '#2563eb',
  blueSoft:  '#eff6ff',
  blueLight: '#dbeafe',
  green:     '#16a34a',
  greenSoft: '#f0fdf4',
  amber:     '#d97706',
  amberSoft: '#fffbeb',
  amberLight:'#fde68a',
  red:       '#dc2626',
  slate:     '#64748b',
  border:    '#e2e8f0',
  white:     '#ffffff',
};

interface DocState { uri: string; name: string; type: string }

const pickImage = async (title: string): Promise<DocState | null> => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (result.canceled || !result.assets[0]) return null;

    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() ?? 'jpg';

    return {
      uri: asset.uri,
      name: `${title.replace(/\s/g, '_').toLowerCase()}.${ext}`,
      type: asset.mimeType ?? `image/${ext}`,
    };
  } catch {
    return null;
  }
};

const kycBadgeVariant = (status: KycStatus) => {
  if (status === 'verified') return 'success' as const;
  if (status === 'rejected') return 'danger' as const;
  return 'warning' as const;
};

// ─── Section title ────────────────────────────────────────────────────────────
type IonName = React.ComponentProps<typeof Ionicons>['name'];
const SectionTitle = ({ icon, text }: { icon: IonName; text: string }): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View style={st.row}>
      <LinearGradient colors={['#E8EEFF', '#D6E2FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.iconBox}>
        <Ionicons name={icon} size={21} color={BRAND} />
      </LinearGradient>
      <AppText style={[st.label, { color: theme.colors.text }]}>{text}</AppText>
    </View>
  );
};
const st = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label:   { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '800', color: C.navy },
});

// ─── Verification progress: Submit → Review → Verified ────────────────────────
const StatusSteps = ({ step, tone }: { step: 1 | 2 | 3; tone: string }): React.JSX.Element => {
  const { t } = useTranslation();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (step === 3) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, step]);
  const labels = [t('kyc_stepSubmit'), t('kyc_stepReview'), t('kyc_stepVerified')];
  return (
    <View style={sp.wrap}>
      {labels.map((lb, i) => {
        const n = i + 1;
        const done = n < step || step === 3;
        const active = n === step && step !== 3;
        return (
          <React.Fragment key={lb}>
            <View style={sp.item}>
              <View>
                {active && (
                  <Animated.View
                    pointerEvents="none"
                    style={[sp.halo, { backgroundColor: tone, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }] }]}
                  />
                )}
                <View style={[sp.dot, done && { backgroundColor: tone, borderColor: tone }, active && { borderColor: tone, backgroundColor: '#fff' }]}>
                  {done ? <Ionicons name="checkmark" size={14} color="#fff" /> : <AppText style={[sp.dotTxt, active && { color: tone }]}>{n}</AppText>}
                </View>
              </View>
              <AppText style={[sp.lbl, (done || active) && { color: C.navy, fontWeight: '800' }]} numberOfLines={1}>{lb}</AppText>
            </View>
            {i < 2 && <View style={[sp.line, (n < step || step === 3) && { backgroundColor: tone }]} />}
          </React.Fragment>
        );
      })}
    </View>
  );
};
const sp = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 16 },
  item: { alignItems: 'center', width: 72, gap: 6 },
  halo: { position: 'absolute', left: 0, top: 0, width: 26, height: 26, borderRadius: 13 },
  dot:  { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#CBD5E1', backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  dotTxt: { fontSize: 11, lineHeight: 15, fontWeight: '800', color: '#94A3B8' },
  lbl:  { fontSize: 11, lineHeight: 15, fontWeight: '600', color: '#94A3B8', textAlign: 'center' },
  line: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#E2E8F0', marginTop: 11, marginHorizontal: -6 },
});

// ─── Premium submit button (gradient + light sweep while enabled) ─────────────
const KycSubmitButton = ({ label, enabled, busy, onPress }: { label: string; enabled: boolean; busy: boolean; onPress: () => void }): React.JSX.Element => {
  const sweep = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const [w, setW] = useState(300);
  useEffect(() => {
    if (!enabled || busy) { sweep.setValue(0); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(sweep, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [enabled, busy, sweep]);
  const to = (v: number): void => { Animated.spring(press, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 5 }).start(); };
  return (
    <Animated.View style={{ transform: [{ scale: press }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        disabled={!enabled || busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: !enabled || busy }}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
      >
        <View style={[sb.btn, enabled && sb.btnOn]}>
          <LinearGradient
            colors={enabled ? ['#2347C5', '#1037A4', '#0A2A80'] : ['#CBD5E1', '#B6C0CF']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {enabled && !busy && (
            <Animated.View pointerEvents="none" style={[sb.shine, { transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-90, w + 40] }) }, { skewX: '-20deg' }] }]} />
          )}
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={sb.row}>
              <Ionicons name="shield-checkmark" size={18} color={enabled ? '#FCD34D' : '#F1F5F9'} />
              <AppText style={sb.txt}>{label}</AppText>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};
const sb = StyleSheet.create({
  btn:   { borderRadius: 16, paddingVertical: 17, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  btnOn: { borderWidth: 1.5, borderColor: '#F59E0B' },
  shine: { position: 'absolute', top: -10, bottom: -10, width: 44, backgroundColor: 'rgba(255,255,255,0.28)' },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 9 },
  txt:   { color: '#fff', fontSize: 16, lineHeight: 22, fontWeight: '900', letterSpacing: 0.3 },
});

// ─── Doc upload slot ──────────────────────────────────────────────────────────
// Uses Pressable instead of TouchableOpacity — RN 0.81 New Architecture throws
// "Property 'TouchableOpacity' doesn't exist" when TouchableOpacity wraps a
// view with overflow:hidden in Fabric renderer.
const DocUploadSlot = ({ label, doc, onPick, disabled }: {
  label: string; doc: DocState | null; onPick: () => void; disabled?: boolean;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={disabled ? undefined : onPick}
      style={({ pressed }) => [
        ds.slot,
        { borderColor: doc ? '#CBEBD6' : '#C7D0E2', borderStyle: doc ? 'solid' : 'dashed', backgroundColor: doc ? theme.colors.card : '#F7F9FD', opacity: pressed ? 0.75 : 1 },
      ]}
    >
      {doc ? (
        <>
          <Image source={{ uri: doc.uri }} style={ds.preview} resizeMode="cover" />
          <View style={ds.overlay}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <AppText style={ds.overlayLabel}>{label}</AppText>
            <AppText style={ds.overlayChange}>{t('kyc_tapToChange')}</AppText>
          </View>
        </>
      ) : (
        <View style={ds.empty}>
          <View style={ds.camBox}><Ionicons name="camera" size={26} color={BRAND} /></View>
          <AppText style={[ds.emptyLabel, { color: theme.colors.text }]}>{label}</AppText>
          <View style={ds.tapPill}>
            <Ionicons name="cloud-upload-outline" size={13} color="#fff" />
            <AppText style={ds.tapPillTxt}>{t('kyc_tapToUpload')}</AppText>
          </View>
          <AppText style={ds.cropHint}>{t('kyc_cropRotate')}</AppText>
        </View>
      )}
    </Pressable>
  );
};
const ds = StyleSheet.create({
  slot:         { flex: 1, height: 184, borderWidth: 2, borderRadius: 16, borderStyle: 'dashed', overflow: 'hidden' },
  preview:      { width: '100%', height: '100%' },
  overlay:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(22,163,74,0.9)', padding: 8, alignItems: 'center' },
  overlayTick:  { color: '#fff', fontSize: 12, fontWeight: '800' },
  overlayLabel: { color: '#fff', fontSize: 11, fontWeight: '700' },
  overlayChange:{ color: 'rgba(255,255,255,0.75)', fontSize: 10 },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 12 },
  camBox:       { width: 56, height: 56, borderRadius: 18, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  tapPill:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: BRAND, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, marginTop: 4 },
  tapPillTxt:   { color: '#fff', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  emptyLabel:   { fontSize: 13, lineHeight: 18, fontWeight: '800', color: C.navy, textAlign: 'center' },
  emptyHint:    { fontSize: 11, color: C.slate },
  cropHint:     { fontSize: 10, color: C.blue, fontWeight: '600', textAlign: 'center', marginTop: 2 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export const KycVerificationScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const navigation = useNavigation();
  const user = state.session?.user;

  const [profileLoaded, setProfileLoaded] = useState(false);
  // The freshest status/reason comes from the getuser fetch below; until that
  // resolves we fall back to the (possibly stale) session values.
  const [liveStatus, setLiveStatus] = useState<KycStatus | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>(user?.kycRejectionReason ?? '');

  const kycStatus: KycStatus = (liveStatus ?? user?.kycStatus ?? 'pending') as KycStatus;
  const isVerified = kycStatus === 'verified';

  // Government ID photos (front & back)
  const [front, setFront] = useState<DocState | null>(null);
  const [back,  setBack]  = useState<DocState | null>(null);

  // Industry employers can verify via GST instead of a government ID
  const isIndustry = !!user?.employerType?.industry;
  const [hasGst, setHasGst] = useState<'yes' | 'no' | null>(null);
  const [gstNumber, setGstNumber] = useState('');
  const [firmName, setFirmName] = useState('');
  const [firmAddress, setFirmAddress] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState(false);
  // Explicit, recorded consent to provide a government ID for KYC.
  const [consent,    setConsent]    = useState(false);
  // True when documents/GST details are already on file → status "pending" means they are under review.
  const [onFile, setOnFile] = useState(false);

  // Load existing KYC data from profile
  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const res = await apiClient.get<{
          user?: { status?: string; kycRejectionReason?: string; kyc?: { aadharFront?: string; aadharBack?: string; gstNumber?: string; firmName?: string; firmAddress?: string; consent?: boolean } };
        }>('/api/v1/user/getuser');
        if (res.data?.user?.kyc?.consent) setConsent(true);
        const backendStatus = res.data?.user?.status;
        if (backendStatus) {
          setLiveStatus(
            backendStatus === 'Verified' ? 'verified'
            : (backendStatus === 'Block' || backendStatus === 'Rejected') ? 'rejected'
            : 'pending',
          );
        }
        setRejectionReason(res.data?.user?.kycRejectionReason ?? '');
        const kyc = res.data?.user?.kyc;
        if (kyc?.aadharFront || kyc?.aadharBack || kyc?.gstNumber) setOnFile(true);
        if (kyc?.aadharFront || kyc?.aadharBack) {
          const frontUrl = buildPhotoUrl(kyc.aadharFront);
          const backUrl  = buildPhotoUrl(kyc.aadharBack);
          if (frontUrl) setFront({ uri: frontUrl, name: 'id_front.jpg', type: 'image/jpeg' });
          if (backUrl)  setBack({ uri: backUrl,   name: 'id_back.jpg',  type: 'image/jpeg' });
        }
        // Prefill existing GST / firm details (industry employers)
        if (kyc?.gstNumber) { setGstNumber(kyc.gstNumber); setHasGst('yes'); }
        if (kyc?.firmName) setFirmName(kyc.firmName);
        if (kyc?.firmAddress) setFirmAddress(kyc.firmAddress);
      } catch { /* use defaults */ }
      finally { setProfileLoaded(true); }
    };
    void load();
  }, []);

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    if (!consent) {
      toast.warning(t('kyc_consentRequired'), t('kyc_docsRequired'));
      return;
    }
    setSubmitting(true);
    try {
      // Industry + has GST → submit GST/firm details instead of a government ID
      if (isIndustry && hasGst === 'yes') {
        if (!gstNumber.trim() || !firmName.trim() || !firmAddress.trim()) {
          toast.warning(t('kyc_gstRequiredMsg'), t('kyc_docsRequired'));
          return;
        }
        await apiClient.put('/api/v1/user/update', {
          gstNumber: gstNumber.trim(),
          firmName: firmName.trim(),
          firmAddress: firmAddress.trim(),
          kycConsent: 'true',
        });
        setSuccess(true);
        toast.success(t('kyc_docsSubmittedMsg'), t('kyc_docsSubmitted'));
        return;
      }
      if (!front || !back) {
        toast.warning(t('kyc_docsRequiredMsg'), t('kyc_docsRequired'));
        return;
      }
      const formData = new FormData();
      formData.append('aadharFront', { uri: front.uri, name: front.name, type: front.type } as unknown as Blob);
      formData.append('aadharBack',  { uri: back.uri,  name: back.name,  type: back.type  } as unknown as Blob);
      formData.append('kycConsent', 'true');
      await apiClient.put('/api/v1/user/update', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess(true);
      toast.success(t('kyc_docsSubmittedMsg'), t('kyc_docsSubmitted'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('kyc_uploadFailed');
      setError(msg);
      toast.error(msg, t('kyc_submissionFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader title={t('kyc_title')} onBack={() => navigation.goBack()} />
    <ScrollView keyboardShouldPersistTaps="handled"
      style={[scr.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={scr.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Status hero ─────────────────────────────────────────────── */}
      {(() => {
        const tone = kycStatus === 'verified' ? C.green : kycStatus === 'rejected' ? C.red : C.amber;
        const grad: [string, string] = kycStatus === 'verified' ? ['#ECFDF3', '#D1FADF'] : kycStatus === 'rejected' ? ['#FFF1F2', '#FFE0E3'] : ['#FFFAEB', '#FEF0C7'];
        const icon: IonName = kycStatus === 'verified' ? 'shield-checkmark' : kycStatus === 'rejected' ? 'alert-circle' : 'time';
        const step: 1 | 2 | 3 = kycStatus === 'verified' ? 3 : (kycStatus === 'pending' && (onFile || success)) ? 2 : 1;
        return (
          <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[scr.statusBanner, { borderColor: tone + '55' }]}>
            <View style={scr.statusRow}>
              <View style={[scr.statusIcon, { backgroundColor: tone }]}>
                <Ionicons name={icon} size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={scr.statusLabel}>{t('kyc_statusLabel')}</AppText>
                <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                  <Badge label={kycStatus} variant={kycBadgeVariant(kycStatus)} />
                </View>
              </View>
            </View>
            <AppText style={[scr.statusMsg, { color: tone }]}>
              {kycStatus === 'verified'
                ? t('kyc_statusVerified')
                : kycStatus === 'rejected'
                ? t('kyc_statusRejected')
                : t('kyc_statusPending')}
            </AppText>
            {kycStatus === 'rejected' && !!rejectionReason && (
              <View style={scr.reasonBox}>
                <AppText style={scr.reasonLabel}>{t('kyc_rejectionReasonLabel')}</AppText>
                <AppText style={scr.reasonText}>{rejectionReason}</AppText>
              </View>
            )}
            <StatusSteps step={step} tone={tone} />
          </LinearGradient>
        );
      })()}

      {/* ── KYC form (hidden if verified) ───────────────────────────── */}
      {!isVerified && (
        <>
          {/* ── Industry: Do you have GST? ───────────────────────────── */}
          {isIndustry && (
            <AppCard style={scr.card}>
              <SectionTitle icon="business-outline" text={t('kyc_gstQuestion')} />
              <View style={scr.gstToggleRow}>
                {(['yes', 'no'] as const).map((opt) => {
                  const on = hasGst === opt;
                  return (
                    <TouchableOpacity accessibilityRole="button"
                      key={opt}
                      onPress={() => setHasGst(opt)}
                      activeOpacity={0.85}
                      style={[scr.gstToggle, { borderColor: on ? C.blue : theme.colors.border, backgroundColor: on ? C.blueSoft : theme.colors.card }]}
                    >
                      <AppText style={[scr.gstToggleTxt, { color: on ? C.blue : theme.colors.text }]}>
                        {opt === 'yes' ? t('kyc_yes') : t('kyc_no')}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </AppCard>
          )}

          {/* ── Industry + GST: firm details ─────────────────────────── */}
          {isIndustry && hasGst === 'yes' ? (
            <AppCard style={scr.card}>
              <SectionTitle icon="document-text-outline" text={t('kyc_gstDetails')} />
              <AppText style={[scr.gstLabel, { color: theme.colors.text }]}>{t('kyc_gstNumber')}</AppText>
              <TextInput
                value={gstNumber} onChangeText={setGstNumber}
                placeholder={t('kyc_gstNumberPh')} placeholderTextColor={C.slate}
                autoCapitalize="characters" editable={!submitting}
                style={[scr.gstInput, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]}
              />
              <AppText style={[scr.gstLabel, { color: theme.colors.text }]}>{t('kyc_firmName')}</AppText>
              <TextInput
                value={firmName} onChangeText={setFirmName}
                placeholder={t('kyc_firmNamePh')} placeholderTextColor={C.slate} editable={!submitting}
                style={[scr.gstInput, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]}
              />
              <AppText style={[scr.gstLabel, { color: theme.colors.text }]}>{t('kyc_firmAddress')}</AppText>
              <TextInput
                value={firmAddress} onChangeText={setFirmAddress}
                placeholder={t('kyc_firmAddressPh')} placeholderTextColor={C.slate} multiline editable={!submitting}
                style={[scr.gstInput, scr.gstInputArea, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.card }]}
              />
            </AppCard>
          ) : (!isIndustry || hasGst === 'no') ? (
            <AppCard style={scr.card}>
              <SectionTitle icon="id-card-outline" text={t('kyc_uploadIdTitle')} />
              <AppText style={[scr.fieldHint, { color: theme.colors.mutedText }]}>{t('kyc_uploadIdHint')}</AppText>
              <View style={scr.docsRow}>
                <DocUploadSlot
                  label={t('kyc_idFront')}
                  doc={front}
                  onPick={() => void pickImage('id_front').then((d) => { if (d) setFront(d); })}
                  disabled={submitting}
                />
                <DocUploadSlot
                  label={t('kyc_idBack')}
                  doc={back}
                  onPick={() => void pickImage('id_back').then((d) => { if (d) setBack(d); })}
                  disabled={submitting}
                />
              </View>
              {/* File format hint */}
              <View style={scr.formatHint}>
                <Ionicons name="attach" size={16} color={C.slate} />
                <AppText style={[scr.formatHintTxt, { color: C.slate }]}>{t('kyc_formatHint')}</AppText>
              </View>
              <View style={scr.trustRow}>
                <Ionicons name="lock-closed" size={14} color={C.green} />
                <AppText style={scr.trustTxt}>{t('kyc_trustLine')}</AppText>
              </View>
            </AppCard>
          ) : null}

          {/* ── Feedback messages ─────────────────────────────────────── */}
          {!!error && (
            <View style={[scr.feedbackBox, { backgroundColor: '#fff1f2', borderColor: '#fca5a5' }]}>
              <AppText style={{ fontSize: 14 }}>⚠️</AppText>
              <AppText style={[scr.feedbackText, { color: C.red }]}>{error}</AppText>
            </View>
          )}
          {success && (
            <View style={[scr.feedbackBox, { backgroundColor: C.greenSoft, borderColor: '#86efac' }]}>
              <AppText style={{ fontSize: 14 }}>✅</AppText>
              <AppText style={[scr.feedbackText, { color: C.green }]}>{t('kyc_successMsg')}</AppText>
            </View>
          )}

          {/* ── Consent (required) ────────────────────────────────────── */}
          <Pressable
            onPress={() => setConsent((c) => !c)}
            style={({ pressed }) => [scr.consentRow, { opacity: pressed ? 0.8 : 1 }]}
          >
            <View style={[scr.consentBox, { borderColor: consent ? C.blue : '#C7D0E2', backgroundColor: consent ? C.blue : 'transparent' }]}>
              {consent && <Ionicons name="checkmark" size={15} color="#fff" />}
            </View>
            <AppText style={[scr.consentTxt, { color: theme.colors.mutedText }]}>{t('kyc_consentLabel')}</AppText>
          </Pressable>

          {/* ── Submit ────────────────────────────────────────────────── */}
          <KycSubmitButton
            label={kycStatus === 'rejected' ? t('kyc_resubmitBtn') : t('kyc_submitBtn')}
            enabled={profileLoaded && consent && !(isIndustry && hasGst === null)}
            busy={submitting}
            onPress={() => void handleSubmit()}
          />
        </>
      )}

      {/* ── Info notes ──────────────────────────────────────────────── */}
      <AppCard style={scr.card}>
        <SectionTitle icon="information-circle-outline" text={t('kyc_importantNotes')} />
        {([
          t('kyc_note1'),
          t('kyc_note2'),
          t('kyc_note3'),
          t('kyc_note4'),
        ] as string[]).map((note, i) => (
          <View key={i} style={scr.noteRow}>
            <Ionicons name="checkmark-circle" size={16} color={C.green} style={{ marginTop: 1 }} />
            <AppText style={[scr.noteText, { color: theme.colors.mutedText }]}>{note}</AppText>
          </View>
        ))}
      </AppCard>
    </ScrollView>
    </View>
  );
};

const scr = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: 16, paddingBottom: 48, gap: 12 },

  statusBanner: { borderRadius: 20, borderWidth: 1, padding: 16 },
  statusIcon:   { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  statusRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  statusLabel:  { fontSize: 15, lineHeight: 21, fontWeight: '800', color: '#0f172a' },
  statusMsg:    { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  reasonBox:    { marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#fca5a5' },
  reasonLabel:  { fontSize: 11, fontWeight: '800', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  reasonText:   { fontSize: 13, lineHeight: 19, color: '#7f1d1d' },

  card:       { marginBottom: 0 },
  fieldHint:  { fontSize: 12, lineHeight: 18, marginBottom: 14 },

  docsRow:    { flexDirection: 'row', gap: 10 },
  formatHint:    { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16, backgroundColor: '#F1F6FB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#E0E9F4' },
  formatHintTxt: { fontSize: 12, lineHeight: 17 },

  // GST (industry) flow
  gstToggleRow:  { flexDirection: 'row', gap: 10, marginTop: 14 },
  gstToggle:     { flex: 1, borderWidth: 1.6, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  gstToggleTxt:  { fontSize: 15, fontWeight: '800' },
  gstLabel:      { fontSize: 13.5, fontWeight: '700', marginTop: 14, marginBottom: 9 },
  gstInput:      { height: 54, borderWidth: 1.6, borderRadius: 13, paddingHorizontal: 15, fontSize: 15, fontWeight: '700' },
  gstInputArea:  { height: 92, paddingTop: 14, textAlignVertical: 'top' },

  feedbackBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  feedbackText: { flex: 1, fontSize: 13, lineHeight: 18 },

  consentRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 14, backgroundColor: '#F8FAFF', borderWidth: 1, borderColor: '#DCE5F8' },
  consentBox:  { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  consentTick: { color: '#fff', fontSize: 13, fontWeight: '900', lineHeight: 16 },
  consentTxt:  { flex: 1, fontSize: 12.5, lineHeight: 19 },
  trustRow:    { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12, paddingHorizontal: 2 },
  trustTxt:    { flex: 1, fontSize: 11.5, lineHeight: 16, fontWeight: '600', color: '#15803D' },

  submitBtn:  { borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  submitTxt:  { color: '#ffffff', fontSize: 15, fontWeight: '800' },

  noteRow:    { flexDirection: 'row', gap: 8, marginBottom: 6 },
  noteBullet: { fontSize: 16, lineHeight: 20, fontWeight: '700' },
  noteText:   { flex: 1, fontSize: 12, lineHeight: 18 },
});
