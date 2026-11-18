import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../../../core/theme';
import type { RawAgent } from '../../../../core/api/endpoints/workerApi';
// Profile-completion nudge disabled for now — mandatory completion is enforced
// via the post-OTP WorkerProfileCompletionScreen instead.
// import { ProfileCompletionModal } from '../../../../shared/components/ui/ProfileCompletionModal';
import { AppText } from '../../../../shared/components/ui/AppText';
import { Avatar } from '../../../../shared/components/ui/Avatar';
import { buildPhotoUrl } from '../../../../core/config/env';
import { FadeInView, useReduceMotion } from '../../../../shared/components/motion';
import i18n from '../../../../core/i18n';
import { useTranslation } from 'react-i18next';
import { translateLocationString } from '../../../../shared/utils/labelUtils';
import { subcatDisplay } from '../../../../shared/data/categoryLabels';

import { maskPhone, agentStars } from './dashboardShared';

// ─── Agent Tile Component ──────────────────────────────────────────────────────
export const AgentTile = React.memo(({ agent, onPress }: { agent: RawAgent; onPress: (id: string) => void }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const photoUrl = buildPhotoUrl(agent.profilePhoto);
  const firstName = ((agent.name ?? '?').trim().split(' ')[0] ?? '?').slice(0, 8);
  const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  const stars = agentStars(agent._id);
  const fullStars = Math.floor(stars);

  const handlePress = useCallback(() => onPress(agent._id), [onPress, agent._id]);

  return (
    <TouchableOpacity accessibilityRole="button" onPress={handlePress} activeOpacity={0.82} style={tile.wrap}>
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

export const MoreTile = React.memo(({ count, onPress }: { count: number; onPress: () => void }): React.JSX.Element => {
  const { t } = useTranslation('employer');
  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} activeOpacity={0.82} style={tile.moreTile}>
      <AppText style={tile.moreCount}>+{count}</AppText>
      <AppText style={tile.moreLabel}>{t('moreWorkers')}</AppText>
    </TouchableOpacity>
  );
});
MoreTile.displayName = 'MoreTile';

export const tile = StyleSheet.create({
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
export const WorkerSliderCard = React.memo(({
  agent, onPress,
}: { agent: RawAgent; onPress: (id: string) => void }): React.JSX.Element => {
  // Subscribe to i18n so this memoized card re-renders when the language changes
  // (the app boots in English then switches to the user's language — without this
  // subscription the role chips stay in the boot language).
  const { i18n: i18nInstance } = useTranslation();
  const lang = i18nInstance.language;
  const photoUrl = buildPhotoUrl(agent.profilePhoto);

  const workType = useMemo(() => {
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
    return valid.length > 0 ? valid.map(subcatDisplay).join(' · ') : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.areasOfWork, lang]);
  const location = translateLocationString([agent.district, agent.state].filter(Boolean).join(', '), lang);

  // Colored avatar when there's no profile photo (matches the Figma colored-initial circles)
  const AVATAR_PALETTE = ['#E5683C', '#C0392B', '#2C50D6', '#0E8A6B', '#6D3FD6', '#B8336A', '#0F7A8A', '#C2410C'];
  const avatarColor = AVATAR_PALETTE[((agent.name ?? '?').charCodeAt(0) || 0) % AVATAR_PALETTE.length];

  const initials =(agent.name ?? '?').trim().split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  const handlePress = useCallback(() => onPress(agent._id), [onPress, agent._id]);

  return (
    <TouchableOpacity accessibilityRole="button" onPress={handlePress} activeOpacity={0.87} style={wsc.card}>
      {/* Subtle gradient + decorative circles */}
      <View pointerEvents="none" style={wsc.grad} />
      <View pointerEvents="none" style={wsc.bgCircle1} />
      <View pointerEvents="none" style={wsc.bgCircle2} />

      {/* Avatar — photo, or colored initials */}
      <View style={[wsc.photoWrap, !photoUrl && { backgroundColor: avatarColor }]}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={wsc.photo} />
        ) : (
          <AppText style={wsc.photoInitials}>{initials}</AppText>
        )}
      </View>

      {/* Name — shown in full (wraps to 2 lines instead of truncating with …) */}
      <AppText style={wsc.name} numberOfLines={2}>
        {(agent.name ?? '').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}
      </AppText>

      {/* Role chip */}
      {workType !== null && (
        <View style={wsc.workTypeChip}>
          <AppText style={wsc.workTypeTxt} numberOfLines={2}>{workType}</AppText>
        </View>
      )}

      {/* Location */}
      {!!location && (
        <View style={wsc.locationRow}>
          <AppText style={wsc.locationPin}>📍</AppText>
          <AppText style={wsc.locationTxt} numberOfLines={1}>{location}</AppText>
        </View>
      )}
    </TouchableOpacity>
  );
});
WorkerSliderCard.displayName = 'WorkerSliderCard';

export const wsc = StyleSheet.create({
  card: {
    width: 112,
    borderRadius: 16,
    backgroundColor: '#2243BC',
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#0B1F6E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
  },
  // Fake vertical gradient (#2243BC top → #1B379A bottom)
  grad:            { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%', backgroundColor: '#1B379A', opacity: 0.55 },
  bgCircle1:       { position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.06)', top: -36, right: -28 },
  bgCircle2:       { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -14, left: -14 },
  photoWrap:       { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A4BC2', marginTop: 2 },
  photo:           { width: 46, height: 46 },
  photoInitials:   { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  // Full name, never truncated — up to 2 lines, so a longer name still shows in full.
  name:            { fontSize: 12.5, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', width: '100%', letterSpacing: -0.1, lineHeight: 15 },
  workTypeChip:    { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3.5, maxWidth: '100%' },
  workTypeTxt:     { color: '#FFFFFF', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  locationRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, maxWidth: '100%' },
  locationPin:     { fontSize: 9 },
  locationTxt:     { fontSize: 10, color: '#BACBF4', fontWeight: '600', flexShrink: 1 },
  // "View All" tile at end of slider — matches worker-card height
  moreCard:        { width: 98, borderRadius: 16, borderWidth: 1.6, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 8 },
  moreCount:       { fontSize: 20, fontWeight: '900', color: '#1D4ED8', letterSpacing: -0.5 },
  moreTxt:         { fontSize: 10, fontWeight: '800', color: '#1D4ED8', textAlign: 'center', lineHeight: 13 },
});

// ─── Nearby Workers rail ───────────────────────────────────────────────────────
export const NEARBY_STEP = 124; // card width 112 + slider gap 12

export interface NearbyWorkersSliderProps {
  workers: RawAgent[];
  nearbyTotal: number;
  onWorkerPress: (id: string) => void;
  onViewAll: () => void;
}

export const NearbyWorkersSlider = React.memo(({
  workers, nearbyTotal, onWorkerPress, onViewAll,
}: NearbyWorkersSliderProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const scrollRef = useRef<ScrollView>(null);
  const idxRef = useRef(0);
  const reduceMotion = useReduceMotion();
  const focused = useIsFocused();
  const pausedUntil = useRef(0);       // timestamp — auto-slide rests while the person is interacting
  const viewW = useRef(0);
  const contentW = useRef(0);

  // Gentle auto-slide: every few seconds the rail advances one card so new workers keep appearing, and glides back to
  // the start after the last one. Pauses for a few seconds after any touch, while another screen is on top, and under
  // "Reduce motion". A short list that already fits on screen doesn't move at all. Tapping a card opens the profile.
  useEffect(() => {
    if (reduceMotion || !focused || workers.length < 3) return undefined;
    const timer = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      const maxX = Math.max(0, contentW.current - viewW.current);
      if (maxX <= 4) return;
      const atEnd = idxRef.current * NEARBY_STEP >= maxX - 4;
      const target = atEnd ? 0 : Math.min((idxRef.current + 1) * NEARBY_STEP, maxX);
      idxRef.current = atEnd ? 0 : Math.round(target / NEARBY_STEP);
      scrollRef.current?.scrollTo({ x: target, animated: true });
    }, 2600);
    return () => clearInterval(timer);
  }, [reduceMotion, focused, workers.length]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={nws.sliderContent}
      snapToInterval={NEARBY_STEP}
      decelerationRate="fast"
      snapToAlignment="start"
      onLayout={(e) => { viewW.current = e.nativeEvent.layout.width; }}
      onContentSizeChange={(w) => { contentW.current = w; }}
      onScrollBeginDrag={() => { pausedUntil.current = Date.now() + 7000; }}
      onMomentumScrollEnd={(e) => {
        idxRef.current = Math.round(e.nativeEvent.contentOffset.x / NEARBY_STEP);
      }}
    >
      {workers.map((agent, i) => (
        <FadeInView key={agent._id} delay={150 + Math.min(i, 5) * 90} distance={10}>
          <WorkerSliderCard agent={agent} onPress={onWorkerPress} />
        </FadeInView>
      ))}
      {/* View-all tile at end */}
      <TouchableOpacity accessibilityRole="button" onPress={onViewAll} activeOpacity={0.82} style={[wsc.moreCard, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface1 }]}>
        <AppText style={[wsc.moreCount, { color: theme.colors.primary }]}>
          {nearbyTotal >= 1000
            ? `${(nearbyTotal / 1000).toFixed(nearbyTotal >= 10000 ? 0 : 1)}K+`
            : String(nearbyTotal)}
        </AppText>
        <AppText style={[wsc.moreTxt, { color: theme.colors.primary }]}>{t('viewAllWorkers')}</AppText>
      </TouchableOpacity>
    </ScrollView>
  );
});
NearbyWorkersSlider.displayName = 'NearbyWorkersSlider';

export const nws = StyleSheet.create({
  card:         { borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14, elevation: 2, shadowColor: '#142250', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16 },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  headerLeft:   { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  // lineHeight is required so Devanagari/Indic top matras aren't clipped.
  title:        { fontSize: 15, fontWeight: '800', color: '#0f172a', lineHeight: 22, flexShrink: 1 },
  countPill:    { backgroundColor: '#fff7ed', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#fed7aa', flexShrink: 0 },
  countPillTxt: { fontSize: 11, fontWeight: '700', color: '#ea580c', lineHeight: 16 },
  sub:          { fontSize: 11, lineHeight: 16, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 6 },
  viewAllTxt:   { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  loadWrap:     { paddingVertical: 28, alignItems: 'center' },
  skelRow:      { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 18, paddingHorizontal: 12 },
  skelTile:     { alignItems: 'center' },
  emptyWrap:    { paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', gap: 10 },
  emptyTxt:     { fontSize: 13, color: '#64748b', textAlign: 'center' },
  browseBtn:    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#ea580c' },
  browseBtnTxt: { fontSize: 12, fontWeight: '700', color: '#ea580c' },
  sliderContent:{ paddingHorizontal: 16, paddingBottom: 10, paddingTop: 4, gap: 12 },
});
