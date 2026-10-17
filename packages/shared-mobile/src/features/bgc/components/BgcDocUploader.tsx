import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppText } from '../../../shared/components/ui/AppText';
import { showAlert } from '../../../shared/state/alert/AppAlertContext';
import { useAppTheme } from '../../../core/theme';
import { bgcApi, bgcError, type BgcPickedFile, type BgcStagedDoc } from '../../../core/api/endpoints/bgcApi';
import { BGC_DOC_TYPES, bgcFmtSize, checkBgcFile } from '../bgcShared';
import { pickFromFiles, pickFromGallery } from '../pickFile';

const BRAND = '#1037A4';

/** Opens the "Gallery / Files" chooser. Resolves null when cancelled. */
export function chooseBgcFile(t: (k: string) => string): Promise<BgcPickedFile | null> {
  return new Promise((resolve) => {
    const run = (fn: () => Promise<BgcPickedFile | null>) => () => { fn().then(resolve).catch(() => resolve(null)); };
    showAlert(t('bgc_pickTitle'), t('bgc_pickBody'), [
      { text: t('bgc_pickGallery'), onPress: run(pickFromGallery) },
      { text: t('bgc_pickFiles'), onPress: run(pickFromFiles) },
      { text: t('bgc_cancel'), style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}

export const DocTypeChips = ({ value, onChange }: { value: string; onChange: (k: string) => void }): React.JSX.Element => {
  const { t } = useTranslation('employer');
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
      {BGC_DOC_TYPES.map((d) => (
        <TouchableOpacity key={d.key} onPress={() => onChange(d.key)} accessibilityRole="button" accessibilityState={{ selected: value === d.key }} style={[s.chip, value === d.key && s.chipOn]}>
          <AppText style={[s.chipTxt, value === d.key && { color: '#fff' }]}>{t(`bgc_doc_${d.key}`, { defaultValue: d.label })}</AppText>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

type Pending = { id: string; name: string; state: 'uploading' | 'error'; message?: string };

/** Enrol-time uploader for ONE worker (files go to private storage and come back as signed refs). */
export const BgcWorkerDocs = ({ docs, onChange, error, maxDocs = 8, maxMb = 5, index = 0 }: {
  docs: BgcStagedDoc[]; onChange: (fn: (d: BgcStagedDoc[]) => BgcStagedDoc[]) => void; error?: string; maxDocs?: number; maxMb?: number; index?: number;
}): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const [docType, setDocType] = useState('aadhaar');
  const [pending, setPending] = useState<Pending[]>([]);

  const add = async (): Promise<void> => {
    if (docs.length + pending.filter((p) => p.state === 'uploading').length >= maxDocs) { showAlert(t('bgc_title'), t('bgc_errMaxDocs', { max: maxDocs })); return; }
    const file = await chooseBgcFile(t);
    if (!file) return;
    const id = `${Date.now()}-${Math.random()}`;
    const bad = checkBgcFile(file, maxMb);
    if (bad) { setPending((p) => [...p, { id, name: file.name, state: 'error', message: t(bad.key, bad.params) }]); return; }
    setPending((p) => [...p, { id, name: file.name, state: 'uploading' }]);
    try {
      const doc = await bgcApi.uploadDoc(file, docType);
      onChange((cur) => [...cur, doc]);
      setPending((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      setPending((p) => p.map((x) => (x.id === id ? { ...x, state: 'error', message: bgcError(e, t('bgc_errUpload')).message } : x)));
    }
  };

  return (
    <View testID={`bgc-docs-${index}`} style={{ marginTop: 6 }}>
      <AppText style={[s.h, { color: theme.colors.text }]}>{t('bgc_idDocs')} <AppText style={{ color: '#dc2626' }}>*</AppText></AppText>
      <AppText style={[s.hint, { color: theme.colors.mutedText }]}>{t('bgc_idDocsHint')}</AppText>
      <DocTypeChips value={docType} onChange={setDocType} />
      <TouchableOpacity onPress={() => { void add(); }} accessibilityRole="button" accessibilityLabel={t('bgc_uploadDoc')} style={[s.drop, error ? { borderColor: '#dc2626' } : { borderColor: theme.colors.border }]}>
        <Ionicons name="cloud-upload-outline" size={22} color={error ? '#dc2626' : BRAND} />
        <AppText style={[s.dropTxt, { color: theme.colors.text }]}>{t('bgc_uploadDoc')}</AppText>
        <AppText style={[s.hint, { color: theme.colors.mutedText }]}>{t('bgc_fileRules', { max: maxMb })}</AppText>
      </TouchableOpacity>
      {!!error && <AppText accessibilityRole="alert" style={s.err}>{error}</AppText>}
      {docs.map((d) => (
        <View key={d.docRef} style={[s.row, { borderColor: theme.colors.border }]}>
          <Ionicons name="checkmark-circle" size={18} color="#15803d" />
          <AppText numberOfLines={1} style={[s.rowTxt, { color: theme.colors.text }]}>{d.label} · {d.fileName} · {bgcFmtSize(d.size)}</AppText>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${t('bgc_remove')} ${d.fileName}`} onPress={() => onChange((cur) => cur.filter((x) => x.docRef !== d.docRef))}>
            <Ionicons name="trash-outline" size={18} color="#b91c1c" />
          </TouchableOpacity>
        </View>
      ))}
      {pending.map((p) => (
        <View key={p.id} style={[s.row, { borderColor: p.state === 'error' ? '#fca5a5' : theme.colors.border }]}>
          {p.state === 'error' ? <Ionicons name="alert-circle" size={18} color="#dc2626" /> : <ActivityIndicator size="small" color={BRAND} />}
          <View style={{ flex: 1 }}>
            <AppText numberOfLines={1} style={[s.rowTxt, { color: theme.colors.text }]}>{p.name}</AppText>
            {p.state === 'error' && <AppText accessibilityRole="alert" style={s.err}>{p.message}</AppText>}
          </View>
          {p.state === 'error' && (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${t('bgc_dismiss')} ${p.name}`} onPress={() => setPending((x) => x.filter((y) => y.id !== p.id))}>
              <Ionicons name="close" size={18} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
};

const s = StyleSheet.create({
  h:      { fontSize: 14, fontWeight: '800' },
  hint:   { fontSize: 11.5, marginTop: 2 },
  chip:   { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
  chipOn: { backgroundColor: BRAND, borderColor: BRAND },
  chipTxt:{ fontSize: 12, fontWeight: '700', color: '#334155' },
  drop:   { borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 6, gap: 2 },
  dropTxt:{ fontSize: 13.5, fontWeight: '700' },
  row:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, padding: 8, marginTop: 6 },
  rowTxt: { flex: 1, fontSize: 12.5, fontWeight: '600' },
  err:    { color: '#dc2626', fontSize: 12, marginTop: 4 },
});
