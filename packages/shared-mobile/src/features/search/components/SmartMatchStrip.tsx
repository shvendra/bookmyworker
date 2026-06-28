import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../../../shared/components/ui/AppText';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { useSmartMatch, type SmartMatchParams } from '../../../core/hooks/useSmartMatch';
import { workerApi } from '../../../core/api/endpoints/workerApi';
import { buildPhotoUrl } from '../../../core/config/env';
import { useToast } from '../../../shared/state/toast/ToastContext';
import type { MainStackParamList } from '../../../app/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

/**
 * "Best Matches" strip — AI-ranked top workers for the active filters. Premium
 * cards with Call (contact unlock) + View (profile) actions and a gentle,
 * continuous auto-slide that pauses while the user is interacting. Renders
 * nothing while loading or when there are no matches.
 */
export const SmartMatchStrip = ({
  params,
  enabled = true,
}: {
  params: SmartMatchParams;
  enabled?: boolean;
}): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  const navigation = useNavigation<Nav>();
  const { data, isLoading } = useSmartMatch(params, enabled);
  const toast = useToast();

  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  // ── Gentle auto-slide (ping-pong), paused while the user drags ──────────────
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0);
  const dir = useRef(1);
  const contentW = useRef(0);
  const viewW = useRef(0);
  const paused = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = data?.success ? data.matches : [];

  useEffect(() => {
    if (!matches.length) return;
    const id = setInterval(() => {
      if (paused.current) return;
      const max = Math.max(0, contentW.current - viewW.current);
      if (max <= 1) return;
      offset.current += dir.current * 0.4; // slow & smooth (~24px/s)
      if (offset.current >= max) { offset.current = max; dir.current = -1; }
      else if (offset.current <= 0) { offset.current = 0; dir.current = 1; }
      scrollRef.current?.scrollTo({ x: offset.current, animated: false });
    }, 16);
    return () => {
      clearInterval(id);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, [matches.length]);

  if (isLoading || !matches.length) return null;

  const badgeColor = (score: number) =>
    score >= 80 ? theme.colors.success : score >= 60 ? theme.colors.primary : theme.colors.mutedText;

  const onView = (workerId: string): void => navigation.navigate('WorkerProfile', { workerId });

  const onCall = async (workerId: string): Promise<void> => {
    if (unlockingId) return;
    setUnlockingId(workerId);
    try {
      const res = await workerApi.unlockNumber(workerId);
      if (res.phone) {
        void Linking.openURL(`tel:${res.phone}`);
      } else {
        toast.error(res.message ?? t('wp_unlockFailDefault'), t('wp_unlockFailTitle'));
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; code?: string } }; message?: string };
      const code = e?.response?.data?.code;
      const msg = e?.response?.data?.message ?? e?.message;
      if (code === 'SUBSCRIPTION_EXPIRED') toast.warning(t('wp_toastExpired'), t('wp_expiredTitle'));
      else if (code === 'SUBSCRIPTION_REQUIRED') toast.error(t('wp_toastSubscribe'), t('wp_subscribeTitle'));
      else if (code === 'CONTACT_LIMIT') toast.warning(t('wp_toastLimit'), t('wp_limitTitle'));
      else toast.error(msg ?? t('wp_toastUnlockFail'), t('wp_errorTitle'));
    } finally {
      setUnlockingId(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <AppText style={[styles.title, { color: theme.colors.text }]}>✨ {t('sm_bestMatches')}</AppText>
        <View style={[styles.aiPill, { backgroundColor: theme.colors.primary + '14' }]}>
          <Ionicons name="sparkles" size={11} color={theme.colors.primary} />
          <AppText style={[styles.aiPillTxt, { color: theme.colors.primary }]}>{t('sm_aiRanked')}</AppText>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        scrollEventThrottle={16}
        onLayout={(e) => { viewW.current = e.nativeEvent.layout.width; }}
        onContentSizeChange={(w) => { contentW.current = w; }}
        onScroll={(e) => { offset.current = e.nativeEvent.contentOffset.x; }}
        onScrollBeginDrag={() => {
          paused.current = true;
          if (resumeTimer.current) clearTimeout(resumeTimer.current);
        }}
        onScrollEndDrag={() => {
          if (resumeTimer.current) clearTimeout(resumeTimer.current);
          resumeTimer.current = setTimeout(() => { paused.current = false; }, 2500);
        }}
      >
        {matches.map((m) => (
          <View
            key={m.workerId}
            style={[
              styles.card,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.shadow },
            ]}
          >
            <TouchableOpacity activeOpacity={0.85} onPress={() => onView(m.workerId)}>
              <View style={styles.topRow}>
                <Avatar name={m.name} uri={buildPhotoUrl(m.photo)} size={46} />
                <View style={[styles.scoreBadge, { backgroundColor: badgeColor(m.matchScore) + '1A' }]}>
                  <AppText style={[styles.scoreText, { color: badgeColor(m.matchScore) }]}>
                    {m.matchScore}%
                  </AppText>
                </View>
              </View>

              <View style={styles.nameRow}>
                <AppText variant="labelSm" color={theme.colors.text} numberOfLines={1} style={styles.name}>
                  {m.name}
                </AppText>
                {m.verified && <Ionicons name="checkmark-circle" size={13} color={theme.colors.primary} />}
              </View>

              <AppText variant="micro" color={theme.colors.mutedText} numberOfLines={1}>
                {m.reliability}
                {typeof m.avgRating === 'number' && m.avgRating > 0 ? ` · ${m.avgRating}★` : ''}
                {m.district ? ` · ${m.district}` : ''}
              </AppText>

              <AppText variant="micro" color={theme.colors.mutedText} numberOfLines={2} style={styles.reason}>
                {m.reason}
              </AppText>
            </TouchableOpacity>

            {/* Actions — Call (contact) + View (profile) */}
            <View style={[styles.actions, { borderTopColor: theme.colors.border }]}>
              <TouchableOpacity
                style={[styles.callBtn, { backgroundColor: theme.colors.primary }]}
                activeOpacity={0.85}
                disabled={!!unlockingId}
                onPress={() => void onCall(m.workerId)}
              >
                {unlockingId === m.workerId
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Ionicons name="call" size={16} color="#fff" />}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface ?? 'transparent' }]}
                activeOpacity={0.85}
                onPress={() => onView(m.workerId)}
              >
                <Ionicons name="eye-outline" size={16} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 15.5, fontWeight: '800' },
  aiPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  aiPillTxt: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.2 },
  scroll: { gap: 12, paddingRight: 4, paddingVertical: 2 },
  card: {
    width: 196,
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
    gap: 6,
    // premium soft shadow
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  scoreBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3.5 },
  scoreText: { fontSize: 12, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { textTransform: 'capitalize', flexShrink: 1 },
  reason: { lineHeight: 15, minHeight: 30 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  callBtn: { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  viewBtn: { width: 44, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
