import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../core/theme';
import { AppText } from './AppText';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_H = 172;
const AUTO_MS = 3800;

interface SlideConfig {
  id: string;
  emoji: string;
  tagKey: string;
  titleKey: string;
  subKey: string;
  bg1: string;   // solid base colour
  bg2: string;   // overlay tint (right side)
  accent: string;
}

const SLIDES: SlideConfig[] = [
  {
    id: '1', emoji: '🏗️',
    tagKey:   'empPromo_tag_1',
    titleKey: 'empPromo_title_1',
    subKey:   'empPromo_sub_1',
    bg1: '#0F2888', bg2: '#1A56DB', accent: '#93C5FD',
  },
  {
    id: '2', emoji: '💼',
    tagKey:   'empPromo_tag_2',
    titleKey: 'empPromo_title_2',
    subKey:   'empPromo_sub_2',
    bg1: '#0D4A5C', bg2: '#0891B2', accent: '#67E8F9',
  },
  {
    id: '3', emoji: '🏭',
    tagKey:   'empPromo_tag_3',
    titleKey: 'empPromo_title_3',
    subKey:   'empPromo_sub_3',
    bg1: '#3B0764', bg2: '#7C3AED', accent: '#C4B5FD',
  },
  {
    id: '4', emoji: '🌾',
    tagKey:   'empPromo_tag_4',
    titleKey: 'empPromo_title_4',
    subKey:   'empPromo_sub_4',
    bg1: '#0F3D21', bg2: '#16A34A', accent: '#86EFAC',
  },
  {
    id: '5', emoji: '🏠',
    tagKey:   'empPromo_tag_5',
    titleKey: 'empPromo_title_5',
    subKey:   'empPromo_sub_5',
    bg1: '#6B2100', bg2: '#C2410C', accent: '#FED7AA',
  },
];

interface EmployerPromoSliderProps {
  onPress: () => void;
}

export const EmployerPromoSlider = ({ onPress }: EmployerPromoSliderProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const scrollRef  = useRef<ScrollView>(null);
  const dotAnims   = useRef(SLIDES.map(() => new Animated.Value(0))).current;
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const curIdx     = useRef(0);

  const SLIDE_W = SCREEN_W - 32; // 16px padding each side

  const animateDots = (idx: number): void => {
    dotAnims.forEach((a, i) => {
      Animated.timing(a, { toValue: i === idx ? 1 : 0, duration: 220, useNativeDriver: false }).start();
    });
  };

  const goTo = (idx: number): void => {
    const safe = ((idx % SLIDES.length) + SLIDES.length) % SLIDES.length;
    scrollRef.current?.scrollTo({ x: safe * SLIDE_W, animated: true });
    curIdx.current = safe;
    animateDots(safe);
  };

  const restartTimer = (): void => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => goTo(curIdx.current + 1), AUTO_MS);
  };

  useEffect(() => {
    animateDots(0);
    restartTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onScrollEnd = (e: { nativeEvent: { contentOffset: { x: number } } }): void => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SLIDE_W);
    curIdx.current = idx;
    animateDots(idx);
  };

  return (
    <View style={s.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={false}
        snapToInterval={SLIDE_W}
        decelerationRate="fast"
        snapToAlignment="start"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        onScrollBeginDrag={restartTimer}
        scrollEventThrottle={16}
        contentContainerStyle={{ gap: 0 }}
      >
        {SLIDES.map((slide) => (
          <TouchableOpacity
            key={slide.id}
            activeOpacity={0.92}
            onPress={onPress}
            style={[s.slide, { width: SLIDE_W, height: CARD_H }]}
          >
            {/* Base colour layer */}
            <View style={[s.fill, { backgroundColor: slide.bg1 }]} />
            {/* Right gradient tint */}
            <View style={[s.fillRight, { backgroundColor: slide.bg2 }]} />
            {/* Decorative circles */}
            <View style={[s.circle1, { backgroundColor: slide.accent + '20' }]} />
            <View style={[s.circle2, { backgroundColor: slide.accent + '14' }]} />
            {/* Subtle bottom shimmer */}
            <View style={[s.shimmer, { backgroundColor: slide.accent + '10' }]} />

            {/* Content */}
            <View style={s.row}>
              {/* Left: text */}
              <View style={s.left}>
                {/* Category tag */}
                <View style={[s.tag, { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: slide.accent + '40', borderWidth: 1 }]}>
                  <AppText style={s.tagTxt}>{t(slide.tagKey)}</AppText>
                </View>

                {/* Title */}
                <AppText style={s.title} numberOfLines={2}>{t(slide.titleKey)}</AppText>

                {/* Subtitle */}
                <AppText style={s.sub} numberOfLines={2}>{t(slide.subKey)}</AppText>

                {/* CTA button */}
                <TouchableOpacity
                  onPress={onPress}
                  style={[s.cta, { backgroundColor: slide.accent, shadowColor: slide.accent }]}
                  activeOpacity={0.88}
                >
                  <AppText style={[s.ctaTxt, { color: slide.bg1 }]}>{t('empHireNowBtn')}{'  →'}</AppText>
                </TouchableOpacity>
              </View>

              {/* Right: emoji bubble */}
              <View style={s.right}>
                <View style={[s.emojiBubble, { backgroundColor: slide.accent + '22', borderColor: slide.accent + '50', borderWidth: 1.5 }]}>
                  <AppText style={s.emoji}>{slide.emoji}</AppText>
                </View>
                {/* Small "Premium" pill */}
                <View style={[s.premiumPill, { backgroundColor: slide.accent + '28', borderColor: slide.accent + '50' }]}>
                  <AppText style={[s.premiumTxt, { color: slide.accent }]}>{'⭐ PREMIUM'}</AppText>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Dot indicators */}
      <View style={s.dots}>
        {SLIDES.map((_, i) => {
          const w = dotAnims[i].interpolate({ inputRange: [0, 1], outputRange: [6, 22] });
          const op = dotAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
          return (
            <TouchableOpacity key={i} onPress={() => { goTo(i); restartTimer(); }} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Animated.View style={[s.dot, { width: w, opacity: op, backgroundColor: theme.colors.primary }]} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  wrapper:     { marginBottom: 6 },

  slide:       { borderRadius: 22, overflow: 'hidden', position: 'relative' },
  fill:        { ...StyleSheet.absoluteFillObject },
  fillRight:   { ...StyleSheet.absoluteFillObject, opacity: 0.5, left: '35%' },

  circle1:     { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -55, right: -35 },
  circle2:     { position: 'absolute', width: 110, height: 110, borderRadius: 55, bottom: -35, right: 55 },
  shimmer:     { position: 'absolute', height: 50, bottom: 0, left: 0, right: 0 },

  row:         { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 18, gap: 10 },

  left:        { flex: 1, gap: 7 },
  tag:         { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  tagTxt:      { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  title:       { color: '#FFFFFF', fontSize: 15, fontWeight: '900', lineHeight: 20, letterSpacing: -0.2 },
  sub:         { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '500', lineHeight: 15 },
  cta:         { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginTop: 2, elevation: 4, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 6 },
  ctaTxt:      { fontSize: 12, fontWeight: '900', letterSpacing: 0.2 },

  right:       { alignItems: 'center', gap: 8, flexShrink: 0 },
  emojiBubble: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emoji:       { fontSize: 38, lineHeight: 46 },
  premiumPill: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  premiumTxt:  { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },

  dots:        { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 8, paddingHorizontal: 16 },
  dot:         { height: 6, borderRadius: 3 },
});
