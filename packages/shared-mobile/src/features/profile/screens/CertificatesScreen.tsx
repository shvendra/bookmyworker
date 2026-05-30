import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlert } from '../../../shared/state/alert/AppAlertContext';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import { useAuth } from '../../../state/auth/AuthContext';
import { certificateApi } from '../../../core/api/endpoints/certificateApi';
import { useNavigation } from '@react-navigation/native';
import type { Certificate } from '../../types/domain';

const BRAND   = '#1037A4';
const GREEN   = '#16A34A';
const ORANGE  = '#F97316';
const SLATE   = '#64748B';
const BORDER  = '#E2E8F0';
const WHITE   = '#FFFFFF';

// ── Small remark banner ───────────────────────────────────────────────────────
const RemarkBanner = ({ icon, text, color }: { icon: string; text: string; color: string }) => {
  const { theme } = useAppTheme();
  return (
    <View style={[rb.wrap, { backgroundColor: color + '12', borderColor: color + '40', borderLeftColor: color }]}>
      <AppText style={rb.icon}>{icon}</AppText>
      <AppText style={[rb.text, { color: theme.colors.text }]}>{text}</AppText>
    </View>
  );
};
const rb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 1, borderLeftWidth: 4, padding: 14, marginBottom: 8 },
  icon: { fontSize: 20, lineHeight: 24, flexShrink: 0 },
  text: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
});

// ── Certificate card ──────────────────────────────────────────────────────────
interface CertCardProps {
  cert: Certificate;
  index: number;
  onDelete: (i: number) => void;
  deleting: boolean;
}

const CertCard = ({ cert, index, onDelete, deleting }: CertCardProps) => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const isPdf = cert.fileType === 'pdf';

  const handleOpen = (): void => {
    void Linking.openURL(cert.url);
  };

  return (
    <View style={[cc.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={cc.row}>
        {/* Thumbnail or PDF icon */}
        <TouchableOpacity onPress={handleOpen} activeOpacity={0.8} style={[cc.thumb, { backgroundColor: isPdf ? '#FEF3C7' : theme.colors.surface }]}>
          {isPdf ? (
            <AppText style={cc.pdfIcon}>📄</AppText>
          ) : (
            <Image source={{ uri: cert.url }} style={cc.img} resizeMode="cover" />
          )}
        </TouchableOpacity>

        <View style={cc.info}>
          <AppText style={[cc.name, { color: theme.colors.text }]} numberOfLines={2}>{cert.name || t('cert_untitled')}</AppText>
          <AppText style={[cc.date, { color: theme.colors.mutedText }]}>
            {new Date(cert.uploadedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </AppText>
          <TouchableOpacity onPress={handleOpen} activeOpacity={0.8}>
            <AppText style={[cc.view, { color: BRAND }]}>{t('cert_view')} →</AppText>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => onDelete(index)}
          disabled={deleting}
          style={cc.delBtn}
          activeOpacity={0.75}
        >
          {deleting ? <ActivityIndicator size="small" color="#EF4444" /> : <AppText style={cc.delIcon}>🗑️</AppText>}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const cc = StyleSheet.create({
  card:  { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 60, height: 60, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  img:   { width: 60, height: 60 },
  pdfIcon: { fontSize: 28, lineHeight: 36 },
  info:  { flex: 1, gap: 3 },
  name:  { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  date:  { fontSize: 11, lineHeight: 15 },
  view:  { fontSize: 12, fontWeight: '700', marginTop: 2 },
  delBtn:{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  delIcon:{ fontSize: 18, lineHeight: 24 },
});

// ── Individual file-pick helpers (no Promise-Alert wrapping → no hanging) ─────
async function pickFromCamera(): Promise<{ uri: string; name: string; mimeType: string } | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: true });
  if (result.canceled || !result.assets[0]) return null;
  const a = result.assets[0];
  const ext = a.uri.split('.').pop() ?? 'jpg';
  return { uri: a.uri, name: `cert.${ext}`, mimeType: a.mimeType ?? `image/${ext}` };
}

async function pickFromGallery(): Promise<{ uri: string; name: string; mimeType: string } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsEditing: true });
  if (result.canceled || !result.assets[0]) return null;
  const a = result.assets[0];
  const ext = a.uri.split('.').pop() ?? 'jpg';
  return { uri: a.uri, name: `cert.${ext}`, mimeType: a.mimeType ?? `image/${ext}` };
}

async function pickDocument(): Promise<{ uri: string; name: string; mimeType: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const a = result.assets[0];
  return { uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/pdf' };
}

// ── Main screen ───────────────────────────────────────────────────────────────
export const CertificatesScreen = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const { state, updateProfile } = useAuth();
  const queryClient = useQueryClient();
  const navigation = useNavigation();

  const role = (state.session?.user.role ?? 'worker').toLowerCase();
  const isAgent = role === 'agent';
  const isWorker = role === 'worker' || role === 'selfworker';

  // Name input for new certificate (worker only)
  const [certName, setCertName] = useState('');
  const [deletingIdx, setDeletingIdx] = useState<number | null>(null);
  // tracks which upload source is currently active ('camera'|'gallery'|'pdf'|null)
  const [uploadingSource, setUploadingSource] = useState<'camera' | 'gallery' | 'pdf' | null>(null);

  // ── Data fetch ──────────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['user-certificates'],
    queryFn: () => certificateApi.getAll(),
    staleTime: 30_000,
  });

  const certificates = data?.certificates ?? [];
  const licenceUrl   = data?.labourLicenceUrl ?? null;

  // ── Upload certificate (worker) — one mutation per source ──────────────────
  const uploadCertMutation = useMutation({
    mutationFn: async (pickerFn: () => Promise<{ uri: string; name: string; mimeType: string } | null>) => {
      const file = await pickerFn();
      if (!file) return; // user cancelled — mutation ends cleanly
      const nameToUse = certName.trim() || t('cert_defaultName');
      await certificateApi.uploadCertificate(file.uri, file.name, file.mimeType, nameToUse);
      setCertName('');
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['user-certificates'] }); },
    onError: (err: unknown) => {
      showAlert(t('error'), err instanceof Error ? err.message : t('cert_uploadFailed'));
    },
    onSettled: () => setUploadingSource(null),
  });

  const handleUploadCert = (source: 'camera' | 'gallery' | 'pdf'): void => {
    if (uploadCertMutation.isPending) return;
    setUploadingSource(source);
    const picker = source === 'camera' ? pickFromCamera : source === 'gallery' ? pickFromGallery : pickDocument;
    uploadCertMutation.mutate(picker);
  };

  // ── Delete certificate ──────────────────────────────────────────────────────
  const deleteCertMutation = useMutation({
    mutationFn: (idx: number) => certificateApi.deleteCertificate(idx),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['user-certificates'] }); },
    onError: () => showAlert(t('error'), t('cert_deleteFailed')),
  });

  const handleDeleteCert = (idx: number): void => {
    showAlert(t('cert_deleteTitle'), t('cert_deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: () => {
          setDeletingIdx(idx);
          deleteCertMutation.mutate(idx, { onSettled: () => setDeletingIdx(null) });
        },
      },
    ]);
  };

  // ── Upload licence (agent) ──────────────────────────────────────────────────
  const [licenceUploadingSource, setLicenceUploadingSource] = useState<'camera' | 'gallery' | 'pdf' | null>(null);

  const uploadLicenceMutation = useMutation({
    mutationFn: async (pickerFn: () => Promise<{ uri: string; name: string; mimeType: string } | null>) => {
      const file = await pickerFn();
      if (!file) return;
      const url = await certificateApi.uploadLabourLicence(file.uri, file.name, file.mimeType);
      await updateProfile({ labourLicenceUrl: url });
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['user-certificates'] }); },
    onError: (err: unknown) => {
      showAlert(t('error'), err instanceof Error ? err.message : t('cert_uploadFailed'));
    },
    onSettled: () => setLicenceUploadingSource(null),
  });

  const handleUploadLicence = (source: 'camera' | 'gallery' | 'pdf'): void => {
    if (uploadLicenceMutation.isPending) return;
    setLicenceUploadingSource(source);
    const picker = source === 'camera' ? pickFromCamera : source === 'gallery' ? pickFromGallery : pickDocument;
    uploadLicenceMutation.mutate(picker);
  };

  const deleteLicenceMutation = useMutation({
    mutationFn: () => certificateApi.deleteLabourLicence(),
    onSuccess: () => {
      void updateProfile({ labourLicenceUrl: null });
      void queryClient.invalidateQueries({ queryKey: ['user-certificates'] });
    },
    onError: () => showAlert(t('error'), t('cert_deleteFailed')),
  });

  const handleDeleteLicence = (): void => {
    showAlert(t('cert_deleteLicenceTitle'), t('cert_deleteLicenceConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => deleteLicenceMutation.mutate() },
    ]);
  };

  const isDark = theme.mode === 'dark';

  return (
    <View style={[s.root, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader
        title={isAgent ? t('cert_licencePageTitle') : t('cert_pageTitle')}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Remark banners ──────────────────────────────────── */}
        {isWorker && (
          <>
            <RemarkBanner
              icon="💡"
              text={t('cert_workerRemark1')}
              color={BRAND}
            />
            <RemarkBanner
              icon="🏆"
              text={t('cert_workerRemark2')}
              color={GREEN}
            />
          </>
        )}
        {isAgent && (
          <>
            <RemarkBanner
              icon="📋"
              text={t('cert_agentRemark1')}
              color={BRAND}
            />
            <RemarkBanner
              icon="✅"
              text={t('cert_agentRemark2')}
              color={GREEN}
            />
          </>
        )}

        {/* ── Worker: upload certificate ───────────────────────── */}
        {isWorker && (
          <View style={[s.uploadCard, { backgroundColor: isDark ? theme.colors.card : '#F8FAFF', borderColor: BORDER }]}>
            <AppText style={[s.uploadCardTitle, { color: theme.colors.text }]}>{t('cert_uploadSection')}</AppText>

            {/* Optional name input */}
            <AppText style={[s.fieldLabel, { color: SLATE }]}>{t('cert_nameLabel')}</AppText>
            <TextInput
              value={certName}
              onChangeText={setCertName}
              placeholder={t('cert_namePlaceholder')}
              placeholderTextColor={SLATE}
              style={[s.input, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: BORDER }]}
            />

            {/* Three direct source buttons — no Alert/Promise wrapping */}
            <View style={s.sourceRow}>
              {([
                { src: 'camera',  icon: '📷', labelKey: 'cert_pickCamera'  },
                { src: 'gallery', icon: '🖼️', labelKey: 'cert_pickGallery' },
                { src: 'pdf',     icon: '📄', labelKey: 'cert_pickPdf'     },
              ] as const).map(({ src, icon, labelKey }) => {
                const loading = uploadingSource === src && uploadCertMutation.isPending;
                const disabled = uploadCertMutation.isPending;
                return (
                  <TouchableOpacity
                    key={src}
                    onPress={() => handleUploadCert(src)}
                    disabled={disabled}
                    activeOpacity={0.8}
                    style={[s.sourceBtn, { borderColor: loading ? BRAND : BORDER, backgroundColor: loading ? BRAND + '10' : theme.colors.background, opacity: disabled && !loading ? 0.4 : 1 }]}
                  >
                    {loading ? (
                      <ActivityIndicator color={BRAND} size="small" />
                    ) : (
                      <>
                        <AppText style={s.sourceBtnIcon}>{icon}</AppText>
                        <AppText style={[s.sourceBtnText, { color: theme.colors.mutedText }]}>{t(labelKey)}</AppText>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <AppText style={[s.hint, { color: SLATE }]}>{t('cert_uploadHint')}</AppText>
          </View>
        )}

        {/* ── Worker: certificate list ─────────────────────────── */}
        {isWorker && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <AppText style={[s.sectionTitle, { color: theme.colors.text }]}>{t('cert_yourCerts')}</AppText>
              <View style={[s.countPill, { backgroundColor: BRAND + '18' }]}>
                <AppText style={[s.countPillTxt, { color: BRAND }]}>{certificates.length}</AppText>
              </View>
            </View>

            {isLoading ? (
              <ActivityIndicator color={BRAND} style={{ marginTop: 20 }} />
            ) : certificates.length === 0 ? (
              <View style={[s.emptyBox, { backgroundColor: theme.colors.card, borderColor: BORDER }]}>
                <AppText style={s.emptyEmoji}>📂</AppText>
                <AppText style={[s.emptyText, { color: SLATE }]}>{t('cert_noCerts')}</AppText>
              </View>
            ) : (
              certificates.map((cert, i) => (
                <CertCard
                  key={i}
                  cert={cert}
                  index={i}
                  onDelete={handleDeleteCert}
                  deleting={deletingIdx === i && deleteCertMutation.isPending}
                />
              ))
            )}
          </View>
        )}

        {/* ── Agent: labour licence ────────────────────────────── */}
        {isAgent && (
          <View style={s.section}>
            <AppText style={[s.sectionTitle, { color: theme.colors.text }]}>{t('cert_licenceSection')}</AppText>
            <AppText style={[s.optionalTag, { color: ORANGE }]}>({t('cert_optional')})</AppText>

            {isLoading ? (
              <ActivityIndicator color={BRAND} style={{ marginTop: 20 }} />
            ) : licenceUrl ? (
              <View style={[s.licenceCard, { backgroundColor: theme.colors.card, borderColor: GREEN + '60' }]}>
                <View style={s.licenceRow}>
                  <AppText style={s.licenceIcon}>📄</AppText>
                  <View style={{ flex: 1 }}>
                    <AppText style={[s.licenceName, { color: theme.colors.text }]}>{t('cert_licenceUploaded')}</AppText>
                    <TouchableOpacity onPress={() => void Linking.openURL(licenceUrl)} activeOpacity={0.8}>
                      <AppText style={[s.licenceView, { color: BRAND }]}>{t('cert_view')} →</AppText>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={handleDeleteLicence}
                    disabled={deleteLicenceMutation.isPending}
                    style={cc.delBtn}
                    activeOpacity={0.75}
                  >
                    {deleteLicenceMutation.isPending
                      ? <ActivityIndicator size="small" color="#EF4444" />
                      : <AppText style={cc.delIcon}>🗑️</AppText>
                    }
                  </TouchableOpacity>
                </View>
                <View style={[s.verifiedPill, { backgroundColor: GREEN + '18' }]}>
                  <AppText style={[s.verifiedTxt, { color: GREEN }]}>✓  {t('cert_licenceActive')}</AppText>
                </View>
              </View>
            ) : (
              <View style={[s.emptyBox, { backgroundColor: theme.colors.card, borderColor: BORDER }]}>
                <AppText style={s.emptyEmoji}>📋</AppText>
                <AppText style={[s.emptyText, { color: SLATE }]}>{t('cert_noLicence')}</AppText>
              </View>
            )}

            <AppText style={[s.fieldLabel, { color: SLATE, marginTop: 16 }]}>
              {licenceUrl ? t('cert_replaceLicence') : t('cert_uploadLicence')}
            </AppText>
            {/* Three direct source buttons for licence */}
            <View style={s.sourceRow}>
              {([
                { src: 'camera',  icon: '📷', labelKey: 'cert_pickCamera'  },
                { src: 'gallery', icon: '🖼️', labelKey: 'cert_pickGallery' },
                { src: 'pdf',     icon: '📄', labelKey: 'cert_pickPdf'     },
              ] as const).map(({ src, icon, labelKey }) => {
                const loading = licenceUploadingSource === src && uploadLicenceMutation.isPending;
                const disabled = uploadLicenceMutation.isPending;
                return (
                  <TouchableOpacity
                    key={src}
                    onPress={() => handleUploadLicence(src)}
                    disabled={disabled}
                    activeOpacity={0.8}
                    style={[s.sourceBtn, { borderColor: loading ? BRAND : BORDER, backgroundColor: loading ? BRAND + '10' : theme.colors.background, opacity: disabled && !loading ? 0.4 : 1 }]}
                  >
                    {loading ? (
                      <ActivityIndicator color={BRAND} size="small" />
                    ) : (
                      <>
                        <AppText style={s.sourceBtnIcon}>{icon}</AppText>
                        <AppText style={[s.sourceBtnText, { color: theme.colors.mutedText }]}>{t(labelKey)}</AppText>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <AppText style={[s.hint, { color: SLATE }]}>{t('cert_uploadHint')}</AppText>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root:    { flex: 1 },
  scroll:  { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 0 },

  uploadCard: {
    borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 20,
  },
  uploadCardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 14 },

  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontWeight: '500', marginBottom: 14,
  },

  // Three direct-source buttons (Camera / Gallery / PDF)
  sourceRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  sourceBtn: {
    flex: 1, borderRadius: 12, borderWidth: 1.5, paddingVertical: 12,
    alignItems: 'center', gap: 4, minHeight: 62,
    justifyContent: 'center',
  },
  sourceBtnIcon: { fontSize: 20, lineHeight: 26 },
  sourceBtnText: { fontSize: 11, fontWeight: '600', textAlign: 'center' },

  hint: { fontSize: 12, marginTop: 8, lineHeight: 17, textAlign: 'center' },

  section:       { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle:  { fontSize: 16, fontWeight: '800' },
  optionalTag:   { fontSize: 12, fontWeight: '600', marginBottom: 14 },
  countPill: {
    minWidth: 26, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  countPillTxt: { fontSize: 12, fontWeight: '800' },

  emptyBox: {
    borderRadius: 16, borderWidth: 1, padding: 28,
    alignItems: 'center', gap: 10, marginBottom: 4,
  },
  emptyEmoji: { fontSize: 36, lineHeight: 44 },
  emptyText:  { fontSize: 14, fontWeight: '500', textAlign: 'center' },

  licenceCard: { borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 4 },
  licenceRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  licenceIcon: { fontSize: 34, lineHeight: 42, flexShrink: 0 },
  licenceName: { fontSize: 15, fontWeight: '700', lineHeight: 20, marginBottom: 2 },
  licenceView: { fontSize: 12, fontWeight: '700' },
  verifiedPill:{ marginTop: 10, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  verifiedTxt: { fontSize: 12, fontWeight: '700' },
});
