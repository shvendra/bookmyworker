import React, { useState, useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Animated, Easing, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../../core/theme';
// Profile-completion nudge disabled for now — mandatory completion is enforced
// via the post-OTP WorkerProfileCompletionScreen instead.
// import { ProfileCompletionModal } from '../../../../shared/components/ui/ProfileCompletionModal';
import { AppText } from '../../../../shared/components/ui/AppText';
import { EmployerPromoSlider } from '../../../../shared/components/ui/EmployerPromoSlider';
import { CountUpText, FadeInView, FloatView, PulseView, ShimmerSweep, useReduceMotion } from '../../../../shared/components/motion';
import { useTranslation } from 'react-i18next';

import { BRAND } from '../../../../core/theme/brand';
import { REQ_CARD_WIDTH } from './dashboardShared';


/** Status dot with a soft ring that keeps expanding outward ("live" feel). Static under Reduce Motion. */
const LiveDot = ({ color }: { color: string }): React.JSX.Element => {
  const reduce = useReduceMotion();
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(ring, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduce, ring]);
  return (
    <View style={ssw.liveWrap}>
      {!reduce && (
        <Animated.View
          pointerEvents="none"
          style={[ssw.liveRing, { backgroundColor: color, opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }] }]}
        />
      )}
      <View style={[ssw.activeDot, { backgroundColor: color }]} />
    </View>
  );
};

// ─── Subscription Status Widget ────────────────────────────────────────────────
export interface SubStatusProps {
  isSubscribed: boolean;
  isExpired: boolean;
  profileLoaded: boolean;
  remainingContacts: number;
  subscriptionExpery?: string;
  postsLabel?: string | null;
  onSubscribe: () => void;
  onRenew: () => void;
  onTopUp: () => void;
  onFindWorkers: () => void;
  onPost: () => void;
  workerCountLabel: string;
}

// Promo slides shown alongside the subscription card (active subscribers only).
export const SSW_SLIDE_W = REQ_CARD_WIDTH;       // full-bleed inside 16px content padding
export const SSW_SLIDE_H = 176;
export const SSW_AUTO_MS = 4500;
export interface SswPromo {
  id: string; emoji: string; tagKey: string; titleKey: string; subKey: string; ctaKey: string;
  action: 'find' | 'post'; bg1: string; bg2: string; accent: string;
}
export const SSW_PROMOS: SswPromo[] = [
  // Palette aligned to the Figma promo slides (find = blue slide, post = teal slide).
  { id: 'p1', emoji: 'people', tagKey: 'ssw_promo1_tag', titleKey: 'ssw_promo1_title', subKey: 'ssw_promo1_sub', ctaKey: 'ssw_promo1_cta', action: 'find', bg1: '#1B379A', bg2: '#2C50D6', accent: '#BFE0FF' },
  { id: 'p2', emoji: 'flash', tagKey: 'ssw_promo2_tag', titleKey: 'ssw_promo2_title', subKey: 'ssw_promo2_sub', ctaKey: 'ssw_promo2_cta', action: 'post', bg1: '#0C3B40', bg2: '#10666B', accent: '#7FE7DE' },
];

export const SubscriptionStatusWidget = React.memo(({
  isSubscribed, isExpired, profileLoaded, remainingContacts, subscriptionExpery, postsLabel,
  onSubscribe, onRenew, onTopUp, onFindWorkers, onPost, workerCountLabel,
}: SubStatusProps): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const focused = useIsFocused();
  const [now, setNow] = useState(() => Date.now());
  const scrollRef = useRef<ScrollView>(null);
  const idxRef = useRef(0);

  // Active subscribers (not expired) get the promo slider; everyone else a single card.
  const showSlider = isSubscribed && !isExpired;
  const slideCount = 1 + SSW_PROMOS.length;

  // Update every minute so "X days left" recalculates in real-time
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Auto-advance the slider, looping back to the subscription card
  useEffect(() => {
    if (!showSlider || !focused) return;
    const id = setInterval(() => {
      const next = (idxRef.current + 1) % slideCount;
      idxRef.current = next;
      scrollRef.current?.scrollTo({ x: next * SSW_SLIDE_W, animated: true });
    }, SSW_AUTO_MS);
    return () => clearInterval(id);
  }, [showSlider, slideCount, focused]);

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
    if (isExpired || (daysLeft != null && daysLeft <= 0)) return t('ssw_expiredShort');
    if (isExpiringSoon && daysLeft != null) return t('ssw_daysLeft', { days: daysLeft });
    return new Date(expiryMs).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  })();

  /* ── Not subscribed — premium promo slider ── */
  if (!isSubscribed && !isExpired) {
    return <EmployerPromoSlider onPress={onSubscribe} />;
  }

  /* ── Active premium → Figma green-gradient card; expired → white renew card ── */
  const premium = !isExpired;
  const cardBg   = premium ? '#0E5A33' : theme.colors.card;
  const cardBdr  = premium ? '#0E5A33' : theme.colors.border;
  const labelClr = premium ? '#FFFFFF' : (isExpired ? '#DC2626' : '#16A34A');
  const dotClr   = premium ? '#34D77F' : (isExpired ? '#DC2626' : '#16A34A');
  const postsClr = premium ? 'rgba(255,255,255,0.9)' : theme.colors.textSecondary;
  const tuBg     = premium ? '#FFFFFF' : (isExpired ? '#FEF2F2' : '#EBF1FF');
  const tuBdr    = premium ? '#FFFFFF' : (isExpired ? '#FECACA' : '#BFDBFE');
  const tuTxt    = premium ? '#137A38' : (isExpired ? '#DC2626' : BRAND);
  // Stat boxes: keep red warning states even on the green card; otherwise translucent-white on green
  const cBoxBg  = isLowContacts ? '#FEF2F2' : (premium ? 'rgba(255,255,255,0.16)' : contactBg);
  const cBoxBdr = isLowContacts ? '#FECACA' : (premium ? 'rgba(255,255,255,0.28)' : contactBdr);
  const cBoxTxt = isLowContacts ? '#DC2626' : (premium ? '#FFFFFF' : contactColor);
  const eWarn   = isExpiringSoon || isExpired;
  const eBoxBg  = eWarn ? '#FEF2F2' : (premium ? 'rgba(255,255,255,0.16)' : expiryBg);
  const eBoxBdr = eWarn ? '#FECACA' : (premium ? 'rgba(255,255,255,0.28)' : expiryBdr);
  const eBoxTxt = eWarn ? '#DC2626' : (premium ? '#FFFFFF' : expiryColor);

  /* ── The subscription status card (slide 1 / or standalone when expired) ── */
  const subscriptionCard = (
    <TouchableOpacity accessibilityRole="button"
      onPress={isExpired ? onRenew : onTopUp}
      activeOpacity={0.9}
      style={[ssw.card, showSlider && ssw.cardInSlide, premium && ssw.cardPremium, { backgroundColor: cardBg, borderColor: cardBdr }]}
    >
      {/* Green gradient overlay (active premium only) */}
      {premium && <View pointerEvents="none" style={[StyleSheet.absoluteFill, ssw.cardGlowR]} />}
      {premium && <FloatView style={ssw.cardGlowCircle} distance={9} period={4200} />}

      {/* Header row — title (left) + Top-up (right) */}
      <View style={ssw.headerRow}>
        <View style={ssw.activeBadge}>
          {premium && (
            <View style={ssw.crownCircle}><Ionicons name="diamond" size={15} color="#0B3D22" /></View>
          )}
          <View style={ssw.titleCol}>
            <AppText style={[ssw.activeLabel, { color: labelClr }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.2}>
              {isExpired ? t('subscriptionExpired') : t('premiumSubscription')}
            </AppText>
            {premium && (
              <View style={ssw.activePill}>
                <LiveDot color={dotClr} />
                <AppText style={ssw.activePillTxt} maxFontSizeMultiplier={1.2}>{t('ssw_active')}</AppText>
              </View>
            )}
          </View>
        </View>
        <PulseView active={isLowContacts || isExpiringSoon} scaleTo={1.08} period={1200}>
          <TouchableOpacity accessibilityRole="button"
            onPress={isExpired ? onRenew : onTopUp}
            style={[ssw.actionBtn, { backgroundColor: tuBg, borderColor: tuBdr }]}
            activeOpacity={0.8}
          >
            <AppText numberOfLines={1} style={[ssw.actionBtnTxt, { color: tuTxt }]}>
              {isExpired ? t('renew') : t('topUp')}
            </AppText>
          </TouchableOpacity>
        </PulseView>
      </View>

      {/* Subtitle line (e.g. "Unlimited posts") */}
      {!!postsLabel && (
        <View style={ssw.postsChip}>
          <Ionicons name="documents" size={13} color={postsClr} />
          <AppText style={[ssw.subLine, { color: postsClr }]} maxFontSizeMultiplier={1.2} numberOfLines={1}>
            {postsLabel}
          </AppText>
        </View>
      )}

      {/* Stats row */}
      <View style={ssw.statsRow}>
        {/* Remaining worker profiles — rises in first; breathes when running low */}
        <FadeInView delay={120} style={ssw.statWrap}>
          <PulseView active={isLowContacts} scaleTo={1.04} period={1300} style={ssw.statWrap}>
            <View style={[ssw.statBox, { backgroundColor: cBoxBg, borderColor: cBoxBdr }]}>
              <View style={[ssw.statIcon, { backgroundColor: isLowContacts ? '#FEE2E2' : 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="people" size={17} color={isLowContacts ? '#DC2626' : '#FFFFFF'} />
              </View>
              <View style={ssw.statCol}>
                <CountUpText value={remainingContacts} duration={700} style={[ssw.statNum, { color: cBoxTxt }]} maxFontSizeMultiplier={1.2} adjustsFontSizeToFit numberOfLines={1} />
                <AppText style={[ssw.statLabel, { color: cBoxTxt }]} maxFontSizeMultiplier={1.2} numberOfLines={2}>
                  {isLowContacts && remainingContacts === 0 ? t('ssw_noContacts') : t('ssw_contactsLeft')}
                </AppText>
              </View>
            </View>
          </PulseView>
        </FadeInView>

        {/* Expiry — rises in second */}
        <FadeInView delay={260} style={ssw.statWrap}>
          <View style={[ssw.statBox, { backgroundColor: eBoxBg, borderColor: eBoxBdr }]}>
            <View style={[ssw.statIcon, { backgroundColor: eWarn ? '#FEE2E2' : 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="calendar" size={16} color={eWarn ? '#DC2626' : '#FFFFFF'} />
            </View>
            <View style={ssw.statCol}>
              <AppText style={[ssw.statNum, { color: eBoxTxt, fontSize: eWarn ? 16 : 14 }]} maxFontSizeMultiplier={1.2} adjustsFontSizeToFit numberOfLines={1}>
                {expiryLabel}
              </AppText>
              <AppText style={[ssw.statLabel, { color: eBoxTxt }]} maxFontSizeMultiplier={1.2} numberOfLines={2}>
                {isExpired ? t('ssw_renewNow') : isExpiringSoon ? t('ssw_expiringSoon') : t('ssw_expiryDate')}
              </AppText>
            </View>
          </View>
        </FadeInView>
      </View>
      {premium && <ShimmerSweep tint="rgba(255,255,255,0.22)" rest={3200} />}
    </TouchableOpacity>
  );

  /* ── Expired (was subscribed) — premium deep-navy + gold renewal card ── */
  if (isExpired) {
    return (
      <TouchableOpacity accessibilityRole="button" onPress={onRenew} activeOpacity={0.92} style={ssw.expCard}>
        {/* Layered "gradient" (no gradient lib): deep navy base + royal-blue sheen
            on the right + a soft gold glow → a premium look that invites renewal. */}
        <View pointerEvents="none" style={ssw.expBase} />
        <View pointerEvents="none" style={ssw.expSheen} />
        <View pointerEvents="none" style={ssw.expGlow} />

        <View style={ssw.expTop}>
          <View style={ssw.expIcon}>
            <Ionicons name="diamond" size={19} color="#0B1E4D" />
          </View>
          <View style={ssw.expMid}>
            <View style={ssw.expTitleRow}>
              <AppText style={ssw.expTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} maxFontSizeMultiplier={1.2}>
                {t('subscriptionExpired')}
              </AppText>
              <View style={ssw.expPill}>
                <View style={ssw.expPillDot} />
                <AppText style={ssw.expPillTxt} maxFontSizeMultiplier={1.2}>{t('ssw_expiredShort')}</AppText>
              </View>
            </View>
            <AppText style={ssw.expSub} numberOfLines={2} maxFontSizeMultiplier={1.3}>
              {t('na_emp_subscribe_d')}
            </AppText>
          </View>
        </View>

        <PulseView scaleTo={1.035}>
          <View style={ssw.expCta}>
            <AppText style={ssw.expCtaTxt} maxFontSizeMultiplier={1.2}>{t('ssw_renewNow')}{'   →'}</AppText>
          </View>
        </PulseView>
        <ShimmerSweep tint="rgba(255,217,138,0.22)" />
      </TouchableOpacity>
    );
  }

  /* ── Fallback (should not normally reach here) ── */
  if (!showSlider) return subscriptionCard;

  /* ── Active subscriber — slider: [subscription card, ...promo cards] ── */
  return (
    <View style={ssw.sliderWrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SSW_SLIDE_W}
        decelerationRate="fast"
        snapToAlignment="start"
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / SSW_SLIDE_W);
          idxRef.current = i;
        }}
      >
        {/* Slide 1 — subscription status */}
        <View style={ssw.slide}>{subscriptionCard}</View>

        {/* Promo slides */}
        {SSW_PROMOS.map((p) => (
          <View key={p.id} style={ssw.slide}>
            <TouchableOpacity accessibilityRole="button"
              activeOpacity={0.92}
              onPress={p.action === 'find' ? onFindWorkers : onPost}
              style={ssw.promoCard}
            >
              <View pointerEvents="none" style={[ssw.promoFill, { backgroundColor: p.bg1 }]} />
              <View pointerEvents="none" style={[ssw.promoFillRight, { backgroundColor: p.bg2 }]} />
              <View pointerEvents="none" style={[ssw.promoCircle1, { backgroundColor: p.accent + '20' }]} />
              <View pointerEvents="none" style={[ssw.promoCircle2, { backgroundColor: p.accent + '14' }]} />
              <View style={ssw.promoRow}>
                <View style={ssw.promoLeft}>
                  <View style={[ssw.promoTag, { borderColor: p.accent + '55' }]}>
                    <AppText style={ssw.promoTagTxt} numberOfLines={1}>{t(p.tagKey)}</AppText>
                  </View>
                  <AppText style={ssw.promoTitle} numberOfLines={2}>{t(p.titleKey)}</AppText>
                  <AppText style={ssw.promoSub} numberOfLines={1}>{t(p.subKey, { count: workerCountLabel })}</AppText>
                  <View style={[ssw.promoCta, { backgroundColor: p.accent, shadowColor: p.accent }]}>
                    <AppText style={[ssw.promoCtaTxt, { color: p.bg1 }]} numberOfLines={1}>{t(p.ctaKey)}{'  →'}</AppText>
                  </View>
                </View>
                <View style={ssw.promoRight}>
                  <View style={[ssw.promoEmojiBubble, { backgroundColor: p.accent + '22', borderColor: p.accent + '55' }]}>
                    <Ionicons name={p.emoji as keyof typeof Ionicons.glyphMap} size={30} color={p.accent} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});
SubscriptionStatusWidget.displayName = 'SubscriptionStatusWidget';

export const ssw = StyleSheet.create({
  // Active subscription card
  card:         { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14, gap: 12, elevation: 2, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 },
  subLine:      { fontSize: 12, fontWeight: '700' },
  postsChip:    { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  crownCircle:  { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F5C451', alignItems: 'center', justifyContent: 'center' },
  titleCol:     { flexShrink: 1, minWidth: 0, gap: 3 },
  activePill:   { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 3 },
  activePillTxt:{ color: '#A7F3C8', fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2 },
  statIcon:     { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  statCol:      { flex: 1, minWidth: 0, gap: 1 },
  cardPremium:  { overflow: 'hidden', shadowColor: '#0E5A33', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  cardGlowR:    { backgroundColor: '#16A34A', opacity: 0.6, left: '40%', borderRadius: 18 },
  cardGlowCircle:{ position: 'absolute', width: 150, height: 150, borderRadius: 75, bottom: -70, right: -30, backgroundColor: 'rgba(180,255,200,0.16)' },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeBadge:  { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minWidth: 0, marginRight: 8 },
  activeDot:    { width: 8, height: 8, borderRadius: 4 },
  activeLabel:  { fontSize: 16, fontWeight: '800', letterSpacing: -0.2, flexShrink: 1 },
  actionBtn:    { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5 },
  actionBtnTxt: { fontSize: 12, fontWeight: '800' },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  postsInline:  { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  postsInlineIcon: { fontSize: 12, lineHeight: 16 },
  postsInlineTxt:  { fontSize: 11, fontWeight: '700', flexShrink: 1 },
  // Stats
  statsRow:     { flexDirection: 'row', gap: 8 },
  statWrap:     { flex: 1 },
  liveWrap:     { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  liveRing:     { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  statBox:      { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8 },
  statTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, maxWidth: '100%' },
  statEmoji:    { fontSize: 16, lineHeight: 20 },
  statNum:      { fontSize: 20, fontWeight: '900', lineHeight: 24 },
  statLabel:    { fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 12 },

  // ── Slider (active subscribers) ──
  sliderWrap:   { marginBottom: 20 },
  slide:        { width: SSW_SLIDE_W, minHeight: SSW_SLIDE_H },   // grows with content; height is just a floor
  cardInSlide:  { flex: 1, marginBottom: 0 },          // subscription card stretches to the row height

  // ── Promo card ──
  promoCard:    { alignSelf: 'stretch', borderRadius: 22, overflow: 'hidden', position: 'relative', elevation: 3, shadowColor: '#0f2f8c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 },
  promoFill:      { ...StyleSheet.absoluteFillObject },
  promoFillRight: { ...StyleSheet.absoluteFillObject, opacity: 0.5, left: '38%' },
  promoCircle1:   { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -60, right: -40 },
  promoCircle2:   { position: 'absolute', width: 90, height: 90, borderRadius: 45, bottom: -30, right: 45 },
  promoRow:     { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 18, gap: 10 },
  promoLeft:    { flex: 1, gap: 6 },
  promoTag:     { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 12, paddingVertical: 5 },
  promoTagTxt:  { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  promoTitle:   { color: '#FFFFFF', fontSize: 21, fontWeight: '800', lineHeight: 24, letterSpacing: -0.4, marginTop: 6 },
  promoSub:     { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '600', lineHeight: 17 },
  promoCta:     { alignSelf: 'flex-start', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 11, marginTop: 8, elevation: 3, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 5 },
  promoCtaTxt:  { fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  promoRight:   { alignSelf: 'flex-end', flexShrink: 0 },
  promoEmojiBubble: { width: 62, height: 62, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  promoEmoji:   { fontSize: 30, lineHeight: 38 },

  // ── Premium "Subscription Expired" renewal card ──
  expCard:  { borderRadius: 20, overflow: 'hidden', marginBottom: 14, paddingHorizontal: 16, paddingVertical: 16, gap: 14, elevation: 5, shadowColor: '#0B1E4D', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 14 },
  expBase:  { ...StyleSheet.absoluteFillObject, backgroundColor: '#0B1E4D' },
  expSheen: { ...StyleSheet.absoluteFillObject, backgroundColor: '#1D4ED8', opacity: 0.35, left: '35%' },
  expGlow:  { position: 'absolute', width: 150, height: 150, borderRadius: 75, top: -60, right: -30, backgroundColor: 'rgba(255,215,140,0.16)' },
  expTop:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  expIcon:     { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFD98A', alignItems: 'center', justifyContent: 'center' },
  expMid:      { flex: 1, minWidth: 0 },
  expTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expTitle:    { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: -0.2, flexShrink: 1 },
  expPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(239,68,68,0.18)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.55)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, flexShrink: 0 },
  expPillDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F87171' },
  expPillTxt:  { color: '#FCA5A5', fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  expSub:      { color: 'rgba(255,255,255,0.82)', fontSize: 12.5, fontWeight: '600', lineHeight: 17, marginTop: 3 },
  expCta:      { backgroundColor: '#FFD98A', borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#FFD98A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 8 },
  expCtaTxt:   { color: '#0B1E4D', fontSize: 14.5, fontWeight: '900', letterSpacing: 0.2 },
});

