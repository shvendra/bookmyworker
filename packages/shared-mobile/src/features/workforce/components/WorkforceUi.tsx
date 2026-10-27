import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';
import type { RequirementStatus } from '../../../core/api/endpoints/workforceRequirementsApi';

/**
 * Shared look for the employer's Workforce screens: a progress bar, a collapsible
 * "How this works" card, a "what happens next" card, a lifecycle stepper and a one-line
 * help note. The same ideas as the CRM employer portal, so both feel like one product.
 */

export const STATUS_TONE: Record<RequirementStatus, string> = {
  Submitted: '#7C3AED',
  UnderReview: '#D97706',
  Approved: '#2563EB',
  Rejected: '#DC2626',
  PartiallyFulfilled: '#0891B2',
  Fulfilled: '#16A34A',
  Closed: '#64748B',
  Cancelled: '#64748B',
};

interface FillBarProps { value: number; total: number; label?: string }
export const FillBar = ({ value, total, label }: FillBarProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const done = total > 0 && value >= total;
  return (
    <View accessible accessibilityLabel={label ?? `${value} / ${total}`}>
      <View style={styles.fillTop}>
        <AppText variant="labelSm">{value} <AppText variant="caption" color={theme.colors.mutedText}>/ {total}</AppText></AppText>
        <AppText variant="micro" color={done ? '#16A34A' : theme.colors.mutedText}>{pct}%</AppText>
      </View>
      <View style={[styles.track, { backgroundColor: theme.colors.border }]}>
        <View style={[styles.bar, { width: `${pct}%`, backgroundColor: done ? '#16A34A' : theme.colors.primary }]} />
      </View>
      {label ? <AppText variant="micro" color={theme.colors.mutedText} style={styles.fillLabel}>{label}</AppText> : null}
    </View>
  );
};

export interface HelpStep { title: string; text: string; who?: string }
interface HowItWorksProps { id: string; title: string; intro?: string; steps: HelpStep[]; defaultOpen?: boolean }
export const HowItWorksCard = ({ id, title, intro, steps, defaultOpen = true }: HowItWorksProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const key = `wf-help-${id}`;
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key).then((v) => { if (alive && v !== null) setOpen(v === '1'); }).catch(() => undefined);
    return () => { alive = false; };
  }, [key]);
  const toggle = (): void => {
    const next = !open;
    setOpen(next);
    AsyncStorage.setItem(key, next ? '1' : '0').catch(() => undefined);
  };
  return (
    <View style={[styles.help, { borderColor: theme.colors.primary + '40', backgroundColor: theme.colors.primary + '0F' }]}>
      <Pressable onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.helpHead}>
        <AppText variant="label" style={styles.flex}>💡 {title}</AppText>
        <AppText variant="caption" color={theme.colors.mutedText}>{open ? '▲' : '▼'}</AppText>
      </Pressable>
      {open ? (
        <View style={styles.helpBody}>
          {intro ? <AppText variant="caption" color={theme.colors.textSecondary} style={styles.helpIntro}>{intro}</AppText> : null}
          {steps.map((s, i) => (
            <View key={s.title} style={styles.stepRow}>
              <View style={[styles.stepNo, { backgroundColor: theme.colors.primary }]}>
                <AppText variant="micro" color="#fff" weight="800">{i + 1}</AppText>
              </View>
              <View style={styles.flex}>
                <AppText variant="labelSm">{s.title}{s.who ? <AppText variant="micro" color={theme.colors.mutedText}>  · {s.who}</AppText> : null}</AppText>
                <AppText variant="caption" color={theme.colors.textSecondary}>{s.text}</AppText>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

interface NextStepProps { tone: string; title: string; text: string }
export const NextStepCard = ({ tone, title, text }: NextStepProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.next, { borderLeftColor: tone, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <AppText variant="labelSm">{title}</AppText>
      <AppText variant="caption" color={theme.colors.textSecondary} style={styles.nextText}>{text}</AppText>
    </View>
  );
};

/** One-line ⓘ explanation under a field / button: what it does, what changes. */
export const HelpNote = ({ text }: { text: string }): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View style={styles.note}>
      <AppText variant="caption" color={theme.colors.mutedText}>ⓘ {text}</AppText>
    </View>
  );
};

const LIFECYCLE: RequirementStatus[] = ['Submitted', 'UnderReview', 'Approved', 'PartiallyFulfilled', 'Fulfilled'];
export const LifecycleDots = ({ status, labels }: { status: RequirementStatus; labels: string[] }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const at = Math.max(0, LIFECYCLE.indexOf(status));
  const terminal = ['Rejected', 'Cancelled', 'Closed'].includes(status);
  return (
    <View style={styles.dots}>
      {LIFECYCLE.map((s, i) => {
        const done = !terminal && i < at;
        const current = !terminal && i === at;
        return (
          <View key={s} style={styles.dotCol}>
            <View style={[styles.dot, { backgroundColor: done ? '#16A34A' : current ? theme.colors.primary : 'transparent', borderColor: done ? '#16A34A' : current ? theme.colors.primary : theme.colors.border }]}>
              <AppText variant="micro" color={done || current ? '#fff' : theme.colors.mutedText} weight="800">{done ? '✓' : i + 1}</AppText>
            </View>
            <AppText variant="micro" center color={current ? theme.colors.text : theme.colors.mutedText} numberOfLines={2}>{labels[i]}</AppText>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fillTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3 },
  fillLabel: { marginTop: 4 },
  help: { borderWidth: 1, borderRadius: 14, marginBottom: 12, overflow: 'hidden' },
  helpHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, gap: 8 },
  helpBody: { paddingHorizontal: 14, paddingBottom: 12, gap: 10 },
  helpIntro: { marginBottom: 2 },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNo: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  next: { borderWidth: 1, borderLeftWidth: 4, borderRadius: 12, padding: 12, marginBottom: 12 },
  nextText: { marginTop: 2 },
  note: { marginTop: 4, marginBottom: 6 },
  dots: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  dotCol: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 2 },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
