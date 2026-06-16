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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useAppTheme } from '../../../core/theme';
import { usePlanFeatures } from '../../../core/hooks/usePlanFeatures';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import type { WorkerDetail } from '../../../core/api/endpoints/workerApi';
import { useAuth } from '../../../state/auth/AuthContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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
import { ageString } from '../../../shared/utils/ageUtils';
import { subcatDisplay } from '../../../shared/data/categoryLabels';

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

// Birth year / legacy age / full date string / timestamp → current age string.
const getAge = (dob?: string | number): string => ageString(dob);

// Handles arrays, JSON-encoded string arrays, underscore_keys, and deduplication
const NULL_STRINGS = new Set(['null', 'undefined', 'nan', 'none', 'n/a', '']);
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
    .filter((a) => !!a && !NULL_STRINGS.has(a.toLowerCase()))
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
const InfoRow = ({ icon, label, value, iconBg }: {
  icon: string; label: string; value?: string | number | null; iconBg?: string;
}): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  if (value == null || value === '' || value === 0) return null;
  return (
    <View style={[inf.row, { borderBottomColor: C.border }]}>
      <View style={[inf.iconBox, iconBg ? { backgroundColor: iconBg } : {}]}>
        <AppText style={{ fontSize: 14 }}>{icon}</AppText>
      </View>
      <AppText style={[inf.label, { color: C.slate }]}>{label}</AppText>
      <AppText style={[inf.value, { color: theme.colors.text }]}>{String(value)}</AppText>
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
  card:     { borderRadius: 20, padding: 16, shadowColor: '#142250', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 1 },
  titleRow: { borderLeftWidth: 3, paddingLeft: 10, marginBottom: 14 },
  title:    { fontSize: 14, fontWeight: '800', color: C.navy, letterSpacing: 0.2 },
});

// ─── Document Row ─────────────────────────────────────────────────────────────
const DocRow = ({ icon, iconBg, name, meta, onPress, isLast = false }: {
  icon: string; iconBg: string; name: string; meta: string;
  onPress: () => void; isLast?: boolean;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[dr.row, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }]}
    >
      <View style={[dr.iconBox, { backgroundColor: iconBg }]}>
        <AppText style={dr.icon}>{icon}</AppText>
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={[dr.name, { color: theme.colors.text }]} numberOfLines={2}>{name}</AppText>
        <AppText style={dr.meta}>{meta}</AppText>
      </View>
      <View style={dr.pill}>
        <AppText style={dr.pillTxt}>{t('wp_view')}</AppText>
      </View>
    </TouchableOpacity>
  );
};
const dr = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  icon:    { fontSize: 18, lineHeight: 22 },
  name:    { fontSize: 13, fontWeight: '700' },
  meta:    { fontSize: 11, color: C.slate, marginTop: 2 },
  pill:    { backgroundColor: '#EBF1FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  pillTxt: { fontSize: 11, fontWeight: '800', color: '#1037A4' },
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
  remainingContacts?: number;
  freeContactsRemaining?: number;
  employerType?: string;
  planFeatures?: { inviteEnabled?: boolean; pipelineEnabled?: boolean };
}

// ─── Status meta ──────────────────────────────────────────────────────────────
const STATUS_META: Record<MappingStatus, { labelKey: string; color: string; bg: string }> = {
  Shortlisted: { labelKey: 'wp_actShortlist',  color: '#2563eb', bg: '#eff6ff' },
  Selected:    { labelKey: 'wp_actSelect',     color: '#6d28d9', bg: '#f5f3ff' },
  Joined:      { labelKey: 'wp_actMarkJoined', color: '#15803d', bg: '#f0fdf4' },
};

// Mirrors the backend's ALLOWED_TRANSITIONS (workerMappingController.js): a worker
// can only advance Shortlisted → Selected → Joined. A requirement is only actionable
// from a given sheet if the target status is a valid *forward* move from the worker's
// current status (or the worker isn't mapped to it yet).
const FORWARD_TRANSITIONS: Record<MappingStatus, MappingStatus[]> = {
  Shortlisted: ['Selected'],
  Selected:    ['Joined'],
  Joined:      [],
};

// Requirement's own hiring status → translation key (covers all 11 languages).
const REQ_STATUS_KEY: Record<string, string> = {
  Pending:  'rd_statusPending',
  Active:   'wp_reqStatus_Active',
  Assigned: 'rd_assignedBadge',
};

// i18n key for a worker's existing mapping status badge.
const MAPPING_STATUS_KEY: Record<MappingStatus, string> = {
  Shortlisted: 'rd_status_Shortlisted',
  Selected:    'rd_status_Selected',
  Joined:      'rd_status_Joined',
};

// Gender raw value → translation key (covers all 11 languages via ws_male/female/other).
const GENDER_KEY: Record<string, string> = {
  male:   'ws_male',
  female: 'ws_female',
  other:  'ws_other',
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

// ─── Screen ───────────────────────────────────────────────────────────────────
export const WorkerProfileScreen = ({ route, navigation }: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const { workerId } = route.params;
  const { state: authState } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = authState.session?.user;
  const isEmployer = user?.role === 'employer';
  // Invite gating: read from the canonical plan-features hook (plan defaults +
  // live SuperAdmin overrides), NOT the raw profile blob — older accounts may be
  // missing the inviteEnabled subdoc flag. usePlanFeatures is optimistic (true)
  // while the profile loads, preserving the previous permissive-while-loading UX.
  const planFeat = usePlanFeatures();
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

  const openDocument = useCallback((url: string, title: string) => {
    const ext = url.split('.').pop()?.toLowerCase() ?? '';
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      void Linking.openURL(url);
    } else {
      navigation.navigate('PdfViewer', { url, title });
    }
  }, [navigation]);

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
        added ? t('wp_toastShortlistAdded') : t('wp_toastShortlistRemoved'),
        added ? t('wp_shortlistedTitle') : t('wp_removedTitle'),
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

  // ── Employer subscription — always fresh, refetch on every screen focus ──
  const { data: empProfile, isSuccess: empProfileLoaded, refetch: refetchEmpProfile } = useQuery<FullUserProfile | null>({
    queryKey: ['emp-profile-worker-detail'],
    queryFn: async () => {
      const { apiClient } = await import('../../../core/api/client');
      const res = await apiClient.get<{ user?: FullUserProfile }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    enabled: isEmployer,
    staleTime: 0,            // always re-fetch in background on focus
    gcTime: 5 * 60 * 1000,  // keep cached data for 5 min so no flash-to-zero on re-entry
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Re-fetch remaining contacts every time this screen comes into focus
  // (covers: navigating back from Subscription screen, contact used elsewhere, etc.)
  useFocusEffect(
    useCallback(() => {
      if (isEmployer) {
        void refetchEmpProfile();
        // Also sync with the shared dashboard cache
        void queryClient.invalidateQueries({ queryKey: ['employer-full-profile'] });
      }
    }, [isEmployer, refetchEmpProfile, queryClient])
  );

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

  // Gifted free contacts left. These are consumed before a subscription is
  // needed, so when > 0 the unlock works even for non-subscribed employers.
  // Stay at 0 until the profile loads so the free box never flashes prematurely.
  const freeContactsRemaining = empProfileLoaded ? (empProfile?.freeContactsRemaining ?? 0) : 0;

  const handleUnlock = async (): Promise<void> => {
    if (unlocking || unlockedPhone) return;
    setUnlocking(true);
    try {
      const res = await workerApi.unlockNumber(workerId);
      if (res.phone) {
        setUnlockedPhone(res.phone);
        setAlreadyHired(res.alreadyHired === true);
        if (res.alreadyHired) {
          toast.success(t('wp_toastAlreadyHired'), t('wp_alreadyHiredTitle'));
        } else {
          toast.success(
            res.usedFreeContact ? t('wp_toastFreeUnlocked') : t('wp_toastUnlocked'),
            t('wp_unlockedTitle'),
          );
          // Decrement happened on backend — refresh remaining contacts immediately
          void refetchEmpProfile();
          void queryClient.invalidateQueries({ queryKey: ['employer-full-profile'] });
        }
      } else {
        const errMsg = res.message ?? t('wp_unlockFailDefault');
        toast.error(errMsg, t('wp_unlockFailTitle'));
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
        toast.warning(t('wp_toastExpired'), t('wp_expiredTitle'));
        navigation.navigate('Subscription');
      } else if (code === 'SUBSCRIPTION_REQUIRED') {
        toast.error(t('wp_toastSubscribe'), t('wp_subscribeTitle'));
        navigation.navigate('Subscription');
      } else if (code === 'CONTACT_LIMIT') {
        toast.warning(t('wp_toastLimit'), t('wp_limitTitle'));
        navigation.navigate('Subscription');
      } else {
        toast.error(msg ?? t('wp_toastUnlockFail'), t('wp_errorTitle'));
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
        <ScreenHeader title={t('wp_title')} onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <AppText style={{ fontSize: 18, fontWeight: '800', color: C.navy, marginBottom: 8 }}>{t('wp_profileUnavailable')}</AppText>
          <AppText style={{ fontSize: 13, color: C.slate, textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
            {t('wp_profileUnavailableDesc')}
          </AppText>
          <TouchableOpacity onPress={() => void refetch()} style={{ backgroundColor: C.navy, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13 }}>
            <AppText style={{ color: C.white, fontWeight: '800', fontSize: 14 }}>{t('wp_retry')}</AppText>
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
  // Show both work categories (areasOfWork) and sub-skills (categories); formatAreas de-dupes.
  const areas       = formatAreas([...(worker.areasOfWork ?? []), ...(worker.categories ?? [])]);
  // Translated gender label (falls back to the raw value for unknown values).
  const genderKey   = worker.gender ? GENDER_KEY[worker.gender.trim().toLowerCase()] : undefined;
  const genderLabel = genderKey ? t(genderKey) : (worker.gender ?? '');
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
        title={t('wp_title')}
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
            <AppText style={s.heroCategory} numberOfLines={2}>
              {areas.slice(0, 2).map((a) => subcatDisplay(a)).join('  ·  ')}
            </AppText>
          )}
          {!!location && (
            <AppText style={s.heroLocation} numberOfLines={1}>{location}</AppText>
          )}

          {/* Status + role badges */}
          <View style={s.badgeRow}>
            {isAgent && (
              <View style={[s.badge, { backgroundColor: 'rgba(79,70,229,0.25)' }]}>
                <AppText style={[s.badgeTxt, { color: '#a5b4fc' }]}>{t('wp_agent')}</AppText>
              </View>
            )}
            <View style={[s.badge, {
              backgroundColor: isVerified ? 'rgba(22,163,74,0.25)' : 'rgba(217,119,6,0.25)',
            }]}>
              <AppText style={[s.badgeTxt, { color: isVerified ? '#4ade80' : '#fcd34d' }]}>
                {isVerified ? t('wp_verified') : t('wp_unverified')}
              </AppText>
            </View>
            {!!worker.gender && (
              <View style={[s.badge, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                <AppText style={[s.badgeTxt, { color: 'rgba(255,255,255,0.8)' }]}>{genderLabel.toUpperCase()}</AppText>
              </View>
            )}
          </View>
        </View>

        {/* ── Body ──────────────────────────────────────────────────── */}
        <View style={[s.body, { backgroundColor: theme.colors.background }]}>

          {/* Stats row */}
          <View style={s.statsRow}>
            <StatTile
              value={exp && exp > 0 ? `${exp}y` : t('wp_new')}
              label={t('wp_expLabel')}
              color={C.blue}
              bg={C.blueSoft}
            />
            <StatTile
              value={wageDisplay ?? '—'}
              label={t('wp_dailyRate')}
              color={C.green}
              bg={C.greenSoft}
            />
            {!!age && (
              <StatTile
                value={`${age} ${t('wp_yrs')}`}
                label={t('wp_age')}
                color={C.amber}
                bg={C.amberSoft}
              />
            )}
            {(worker.rating ?? 0) > 0 && (
              <StatTile
                value={`${worker.rating}★`}
                label={t('wp_ratings', { count: worker.totalRatings ?? 0 })}
                color={C.indigo}
                bg={C.indigoSoft}
              />
            )}
          </View>

          {/* Skills */}
          {areas.length > 0 && (
            <Section title={t('wp_areasOfWork')} accent={C.blue}>
              <View style={s.skillsGrid}>
                {areas.map((skill, i) => (
                  <View key={i} style={s.skillChip}>
                    <AppText style={s.skillTxt} maxFontSizeMultiplier={1.3}>{subcatDisplay(skill)}</AppText>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* Profile details */}
          <Section title={t('wp_profileDetails')} accent={C.indigo}>
            <InfoRow icon="⏳" label={t('wp_expLabel')}  value={exp && exp > 0 ? t('wp_years', { count: exp }) : t('wp_fresher')} iconBg="#EBF1FF" />
            <InfoRow icon="👤" label={t('wp_gender')}      value={genderLabel} iconBg="#F1F5F9" />
            <InfoRow icon="🎂" label={t('wp_age')}         value={age ? t('wp_years', { count: Number(age) }) : null} iconBg="#FFF7ED" />
            <InfoRow icon="🔖" label={t('wp_workerType')} value={isAgent ? t('wp_agentGroup') : t('wp_individualWorker')} iconBg="#F5F3FF" />
            <InfoRow icon="📊" label={t('wp_statusLabel')}      value={isVerified ? t('wp_verified') : t('wp_unverified')} iconBg="#F0FDF4" />
            {!!bio && (
              <View style={s.bioWrap}>
                <AppText style={s.bioLabel}>{t('wp_about')}</AppText>
                <AppText style={[s.bioText, { color: theme.colors.text }]}>{bio}</AppText>
              </View>
            )}
          </Section>

          {/* ── Documents & Certificates ── */}
          {(!!worker.resumeUrl || !!worker.labourLicenceUrl || (worker.certificates?.length ?? 0) > 0) && (
            <Section title={t('wp_documents')} accent="#7C3AED">
              {!!worker.resumeUrl && (
                <DocRow
                  icon="📄"
                  iconBg="#EBF1FF"
                  name={t('wp_resumeCV')}
                  meta={worker.resumeUrl.endsWith('.pdf') ? t('wp_pdfDoc') : worker.resumeUrl.endsWith('.docx') || worker.resumeUrl.endsWith('.doc') ? t('wp_wordDoc') : t('wp_doc')}
                  onPress={() => openDocument(worker.resumeUrl!, t('wp_resume'))}
                  isLast={!worker.labourLicenceUrl && (worker.certificates?.length ?? 0) === 0}
                />
              )}
              {!!worker.labourLicenceUrl && (
                <DocRow
                  icon="📋"
                  iconBg="#F0FDF4"
                  name={t('wp_labourLicence')}
                  meta={t('wp_officialLicence')}
                  onPress={() => openDocument(worker.labourLicenceUrl!, t('wp_labourLicence'))}
                  isLast={(worker.certificates?.length ?? 0) === 0}
                />
              )}
              {(worker.certificates ?? []).map((cert, i) => (
                <DocRow
                  key={i}
                  icon={cert.fileType === 'pdf' ? '📄' : '🎓'}
                  iconBg="#FFF7ED"
                  name={cert.name || t('wp_certificateN', { n: i + 1 })}
                  meta={cert.fileType ? `${cert.fileType.toUpperCase()} ${t('wp_certificateWord')}` : t('wp_skillCert')}
                  onPress={() => openDocument(cert.url, cert.name || t('wp_certificateN', { n: i + 1 }))}
                  isLast={i === (worker.certificates!.length - 1)}
                />
              ))}
            </Section>
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
                    <AppText style={[s.pipelineTxt, { color: m.color }]}>{t(m.labelKey)}</AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Invite to Requirement button — employer only, requires inviteEnabled plan feature */}
          {isEmployer && planFeat.inviteEnabled && (
            <TouchableOpacity
              onPress={() => setInviteVisible(true)}
              style={s.inviteBtn}
              activeOpacity={0.85}
            >
              <AppText style={s.inviteTxt}>{t('wp_inviteToMyReq')}</AppText>
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
            <Section title={t('wp_contactWorker')} accent={C.green}>
              {unlockedPhone ? (
                // ─ Unlocked (either via credit or free because already hired)
                <View style={s.unlockedBox}>
                  {/* Already-hired free badge */}
                  {alreadyHired && (
                    <View style={s.hiredBadge}>
                      <AppText style={s.hiredBadgeEmoji}>🤝</AppText>
                      <AppText style={s.hiredBadgeTxt}>
                        {t('wp_alreadyHiredFree')}
                      </AppText>
                    </View>
                  )}
                  <View style={s.phoneCard}>
                    <View style={s.phoneIconWrap}>
                      <AppText style={{ fontSize: 20 }}>📞</AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={s.phoneLabel}>{t('wp_phoneNumber')}</AppText>
                      <AppText style={s.phoneNum}>{unlockedPhone}</AppText>
                    </View>
                  </View>
                  <View style={s.contactBtns}>
                    <TouchableOpacity
                      onPress={() => void Linking.openURL(`tel:${unlockedPhone}`)}
                      style={s.callBtn}
                      activeOpacity={0.85}
                    >
                      <AppText style={s.callBtnTxt}>{t('wp_callNow')}</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => void Linking.openURL(`https://wa.me/91${unlockedPhone}`)}
                      style={s.waBtn}
                      activeOpacity={0.85}
                    >
                      <AppText style={s.waBtnTxt}>{t('wp_whatsapp')}</AppText>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (!isSubscribed && freeContactsRemaining > 0) ? (
                // ─ Gifted free contact — only for non-subscribed employers; a paying
                //   employer falls through to the paid-credit branch below.
                <View style={s.unlockBox}>
                  <View style={s.unlockHint}>
                    <AppText style={s.unlockHintTxt}>
                      {t('wp_freeContactHint') + ' · '}
                      <AppText style={[s.unlockHintTxt, { color: C.green, fontWeight: '800' }]}>
                        {t('wp_freeRemaining', { count: freeContactsRemaining })}
                      </AppText>
                    </AppText>
                  </View>
                  <TouchableOpacity
                    onPress={() => void handleUnlock()}
                    disabled={unlocking}
                    style={[s.viewContactBtn, { backgroundColor: C.green, opacity: unlocking ? 0.6 : 1 }]}
                    activeOpacity={0.85}
                  >
                    {unlocking
                      ? <ActivityIndicator color={C.white} size="small" />
                      : <AppText style={s.viewContactIcon}>{'🎁'}</AppText>}
                  </TouchableOpacity>
                </View>
              ) : isSubscribed ? (
                // ─ Active subscription — unlock costs 1 contact credit
                (() => {
                  const contacts = empProfile?.remainingContacts ?? 0;
                  const noContacts = contacts <= 0 && empProfileLoaded;
                  return (
                    <View style={s.unlockBox}>
                      <View style={s.unlockHint}>
                        <AppText style={s.unlockHintTxt}>
                          {t('wp_uses1Credit') + ' · '}
                          <AppText style={[s.unlockHintTxt, {
                            color: contacts <= 0 ? C.red : C.blue,
                            fontWeight: '800',
                          }]}>
                            {empProfileLoaded ? t('wp_remaining', { count: contacts }) : t('wp_loading')}
                          </AppText>
                        </AppText>
                      </View>
                      {noContacts ? (
                        /* ── No credits left — blocked state ── */
                        <View>
                          <View style={[s.viewContactBtn, { backgroundColor: '#F1F5F9', opacity: 0.6 }]}>
                            <AppText style={[s.viewContactIcon, { fontSize: 18 }]}>🔒</AppText>
                          </View>
                          <AppText style={{ fontSize: 10, color: C.red, textAlign: 'center', marginTop: 6, fontWeight: '700' }}>
                            {t('wp_noContactsRemaining')}{'\n'}{t('wp_topUpToUnlock')}
                          </AppText>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => void handleUnlock()}
                          disabled={unlocking || !empProfileLoaded}
                          style={[s.viewContactBtn, { opacity: (unlocking || !empProfileLoaded) ? 0.6 : 1 }]}
                          activeOpacity={0.85}
                        >
                          {unlocking
                            ? <ActivityIndicator color={C.white} size="small" />
                            : <AppText style={s.viewContactIcon}>{'📞'}</AppText>
                          }
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })()
              ) : (
                // ─ No subscription / expired
                <View style={s.lockBox}>
                  <View style={s.lockIconWrap}>
                    <AppText style={{ fontSize: 28 }}>
                      {empProfile?.isSubscribed ? '⏰' : '🔒'}
                    </AppText>
                  </View>
                  <AppText style={s.lockTitle}>
                    {empProfile?.isSubscribed ? t('wp_subExpired') : t('wp_noSub')}
                  </AppText>
                  <AppText style={[s.lockSub, { color: C.slate }]}>
                    {empProfile?.isSubscribed ? t('wp_expiredDesc') : t('wp_subDesc')}
                  </AppText>
                  <View style={s.lockBenefits}>
                    {[t('wp_benefit1'), t('wp_benefit2'), t('wp_benefit3')].map((b, i) => (
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
                      : <AppText style={s.hiredCheckTxt}>{t('wp_checkHired')}</AppText>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => navigation.navigate('Subscription')} style={s.subscribeBtn} activeOpacity={0.85}>
                    <AppText style={s.subscribeTxt}>
                      {empProfile?.isSubscribed ? t('wp_renewSub') : t('wp_viewPlans')}
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
  hero:        { alignItems: 'center', paddingBottom: 28, paddingHorizontal: 20, overflow: 'hidden', position: 'relative', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  heroDepth:   { ...StyleSheet.absoluteFillObject, backgroundColor: '#1037A4', opacity: 0.45 },
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
  // flexShrink:0 keeps each chip at its content width so the label is never
  // squeezed/clipped; chips wrap to the next line instead of compressing.
  skillChip:  { flexShrink: 0, backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#bfdbfe' },
  skillTxt:   { fontSize: 12, lineHeight: 18, fontWeight: '600', color: '#2563eb' },

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
  viewContactBtn:  { backgroundColor: '#0f172a', borderRadius: 14, paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  viewContactIcon: { fontSize: 26, lineHeight: 32 },

  // Hire Again

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
