import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Image, ScrollView, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAppTheme } from '../../../core/theme';

const AUTO_SCROLL_INTERVAL = 4000;

interface PhotoCarouselProps {
  photos: string[];
  videoUrl?: string;
  height?: number;
}

// Auto-advancing photo (+ optional trailing video) carousel for a Project
// listing's card/detail view. Same ScrollView + setInterval + snap pattern
// as PromoBannerSlider, generalised over a dynamic slide list and measured
// to the parent's own width via onLayout instead of a fixed screen-width slide.
export const PhotoCarousel = ({ photos, videoUrl, height = 220 }: PhotoCarouselProps): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentIndex = useRef(0);
  const [slideW, setSlideW] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);

  const videoPlayer = useVideoPlayer(videoUrl ?? null, (player) => { player.loop = false; });

  const slides: Array<{ type: 'photo' | 'video'; uri: string }> = [
    ...photos.map((uri) => ({ type: 'photo' as const, uri })),
    ...(videoUrl ? [{ type: 'video' as const, uri: videoUrl }] : []),
  ];

  const scrollToIndex = (idx: number): void => {
    if (!slideW || slides.length === 0) return;
    const safeIdx = idx % slides.length;
    scrollRef.current?.scrollTo({ x: safeIdx * slideW, animated: true });
    currentIndex.current = safeIdx;
    setActiveIdx(safeIdx);
  };

  useEffect(() => {
    if (!slideW || slides.length < 2) return;
    timerRef.current = setInterval(() => {
      scrollToIndex(currentIndex.current + 1);
    }, AUTO_SCROLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideW, slides.length]);

  const resetTimer = (): void => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (slides.length < 2) return;
    timerRef.current = setInterval(() => {
      scrollToIndex(currentIndex.current + 1);
    }, AUTO_SCROLL_INTERVAL);
  };

  const handleScrollEnd = (e: { nativeEvent: { contentOffset: { x: number } } }): void => {
    if (!slideW) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / slideW);
    currentIndex.current = idx;
    setActiveIdx(idx);
  };

  const onLayout = (e: LayoutChangeEvent): void => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== slideW) setSlideW(w);
  };

  if (slides.length === 0) return null;

  return (
    <View style={[styles.wrapper, { height }]} onLayout={onLayout}>
      {slideW > 0 && (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollBeginDrag={resetTimer}
          scrollEventThrottle={16}
          snapToInterval={slideW}
          decelerationRate="fast"
          snapToAlignment="start"
        >
          {slides.map((slide, i) => (
            <View key={`${slide.type}-${i}`} style={{ width: slideW, height }}>
              {slide.type === 'photo' ? (
                <Image source={{ uri: slide.uri }} style={styles.media} resizeMode="cover" />
              ) : (
                <VideoView player={videoPlayer} style={styles.media} contentFit="cover" nativeControls />
              )}
            </View>
          ))}
        </ScrollView>
      )}
      {slides.length > 1 && (
        <View style={styles.dotsRow} pointerEvents="none">
          {slides.map((slide, i) => (
            <View
              key={`dot-${slide.type}-${i}`}
              style={[
                styles.dot,
                { backgroundColor: i === activeIdx ? theme.colors.primary : 'rgba(255,255,255,0.6)' },
                i === activeIdx && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { width: '100%', overflow: 'hidden', borderRadius: 14, backgroundColor: '#00000010' },
  media: { width: '100%', height: '100%' },
  dotsRow: {
    position: 'absolute', bottom: 8, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 16 },
});
