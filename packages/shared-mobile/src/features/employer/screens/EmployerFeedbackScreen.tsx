import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AppText } from '../../../shared/components/ui/AppText';
import { AppButton } from '../../../shared/components/ui/AppButton';
import { ScreenHeader } from '../../../shared/components/ui/GradientHeader';
import { useAppTheme } from '../../../core/theme';
import { selfFeedbackApi, type SelfFeedbackStatus } from '../../../core/api/endpoints/selfFeedbackApi';
import type { MainStackParamList } from '../../../app/navigation/types';
import {
  ASPECT_ROWS, FEEDBACK_STEPS, IMPROVE_CHOICES, MAX_IMPROVE, OVERALL_OPTIONS, PRICING_CHOICES, RENEW_CHOICES, SUPPORT_CHOICES,
  emptyDraft, isStepDone, toggleImprove, toSubmitBody, withRating, type FeedbackDraft,
} from '../utils/feedbackForm';

type Props = NativeStackScreenProps<MainStackParamList, 'EmployerFeedback'>;

const BRAND = '#1037A4';
const longDate = (d?: string | null): string => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

const Stars = ({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }): React.JSX.Element => (
  <View style={s.stars} accessibilityLabel={label}>
    {[1, 2, 3, 4, 5].map((n) => (
      <TouchableOpacity key={n} onPress={() => onChange(value === n ? 0 : n)} hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }} accessibilityLabel={`${label} ${n}`}>
        <AppText style={[s.star, { color: n <= value ? '#F59E0B' : '#CBD5E1' }]}>★</AppText>
      </TouchableOpacity>
    ))}
  </View>
);

const Chip = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }): React.JSX.Element => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.75} accessibilityState={{ selected: on }}
    style={[s.chip, on && { backgroundColor: BRAND, borderColor: BRAND }]}>
    <AppText style={[s.chipText, on && { color: '#fff' }]}>{label}</AppText>
  </TouchableOpacity>
);

const Question = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View style={s.question}>
      <AppText style={[s.qTitle, { color: theme.colors.text }]}>{title}</AppText>
      {hint ? <AppText style={[s.qHint, { color: theme.colors.mutedText }]}>{hint}</AppText> : null}
      {children}
    </View>
  );
};

export const EmployerFeedbackScreen = ({ navigation, route }: Props): React.JSX.Element => {
  const { t } = useTranslation('employer');
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const fromPrompt = !!route.params?.fromPrompt;

  const [status, setStatus] = useState<SelfFeedbackStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<FeedbackDraft>(emptyDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ needsFollowUp: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    selfFeedbackApi.status().then((r) => { if (alive) setStatus(r); }).catch(() => { if (alive) setLoadFailed(true); });
    return () => { alive = false; };
  }, []);

  const set = (patch: Partial<FeedbackDraft>): void => setDraft((d) => ({ ...d, ...patch }));
  const canContinue = isStepDone(step, draft);

  const later = (): void => {
    if (fromPrompt) selfFeedbackApi.dismiss().catch(() => undefined);
    navigation.goBack();
  };

  const submit = async (): Promise<void> => {
    setBusy(true); setError('');
    try {
      setDone(await selfFeedbackApi.submit(toSubmitBody(draft)));
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('fb_sendFailed'));
    } finally {
      setBusy(false);
    }
  };

  const message = (icon: string, title: string, body: string, showButton = true): React.JSX.Element => (
    <View style={s.center}>
      <AppText style={s.bigIcon}>{icon}</AppText>
      <AppText style={[s.doneTitle, { color: theme.colors.text }]}>{title}</AppText>
      <AppText style={[s.doneBody, { color: theme.colors.mutedText }]}>{body}</AppText>
      {showButton ? <AppButton title={t('fb_close')} onPress={() => navigation.goBack()} size="lg" style={{ marginTop: 24, minWidth: 160 }} /> : null}
    </View>
  );

  let body: React.JSX.Element;
  if (done) {
    body = message('✅', done.needsFollowUp ? t('fb_doneSorryTitle') : t('fb_doneTitle'), done.needsFollowUp ? t('fb_doneSorryBody') : t('fb_doneBody'));
  } else if (loadFailed) {
    body = message('⚠️', t('fb_loadFailedTitle'), t('fb_loadFailedBody'));
  } else if (!status) {
    body = <View style={s.center}><ActivityIndicator color={BRAND} /></View>;
  } else if (status.activePlan === false) {
    body = message('🔒', t('fb_planTitle'), t('fb_planBody'));
  } else if (!status.canSubmit) {
    body = message('🙏', t('fb_thanksTitle'), [
      status.lastSubmittedAt ? t('fb_sharedOn', { date: longDate(status.lastSubmittedAt) }) : '',
      status.nextAvailableAt ? t('fb_askAgain', { date: longDate(status.nextAvailableAt) }) : '',
    ].filter(Boolean).join(' '));
  } else {
    const picked = OVERALL_OPTIONS.find((o) => o.value === draft.overall);
    body = (
      <>
        <View style={s.progress}><View style={[s.progressBar, { width: `${((step + 1) / FEEDBACK_STEPS) * 100}%` }]} /></View>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <Question title={t('fb_overallQ')} hint={t('fb_overallHint')}>
              <View style={s.faces}>
                {OVERALL_OPTIONS.map((o) => {
                  const on = draft.overall === o.value;
                  return (
                    <TouchableOpacity key={o.value} onPress={() => set({ overall: o.value })} accessibilityLabel={t(o.labelKey)} accessibilityState={{ selected: on }}
                      style={[s.face, on && { borderColor: o.color, backgroundColor: `${o.color}22` }]}>
                      <AppText style={[s.faceEmoji, !on && { opacity: 0.55 }]}>{o.emoji}</AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <AppText style={[s.picked, { color: picked?.color ?? theme.colors.mutedText }]}>{picked ? t(picked.labelKey) : t('fb_selectRating')}</AppText>
            </Question>
          )}

          {step === 1 && (
            <>
              <AppText style={[s.qHint, { color: theme.colors.mutedText, marginBottom: 14 }]}>{t('fb_rateWhatUsed')}</AppText>
              {ASPECT_ROWS.map((a) => (
                <View key={a.key} style={s.aspect}>
                  <View style={{ flex: 1 }}>
                    <AppText style={[s.qTitle, { color: theme.colors.text }]}>{t(a.labelKey)}</AppText>
                    <AppText style={[s.qHint, { color: theme.colors.mutedText }]}>{t(a.hintKey)}</AppText>
                  </View>
                  <Stars label={t(a.labelKey)} value={draft.ratings[a.key] ?? 0} onChange={(n) => set({ ratings: withRating(draft.ratings, a.key, n) })} />
                </View>
              ))}
              <Question title={t('fb_supportQ')}>
                <View style={s.chips}>
                  {SUPPORT_CHOICES.map((c) => <Chip key={c.value} label={t(c.labelKey)} on={draft.supportReceived === c.value} onPress={() => set({ supportReceived: draft.supportReceived === c.value ? '' : c.value })} />)}
                </View>
              </Question>
              {draft.supportReceived === 'yes' && (
                <View style={s.aspect}>
                  <AppText style={[s.qTitle, { color: theme.colors.text, flex: 1 }]}>{t('fb_supportHow')}</AppText>
                  <Stars label={t('fb_supportHow')} value={draft.ratings.support ?? 0} onChange={(n) => set({ ratings: withRating(draft.ratings, 'support', n) })} />
                </View>
              )}
              {draft.supportReceived === 'no' && (
                <TextInput style={[s.input, { color: theme.colors.text, borderColor: theme.colors.border }]} multiline placeholder={t('fb_supportWrong')} placeholderTextColor={theme.colors.mutedText}
                  value={draft.supportIssue} onChangeText={(v) => set({ supportIssue: v.slice(0, 300) })} />
              )}
            </>
          )}

          {step === 2 && (
            <>
              <Question title={t('fb_pricingQ')}>
                <View style={s.chips}>{PRICING_CHOICES.map((c) => <Chip key={c.value} label={t(c.labelKey)} on={draft.pricing === c.value} onPress={() => set({ pricing: draft.pricing === c.value ? '' : c.value })} />)}</View>
              </Question>
              <Question title={t('fb_recommendQ')} hint={t('fb_recommendHint')}>
                <View style={s.chips}>
                  {Array.from({ length: 11 }, (_, n) => (
                    <TouchableOpacity key={n} onPress={() => set({ recommend: draft.recommend === n ? null : n })} accessibilityLabel={`${n}`}
                      style={[s.score, draft.recommend === n && { backgroundColor: BRAND, borderColor: BRAND }]}>
                      <AppText style={[s.chipText, draft.recommend === n && { color: '#fff' }]}>{n}</AppText>
                    </TouchableOpacity>
                  ))}
                </View>
              </Question>
              <Question title={t('fb_renewQ')}>
                <View style={s.chips}>{RENEW_CHOICES.map((c) => <Chip key={c.value} label={t(c.labelKey)} on={draft.renewIntent === c.value} onPress={() => set({ renewIntent: draft.renewIntent === c.value ? '' : c.value })} />)}</View>
              </Question>
              <Question title={t('fb_improveQ')} hint={t('fb_improveHint', { count: MAX_IMPROVE })}>
                <View style={s.chips}>{IMPROVE_CHOICES.map((c) => <Chip key={c.value} label={t(c.labelKey)} on={draft.improve.includes(c.value)} onPress={() => set({ improve: toggleImprove(draft.improve, c.value) })} />)}</View>
              </Question>
              <TextInput style={[s.input, { color: theme.colors.text, borderColor: theme.colors.border, minHeight: 84 }]} multiline placeholder={t('fb_commentPlaceholder')} placeholderTextColor={theme.colors.mutedText}
                value={draft.comment} onChangeText={(v) => set({ comment: v.slice(0, 500) })} />
              <AppText style={[s.qHint, { color: theme.colors.mutedText, textAlign: 'right' }]}>{draft.comment.length}/500</AppText>
              {error ? <AppText style={s.error}>{error}</AppText> : null}
            </>
          )}
        </ScrollView>

        <View style={[s.footer, { paddingBottom: insets.bottom + 12, borderTopColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
          <TouchableOpacity onPress={later} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <AppText style={[s.laterText, { color: theme.colors.mutedText }]}>{fromPrompt ? t('fb_later') : t('fb_cancel')}</AppText>
          </TouchableOpacity>
          <View style={s.footerRight}>
            {step > 0 ? <AppButton title={t('fb_back')} variant="ghost" onPress={() => setStep(step - 1)} /> : null}
            {step < FEEDBACK_STEPS - 1
              ? <AppButton title={t('fb_next')} onPress={() => setStep(step + 1)} disabled={!canContinue} />
              : <AppButton title={busy ? t('fb_sending') : t('fb_submit')} onPress={submit} disabled={busy || !draft.overall || !canContinue} loading={busy} />}
          </View>
        </View>
      </>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} />
      <ScreenHeader title={t('fb_title')} onBack={() => navigation.goBack()} />
      {body}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  bigIcon: { fontSize: 52, marginBottom: 8 },
  doneTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  doneBody: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  progress: { height: 4, backgroundColor: '#E2E8F0' },
  progressBar: { height: 4, backgroundColor: BRAND },
  scroll: { padding: 20, paddingBottom: 40 },
  question: { marginBottom: 22 },
  qTitle: { fontSize: 15, fontWeight: '700' },
  qHint: { fontSize: 12.5, marginTop: 2, marginBottom: 8 },
  faces: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  face: { flex: 1, alignItems: 'center', paddingVertical: 10, marginHorizontal: 3, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  faceEmoji: { fontSize: 34 },
  picked: { textAlign: 'center', fontWeight: '700', marginTop: 10, minHeight: 22 },
  aspect: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 10 },
  stars: { flexDirection: 'row' },
  star: { fontSize: 28, marginHorizontal: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: '#CBD5E1' },
  chipText: { fontSize: 13.5, fontWeight: '600', color: '#334155' },
  score: { minWidth: 40, alignItems: 'center', paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 64, textAlignVertical: 'top', fontSize: 14 },
  error: { color: '#DC2626', fontSize: 13, marginTop: 10 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  laterText: { fontSize: 14, fontWeight: '600' },
});
