import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../core/theme';
import { AppText } from './AppText';

// A single profile field shown as a chip. `label` is already localized by the
// caller (employer/agent screens pass strings from their own i18n namespace).
export interface CompletenessField {
  key: string;
  label: string;
  done: boolean;
  // Optional: tapping this specific chip runs its own action (e.g. the KYC
  // chip jumps straight to the KYC page) instead of the card-level onPress.
  onPress?: () => void;
}

interface Props {
  fields: CompletenessField[];
  onPress?: () => void;     // tap the card to go complete the profile
  style?: object;
}

// Level thresholds mirror the CRM ProfileCompletion widget.
const LEVELS = [
  { min: 90, labelKey: 'pc_level_complete',     tone: 'success' },
  { min: 70, labelKey: 'pc_level_almostDone',   tone: 'info' },
  { min: 40, labelKey: 'pc_level_gettingThere', tone: 'warning' },
  { min: 0,  labelKey: 'pc_level_incomplete',   tone: 'danger' },
] as const;

/**
 * Premium "Profile Strength" card — progress bar + per-field chips.
 * Generic & role-agnostic: the caller supplies the localized field list.
 * Uses the default `translation` namespace for its own chrome strings, which
 * both the employer and agent apps can resolve.
 */
export const ProfileCompletenessCard = ({ fields, onPress, style }: Props): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const c = theme.colors;

  if (!fields || fields.length === 0) return null;

  const done = fields.filter((f) => f.done).length;
  const pct = Math.round((done / fields.length) * 100);
  const missing = fields.length - done;
  const level = LEVELS.find((l) => pct >= l.min) ?? LEVELS[LEVELS.length - 1];

  const TONE: Record<string, string> = {
    success: c.success,
    info: c.info,
    warning: c.warning,
    danger: c.danger,
  };
  const levelColor = TONE[level.tone] ?? c.primary;

  const Container: React.ElementType = onPress ? TouchableOpacity : View;

  return (
    <Container
      activeOpacity={0.85}
      onPress={onPress}
      style={[s.card, { backgroundColor: c.card, borderColor: levelColor + '33' }, style]}
    >
      {/* Header: title + level pill + percentage */}
      <View style={s.headerRow}>
        <View style={s.titleRow}>
          <AppText variant="labelSm" numberOfLines={1} style={{ fontWeight: '800', color: c.text, flexShrink: 1 }}>
            {t('pc_title')}
          </AppText>
          <View style={[s.levelPill, { backgroundColor: levelColor + '1A', borderColor: levelColor + '40' }]}>
            <AppText style={{ fontSize: 10, fontWeight: '800', color: levelColor }}>
              {t(level.labelKey)}
            </AppText>
          </View>
        </View>
        <AppText style={{ fontSize: 22, fontWeight: '900', color: levelColor, letterSpacing: -0.5 }}>
          {pct}%
        </AppText>
      </View>

      {/* Progress bar */}
      <View style={[s.track, { backgroundColor: c.divider }]}>
        <View style={[s.fill, { width: `${pct}%`, backgroundColor: levelColor }]} />
      </View>

      {/* Field chips */}
      <View style={s.chips}>
        {fields.map((f) => {
          // A chip with its own onPress is independently tappable (and stops the
          // tap from bubbling up to the card-level onPress).
          const Chip: React.ElementType = f.onPress ? TouchableOpacity : View;
          return (
            <Chip
              key={f.key}
              activeOpacity={0.7}
              onPress={f.onPress}
              style={[
                s.chip,
                {
                  backgroundColor: f.done ? c.successLight : c.surface1,
                  borderColor: f.done ? c.success + '40' : c.border,
                },
              ]}
            >
              <AppText style={{ fontSize: 10, color: f.done ? c.success : c.mutedText, marginRight: 3 }}>
                {f.done ? '✓' : '○'}
              </AppText>
              <AppText style={{ fontSize: 11, fontWeight: f.done ? '600' : '500', color: f.done ? c.success : c.mutedText }}>
                {f.label}
              </AppText>
            </Chip>
          );
        })}
      </View>

      {/* Missing hint */}
      {missing > 0 && (
        <AppText style={{ fontSize: 11, color: c.mutedText, marginTop: 9 }}>
          {t('pc_completeMore', { count: missing })}
        </AppText>
      )}
    </Container>
  );
};

const s = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 },
  levelPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  track: { height: 8, borderRadius: 8, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
});
