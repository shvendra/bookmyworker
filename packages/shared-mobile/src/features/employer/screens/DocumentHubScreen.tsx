import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlert } from '../../../shared/state/alert/AppAlertContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../../shared/components/ui/AppText';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useAppTheme } from '../../../core/theme';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { documentApi } from '../../../core/api/endpoints/documentApi';
import type { EmployerDocument, DocType } from '../../../core/api/endpoints/documentApi';
import type { MainStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'DocumentHub'>;

// ── Constants ─────────────────────────────────────────────────────────────────
const BRAND = '#1037A4';
const NAVY  = '#0F172A';
const SLATE = '#64748B';
const WHITE = '#FFFFFF';
const BORDER= '#E2E8F0';
const RED   = '#DC2626';
const GREEN = '#059669';

const DOC_TYPES: DocType[] = [
  'Work Agreement',
  'Statement of Work',
  'GST Invoice',
  'Payment Receipt',
  'Identity Proof',
  'Other',
];

const DOC_TYPE_META: Record<DocType, { emoji: string; color: string; bg: string }> = {
  'Work Agreement':    { emoji: '📝', color: BRAND,    bg: '#EBF1FF' },
  'Statement of Work': { emoji: '📋', color: '#7C3AED', bg: '#F5F3FF' },
  'GST Invoice':       { emoji: '🧾', color: '#D97706', bg: '#FFFBEB' },
  'Payment Receipt':   { emoji: '💰', color: GREEN,     bg: '#ECFDF5' },
  'Identity Proof':    { emoji: '🪪', color: '#0891B2', bg: '#ECFEFF' },
  'Other':             { emoji: '📎', color: SLATE,     bg: '#F1F5F9' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatFileSize(bytes: number): string {
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function isPdf(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

// ── Document Card ─────────────────────────────────────────────────────────────
function DocCard({
  doc,
  onView,
  onDelete,
  deleting,
}: {
  doc: EmployerDocument;
  onView: () => void;
  onDelete: () => void;
  deleting: boolean;
}): React.JSX.Element {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const meta = DOC_TYPE_META[doc.docType] ?? DOC_TYPE_META.Other;

  return (
    <View style={[dc.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={dc.row}>
        {/* Icon */}
        <View style={[dc.iconBox, { backgroundColor: meta.bg }]}>
          <AppText style={{ fontSize: 22 }}>{meta.emoji}</AppText>
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <AppText style={[dc.name, { color: theme.colors.text }]} numberOfLines={2}>{doc.name}</AppText>
          <View style={dc.metaRow}>
            <View style={[dc.typeBadge, { backgroundColor: meta.bg }]}>
              <AppText style={[dc.typeTxt, { color: meta.color }]}>{doc.docType}</AppText>
            </View>
            <AppText style={[dc.size, { color: theme.colors.mutedText }]}>{formatFileSize(doc.fileSize)}</AppText>
            <AppText style={[dc.date, { color: theme.colors.mutedText }]}>{formatDate(doc.createdAt)}</AppText>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={[dc.actions, { borderTopColor: theme.colors.divider }]}>
        <TouchableOpacity onPress={onView} style={dc.viewBtn} activeOpacity={0.8}>
          <AppText style={dc.viewBtnTxt}>
            {isPdf(doc.mimeType) ? t('viewPdf') : t('viewImage')}
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          style={dc.deleteBtn}
          activeOpacity={0.8}
          disabled={deleting}
        >
          {deleting
            ? <ActivityIndicator size="small" color={RED} />
            : <AppText style={dc.deleteTxt}>{t('deleteDoc')}</AppText>}
        </TouchableOpacity>
      </View>
    </View>
  );
}
const dc = StyleSheet.create({
  card:     { borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 10, gap: 10 },
  row:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBox:  { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  name:     { fontSize: 14, fontWeight: '800', lineHeight: 19 },
  metaRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  typeBadge:{ borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  typeTxt:  { fontSize: 10, fontWeight: '700' },
  size:     { fontSize: 11, fontWeight: '600' },
  date:     { fontSize: 11 },
  actions:  { flexDirection: 'row', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  viewBtn:  { flex: 2, backgroundColor: BRAND, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  viewBtnTxt:{ color: WHITE, fontSize: 12, fontWeight: '800' },
  deleteBtn:{ flex: 1, borderWidth: 1.5, borderColor: '#FECACA', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  deleteTxt:{ color: RED, fontSize: 12, fontWeight: '700' },
});

// ── Upload Modal ──────────────────────────────────────────────────────────────
interface UploadPayload {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

function UploadModal({
  visible,
  requirementId,
  onClose,
  onUploaded,
}: {
  visible: boolean;
  requirementId: string;
  onClose: () => void;
  onUploaded: () => void;
}): React.JSX.Element {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const toast = useToast();
  const qc    = useQueryClient();

  const [docName,    setDocName]    = useState('');
  const [docType,    setDocType]    = useState<DocType>('Work Agreement');
  const [file,       setFile]       = useState<UploadPayload | null>(null);
  const [uploading,  setUploading]  = useState(false);

  const reset = () => {
    setDocName(''); setDocType('Work Agreement'); setFile(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const pickPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0]!;
      setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/pdf', size: asset.size ?? 0 });
      if (!docName) setDocName(asset.name.replace(/\.[^.]+$/, ''));
    } catch {
      toast.error('Could not open file picker.', 'Error');
    }
  };

  const pickImage = async () => {
    // Android 13+ uses the system Photo Picker — no READ_MEDIA_IMAGES permission needed
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0]!;
    const mimeType = asset.mimeType ?? (asset.uri.endsWith('.png') ? 'image/png' : 'image/jpeg');
    const fileName = asset.fileName ?? `image_${Date.now()}.${mimeType.split('/')[1]}`;
    setFile({ uri: asset.uri, name: fileName, mimeType, size: asset.fileSize ?? 0 });
    if (!docName) setDocName(fileName.replace(/\.[^.]+$/, ''));
  };

  const handleUpload = async () => {
    if (!file) { toast.error('Please select a file first.'); return; }
    if (!docName.trim()) { toast.error('Please enter a document name.'); return; }
    const MAX_FILE_MB = 5;
    if (file.size && file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`File is too large. Maximum size is ${MAX_FILE_MB} MB.`, 'File Too Large');
      return;
    }

    setUploading(true);
    try {
      await documentApi.upload({
        requirementId,
        name: docName.trim(),
        docType,
        fileUri: file.uri,
        fileName: file.name,
        mimeType: file.mimeType,
      });
      await qc.invalidateQueries({ queryKey: ['employer-documents', requirementId] });
      toast.success(`${docName} uploaded successfully.`, 'Uploaded');
      reset();
      onUploaded();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message ?? 'Upload failed. Please try again.', 'Error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={um.overlay}>
        <View style={[um.sheet, { backgroundColor: theme.colors.card }]}>
          {/* Header */}
          <View style={um.header}>
            <AppText style={[um.headerTitle, { color: theme.colors.text }]}>{t('uploadDocumentTitle')}</AppText>
            <TouchableOpacity onPress={handleClose} style={[um.closeBtn, { backgroundColor: theme.colors.surface1 }]}>
              <AppText style={{ color: theme.colors.mutedText, fontSize: 18, fontWeight: '700' }}>✕</AppText>
            </TouchableOpacity>
          </View>

          {/* Document name */}
          <AppText style={[um.fieldLabel, { color: theme.colors.mutedText }]}>{t('documentNameLabel')} *</AppText>
          <TextInput
            style={[um.input, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.surface2 }]}
            placeholder="e.g. Work Agreement - Rahul Kumar"
            placeholderTextColor={theme.colors.mutedText}
            value={docName}
            onChangeText={setDocName}
            maxLength={80}
          />

          {/* Doc type picker */}
          <AppText style={[um.fieldLabel, { color: theme.colors.mutedText }]}>{t('documentTypeLabel')}</AppText>
          <View style={um.typeGrid}>
            {DOC_TYPES.map((docTypeItem) => {
              const meta = DOC_TYPE_META[docTypeItem]!;
              return (
                <TouchableOpacity
                  key={docTypeItem}
                  onPress={() => setDocType(docTypeItem)}
                  style={[
                    um.typeChip,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surface1 },
                    docType === docTypeItem && { backgroundColor: meta.bg, borderColor: meta.color },
                  ]}
                  activeOpacity={0.75}
                >
                  <AppText style={{ fontSize: 14 }}>{meta.emoji}</AppText>
                  <AppText style={[um.typeChipTxt, { color: theme.colors.mutedText }, docType === docTypeItem && { color: meta.color, fontWeight: '800' }]}>
                    {docTypeItem}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* File picker */}
          <AppText style={[um.fieldLabel, { color: theme.colors.mutedText }]}>{t('selectFileLabel')} *</AppText>
          {file ? (
            <View style={[um.filePreview, { borderColor: GREEN, backgroundColor: theme.colors.successLight }]}>
              <AppText style={[um.fileName, { color: theme.colors.text }]} numberOfLines={2}>{file.name}</AppText>
              <AppText style={[um.fileSize, { color: theme.colors.mutedText }]}>{formatFileSize(file.size)}</AppText>
              <TouchableOpacity onPress={() => setFile(null)} style={um.removeFileBtn}>
                <AppText style={{ color: RED, fontSize: 12, fontWeight: '700' }}>{t('removeFile')}</AppText>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={um.pickerRow}>
              <TouchableOpacity onPress={pickPDF} style={[um.pickerBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface1 }]} activeOpacity={0.8}>
                <AppText style={um.pickerIcon}>📄</AppText>
                <AppText style={[um.pickerTxt, { color: theme.colors.text }]}>{t('pdfLabel')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickImage} style={[um.pickerBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface1 }]} activeOpacity={0.8}>
                <AppText style={um.pickerIcon}>🖼️</AppText>
                <AppText style={[um.pickerTxt, { color: theme.colors.text }]}>{t('imageLabel')}</AppText>
              </TouchableOpacity>
            </View>
          )}

          {/* Upload button */}
          <TouchableOpacity
            onPress={() => void handleUpload()}
            style={[um.uploadBtn, (uploading || !file || !docName.trim()) && { opacity: 0.55 }]}
            disabled={uploading || !file || !docName.trim()}
            activeOpacity={0.85}
          >
            {uploading
              ? <ActivityIndicator color={WHITE} />
              : <AppText style={um.uploadBtnTxt}>{t('uploadDocument')}</AppText>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const um = StyleSheet.create({
  overlay:      { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:        { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 10, maxHeight: '90%' },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  headerTitle:  { fontSize: 18, fontWeight: '900', flexShrink: 1 },
  closeBtn:     { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  fieldLabel:   { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  input:        { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  typeGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  typeChipTxt:  { fontSize: 11, fontWeight: '600', flexShrink: 1 },
  filePreview:  { borderWidth: 1.5, borderRadius: 12, padding: 12, gap: 4 },
  fileName:     { fontSize: 13, fontWeight: '700' },
  fileSize:     { fontSize: 11 },
  removeFileBtn:{ alignSelf: 'flex-start', marginTop: 4 },
  pickerRow:    { flexDirection: 'row', gap: 12 },
  pickerBtn:    { flex: 1, borderWidth: 1.5, borderRadius: 14, paddingVertical: 16, alignItems: 'center', gap: 6 },
  pickerIcon:   { fontSize: 28 },
  pickerTxt:    { fontSize: 12, fontWeight: '700' },
  uploadBtn:    { backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  uploadBtnTxt: { color: WHITE, fontSize: 15, fontWeight: '800' },
});

// ── Screen ────────────────────────────────────────────────────────────────────
export const DocumentHubScreen = ({ route, navigation }: Props): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { requirementId, requirementTitle } = route.params;
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const toast  = useToast();
  const qc     = useQueryClient();

  const [uploadVisible,  setUploadVisible]  = useState(false);
  const [deletingId,     setDeletingId]     = useState<string | null>(null);

  const docsQuery = useQuery({
    queryKey: ['employer-documents', requirementId],
    queryFn: () => documentApi.list(requirementId),
    staleTime: 2 * 60 * 1000,
  });

  const docs = docsQuery.data ?? [];

  const handleDelete = (doc: EmployerDocument) => {
    showAlert(
      t('deleteConfirmTitle'),
      `${t('deleteConfirmBody')} "${doc.name}"`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('yesDelete'),
          style: 'destructive',
          onPress: async () => {
            setDeletingId(doc._id);
            try {
              await documentApi.delete(doc._id);
              await qc.invalidateQueries({ queryKey: ['employer-documents', requirementId] });
              toast.success(t('docDeleted'), '');
            } catch {
              toast.error(t('deleteFailed'), t('error'));
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleView = (doc: EmployerDocument) => {
    if (isPdf(doc.mimeType)) {
      navigation.navigate('PdfViewer', { url: doc.fileUrl, title: doc.name });
    } else {
      // For images, open via PdfViewer which can show images too, or just navigate
      navigation.navigate('PdfViewer', { url: doc.fileUrl, title: doc.name });
    }
  };

  // Group docs by type for organised display
  const grouped = docs.reduce<Record<string, EmployerDocument[]>>((acc, d) => {
    if (!acc[d.docType]) acc[d.docType] = [];
    acc[d.docType]!.push(d);
    return acc;
  }, {});

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader
        title={requirementTitle ? `Docs · ${requirementTitle}` : t('documentHubTitle')}
        onBack={() => navigation.goBack()}
      />

      {/* ── Upload button strip ──────────────────────────────────────────── */}
      <View style={[hs.uploadStrip, { borderBottomColor: theme.colors.border }]}>
        <View style={{ flex: 1 }}>
          <AppText style={[hs.stripTitle, { color: theme.colors.text }]}>
            {docs.length === 1 ? t('docCountSingle', { count: docs.length }) : t('docCountPlural', { count: docs.length })}
          </AppText>
          <AppText style={[hs.stripSub, { color: theme.colors.mutedText }]}>{t('noDocumentsDesc')}</AppText>
        </View>
        <TouchableOpacity
          onPress={() => setUploadVisible(true)}
          style={hs.uploadBtn}
          activeOpacity={0.85}
        >
          <AppText style={hs.uploadBtnTxt}>{t('uploadPlusBtn')}</AppText>
        </TouchableOpacity>
      </View>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {docsQuery.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={BRAND} />
        </View>
      ) : docs.length === 0 ? (
        <View style={hs.emptyBox}>
          <AppText style={hs.emptyEmoji}>📁</AppText>
          <AppText style={[hs.emptyTitle, { color: theme.colors.text }]}>{t('noDocuments')}</AppText>
          <AppText style={[hs.emptySub, { color: theme.colors.mutedText }]}>{t('noDocumentsDesc')}</AppText>
          <TouchableOpacity
            onPress={() => setUploadVisible(true)}
            style={hs.emptyUploadBtn}
            activeOpacity={0.85}
          >
            <AppText style={hs.emptyUploadTxt}>+ {t('uploadDocument')}</AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={docs}
          keyExtractor={(d) => d._id}
          contentContainerStyle={[hs.listContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={docsQuery.isFetching}
              onRefresh={() => void docsQuery.refetch()}
              tintColor={BRAND}
            />
          }
          renderItem={({ item: doc }) => (
            <DocCard
              doc={doc}
              onView={() => handleView(doc)}
              onDelete={() => handleDelete(doc)}
              deleting={deletingId === doc._id}
            />
          )}
        />
      )}

      {/* ── Upload modal ─────────────────────────────────────────────────── */}
      <UploadModal
        visible={uploadVisible}
        requirementId={requirementId}
        onClose={() => setUploadVisible(false)}
        onUploaded={() => setUploadVisible(false)}
      />
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const hs = StyleSheet.create({
  uploadStrip:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  stripTitle:     { fontSize: 14, fontWeight: '800' },
  stripSub:       { fontSize: 11.5, marginTop: 1 },
  uploadBtn:      { backgroundColor: BRAND, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  uploadBtnTxt:   { color: WHITE, fontSize: 13, fontWeight: '800' },

  listContent:    { padding: 14 },

  emptyBox:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  emptyEmoji:     { fontSize: 56 },
  emptyTitle:     { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  emptySub:       { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  emptyUploadBtn: { backgroundColor: BRAND, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, marginTop: 8 },
  emptyUploadTxt: { color: WHITE, fontSize: 14, fontWeight: '800' },
});
