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
const SLIDE_W = SCREEN_W - 32; // card width within 16px horizontal padding on each side
const SLIDE_H = 160;
const AUTO_SCROLL_INTERVAL = 3500;

interface SlideConfig {
  id: string;
  emoji: string;
  titleKey: string;
  subtitleKey: string;
  tagKey: string;
  gradient: [string, string];
  accentColor: string;
}

const SLIDE_CONFIGS: SlideConfig[] = [
  { id: '1', emoji: '🏗️', titleKey: 'promo_title_1', subtitleKey: 'promo_sub_1', tagKey: 'promo_tag_1', gradient: ['#1E3A8A', '#2563EB'], accentColor: '#93C5FD' },
  { id: '2', emoji: '🧹', titleKey: 'promo_title_2', subtitleKey: 'promo_sub_2', tagKey: 'promo_tag_2', gradient: ['#164E63', '#0E7490'], accentColor: '#67E8F9' },
  { id: '3', emoji: '🏭', titleKey: 'promo_title_3', subtitleKey: 'promo_sub_3', tagKey: 'promo_tag_3', gradient: ['#4C1D95', '#7C3AED'], accentColor: '#C4B5FD' },
  { id: '4', emoji: '🌾', titleKey: 'promo_title_4', subtitleKey: 'promo_sub_4', tagKey: 'promo_tag_4', gradient: ['#14532D', '#16A34A'], accentColor: '#86EFAC' },
  { id: '5', emoji: '🚛', titleKey: 'promo_title_5', subtitleKey: 'promo_sub_5', tagKey: 'promo_tag_5', gradient: ['#78350F', '#D97706'], accentColor: '#FDE68A' },
];

interface PromoBannerSliderProps {
  onPress?: () => void;
}

export const PromoBannerSlider = ({ onPress }: PromoBannerSliderProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const dotAnim = useRef(SLIDE_CONFIGS.map(() => new Animated.Value(0))).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentIndex = useRef(0);

  const animateDot = (idx: number): void => {
    dotAnim.forEach((a, i) => {
      Animated.timing(a, {
        toValue: i === idx ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });
  };

  const scrollToIndex = (idx: number): void => {
    const safeIdx = idx % SLIDE_CONFIGS.length;
    scrollRef.current?.scrollTo({ x: safeIdx * SLIDE_W, animated: true });
    currentIndex.current = safeIdx;
    animateDot(safeIdx);
  };

  useEffect(() => {
    animateDot(0);
    timerRef.current = setInterval(() => {
      scrollToIndex(currentIndex.current + 1);
    }, AUTO_SCROLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScrollEnd = (e: { nativeEvent: { contentOffset: { x: number } } }): void => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SLIDE_W);
    currentIndex.current = idx;
    animateDot(idx);
  };

  const resetTimer = (): void => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      scrollToIndex(currentIndex.current + 1);
    }, AUTO_SCROLL_INTERVAL);
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollBeginDrag={resetTimer}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={SLIDE_W}
        decelerationRate="fast"
        snapToAlignment="start"
      >
        {SLIDE_CONFIGS.map((slide) => (
          <TouchableOpacity
            key={slide.id}
            activeOpacity={0.92}
            onPress={onPress}
            style={[styles.slide, { width: SLIDE_W }]}
          >
            {/* Background gradient layers */}
            <View style={[styles.slideBg, { backgroundColor: slide.gradient[0] }]} />
            <View style={[styles.slideGradientOverlay, { backgroundColor: slide.gradient[1] }]} />
            {/* Decorative circles */}
            <View style={[styles.circle1, { backgroundColor: slide.accentColor + '22' }]} />
            <View style={[styles.circle2, { backgroundColor: slide.accentColor + '15' }]} />

            {/* Content */}
            <View style={styles.slideInner}>
              <View style={styles.slideLeft}>
                <View style={[styles.tagPill, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                  <AppText style={styles.tagText}>{t(slide.tagKey)}</AppText>
                </View>
                <AppText style={styles.slideTitle} numberOfLines={2}>{t(slide.titleKey)}</AppText>
                <AppText style={styles.slideSub} numberOfLines={2}>{t(slide.subtitleKey)}</AppText>
                <View style={[styles.ctaBtn, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
                  <AppText style={styles.ctaText}>{t('promo_apply_now')}</AppText>
                </View>
              </View>
              <View style={styles.slideRight}>
                <View style={[styles.emojiBubble, { backgroundColor: slide.accentColor + '28', borderColor: slide.accentColor + '44' }]}>
                  <AppText style={styles.slideEmoji}>{slide.emoji}</AppText>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Dot indicators */}
      <View style={styles.dots}>
        {SLIDE_CONFIGS.map((_, i) => {
          const width = dotAnim[i].interpolate({ inputRange: [0, 1], outputRange: [6, 20] });
          const opacity = dotAnim[i].interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
          return (
            <TouchableOpacity key={i} onPress={() => { scrollToIndex(i); resetTimer(); }}>
              <Animated.View style={[styles.dot, { width, opacity, backgroundColor: theme.colors.primary }]} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: 4 },
  scroll: {},
  scrollContent: { gap: 0 },

  slide: {
    height: SLIDE_H,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 0,
    position: 'relative',
  },
  slideBg: { ...StyleSheet.absoluteFillObject },
  slideGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.45,
    left: '40%',
  },
  circle1: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    top: -40, right: -30,
  },
  circle2: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    bottom: -30, right: 60,
  },

  slideInner: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 16, gap: 12,
  },
  slideLeft: { flex: 1, gap: 6 },
  tagPill: {
    alignSelf: 'flex-start',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
  },
  tagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  slideTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', lineHeight: 20 },
  slideSub: { color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '500', lineHeight: 15 },
  ctaBtn: {
    alignSelf: 'flex-start',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    marginTop: 2,
  },
  ctaText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  slideRight: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emojiBubble: {
    width: 76, height: 76, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  slideEmoji: { fontSize: 40, lineHeight: 48 },

  dots: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 5, marginTop: 7, paddingHorizontal: 16,
  },
  dot: { height: 6, borderRadius: 3 },
});
