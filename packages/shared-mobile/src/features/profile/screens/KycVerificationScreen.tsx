import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
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
const SectionTitle = ({ icon, text }: { icon: string; text: string }): React.JSX.Element => (
  <View style={st.row}>
    <View style={st.iconBox}><AppText style={st.icon}>{icon}</AppText></View>
    <AppText style={st.label}>{text}</AppText>
  </View>
);
const st = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  iconBox: { width: 34, height: 34, borderRadius: 9, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
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
        { borderColor: doc ? C.blue : C.border, backgroundColor: theme.colors.card, opacity: pressed ? 0.75 : 1 },
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
          <AppText style={ds.emptyLabel}>{label}</AppText>
          <AppText style={ds.emptyHint}>{t('kyc_tapToUpload')}</AppText>
          <AppText style={ds.cropHint}>{t('kyc_cropRotate')}</AppText>
        </View>
      )}
    </Pressable>
  );
};
const ds = StyleSheet.create({
  slot:         { flex: 1, height: 150, borderWidth: 1.5, borderRadius: 14, borderStyle: 'dashed', overflow: 'hidden' },
  preview:      { width: '100%', height: '100%' },
  overlay:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(37,99,235,0.85)', padding: 8, alignItems: 'center' },
  overlayTick:  { color: '#fff', fontSize: 12, fontWeight: '800' },
  overlayLabel: { color: '#fff', fontSize: 11, fontWeight: '700' },
  overlayChange:{ color: 'rgba(255,255,255,0.75)', fontSize: 10 },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 12 },
  camBox:       { width: 44, height: 44, borderRadius: 12, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
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

  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState(false);

  // Load existing KYC data from profile
  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const res = await apiClient.get<{
          user?: { kyc?: { aadharFront?: string; aadharBack?: string } };
        }>('/api/v1/user/getuser');
        const kyc = res.data?.user?.kyc;
        if (kyc?.aadharFront || kyc?.aadharBack) {
          const frontUrl = buildPhotoUrl(kyc.aadharFront);
          const backUrl  = buildPhotoUrl(kyc.aadharBack);
          if (frontUrl) setFront({ uri: frontUrl, name: 'id_front.jpg', type: 'image/jpeg' });
          if (backUrl)  setBack({ uri: backUrl,   name: 'id_back.jpg',  type: 'image/jpeg' });
        }
      } catch { /* use defaults */ }
      finally { setProfileLoaded(true); }
    };
    void load();
  }, []);

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
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
          {/* ── Government ID upload ──────────────────────────────────── */}
          <AppCard style={scr.card}>
            <SectionTitle icon="🪪" text={t('kyc_uploadIdTitle')} />
            <AppText style={[scr.fieldHint, { color: C.slate }]}>{t('kyc_uploadIdHint')}</AppText>
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
            disabled={submitting || !profileLoaded}
            activeOpacity={0.85}
            style={[scr.submitBtn, {
              backgroundColor: submitting ? C.slate : C.navy,
              opacity: !profileLoaded ? 0.5 : 1,
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
            <AppText style={[scr.noteText, { color: C.slate }]}>{note}</AppText>
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

  statusBanner: { borderRadius: 14, borderWidth: 1, padding: 14 },
  statusRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  statusLabel:  { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  statusMsg:    { fontSize: 12, lineHeight: 18 },

  card:       { marginBottom: 0 },
  fieldHint:  { fontSize: 12, lineHeight: 18, marginBottom: 14 },

  docsRow:    { flexDirection: 'row', gap: 10 },
  formatHint:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: C.border },
  formatHintTxt: { fontSize: 12, lineHeight: 17 },

  feedbackBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  feedbackText: { flex: 1, fontSize: 13, lineHeight: 18 },

  submitBtn:  { borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  submitTxt:  { color: '#ffffff', fontSize: 15, fontWeight: '800' },

  noteRow:    { flexDirection: 'row', gap: 8, marginBottom: 6 },
  noteBullet: { fontSize: 16, lineHeight: 20, fontWeight: '700' },
  noteText:   { flex: 1, fontSize: 12, lineHeight: 18 },
});
