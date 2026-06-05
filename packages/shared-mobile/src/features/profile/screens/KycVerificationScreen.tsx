import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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
const SectionTitle = ({ icon, text }: { icon: string; text: string }): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View style={st.row}>
      <View style={st.iconBox}><AppText style={st.icon}>{icon}</AppText></View>
      <AppText style={[st.label, { color: theme.colors.text }]}>{text}</AppText>
    </View>
  );
};
const st = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEF2FE', alignItems: 'center', justifyContent: 'center' },
  icon:    { fontSize: 16 },
  label:   { fontSize: 15, fontWeight: '800', color: C.navy },
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
            <AppText style={ds.overlayTick}>✓</AppText>
            <AppText style={ds.overlayLabel}>{label}</AppText>
            <AppText style={ds.overlayChange}>{t('kyc_tapToChange')}</AppText>
          </View>
        </>
      ) : (
        <View style={ds.empty}>
          <View style={ds.camBox}><AppText style={{ fontSize: 22 }}>📷</AppText></View>
          <AppText style={[ds.emptyLabel, { color: theme.colors.text }]}>{label}</AppText>
          <AppText style={[ds.emptyHint, { color: theme.colors.mutedText }]}>{t('kyc_tapToUpload')}</AppText>
          <AppText style={ds.cropHint}>{t('kyc_cropRotate')}</AppText>
        </View>
      )}
    </Pressable>
  );
};
const ds = StyleSheet.create({
  slot:         { flex: 1, height: 172, borderWidth: 2, borderRadius: 16, borderStyle: 'dashed', overflow: 'hidden' },
  preview:      { width: '100%', height: '100%' },
  overlay:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(37,99,235,0.85)', padding: 8, alignItems: 'center' },
  overlayTick:  { color: '#fff', fontSize: 12, fontWeight: '800' },
  overlayLabel: { color: '#fff', fontSize: 11, fontWeight: '700' },
  overlayChange:{ color: 'rgba(255,255,255,0.75)', fontSize: 10 },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 12 },
  camBox:       { width: 50, height: 50, borderRadius: 14, backgroundColor: '#EEF2FE', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyLabel:   { fontSize: 12, fontWeight: '700', color: C.navy, textAlign: 'center' },
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
  const kycStatus: KycStatus = (user?.kycStatus ?? 'pending') as KycStatus;
  const isVerified = kycStatus === 'verified';

  const [profileLoaded, setProfileLoaded] = useState(false);

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

  // Load existing KYC data from profile
  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const res = await apiClient.get<{
          user?: { kyc?: { aadharFront?: string; aadharBack?: string; gstNumber?: string; firmName?: string; firmAddress?: string } };
        }>('/api/v1/user/getuser');
        const kyc = res.data?.user?.kyc;
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
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader title={t('kyc_title')} onBack={() => navigation.goBack()} />
    <ScrollView
      style={[scr.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={scr.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Status banner ───────────────────────────────────────────── */}
      <View style={[scr.statusBanner, {
        backgroundColor:
          kycStatus === 'verified' ? C.greenSoft :
          kycStatus === 'rejected' ? '#fff1f2' : C.amberSoft,
        borderColor:
          kycStatus === 'verified' ? '#86efac' :
          kycStatus === 'rejected' ? '#fca5a5' : C.amberLight,
      }]}>
        <View style={scr.statusRow}>
          <AppText style={scr.statusLabel}>{t('kyc_statusLabel')}</AppText>
          <Badge label={kycStatus} variant={kycBadgeVariant(kycStatus)} />
        </View>
        <AppText style={[scr.statusMsg, {
          color: kycStatus === 'verified' ? C.green : kycStatus === 'rejected' ? C.red : C.amber,
        }]}>
          {kycStatus === 'verified'
            ? t('kyc_statusVerified')
            : kycStatus === 'rejected'
            ? t('kyc_statusRejected')
            : t('kyc_statusPending')}
        </AppText>
      </View>

      {/* ── KYC form (hidden if verified) ───────────────────────────── */}
      {!isVerified && (
        <>
          {/* ── Industry: Do you have GST? ───────────────────────────── */}
          {isIndustry && (
            <AppCard style={scr.card}>
              <SectionTitle icon="🏢" text={t('kyc_gstQuestion')} />
              <View style={scr.gstToggleRow}>
                {(['yes', 'no'] as const).map((opt) => {
                  const on = hasGst === opt;
                  return (
                    <TouchableOpacity
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
              <SectionTitle icon="📄" text={t('kyc_gstDetails')} />
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
              <SectionTitle icon="🪪" text={t('kyc_uploadIdTitle')} />
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
                <AppText style={{ fontSize: 13 }}>📎</AppText>
                <AppText style={[scr.formatHintTxt, { color: C.slate }]}>{t('kyc_formatHint')}</AppText>
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

          {/* ── Submit ────────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={() => void handleSubmit()}
            disabled={submitting || !profileLoaded || (isIndustry && hasGst === null)}
            activeOpacity={0.85}
            style={[scr.submitBtn, {
              backgroundColor: submitting ? C.slate : C.navy,
              opacity: (!profileLoaded || (isIndustry && hasGst === null)) ? 0.5 : 1,
            }]}
          >
            {submitting ? (
              <ActivityIndicator color={C.white} size="small" />
            ) : (
              <AppText style={scr.submitTxt}>
                {kycStatus === 'rejected' ? t('kyc_resubmitBtn') : t('kyc_submitBtn')}
              </AppText>
            )}
          </TouchableOpacity>
        </>
      )}

      {/* ── Info notes ──────────────────────────────────────────────── */}
      <AppCard style={scr.card}>
        <SectionTitle icon="📌" text={t('kyc_importantNotes')} />
        {([
          t('kyc_note1'),
          t('kyc_note2'),
          t('kyc_note3'),
          t('kyc_note4'),
        ] as string[]).map((note, i) => (
          <View key={i} style={scr.noteRow}>
            <AppText style={[scr.noteBullet, { color: C.blue }]}>›</AppText>
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

  statusBanner: { borderRadius: 18, borderWidth: 1, padding: 16 },
  statusRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  statusLabel:  { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  statusMsg:    { fontSize: 12, lineHeight: 18 },

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

  submitBtn:  { borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  submitTxt:  { color: '#ffffff', fontSize: 15, fontWeight: '800' },

  noteRow:    { flexDirection: 'row', gap: 8, marginBottom: 6 },
  noteBullet: { fontSize: 16, lineHeight: 20, fontWeight: '700' },
  noteText:   { flex: 1, fontSize: 12, lineHeight: 18 },
});
