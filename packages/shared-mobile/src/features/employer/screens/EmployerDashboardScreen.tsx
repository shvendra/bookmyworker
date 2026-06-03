import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { shortlistStorage } from '../../../core/storage/shortlistStorage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '../../../core/theme';
import { useAppConfig, formatStat } from '../../../core/api/endpoints/appConfigApi';
import { usePricingConfig } from '../../../core/api/endpoints/pricingApi';
import type { EmployerTypeKey } from '../../../core/api/endpoints/pricingApi';
import { requirementsApi } from '../../../core/api/endpoints/requirementsApi';
import type { RawRequirement } from '../../../core/api/endpoints/requirementsApi';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import type { RawAgent } from '../../../core/api/endpoints/workerApi';
import { useAuth } from '../../../state/auth/AuthContext';
// Profile-completion nudge disabled for now — mandatory completion is enforced
// via the post-OTP WorkerProfileCompletionScreen instead.
// import { ProfileCompletionModal } from '../../../shared/components/ui/ProfileCompletionModal';
import { GuidedTour } from '../../../shared/components/ui/GuidedTour';
import { workerMappingApi } from '../../../core/api/endpoints/workerMappingApi';
import { AppText } from '../../../shared/components/ui/AppText';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { BrandLogo } from '../../../shared/components/ui/BrandLogo';
import { useToast } from '../../../shared/state/toast/ToastContext';
import type { MainStackParamList } from '../../../app/navigation/types';
import { buildPhotoUrl } from '../../../core/config/env';
import { apiClient } from '../../../core/api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmployerSubscriptionModal } from '../../payment/components/EmployerSubscriptionModal';
import { EmployerPromoSlider } from '../../../shared/components/ui/EmployerPromoSlider';
import i18n from '../../../core/i18n';
import { useTranslation } from 'react-i18next';
import { getLocationStr } from '../../../shared/utils/labelUtils';

const EMPLOYER_SUB_MODAL_KEY = 'employer_sub_modal_shown';


// ─── Types & Constants ─────────────────────────────────────────────────────────
type ReqTab = 'all' | 'open' | 'closed';
type Nav = NativeStackNavigationProp<MainStackParamList>;

// REQ_TABS is built inside the screen using t() — see renderHeader

const NEARBY_SHOW = 10;
const { width: SCREEN_W } = Dimensions.get('window');
const REQ_CARD_WIDTH = SCREEN_W - 32; // full-bleed inside 16px padding

// Premium dark palettes for requirement cards — varies by index
// Dark mode — deep/near-black backgrounds
const REQ_PALETTES_DARK = [
  { bg: '#0A1628', accent: '#4A90FF', accentLight: 'rgba(74,144,255,0.18)' },
  { bg: '#160A30', accent: '#9B59FF', accentLight: 'rgba(155,89,255,0.18)' },
  { bg: '#041E1E', accent: '#00C896', accentLight: 'rgba(0,200,150,0.18)' },
  { bg: '#1A0F00', accent: '#FF9500', accentLight: 'rgba(255,149,0,0.18)'  },
] as const;

// Light mode — medium-dark, rich but not oppressive
const REQ_PALETTES_LIGHT = [
  { bg: '#1B3F8B', accent: '#93C5FD', accentLight: 'rgba(147,197,253,0.22)' },
  { bg: '#3B1A72', accent: '#C4B5FD', accentLight: 'rgba(196,181,253,0.22)' },
  { bg: '#0C4040', accent: '#6EE7B7', accentLight: 'rgba(110,231,183,0.22)' },
  { bg: '#7C3000', accent: '#FCD34D', accentLight: 'rgba(252,211,77,0.22)'  },
] as const;

// ─── Pure Utility Helpers ──────────────────────────────────────────────────────

/** Remove underscores and title-case — matches CRM formatLabel pattern */
const fmtLabel = (s?: string | null): string => {
  if (!s) return '—';
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const fmtDate = (d?: string): string => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const isClosed = (r: RawRequirement): boolean => {
  const s = String(r.status ?? '').toLowerCase();
  return s === 'closed' || s === 'expired';
};
const isAssigned = (r: RawRequirement): boolean => !!r.assignedAgentId;

const maskPhone = (id: string): string => {
  const code = id.slice(-2).split('').map((c) => c.charCodeAt(0) % 10).join('');
  return `∗∗∗∗∗∗∗∗${code}`;
};

const agentStars = (id: string): number => {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return 4.0 + (hash % 10) / 10;
};

const getGreetingKey = (): 'goodMorning' | 'goodAfternoon' | 'goodEvening' => {
  const h = new Date().getHours();
  if (h < 12) return 'goodMorning';
  if (h < 17) return 'goodAfternoon';
  return 'goodEvening';
};

// ─── Stat Card Component ───────────────────────────────────────────────────────
const StatCard = React.memo(({
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

const stat = StyleSheet.create({
  card:  { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center', gap: 2 },
  value: { fontSize: 22, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});

// ─── Requirement Card Component ────────────────────────────────────────────────
interface CardProps {
  req: RawRequirement;
  onPress: (id: string) => void;
  onClose: (req: RawRequirement) => void;
  closing: boolean;
  colors: any;
}

const RequirementCard = React.memo(({ req, onPress, onClose, closing, colors }: CardProps): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const closed    = isClosed(req);
  const assigned  = isAssigned(req);
  const interested = req.intrestedAgents?.length ?? 0;

  const statusLabel = closed ? t('statusClosed') : assigned ? t('statusOngoing') : t('statusOpen');
  const statusColor = closed ? '#64748B' : assigned ? '#7C3AED' : '#059669';
  const accentColor = closed ? '#94A3B8' : assigned ? '#7C3AED' : '#059669';

  const handlePress    = useCallback(() => onPress(req._id), [onPress, req._id]);
  const handleClose    = useCallback(() => onClose(req), [onClose, req]);
  const handlePhonePress = useCallback(() => {
    if (req.assignedAgentPhone) void Linking.openURL(`tel:${req.assignedAgentPhone}`);
  }, [req.assignedAgentPhone]);

  const totalWorkers = (req.workerQuantitySkilled ?? 0) + (req.workerQuantityUnskilled ?? 0);

  return (
    <TouchableOpacity
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
              {fmtLabel(req.workType)}
            </AppText>
            {req.subCategory ? (
              <AppText style={[card.subTitle, { color: colors.mutedText }]}>
                {fmtLabel(req.subCategory)}
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
          <TouchableOpacity
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

const card = StyleSheet.create({
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
interface ReqSliderCardProps {
  req: RawRequirement;
  idx: number;
  onPress: (id: string) => void;
  onClose: (req: RawRequirement) => void;
  closing: boolean;
}

const ReqSliderCard = React.memo(({ req, idx, onPress, onClose, closing }: ReqSliderCardProps): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const isDark = theme.mode === 'dark';
  const closed    = isClosed(req);
  const assigned  = isAssigned(req);
  const interested = req.intrestedAgents?.length ?? 0;
  const totalWorkers = (req.workerQuantitySkilled ?? 0) + (req.workerQuantityUnskilled ?? 0);

  const PALETTES = isDark ? REQ_PALETTES_DARK : REQ_PALETTES_LIGHT;
  const pal = closed
    ? { bg: isDark ? '#111827' : '#374151', accent: '#94A3B8', accentLight: 'rgba(148,163,184,0.15)' }
    : PALETTES[idx % PALETTES.length];

  const statusLabel = closed ? t('statusClosed') : assigned ? t('statusOngoing') : t('statusOpen');
  const statusColor = closed ? '#94A3B8' : assigned ? '#C4B5FD' : '#6EE7B7';

  const handlePress      = useCallback(() => onPress(req._id), [onPress, req._id]);
  const handleClose      = useCallback(() => onClose(req), [onClose, req]);
  const handlePhonePress = useCallback(() => {
    if (req.assignedAgentPhone) void Linking.openURL(`tel:${req.assignedAgentPhone}`);
  }, [req.assignedAgentPhone]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.88}
      style={[rsc.card, { width: REQ_CARD_WIDTH, backgroundColor: pal.bg, shadowColor: pal.accent }]}
    >
      {/* Decorative background circles */}
      <View pointerEvents="none" style={[rsc.deco1, { backgroundColor: pal.accent + '12' }]} />
      <View pointerEvents="none" style={[rsc.deco2, { backgroundColor: pal.accent + '08' }]} />

      <View style={rsc.inner}>
        {/* ── Top row: ERN + status pill ── */}
        <View style={rsc.topRow}>
          {req.ERN_NUMBER ? (
            <View style={[rsc.ernChip, { borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <AppText style={rsc.ernTxt}>{'#'}{req.ERN_NUMBER}</AppText>
            </View>
          ) : <View />}
          <View style={[rsc.statusPill, { backgroundColor: pal.accentLight, borderColor: pal.accent + '55' }]}>
            <View style={[rsc.statusDot, { backgroundColor: statusColor }]} />
            <AppText style={[rsc.statusTxt, { color: statusColor }]}>{statusLabel}</AppText>
          </View>
        </View>

        {/* ── Work type + sub-category ── */}
        {req.subCategory ? (
          <AppText style={rsc.subCat} numberOfLines={1}>{fmtLabel(req.subCategory)}</AppText>
        ) : null}
        <AppText style={rsc.workType} numberOfLines={2}>{fmtLabel(req.workType)}</AppText>

        {/* ── Agent / interest strip ── */}
        {!closed && assigned ? (
          <TouchableOpacity
            onPress={handlePhonePress}
            activeOpacity={req.assignedAgentPhone ? 0.75 : 1}
            style={[rsc.agentStrip, { backgroundColor: 'rgba(167,139,250,0.18)', borderColor: 'rgba(167,139,250,0.4)' }]}
          >
            <AppText style={rsc.agentStripIcon}>{'👷'}</AppText>
            <View style={{ flex: 1 }}>
              <AppText style={rsc.agentName} numberOfLines={1}>
                {req.assignedAgentName ?? t('agentAssigned')}
              </AppText>
              {req.assignedAgentPhone ? (
                <AppText style={rsc.agentPhone}>{'📞'} {req.assignedAgentPhone}</AppText>
              ) : null}
            </View>
            {req.assignedAgentPhone ? (
              <View style={[rsc.callBadge, { backgroundColor: pal.accent }]}>
                <AppText style={rsc.callBadgeTxt}>{t('tapToCall')}</AppText>
              </View>
            ) : null}
          </TouchableOpacity>
        ) : !closed ? (
          <View style={[
            rsc.interestStrip,
            { backgroundColor: interested > 0 ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.06)',
              borderColor: interested > 0 ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.12)' },
          ]}>
            <AppText style={rsc.interestIcon}>{interested > 0 ? '🙋' : '👀'}</AppText>
            <AppText style={[rsc.interestTxt, { color: interested > 0 ? '#FCD34D' : 'rgba(255,255,255,0.55)' }]} numberOfLines={1}>
              {interested > 0
                ? t(interested === 1 ? 'agentsInterested' : 'agentsInterested_plural', { count: interested })
                : t('noAgentsYet')}
            </AppText>
          </View>
        ) : null}

        {/* ── Meta chips ── */}
        <View style={rsc.metaRow}>
          {(req.district || req.state) ? (
            <View style={rsc.metaChip}>
              <AppText style={rsc.metaTxt} numberOfLines={1}>
                {'📍'} {getLocationStr({ district: req.district, state: req.state }, i18n.language, '')}
              </AppText>
            </View>
          ) : null}
          {totalWorkers > 0 ? (
            <View style={rsc.metaChip}>
              <AppText style={rsc.metaTxt}>{'👷'} {totalWorkers}</AppText>
            </View>
          ) : null}
          {req.minBudgetPerWorker != null ? (
            <View style={[rsc.metaChip, { backgroundColor: pal.accentLight, borderColor: pal.accent + '44' }]}>
              <AppText style={[rsc.metaTxt, { color: pal.accent, fontWeight: '800' }]}>
                {'₹'}{req.minBudgetPerWorker}{req.maxBudgetPerWorker ? '–' + String(req.maxBudgetPerWorker) : ''}{'/day'}
              </AppText>
            </View>
          ) : null}
          {req.workerNeedDate ? (
            <View style={rsc.metaChip}>
              <AppText style={rsc.metaTxt}>{'🗓'} {fmtDate(req.workerNeedDate)}</AppText>
            </View>
          ) : null}
        </View>

        {/* ── Footer: view + close ── */}
        <View style={rsc.footer}>
          <View style={[rsc.viewBtn, { backgroundColor: pal.accent }]}>
            <AppText style={rsc.viewBtnTxt}>{t('view')} {'→'}</AppText>
          </View>
          {!closed ? (
            <TouchableOpacity
              onPress={handleClose}
              disabled={closing}
              activeOpacity={0.7}
              style={rsc.closeBtn}
            >
              {closing
                ? <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
                : <AppText style={rsc.closeTxt}>{t('close')}</AppText>}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});
ReqSliderCard.displayName = 'ReqSliderCard';

// ─── Auto-sliding Carousel Wrapper ────────────────────────────────────────────
interface RequirementCarouselProps {
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
}

const RequirementCarousel = React.memo(({
  requirements, onPress, onClose, closingId, isLoading, onPost, tab, allCount, t, themeColors,
}: RequirementCarouselProps): React.JSX.Element => {
  const scrollRef = useRef<ScrollView>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const activeIdxRef = useRef(0);
  const SNAP = REQ_CARD_WIDTH; // no gap between full-width pages

  useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);

  // Auto-slide every 3.5 s
  useEffect(() => {
    if (requirements.length <= 1) return;
    const timer = setInterval(() => {
      const next = (activeIdxRef.current + 1) % requirements.length;
      scrollRef.current?.scrollTo({ x: next * SNAP, animated: true });
      setActiveIdx(next);
    }, 3500);
    return () => clearInterval(timer);
  }, [requirements.length, SNAP]);

  if (isLoading) {
    return (
      <View style={rsc.loadWrap}>
        <ActivityIndicator color="#7C3AED" size="large" />
      </View>
    );
  }

  if (requirements.length === 0) {
    return (
      <View style={rsc.emptyWrap}>
        <AppText style={rsc.emptyIcon}>{'📋'}</AppText>
        <AppText style={[rsc.emptyTitle, { color: themeColors.text }]}>
          {tab === 'all' ? t('noRequirementsYet') : t('noTabRequirements', { tab })}
        </AppText>
        <AppText style={[rsc.emptySub, { color: themeColors.mutedText }]}>
          {tab === 'all' ? t('postFirstReq') : t('noTabReqNow', { tab })}
        </AppText>
        {allCount === 0 && (
          <TouchableOpacity onPress={onPost} style={[rsc.postBtn, { backgroundColor: themeColors.primary }]} activeOpacity={0.85}>
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
          />
        ))}
      </ScrollView>
      {/* Dot indicators */}
      {requirements.length > 1 && (
        <View style={rsc.dots}>
          {requirements.map((_, i) => (
            <View
              key={i}
              style={[rsc.dot, {
                width: activeIdx === i ? 22 : 6,
                backgroundColor: activeIdx === i ? '#7C3AED' : '#CBD5E1',
              }]}
            />
          ))}
        </View>
      )}
    </View>
  );
});
RequirementCarousel.displayName = 'RequirementCarousel';

// ─── Premium Card Styles ───────────────────────────────────────────────────────
const rsc = StyleSheet.create({
  // Card shell
  card:          { borderRadius: 24, overflow: 'hidden', elevation: 10, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 20 },
  inner:         { padding: 18, gap: 11 },
  deco1:         { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: -80, right: -50 },
  deco2:         { position: 'absolute', width: 120, height: 120, borderRadius: 60, bottom: -30, left: -20 },
  // Top row
  topRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ernChip:       { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  ernTxt:        { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.65)', letterSpacing: 0.3 },
  statusPill:    { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4, gap: 5 },
  statusDot:     { width: 6, height: 6, borderRadius: 3 },
  statusTxt:     { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  // Title
  subCat:        { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.3, textTransform: 'uppercase' },
  workType:      { fontSize: 18, fontWeight: '900', color: '#FFFFFF', lineHeight: 24, letterSpacing: -0.3 },
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
  closeBtn:      { borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8 },
  closeTxt:      { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.55)' },
  // Dots
  dots:          { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10, marginBottom: 14 },
  dot:           { height: 6, borderRadius: 3 },
  // Empty / loading states
  loadWrap:      { paddingVertical: 40, alignItems: 'center' },
  emptyWrap:     { padding: 28, alignItems: 'center', gap: 8 },
  emptyIcon:     { fontSize: 36, lineHeight: 44 },
  emptyTitle:    { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  emptySub:      { fontSize: 12, textAlign: 'center', lineHeight: 17 },
  postBtn:       { marginTop: 6, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  postBtnTxt:    { fontSize: 13, fontWeight: '800', color: '#fff' },
});

// ─── Agent Tile Component ──────────────────────────────────────────────────────
const AgentTile = React.memo(({ agent, onPress }: { agent: RawAgent; onPress: (id: string) => void }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const photoUrl = buildPhotoUrl(agent.profilePhoto);
  const firstName = ((agent.name ?? '?').trim().split(' ')[0] ?? '?').slice(0, 8);
  const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  const stars = agentStars(agent._id);
  const fullStars = Math.floor(stars);

  const handlePress = useCallback(() => onPress(agent._id), [onPress, agent._id]);

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.82} style={tile.wrap}>
      <View style={tile.avatarWrap}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={tile.avatar} />
        ) : (
          <View style={tile.avatarFallback}>
            <AppText style={tile.initials}>{formattedName.charAt(0)}</AppText>
          </View>
        )}
        <View style={tile.badge}>
          <AppText style={tile.badgeTick}>✓</AppText>
        </View>
      </View>
      <AppText style={[tile.name, { color: theme.colors.text }]} numberOfLines={1}>{formattedName}</AppText>
      <AppText style={tile.phone}>{maskPhone(agent._id)}</AppText>
      <View style={tile.stars}>
        {Array.from({ length: 5 }, (_, i) => (
          <AppText key={i} style={[tile.star, { color: i < fullStars ? '#22c55e' : i + 1 === Math.ceil(stars) && stars % 1 !== 0 ? '#fbbf24' : '#d1d5db' }]}>
            ★
          </AppText>
        ))}
      </View>
    </TouchableOpacity>
  );
});
AgentTile.displayName = 'AgentTile';

const MoreTile = React.memo(({ count, onPress }: { count: number; onPress: () => void }): React.JSX.Element => {
  const { t } = useTranslation('employer');
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82} style={tile.moreTile}>
      <AppText style={tile.moreCount}>+{count}</AppText>
      <AppText style={tile.moreLabel}>{t('moreWorkers')}</AppText>
    </TouchableOpacity>
  );
});
MoreTile.displayName = 'MoreTile';

const tile = StyleSheet.create({
  wrap:          { width: 80, alignItems: 'center', marginRight: 10 },
  avatarWrap:    { position: 'relative', marginBottom: 6 },
  avatar:        { width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, borderColor: '#2563eb' },
  avatarFallback:{ width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, borderColor: '#2563eb', alignItems: 'center', justifyContent: 'center', backgroundColor: '#dbeafe' },
  initials:      { fontSize: 22, fontWeight: '800', color: '#1d4ed8' },
  badge:         { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  badgeTick:     { color: '#fff', fontSize: 10, fontWeight: '800', lineHeight: 13 },
  name:          { fontSize: 12, fontWeight: '800', color: '#0f172a', textAlign: 'center', width: 80, textTransform: 'capitalize' },
  phone:         { fontSize: 10, fontWeight: '700', color: '#2563eb', textAlign: 'center', marginTop: 2 },
  stars:         { flexDirection: 'row', marginTop: 3 },
  star:          { fontSize: 10 },
  moreTile:      { width: 80, height: 100, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eff6ff', borderWidth: 1.5, borderColor: '#93c5fd', borderStyle: 'dashed', gap: 2, marginRight: 10 },
  moreCount:     { fontSize: 18, fontWeight: '800', color: '#1d4ed8' },
  moreLabel:     { fontSize: 10, fontWeight: '700', color: '#475569', lineHeight: 13 },
});


// ─── Worker Slider Card ────────────────────────────────────────────────────────
const WorkerSliderCard = React.memo(({
  agent, onPress,
}: { agent: RawAgent; onPress: (id: string) => void }): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const photoUrl = buildPhotoUrl(agent.profilePhoto);

  const age = (() => {
    if (!agent.dob) return null;
    const birth = new Date(String(agent.dob));
    if (isNaN(birth.getTime())) return null;
    const years = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return years > 10 && years < 80 ? years : null;
  })();

  const workType = (() => {
    if (!agent.areasOfWork?.length) return null;
    let areas: (string | null | undefined)[] = [...agent.areasOfWork];
    // Some backends store a JSON-stringified array as the first element — unwrap it
    const first = areas[0];
    if (typeof first === 'string' && first.trim().startsWith('[')) {
      try { const p = JSON.parse(first); if (Array.isArray(p)) areas = p; } catch {}
    }
    // Drop nulls / literal "null" strings
    const valid = areas.filter(
      (a): a is string => typeof a === 'string' && !!a && a.toLowerCase() !== 'null' && a.toLowerCase() !== 'undefined',
    );
    return valid.length > 0 ? valid.map(fmtLabel).join(' · ') : null;
  })();
  const location = [agent.district, agent.state].filter(Boolean).join(', ');

  const { workerTypeKey, workerTypeColor } = (() => {
    const st = (agent.workerSubType ?? '').toLowerCase();
    if (st.includes('iti') || st.includes('diploma')) return { workerTypeKey: 'workerCardITI', workerTypeColor: '#7C3AED' };
    if (st.includes('graduate') || st.includes('degree')) return { workerTypeKey: 'workerCardGraduate', workerTypeColor: '#0891B2' };
    if (st.includes('unskilled')) return { workerTypeKey: 'workerCardUnskilled', workerTypeColor: '#EA580C' };
    if (st.includes('skilled')) return { workerTypeKey: 'workerCardSkilled', workerTypeColor: '#059669' };
    return { workerTypeKey: null as string | null, workerTypeColor: '#64748B' };
  })();

  const initials = (agent.name ?? '?').trim().split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  const handlePress = useCallback(() => onPress(agent._id), [onPress, agent._id]);

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.87} style={wsc.card}>
      {/* Decorative background circles */}
      <View pointerEvents="none" style={wsc.bgCircle1} />
      <View pointerEvents="none" style={wsc.bgCircle2} />

      {/* Verified badge (top-left, only if verified) */}
      <View style={wsc.topRow}>
        {agent.veryfiedBage ? (
          <View style={wsc.verifiedBadge}>
            <AppText style={wsc.verifiedTxt}>✓ {t('workerCardVerified').replace('✓ ', '')}</AppText>
          </View>
        ) : <View />}
        <View />
      </View>

      {/* Photo */}
      <View style={wsc.photoWrap}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={wsc.photo} />
        ) : (
          <View style={wsc.photoFallback}>
            <AppText style={wsc.photoInitials}>{initials}</AppText>
          </View>
        )}
      </View>

      {/* Name */}
      <AppText style={wsc.name} numberOfLines={1}>
        {(agent.name ?? '').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}
      </AppText>

      {/* Age */}
      {age !== null && (
        <AppText style={wsc.age}>{t('workerCardAgeYrs', { age })}</AppText>
      )}

      {/* Work type chip */}
      {workType !== null && (
        <View style={wsc.workTypeChip}>
          <AppText style={wsc.workTypeTxt} numberOfLines={1}>{workType}</AppText>
        </View>
      )}

      {/* Location */}
      {!!location && (
        <View style={wsc.locationRow}>
          <AppText style={wsc.locationPin}>📍</AppText>
          <AppText style={wsc.locationTxt} numberOfLines={1}>{location}</AppText>
        </View>
      )}

      {/* Worker type badge */}
      {workerTypeKey !== null && (
        <View style={[wsc.workerTypeBadge, { backgroundColor: workerTypeColor + '22', borderColor: workerTypeColor + '66' }]}>
          <AppText style={[wsc.workerTypeTxt, { color: workerTypeKey === 'workerCardUnskilled' ? '#FF8800' : workerTypeColor }]}>
            {t(workerTypeKey as any)}
          </AppText>
        </View>
      )}
    </TouchableOpacity>
  );
});
WorkerSliderCard.displayName = 'WorkerSliderCard';

const wsc = StyleSheet.create({
  card: {
    width: 156,
    borderRadius: 22,
    backgroundColor: '#0F2F8C',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#0B1F6E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },
  bgCircle1:       { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)', top: -55, right: -45 },
  bgCircle2:       { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -22, left: -22 },
  topRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  verifiedBadge:   { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#16A34A', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  verifiedTxt:     { color: '#fff', fontSize: 9, fontWeight: '800' },
  ratingBadge:     { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  ratingStar:      { color: '#FCD34D', fontSize: 10, lineHeight: 13 },
  ratingVal:       { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  photoWrap:       { width: 74, height: 74, borderRadius: 37, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.32)', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A4BC2', marginTop: 8 },
  photo:           { width: 74, height: 74 },
  photoFallback:   { width: 74, height: 74, alignItems: 'center', justifyContent: 'center' },
  photoInitials:   { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  name:            { fontSize: 13, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', width: '100%', letterSpacing: -0.2 },
  age:             { fontSize: 11, color: 'rgba(255,255,255,0.62)', fontWeight: '500' },
  workTypeChip:    { backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', maxWidth: '100%' },
  workTypeTxt:     { color: '#E0ECFF', fontSize: 11, fontWeight: '700' },
  locationRow:     { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%' },
  locationPin:     { fontSize: 10 },
  locationTxt:     { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '500', flexShrink: 1 },
  workerTypeBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, marginTop: 2 },
  workerTypeTxt:   { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  // "View All" tile at end of slider
  moreCard:        { width: 108, borderRadius: 22, borderWidth: 2, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10 },
  moreCount:       { fontSize: 24, fontWeight: '900', color: '#1D4ED8' },
  moreTxt:         { fontSize: 11, fontWeight: '700', color: '#1D4ED8', textAlign: 'center', lineHeight: 15 },
});


// ─── Subscription Status Widget ────────────────────────────────────────────────
interface SubStatusProps {
  isSubscribed: boolean;
  isExpired: boolean;
  profileLoaded: boolean;
  remainingContacts: number;
  subscriptionExpery?: string;
  onSubscribe: () => void;
  onRenew: () => void;
  onTopUp: () => void;
}

const SubscriptionStatusWidget = React.memo(({
  isSubscribed, isExpired, profileLoaded, remainingContacts, subscriptionExpery,
  onSubscribe, onRenew, onTopUp,
}: SubStatusProps): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const [now, setNow] = useState(() => Date.now());

  // Update every minute so "X days left" recalculates in real-time
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!profileLoaded) return null;

  const expiryMs = subscriptionExpery ? new Date(subscriptionExpery).getTime() : null;
  const msLeft   = expiryMs != null ? expiryMs - now : null;
  const daysLeft = msLeft != null ? Math.ceil(msLeft / 86_400_000) : null;

  const isExpiringSoon = daysLeft != null && daysLeft > 0 && daysLeft <= 7;
  const isLowContacts  = remainingContacts < 10;

  const expiryColor = (isExpiringSoon || isExpired) ? '#DC2626' : '#059669';
  const contactColor = isLowContacts ? '#DC2626' : '#059669';
  const contactBg    = isLowContacts ? '#FEF2F2' : '#ECFDF5';
  const contactBdr   = isLowContacts ? '#FECACA' : '#6EE7B7';
  const expiryBg     = (isExpiringSoon || isExpired) ? '#FEF2F2' : '#ECFDF5';
  const expiryBdr    = (isExpiringSoon || isExpired) ? '#FECACA' : '#6EE7B7';

  const expiryLabel = (() => {
    if (!expiryMs) return '—';
    if (isExpired || (daysLeft != null && daysLeft <= 0)) return 'Expired';
    if (isExpiringSoon && daysLeft != null) return `${daysLeft}d left`;
    return new Date(expiryMs).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  })();

  /* ── Not subscribed — premium promo slider ── */
  if (!isSubscribed && !isExpired) {
    return <EmployerPromoSlider onPress={onSubscribe} />;
  }

  /* ── Subscribed (active or recently expired) ── */
  return (
    <TouchableOpacity
      onPress={isExpired ? onRenew : onTopUp}
      activeOpacity={0.9}
      style={[ssw.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
    >
      {/* Header row */}
      <View style={ssw.headerRow}>
        <View style={ssw.activeBadge}>
          <View style={[ssw.activeDot, { backgroundColor: isExpired ? '#DC2626' : '#16A34A' }]} />
          <AppText style={[ssw.activeLabel, { color: isExpired ? '#DC2626' : '#16A34A' }]}>
            {isExpired ? 'Subscription Expired' : t('premiumSubscription')}
          </AppText>
        </View>
        <TouchableOpacity
          onPress={isExpired ? onRenew : onTopUp}
          style={[ssw.actionBtn, { backgroundColor: isExpired ? '#FEF2F2' : '#EBF1FF', borderColor: isExpired ? '#FECACA' : '#BFDBFE' }]}
          activeOpacity={0.8}
        >
          <AppText style={[ssw.actionBtnTxt, { color: isExpired ? '#DC2626' : '#1037A4' }]}>
            {isExpired ? 'Renew' : t('topUp')}
          </AppText>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={ssw.statsRow}>
        {/* Remaining contacts */}
        <View style={[ssw.statBox, { backgroundColor: contactBg, borderColor: contactBdr }]}>
          <AppText style={ssw.statEmoji}>{'📞'}</AppText>
          <AppText style={[ssw.statNum, { color: contactColor }]}>{remainingContacts}</AppText>
          <AppText style={[ssw.statLabel, { color: contactColor }]}>
            {isLowContacts && remainingContacts === 0 ? 'No contacts' : 'Contacts left'}
          </AppText>
        </View>

        {/* Expiry */}
        <View style={[ssw.statBox, { backgroundColor: expiryBg, borderColor: expiryBdr }]}>
          <AppText style={ssw.statEmoji}>{'⏰'}</AppText>
          <AppText style={[ssw.statNum, { color: expiryColor, fontSize: isExpiringSoon || isExpired ? 16 : 13 }]}>
            {expiryLabel}
          </AppText>
          <AppText style={[ssw.statLabel, { color: expiryColor }]}>
            {isExpired ? 'Renew now' : isExpiringSoon ? 'Expiring soon!' : 'Expiry date'}
          </AppText>
        </View>
      </View>
    </TouchableOpacity>
  );
});
SubscriptionStatusWidget.displayName = 'SubscriptionStatusWidget';

const ssw = StyleSheet.create({
  // Active subscription card
  card:         { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 14, gap: 12, elevation: 2, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeBadge:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeDot:    { width: 8, height: 8, borderRadius: 4 },
  activeLabel:  { fontSize: 13, fontWeight: '800' },
  actionBtn:    { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5 },
  actionBtnTxt: { fontSize: 12, fontWeight: '800' },
  // Stats
  statsRow:     { flexDirection: 'row', gap: 10 },
  statBox:      { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 12, alignItems: 'center', gap: 3 },
  statEmoji:    { fontSize: 18, lineHeight: 22 },
  statNum:      { fontSize: 20, fontWeight: '900', lineHeight: 24 },
  statLabel:    { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },
});

// ─── Quick Action Card ─────────────────────────────────────────────────────────
interface QuickActionProps {
  title: string;
  subtitle: string;
  count: string | null;
  label: string;
  emoji: string;
  accentColor: string;
  iconBg: string;
  isLoading: boolean;
  onPress: () => void;
}
const QuickActionCard = React.memo(({
  title, subtitle, count, label, emoji, accentColor, iconBg, isLoading, onPress,
}: QuickActionProps): React.JSX.Element => (
  <TouchableOpacity onPress={isLoading ? undefined : onPress} activeOpacity={0.85} style={[qa.card]}>
    <View style={[qa.topAccent, { backgroundColor: accentColor }]} />
    <View style={qa.inner}>
      <View style={qa.topRow}>
        <View style={[qa.iconWrap, { backgroundColor: iconBg }]}>
          <AppText style={qa.emoji}>{emoji}</AppText>
        </View>
        <AppText style={qa.chevron}>›</AppText>
      </View>
      {isLoading || count === null ? (
        <View style={qa.skeleton} />
      ) : (
        <AppText style={qa.count} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{count}</AppText>
      )}
      <AppText style={qa.label} numberOfLines={1}>{label}</AppText>
      <AppText style={qa.title} numberOfLines={1}>{title}</AppText>
      <AppText style={qa.subtitle} numberOfLines={2}>{subtitle}</AppText>
    </View>
  </TouchableOpacity>
));
QuickActionCard.displayName = 'QuickActionCard';

const qa = StyleSheet.create({
  card:      { width: '48%', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', marginBottom: 12, overflow: 'hidden', elevation: 2, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  topAccent: { height: 4 },
  inner:     { padding: 14 },
  topRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  iconWrap:  { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  emoji:     { fontSize: 22, lineHeight: 26 },
  chevron:   { fontSize: 22, color: '#94a3b8', fontWeight: '600', lineHeight: 26 },
  skeleton:  { height: 26, width: '55%', borderRadius: 8, backgroundColor: '#e2e8f0', marginBottom: 4 },
  count:     { fontSize: 22, fontWeight: '900', color: '#0f172a', lineHeight: 26, marginBottom: 2 },
  label:     { fontSize: 10, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  title:     { fontSize: 13, fontWeight: '800', color: '#0f172a', marginBottom: 3 },
  subtitle:  { fontSize: 11, color: '#64748b', lineHeight: 15 },
});

// ─── Main Screen Component ─────────────────────────────────────────────────────
export const EmployerDashboardScreen = (): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const { state } = useAuth();
  const { config } = useAppConfig();
  const { pricing } = usePricingConfig();

  const REQ_TABS: Array<{ label: string; value: ReqTab }> = [
    { label: t('tabAll'),    value: 'all' },
    { label: t('tabOpen'),   value: 'open' },
    { label: t('tabClosed'), value: 'closed' },
  ];
  const user = state.session?.user;
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [reqTab, setReqTab]  = useState<ReqTab>('all');
  const [closeTarget, setCloseTarget] = useState<RawRequirement | null>(null);
  const [closingId, setClosingId]     = useState<string | null>(null);
  const [subModalVisible, setSubModalVisible] = useState(false);
  const [shortlistCount, setShortlistCount] = useState(0);


  // ── Network Queries ───────────────────────────────────────────────────────
  const dashQuery = useQuery({
    queryKey: ['employer-dashboard'],
    queryFn: async () => {
      const res = await apiClient.get<{ totalWorkerCount?: number }>('/api/v1/employer/dashboard');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const profileQuery = useQuery({
    queryKey: ['employer-full-profile'],
    queryFn: async () => {
      const res = await apiClient.get<{
        user?: {
          isSubscribed?: boolean;
          subscriptionExpery?: string;
          remainingContacts?: number;
          status?: string;
          phone?: string;
          employerType?: string;
          profilePhoto?: string;
          kyc?: { firmName?: string; gstNumber?: string };
        };
      }>('/api/v1/user/getuser');
      return res.data.user ?? null;
    },
    staleTime: 60 * 1000,       // 1 min — subscription changes must reflect quickly
    gcTime:    10 * 60 * 1000,
    refetchOnMount: true,
  });

  const profile = profileQuery.data;

  // Mirror the CRM: isSubscribed AND subscriptionExpery in the future
  const isSubscribed = (() => {
    if (!profile?.isSubscribed) return false;
    const exp = profile.subscriptionExpery;
    if (!exp) return true;
    return new Date(exp).getTime() > Date.now();
  })();

  // True when they were subscribed but the expiry date has passed
  const isExpired = (() => {
    if (!profileQuery.isSuccess || !profile?.isSubscribed) return false;
    const exp = profile.subscriptionExpery;
    if (!exp) return false;
    return new Date(exp).getTime() <= Date.now();
  })();

  const remainingContacts = profile?.remainingContacts ?? 0;

  // Resolve employerType string to one of the four known EmployerTypeKey values
  const resolvedEmployerType: EmployerTypeKey = (
    (['industry', 'agency', 'contractor', 'individual'] as const)
      .find((t) => String(profile?.employerType ?? user?.employerType ?? '').toLowerCase().includes(t))
  ) ?? 'individual';

  // Only show KYC warning when profile has loaded and status is explicitly 'Unverified'
  const kycUnverified = profileQuery.isSuccess && profile?.status === 'Unverified';

  const reqQuery = useQuery({
    queryKey: ['employer-requirements', user?.id],
    queryFn: () => requirementsApi.listForRole({
      role: 'employer',
      userId: user?.id,
      page: 1,
      limit: 100,
    }),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!user?.id,
  });

  const nearbyQuery = useQuery({
    queryKey: ['nearby-agents', user?.state, user?.district],
    queryFn: () => workerApi.getAllAgents({
      state: user?.state || undefined,
      district: user?.district || undefined,
      workerGroup: 'individual',
      page: 1,
      limit: 20,
    }),
    staleTime: 10 * 60 * 1000,
    enabled: !!user?.state,
  });

  const pipelineQuery = useQuery({
    queryKey: ['employer-pipeline-totals'],
    queryFn: async () => {
      const res = await workerMappingApi.getEmployerPipelineOverview();
      return res.totals;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: isSubscribed,
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => requirementsApi.close(id),
    onMutate: (id) => setClosingId(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['employer-requirements'] });
      setClosingId(null);
      toast.success(t('requirementClosed'), t('closedToast'));
    },
    onError: () => { setClosingId(null); toast.error(t('failedToClose')); },
  });

  // ── Memoized Computations ──────────────────────────────────────────────────
  const all = reqQuery.data?.requirements ?? [];
  const openCount   = useMemo(() => all.filter((r) => !isAssigned(r) && !isClosed(r)).length, [all]);
  const closedCount = useMemo(() => all.filter((r) => isClosed(r)).length, [all]);

  const filteredRequirements = useMemo(() => {
    return all.filter((r) => {
      if (reqTab === 'open')   return !isAssigned(r) && !isClosed(r);
      if (reqTab === 'closed') return isClosed(r);
      return true;
    });
  }, [all, reqTab]);

  const nearbyAgents: RawAgent[] = nearbyQuery.data?.rawAgents ?? [];
  const nearbyTotal = (nearbyQuery.data?.total ?? 0) + 150;
  const displayedNearby = useMemo(() => nearbyAgents.slice(0, NEARBY_SHOW), [nearbyAgents]);

  const interestedCount = useMemo(
    () => all.reduce((sum, r) => sum + (r.intrestedAgents?.length ?? 0), 0),
    [all],
  );

  const totalWorkersDisplay = formatStat(config.stats.workerCount);

  const isRefreshing = reqQuery.isFetching || profileQuery.isFetching;

  // Refetch profile whenever screen comes back into focus (e.g. returning from
  // payment screen) — only if the cache was invalidated (isStale = true)
  useFocusEffect(
    useCallback(() => {
      if (profileQuery.isStale) {
        void profileQuery.refetch();
      }
    }, [profileQuery]),
  );

  // Refresh shortlist badge count on every focus
  useFocusEffect(
    useCallback(() => {
      void shortlistStorage.getAll().then((ids) => setShortlistCount(ids.length));
    }, []),
  );

  // Auto-show subscription modal once for non-subscribed employers
  useEffect(() => {
    if (!profileQuery.isSuccess || isSubscribed) return;
    void AsyncStorage.getItem(EMPLOYER_SUB_MODAL_KEY).then((shown) => {
      if (!shown) {
        setSubModalVisible(true);
        void AsyncStorage.setItem(EMPLOYER_SUB_MODAL_KEY, '1');
      }
    });
  }, [profileQuery.isSuccess, isSubscribed]);

  // ── Callbacks ──────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    void reqQuery.refetch();
    void profileQuery.refetch();
    void nearbyQuery.refetch();
    void dashQuery.refetch();
    if (isSubscribed) void pipelineQuery.refetch();
  }, [reqQuery, profileQuery, nearbyQuery, dashQuery, pipelineQuery, isSubscribed]);

  const handlePost = useCallback(() => {
    if (profileQuery.isLoading) return;
    // No subscription or expired → go to pricing
    if (!isSubscribed) { navigation.navigate('Subscription'); return; }
    // Subscribed but all contacts used up → go to top-up
    if (remainingContacts <= 0) { navigation.navigate('Subscription'); return; }
    navigation.navigate('PostRequirement');
  }, [isSubscribed, remainingContacts, profileQuery.isLoading, navigation]);

  const handleWorkerSearchNavigate  = useCallback(() => navigation.navigate('WorkerSearch'), [navigation]);
  const handlePipelineNavigate      = useCallback(() => navigation.navigate('EmployerPipeline'), [navigation]);
  const handleCalendarNavigate      = useCallback(() => navigation.navigate('RequirementCalendar'), [navigation]);
  const handleSubscriptionNavigate = useCallback(() => navigation.navigate('Subscription'), [navigation]);
  const handleOpenSubModal = useCallback(() => setSubModalVisible(true), []);
  const handleAgentTilePress = useCallback((id: string) => navigation.navigate('WorkerProfile', { workerId: id }), [navigation]);
  const handleReqCardPress = useCallback((id: string) => navigation.navigate('RequirementDetail', { requirementId: id }), [navigation]);
  const handleReqCardClose = useCallback((req: RawRequirement) => setCloseTarget(req), []);

  // ── Render Sub-blocks for FlatList ──────────────────────────────────────────
  const renderHeader = useMemo(() => (
    <View>
      {/* ── Subscription Status Widget (always shown once profile loaded) ── */}
      <SubscriptionStatusWidget
        isSubscribed={isSubscribed}
        isExpired={isExpired}
        profileLoaded={profileQuery.isSuccess}
        remainingContacts={remainingContacts}
        subscriptionExpery={profile?.subscriptionExpery}
        onSubscribe={handleOpenSubModal}
        onRenew={handleSubscriptionNavigate}
        onTopUp={handleSubscriptionNavigate}
      />

      {/* ── Quick Action Cards ── */}
      <View style={styles.qaRow}>
        {/* Post Requirement */}
        <TouchableOpacity onPress={handlePost} activeOpacity={0.88} style={[styles.qaCard, styles.qaCardBlue]}>
          <View style={styles.qaCardInner}>
            <View style={styles.qaIconWrap}>
              <AppText style={styles.qaIcon}>⚡</AppText>
            </View>
            <View style={styles.qaNewBadge}>
              <AppText style={styles.qaNewTxt}>
                {openCount > 0 ? t('badgeActive') : t('badgePostNew')}
              </AppText>
            </View>
          </View>
          <AppText style={styles.qaCount}>
            {reqQuery.isLoading ? '—' : String(openCount)}
          </AppText>
          <AppText style={styles.qaTitle}>{t('postRequirement')}</AppText>
          <AppText style={styles.qaSub}>
            {openCount > 0 ? t(openCount === 1 ? 'activeRequirements' : 'activeRequirements_plural', { count: openCount }) : t('publishNew')}
          </AppText>
          <View style={styles.qaArrow}>
            <AppText style={styles.qaArrowTxt}>→</AppText>
          </View>
        </TouchableOpacity>

        {/* Browse Workers */}
        <TouchableOpacity onPress={handleWorkerSearchNavigate} activeOpacity={0.88} style={[styles.qaCard, styles.qaCardGreen]}>
          <View style={styles.qaCardInner}>
            <View style={[styles.qaIconWrap, styles.qaIconWrapGreen]}>
              <AppText style={styles.qaIcon}>👷</AppText>
            </View>
            <View style={[styles.qaNewBadge, styles.qaNewBadgeGreen]}>
              <AppText style={[styles.qaNewTxt, { color: '#065f46' }]}>{t('badgeAvailable')}</AppText>
            </View>
          </View>
          <AppText style={[styles.qaCount, styles.qaCountGreen]}>{totalWorkersDisplay}</AppText>
          <AppText style={[styles.qaTitle, styles.qaTitleGreen]}>{t('browseWorkers')}</AppText>
          <AppText style={[styles.qaSub, styles.qaSubGreen]}>{t('exploreVerified')}</AppText>
          <View style={[styles.qaArrow, styles.qaArrowGreen]}>
            <AppText style={[styles.qaArrowTxt, { color: '#065f46' }]}>→</AppText>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Nearby Workers — CRM NearbyWorkersSection style ── */}
      <View style={[nws.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        {/* Header */}
        <View style={nws.header}>
          <View style={nws.headerLeft}>
            <AppText style={[nws.title, { color: theme.colors.text }]}>{t('workersNearYou')}</AppText>
            {nearbyQuery.isSuccess && nearbyTotal > 0 && (
              <View style={nws.countPill}>
                <AppText style={nws.countPillTxt}>
                  {nearbyTotal >= 1000
                    ? `${(nearbyTotal / 1000).toFixed(1).replace(/\.0$/, '')}K+`
                    : String(nearbyTotal)}
                </AppText>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={handleWorkerSearchNavigate} activeOpacity={0.7}>
            <AppText style={nws.viewAllTxt}>{t('viewAll')}</AppText>
          </TouchableOpacity>
        </View>
        <AppText style={[nws.sub, { color: theme.colors.mutedText }]}>
          {t('verifiedWorkersIn', { location: user?.district ?? user?.state ?? 'your area' })}
        </AppText>

        {nearbyQuery.isLoading ? (
          <View style={nws.loadWrap}>
            <ActivityIndicator color="#ea580c" size="small" />
          </View>
        ) : displayedNearby.length === 0 ? (
          <View style={nws.emptyWrap}>
            <AppText style={[nws.emptyTxt, { color: theme.colors.mutedText }]}>{t('noWorkersNear', { location: user?.district ?? 'your location' })}</AppText>
            <TouchableOpacity onPress={handleWorkerSearchNavigate} style={nws.browseBtn} activeOpacity={0.8}>
              <AppText style={nws.browseBtnTxt}>{t('browseAllWorkers')}</AppText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={nws.sliderContent}
              snapToInterval={168}
              decelerationRate="fast"
              snapToAlignment="start"
            >
              {displayedNearby.map((agent) => (
                <WorkerSliderCard key={agent._id} agent={agent} onPress={handleAgentTilePress} />
              ))}
              {/* View-all tile at end */}
              <TouchableOpacity onPress={handleWorkerSearchNavigate} activeOpacity={0.82} style={[wsc.moreCard, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface1 }]}>
                <AppText style={[wsc.moreCount, { color: theme.colors.primary }]}>
                  {nearbyTotal >= 1000
                    ? `${(nearbyTotal / 1000).toFixed(nearbyTotal >= 10000 ? 0 : 1)}K+`
                    : String(nearbyTotal)}
                </AppText>
                <AppText style={[wsc.moreTxt, { color: theme.colors.primary }]}>{t('viewAllWorkers')}</AppText>
              </TouchableOpacity>
            </ScrollView>
            {/* Footer */}
            <View style={[nws.footer, { borderTopColor: theme.colors.divider }]}>
              <AppText style={[nws.footerTxt, { color: theme.colors.mutedText }]}>
                {t('workersAvailableNear', { count: nearbyTotal.toLocaleString('en-IN') })}
              </AppText>
              <TouchableOpacity onPress={handleWorkerSearchNavigate} activeOpacity={0.7}>
                <AppText style={nws.footerLink}>{t('viewAllWorkers')}</AppText>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* ── Requirements Card ── */}
      <View style={[reqCard.wrap, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>

        {/* Card header */}
        <View style={reqCard.header}>
          <View style={reqCard.headerLeft}>
            <AppText style={[reqCard.title, { color: theme.colors.text }]}>{t('newRequirements')}</AppText>
            {all.length > 0 && (
              <View style={[reqCard.countPill, { backgroundColor: theme.colors.primary + '18', borderColor: theme.colors.primary + '40' }]}>
                <AppText style={[reqCard.countPillTxt, { color: theme.colors.primary }]}>{all.length}</AppText>
              </View>
            )}
            {reqQuery.isFetching && !isRefreshing && (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            )}
          </View>
          <TouchableOpacity onPress={handlePost} activeOpacity={0.8} style={[reqCard.postBtn, { backgroundColor: theme.colors.primary }]}>
            <AppText style={reqCard.postBtnTxt}>＋ {t('postRequirement')}</AppText>
          </TouchableOpacity>
        </View>

        {/* Tab row */}
        <View style={[reqCard.tabRow, { borderColor: theme.colors.border }]}>
          {REQ_TABS.map((t) => {
            const count = t.value === 'open' ? openCount : t.value === 'closed' ? closedCount : all.length;
            const active = reqTab === t.value;
            return (
              <TouchableOpacity
                key={t.value}
                onPress={() => setReqTab(t.value)}
                style={[reqCard.tab, active && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }]}
              >
                <AppText style={[reqCard.tabLabel, { color: active ? theme.colors.primary : theme.colors.mutedText }]}>
                  {t.label}
                </AppText>
                <View style={[reqCard.tabBadge, { backgroundColor: active ? theme.colors.primary : theme.colors.border }]}>
                  <AppText style={reqCard.tabBadgeTxt}>{count}</AppText>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Carousel */}
        <RequirementCarousel
          requirements={filteredRequirements}
          onPress={handleReqCardPress}
          onClose={handleReqCardClose}
          closingId={closingId}
          isLoading={reqQuery.isLoading}
          onPost={handlePost}
          tab={reqTab}
          allCount={all.length}
          t={t}
          themeColors={theme.colors}
        />
      </View>

      {/* ── Hiring Pipeline strip (subscribed only) ── */}
      {isSubscribed && (
        <TouchableOpacity
          onPress={handlePipelineNavigate}
          activeOpacity={0.85}
          style={[pip.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginTop: 12 }]}
        >
          <View style={pip.header}>
            <View style={pip.titleRow}>
              <View style={pip.titleDot} />
              <AppText style={[pip.title, { color: theme.colors.text }]}>{t('hiringPipeline')}</AppText>
            </View>
            <View style={pip.viewAllRow}>
              <AppText style={pip.viewAll}>{t('viewAll')}</AppText>
              <AppText style={[pip.viewAll, { opacity: 0.7 }]}>{' ›'}</AppText>
            </View>
          </View>
          <View style={pip.row}>
            {([
              { key: 'Shortlisted' as const, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', darkBg: '#1E3A8A22', darkBorder: '#3B82F655', emoji: '🔖' },
              { key: 'Selected'    as const, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', darkBg: '#5B21B622', darkBorder: '#8B5CF655', emoji: '✅' },
              { key: 'Joined'      as const, color: '#059669', bg: '#ECFDF5', border: '#6EE7B7', darkBg: '#06543622', darkBorder: '#34D39955', emoji: '🤝' },
            ] as const).map((s) => {
              const isDark = theme.mode === 'dark';
              const cellBg = isDark ? s.darkBg : s.bg;
              const cellBorder = isDark ? s.darkBorder : s.border;
              return (
                <View key={s.key} style={[pip.cell, { backgroundColor: cellBg, borderColor: cellBorder }]}>
                  <AppText style={pip.cellEmoji}>{s.emoji}</AppText>
                  <AppText style={[pip.count, { color: s.color }]}>
                    {pipelineQuery.isLoading ? '—' : String(pipelineQuery.data?.[s.key] ?? 0)}
                  </AppText>
                  <AppText style={[pip.label, { color: s.color }]}>
                    {t(s.key.toLowerCase() as 'shortlisted' | 'selected' | 'joined')}
                  </AppText>
                </View>
              );
            })}
          </View>
        </TouchableOpacity>
      )}

      {/* ── Requirement Calendar strip ── */}
      <TouchableOpacity
        onPress={handleCalendarNavigate}
        activeOpacity={0.85}
        style={[calStrip.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginTop: 12 }]}
      >
        <View style={calStrip.left}>
          <View style={[calStrip.iconWrap, { backgroundColor: '#EFF6FF' }]}>
            <AppText style={calStrip.icon}>📅</AppText>
          </View>
          <View style={calStrip.text}>
            <AppText style={[calStrip.title, { color: theme.colors.text }]}>{t('requirementCalendar')}</AppText>
            <AppText style={[calStrip.sub, { color: theme.colors.mutedText }]}>{t('calendarSubtitle')}</AppText>
          </View>
        </View>
        <AppText style={[calStrip.arrow, { color: theme.colors.mutedText }]}>›</AppText>
      </TouchableOpacity>

    </View>
  ), [theme, user, isSubscribed, handleSubscriptionNavigate, handleOpenSubModal, reqQuery.isSuccess, reqQuery.isLoading, reqQuery.isFetching, all.length, openCount, closedCount, interestedCount, handlePost, handleWorkerSearchNavigate, nearbyQuery.isLoading, nearbyQuery.isSuccess, displayedNearby, nearbyTotal, reqTab, handleAgentTilePress, isRefreshing, profileQuery.isSuccess, totalWorkersDisplay, shortlistCount, handlePipelineNavigate, handleCalendarNavigate, pipelineQuery.isLoading, pipelineQuery.data, filteredRequirements, handleReqCardPress, handleReqCardClose, closingId]);

  const renderFooter = useMemo(() => (
    <View>
      {/* ── Upgrade Banner (non-subscribers only) ── */}
      {profileQuery.isSuccess && !isSubscribed && (
        <View style={[ub.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={[ub.iconWrap, { backgroundColor: theme.colors.primaryLight }]}>
            <AppText style={ub.icon}>🚀</AppText>
          </View>
          <View style={ub.body}>
            <AppText style={[ub.title, { color: theme.colors.text }]}>{t('upgradeToPremium')}</AppText>
            <AppText style={[ub.desc, { color: theme.colors.mutedText }]}>{t('upgradeBannerDesc')}</AppText>
            <View style={[ub.features, { backgroundColor: theme.colors.surface1 }]}>
              {([
                t('featureTopPriority'),
                t('featureFeaturedBadge'),
                t('featureUnlimitedPosts'),
                t('featurePrioritySupport'),
              ] as string[]).map((f) => (
                <View key={f} style={ub.featureRow}>
                  <AppText style={ub.featureTick}>✅</AppText>
                  <AppText style={[ub.featureTxt, { color: theme.colors.textSecondary }]}>{f}</AppText>
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={handleSubscriptionNavigate} style={ub.btn} activeOpacity={0.85}>
              <AppText style={ub.btnTxt}>{t('upgradeNow')}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Support Footer ── */}
      <View style={[sf.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <AppText style={[sf.sectionLabel, { color: theme.colors.mutedText }]}>Support</AppText>
        {[
          { emoji: '🎧', title: t('needHelp'),         desc: t('supportTeamReady'),            iconBg: '#EBF1FF', iconColor: '#1037A4' },
          { emoji: '💬', title: t('support'),           desc: config.contact.supportEmail,       iconBg: '#ECFDF5', iconColor: '#059669' },
          { emoji: '💼', title: t('businessSupport'),   desc: config.contact.businessEmail,      iconBg: '#FFF7ED', iconColor: '#D97706' },
        ].map(({ emoji, title, desc, iconBg, iconColor }, i, arr) => (
          <View key={title} style={[sf.row, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider }]}>
            <View style={[sf.iconBox, { backgroundColor: iconBg }]}>
              <AppText style={sf.iconEmoji}>{emoji}</AppText>
            </View>
            <View style={sf.text}>
              <AppText style={[sf.title, { color: theme.colors.text }]}>{title}</AppText>
              <AppText style={[sf.desc, { color: theme.colors.mutedText }]}>{desc}</AppText>
            </View>
            <AppText style={[sf.chevron, { color: theme.colors.mutedText }]}>›</AppText>
          </View>
        ))}
      </View>
    </View>
  ), [theme, profileQuery.isSuccess, isSubscribed, handleSubscriptionNavigate, navigation]);

  const refreshControlComponent = useMemo(() => (
    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
  ), [isRefreshing, handleRefresh, theme.colors.primary]);

  return (
    <>
      {/* ── Fixed Hero Header ────────────────────────────────────────────── */}
      <StatusBar barStyle="light-content" backgroundColor="#1037A4" />
      <View style={[fh.wrap, { paddingTop: insets.top + 8 }]}>
        <View style={fh.circle1} />
        <View style={fh.circle2} />
        {/* Top brand bar */}
        <View style={fh.brandRow}>
          <View style={fh.brandLeft}>
            <BrandLogo style={fh.brandLogoImg} />
            <AppText style={fh.brandLogo}>BookMyWorker</AppText>
          </View>
          <View style={fh.headerActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('ChatRoom', {
                roomId: `support_${user?.id ?? ''}`,
                roomName: 'Support Chat',
              })}
              style={fh.shortlistBtn}
              activeOpacity={0.8}
            >
              <AppText style={fh.shortlistIcon}>💬</AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Notifications')} activeOpacity={0.8}>
              <Avatar name={user?.fullName ?? 'E'} size={38} uri={buildPhotoUrl(profile?.profilePhoto)} ring ringColor="rgba(255,255,255,0.55)" />
            </TouchableOpacity>
          </View>
        </View>
        {/* Greeting + subscription status — lives inside the header */}
        <View style={fh.greetRow}>
          <View style={{ flex: 1 }}>
            <AppText style={fh.greetName}>
              {t(getGreetingKey())}, {(user?.fullName ?? 'Employer').split(' ')[0]}!
            </AppText>
            <AppText style={fh.greetStatus} numberOfLines={1}>
              {kycUnverified
                ? t('dashGreetSub_pending')
                : isSubscribed
                ? t('dashGreetSub_premium', { count: remainingContacts })
                : t('dashGreetSub_welcome')}
            </AppText>
          </View>
          <AppText style={fh.greetEmoji}>{'👋'}</AppText>
        </View>
      </View>

      {/* ── Subscription Upsell Modal ──────────────────────────────────── */}
      <EmployerSubscriptionModal
        visible={subModalVisible}
        onDismiss={() => setSubModalVisible(false)}
        userName={user?.fullName ?? 'Employer'}
        employerType={resolvedEmployerType}
      />

      {/* ── Scrollable Body — lifts over header with rounded top ───────── */}
      <View style={[fh.body, { backgroundColor: theme.colors.background }]}>
        <FlatList
          data={[]}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={refreshControlComponent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          renderItem={() => null}
        />
      </View>

      {/* ── Close Confirm Modal ───────────────────────────────────────── */}
      <Modal visible={!!closeTarget} animationType="fade" transparent onRequestClose={() => setCloseTarget(null)}>
        <View style={confirm.overlay}>
          <View style={[confirm.dialog, { backgroundColor: theme.colors.card }]}>
            {/* Red warning header */}
            <View style={confirm.header}>
              <View style={confirm.iconWrap}>
                <AppText style={confirm.iconEmoji}>⚠️</AppText>
              </View>
              <AppText style={confirm.headerTitle}>{t('closeRequirementTitle')}</AppText>
            </View>

            {/* Body */}
            <View style={confirm.body}>
              <AppText style={[confirm.reqName, { color: theme.colors.text }]}>
                "{fmtLabel(closeTarget?.workType)}"
              </AppText>
              <AppText style={[confirm.bodyMsg, { color: theme.colors.mutedText }]}>
                {t('closeRequirementBody')}
              </AppText>
            </View>

            {/* Actions */}
            <View style={confirm.actions}>
              <TouchableOpacity
                onPress={() => setCloseTarget(null)}
                style={[confirm.btn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              >
                <AppText style={[confirm.btnTxt, { color: theme.colors.text }]}>{t('cancel')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!closeTarget) return;
                  closeMutation.mutate(closeTarget._id);
                  setCloseTarget(null);
                }}
                style={[confirm.btn, confirm.btnDanger]}
              >
                <AppText style={[confirm.btnTxt, { color: '#fff' }]}>{t('yesCloseIt')}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Profile-completion popup disabled for now. */}
      {/* {user && <ProfileCompletionModal user={user} />} */}

      <GuidedTour
        tourKey="employer_tour_v1"
        steps={[
          { icon: t('tour_emp_1_icon'), title: t('tour_emp_1_title'), desc: t('tour_emp_1_desc') },
          { icon: t('tour_emp_2_icon'), title: t('tour_emp_2_title'), desc: t('tour_emp_2_desc') },
          { icon: t('tour_emp_3_icon'), title: t('tour_emp_3_title'), desc: t('tour_emp_3_desc') },
          { icon: t('tour_emp_4_icon'), title: t('tour_emp_4_title'), desc: t('tour_emp_4_desc') },
          { icon: t('tour_emp_5_icon'), title: t('tour_emp_5_title'), desc: t('tour_emp_5_desc') },
        ]}
        skipLabel={t('tour_skip')}
        nextLabel={t('tour_next')}
        backLabel={t('tour_back')}
        finishLabel={t('tour_getStarted')}
        stepOfLabel={t('tour_stepOf')}
      />
    </>
  );
};

const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { padding: 16, paddingBottom: 40 },

  // ── Quick Action Cards ──────────────────────────────────────────────────────
  qaRow:          { flexDirection: 'row', gap: 12, marginBottom: 16 },
  qaCard:         { flex: 1, borderRadius: 20, padding: 12, overflow: 'hidden', elevation: 4, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12, minHeight: 120 },
  qaCardBlue:     { backgroundColor: '#1037A4', shadowColor: '#1037A4' },
  qaCardGreen:    { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', shadowColor: '#059669', elevation: 2, shadowOpacity: 0.08 },
  qaCardInner:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  qaIconWrap:     { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  qaIconWrapGreen:{ backgroundColor: '#D1FAE5' },
  qaIcon:         { fontSize: 18, lineHeight: 22 },
  qaNewBadge:     { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  qaNewBadgeGreen:{ backgroundColor: '#A7F3D0' },
  qaNewTxt:       { fontSize: 8, fontWeight: '900', color: 'rgba(255,255,255,0.9)' },
  qaCount:        { fontSize: 20, fontWeight: '900', color: '#FFFFFF', lineHeight: 22, marginBottom: 1 },
  qaCountGreen:   { color: '#065F46', fontSize: 17 },
  qaTitle:        { fontSize: 12, fontWeight: '800', color: '#FFFFFF', marginBottom: 1 },
  qaTitleGreen:   { color: '#065F46' },
  qaSub:          { fontSize: 10, color: 'rgba(255,255,255,0.72)', lineHeight: 13, flex: 1 },
  qaSubGreen:     { color: '#047857' },
  qaArrow:        { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end', marginTop: 4 },
  qaArrowGreen:   { backgroundColor: '#A7F3D0' },
  qaArrowTxt:     { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle:  { fontSize: 16, fontWeight: '800' },

  tabRow:    { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
  tab:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 5, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabel:  { fontWeight: '600', fontSize: 13 },
  tabBadge:  { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: 'center' },
  tabBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },

});

// ─── Nearby Workers Section Styles ────────────────────────────────────────────
const nws = StyleSheet.create({
  card:         { borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20 },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
  headerLeft:   { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  title:        { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  countPill:    { backgroundColor: '#fff7ed', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#fed7aa' },
  countPillTxt: { fontSize: 11, fontWeight: '700', color: '#ea580c' },
  sub:          { fontSize: 11, paddingHorizontal: 14, paddingBottom: 6 },
  viewAllTxt:   { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  loadWrap:     { paddingVertical: 28, alignItems: 'center' },
  emptyWrap:    { paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', gap: 10 },
  emptyTxt:     { fontSize: 13, color: '#64748b', textAlign: 'center' },
  browseBtn:    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#ea580c' },
  browseBtnTxt: { fontSize: 12, fontWeight: '700', color: '#ea580c' },
  sliderContent:{ paddingHorizontal: 14, paddingBottom: 16, paddingTop: 6, gap: 12 },
  footer:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f1f5f9' },
  footerTxt:    { fontSize: 11, color: '#94a3b8', fontWeight: '500', flex: 1 },
  footerLink:   { fontSize: 12, fontWeight: '700', color: '#2563eb' },
});


// ─── Upgrade Banner Styles ─────────────────────────────────────────────────────
const ub = StyleSheet.create({
  card:        { borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', backgroundColor: '#fff', padding: 18, marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  iconWrap:    { width: 60, height: 60, borderRadius: 30, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  icon:        { fontSize: 28 },
  body:        { flex: 1, gap: 6 },
  title:       { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  desc:        { fontSize: 12, color: '#64748b', lineHeight: 17 },
  features:    { gap: 6, marginTop: 4 },
  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureTick: { fontSize: 13 },
  featureTxt:  { fontSize: 12, color: '#374151' },
  btn:         { marginTop: 10, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  btnTxt:      { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
});

// ─── Support Footer Styles ─────────────────────────────────────────────────────
const sf = StyleSheet.create({
  card:         { borderRadius: 20, borderWidth: 1, padding: 4, marginBottom: 8, elevation: 2, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 },
  sectionLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  iconBox:      { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconEmoji:    { fontSize: 18 },
  text:         { flex: 1 },
  title:        { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  desc:         { fontSize: 11, lineHeight: 15, fontWeight: '500' },
  chevron:      { fontSize: 20, opacity: 0.35 },
});

const confirm = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog:      { width: '100%', borderRadius: 20, overflow: 'hidden', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20 },
  header:      { backgroundColor: '#B91C1C', paddingVertical: 20, paddingHorizontal: 24, alignItems: 'center', gap: 10 },
  iconWrap:    { width: 52, height: 52, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  iconEmoji:   { fontSize: 26, lineHeight: 32 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff', textAlign: 'center' },
  body:        { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16, gap: 6, alignItems: 'center' },
  reqName:     { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  bodyMsg:     { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  actions:     { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 4 },
  btn:         { flex: 1, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  btnDanger:   { backgroundColor: '#DC2626', borderColor: 'transparent', shadowColor: '#DC2626', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnTxt:      { fontSize: 14, fontWeight: '700' },
});

// ─── Subscription Upsell Banner ───────────────────────────────────────────────
const subBanner = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1037A4', borderRadius: 14, padding: 12, marginBottom: 14 },
  iconWrap:{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  icon:    { fontSize: 18, lineHeight: 22 },
  body:    { flex: 1, gap: 1 },
  title:   { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  sub:     { fontSize: 11, color: 'rgba(255,255,255,0.72)' },
  arrow:   { fontSize: 18, color: 'rgba(255,255,255,0.8)', fontWeight: '700' },
});

// ── Subscription expired banner ────────────────────────────────────────────────
const expBanner = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF7ED', borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1.5, borderColor: '#FED7AA' },
  iconWrap:{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center' },
  icon:    { fontSize: 18, lineHeight: 22 },
  body:    { flex: 1, gap: 1 },
  title:   { fontSize: 13, fontWeight: '800', color: '#C2410C' },
  sub:     { fontSize: 11, color: '#EA580C', lineHeight: 15 },
  btn:     { backgroundColor: '#EA580C', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  btnTxt:  { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
});

// ─── Pipeline Strip Styles ─────────────────────────────────────────────────────
const calStrip = StyleSheet.create({
  card:     { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 1, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
  left:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  icon:     { fontSize: 20, lineHeight: 24 },
  text:     { gap: 2 },
  title:    { fontSize: 14, fontWeight: '800' },
  sub:      { fontSize: 11, fontWeight: '500' },
  arrow:    { fontSize: 22, fontWeight: '700', opacity: 0.5 },
});

const pip = StyleSheet.create({
  card:       { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 14, elevation: 2, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  titleRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleDot:   { width: 5, height: 18, borderRadius: 3, backgroundColor: '#7C3AED' },
  title:      { fontSize: 15, fontWeight: '900', letterSpacing: 0.1 },
  viewAllRow: { flexDirection: 'row', alignItems: 'center' },
  viewAll:    { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  row:        { flexDirection: 'row', gap: 10 },
  cell:       { flex: 1, borderRadius: 16, borderWidth: 1.5, paddingVertical: 14, alignItems: 'center', gap: 4 },
  cellEmoji:  { fontSize: 20, lineHeight: 24 },
  count:      { fontSize: 24, fontWeight: '900', lineHeight: 28 },
  label:      { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
});

const fh = StyleSheet.create({
  wrap:          { backgroundColor: '#1037A4', paddingHorizontal: 20, paddingBottom: 32, overflow: 'hidden' },
  circle1:       { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', width: 220, height: 220, top: -80, right: -60 },
  circle2:       { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', width: 140, height: 140, bottom: -45, left: -30 },
  // Brand bar: logo + actions + avatar
  brandRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  brandLeft:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandLogoImg:      { width: 28, height: 28, borderRadius: 6 },
  brandLogo:         { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  headerActions:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shortlistBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  shortlistIcon:     { fontSize: 19, lineHeight: 22 },
  shortlistBadge:    { position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#1037A4' },
  shortlistBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '900', lineHeight: 12 },
  // User + verification status
  userBar:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name:          { fontSize: 17, fontWeight: '800', color: '#fff', flex: 1 },
  pendingBadge:  { backgroundColor: '#f59e0b', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  pendingBadgeTxt:{ fontSize: 11, fontWeight: '800', color: '#fff' },
  proBadge:      { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  proBadgeTxt:   { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  // Greeting row inside the hero header
  greetRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  greetName:     { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 2, letterSpacing: -0.2 },
  greetStatus:   { fontSize: 12, color: 'rgba(255,255,255,0.82)', fontWeight: '500' },
  greetEmoji:    { fontSize: 24, lineHeight: 28 },
  // Body lifts over hero
  body:          { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -20, overflow: Platform.OS === 'android' ? 'hidden' : 'visible' },
});

// ─── Requirements Card (unified section wrapper) ──────────────────────────────
const reqCard = StyleSheet.create({
  wrap:        { borderRadius: 16, borderWidth: 1, marginBottom: 14, overflow: 'hidden', elevation: 1, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },

  // Header row
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  title:       { fontSize: 15, fontWeight: '800', letterSpacing: -0.1 },
  countPill:   { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  countPillTxt:{ fontSize: 11, fontWeight: '800' },

  // Post button
  postBtn:     { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  postBtnTxt:  { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },

  // Tab row
  tabRow:      { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 0 },
  tab:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 5, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabel:    { fontWeight: '600', fontSize: 13 },
  tabBadge:    { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: 'center' },
  tabBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
});

