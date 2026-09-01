import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import type { RawAgent } from '../../../core/api/endpoints/workerApi';
import { buildPhotoUrl } from '../../../core/config/env';
import i18n from '../../../core/i18n';
import { getLocationStr } from '../../../shared/utils/labelUtils';
import {
  BRAND, WHITE, GREEN, GREEN_SOFT, AMBER, SLATE_LT,
  CALL_OUTCOMES, getOutcomeColor,
  timeAgoDate, formatName, getAge,
  cleanSkills, getMatchedAreasOfWork, isNewWorker,
  metaDisplay, subcatDisplay,
} from './workerSearchShared';

// Gender-based placeholder avatars — shown only when a worker has not
// uploaded a real photo.
const AVATAR_FEMALE = require('../../../../assets/avatar-female.png');
const AVATAR_MALE = require('../../../../assets/avatar-male.png');

// ─── Call Outcome Picker ──────────────────────────────────────────────────────
export const CallOutcomePicker = ({
  agentId,
  current,
  onSave,
  saving,
  remarkTime,
  name,
  initials,
  accentColor,
  openSignal = 0,
}: {
  agentId: string;
  current: string;
  onSave: (id: string, val: string) => void;
  saving: boolean;
  remarkTime?: Date;
  name?: string;
  initials?: string;
  accentColor?: string;
  /** Bump this (e.g. Date.now()) to auto-open the picker from outside — used by
   *  the post-call "did it connect?" prompt when the user says yes. */
  openSignal?: number;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (openSignal > 0) setShow(true);
  }, [openSignal]);
  const outcome = CALL_OUTCOMES.find((o) => o.value === current);
  const label = outcome ? t(outcome.labelKey) : undefined;
  const hasOutcome = !!current;
  const oc = getOutcomeColor(current);

  return (
    <>
      <TouchableOpacity
        onPress={() => setShow(true)}
        disabled={saving}
        activeOpacity={0.8}
        style={[co.btn, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.card }]}
      >
        <View style={[co.dot, { backgroundColor: hasOutcome ? oc.dot : theme.colors.mutedText }]} />
        <AppText style={[co.btnText, { color: hasOutcome ? oc.color : theme.colors.mutedText }]} numberOfLines={2}>
          {saving ? t('ws_saving') : (label ?? t('ws_log_call_outcome'))}
        </AppText>
        {hasOutcome && remarkTime && (
          <AppText style={[co.remarkTime, { color: theme.colors.mutedText }]}>{timeAgoDate(remarkTime, t)}</AppText>
        )}
        <AppText style={[co.chevron, { color: theme.colors.mutedText }]}>›</AppText>
      </TouchableOpacity>

      <Modal
        visible={show}
        transparent
        animationType="slide"
        onRequestClose={() => setShow(false)}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => setShow(false)} style={co.scrim}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={[co.sheet, { backgroundColor: theme.colors.card, paddingBottom: insets.bottom + 18 }]}>
            <View style={[co.grab, { backgroundColor: theme.colors.border }]} />

            {/* Header: avatar + name + sub + close */}
            <View style={co.oh}>
              <View style={[co.oav, { backgroundColor: accentColor ?? BRAND }]}>
                <AppText style={co.oavTxt}>{initials ?? '?'}</AppText>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText style={[co.ot, { color: theme.colors.text }]} numberOfLines={2}>{name ?? t('ws_call_outcome')}</AppText>
                <AppText style={[co.os, { color: theme.colors.mutedText }]} numberOfLines={2}>{t('ws_log_this_call')}</AppText>
              </View>
              <TouchableOpacity onPress={() => setShow(false)} style={[co.ox, { backgroundColor: theme.colors.surface1 }]} activeOpacity={0.7}>
                <Ionicons name="close" size={17} color={theme.colors.mutedText} />
              </TouchableOpacity>
            </View>

            {/* Options */}
            <ScrollView style={co.olist} contentContainerStyle={co.olistContent} showsVerticalScrollIndicator={false}>
              {CALL_OUTCOMES.map((item) => {
                const active = current === item.value;
                const c = getOutcomeColor(item.value);
                return (
                  <TouchableOpacity
                    key={item.value}
                    onPress={() => { onSave(agentId, item.value); setShow(false); }}
                    activeOpacity={0.8}
                    style={[co.oopt, { borderColor: active ? c.dot : theme.colors.border, backgroundColor: active ? c.dot + '0F' : theme.colors.card }]}
                  >
                    <View style={[co.od, { backgroundColor: c.dot }]} />
                    <AppText style={[co.ol, { color: theme.colors.text }]} numberOfLines={2}>{t(item.labelKey)}</AppText>
                    {active && <Ionicons name="checkmark" size={18} color={c.dot} style={co.ock} />}
                  </TouchableOpacity>
                );
              })}

              {/* Clear outcome */}
              {hasOutcome && (
                <TouchableOpacity
                  onPress={() => { onSave(agentId, ''); setShow(false); }}
                  activeOpacity={0.8}
                  style={[co.oopt, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}
                >
                  <View style={[co.od, { backgroundColor: '#CBD2DE' }]} />
                  <AppText style={[co.ol, { color: theme.colors.mutedText }]}>{t('ws_clear_outcome')}</AppText>
                </TouchableOpacity>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
};
const co = StyleSheet.create({
  btn:         { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, minHeight: 50, paddingVertical: 8, gap: 9 },
  dot:         { width: 8, height: 8, borderRadius: 4 },
  btnText:     { flex: 1, fontSize: 14, fontWeight: '800' },
  remarkTime:  { fontSize: 12, fontWeight: '700' },
  chevron:     { fontSize: 18, fontWeight: '400' },
  // Bottom sheet (Figma)
  scrim:       { flex: 1, backgroundColor: 'rgba(12,20,46,0.5)', justifyContent: 'flex-end' },
  sheet:       { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10, maxHeight: '85%' },
  grab:        { width: 42, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 4, marginBottom: 16 },
  oh:          { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 4 },
  oav:         { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  oavTxt:      { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  ot:          { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  os:          { fontSize: 12.5, fontWeight: '600', marginTop: 1 },
  ox:          { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  olist:       { marginTop: 14, flexGrow: 0 },
  olistContent:{ gap: 9, paddingBottom: 8 },
  oopt:        { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.6, borderRadius: 14, padding: 14 },
  od:          { width: 11, height: 11, borderRadius: 6 },
  ol:          { flex: 1, fontSize: 14.5, fontWeight: '800' },
  ock:         { marginLeft: 'auto' },
});

// ─── Worker Card ──────────────────────────────────────────────────────────────
export interface AgentCardProps {
  agent: RawAgent;
  isSubscribed: boolean;
  isContactsExhausted: boolean;
  unlockedPhone?: string;
  unlockedAlternate?: string;
  loadingUnlock: boolean;
  callStatus: string;
  savingRemark: boolean;
  remarkTime?: Date;
  workerTypeApplied: string;
  appliedDistrict: string;
  onViewContact: (id: string) => void;
  onSubscribe: () => void;
  onTopup: () => void;
  onSaveRemark: (id: string, status: string) => void;
  onPress: (id: string) => void;
  /** Place a call AND arm the "did it connect?" return prompt. */
  onDialCall: (w: { id: string; name: string; phone: string }) => void;
  /** Non-zero → auto-open this card's call-outcome picker (after "yes, we talked"). */
  outcomeOpenSignal: number;
}

export const AgentCard = React.memo(({
  agent,
  isSubscribed,
  isContactsExhausted,
  unlockedPhone,
  unlockedAlternate,
  loadingUnlock,
  callStatus,
  savingRemark,
  remarkTime,
  workerTypeApplied,
  appliedDistrict,
  onViewContact,
  onSubscribe,
  onTopup,
  onSaveRemark,
  onPress,
  onDialCall,
  outcomeOpenSignal,
}: AgentCardProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const photoUrl  = buildPhotoUrl(agent.profilePhoto);
  // If the profile photo fails to load (broken/missing URL), fall back to the
  // gender avatar instead of showing a broken-image icon.
  const [photoFailed, setPhotoFailed] = useState(false);
  // Only reveal the real photo once it has ACTUALLY loaded — a broken/slow URL
  // then stays hidden and the gender avatar (rendered underneath) shows instead,
  // so the card never displays a broken-image box.
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const initials  = formatName(agent.name ?? '?')
    .split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  const isAgent      = String(agent.role ?? '').toLowerCase() === 'agent';
  // Show both work categories (areasOfWork) and sub-skills (categories).
  const matchedAreas = cleanSkills(getMatchedAreasOfWork([...(agent.areasOfWork ?? []), ...(agent.categories ?? [])], workerTypeApplied));
  const age          = getAge(agent.dob);
  const exp          = agent.workExperience !== undefined
    ? Number(agent.workExperience) > 0 ? Number(agent.workExperience) : 3
    : undefined;
  const accentColor  = isAgent ? theme.colors.secondary : theme.colors.primary;
  const accentBg     = isAgent ? theme.colors.secondaryLight : theme.colors.primaryLight;
  const locationStr  = getLocationStr(
    { district: appliedDistrict || agent.district, state: agent.state },
    i18n.language, '',
  );
  const wage    = agent.fixedSalary ?? agent.salaryFrom;
  const wageText = wage
    ? t('ws_wage_per_day', {
        amount: `₹${wage}${agent.salaryTo && agent.salaryTo !== wage ? `–${agent.salaryTo}` : ''}`,
      })
    : null;

  // "Active N days ago" chip — hidden when this number was tagged wrong/invalid.
  // Green within 20 days, grey beyond. lastSeenAt updates on every authenticated
  // request, so self-login workers stay accurate.
  const lastActive = (() => {
    if (callStatus === 'wrong_number' || callStatus === 'invalid_number') return null;
    if (!agent.lastSeenAt) return null;
    const d = new Date(agent.lastSeenAt);
    if (Number.isNaN(d.getTime())) return null;
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    return {
      text: t('ws_active_prefix', { time: timeAgoDate(d, t) }),
      color: days <= 20 ? '#16a34a' : theme.colors.mutedText,
    };
  })();

  // Bind this card's id to the (stable) parent callbacks so the row can stay
  // memoized — these only change if the parent callback or the id changes.
  const handleCardPress = useCallback(() => onPress(agent._id), [onPress, agent._id]);
  const handleUnlock = useCallback(() => onViewContact(agent._id), [onViewContact, agent._id]);

  return (
    <View style={[wc.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>

      {/* ── Main info row (tappable) ── */}
      <TouchableOpacity onPress={handleCardPress} activeOpacity={0.88} style={wc.infoRow}>
        {/* Avatar — gender avatar is the always-present base; the real photo is
            overlaid on top and only made visible once it has truly loaded. */}
        <View style={wc.avatarWrap}>
          <Image
            source={String(agent.gender ?? '').trim().toLowerCase() === 'female' ? AVATAR_FEMALE : AVATAR_MALE}
            style={[wc.avatar, { borderColor: accentColor }]}
          />
          {photoUrl && !photoFailed && (
            <ExpoImage
              source={{ uri: photoUrl }}
              onLoad={() => setPhotoLoaded(true)}
              onError={() => setPhotoFailed(true)}
              contentFit="cover"
              cachePolicy="memory-disk"
              style={[wc.avatar, { borderColor: accentColor, position: 'absolute', top: 0, left: 0, opacity: photoLoaded ? 1 : 0 }]}
            />
          )}
          <View style={[wc.presDot, { backgroundColor: agent.veryfiedBage ? GREEN : AMBER, borderColor: theme.colors.card }]} />

        </View>

        {/* Text block */}
        <View style={{ flex: 1 }}>
          <View style={wc.nameRow}>
            <AppText style={[wc.name, { color: theme.colors.text }]} numberOfLines={1}>
              {agent.name ? formatName(agent.name) : t('ws_unknown')}
            </AppText>
            <View style={[wc.rolePill, { backgroundColor: accentBg, borderColor: accentColor + '40' }]}>
              <AppText style={[wc.roleTxt, { color: accentColor }]} numberOfLines={1}>
                {isAgent ? t('ws_role_agent') : t('ws_role_worker')}
              </AppText>
            </View>
            {isNewWorker(agent.createdAt) && (
              <View style={wc.newBadge}>
                <AppText style={wc.newBadgeTxt} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                  <Ionicons name="sparkles" size={10} color="#FFFFFF" />{' '}{t('ws_newWorker')}
                </AppText>
              </View>
            )}
          </View>

          {!!locationStr && (
            <AppText style={[wc.location, { color: theme.colors.mutedText }]} numberOfLines={2}><Ionicons name="location-sharp" size={11} color={theme.colors.mutedText} />{' '}{locationStr}</AppText>
          )}

          <View style={wc.metaRow}>
            {!!age && <View style={[wc.metaChip, { backgroundColor: theme.colors.surface1 }]}><AppText style={[wc.metaChipTxt, { color: theme.colors.mutedText }]}>{t('ws_meta_age', { age })}</AppText></View>}
            {exp !== undefined && <View style={[wc.metaChip, { backgroundColor: theme.colors.surface1 }]}><AppText style={[wc.metaChipTxt, { color: theme.colors.mutedText }]}>{t('ws_meta_exp', { years: exp })}</AppText></View>}
            {!!agent.gender && <View style={[wc.metaChip, { backgroundColor: theme.colors.surface1 }]}><AppText style={[wc.metaChipTxt, { color: theme.colors.mutedText }]}>{metaDisplay(agent.gender)}</AppText></View>}
            {!!wageText && <View style={[wc.metaChip, wc.wageChip]}><AppText style={[wc.metaChipTxt, wc.wageTxt]}>{wageText}</AppText></View>}
            {lastActive && (
              <View style={[wc.metaChip, { backgroundColor: theme.colors.surface1, flexDirection: 'row', alignItems: 'center' }]}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: lastActive.color, marginRight: 5 }} />
                <AppText style={[wc.metaChipTxt, { color: lastActive.color, fontWeight: '700' }]} numberOfLines={1}>{lastActive.text}</AppText>
              </View>
            )}
          </View>

          {!!(agent.workerSubType || agent.agentType) && (
            <View style={[wc.subTypeBadge, { backgroundColor: theme.colors.warningLight, borderColor: theme.colors.warning + '50' }]}>
              <AppText style={[wc.subTypeTxt, { color: theme.colors.warning }]}>{metaDisplay(agent.workerSubType ?? agent.agentType)}</AppText>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* ── Last-contact row (only when a call outcome exists) ── */}
      {!!callStatus && (
        <View style={[wc.availRow, { borderTopColor: theme.colors.border }]}>
          <View style={wc.availDot} />
          <AppText style={[wc.lastContactTxt, { color: theme.colors.mutedText }]}>
            {t('ws_last_contact', { time: remarkTime ? timeAgoDate(remarkTime, t) : t('ws_recently') })}
          </AppText>
        </View>
      )}

      {/* ── Skills chips ── */}
      {matchedAreas.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[wc.skillsStrip, { borderTopColor: theme.colors.border }]}
          contentContainerStyle={wc.skillsContent}
        >
          {matchedAreas.map((area, idx) => (
            <View key={`${area}-${idx}`} style={[wc.skillChip, { backgroundColor: '#F6F8FE', borderColor: '#E1E8FD' }]}>
              <Ionicons name="construct" size={11} color="#2243BC" style={wc.skillChipIcon} />
              {/* No numberOfLines: chips live in a horizontal ScrollView, so the
                  full work-type label must render on one line (Android ellipsizes
                  numberOfLines text against the viewport width otherwise). */}
              <AppText style={[wc.skillChipTxt, { color: '#2243BC' }]}>
                {subcatDisplay(area)}
              </AppText>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Documents row (Resume + Labour Licence) — tap chip navigates to profile where docs are viewable */}
      {(!!agent.resumeUrl || !!agent.labourLicenceUrl) && (
        <View style={[wc.docsRow, { borderTopColor: theme.colors.border }]}>
          {!!agent.resumeUrl && (
            <TouchableOpacity onPress={handleCardPress} style={[wc.docChip, { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary + '50' }]} activeOpacity={0.8}>
              <Ionicons name="document-text" size={13} color={theme.colors.primary} style={wc.resumeIcon} />
              <AppText style={[wc.docChipTxt, { color: theme.colors.primary }]}>{t('ws_resume')}</AppText>
            </TouchableOpacity>
          )}
          {!!agent.labourLicenceUrl && (
            <TouchableOpacity onPress={handleCardPress} style={[wc.docChip, { backgroundColor: theme.colors.successLight, borderColor: theme.colors.success + '60' }]} activeOpacity={0.8}>
              <Ionicons name="document-attach" size={13} color={theme.colors.success} style={wc.resumeIcon} />
              <AppText style={[wc.docChipTxt, { color: theme.colors.success }]}>{t('ws_licence')}</AppText>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Call Agent CTA ── */}
      <View style={[wc.ctaSection, { borderTopColor: theme.colors.border }]}>
        {unlockedPhone ? (
          <>
            <View style={wc.unlockedRow}>
              <TouchableOpacity
                onPress={() => onDialCall({ id: agent._id, name: agent.name ?? '', phone: unlockedPhone })}
                style={[wc.callBtn, { backgroundColor: BRAND }]}
                activeOpacity={0.85}
              >
                <AppText style={wc.callBtnTxt}><Ionicons name="call" size={13} color={WHITE} />{' '}{unlockedPhone}</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void Linking.openURL(`https://wa.me/91${unlockedPhone}`)}
                style={wc.waBtn}
                activeOpacity={0.85}
              >
                <AppText style={wc.waBtnTxt}>WhatsApp</AppText>
              </TouchableOpacity>
            </View>
            {/* Alternate number — same unlock, only when the worker has one. */}
            {unlockedAlternate ? (
              <View style={[wc.unlockedRow, { marginTop: 8 }]}>
                <TouchableOpacity
                  onPress={() => onDialCall({ id: agent._id, name: agent.name ?? '', phone: unlockedAlternate })}
                  style={[wc.callBtn, { backgroundColor: '#0f766e' }]}
                  activeOpacity={0.85}
                >
                  <AppText style={wc.callBtnTxt}><Ionicons name="call" size={13} color={WHITE} />{' '}{t('ws_alt_prefix')} {unlockedAlternate}</AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void Linking.openURL(`https://wa.me/91${unlockedAlternate}`)}
                  style={wc.waBtn}
                  activeOpacity={0.85}
                >
                  <AppText style={wc.waBtnTxt}>WhatsApp</AppText>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        ) : isContactsExhausted ? (
          <TouchableOpacity onPress={onTopup} activeOpacity={0.82} style={[wc.topupCta, { backgroundColor: theme.colors.warningLight, borderColor: theme.colors.warning + '40' }]}>
            <View style={[wc.lockIconBox, { backgroundColor: theme.colors.accentLight }]}>
              <Ionicons name="warning" size={16} color={theme.colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={[wc.topupTitle, { color: theme.colors.warningDark }]}>{t('ws_contact_limit_reached')}</AppText>
              <AppText style={[wc.topupSub, { color: theme.colors.mutedText }]}>{t('ws_upgrade_to_unlock')}</AppText>
            </View>
            <AppText style={wc.lockChevron}>›</AppText>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={isSubscribed ? handleUnlock : onSubscribe}
            disabled={loadingUnlock}
            style={[wc.callAgentBtn, { opacity: loadingUnlock ? 0.7 : 1 }]}
            activeOpacity={0.85}
          >
            {loadingUnlock ? (
              <ActivityIndicator size="small" color={WHITE} />
            ) : (
              <>
                <Ionicons name="call" size={16} color={WHITE} style={wc.callAgentIcon} />
                <AppText style={wc.callAgentTxt}>{isAgent ? t('ws_call_agent') : t('ws_call_worker')}</AppText>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Log Call Outcome ── */}
      {isSubscribed && (
        <CallOutcomePicker
          agentId={agent._id}
          current={callStatus}
          onSave={onSaveRemark}
          saving={savingRemark}
          remarkTime={remarkTime}
          name={agent.name ? formatName(agent.name) : t('ws_unknown')}
          initials={initials}
          accentColor={accentColor}
          openSignal={outcomeOpenSignal}
        />
      )}

      {/* Agent group banner */}
      {isAgent && (
        <View style={[wc.agentBanner, { borderTopColor: theme.colors.secondary + '50', backgroundColor: theme.colors.secondaryLight }]}>
          <AppText style={{ fontSize: 13 }}>👥</AppText>
          <AppText style={[wc.agentBannerTxt, { color: theme.colors.secondary }]}>{t('ws_agent_banner')}</AppText>
        </View>
      )}
    </View>
  );
});
AgentCard.displayName = 'AgentCard';

const wc = StyleSheet.create({
  card:           { borderRadius: 20, marginBottom: 14, overflow: 'hidden', elevation: 2, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 16, borderWidth: StyleSheet.hairlineWidth },

  infoRow:        { flexDirection: 'row', padding: 11, gap: 10 },

  avatarWrap:     { position: 'relative', alignSelf: 'flex-start' },
  avatar:         { width: 52, height: 52, borderRadius: 26, borderWidth: 2.5 },
  avatarFallback: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
  initials:       { fontSize: 18, fontWeight: '800' },
  presDot:        { position: 'absolute', right: -1, bottom: -1, width: 13, height: 13, borderRadius: 6.5, borderWidth: 2.5 },

  nameRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  name:           { fontSize: 16.5, fontWeight: '800', flex: 1, letterSpacing: -0.2 },
  rolePill:       { borderWidth: 1, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  roleTxt:        { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  newBadge:       { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#059669', flexShrink: 0,
                    shadowColor: '#059669', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 3 },
  newBadgeTxt:    { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, color: '#FFFFFF' },
  location:       { fontSize: 11, marginBottom: 5 },
  metaRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  metaChip:       { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexShrink: 0 },
  metaChipTxt:    { fontSize: 12, fontWeight: '600', lineHeight: 17 },
  wageChip:       { backgroundColor: GREEN_SOFT },
  wageTxt:        { color: GREEN, fontWeight: '800' },

  subTypeBadge:   { marginTop: 4, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  subTypeTxt:     { fontSize: 9.5, fontWeight: '700' },

  // Availability row
  availRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth },
  availDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN, marginRight: 6 },
  availTxt:       { fontSize: 12, fontWeight: '600', color: GREEN },
  availSep:       { fontSize: 12 },
  lastContactTxt: { fontSize: 12 },

  // Skills
  skillsStrip:    { borderTopWidth: StyleSheet.hairlineWidth },
  skillsContent:  { paddingHorizontal: 12, paddingVertical: 9, gap: 7, flexDirection: 'row' },
  skillChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, flexShrink: 0 },
  skillChipIcon:  { fontSize: 12, lineHeight: 18 },
  skillChipTxt:   { fontSize: 13, lineHeight: 18, fontWeight: '700' },

  // Documents row (resume + licence chips)
  docsRow:        { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
  docChip:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EBF1FF', borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 10, paddingVertical: 5 },
  docChipTxt:     { fontSize: 11, fontWeight: '700', color: BRAND },
  resumeIcon:     { fontSize: 13 },
  // kept for any remaining reference
  resumeBtn:      { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  resumeTxt:      { flex: 1, fontSize: 11.5, fontWeight: '700', color: BRAND },

  // CTA
  ctaSection:     { paddingHorizontal: 11, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  unlockedRow:    { flexDirection: 'row', gap: 8 },
  callBtn:        { flex: 1, borderRadius: 13, paddingVertical: 13, alignItems: 'center' },
  callBtnTxt:     { color: WHITE, fontSize: 14, fontWeight: '800' },
  waBtn:          { flex: 1, backgroundColor: '#25D366', borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingVertical: 11 },
  waBtnTxt:       { color: WHITE, fontSize: 14, fontWeight: '800' },
  callAgentBtn:   { flexDirection: 'row', backgroundColor: '#2243BC', borderRadius: 13, height: 50, alignItems: 'center', justifyContent: 'center', gap: 9, shadowColor: '#2243BC', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 4 },
  callAgentIcon:  { fontSize: 16, color: WHITE },
  callAgentTxt:   { color: WHITE, fontSize: 15.5, fontWeight: '800', letterSpacing: 0.2 },
  viewContactBtn: { backgroundColor: BRAND, borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  viewContactTxt: { color: WHITE, fontSize: 14, fontWeight: '800' },
  lockCta:        { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  lockIconBox:    { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  lockTitle:      { fontSize: 12, fontWeight: '700' },
  lockSub:        { fontSize: 10.5, fontWeight: '500', marginTop: 1 },
  lockChevron:    { fontSize: 20, fontWeight: '300', color: AMBER },
  topupCta:       { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  topupTitle:     { fontSize: 12, fontWeight: '700' },
  topupSub:       { fontSize: 10.5, fontWeight: '500', marginTop: 1 },

  agentBanner:    { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: 1 },
  agentBannerTxt: { fontSize: 11, fontWeight: '600', flex: 1 },
});

// ─── Skeleton Card ────────────────────────────────────────────────────────────
export const SkeletonCard = (): React.JSX.Element => {
  const { theme } = useAppTheme();
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const bg = theme.mode === 'dark' ? '#1e293b' : SLATE_LT;

  return (
    <Animated.View
      style={[sk.card, { backgroundColor: theme.colors.card, opacity: anim }]}
    >
      <View style={[sk.accentBar, { backgroundColor: bg }]} />
      <View style={{ flex: 1 }}>
        <View style={sk.infoRow}>
          <View style={[sk.avatar, { backgroundColor: bg }]} />
          <View style={{ flex: 1, gap: 10 }}>
            <View style={{ height: 16, borderRadius: 8, backgroundColor: bg, width: '65%' }} />
            <View style={{ height: 12, borderRadius: 6, backgroundColor: bg, width: '45%' }} />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={{ height: 22, width: 56, borderRadius: 6, backgroundColor: bg }} />
              <View style={{ height: 22, width: 56, borderRadius: 6, backgroundColor: bg }} />
              <View style={{ height: 22, width: 72, borderRadius: 6, backgroundColor: bg }} />
            </View>
          </View>
        </View>
        <View style={{ height: 44, backgroundColor: bg, margin: 12, borderRadius: 12 }} />
      </View>
    </Animated.View>
  );
};
const sk = StyleSheet.create({
  card:     { flexDirection: 'row', borderRadius: 14, marginBottom: 10, overflow: 'hidden', elevation: 3, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 12, shadowColor: BRAND },
  accentBar:{ width: 4 },
  infoRow:  { flexDirection: 'row', padding: 16, gap: 14 },
  avatar:   { width: 70, height: 70, borderRadius: 35 },
});
