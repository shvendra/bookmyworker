import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Linking, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppText } from '../../../shared/components/ui/AppText';
import { workerApi, type RawAgent } from '../../../core/api/endpoints/workerApi';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import { buildPhotoUrl } from '../../../core/config/env';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { getWorkTypeLabel } from '../../../shared/utils/labelUtils';
import { ageString } from '../../../shared/utils/ageUtils';
import { subcatDisplay } from '../../../shared/data/categoryLabels';

// Birth year / legacy age / full date string / timestamp → current age string.
const getAge = (dob?: string | number): string => ageString(dob);

// Merge areasOfWork (category) + categories (sub-skills), translate each to the
// active language (subcatDisplay handles category + sub-category labels), de-dupe, cap 2.
const skillText = (w: RawAgent): string => {
  const seen = new Set<string>();
  return [...(w.areasOfWork || []), ...(w.categories || [])]
    .map((a) => String(a || '').replace(/_/g, ' ').trim())
    .filter(Boolean)
    .map((a) => subcatDisplay(a))
    .filter(Boolean)
    .filter((v) => (seen.has(v) ? false : (seen.add(v), true)))
    .slice(0, 3)
    .join(', ');
};

interface Props {
  visible: boolean;
  onClose: () => void;
  requirementId: string;
  workType?: string;    // requirement's parent category — drives the smart match
  reqState?: string;    // requirement location — improves match ranking
  reqDistrict?: string;
  titleLabel?: string;  // display label in the header
}

/**
 * Invite suggested workers to a requirement. The list is the AI Smart Match
 * result for this requirement (ranked best-fit) — same logic as the CRM dialog.
 * Uses requirementsApi.inviteWorker (by workerId); the backend enforces the plan gate.
 */
export const SuggestedWorkersModal = ({ visible, onClose, requirementId, workType, reqState, reqDistrict, titleLabel }: Props): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { t: tCommon } = useTranslation(); // cat_* keys live in the default namespace
  const toast = useToast();

  // Translated category label for the header (falls back to the raw label).
  const headerLabel = workType ? getWorkTypeLabel(workType, tCommon) : (titleLabel || '');

  const [workers, setWorkers]         = useState<RawAgent[]>([]);
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(true);
  const [invitingId, setInvitingId]   = useState<string | null>(null);
  const [invitedIds, setInvitedIds]   = useState<string[]>([]);
  const [unlockedPhones, setUnlockedPhones] = useState<Record<string, string>>({});
  // Worker's optional secondary number per worker, revealed by the SAME unlock.
  const [unlockedAlternates, setUnlockedAlternates] = useState<Record<string, string>>({});
  const [unlockingId, setUnlockingId]       = useState<string | null>(null);

  // Smart Match already returns workers ranked + scoped to the requirement's
  // category, so the whole result set is shown (no extra client-side filter).
  const visibleWorkers = workers;

  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workerApi.smartMatch({
        category: workType || undefined,
        state: reqState || undefined,
        district: reqDistrict || undefined,
        limit: 30,
        backups: 0,
      });
      const matches: RawAgent[] = (res?.matches || []).map((m) => ({
        _id: m.workerId,
        name: m.name,
        phone: '',
        profilePhoto: m.photo,
        gender: m.gender,
        district: m.district,
        state: m.state,
        categories: m.categories || [],
        areasOfWork: [],
        veryfiedBage: m.verified,
      }) as RawAgent);
      setWorkers(matches);
    } catch {
      setWorkers([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setHasMore(false); // smart match returns a complete ranked set
    }
  }, [workType, reqState, reqDistrict]);

  useEffect(() => {
    if (!visible) return;
    setInvitedIds([]);
    setUnlockedPhones({});
    setUnlockedAlternates({});
    setWorkers([]);
    setHasMore(false);
    void fetchPage();
  }, [visible, requirementId, fetchPage]);

  const viewContact = async (w: RawAgent): Promise<void> => {
    if (!w._id || unlockingId || unlockedPhones[w._id]) return;
    setUnlockingId(w._id);
    try {
      const res = await workerApi.unlockNumber(w._id);
      if (res.phone) {
        setUnlockedPhones((prev) => ({ ...prev, [w._id]: res.phone! }));
        if (res.alternate) setUnlockedAlternates((prev) => ({ ...prev, [w._id]: res.alternate! }));
        toast.success(
          res.alreadyHired ? t('wp_toastAlreadyHired') : t('wp_toastUnlocked'),
          res.alreadyHired ? t('wp_alreadyHiredTitle') : t('wp_unlockedTitle'),
        );
      } else {
        toast.error(res.message ?? t('wp_unlockFailDefault'), t('wp_unlockFailTitle'));
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; code?: string } }; message?: string };
      const code = e?.response?.data?.code;
      const msg  = e?.response?.data?.message ?? e?.message;
      if (code === 'SUBSCRIPTION_EXPIRED') toast.warning(t('wp_toastExpired'), t('wp_expiredTitle'));
      else if (code === 'SUBSCRIPTION_REQUIRED') toast.error(t('wp_toastSubscribe'), t('wp_subscribeTitle'));
      else if (code === 'CONTACT_LIMIT') toast.warning(t('wp_toastLimit'), t('wp_limitTitle'));
      else toast.error(msg ?? t('wp_toastUnlockFail'), t('wp_errorTitle'));
    } finally {
      setUnlockingId(null);
    }
  };

  const invite = async (w: RawAgent): Promise<void> => {
    if (!w._id || invitingId) return;
    setInvitingId(w._id);
    try {
      await requirementsApi.inviteWorker(requirementId, { workerId: w._id, workerName: w.name || 'Worker', workerPhone: w.phone });
      setInvitedIds((prev) => [...prev, w._id]);
      toast.success(t('wp_toastInviteSent', { name: w.name || '' }), t('wp_invited'));
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || t('wp_toastInviteFail'));
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText style={s.headerTitle} numberOfLines={2}>{t('wp_inviteTitle')}</AppText>
              {!!headerLabel && <AppText style={s.headerSub} numberOfLines={2}>{headerLabel}</AppText>}
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <AppText style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18, fontWeight: '700' }}>✕</AppText>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={s.center}><ActivityIndicator color="#2243BC" /></View>
          ) : visibleWorkers.length === 0 && !hasMore ? (
            <View style={s.emptyBox}>
              <AppText style={{ fontSize: 30, marginBottom: 8 }}>🧑‍🔧</AppText>
              <AppText style={s.emptyTitle}>{t('sw_noMatch')}</AppText>
            </View>
          ) : (
            <FlatList
              data={visibleWorkers}
              keyExtractor={(w) => w._id}
              style={s.list}
              ListFooterComponent={loadingMore ? <View style={{ paddingVertical: 14 }}><ActivityIndicator color="#2243BC" size="small" /></View> : null}
              renderItem={({ item: w }) => {
                const invited  = invitedIds.includes(w._id);
                const inviting = invitingId === w._id;
                const photo    = buildPhotoUrl(w.profilePhoto);
                const age      = getAge(w.dob);
                const loc      = [w.district, w.state].filter(Boolean).join(', ');
                return (
                  <View style={s.row}>
                    {photo ? (
                      <Image source={{ uri: photo }} style={s.avatar} />
                    ) : (
                      <View style={[s.avatar, s.avatarFallback]}>
                        <AppText style={s.avatarTxt}>{(w.name || 'W').trim().charAt(0).toUpperCase()}</AppText>
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText style={s.name} numberOfLines={1}>{w.name || 'Worker'}</AppText>
                      {!!skillText(w) && <AppText style={s.skills} numberOfLines={3}>{skillText(w)}</AppText>}
                      {!![age ? `${age} ${t('wp_yrs')}` : '', w.gender].filter(Boolean).length && (
                        <AppText style={s.meta} numberOfLines={1}>
                          {[age ? `${age} ${t('wp_yrs')}` : '', w.gender].filter(Boolean).join(' • ')}
                        </AppText>
                      )}
                      {!!loc && <AppText style={s.loc} numberOfLines={2}>📍 {loc}</AppText>}
                    </View>
                    <View style={s.actions}>
                      {unlockedPhones[w._id] ? (
                        <View style={{ gap: 6 }}>
                          <TouchableOpacity onPress={() => void Linking.openURL(`tel:${unlockedPhones[w._id]}`)} style={s.phoneBtn} activeOpacity={0.8}>
                            <AppText style={s.phoneTxt} numberOfLines={1}>📞 {unlockedPhones[w._id]}</AppText>
                          </TouchableOpacity>
                          {unlockedAlternates[w._id] ? (
                            <TouchableOpacity onPress={() => void Linking.openURL(`tel:${unlockedAlternates[w._id]}`)} style={s.phoneBtn} activeOpacity={0.8}>
                              <AppText style={s.phoneTxt} numberOfLines={1}>📲 {unlockedAlternates[w._id]}</AppText>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => void viewContact(w)}
                          disabled={!!unlockingId}
                          style={[s.contactIconBtn, !!unlockingId && { opacity: 0.5 }]}
                          activeOpacity={0.85}
                          accessibilityLabel={t('sw_viewContact')}
                        >
                          {unlockingId === w._id
                            ? <ActivityIndicator color="#2243BC" size="small" />
                            : <AppText style={s.contactIcon}>📞</AppText>}
                        </TouchableOpacity>
                      )}
                      {invited ? (
                        <View style={s.invitedChip} accessibilityLabel={t('wp_invited')}>
                          <Ionicons name="checkmark-done" size={20} color="#15803D" />
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => void invite(w)}
                          disabled={!!invitingId}
                          style={[s.inviteBtn, !!invitingId && { opacity: 0.5 }]}
                          activeOpacity={0.85}
                          accessibilityLabel={t('sw_invite')}
                        >
                          {inviting
                            ? <ActivityIndicator color="#FFFFFF" size="small" />
                            : <Ionicons name="person-add" size={19} color="#FFFFFF" />}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet:         { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, height: '92%', overflow: 'hidden' },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#1037A4' },
  headerTitle:   { fontSize: 16, fontWeight: '800', color: '#fff' },
  headerSub:     { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  closeBtn:      { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  center:        { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyBox:      { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24, gap: 4 },
  emptyTitle:    { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  list:          { flex: 1 },
  row:           { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f1f5f9' },
  avatar:        { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FE' },
  avatarFallback:{ alignItems: 'center', justifyContent: 'center' },
  avatarTxt:     { fontSize: 16, fontWeight: '800', color: '#2243BC' },
  name:          { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  skills:        { fontSize: 12, fontWeight: '600', color: '#475569', marginTop: 2, lineHeight: 17 },
  meta:          { fontSize: 11.5, color: '#64748b', marginTop: 2 },
  loc:           { fontSize: 11.5, color: '#94a3b8', marginTop: 2 },
  // alignSelf 'stretch' makes every action button share the column's widest
  // width, so the wider Hindi/Indic "View Contact" label sets the size and both
  // buttons stay aligned and fully readable across languages.
  actions:       { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  // Compact icon buttons (peer to the phone/contact icon button) — invite shows
  // a person-add icon, the invited state a green check, instead of text.
  invitedChip:   { width: 44, height: 40, borderRadius: 10, backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: '#BBF7D0', alignItems: 'center', justifyContent: 'center' },
  inviteBtn:     { width: 44, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: '#2243BC', backgroundColor: '#2243BC', alignItems: 'center', justifyContent: 'center' },
  contactIconBtn:{ width: 44, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: '#E1E8FD', backgroundColor: '#EEF2FE', alignItems: 'center', justifyContent: 'center' },
  contactIcon:   { fontSize: 18 },
  phoneBtn:      { alignSelf: 'stretch', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', minWidth: 108, alignItems: 'center' },
  phoneTxt:      { fontSize: 12, fontWeight: '800', color: '#15803D' },
});

export default SuggestedWorkersModal;
