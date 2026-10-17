import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useAppConfig } from '../../../core/api/endpoints/appConfigApi';
import { PROMOTION_DISMISSED_KEY } from '../../../shared/components/ui/PromotionOverlay';
import { useReduceMotion } from '../../../shared/components/motion';
import { pickBannerAds } from '../utils/offersBanner';

const AUTO_MS = 5000;
const RATIO = 16 / 6.2;

/**
 * Inline offers / festival banner on the dashboard — the SuperAdmin "Promotion Ads" (image type),
 * as a swipeable, auto-rotating strip. Shares the dismissed list with the floating ad, so closing an ad
 * there hides it here too. Renders nothing when there is nothing to show.
 */
export const OffersBanner = (): React.JSX.Element | null => {
  const { config } = useAppConfig();
  const focused = useIsFocused();
  const reduce = useReduceMotion();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [w, setW] = useState(0);
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    AsyncStorage.getItem(PROMOTION_DISMISSED_KEY)
      .then((raw) => { if (raw) setDismissed(JSON.parse(raw)); })
      .catch(() => {});
  }, []);

  // config refetches every 15 s as a brand-new object — key on content so the slider doesn't reset.
  const raw = config?.promotionAds;
  const sig = JSON.stringify((raw ?? []).map((a) => [a._id, a.isActive, a.mediaUrl, a.mediaType, a.link, a.targets]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ads = useMemo(() => pickBannerAds(raw, dismissed), [sig, dismissed]);
  const count = ads.length;

  useEffect(() => {
    if (count <= 1 || w <= 0 || !focused || reduce) return undefined;
    const id = setInterval(() => {
      const next = (idxRef.current + 1) % count;
      idxRef.current = next;
      setIdx(next);
      scrollRef.current?.scrollTo({ x: next * w, animated: true });
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [count, w, focused, reduce]);

  if (count === 0) return null;
  const h = w > 0 ? Math.round(w / RATIO) : 120;

  return (
    <View style={s.wrap} onLayout={(e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width))}>
      {w > 0 && (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / w);
            idxRef.current = i;
            setIdx(i);
          }}
          style={[s.scroll, { height: h }]}
        >
          {ads.map((a) => (
            <TouchableOpacity
              key={a._id ?? a.mediaUrl}
              activeOpacity={a.link ? 0.9 : 1}
              disabled={!a.link}
              onPress={() => { if (a.link) void Linking.openURL(a.link).catch(() => {}); }}
              style={{ width: w, height: h }}
            >
              <Image source={{ uri: a.mediaUrl }} style={s.img} contentFit="cover" transition={250} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {count > 1 && (
        <View style={s.dots} pointerEvents="none">
          {ads.map((a, i) => (<View key={a._id ?? a.mediaUrl} style={[s.dot, i === idx && s.dotOn]} />))}
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { marginBottom: 14 },
  scroll: { borderRadius: 16, overflow: 'hidden' },
  img: { width: '100%', height: '100%', backgroundColor: '#E5E7EB' },
  dots: { position: 'absolute', bottom: 8, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotOn: { width: 16, backgroundColor: '#FFFFFF' },
});
