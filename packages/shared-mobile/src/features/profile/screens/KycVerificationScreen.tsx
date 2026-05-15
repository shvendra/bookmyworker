import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAppTheme } from '../../../core/theme';
import { useAuth } from '../../../state/auth/AuthContext';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppCard } from '../../../shared/components/ui/AppCard';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { Badge } from '../../../shared/components/ui/Badge';
import { apiClient } from '../../../core/api/client';
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
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission Required', 'Camera roll permission is needed to upload documents.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    allowsEditing: true,
    aspect: [4, 3],
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const ext = asset.uri.split('.').pop() ?? 'jpg';
  return { uri: asset.uri, name: `${title.replace(/\s/g, '_').toLowerCase()}.${ext}`, type: asset.mimeType ?? `image/${ext}` };
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

// ─── Labeled input ────────────────────────────────────────────────────────────
const LabeledInput = ({ label, value, onChangeText, placeholder, disabled, autoCapitalize }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder: string; disabled?: boolean; autoCapitalize?: 'none' | 'words' | 'sentences';
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const active = value.length > 0;
  return (
    <View style={{ marginBottom: 12 }}>
      <AppText style={inp.label}>{label}</AppText>
      <View style={[inp.field, {
        borderColor: active ? C.blue : C.border,
        backgroundColor: disabled ? C.border + '22' : theme.colors.card,
      }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.slate}
          editable={!disabled}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          style={[inp.input, { color: theme.colors.text, opacity: disabled ? 0.5 : 1 }]}
        />
      </View>
    </View>
  );
};
const inp = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', color: C.slate, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  field: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14 },
  input: { paddingVertical: 13, fontSize: 14, fontWeight: '500' },
});

// ─── Doc upload slot ──────────────────────────────────────────────────────────
const DocUploadSlot = ({ label, doc, onPick, disabled }: {
  label: string; doc: DocState | null; onPick: () => void; disabled?: boolean;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity onPress={onPick} disabled={disabled} activeOpacity={0.7}
      style={[ds.slot, { borderColor: doc ? C.blue : C.border, backgroundColor: theme.colors.card }]}>
      {doc ? (
        <>
          <Image source={{ uri: doc.uri }} style={ds.preview} resizeMode="cover" />
          <View style={ds.overlay}>
            <AppText style={ds.overlayTick}>✓</AppText>
            <AppText style={ds.overlayLabel}>{label}</AppText>
            <AppText style={ds.overlayChange}>Tap to change</AppText>
          </View>
        </>
      ) : (
        <View style={ds.empty}>
          <View style={ds.camBox}><AppText style={{ fontSize: 22 }}>📷</AppText></View>
          <AppText style={ds.emptyLabel}>{label}</AppText>
          <AppText style={ds.emptyHint}>Tap to upload</AppText>
        </View>
      )}
    </TouchableOpacity>
  );
};
const ds = StyleSheet.create({
  slot:         { flex: 1, height: 130, borderWidth: 1.5, borderRadius: 14, borderStyle: 'dashed', overflow: 'hidden' },
  preview:      { width: '100%', height: '100%' },
  overlay:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(37,99,235,0.85)', padding: 8, alignItems: 'center' },
  overlayTick:  { color: '#fff', fontSize: 12, fontWeight: '800' },
  overlayLabel: { color: '#fff', fontSize: 11, fontWeight: '700' },
  overlayChange:{ color: 'rgba(255,255,255,0.75)', fontSize: 10 },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12 },
  camBox:       { width: 44, height: 44, borderRadius: 12, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  emptyLabel:   { fontSize: 12, fontWeight: '700', color: C.navy, textAlign: 'center' },
  emptyHint:    { fontSize: 11, color: C.slate },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export const KycVerificationScreen = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const user = state.session?.user;
  const kycStatus: KycStatus = (user?.kycStatus ?? 'pending') as KycStatus;
  const isVerified = kycStatus === 'verified';

  // GST toggle
  const [hasGST, setHasGST]           = useState<boolean>(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // GST fields
  const [gstNumber,    setGstNumber]   = useState('');
  const [firmName,     setFirmName]    = useState('');
  const [firmAddress,  setFirmAddress] = useState('');

  // Aadhaar fields
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
          user?: { kyc?: { gstNumber?: string; firmName?: string; firmAddress?: string } }
        }>('/api/v1/user/getuser');
        const kyc = res.data?.user?.kyc;
        if (kyc?.gstNumber) {
          setHasGST(true);
          setGstNumber(kyc.gstNumber);
          setFirmName(kyc.firmName ?? '');
          setFirmAddress(kyc.firmAddress ?? '');
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
      if (hasGST) {
        if (!gstNumber.trim()) {
          Alert.alert('GST Required', 'Please enter your GST number to proceed.');
          return;
        }
        await apiClient.put('/api/v1/user/update', {
          kyc: {
            gstNumber: gstNumber.trim(),
            firmName:    firmName.trim(),
            firmAddress: firmAddress.trim(),
          },
        });
        setSuccess(true);
        Alert.alert('KYC Submitted', 'Your GST details have been submitted for verification.');
      } else {
        if (!front || !back) {
          Alert.alert('Documents Required', 'Please upload both Aadhaar front and back photos.');
          return;
        }
        const formData = new FormData();
        formData.append('aadharFront', { uri: front.uri, name: front.name, type: front.type } as unknown as Blob);
        formData.append('aadharBack',  { uri: back.uri,  name: back.name,  type: back.type  } as unknown as Blob);
        await apiClient.put('/api/v1/user/update', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setSuccess(true);
        Alert.alert('Documents Submitted', 'Your Aadhaar documents have been submitted. Verification usually takes 24–48 hours.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={[scr.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={scr.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Page title ──────────────────────────────────────────────── */}
      <View style={scr.pageHeader}>
        <AppText style={[scr.pageTitle, { color: C.navy }]}>KYC Verification</AppText>
        <AppText style={[scr.pageSub, { color: C.slate }]}>
          Complete your KYC to unlock full platform access.
        </AppText>
      </View>

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
          <AppText style={scr.statusLabel}>Verification Status</AppText>
          <Badge label={kycStatus} variant={kycBadgeVariant(kycStatus)} />
        </View>
        <AppText style={[scr.statusMsg, {
          color: kycStatus === 'verified' ? C.green : kycStatus === 'rejected' ? C.red : C.amber,
        }]}>
          {kycStatus === 'verified'
            ? 'Your identity is verified. You have full platform access.'
            : kycStatus === 'rejected'
            ? 'Verification rejected. Please re-upload correct documents.'
            : 'Submit your documents below. Verification takes 24–48 hours.'}
        </AppText>
      </View>

      {/* ── KYC form (hidden if verified) ───────────────────────────── */}
      {!isVerified && (
        <>
          {/* GST toggle */}
          <AppCard style={scr.card}>
            <SectionTitle icon="🏢" text="Do You Have GST?" />
            <AppText style={[scr.toggleHint, { color: C.slate }]}>
              If your business is GST registered, you can verify using GST instead of Aadhaar.
            </AppText>
            <View style={scr.toggleRow}>
              {[
                { label: 'Yes, I have GST',   val: true,  icon: '✅' },
                { label: 'No, use Aadhaar',   val: false, icon: '🪪' },
              ].map((opt) => {
                const active = hasGST === opt.val;
                return (
                  <TouchableOpacity
                    key={String(opt.val)}
                    onPress={() => { if (!isVerified) setHasGST(opt.val); }}
                    activeOpacity={0.8}
                    style={[scr.toggleBtn, {
                      backgroundColor: active ? C.navy : theme.colors.card,
                      borderColor:     active ? C.navy : C.border,
                    }]}
                  >
                    <AppText style={{ fontSize: 18 }}>{opt.icon}</AppText>
                    <AppText style={[scr.toggleBtnTxt, { color: active ? C.white : theme.colors.text }]}>
                      {opt.label}
                    </AppText>
                    {active && (
                      <View style={scr.toggleCheck}>
                        <AppText style={{ color: C.white, fontSize: 10, fontWeight: '800' }}>✓</AppText>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </AppCard>

          {/* ── GST path ──────────────────────────────────────────────── */}
          {hasGST && (
            <AppCard style={scr.card}>
              <SectionTitle icon="📋" text="GST Details" />
              <AppText style={[scr.fieldHint, { color: C.slate }]}>
                Enter your GST registration details. These will be verified by our team.
              </AppText>
              <LabeledInput
                label="GST Number *"
                value={gstNumber}
                onChangeText={setGstNumber}
                placeholder="e.g. 22AAAAA0000A1Z5"
                disabled={isVerified}
                autoCapitalize="none"
              />
              <LabeledInput
                label="Firm / Business Name"
                value={firmName}
                onChangeText={setFirmName}
                placeholder="Your registered firm name"
                disabled={isVerified}
                autoCapitalize="words"
              />
              <LabeledInput
                label="Firm Address"
                value={firmAddress}
                onChangeText={setFirmAddress}
                placeholder="Registered address"
                disabled={isVerified}
              />
              <View style={[scr.gstNote, { backgroundColor: C.blueSoft, borderColor: C.blueLight ?? '#bfdbfe' }]}>
                <AppText style={{ fontSize: 14 }}>ℹ️</AppText>
                <AppText style={[scr.gstNoteText, { color: '#1e40af' }]}>
                  GST-verified employers get a business badge and priority listing.
                </AppText>
              </View>
            </AppCard>
          )}

          {/* ── Aadhaar path ──────────────────────────────────────────── */}
          {!hasGST && (
            <AppCard style={scr.card}>
              <SectionTitle icon="🪪" text="Upload Aadhaar Card" />
              <AppText style={[scr.fieldHint, { color: C.slate }]}>
                Upload clear photos of both sides of your Aadhaar card.
              </AppText>
              <View style={scr.docsRow}>
                <DocUploadSlot
                  label="Aadhaar Front"
                  doc={front}
                  onPick={() => void pickImage('Aadhaar Front').then((d) => { if (d) setFront(d); })}
                  disabled={submitting}
                />
                <DocUploadSlot
                  label="Aadhaar Back"
                  doc={back}
                  onPick={() => void pickImage('Aadhaar Back').then((d) => { if (d) setBack(d); })}
                  disabled={submitting}
                />
              </View>
            </AppCard>
          )}

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
              <AppText style={[scr.feedbackText, { color: C.green }]}>
                Submitted successfully. Pending review.
              </AppText>
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
                {kycStatus === 'rejected' ? 'Re-submit Documents' : 'Submit for Verification'}
              </AppText>
            )}
          </TouchableOpacity>
        </>
      )}

      {/* ── Info notes ──────────────────────────────────────────────── */}
      <AppCard style={scr.card}>
        <SectionTitle icon="📌" text="Important Notes" />
        {[
          hasGST
            ? 'Enter your exact GST number as registered with the government.'
            : 'Use original Aadhaar card photos (not photocopies or scans).',
          'Ensure all text is clearly visible and not blurry.',
          'Files must be under 5 MB each.',
          'Your data is encrypted and used only for verification.',
        ].map((note, i) => (
          <View key={i} style={scr.noteRow}>
            <AppText style={[scr.noteBullet, { color: C.blue }]}>›</AppText>
            <AppText style={[scr.noteText, { color: C.slate }]}>{note}</AppText>
          </View>
        ))}
      </AppCard>
    </ScrollView>
  );
};

const C_blueLight = '#bfdbfe';

const scr = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: 16, paddingBottom: 48, gap: 12 },

  pageHeader: { marginBottom: 4 },
  pageTitle:  { fontSize: 22, fontWeight: '800' },
  pageSub:    { fontSize: 13, marginTop: 4, lineHeight: 18 },

  statusBanner: { borderRadius: 14, borderWidth: 1, padding: 14 },
  statusRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  statusLabel:  { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  statusMsg:    { fontSize: 12, lineHeight: 18 },

  card:         { marginBottom: 0 },

  toggleHint:   { fontSize: 12, lineHeight: 18, marginBottom: 14 },
  toggleRow:    { gap: 10 },
  toggleBtn:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 14, padding: 14, gap: 12 },
  toggleBtnTxt: { flex: 1, fontSize: 14, fontWeight: '700' },
  toggleCheck:  { width: 20, height: 20, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },

  fieldHint:  { fontSize: 12, lineHeight: 18, marginBottom: 14 },

  gstNote:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 6 },
  gstNoteText: { flex: 1, fontSize: 12, lineHeight: 18 },

  docsRow:    { flexDirection: 'row', gap: 10 },

  feedbackBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  feedbackText: { flex: 1, fontSize: 13, lineHeight: 18 },

  submitBtn:  { borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  submitTxt:  { color: '#ffffff', fontSize: 15, fontWeight: '800' },

  noteRow:    { flexDirection: 'row', gap: 8, marginBottom: 6 },
  noteBullet: { fontSize: 16, lineHeight: 20, fontWeight: '700' },
  noteText:   { flex: 1, fontSize: 12, lineHeight: 18 },
});
