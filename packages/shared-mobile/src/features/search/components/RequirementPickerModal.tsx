import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppText } from '../../../shared/components/ui/AppText';
import { workerMappingApi } from '../../../core/api/endpoints/workerMappingApi';
import type { MappingStatus, OpenRequirement } from '../../../core/api/endpoints/workerMappingApi';
import { requestReviewOnce } from '../../../core/review/storeReview';
import { subcatDisplay } from '../../../shared/data/categoryLabels';
import type { MainStackParamList } from '../../../app/navigation/types';
import { useToast } from '../../../shared/state/toast/ToastContext';
import {
  STATUS_META,
  FORWARD_TRANSITIONS,
  REQ_STATUS_KEY,
  MAPPING_STATUS_KEY,
} from './workerProfileConstants';

export interface RequirementPickerProps {
  visible: boolean;
  onClose: () => void;
  workerName: string;
  workerPhone: string;
  workerId?: string | null;
  workerSkill?: string;
  status: MappingStatus;
  onSuccess: () => void;
  toast: ReturnType<typeof useToast>;
}

export const RequirementPickerModal = ({
  visible, onClose, workerName, workerPhone, workerId, workerSkill, status, onSuccess, toast,
}: RequirementPickerProps): React.JSX.Element => {
  const navPicker = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { t } = useTranslation('employer');
  const [requirements, setRequirements] = useState<OpenRequirement[]>([]);
  const [selected,     setSelected]     = useState<string[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  // requirementId → this worker's existing mapping status (if already in the pipeline)
  const [workerStatusByReq, setWorkerStatusByReq] = useState<Record<string, MappingStatus>>({});

  // Rate step — shown only when status === 'Joined'
  const [step,      setStep]      = useState<'pick' | 'rate'>('pick');
  const [agreedRate, setAgreedRate] = useState('');
  const [rateType,  setRateType]  = useState<'Daily' | 'Monthly'>('Daily');

  const meta = STATUS_META[status];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load open requirements + this employer's pipeline so we know which
      // requirements this worker is already mapped to (and at what status).
      const [reqs, overview] = await Promise.all([
        workerMappingApi.getEmployerOpenRequirements(),
        workerMappingApi.getEmployerPipelineOverview().catch(() => null),
      ]);
      setRequirements(reqs);

      const phone  = (workerPhone || '').trim();
      const nameLc = (workerName || '').trim().toLowerCase();
      const statusMap: Record<string, MappingStatus> = {};
      for (const entry of overview?.requirements ?? []) {
        const reqId = entry.requirement?._id ? String(entry.requirement._id) : '';
        if (!reqId) continue;
        // Match this worker by phone (most reliable); fall back to name when no phone.
        const mine = entry.workers.find((w) =>
          phone ? (w.workerPhone || '').trim() === phone
                : nameLc.length > 0 && (w.workerName || '').trim().toLowerCase() === nameLc,
        );
        if (mine && (mine.status === 'Shortlisted' || mine.status === 'Selected' || mine.status === 'Joined')) {
          statusMap[reqId] = mine.status;
        }
      }
      setWorkerStatusByReq(statusMap);
    } catch {
      toast.error(t('wp_toastLoadReqFail'));
    } finally {
      setLoading(false);
    }
  }, [workerPhone, workerName]);

  useEffect(() => {
    if (visible) { setSelected([]); setStep('pick'); setAgreedRate(''); setRateType('Daily'); void load(); }
  }, [visible, load]);

  const toggle = (id: string) =>
    setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  // For Joined, first go to the rate step; for others, save directly.
  const handleNext = () => {
    if (selected.length === 0) { toast.error(t('wp_toastSelectReq')); return; }
    if (status === 'Joined') { setStep('rate'); return; }
    void handleSave();
  };

  const handleSave = async () => {
    if (status === 'Joined') {
      const rate = parseFloat(agreedRate);
      if (!agreedRate || isNaN(rate) || rate <= 0) {
        toast.error(t('wp_toastValidRate'));
        return;
      }
    }
    setSaving(true);
    try {
      const hireRate = status === 'Joined'
        ? { agreedRate: parseFloat(agreedRate), rateType }
        : undefined;
      await workerMappingApi.mapWorker({
        workerId:       workerId || null,
        workerName,
        workerPhone,
        workerSkill:    workerSkill || '',
        requirementIds: selected,
        status,
        ...hireRate,
      });
      toast.success(t('wp_toastJoined', { name: workerName, count: selected.length }));
      // Selecting / joining a worker is a strong positive action → ask once.
      // Plain "Shortlisted" here is skipped (the dedicated shortlist toggle
      // already covers that), so we don't double up.
      if (status === 'Selected' || status === 'Joined') void requestReviewOnce();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || t('wp_toastSaveFail'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={pm.overlay}>
        <View style={pm.sheet}>
          {/* Header */}
          <View style={[pm.header, { backgroundColor: meta.color }]}>
            <View style={{ flex: 1 }}>
              <AppText style={pm.headerTitle}>{t('wp_pmTitle', { action: t(meta.labelKey) })}</AppText>
              <AppText style={pm.headerSub}>{workerName}{workerPhone ? ` · ${workerPhone}` : ''}</AppText>
            </View>
            <TouchableOpacity onPress={onClose} style={pm.closeBtn}>
              <AppText style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18, fontWeight: '700' }}>✕</AppText>
            </TouchableOpacity>
          </View>

          {step === 'rate' ? (
            // ── Step 2: Hire rate input (Joined only) ──────────────────────
            <>
              <View style={pm.rateStepWrap}>
                <AppText style={pm.hint}>{t('wp_pmRateHint', { name: workerName })}</AppText>

                {/* Rate type toggle */}
                <View style={pm.rateTypeRow}>
                  {(['Daily', 'Monthly'] as const).map((rt) => (
                    <TouchableOpacity
                      key={rt}
                      onPress={() => setRateType(rt)}
                      style={[pm.rateTypeBtn, rateType === rt && { backgroundColor: meta.color, borderColor: meta.color }]}
                      activeOpacity={0.8}
                    >
                      <AppText style={[pm.rateTypeTxt, rateType === rt && { color: '#fff' }]}>
                        {rt === 'Daily' ? t('wp_perDay') : t('wp_perMonth')}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Rate amount input */}
                <View style={pm.rateInputWrap}>
                  <AppText style={pm.rateRupee}>₹</AppText>
                  <TextInput
                    style={pm.rateInput}
                    placeholder={rateType === 'Daily' ? t('wp_egDaily') : t('wp_egMonthly')}
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={agreedRate}
                    onChangeText={setAgreedRate}
                    maxLength={7}
                    autoFocus
                  />
                  <AppText style={pm.rateUnit}>/{rateType === 'Daily' ? t('wp_unitDay') : t('wp_unitMonth')}</AppText>
                </View>

                <AppText style={pm.rateNote}>
                  {t('wp_rateNote')}
                </AppText>
              </View>

              <View style={pm.footer}>
                <TouchableOpacity onPress={() => setStep('pick')} style={pm.cancelBtn}>
                  <AppText style={pm.cancelTxt}>{t('wp_back')}</AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void handleSave()}
                  disabled={saving || !agreedRate || parseFloat(agreedRate) <= 0}
                  style={[pm.saveBtn, { backgroundColor: meta.color }, (saving || !agreedRate || parseFloat(agreedRate) <= 0) && { opacity: 0.5 }]}
                  activeOpacity={0.85}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <AppText style={pm.saveTxt}>{t('wp_confirmHire')}</AppText>}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            // ── Step 1: Pick requirement(s) ────────────────────────────────
            <>
              <AppText style={pm.hint}>
                {t('wp_pmPickHint')}
              </AppText>

              {loading ? (
                <View style={pm.center}><ActivityIndicator color={meta.color} size="small" /></View>
              ) : requirements.length === 0 ? (
                <View style={pm.emptyBox}>
                  <View style={pm.emptyIcon}>
                    <AppText style={{ fontSize: 30 }}>📋</AppText>
                  </View>
                  <AppText style={pm.emptyTitle}>{t('wp_noOpenReqs')}</AppText>
                  <AppText style={pm.emptyDesc}>
                    {t('wp_pmEmptyDesc')}
                  </AppText>
                  <TouchableOpacity
                    onPress={() => { onClose(); navPicker.navigate('PostRequirement'); }}
                    style={[pm.postBtn, { backgroundColor: meta.color }]}
                    activeOpacity={0.85}
                  >
                    <AppText style={pm.postBtnTxt}>{t('wp_postReq')}</AppText>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={requirements}
                  keyExtractor={(r) => r._id}
                  style={pm.list}
                  renderItem={({ item: r }) => {
                    const isChk = selected.includes(r._id);
                    // Worker's current pipeline status on this requirement (if any).
                    const existing = workerStatusByReq[r._id];
                    // Disabled unless the sheet's target status is a valid forward move
                    // (or the worker isn't mapped to this requirement yet).
                    const isDisabled = existing ? !FORWARD_TRANSITIONS[existing].includes(status) : false;
                    // Badge: show the worker's mapping status if mapped, else the
                    // requirement's own hiring status — both fully translated.
                    const badgeColor = existing ? STATUS_META[existing].color : meta.color;
                    const badgeText  = existing
                      ? t(MAPPING_STATUS_KEY[existing])
                      : r.status
                      ? (REQ_STATUS_KEY[r.status] ? t(REQ_STATUS_KEY[r.status]) : r.status)
                      : '';
                    return (
                      <TouchableOpacity
                        onPress={() => toggle(r._id)}
                        disabled={isDisabled}
                        style={[pm.reqRow, isChk && { backgroundColor: meta.bg }, isDisabled && pm.reqRowDisabled]}
                        activeOpacity={0.7}
                      >
                        <View style={[pm.checkbox, isChk && { backgroundColor: meta.color, borderColor: meta.color }]}>
                          {isChk && <AppText style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>✓</AppText>}
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <AppText style={pm.reqTitle} numberOfLines={1} ellipsizeMode="tail">
                            {[r.workType, r.subCategory].filter(Boolean).map((x) => subcatDisplay(String(x))).join(' · ')}
                          </AppText>
                          <AppText style={pm.reqSub}>
                            ERN {r.ERN_NUMBER || '—'}{r.district ? `  ·  ${r.district}` : ''}
                          </AppText>
                        </View>
                        {badgeText ? (
                          <View style={[pm.statusTag, existing && { backgroundColor: STATUS_META[existing].bg }]}>
                            <AppText style={[pm.statusTxt, { color: badgeColor }]}>{badgeText}</AppText>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  }}
                />
              )}

              <View style={pm.footer}>
                <TouchableOpacity onPress={onClose} style={pm.cancelBtn}>
                  <AppText style={pm.cancelTxt}>{t('wp_cancel')}</AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleNext}
                  disabled={saving || selected.length === 0}
                  style={[pm.saveBtn, { backgroundColor: meta.color }, (saving || selected.length === 0) && { opacity: 0.5 }]}
                  activeOpacity={0.85}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <AppText style={pm.saveTxt}>
                        {status === 'Joined' ? t('wp_next') : `${t(meta.labelKey)} (${selected.length})`}
                      </AppText>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const pm = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '85%', overflow: 'hidden' },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle:{ fontSize: 16, fontWeight: '800', color: '#fff' },
  headerSub:  { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  closeBtn:   { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  hint:       { fontSize: 12.5, fontWeight: '600', color: '#475569', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  center:     { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyBox:   { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, gap: 8 },
  emptyIcon:  { width: 64, height: 64, borderRadius: 18, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  emptyDesc:  { fontSize: 12.5, color: '#64748b', textAlign: 'center', lineHeight: 19 },
  postBtn:    { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 4 },
  postBtnTxt: { fontSize: 13, fontWeight: '800', color: '#fff' },
  list:       { maxHeight: 520 },
  reqRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f1f5f9' },
  reqRowDisabled: { opacity: 0.5 },
  checkbox:   { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  reqTitle:   { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  reqSub:     { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  statusTag:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#f1f5f9', flexShrink: 0 },
  statusTxt:  { fontSize: 10, fontWeight: '700' },
  footer:        { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f1f5f9' },
  cancelBtn:     { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0', paddingVertical: 14, alignItems: 'center' },
  cancelTxt:     { fontSize: 14, fontWeight: '700', color: '#64748b' },
  saveBtn:       { flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveTxt:       { fontSize: 14, fontWeight: '800', color: '#fff' },
  // Rate step
  rateStepWrap:  { paddingHorizontal: 20, paddingTop: 8, gap: 14 },
  rateTypeRow:   { flexDirection: 'row', gap: 10 },
  rateTypeBtn:   { flex: 1, borderRadius: 12, borderWidth: 2, borderColor: '#E2E8F0', paddingVertical: 12, alignItems: 'center' },
  rateTypeTxt:   { fontSize: 13, fontWeight: '800', color: '#64748B' },
  rateInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#F8FAFC' },
  rateRupee:     { fontSize: 22, fontWeight: '900', color: '#475569', marginRight: 4 },
  rateInput:     { flex: 1, fontSize: 28, fontWeight: '900', color: '#0F172A', paddingVertical: 14 },
  rateUnit:      { fontSize: 14, fontWeight: '700', color: '#64748B' },
  rateNote:      { fontSize: 11.5, color: '#94A3B8', lineHeight: 17, paddingBottom: 8 },
});
