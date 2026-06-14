import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { WORK_CATEGORIES, type WorkCategory } from './WorkerCategoryGrid';
import type { TranslationKeys } from '../../../core/i18n/translations';

const { width: SCREEN_W } = Dimensions.get('window');
const SLIDE_W = SCREEN_W - 32; // card width within 16px horizontal padding on each side
const SLIDE_H = 160;
const AUTO_SCROLL_INTERVAL = 3500;

interface PromoBannerSliderProps {
  /** Fired when a slide / its Apply button is tapped — receives the work category */
  onCategoryPress?: (category: WorkCategory) => void;
  /** Fallback handler used when onCategoryPress is not provided */
  onPress?: () => void;
}

export const PromoBannerSlider = ({ onCategoryPress, onPress }: PromoBannerSliderProps): React.JSX.Element => {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const dotAnim = useRef(WORK_CATEGORIES.map(() => new Animated.Value(0))).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentIndex = useRef(0);

  const handlePress = (cat: WorkCategory): void => {
    if (onCategoryPress) onCategoryPress(cat);
    else onPress?.();
  };

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
    const safeIdx = idx % WORK_CATEGORIES.length;
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
        {WORK_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            activeOpacity={0.92}
            onPress={() => handlePress(cat)}
            style={[styles.slide, { width: SLIDE_W, backgroundColor: cat.gradient[0] }]}
          >
            {/* Background photo — workers on the job */}
            <Image
              source={{ uri: cat.image }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
            {/* Brand-colour tint keeps the slide on-theme while the photo shows through */}
            <View style={[styles.slideBg, { backgroundColor: cat.gradient[0], opacity: 0.52 }]} />
            {/* Left-side dark scrim so the title / rate stay readable */}
            <View style={styles.textScrim} />
            {/* Decorative circles */}
            <View style={[styles.circle1, { backgroundColor: cat.accent + '22' }]} />
            <View style={[styles.circle2, { backgroundColor: cat.accent + '15' }]} />

            {/* Content */}
            <View style={styles.slideInner}>
              <View style={styles.slideLeft}>
                <AppText style={styles.slideTitle} numberOfLines={2}>
                  {t(cat.translationKey as TranslationKeys).replace(/\n/g, ' ')}
                </AppText>
                <AppText style={styles.slideSub} numberOfLines={2}>
                  {t(cat.subtitleKey as TranslationKeys)}
                </AppText>
                <View style={styles.actionRow}>
                  <View style={[styles.ratePill, { backgroundColor: cat.accent + 'E6' }]}>
                    <AppText style={styles.rateText}>
                      {t('promo_rate_per_day', { min: cat.rateMin, max: cat.rateMax })}
                    </AppText>
                  </View>
                  <View style={[styles.ctaBtn, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
                    <AppText style={styles.ctaText}>{t('promo_apply_now')}</AppText>
                  </View>
                </View>
              </View>
              <View style={styles.slideRight}>
                <View style={[styles.emojiBubble, { backgroundColor: cat.accent + '28', borderColor: cat.accent + '44' }]}>
                  <AppText style={styles.slideEmoji}>{cat.emoji}</AppText>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
  textScrim: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '74%',
    backgroundColor: 'rgba(0,0,0,0.32)',
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
    paddingHorizontal: 18, paddingVertical: 14, gap: 12,
  },
  slideLeft: { flex: 1, gap: 5 },
  slideTitle: {
    color: '#FFFFFF', fontSize: 17, fontWeight: '900', lineHeight: 23,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  slideSub: {
    color: 'rgba(255,255,255,0.88)', fontSize: 11.5, fontWeight: '600', lineHeight: 15,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 2, flexWrap: 'wrap',
  },
  ratePill: {
    borderRadius: 20, paddingHorizontal: 11, paddingVertical: 4,
  },
  rateText: {
    color: '#FFFFFF', fontSize: 13, fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  ctaBtn: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
  },
  ctaText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  slideRight: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emojiBubble: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  slideEmoji: { fontSize: 38, lineHeight: 46 },
});
