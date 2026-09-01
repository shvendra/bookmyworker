import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppText } from '../../../shared/components/ui/AppText';
import { workerMappingApi } from '../../../core/api/endpoints/workerMappingApi';
import type { OpenRequirement } from '../../../core/api/endpoints/workerMappingApi';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import { subcatDisplay } from '../../../shared/data/categoryLabels';
import type { MainStackParamList } from '../../../app/navigation/types';
import { useToast } from '../../../shared/state/toast/ToastContext';

export interface InviteModalProps {
  visible: boolean;
  onClose: () => void;
  workerId: string | null;
  workerName: string;
  workerPhone?: string;
  toast: ReturnType<typeof useToast>;
}

export const InviteToRequirementModal = ({ visible, onClose, workerId, workerName, workerPhone, toast }: InviteModalProps): React.JSX.Element => {
  const navInv = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { t } = useTranslation('employer');
  const [requirements, setRequirements] = useState<OpenRequirement[]>([]);
  const [selected, setSelected]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [saving,  setSaving]      = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const reqs = await workerMappingApi.getEmployerOpenRequirements();
      setRequirements(reqs);
    } catch {
      toast.error(t('wp_toastLoadReqFail'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) { setSelected(null); void load(); }
  }, [visible, load]);

  const handleSend = async () => {
    if (!selected) { toast.error(t('wp_toastSelectReqFirst')); return; }
    setSaving(true);
    try {
      await requirementsApi.inviteWorker(selected, { workerId, workerName, workerPhone });
      toast.success(t('wp_toastInviteSent', { name: workerName }), t('wp_invited'));
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || t('wp_toastInviteFail'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={inv.overlay}>
        <View style={inv.sheet}>
          <View style={[inv.header, { backgroundColor: '#7C3AED' }]}>
            <View style={{ flex: 1 }}>
              <AppText style={inv.headerTitle}>{t('wp_inviteTitle')}</AppText>
              <AppText style={inv.headerSub}>{workerName}</AppText>
            </View>
            <TouchableOpacity onPress={onClose} style={inv.closeBtn}>
              <AppText style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18, fontWeight: '700' }}>✕</AppText>
            </TouchableOpacity>
          </View>

          <AppText style={inv.hint}>{t('wp_inviteHint')}</AppText>

          {loading ? (
            <View style={inv.center}><ActivityIndicator color="#7C3AED" size="small" /></View>
          ) : requirements.length === 0 ? (
            <View style={inv.emptyBox}>
              <AppText style={{ fontSize: 30, marginBottom: 8 }}>📋</AppText>
              <AppText style={inv.emptyTitle}>{t('wp_noOpenReqs')}</AppText>
              <AppText style={inv.emptyDesc}>{t('wp_inviteEmptyDesc')}</AppText>
              <TouchableOpacity onPress={() => { onClose(); navInv.navigate('PostRequirement'); }} style={[inv.postBtn, { backgroundColor: '#7C3AED' }]} activeOpacity={0.85}>
                <AppText style={inv.postBtnTxt}>{t('wp_postReq')}</AppText>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={requirements}
              keyExtractor={(r) => r._id}
              style={inv.list}
              renderItem={({ item: r }) => {
                const isChk = selected === r._id;
                return (
                  <TouchableOpacity onPress={() => setSelected(r._id)} style={[inv.reqRow, isChk && { backgroundColor: '#F5F3FF' }]} activeOpacity={0.7}>
                    <View style={[inv.radio, isChk && { backgroundColor: '#7C3AED', borderColor: '#7C3AED' }]}>
                      {isChk && <View style={inv.radioDot} />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText style={inv.reqTitle} numberOfLines={1} ellipsizeMode="tail">
                        {[r.workType, r.subCategory].filter(Boolean).map((x) => subcatDisplay(String(x))).join(' · ')}
                      </AppText>
                      <AppText style={inv.reqSub}>ERN {r.ERN_NUMBER || '—'}{r.district ? `  ·  ${r.district}` : ''}</AppText>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <View style={inv.footer}>
            <TouchableOpacity onPress={onClose} style={inv.cancelBtn}>
              <AppText style={inv.cancelTxt}>{t('wp_cancel')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void handleSend()}
              disabled={saving || !selected}
              style={[inv.saveBtn, (!selected || saving) && { opacity: 0.5 }]}
              activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <AppText style={inv.saveTxt}>{t('wp_sendInvite')}</AppText>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const inv = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '88%', overflow: 'hidden' },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  closeBtn:    { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  hint:        { fontSize: 12.5, fontWeight: '600', color: '#475569', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  center:      { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyBox:    { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24, gap: 6 },
  emptyTitle:  { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  emptyDesc:   { fontSize: 12.5, color: '#64748b', textAlign: 'center' },
  postBtn:     { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 6 },
  postBtnTxt:  { fontSize: 13, fontWeight: '800', color: '#fff' },
  list:        { maxHeight: 480 },
  reqRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f1f5f9' },
  radio:       { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  radioDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  reqTitle:    { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  reqSub:      { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  footer:      { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f1f5f9' },
  cancelBtn:   { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0', paddingVertical: 14, alignItems: 'center' },
  cancelTxt:   { fontSize: 14, fontWeight: '700', color: '#64748b' },
  saveBtn:     { flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#7C3AED' },
  saveTxt:     { fontSize: 14, fontWeight: '800', color: '#fff' },
});
