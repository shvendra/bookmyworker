import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Linking, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEventListener } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { useAppConfig } from '../../../core/api/endpoints/appConfigApi';

// Floating Employer promotion ad — image, video, or audio, SuperAdmin-managed
// (Settings → Promotion Ads). Self-contained: pulls from the shared app-config
// query, renders NOTHING unless there's at least one active promotion.
// Several promotions can be active at once; this overlay rotates through them
// one at a time (with a different on-screen position each time) so they never
// stack. Mounted once at the navigator root — see AppNavigator.tsx — so it
// floats over every Employer app screen, not just the dashboard.

const INITIAL_DELAY_MS = 8000;   // first appearance after the app is ready
const IMAGE_DWELL_MS   = 14000;  // how long an image/audio ad stays up
const ROTATE_GAP_MS    = 3 * 60 * 1000; // pause between one ad closing and the next appearing

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
const POSITIONS: Position[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const randomPosition = (exclude?: Position): Position => {
  const pool = POSITIONS.filter((p) => p !== exclude);
  return pool[Math.floor(Math.random() * pool.length)] ?? POSITIONS[0];
};
const POSITION_STYLES: Record<Position, { top?: number; bottom?: number; left?: number; right?: number }> = {
  'top-left':     { top: 60, left: 16 },
  'top-right':    { top: 60, right: 16 },
  'bottom-left':  { bottom: 110, left: 16 },
  'bottom-right': { bottom: 110, right: 16 },
};

const CARD_WIDTH = Math.min(280, Dimensions.get('window').width - 40);

type Props = {
  /** Which surface this instance represents — an ad only shows here if
   *  SuperAdmin explicitly targeted it (Settings → Promotion Ads). */
  target: 'employer_app' | 'agent_app';
};

export function PromotionOverlay({ target }: Props): React.JSX.Element | null {
  const { config } = useAppConfig();
  const ads = (config?.promotionAds ?? []).filter(
    (a) => a.isActive && a.mediaUrl && a.targets?.includes(target),
  );

  const [adIndex, setAdIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [muted, setMuted] = useState(true);
  const [position, setPosition] = useState<Position>('top-right');
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const shownOnceRef = useRef(false);

  // Drag-to-reposition — an offset on top of the corner `position` above,
  // reset every time a new ad/instance appears so it doesn't inherit the
  // previous card's dragged-to spot.
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  useEffect(() => {
    translateX.value = 0;
    translateY.value = 0;
  }, [visible, adIndex, position, translateX, translateY]);
  const panGesture = Gesture.Pan()
    .minDistance(6)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    });
  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  // Schedule the very first appearance once we have ads to show.
  useEffect(() => {
    if (ads.length === 0 || shownOnceRef.current) return;
    shownOnceRef.current = true;
    const t = setTimeout(() => show(0), INITIAL_DELAY_MS);
    timersRef.current.push(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ads.length]);

  const show = (idx: number) => {
    setAdIndex(idx);
    setPosition((prev) => randomPosition(prev));
    setMinimized(false);
    setMuted(true);
    setVisible(true);
  };

  const scheduleNext = () => {
    setVisible(false);
    if (ads.length === 0) return;
    const t = setTimeout(() => show((adIndex + 1) % ads.length), ROTATE_GAP_MS);
    timersRef.current.push(t);
  };

  const ad = ads[adIndex];

  // Video player — constructed unconditionally (hook rules); harmless no-op
  // when the current ad isn't a video (empty source).
  const videoPlayer = useVideoPlayer(ad?.mediaType === 'video' ? ad.mediaUrl : '', (player) => {
    player.loop = false;
    player.muted = true;
  });
  useEventListener(videoPlayer, 'playToEnd', () => {
    if (ad?.mediaType === 'video') scheduleNext();
  });
  useEffect(() => {
    if (ad?.mediaType === 'video' && visible && !minimized) {
      videoPlayer.muted = muted;
      videoPlayer.play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad, visible, minimized, muted]);

  // Audio player — same pattern.
  const audioPlayer = useAudioPlayer(ad?.mediaType === 'audio' ? { uri: ad.mediaUrl } : null);
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  useEffect(() => {
    if (ad?.mediaType === 'audio' && audioStatus.didJustFinish) scheduleNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioStatus.didJustFinish]);
  useEffect(() => {
    if (ad?.mediaType === 'audio' && visible && !minimized) {
      audioPlayer.muted = muted;
      audioPlayer.play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad, visible, minimized, muted]);

  // Image dwell timer.
  useEffect(() => {
    if (!visible || ad?.mediaType !== 'image') return;
    const t = setTimeout(scheduleNext, IMAGE_DWELL_MS);
    timersRef.current.push(t);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, adIndex]);

  if (ads.length === 0 || !visible || !ad) return null;

  const handleOpen = () => {
    if (ad.link) Linking.openURL(ad.link).catch(() => {});
  };

  return (
    <GestureDetector gesture={panGesture}>
    <Animated.View style={[styles.container, POSITION_STYLES[position], dragStyle]}>
      {minimized ? (
        <Pressable onPress={() => setMinimized(false)} style={styles.bubble}>
          <Ionicons name="megaphone" size={20} color="#fff" />
        </Pressable>
      ) : (
        <View style={[styles.card, { width: CARD_WIDTH }]}>
          <View style={styles.header}>
            <View style={styles.headerLabel}>
              <Ionicons name="megaphone-outline" size={12} color="rgba(255,255,255,0.75)" />
              <AppText style={styles.headerText}>PROMOTION</AppText>
            </View>
            <View style={styles.headerBtns}>
              <Pressable onPress={() => setMinimized(true)} style={styles.iconBtn} hitSlop={8}>
                <Ionicons name="remove" size={14} color="#fff" />
              </Pressable>
              <Pressable onPress={scheduleNext} style={styles.iconBtn} hitSlop={8}>
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          </View>

          <Pressable onPress={handleOpen} disabled={!ad.link}>
            {ad.mediaType === 'video' && (
              <View>
                <VideoView player={videoPlayer} style={styles.media} contentFit="cover" nativeControls={false} />
                <Pressable onPress={() => setMuted((m) => !m)} style={[styles.overlayBtn, { bottom: 8, right: 8 }]} hitSlop={8}>
                  <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={14} color="#fff" />
                </Pressable>
              </View>
            )}
            {ad.mediaType === 'image' && (
              <Image source={{ uri: ad.mediaUrl }} style={styles.media} contentFit="cover" />
            )}
            {ad.mediaType === 'audio' && (
              <View style={styles.audioBox}>
                <Ionicons name="musical-notes" size={28} color="#60a5fa" />
                <Pressable
                  onPress={() => {
                    if (audioStatus.playing) audioPlayer.pause();
                    else audioPlayer.play();
                  }}
                  style={styles.audioPlayBtn}
                >
                  <Ionicons name={audioStatus.playing ? 'pause' : 'play'} size={18} color="#fff" />
                </Pressable>
                <Pressable onPress={() => setMuted((m) => !m)} hitSlop={8}>
                  <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={14} color="rgba(255,255,255,0.8)" />
                </Pressable>
              </View>
            )}
            {!!ad.link && (
              <View style={styles.linkChip}>
                <Ionicons name="open-outline" size={11} color="#fff" />
                <AppText style={styles.linkChipText}>View</AppText>
              </View>
            )}
          </Pressable>
        </View>
      )}
    </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', zIndex: 999, elevation: 999 },
  bubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  headerText: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  headerBtns: { flexDirection: 'row', gap: 4 },
  iconBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: { width: '100%', height: 180, backgroundColor: '#000' },
  overlayBtn: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioBox: {
    paddingVertical: 26,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1e293b',
  },
  audioPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkChip: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  linkChipText: { color: '#fff', fontSize: 11, fontWeight: '600' },
});
