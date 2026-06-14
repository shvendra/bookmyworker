import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Linking, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '../../../shared/components/ui/AppText';
import { workerApi, type RawAgent } from '../../../core/api/endpoints/workerApi';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import { buildPhotoUrl } from '../../../core/config/env';
import { useToast } from '../../../shared/state/toast/ToastContext';
import { getWorkTypeLabel } from '../../../shared/utils/labelUtils';
import { ageString } from '../../../shared/utils/ageUtils';
import { subcatDisplay } from '../../../shared/data/categoryLabels';

const PAGE_SIZE = 20;

// Punctuation-insensitive token so "Security & Facility Workers",
// "security_facility_workers", etc. all compare equal.
const norm = (s?: string): string =>
  String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

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
  workType?: string;    // requirement's parent category — used to fetch + filter
  titleLabel?: string;  // display label in the header
}

/**
 * Invite suggested workers (same category as the requirement) to a requirement.
 * Mirrors the CRM dialog: only workers whose areasOfWork matches the requirement
 * category, infinite auto-load, per-worker Invite. Uses the existing
 * requirementsApi.inviteWorker (by workerId); the backend enforces the plan gate.
 */
export const SuggestedWorkersModal = ({ visible, onClose, requirementId, workType, titleLabel }: Props): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { t: tCommon } = useTranslation(); // cat_* keys live in the default namespace
  const toast = useToast();

  // Translated category label for the header (falls back to the raw label).
  const headerLabel = workType ? getWorkTypeLabel(workType, tCommon) : (titleLabel || '');

  const [workers, setWorkers]         = useState<RawAgent[]>([]);
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(true);
  const [invitingId, setInvitingId]   = useState<string | null>(null);
  const [invitedIds, setInvitedIds]   = useState<string[]>([]);
  const [unlockedPhones, setUnlockedPhones] = useState<Record<string, string>>({});
  const [unlockingId, setUnlockingId]       = useState<string | null>(null);

  const reqToken = norm(workType);
  // Only workers whose areasOfWork (parent category) matches the requirement.
  const visibleWorkers = reqToken
    ? workers.filter((w) => (w.areasOfWork || []).some((a) => norm(a) === reqToken))
    : workers;

  const fetchPage = useCallback(async (pageNum: number) => {
    if (pageNum === 1) setLoading(true); else setLoadingMore(true);
    try {
      const res = await workerApi.getAllAgents({ workerType: workType || undefined, page: pageNum, limit: PAGE_SIZE });
      const batch = res?.rawAgents || [];
      setWorkers((prev) => (pageNum === 1 ? batch : [...prev, ...batch]));
      const total = res?.total;
      setHasMore(typeof total === 'number' ? pageNum * PAGE_SIZE < total : batch.length === PAGE_SIZE);
      setPage(pageNum);
    } catch {
      if (pageNum === 1) setWorkers([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [workType]);

  useEffect(() => {
    if (!visible) return;
    setInvitedIds([]);
    setUnlockedPhones({});
    setWorkers([]);
    setPage(1);
    setHasMore(true);
    void fetchPage(1);
  }, [visible, requirementId, fetchPage]);

  // Keep advancing pages automatically if the current page had no category match
  // (an empty list can't be scrolled to trigger onEndReached).
  useEffect(() => {
    if (visible && workers.length > 0 && visibleWorkers.length === 0 && hasMore && !loading && !loadingMore) {
      void fetchPage(page + 1);
    }
  }, [visible, workers, visibleWorkers.length, hasMore, loading, loadingMore, page, fetchPage]);

  const viewContact = async (w: RawAgent): Promise<void> => {
    if (!w._id || unlockingId || unlockedPhones[w._id]) return;
    setUnlockingId(w._id);
    try {
      const res = await workerApi.unlockNumber(w._id);
      if (res.phone) {
        setUnlockedPhones((prev) => ({ ...prev, [w._id]: res.phone! }));
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
              onEndReachedThreshold={0.4}
              onEndReached={() => { if (hasMore && !loadingMore && !loading) void fetchPage(page + 1); }}
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
                        <TouchableOpacity onPress={() => void Linking.openURL(`tel:${unlockedPhones[w._id]}`)} style={s.phoneBtn} activeOpacity={0.8}>
                          <AppText style={s.phoneTxt} numberOfLines={1}>📞 {unlockedPhones[w._id]}</AppText>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => void viewContact(w)}
                          disabled={!!unlockingId}
                          style={[s.contactBtn, !!unlockingId && { opacity: 0.5 }]}
                          activeOpacity={0.85}
                        >
                          {unlockingId === w._id
                            ? <ActivityIndicator color="#2243BC" size="small" />
                            : <AppText style={s.contactTxt} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('sw_viewContact')}</AppText>}
                        </TouchableOpacity>
                      )}
                      {invited ? (
                        <View style={s.invitedChip}><AppText style={s.invitedTxt}>✓ {t('wp_invited')}</AppText></View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => void invite(w)}
                          disabled={!!invitingId}
                          style={[s.inviteBtn, !!invitingId && { opacity: 0.5 }]}
                          activeOpacity={0.85}
                        >
                          {inviting
                            ? <ActivityIndicator color="#FFFFFF" size="small" />
                            : <AppText style={s.inviteTxt} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('sw_invite')}</AppText>}
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
  sheet:         { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '82%', overflow: 'hidden' },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#1037A4' },
  headerTitle:   { fontSize: 16, fontWeight: '800', color: '#fff' },
  headerSub:     { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  closeBtn:      { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  center:        { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyBox:      { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24, gap: 4 },
  emptyTitle:    { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  list:          { maxHeight: 460 },
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
  invitedChip:   { alignSelf: 'stretch', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', minWidth: 112, alignItems: 'center' },
  invitedTxt:    { fontSize: 12, fontWeight: '800', color: '#15803D' },
  inviteBtn:     { alignSelf: 'stretch', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: '#2243BC', backgroundColor: '#2243BC', minWidth: 112, alignItems: 'center' },
  inviteTxt:     { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  contactBtn:    { alignSelf: 'stretch', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: '#E1E8FD', backgroundColor: '#EEF2FE', minWidth: 112, alignItems: 'center' },
  contactTxt:    { fontSize: 13, fontWeight: '800', color: '#2243BC' },
  phoneBtn:      { alignSelf: 'stretch', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', minWidth: 108, alignItems: 'center' },
  phoneTxt:      { fontSize: 12, fontWeight: '800', color: '#15803D' },
});

export default SuggestedWorkersModal;
