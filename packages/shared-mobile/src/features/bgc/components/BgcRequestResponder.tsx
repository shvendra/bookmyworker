import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppInput } from '../../../shared/components/ui/AppInput';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { useAppTheme } from '../../../core/theme';
import { bgcApi, bgcError, type BgcCase, type BgcPickedFile, type BgcRequest } from '../../../core/api/endpoints/bgcApi';
import { bgcFmtSize, checkBgcFile } from '../bgcShared';
import { DocTypeChips, chooseBgcFile } from './BgcDocUploader';

/** Customer answering ONE open request: attach file(s) and/or type a message. */
export const BgcRequestResponder = ({ caseId, request, onDone }: { caseId: string; request: BgcRequest; onDone: (c: BgcCase) => void }): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const [files, setFiles] = useState<BgcPickedFile[]>([]);
  const [docType, setDocType] = useState(request.docType || 'other');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ message: string; fields: Record<string, string> }>({ message: '', fields: {} });
  const needsFile = request.type === 'document';

  const attach = async (): Promise<void> => {
    if (files.length >= 5) { setErr({ message: t('bgc_errMaxFiles'), fields: { files: 'x' } }); return; }
    const f = await chooseBgcFile(t);
    if (!f) return;
    const bad = checkBgcFile(f);
    if (bad) { setErr({ message: t(bad.key, bad.params), fields: { files: 'x' } }); return; }
    setErr({ message: '', fields: {} });
    setFiles((cur) => [...cur, f]);
  };

  const send = async (): Promise<void> => {
    if (needsFile && !files.length) { setErr({ message: t('bgc_errAttach'), fields: { files: 'x' } }); return; }
    if (!needsFile && text.trim().length < 2) { setErr({ message: t('bgc_errAnswer'), fields: { text: 'x' } }); return; }
    setBusy(true); setErr({ message: '', fields: {} });
    try {
      const c = await bgcApi.respond(caseId, request._id, files, docType, text);
      setFiles([]); setText('');
      onDone(c);
    } catch (e) {
      const b = bgcError(e, t('bgc_errGeneric'));
      setErr({ message: b.message, fields: b.fields });
    } finally { setBusy(false); }
  };

  return (
    <View testID={`bgc-respond-${request._id}`} style={{ marginTop: 8 }}>
      {needsFile && (
        <>
          <DocTypeChips value={docType} onChange={setDocType} />
          <TouchableOpacity onPress={() => { void attach(); }} accessibilityRole="button" accessibilityLabel={t('bgc_attachFile')} style={[s.drop, { borderColor: err.fields.files ? '#dc2626' : theme.colors.border }]}>
            <Ionicons name="attach-outline" size={20} color="#1037A4" />
            <AppText style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text }}>{t('bgc_attachFile')}</AppText>
          </TouchableOpacity>
          {files.map((f, i) => (
            <View key={`${f.uri}-${i}`} style={[s.row, { borderColor: theme.colors.border }]}>
              <AppText numberOfLines={1} style={{ flex: 1, fontSize: 12.5, color: theme.colors.text }}>{f.name} · {bgcFmtSize(f.size)}</AppText>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${t('bgc_remove')} ${f.name}`} onPress={() => setFiles((cur) => cur.filter((_, j) => j !== i))}>
                <Ionicons name="trash-outline" size={18} color="#b91c1c" />
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}
      <AppInput label={needsFile ? t('bgc_messageOptional') : t('bgc_yourAnswer')} value={text} onChangeText={(v) => { setText(v); if (err.fields.text) setErr({ message: '', fields: {} }); }} multiline maxLength={1000} errorText={err.fields.text ? err.message : undefined} />
      {!!err.message && !err.fields.text && <AppText accessibilityRole="alert" style={s.err}>{err.message}</AppText>}
      <AppButton title={busy ? t('bgc_sending') : t('bgc_sendToTeam')} onPress={() => { void send(); }} disabled={busy} size="sm" style={{ marginTop: 8 }} />
      {busy && <ActivityIndicator style={{ marginTop: 6 }} color="#1037A4" />}
    </View>
  );
};

const s = StyleSheet.create({
  drop: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, padding: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 6, marginBottom: 6 },
  row:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, padding: 8, marginBottom: 6 },
  err:  { color: '#dc2626', fontSize: 12, marginTop: 4 },
});
