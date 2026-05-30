import React, { useState, useCallback } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../../../packages/shared-mobile/src/shared/components/ui/AppText';
import { WORK_CATEGORIES } from '../../../../packages/shared-mobile/src/shared/components/ui/WorkerCategoryGrid';
import { useAuth } from '../../../../packages/shared-mobile/src/state/auth/AuthContext';
import { ENV } from '../../../../packages/shared-mobile/src/core/config/env';
import { getAccessToken } from '../../../../packages/shared-mobile/src/core/storage/authStorage';
import type { AgentStackParamList } from '../../navigation/types';

const { width: SW } = Dimensions.get('window');

const BRAND        = '#1037A4';
const BRAND_DARK   = '#0B2A80';
const BRAND_SOFT   = '#EBF1FF';
const ORANGE       = '#F97316';
const NAVY         = '#0F172A';
const SLATE        = '#64748B';
const BORDER       = '#E2E8F0';
const WHITE        = '#FFFFFF';
const CARD_W       = (SW - 48 - 12) / 2;

type Props = NativeStackScreenProps<AgentStackParamList, 'WorkCategorySelect'>;

export const WorkCategorySelectScreen = ({ navigation }: Props): React.JSX.Element => {
  const insets       = useSafeAreaInsets();
  const { updateProfile } = useAuth();
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving]     = useState(false);

  const toggle = useCallback((value: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
  }, []);

  const handleComplete = async (): Promise<void> => {
    if (selected.size === 0 || isSaving) return;
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      await fetch(`${ENV.API_BASE_URL}/api/v1/user/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ areasOfWork: Array.from(selected) }),
      });
      await updateProfile({ areasOfWork: Array.from(selected) });
    } catch {
      // non-fatal — proceed to Kyc regardless
    } finally {
      setIsSaving(false);
    }
    navigation.replace('Kyc');
  };

  const handleSkip = (): void => {
    navigation.replace('Kyc');
  };

  const selCount = selected.size;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_DARK} />

      {/* ── HERO HEADER ── */}
      <View style={[s.hero, { paddingTop: insets.top + 8 }]}>
        {/* Decorative blobs */}
        <View style={[s.blob, s.blob1]} />
        <View style={[s.blob, s.blob2]} />
        <View style={[s.blob, s.blob3]} />
        <View style={s.orangeStrip} />

        {/* Top bar */}
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.75} style={s.iconBtn}>
            <AppText style={s.iconBtnTxt}>✕</AppText>
          </TouchableOpacity>

          {/* Step pill */}
          <View style={s.stepPill}>
            <View style={s.stepDot} />
            <AppText style={s.stepTxt}>1 / 1</AppText>
          </View>

          <TouchableOpacity onPress={handleSkip} activeOpacity={0.75} style={s.skipBtn}>
            <AppText style={s.skipTxt}>Skip</AppText>
          </TouchableOpacity>
        </View>

        {/* Hero icon */}
        <View style={s.heroIconWrap}>
          <View style={s.heroIconBox}>
            <AppText style={s.heroIconEmoji}>💼</AppText>
          </View>
          {selCount > 0 && (
            <View style={s.heroBadge}>
              <AppText style={s.heroBadgeTxt}>{selCount}</AppText>
            </View>
          )}
        </View>

        <AppText style={s.heroTitle}>What work do you do?</AppText>
        <AppText style={s.heroSub}>
          Choose the categories that best describe your skills
        </AppText>

        {/* Progress bar */}
        <View style={s.progressBar}>
          <View style={s.progressFill} />
        </View>
      </View>

      {/* ── BODY ── */}
      <ScrollView
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section label */}
        <View style={s.sectionLabelRow}>
          <View style={s.sectionLine} />
          <AppText style={s.sectionLabel}>Select all that apply</AppText>
          <View style={s.sectionLine} />
        </View>

        {/* Category grid */}
        <View style={s.grid}>
          {WORK_CATEGORIES.map((cat) => {
            const isOn = selected.has(cat.value);
            return (
              <Pressable
                key={cat.value}
                onPress={() => toggle(cat.value)}
                style={[
                  s.card,
                  isOn && { borderColor: cat.accent, borderWidth: 2.5, backgroundColor: cat.accent + '0D' },
                ]}
              >
                {/* Emoji icon circle */}
                <View style={[s.emojiCircle, { backgroundColor: isOn ? cat.accent : cat.accent + '1A' }]}>
                  <AppText style={s.emojiTxt}>{cat.emoji}</AppText>
                </View>

                {/* Label */}
                <AppText
                  style={[s.cardLabel, isOn && { color: cat.accent }]}
                  numberOfLines={2}
                >
                  {cat.label.replace(' Workers', '').replace(' & ', '\n& ')}
                </AppText>

                {/* Selected tick */}
                {isOn && (
                  <View style={[s.tick, { backgroundColor: cat.accent }]}>
                    <AppText style={s.tickTxt}>✓</AppText>
                  </View>
                )}

                {/* Accent corner bar */}
                {isOn && <View style={[s.accentEdge, { backgroundColor: cat.accent }]} />}
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── STICKY FOOTER ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        {/* Selection counter chip */}
        {selCount > 0 && (
          <View style={s.countChip}>
            <View style={s.countDot} />
            <AppText style={s.countTxt}>
              {selCount} {selCount === 1 ? 'category' : 'categories'} selected
            </AppText>
          </View>
        )}

        {/* CTA button */}
        <TouchableOpacity
          onPress={() => void handleComplete()}
          disabled={selCount === 0 || isSaving}
          activeOpacity={0.87}
          style={[
            s.ctaBtn,
            selCount === 0
              ? { backgroundColor: '#CBD5E1' }
              : { backgroundColor: BRAND },
          ]}
        >
          {isSaving ? (
            <AppText style={s.ctaTxt}>Saving…</AppText>
          ) : (
            <AppText style={s.ctaTxt}>
              {selCount === 0 ? 'Complete Profile  ✓' : `Complete Profile  ✓`}
            </AppText>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={s.skipRow}>
          <AppText style={s.skipRowTxt}>Skip this step</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFF' },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: BRAND,
    paddingHorizontal: 22,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  blob:  { position: 'absolute', borderRadius: 999 },
  blob1: { width: 300, height: 300, top: -130, right: -80, backgroundColor: 'rgba(255,255,255,0.055)' },
  blob2: { width: 160, height: 160, bottom: -60, right: 20,  backgroundColor: 'rgba(249,115,22,0.09)' },
  blob3: { width: 90,  height: 90,  top: 20,    left: -35,   backgroundColor: 'rgba(255,255,255,0.04)' },
  orangeStrip: { position: 'absolute', bottom: 0, left: 0, width: '38%', height: 4, backgroundColor: ORANGE, borderTopRightRadius: 999 },

  topBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  iconBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  iconBtnTxt:{ color: WHITE, fontSize: 14, fontWeight: '700', lineHeight: 18 },
  stepPill:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  stepDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: ORANGE },
  stepTxt:   { color: WHITE, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  skipBtn:   { paddingHorizontal: 4, paddingVertical: 4 },
  skipTxt:   { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },

  heroIconWrap: { alignSelf: 'center', marginBottom: 14 },
  heroIconBox: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: WHITE,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: BRAND_DARK, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
  },
  heroIconEmoji: { fontSize: 30, lineHeight: 36 },
  heroBadge: {
    position: 'absolute', top: -6, right: -8,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: ORANGE, borderWidth: 2, borderColor: BRAND,
    alignItems: 'center', justifyContent: 'center',
  },
  heroBadgeTxt: { color: WHITE, fontSize: 11, fontWeight: '900', lineHeight: 14 },

  heroTitle: { color: WHITE, fontSize: 26, fontWeight: '900', textAlign: 'center', lineHeight: 33, letterSpacing: -0.5, marginBottom: 6 },
  heroSub:   { color: 'rgba(255,255,255,0.68)', fontSize: 13.5, textAlign: 'center', lineHeight: 19, marginBottom: 16 },

  progressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, overflow: 'hidden' },
  progressFill: { width: '100%', height: '100%', backgroundColor: ORANGE, borderRadius: 999 },

  // ── Body ─────────────────────────────────────────────────────────────────
  body: { paddingHorizontal: 16, paddingTop: 20 },

  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  sectionLine:     { flex: 1, height: 1, backgroundColor: BORDER },
  sectionLabel:    { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: SLATE, textTransform: 'uppercase' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  card: {
    width: CARD_W,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: WHITE,
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  emojiCircle: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiTxt: { fontSize: 26, lineHeight: 32 },

  cardLabel: {
    fontSize: 12.5, fontWeight: '700', color: NAVY,
    textAlign: 'center', lineHeight: 17, letterSpacing: -0.1,
  },

  tick: {
    position: 'absolute', top: 10, right: 10,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  tickTxt: { color: WHITE, fontSize: 10, fontWeight: '900', lineHeight: 14 },

  accentEdge: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },

  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: WHITE,
    borderTopWidth: 1, borderTopColor: BORDER,
    paddingHorizontal: 20, paddingTop: 14,
    shadowColor: NAVY, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 12,
  },

  countChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: BRAND_SOFT, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    alignSelf: 'center', marginBottom: 12,
  },
  countDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: BRAND },
  countTxt:  { fontSize: 13, fontWeight: '700', color: BRAND },

  ctaBtn: {
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: BRAND_DARK, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },
  ctaTxt: { color: WHITE, fontSize: 16, fontWeight: '800', letterSpacing: 0.1 },

  skipRow:    { alignItems: 'center', paddingTop: 12 },
  skipRowTxt: { fontSize: 13, color: SLATE, fontWeight: '600' },
});
