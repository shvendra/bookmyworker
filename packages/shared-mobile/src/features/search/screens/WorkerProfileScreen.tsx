import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useAppTheme } from '../../../core/theme';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import type { WorkerDetail } from '../../../core/api/endpoints/workerApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText } from '../../../shared/components/ui/AppText';
import { buildPhotoUrl } from '../../../core/config/env';
import type { MainStackParamList } from '../../../app/navigation/types';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { shortlistStorage } from '../../../core/storage/shortlistStorage';
import { workerMappingApi } from '../../../core/api/endpoints/workerMappingApi';
import type { MappingStatus, OpenRequirement } from '../../../core/api/endpoints/workerMappingApi';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import i18n from '../../../core/i18n';
import { getLocationStr } from '../../../shared/utils/labelUtils';

type Props = NativeStackScreenProps<MainStackParamList, 'WorkerProfile'>;


// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  navy:      '#0f172a',
  blue:      '#2563eb',
  blueSoft:  '#eff6ff',
  blueLight: '#dbeafe',
  indigo:    '#4f46e5',
  indigoSoft:'#eef2ff',
  green:     '#16a34a',
  greenSoft: '#f0fdf4',
  greenLight:'#bbf7d0',
  amber:     '#d97706',
  amberSoft: '#fffbeb',
  amberLight:'#fde68a',
  red:       '#dc2626',
  slate:     '#64748b',
  slateLight:'#f1f5f9',
  border:    '#e2e8f0',
  white:     '#ffffff',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatName = (name = ''): string =>
  name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const getAge = (dob?: string | number): string => {
  if (dob == null || dob === '') return '';
  const timestamp = Number(dob);
  if (isNaN(timestamp)) return '';
  if (String(dob).length <= 5) {
    if (timestamp > 1900 && timestamp <= new Date().getFullYear()) return String(new Date().getFullYear() - timestamp);
    return String(timestamp);
  }
  const ms = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
  const birth = new Date(ms);
  if (isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return String(age);
};

// Handles arrays, JSON-encoded string arrays, underscore_keys, and deduplication
const formatAreas = (raw: unknown): string[] => {
  let items: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const s = String(item ?? '').trim();
      if (!s) continue;
      if (s.startsWith('[')) {
        try { const p = JSON.parse(s); if (Array.isArray(p)) { items.push(...p.map(String)); continue; } } catch { /* ignore */ }
      }
      items.push(s);
    }
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try { const p = JSON.parse(trimmed); if (Array.isArray(p)) { items = p.map(String); } } catch { /* ignore */ }
    } else {
      items = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  const seen = new Set<string>();
  return items
    .map((a) => a.replace(/_/g, ' ').trim())
    .filter(Boolean)
    .map((a) => a.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '))
    .filter((v) => { if (seen.has(v)) return false; seen.add(v); return true; });
};

// ─── Stat tile ────────────────────────────────────────────────────────────────
const StatTile = ({ value, label, color, bg }: {
  value: string; label: string; color: string; bg: string;
}): React.JSX.Element => (
  <View style={[st.tile, { backgroundColor: bg }]}>
    <AppText style={[st.value, { color }]}>{value}</AppText>
    <AppText style={st.label}>{label}</AppText>
  </View>
);
const st = StyleSheet.create({
  tile:  { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 3 },
  value: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '600', color: C.slate, textAlign: 'center' },
});

// ─── Info row ─────────────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value }: {
  icon: string; label: string; value?: string | number | null;
}): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  if (value == null || value === '' || value === 0) return null;
  return (
    <View style={[inf.row, { borderBottomColor: C.border }]}>
      <View style={inf.iconBox}><AppText style={{ fontSize: 14 }}>{icon}</AppText></View>
      <AppText style={[inf.label, { color: C.slate }]}>{label}</AppText>
      <AppText style={[inf.value, { color: theme.colors.text }]} numberOfLines={2}>{String(value)}</AppText>
    </View>
  );
};
const inf = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  iconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.slateLight, alignItems: 'center', justifyContent: 'center' },
  label:   { flex: 1, fontSize: 13, fontWeight: '500', color: C.slate },
  value:   { fontSize: 13, fontWeight: '700', textAlign: 'right', maxWidth: '55%' },
});

// ─── Card section ─────────────────────────────────────────────────────────────
const Section = ({ title, accent, children }: {
  title: string; accent: string; children: React.ReactNode;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View style={[sec.card, { backgroundColor: theme.colors.card }]}>
      <View style={[sec.titleRow, { borderLeftColor: accent }]}>
        <AppText style={sec.title}>{title}</AppText>
      </View>
      {children}
    </View>
  );
};
const sec = StyleSheet.create({
  card:     { borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  titleRow: { borderLeftWidth: 3, paddingLeft: 10, marginBottom: 14 },
  title:    { fontSize: 14, fontWeight: '800', color: C.navy, letterSpacing: 0.2 },
});

// ─── Loading skeleton ─────────────────────────────────────────────────────────
const LoadingSkeleton = (): React.JSX.Element => {
  const pulse = C.slateLight;
  return (
    <View style={{ flex: 1, backgroundColor: '#1037A4' }}>
      <View style={{ paddingTop: 16, height: 240, backgroundColor: '#1037A4', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 24, gap: 10 }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <View style={{ width: 140, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <View style={{ width: 100, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.08)' }} />
      </View>
      <View style={{ backgroundColor: '#f8fafc', flex: 1, padding: 14, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[0,1,2,3].map((i) => <View key={i} style={{ flex: 1, height: 72, borderRadius: 14, backgroundColor: pulse }} />)}
        </View>
        <View style={{ height: 140, borderRadius: 16, backgroundColor: pulse }} />
        <View style={{ height: 200, borderRadius: 16, backgroundColor: pulse }} />
      </View>
    </View>
  );
};

// ─── Full user profile interface ──────────────────────────────────────────────
interface FullUserProfile {
  isSubscribed?: boolean;
  subscriptionExpery?: string;
  employerType?: string;
}

// ─── Status meta ──────────────────────────────────────────────────────────────
const STATUS_META: Record<MappingStatus, { label: string; color: string; bg: string }> = {
  Shortlisted: { label: 'Shortlist',   color: '#2563eb', bg: '#eff6ff' },
  Selected:    { label: 'Select',      color: '#6d28d9', bg: '#f5f3ff' },
  Joined:      { label: 'Mark Joined', color: '#15803d', bg: '#f0fdf4' },
};

// ─── Requirement Picker Modal ─────────────────────────────────────────────────
interface RequirementPickerProps {
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

const RequirementPickerModal = ({
  visible, onClose, workerName, workerPhone, workerId, workerSkill, status, onSuccess, toast,
}: RequirementPickerProps): React.JSX.Element => {
  const navPicker = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [requirements, setRequirements] = useState<OpenRequirement[]>([]);
  const [selected,     setSelected]     = useState<string[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);

  // Rate step — shown only when status === 'Joined'
  const [step,      setStep]      = useState<'pick' | 'rate'>('pick');
  const [agreedRate, setAgreedRate] = useState('');
  const [rateType,  setRateType]  = useState<'Daily' | 'Monthly'>('Daily');

  const meta = STATUS_META[status];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const reqs = await workerMappingApi.getEmployerOpenRequirements();
      setRequirements(reqs);
    } catch {
      toast.error('Could not load requirements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) { setSelected([]); setStep('pick'); setAgreedRate(''); setRateType('Daily'); void load(); }
  }, [visible, load]);

  const toggle = (id: string) =>
    setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  // For Joined, first go to the rate step; for others, save directly.
  const handleNext = () => {
    if (selected.length === 0) { toast.error('Select at least one requirement'); return; }
    if (status === 'Joined') { setStep('rate'); return; }
    void handleSave();
  };

  const handleSave = async () => {
    if (status === 'Joined') {
      const rate = parseFloat(agreedRate);
      if (!agreedRate || isNaN(rate) || rate <= 0) {
        toast.error('Enter a valid agreed rate (e.g. 500)');
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
      toast.success(`${workerName} marked as Joined for ${selected.length} requirement(s)`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to save');
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
              <AppText style={pm.headerTitle}>{meta.label} Worker</AppText>
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
                <AppText style={pm.hint}>Set the agreed pay rate for {workerName}:</AppText>

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
                        {rt === 'Daily' ? '📅 Per Day' : '📆 Per Month'}
                      </AppText>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Rate amount input */}
                <View style={pm.rateInputWrap}>
                  <AppText style={pm.rateRupee}>₹</AppText>
                  <TextInput
                    style={pm.rateInput}
                    placeholder={rateType === 'Daily' ? 'e.g. 500' : 'e.g. 12000'}
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={agreedRate}
                    onChangeText={setAgreedRate}
                    maxLength={7}
                    autoFocus
                  />
                  <AppText style={pm.rateUnit}>/{rateType === 'Daily' ? 'day' : 'month'}</AppText>
                </View>

                <AppText style={pm.rateNote}>
                  This rate is used to calculate salary from attendance records. It doesn't process any payment — you pay workers directly.
                </AppText>
              </View>

              <View style={pm.footer}>
                <TouchableOpacity onPress={() => setStep('pick')} style={pm.cancelBtn}>
                  <AppText style={pm.cancelTxt}>← Back</AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void handleSave()}
                  disabled={saving || !agreedRate || parseFloat(agreedRate) <= 0}
                  style={[pm.saveBtn, { backgroundColor: meta.color }, (saving || !agreedRate || parseFloat(agreedRate) <= 0) && { opacity: 0.5 }]}
                  activeOpacity={0.85}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <AppText style={pm.saveTxt}>Confirm Hire</AppText>}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            // ── Step 1: Pick requirement(s) ────────────────────────────────
            <>
              <AppText style={pm.hint}>
                Select requirement(s) to link this worker:
              </AppText>

              {loading ? (
                <View style={pm.center}><ActivityIndicator color={meta.color} size="small" /></View>
              ) : requirements.length === 0 ? (
                <View style={pm.emptyBox}>
                  <View style={pm.emptyIcon}>
                    <AppText style={{ fontSize: 30 }}>📋</AppText>
                  </View>
                  <AppText style={pm.emptyTitle}>No Open Requirements</AppText>
                  <AppText style={pm.emptyDesc}>
                    You need to post a requirement before adding workers to your pipeline.
                  </AppText>
                  <TouchableOpacity
                    onPress={() => { onClose(); navPicker.navigate('PostRequirement'); }}
                    style={[pm.postBtn, { backgroundColor: meta.color }]}
                    activeOpacity={0.85}
                  >
                    <AppText style={pm.postBtnTxt}>+ Post a Requirement</AppText>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={requirements}
                  keyExtractor={(r) => r._id}
                  style={pm.list}
                  renderItem={({ item: r }) => {
                    const isChk = selected.includes(r._id);
                    return (
                      <TouchableOpacity
                        onPress={() => toggle(r._id)}
                        style={[pm.reqRow, isChk && { backgroundColor: meta.bg }]}
                        activeOpacity={0.7}
                      >
                        <View style={[pm.checkbox, isChk && { backgroundColor: meta.color, borderColor: meta.color }]}>
                          {isChk && <AppText style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>✓</AppText>}
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <AppText style={pm.reqTitle} numberOfLines={1}>
                            {r.workType?.replace(/_/g, ' ')}{r.subCategory ? ` · ${r.subCategory.replace(/_/g, ' ')}` : ''}
                          </AppText>
                          <AppText style={pm.reqSub}>
                            ERN {r.ERN_NUMBER || '—'}{r.district ? `  ·  ${r.district}` : ''}
                          </AppText>
                        </View>
                        {r.status ? (
                          <View style={pm.statusTag}>
                            <AppText style={[pm.statusTxt, { color: meta.color }]}>{r.status}</AppText>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  }}
                />
              )}

              <View style={pm.footer}>
                <TouchableOpacity onPress={onClose} style={pm.cancelBtn}>
                  <AppText style={pm.cancelTxt}>Cancel</AppText>
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
                        {status === 'Joined' ? `Next →` : `${meta.label} (${selected.length})`}
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
  list:       { maxHeight: 320 },
  reqRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f1f5f9' },
  checkbox:   { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  reqTitle:   { fontSize: 13.5, fontWeight: '700', color: '#0f172a' },
  reqSub:     { fontSize: 11.5, color: '#94a3b8', marginTop: 1 },
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

// ─── Invite to Requirement Modal ──────────────────────────────────────────────
interface InviteModalProps {
  visible: boolean;
  onClose: () => void;
  workerId: string | null;
  workerName: string;
  workerPhone?: string;
  toast: ReturnType<typeof useToast>;
}

const InviteToRequirementModal = ({ visible, onClose, workerId, workerName, workerPhone, toast }: InviteModalProps): React.JSX.Element => {
  const navInv = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
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
      toast.error('Could not load requirements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) { setSelected(null); void load(); }
  }, [visible, load]);

  const handleSend = async () => {
    if (!selected) { toast.error('Select a requirement first'); return; }
    setSaving(true);
    try {
      await requirementsApi.inviteWorker(selected, { workerId, workerName, workerPhone });
      toast.success(`Invitation sent to ${workerName}!`, 'Invited');
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to send invite');
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
              <AppText style={inv.headerTitle}>Invite to Requirement</AppText>
              <AppText style={inv.headerSub}>{workerName}</AppText>
            </View>
            <TouchableOpacity onPress={onClose} style={inv.closeBtn}>
              <AppText style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18, fontWeight: '700' }}>✕</AppText>
            </TouchableOpacity>
          </View>

          <AppText style={inv.hint}>Select which requirement to invite this worker for:</AppText>

          {loading ? (
            <View style={inv.center}><ActivityIndicator color="#7C3AED" size="small" /></View>
          ) : requirements.length === 0 ? (
            <View style={inv.emptyBox}>
              <AppText style={{ fontSize: 30, marginBottom: 8 }}>📋</AppText>
              <AppText style={inv.emptyTitle}>No Open Requirements</AppText>
              <AppText style={inv.emptyDesc}>Post a requirement first to invite workers.</AppText>
              <TouchableOpacity onPress={() => { onClose(); navInv.navigate('PostRequirement'); }} style={[inv.postBtn, { backgroundColor: '#7C3AED' }]} activeOpacity={0.85}>
                <AppText style={inv.postBtnTxt}>+ Post a Requirement</AppText>
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
                      <AppText style={inv.reqTitle} numberOfLines={1}>
                        {r.workType?.replace(/_/g, ' ')}{r.subCategory ? ` · ${r.subCategory.replace(/_/g, ' ')}` : ''}
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
              <AppText style={inv.cancelTxt}>Cancel</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void handleSend()}
              disabled={saving || !selected}
              style={[inv.saveBtn, (!selected || saving) && { opacity: 0.5 }]}
              activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <AppText style={inv.saveTxt}>Send Invite 🔔</AppText>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const inv = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '80%', overflow: 'hidden' },
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
  list:        { maxHeight: 300 },
  reqRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f1f5f9' },
  radio:       { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  radioDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  reqTitle:    { fontSize: 13.5, fontWeight: '700', color: '#0f172a' },
  reqSub:      { fontSize: 11.5, color: '#94a3b8', marginTop: 1 },
  footer:      { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f1f5f9' },
  cancelBtn:   { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0', paddingVertical: 14, alignItems: 'center' },
  cancelTxt:   { fontSize: 14, fontWeight: '700', color: '#64748b' },
  saveBtn:     { flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#7C3AED' },
  saveTxt:     { fontSize: 14, fontWeight: '800', color: '#fff' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export const WorkerProfileScreen = ({ route, navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { workerId } = route.params;
  const { state: authState } = useAuth();
  const toast = useToast();
  const user = authState.session?.user;
  const isEmployer = user?.role === 'employer';
  const insets = useSafeAreaInsets();

  const [unlockedPhone, setUnlockedPhone] = useState<string | null>(null);
  const [unlocking,     setUnlocking]     = useState(false);
  const [alreadyHired,  setAlreadyHired]  = useState(false); // worker has Joined status — free contact

  // ── Local shortlist (bookmark) state ────────────────────────────────────
  const [isShortlisted, setIsShortlisted] = useState(false);
  const [shortlistBusy, setShortlistBusy] = useState(false);

  // ── Pipeline action modal (Shortlist / Select / Joined) ─────────────────
  const [pickerModal, setPickerModal] = useState<MappingStatus | null>(null);

  // ── Invite to Requirement modal ──────────────────────────────────────────
  const [inviteVisible, setInviteVisible] = useState(false);

  useEffect(() => {
    if (!isEmployer) return;
    void shortlistStorage.isShortlisted(workerId).then(setIsShortlisted);
  }, [isEmployer, workerId]);

  const handleToggleShortlist = (): void => {
    if (shortlistBusy) return;
    setShortlistBusy(true);
    void shortlistStorage.toggle(workerId).then((added) => {
      setIsShortlisted(added);
      toast[added ? 'success' : 'info'](
        added ? 'Added to your shortlist.' : 'Removed from shortlist.',
        added ? 'Shortlisted ❤️' : 'Removed',
      );
    }).finally(() => setShortlistBusy(false));
  };

  // ── Worker data from new endpoint ────────────────────────────────────────
  const { data: worker, isLoading, isError, refetch } = useQuery<WorkerDetail>({
    queryKey: ['worker-detail-v2', workerId],
    queryFn: () => workerApi.getWorkerById(workerId),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  // ── Employer subscription — always fresh, no stale cache ────────────────
  const { data: empProfile, isSuccess: empProfileLoaded } = useQuery<FullUserProfile | null>({
    queryKey: ['emp-profile-worker-detail'],
    queryFn: async () => {
      const { apiClient } = await import('../../../core/api/client');
      const res = await apiClient.get<{ user?: FullUserProfile }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    enabled: isEmployer,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });

  const isSubscribed = (() => {
    if (!isEmployer) return false;
    if (!empProfileLoaded) return true; // optimistic: assume subscribed while loading
    if (!empProfile?.isSubscribed) return false;
    const exp = empProfile.subscriptionExpery;
    if (!exp) return true;
    return new Date(exp).getTime() > Date.now();
  })();

  const employerType = (() => {
    const l = String(empProfile?.employerType ?? '').toLowerCase();
    if (l.includes('industry'))   return 'industry' as const;
    if (l.includes('agency'))     return 'agency' as const;
    if (l.includes('contractor')) return 'contractor' as const;
    return 'individual' as const;
  })();

  const handleUnlock = async (): Promise<void> => {
    if (unlocking || unlockedPhone) return;
    setUnlocking(true);
    try {
      const res = await workerApi.unlockNumber(workerId);
      if (res.phone) {
        setUnlockedPhone(res.phone);
        setAlreadyHired(res.alreadyHired === true);
        if (res.alreadyHired) {
          toast.success('Contact available — this worker is already hired by you.', 'Already Hired');
        } else {
          toast.success('Contact number unlocked.', 'Unlocked');
        }
      } else {
        const errMsg = res.message ?? 'Unable to unlock contact. Please check your subscription.';
        toast.error(errMsg, 'Unlock Failed');
        if (errMsg.toLowerCase().includes('subscribe') || errMsg.toLowerCase().includes('expired')) {
          navigation.navigate('Subscription');
        }
      }
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string; code?: string } }; message?: string };
      const data   = errObj?.response?.data;
      const code   = data?.code;
      const msg    = data?.message ?? errObj?.message;

      if (code === 'SUBSCRIPTION_EXPIRED') {
        toast.warning('Your subscription has expired. Renew to unlock new contacts.', 'Expired');
        navigation.navigate('Subscription');
      } else if (code === 'SUBSCRIPTION_REQUIRED') {
        toast.error('Subscribe to BookMyWorker to unlock contact details.', 'Subscribe');
        navigation.navigate('Subscription');
      } else if (code === 'CONTACT_LIMIT') {
        toast.warning('Contact limit exhausted. Top-up your plan.', 'Limit Reached');
        navigation.navigate('Subscription');
      } else {
        toast.error(msg ?? 'Failed to unlock contact. Please try again.', 'Error');
      }
    } finally {
      setUnlocking(false);
    }
  };

  // ── Loading & error states ───────────────────────────────────────────────
  if (isLoading) return <LoadingSkeleton />;

  if (isError || !worker) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
        <ScreenHeader title="Worker Profile" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <AppText style={{ fontSize: 18, fontWeight: '800', color: C.navy, marginBottom: 8 }}>Profile Unavailable</AppText>
          <AppText style={{ fontSize: 13, color: C.slate, textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
            Could not load this worker's profile. Please check your connection and try again.
          </AppText>
          <TouchableOpacity onPress={() => void refetch()} style={{ backgroundColor: C.navy, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13 }}>
            <AppText style={{ color: C.white, fontWeight: '800', fontSize: 14 }}>Retry</AppText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Derived display data ─────────────────────────────────────────────────
  const photoUrl = buildPhotoUrl(worker.profilePhoto);

  const displayName = formatName(worker.name ?? 'Unknown');
  const initials    = displayName.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  const isAgent     = String(worker.role ?? '').toLowerCase() === 'agent';
  const accentColor = isAgent ? C.indigo : C.blue;
  const isVerified  = worker.status === 'Verified' || worker.veryfiedBage === true;
  const age         = getAge(worker.dob);
  const areas       = formatAreas(worker.areasOfWork ?? []);
  const exp         = worker.workExperience != null ? Number(worker.workExperience) : null;
  const wage        = worker.fixedSalary ?? worker.salaryFrom;
  const wageDisplay = wage
    ? `₹${wage}${worker.salaryTo && worker.salaryTo !== wage ? `–${worker.salaryTo}` : ''}/day`
    : null;
  const bio = worker.bio ?? worker.about;
  const location = getLocationStr({ tehsil: worker.block, district: worker.district, state: worker.state }, i18n.language, '');

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <ScreenHeader
        title="Worker Profile"
        onBack={() => navigation.goBack()}
        rightIcon={isEmployer ? (isShortlisted ? '❤️' : '🤍') : undefined}
        onRightPress={isEmployer ? handleToggleShortlist : undefined}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <View style={[s.hero, { paddingTop: 16, backgroundColor: '#1037A4' }]}>
          {/* Depth layer + circles — matches GradientHeader */}
          <View style={s.heroDepth} pointerEvents="none" />
          <View style={s.heroCircle1} pointerEvents="none" />
          <View style={s.heroCircle2} pointerEvents="none" />

          {/* Avatar */}
          <View style={s.avatarWrap}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={[s.avatar, { borderColor: accentColor }]} />
            ) : (
              <View style={[s.avatarFallback, { backgroundColor: accentColor }]}>
                <AppText style={s.initials}>{initials}</AppText>
              </View>
            )}
            {isVerified && (
              <View style={s.verifiedBadge}>
                <AppText style={{ color: C.white, fontSize: 11, fontWeight: '900' }}>✓</AppText>
              </View>
            )}
          </View>

          {/* Name + location */}
          <AppText style={s.heroName}>{displayName}</AppText>
          {areas.length > 0 && (
            <AppText style={s.heroCategory} numberOfLines={1}>
              {areas.slice(0, 2).join('  ·  ')}
            </AppText>
          )}
          {!!location && (
            <AppText style={s.heroLocation} numberOfLines={1}>{location}</AppText>
          )}

          {/* Status + role badges */}
          <View style={s.badgeRow}>
            {isAgent && (
              <View style={[s.badge, { backgroundColor: 'rgba(79,70,229,0.25)' }]}>
                <AppText style={[s.badgeTxt, { color: '#a5b4fc' }]}>AGENT</AppText>
              </View>
            )}
            <View style={[s.badge, {
              backgroundColor: isVerified ? 'rgba(22,163,74,0.25)' : 'rgba(217,119,6,0.25)',
            }]}>
              <AppText style={[s.badgeTxt, { color: isVerified ? '#4ade80' : '#fcd34d' }]}>
                {isVerified ? 'VERIFIED' : 'UNVERIFIED'}
              </AppText>
            </View>
            {!!worker.gender && (
              <View style={[s.badge, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                <AppText style={[s.badgeTxt, { color: 'rgba(255,255,255,0.8)' }]}>{worker.gender.toUpperCase()}</AppText>
              </View>
            )}
          </View>
        </View>

        {/* ── Body ──────────────────────────────────────────────────── */}
        <View style={[s.body, { backgroundColor: theme.colors.background }]}>

          {/* Stats row */}
          <View style={s.statsRow}>
            <StatTile
              value={exp && exp > 0 ? `${exp}y` : 'New'}
              label="Experience"
              color={C.blue}
              bg={C.blueSoft}
            />
            <StatTile
              value={wageDisplay ?? '—'}
              label="Daily Rate"
              color={C.green}
              bg={C.greenSoft}
            />
            {!!age && (
              <StatTile
                value={`${age} yrs`}
                label="Age"
                color={C.amber}
                bg={C.amberSoft}
              />
            )}
            {(worker.rating ?? 0) > 0 && (
              <StatTile
                value={`${worker.rating}★`}
                label={`${worker.totalRatings ?? 0} ratings`}
                color={C.indigo}
                bg={C.indigoSoft}
              />
            )}
          </View>

          {/* Skills */}
          {areas.length > 0 && (
            <Section title="Areas of Work" accent={C.blue}>
              <View style={s.skillsGrid}>
                {areas.map((skill, i) => (
                  <View key={i} style={s.skillChip}>
                    <AppText style={s.skillTxt}>{skill}</AppText>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* Profile details */}
          <Section title="Profile Details" accent={C.indigo}>
            <InfoRow icon="💼" label="Category"  value={areas[0] ?? null} />
            <InfoRow icon="📍" label="Location"          value={location || null} />
            <InfoRow icon="⏳" label="Experience"        value={exp && exp > 0 ? `${exp} years` : 'Fresher'} />
            <InfoRow icon="💰" label="Daily Rate"        value={wageDisplay} />
            <InfoRow icon="👤" label="Gender"            value={worker.gender} />
            <InfoRow icon="🎂" label="Age"               value={age ? `${age} years` : null} />
            <InfoRow icon="🔖" label="Worker Type"       value={isAgent ? 'Agent / Group' : 'Individual Worker'} />
            <InfoRow icon="📊" label="Status"            value={worker.status} />
            {!!bio && (
              <View style={s.bioWrap}>
                <AppText style={s.bioLabel}>About</AppText>
                <AppText style={[s.bioText, { color: theme.colors.text }]}>{bio}</AppText>
              </View>
            )}
          </Section>

          {/* Hire Again — employer only */}
          {isEmployer && areas.length > 0 && (
            <TouchableOpacity
              onPress={() => navigation.navigate('PostRequirement', { workType: areas[0], reqType: 'Daily_Wages' })}
              style={s.hireAgainBtn}
              activeOpacity={0.85}
            >
              <AppText style={s.hireAgainTxt}>⚡  Hire Again for {areas[0]}</AppText>
            </TouchableOpacity>
          )}

          {/* Pipeline actions — employer only */}
          {isEmployer && (
            <View style={s.pipelineRow}>
              {(['Shortlisted', 'Selected', 'Joined'] as MappingStatus[]).map((st) => {
                const m = STATUS_META[st];
                return (
                  <TouchableOpacity
                    key={st}
                    onPress={() => setPickerModal(st)}
                    style={[s.pipelineBtn, { backgroundColor: m.bg }]}
                    activeOpacity={0.8}
                  >
                    <AppText style={[s.pipelineTxt, { color: m.color }]}>{m.label}</AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Invite to Requirement button — employer only */}
          {isEmployer && (
            <TouchableOpacity
              onPress={() => setInviteVisible(true)}
              style={s.inviteBtn}
              activeOpacity={0.85}
            >
              <AppText style={s.inviteTxt}>🔔  Invite to My Requirement</AppText>
            </TouchableOpacity>
          )}

          {/* Invite Modal */}
          {isEmployer && (
            <InviteToRequirementModal
              visible={inviteVisible}
              onClose={() => setInviteVisible(false)}
              workerId={workerId}
              workerName={displayName}
              workerPhone={unlockedPhone || worker.phone || ''}
              toast={toast}
            />
          )}

          {/* Requirement picker modal */}
          {pickerModal && (
            <RequirementPickerModal
              visible={Boolean(pickerModal)}
              onClose={() => setPickerModal(null)}
              workerName={displayName}
              workerPhone={unlockedPhone || worker.phone || ''}
              workerId={workerId}
              workerSkill={areas[0] || ''}
              status={pickerModal}
              onSuccess={() => setPickerModal(null)}
              toast={toast}
            />
          )}

          {/* Contact — employer only */}
          {isEmployer && (
            <Section title="Contact Worker" accent={C.green}>
              {unlockedPhone ? (
                // ─ Unlocked (either via credit or free because already hired)
                <View style={s.unlockedBox}>
                  {/* Already-hired free badge */}
                  {alreadyHired && (
                    <View style={s.hiredBadge}>
                      <AppText style={s.hiredBadgeEmoji}>🤝</AppText>
                      <AppText style={s.hiredBadgeTxt}>
                        Already hired — contact available for free
                      </AppText>
                    </View>
                  )}
                  <View style={s.phoneCard}>
                    <View style={s.phoneIconWrap}>
                      <AppText style={{ fontSize: 20 }}>📞</AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={s.phoneLabel}>Phone Number</AppText>
                      <AppText style={s.phoneNum}>{unlockedPhone}</AppText>
                    </View>
                  </View>
                  <View style={s.contactBtns}>
                    <TouchableOpacity
                      onPress={() => void Linking.openURL(`tel:${unlockedPhone}`)}
                      style={s.callBtn}
                      activeOpacity={0.85}
                    >
                      <AppText style={s.callBtnTxt}>Call Now</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => void Linking.openURL(`https://wa.me/91${unlockedPhone}`)}
                      style={s.waBtn}
                      activeOpacity={0.85}
                    >
                      <AppText style={s.waBtnTxt}>WhatsApp</AppText>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : isSubscribed ? (
                // ─ Active subscription — unlock costs 1 contact credit
                <View style={s.unlockBox}>
                  <View style={s.unlockHint}>
                    <AppText style={s.unlockHintTxt}>
                      Uses 1 contact credit · {empProfile?.remainingContacts ?? 0} remaining
                    </AppText>
                  </View>
                  <TouchableOpacity
                    onPress={() => void handleUnlock()}
                    disabled={unlocking}
                    style={[s.viewContactBtn, { opacity: unlocking ? 0.7 : 1 }]}
                    activeOpacity={0.85}
                  >
                    {unlocking
                      ? <ActivityIndicator color={C.white} size="small" />
                      : <AppText style={s.viewContactTxt}>View Contact Number</AppText>
                    }
                  </TouchableOpacity>
                </View>
              ) : (
                // ─ No subscription / expired
                <View style={s.lockBox}>
                  <View style={s.lockIconWrap}>
                    <AppText style={{ fontSize: 28 }}>
                      {empProfile?.isSubscribed ? '⏰' : '🔒'}
                    </AppText>
                  </View>
                  <AppText style={s.lockTitle}>
                    {empProfile?.isSubscribed ? 'Subscription Expired' : 'No Active Subscription'}
                  </AppText>
                  <AppText style={[s.lockSub, { color: C.slate }]}>
                    {empProfile?.isSubscribed
                      ? 'Your subscription has expired. Renew to unlock new contacts. Workers you\'ve already hired are always accessible for free.'
                      : 'Subscribe to BookMyWorker to access worker contact details and hire directly.'}
                  </AppText>
                  <View style={s.lockBenefits}>
                    {['View & call worker contact numbers', 'Direct WhatsApp messaging', 'Unlimited access to interested agents'].map((b, i) => (
                      <View key={i} style={s.benefitRow}>
                        <View style={s.benefitDot} />
                        <AppText style={[s.benefitTxt, { color: C.slate }]}>{b}</AppText>
                      </View>
                    ))}
                  </View>
                  {/* Try to unlock anyway — backend will handle the already-hired bypass */}
                  <TouchableOpacity
                    onPress={() => void handleUnlock()}
                    disabled={unlocking}
                    style={[s.hiredCheckBtn, { opacity: unlocking ? 0.7 : 1 }]}
                    activeOpacity={0.85}
                  >
                    {unlocking
                      ? <ActivityIndicator color={C.green} size="small" />
                      : <AppText style={s.hiredCheckTxt}>Check if Already Hired (Free)</AppText>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => navigation.navigate('Subscription')} style={s.subscribeBtn} activeOpacity={0.85}>
                    <AppText style={s.subscribeTxt}>
                      {empProfile?.isSubscribed ? 'Renew Subscription' : 'View Subscription Plans'}
                    </AppText>
                  </TouchableOpacity>
                </View>
              )}
            </Section>
          )}
        </View>
      </ScrollView>

    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Hero section
  hero:        { alignItems: 'center', paddingBottom: 28, paddingHorizontal: 20, overflow: 'hidden', position: 'relative' },
  heroDepth:   { ...StyleSheet.absoluteFillObject, backgroundColor: '#0F2888', opacity: 0.45 },
  heroCircle1: { position: 'absolute', width: 280, height: 280, borderRadius: 140, top: -90, right: -70, backgroundColor: 'rgba(255,255,255,0.04)' },
  heroCircle2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, bottom: -40, left: -60, backgroundColor: 'rgba(255,255,255,0.03)' },

  avatarWrap:     { position: 'relative', marginBottom: 14 },
  avatar:         { width: 96, height: 96, borderRadius: 48, borderWidth: 3 },
  avatarFallback: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  initials:       { fontSize: 30, fontWeight: '800', color: '#ffffff' },
  verifiedBadge:  { position: 'absolute', bottom: 2, right: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#1037A4' },

  heroName:     { fontSize: 24, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginBottom: 4 },
  heroCategory: { fontSize: 13, color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginBottom: 2 },
  heroLocation: { fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 10 },
  badgeRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  badge:        { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  badgeTxt:     { fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },

  // Body
  body:     { padding: 14, gap: 12 },
  statsRow: { flexDirection: 'row', gap: 8 },

  // Skills
  skillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip:  { backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#bfdbfe' },
  skillTxt:   { fontSize: 12, fontWeight: '600', color: '#2563eb' },

  // Bio
  bioWrap:  { paddingTop: 12 },
  bioLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  bioText:  { fontSize: 13, lineHeight: 20 },

  // Contact — unlocked
  unlockedBox:  { gap: 12 },
  phoneCard:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f0fdf4', borderRadius: 14, borderWidth: 1, borderColor: '#bbf7d0', padding: 14 },
  phoneIconWrap:{ width: 46, height: 46, borderRadius: 12, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' },
  phoneLabel:   { fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 2 },
  phoneNum:     { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  contactBtns:  { flexDirection: 'row', gap: 10 },
  callBtn:      { flex: 1, backgroundColor: '#0f172a', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  callBtnTxt:   { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  waBtn:        { flex: 1, backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  waBtnTxt:     { color: '#ffffff', fontSize: 15, fontWeight: '800' },

  // Contact — subscribed not unlocked
  viewContactBtn: { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  viewContactTxt: { color: '#ffffff', fontSize: 15, fontWeight: '800' },

  // Hire Again
  hireAgainBtn:  { backgroundColor: '#0F172A', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  hireAgainTxt:  { color: '#ffffff', fontSize: 15, fontWeight: '800', letterSpacing: 0.1 },

  // Invite to Requirement
  inviteBtn:  { backgroundColor: '#F5F3FF', borderRadius: 14, paddingVertical: 15, alignItems: 'center', borderWidth: 1.5, borderColor: '#DDD6FE' },
  inviteTxt:  { color: '#7C3AED', fontSize: 15, fontWeight: '800', letterSpacing: 0.1 },

  // Pipeline action buttons
  pipelineRow:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pipelineBtn:   { flex: 1, minWidth: 90, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  pipelineTxt:   { fontSize: 13, fontWeight: '800' },

  // Already-hired badge (shown above phone number when contact is free)
  hiredBadge:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ECFDF5', borderRadius: 10, borderWidth: 1, borderColor: '#6EE7B7', paddingHorizontal: 12, paddingVertical: 8 },
  hiredBadgeEmoji:{ fontSize: 14 },
  hiredBadgeTxt:  { fontSize: 12, fontWeight: '700', color: '#059669', flex: 1, lineHeight: 17 },

  // Subscribed but not yet unlocked — shows credit hint
  unlockBox:      { gap: 8 },
  unlockHint:     { backgroundColor: '#EBF1FF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  unlockHintTxt:  { fontSize: 11.5, fontWeight: '600', color: '#1037A4', textAlign: 'center' },

  // "Check if already hired" button (free, shown in expired/no-sub state)
  hiredCheckBtn:  { width: '100%', borderWidth: 1.5, borderColor: '#6EE7B7', borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: '#ECFDF5' },
  hiredCheckTxt:  { color: '#059669', fontSize: 14, fontWeight: '700' },

  // Contact — not subscribed
  lockBox:       { alignItems: 'center', gap: 14 },
  lockIconWrap:  { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fffbeb', borderWidth: 1.5, borderColor: '#fde68a', alignItems: 'center', justifyContent: 'center' },
  lockTitle:     { fontSize: 17, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  lockSub:       { fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
  lockBenefits:  { width: '100%', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 14, gap: 8 },
  benefitRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563eb' },
  benefitTxt:    { fontSize: 12, fontWeight: '500', flex: 1 },
  subscribeBtn:  { width: '100%', backgroundColor: '#0f172a', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  subscribeTxt:  { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
