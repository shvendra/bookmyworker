import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../../core/theme';
import type { RawRequirement } from '../../../../core/api/endpoints/requirementsApi';
// Profile-completion nudge disabled for now — mandatory completion is enforced
// via the post-OTP WorkerProfileCompletionScreen instead.
// import { ProfileCompletionModal } from '../../../../shared/components/ui/ProfileCompletionModal';
import { AppText } from '../../../../shared/components/ui/AppText';
import { Skeleton } from '../../../../shared/components/ui/Skeleton';
import i18n from '../../../../core/i18n';
import { useTranslation } from 'react-i18next';
import { getLocationStr, getWorkTypeLabel, getSubCatLabel } from '../../../../shared/utils/labelUtils';

import { REQ_CARD_WIDTH, REQ_PALETTES_DARK, REQ_PALETTES_LIGHT, fmtDate, isClosed, isCompleted, isAssigned, isActivelyBoosted } from './dashboardShared';

// ─── Stat Card Component ───────────────────────────────────────────────────────
export const StatCard = React.memo(({
  label, value, color, bg, mutedTextColor
}: { label: string; value: number; color: string; bg: string; mutedTextColor: string }): React.JSX.Element => {
  return (
    <View style={[stat.card, { backgroundColor: bg, borderColor: color + '30' }]}>
      <AppText style={[stat.value, { color }]}>{value}</AppText>
      <AppText style={[stat.label, { color: mutedTextColor }]}>{label}</AppText>
    </View>
  );
});
StatCard.displayName = 'StatCard';

export const stat = StyleSheet.create({
  card:  { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', gap: 2 },
  value: { fontSize: 22, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});

// ─── Requirement Card Component ────────────────────────────────────────────────
export interface CardProps {
  req: RawRequirement;
  onPress: (id: string) => void;
  onClose: (req: RawRequirement) => void;
  closing: boolean;
  colors: any;
}

export const RequirementCard = React.memo(({ req, onPress, onClose, closing, colors }: CardProps): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { t: tDefault } = useTranslation(); // cat_* keys live in the default namespace
  const completed = isCompleted(req);
  const closed    = isClosed(req);
  const assigned  = isAssigned(req);
  const interested = req.intrestedAgents?.length ?? 0;

  const statusLabel = completed ? t('statusCompleted') : closed ? t('statusClosed') : assigned ? t('statusOngoing') : t('statusOpen');
  const statusColor = completed ? '#2563EB' : closed ? '#64748B' : assigned ? '#7C3AED' : '#059669';
  const accentColor = completed ? '#2563EB' : closed ? '#94A3B8' : assigned ? '#7C3AED' : '#059669';

  const handlePress    = useCallback(() => onPress(req._id), [onPress, req._id]);
  const handleClose    = useCallback(() => onClose(req), [onClose, req]);
  const handlePhonePress = useCallback(() => {
    if (req.assignedAgentPhone) void Linking.openURL(`tel:${req.assignedAgentPhone}`);
  }, [req.assignedAgentPhone]);

  const totalWorkers = (req.workerQuantitySkilled ?? 0) + (req.workerQuantityUnskilled ?? 0);

  return (
    <TouchableOpacity accessibilityRole="button"
      onPress={handlePress}
      activeOpacity={0.86}
      style={[card.wrap, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: accentColor }]}
    >
      {/* Left accent strip */}
      <View style={[card.accentStrip, { backgroundColor: accentColor }]} />

      <View style={card.inner}>
        {/* ── Header row ── */}
        <View style={card.topRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText style={[card.title, { color: colors.text }]} numberOfLines={2}>
              {getWorkTypeLabel(req.workType, tDefault as Parameters<typeof getWorkTypeLabel>[1]).replace(/\n/g, ' ')}
            </AppText>
            {req.subCategory ? (
              <AppText style={[card.subTitle, { color: colors.mutedText }]}>
                {getSubCatLabel(req.subCategory, i18n.language)}
              </AppText>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <View style={[card.statusPill, { backgroundColor: statusColor + '15', borderColor: statusColor + '40' }]}>
              <View style={[card.statusDot, { backgroundColor: statusColor }]} />
              <AppText style={[card.statusTxt, { color: statusColor }]}>{statusLabel}</AppText>
            </View>
            {req.ERN_NUMBER ? (
              <View style={[card.ernChip, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
                <AppText style={[card.ernTxt, { color: colors.mutedText }]}>#{req.ERN_NUMBER}</AppText>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Assigned agent row ── */}
        {assigned && !closed && (
          <TouchableOpacity accessibilityRole="button"
            onPress={handlePhonePress}
            style={[card.agentRow, { backgroundColor: colors.secondaryLight, borderColor: colors.secondary + '55' }]}
            activeOpacity={req.assignedAgentPhone ? 0.72 : 1}
          >
            <View style={[card.agentAvatar, { backgroundColor: colors.secondary + '33' }]}>
              <AppText style={{ fontSize: 14 }}>👷</AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={[card.agentName, { color: colors.secondary }]}>
                {req.assignedAgentName ?? t('agentAssigned')}
              </AppText>
              {req.assignedAgentPhone ? (
                <AppText style={[card.agentPhone, { color: colors.secondary }]}>📞 {req.assignedAgentPhone}</AppText>
              ) : null}
            </View>
            <View style={card.agentBadge}>
              <AppText style={card.agentBadgeTxt}>{t('tapToCall')}</AppText>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Interested agents banner ── */}
        {!closed && !assigned && (
          <View style={[
            card.interestBanner,
            interested > 0
              ? { backgroundColor: colors.warningLight, borderColor: colors.warning + '66' }
              : { backgroundColor: colors.surface1, borderColor: colors.border },
          ]}>
            <View style={[card.interestIconWrap, { backgroundColor: interested > 0 ? colors.warning + '22' : colors.surface }]}>
              <AppText style={{ fontSize: 14, lineHeight: 18 }}>{interested > 0 ? '🙋' : '👀'}</AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={[card.interestPrimary, { color: interested > 0 ? colors.warning : colors.text }]}>
                {interested > 0 ? t(interested === 1 ? 'agentsInterested' : 'agentsInterested_plural', { count: interested }) : t('noAgentsYet')}
              </AppText>
              <AppText style={[card.interestSub, { color: interested > 0 ? colors.warningDark : colors.mutedText }]}>
                {interested > 0 ? t('tapToReview') : t('shareRequirement')}
              </AppText>
            </View>
            {interested > 0 && (
              <View style={[card.interestChevron, { backgroundColor: colors.warning + '33' }]}>
                <AppText style={{ color: colors.warning, fontSize: 16, fontWeight: '700' }}>›</AppText>
              </View>
            )}
          </View>
        )}

        {/* ── Meta chips ── */}
        <View style={[card.metaRow, { borderTopColor: colors.divider }]}>
          {(req.district || req.state) ? (
            <View style={[card.metaChip, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
              <AppText style={[card.metaTxt, { color: colors.mutedText }]}>
                📍 {getLocationStr({ district: req.district, state: req.state }, i18n.language, '')}
              </AppText>
            </View>
          ) : null}
          {totalWorkers > 0 ? (
            <View style={[card.metaChip, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
              <AppText style={[card.metaTxt, { color: colors.mutedText }]}>👷 {totalWorkers}</AppText>
            </View>
          ) : null}
          {req.minBudgetPerWorker != null ? (
            <View style={[card.metaChip, { backgroundColor: colors.successLight, borderColor: colors.success + '55' }]}>
              <AppText style={[card.metaTxt, { color: colors.success, fontWeight: '700' }]}>
                ₹{req.minBudgetPerWorker}–{req.maxBudgetPerWorker ?? req.minBudgetPerWorker}/day
              </AppText>
            </View>
          ) : null}
          {req.workerNeedDate ? (
            <View style={[card.metaChip, { backgroundColor: colors.surface1, borderColor: colors.border }]}>
              <AppText style={[card.metaTxt, { color: colors.mutedText }]}>🗓 {fmtDate(req.workerNeedDate)}</AppText>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});
RequirementCard.displayName = 'RequirementCard';

export const card = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  accentStrip: { width: 4 },
  inner:       { flex: 1, padding: 14, gap: 10 },
  topRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  title:       { fontSize: 15, fontWeight: '800', lineHeight: 20, letterSpacing: -0.1 },
  subTitle:    { fontSize: 12, fontWeight: '600', marginTop: 1 },
  statusPill:  { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4, gap: 5 },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusTxt:   { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  ernChip:     { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  ernTxt:      { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  // Assigned agent
  agentRow:    { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 10, gap: 10 },
  agentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#C4B5FD', alignItems: 'center', justifyContent: 'center' },
  agentName:   { fontSize: 13, fontWeight: '800', textTransform: 'capitalize' },
  agentPhone:  { fontSize: 11, color: '#6D28D9', marginTop: 2, fontWeight: '600' },
  agentBadge:  { backgroundColor: '#7C3AED', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  agentBadgeTxt:{ fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  // Interest banner
  interestBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 10, gap: 10 },
  interestIconWrap:{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  interestPrimary: { fontSize: 13, fontWeight: '800' },
  interestSub:     { fontSize: 11, fontWeight: '500', marginTop: 1 },
  interestChevron: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  // Meta
  metaRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 2 },
  metaChip:    { flexDirection: 'row', alignItems: 'center', borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  metaTxt:     { fontSize: 11, fontWeight: '600' },
  // unused but kept to avoid TS errors on old references
  actions:     { flexDirection: 'row', gap: 8, paddingTop: 10, marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth },
  actionBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: 10, paddingVertical: 8 },
  actionIcon:  { fontSize: 13, lineHeight: 16 },
  actionTxt:   { fontSize: 12, fontWeight: '700' },
});

// ─── Requirement Slider Card ───────────────────────────────────────────────────
// ─── Premium Dark Requirement Card ────────────────────────────────────────────
export interface ReqSliderCardProps {
  req: RawRequirement;
  idx: number;
  onPress: (id: string) => void;
  onClose: (req: RawRequirement) => void;
  closing: boolean;
  canInvite?: boolean;
  onInvite?: (req: RawRequirement) => void;
  boostEnabled?: boolean;
  boostRemaining?: number;
  boosting?: boolean;
  onBoost?: (req: RawRequirement) => void;
}

export const ReqSliderCard = React.memo(({ req, idx, onPress, onClose, closing, canInvite, onInvite, boostEnabled, boostRemaining, boosting, onBoost }: ReqSliderCardProps): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { t: tDefault } = useTranslation(); // cat_* keys live in the default namespace
  const { theme } = useAppTheme();
  const isDark = theme.mode === 'dark';
  const completed = isCompleted(req);
  const closed    = isClosed(req);
  const assigned  = isAssigned(req);
  const boosted   = isActivelyBoosted(req);
  const interested = req.intrestedAgents?.length ?? 0;
  const totalWorkers = (req.workerQuantitySkilled ?? 0) + (req.workerQuantityUnskilled ?? 0);

  const PALETTES = isDark ? REQ_PALETTES_DARK : REQ_PALETTES_LIGHT;
  const pal = closed
    ? { bg: isDark ? '#111827' : '#374151', accent: '#94A3B8', accentLight: 'rgba(148,163,184,0.15)' }
    : PALETTES[idx % PALETTES.length];

  const statusLabel = completed ? t('statusCompleted') : closed ? t('statusClosed') : assigned ? t('statusOngoing') : t('statusOpen');
  const statusColor = completed ? '#BFDBFE' : closed ? '#94A3B8' : assigned ? '#C4B5FD' : '#9CF0BE';
  const statusBg    = completed ? 'rgba(59,130,246,0.25)' : closed ? 'rgba(148,163,184,0.18)' : assigned ? 'rgba(167,139,250,0.22)' : 'rgba(22,163,74,0.30)';
  const statusBdr   = completed ? 'rgba(147,197,253,0.45)' : closed ? 'rgba(148,163,184,0.40)' : assigned ? 'rgba(196,181,253,0.45)' : 'rgba(120,240,170,0.45)';
  const statusDotClr = completed ? '#93C5FD' : closed ? '#94A3B8' : assigned ? '#C4B5FD' : '#34D77F';

  const handlePress      = useCallback(() => onPress(req._id), [onPress, req._id]);
  const handlePhonePress = useCallback(() => {
    if (req.assignedAgentPhone) void Linking.openURL(`tel:${req.assignedAgentPhone}`);
  }, [req.assignedAgentPhone]);

  return (
    <TouchableOpacity accessibilityRole="button"
      onPress={handlePress}
      activeOpacity={0.88}
      style={[rsc.card, { width: REQ_CARD_WIDTH, backgroundColor: pal.bg, shadowColor: pal.accent }]}
    >
      {/* Gradient depth (darker toward bottom) + decorative circles */}
      <View pointerEvents="none" style={rsc.grad} />
      <View pointerEvents="none" style={[rsc.deco1, { backgroundColor: pal.accent + '12' }]} />
      <View pointerEvents="none" style={[rsc.deco2, { backgroundColor: pal.accent + '08' }]} />

      <View style={rsc.inner}>
        {/* ── Top row: ERN + date (left) · status pill (right), all one line ── */}
        <View style={rsc.topRow}>
          <View style={rsc.topLeft}>
            {boosted ? (
              <View style={[rsc.ernChip, { borderColor: 'rgba(244,114,182,0.55)', backgroundColor: 'rgba(236,72,153,0.28)' }]}>
                <AppText style={[rsc.ernTxt, { color: '#FBCFE8' }]} numberOfLines={1}><Ionicons name="rocket" size={10} color="#FBCFE8" />{' '}{t('req_boostedBadge')}</AppText>
              </View>
            ) : null}
            {req.ERN_NUMBER ? (
              <View style={[rsc.ernChip, { borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <AppText style={rsc.ernTxt} numberOfLines={1}>{'#'}{req.ERN_NUMBER}</AppText>
              </View>
            ) : null}
            {req.workerNeedDate ? (
              <View style={[rsc.ernChip, { borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <AppText style={rsc.ernTxt} numberOfLines={1}><Ionicons name="calendar-outline" size={11} color="rgba(255,255,255,0.72)" />{' '}{fmtDate(req.workerNeedDate)}</AppText>
              </View>
            ) : null}
          </View>
          <View style={[rsc.statusPill, { backgroundColor: statusBg, borderColor: statusBdr }]}>
            <View style={[rsc.statusDot, { backgroundColor: statusDotClr }]} />
            <AppText style={[rsc.statusTxt, { color: statusColor }]} numberOfLines={1}>{statusLabel}</AppText>
          </View>
        </View>

        {/* ── Work type + sub-category ── */}
        {req.subCategory ? (
          <AppText style={rsc.subCat} numberOfLines={1}>{getSubCatLabel(req.subCategory, i18n.language)}</AppText>
        ) : null}
        <AppText style={rsc.workType} numberOfLines={2}>{getWorkTypeLabel(req.workType, tDefault as Parameters<typeof getWorkTypeLabel>[1]).replace(/\n/g, ' ')}</AppText>

        {/* ── Agent / interest strip ── */}
        {!closed && assigned ? (
          <TouchableOpacity accessibilityRole="button"
            onPress={handlePhonePress}
            activeOpacity={req.assignedAgentPhone ? 0.75 : 1}
            style={[rsc.agentStrip, { backgroundColor: 'rgba(167,139,250,0.18)', borderColor: 'rgba(167,139,250,0.4)' }]}
          >
            <Ionicons name="person-circle" size={20} color="#DDD6FE" style={rsc.agentStripIcon} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText style={rsc.agentName} numberOfLines={1}>
                {req.assignedAgentName ?? t('agentAssigned')}
              </AppText>
              {req.assignedAgentPhone ? (
                <AppText style={rsc.agentPhone}><Ionicons name="call" size={11} color="#DDD6FE" />{' '}{req.assignedAgentPhone}</AppText>
              ) : null}
            </View>
            {req.assignedAgentPhone ? (
              <View style={[rsc.callBadge, { backgroundColor: pal.accent }]}>
                <AppText style={rsc.callBadgeTxt}>{t('tapToCall')}</AppText>
              </View>
            ) : null}
          </TouchableOpacity>
        ) : !closed && interested > 0 ? (
          <View style={[
            rsc.interestStrip,
            { backgroundColor: 'rgba(251,191,36,0.12)', borderColor: 'rgba(251,191,36,0.4)' },
          ]}>
            <Ionicons name="hand-left" size={14} color="#FCD34D" style={rsc.interestIcon} />
            <AppText style={[rsc.interestTxt, { color: '#FCD34D' }]} numberOfLines={1}>
              {t(interested === 1 ? 'agentsInterested' : 'agentsInterested_plural', { count: interested })}
            </AppText>
          </View>
        ) : null}

        {/* ── Meta chips ── */}
        <View style={rsc.metaRow}>
          {(req.district || req.state) ? (
            <View style={rsc.metaChip}>
              <AppText style={rsc.metaTxt} numberOfLines={1}>
                <Ionicons name="location-sharp" size={11} color="rgba(255,255,255,0.72)" />{' '}{getLocationStr({ district: req.district, state: req.state }, i18n.language, '')}
              </AppText>
            </View>
          ) : null}
          {totalWorkers > 0 ? (
            <View style={rsc.metaChip}>
              <AppText style={rsc.metaTxt}><Ionicons name="people" size={11} color="rgba(255,255,255,0.72)" />{' '}{totalWorkers}</AppText>
            </View>
          ) : null}
          {req.minBudgetPerWorker != null ? (
            <View style={rsc.metaChip}>
              <AppText style={[rsc.metaTxt, { fontWeight: '800', color: '#FFFFFF' }]}>
                {'₹'}{req.minBudgetPerWorker}{req.maxBudgetPerWorker ? '–' + String(req.maxBudgetPerWorker) : ''}{'/day'}
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Footer (View / Close buttons) removed — the whole card is tappable to open the requirement. */}

        {/* ── Invite Workers (plan-gated; opens same-category suggestions) ── */}
        {canInvite && !closed ? (
          <TouchableOpacity accessibilityRole="button"
            onPress={() => onInvite?.(req)}
            activeOpacity={0.85}
            style={rsc.inviteBtn}
          >
            <AppText style={rsc.inviteBtnTxt} numberOfLines={1}>
              <Ionicons name="person-add" size={14} color="#6D3FD6" />{' '}{t('sw_inviteWorkers')}
            </AppText>
          </TouchableOpacity>
        ) : null}

        {/* ── Boost to top (plan-gated; only approved reqs are visible in search) ── */}
        {boostEnabled && !closed && req.isApproved && !boosted && (boostRemaining ?? 0) > 0 ? (
          <TouchableOpacity accessibilityRole="button"
            onPress={() => onBoost?.(req)}
            activeOpacity={0.85}
            disabled={boosting}
            style={rsc.boostBtn}
          >
            <AppText style={rsc.boostBtnTxt} numberOfLines={1}>
              {boosting ? t('req_boosting') : <><Ionicons name="rocket" size={13} color="#fff" />{' '}{`${t('req_boostToTop')} (${boostRemaining})`}</>}
            </AppText>
          </TouchableOpacity>
        ) : boostEnabled && !closed && boosted ? (
          <View style={[rsc.boostBtn, rsc.boostBtnDone]}>
            <AppText style={[rsc.boostBtnTxt, { color: '#FBCFE8' }]} numberOfLines={1}>
              <Ionicons name="rocket" size={13} color="#FBCFE8" />{' '}{t('req_boostedOnTop')}
            </AppText>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});
ReqSliderCard.displayName = 'ReqSliderCard';

// ─── Auto-sliding Carousel Wrapper ────────────────────────────────────────────
export interface RequirementCarouselProps {
  requirements: RawRequirement[];
  onPress: (id: string) => void;
  onClose: (req: RawRequirement) => void;
  closingId: string | null;
  isLoading: boolean;
  onPost: () => void;
  tab: string;
  allCount: number;
  t: (key: string, opts?: any) => string;
  themeColors: any;
  canInvite?: boolean;
  onInvite?: (req: RawRequirement) => void;
  boostEnabled?: boolean;
  boostRemaining?: number;
  boostingId?: string | null;
  onBoost?: (req: RawRequirement) => void;
}

export const RequirementCarousel = React.memo(({
  requirements, onPress, onClose, closingId, isLoading, onPost, tab, allCount, t, themeColors, canInvite, onInvite,
  boostEnabled, boostRemaining, boostingId, onBoost,
}: RequirementCarouselProps): React.JSX.Element => {
  const focused = useIsFocused(); // pause auto-slide (and its re-renders) while another screen is on top
  const scrollRef = useRef<ScrollView>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const activeIdxRef = useRef(0);
  const SNAP = REQ_CARD_WIDTH; // no gap between full-width pages

  useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);

  // Auto-slide every 3.5 s
  useEffect(() => {
    if (requirements.length <= 1 || !focused) return;
    const timer = setInterval(() => {
      const next = (activeIdxRef.current + 1) % requirements.length;
      scrollRef.current?.scrollTo({ x: next * SNAP, animated: true });
      setActiveIdx(next);
    }, 3500);
    return () => clearInterval(timer);
  }, [requirements.length, SNAP, focused]);

  if (isLoading) {
    return (
      <View style={rsc.skelWrap}>
        <Skeleton height={150} borderRadius={18} />
        <View style={rsc.skelDots}>
          <Skeleton width={22} height={6} borderRadius={3} />
          <Skeleton width={6} height={6} borderRadius={3} />
          <Skeleton width={6} height={6} borderRadius={3} />
        </View>
      </View>
    );
  }

  if (requirements.length === 0) {
    return (
      <View style={rsc.emptyWrap}>
        <Ionicons name="clipboard-outline" size={36} color={themeColors.mutedText} style={rsc.emptyIcon} />
        <AppText style={[rsc.emptyTitle, { color: themeColors.text }]}>
          {tab === 'all' ? t('noRequirementsYet') : t('noTabRequirements', { tab })}
        </AppText>
        <AppText style={[rsc.emptySub, { color: themeColors.mutedText }]}>
          {tab === 'all' ? t('postFirstReq') : t('noTabReqNow', { tab })}
        </AppText>
        {allCount === 0 && (
          <TouchableOpacity accessibilityRole="button" onPress={onPost} style={[rsc.postBtn, { backgroundColor: themeColors.primary }]} activeOpacity={0.85}>
            <AppText style={rsc.postBtnTxt}>{t('postFirstRequirement')}</AppText>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SNAP}
        snapToAlignment="start"
        contentContainerStyle={{ paddingBottom: 4 }}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SNAP);
          const clamped = Math.max(0, Math.min(idx, requirements.length - 1));
          setActiveIdx(clamped);
          activeIdxRef.current = clamped;
        }}
      >
        {requirements.map((req, i) => (
          <ReqSliderCard
            key={req._id}
            req={req}
            idx={i}
            onPress={onPress}
            onClose={onClose}
            closing={closingId === req._id}
            canInvite={canInvite}
            onInvite={onInvite}
            boostEnabled={boostEnabled}
            boostRemaining={boostRemaining}
            boosting={boostingId === req._id}
            onBoost={onBoost}
          />
        ))}
      </ScrollView>
    </View>
  );
});
RequirementCarousel.displayName = 'RequirementCarousel';

// ─── Premium Card Styles ───────────────────────────────────────────────────────
export const rsc = StyleSheet.create({
  // Card shell
  card:          { borderRadius: 20, overflow: 'hidden', elevation: 10, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 20 },
  grad:          { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%', backgroundColor: 'rgba(8,16,46,0.22)' },
  inner:         { padding: 16, gap: 10 },
  inviteBtn:     { marginTop: 4, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  inviteBtnTxt:  { fontSize: 14, fontWeight: '800', color: '#6D3FD6' },
  boostBtn:      { marginTop: 8, backgroundColor: '#EC4899', borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  boostBtnDone:  { backgroundColor: 'rgba(236,72,153,0.22)', borderWidth: 1, borderColor: 'rgba(244,114,182,0.5)' },
  boostBtnTxt:   { fontSize: 14, fontWeight: '800', color: '#fff' },
  deco1:         { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: -80, right: -50 },
  deco2:         { position: 'absolute', width: 120, height: 120, borderRadius: 60, bottom: -30, left: -20 },
  // Top row
  topRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  topLeft:       { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 },
  ernChip:       { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  ernTxt:        { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.65)', letterSpacing: 0.3 },
  statusPill:    { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4, gap: 5 },
  statusDot:     { width: 6, height: 6, borderRadius: 3 },
  statusTxt:     { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  // Title
  subCat:        { fontSize: 11.5, fontWeight: '800', color: '#9FB0E6', letterSpacing: 0.6, textTransform: 'uppercase' },
  workType:      { fontSize: 21, fontWeight: '900', color: '#FFFFFF', lineHeight: 26, letterSpacing: -0.4 },
  // Agent strip
  agentStrip:    { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 10, gap: 8 },
  agentStripIcon:{ fontSize: 16, lineHeight: 20 },
  agentName:     { fontSize: 12, fontWeight: '800', color: '#E9D5FF', marginBottom: 1 },
  agentPhone:    { fontSize: 10, color: '#C4B5FD', fontWeight: '600' },
  callBadge:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  callBadgeTxt:  { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  // Interest strip
  interestStrip: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, gap: 7 },
  interestIcon:  { fontSize: 14, lineHeight: 18 },
  interestTxt:   { fontSize: 11, fontWeight: '700', flex: 1 },
  // Meta
  metaRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip:      { flexDirection: 'row', alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 9, paddingVertical: 4 },
  metaTxt:       { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.72)' },
  // Footer
  footer:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  viewBtn:       { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  viewBtnTxt:    { fontSize: 12, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  closeBtn:      { borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, flexShrink: 0 },
  closeTxt:      { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.55)' },
  // Empty / loading states
  loadWrap:      { paddingVertical: 40, alignItems: 'center' },
  skelWrap:      { paddingVertical: 14, paddingHorizontal: 4 },
  skelDots:      { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 12 },
  emptyWrap:     { padding: 28, alignItems: 'center', gap: 8 },
  emptyIcon:     { fontSize: 36, lineHeight: 44 },
  emptyTitle:    { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  emptySub:      { fontSize: 12, textAlign: 'center', lineHeight: 17 },
  postBtn:       { marginTop: 6, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  postBtnTxt:    { fontSize: 13, fontWeight: '800', color: '#fff' },
});

