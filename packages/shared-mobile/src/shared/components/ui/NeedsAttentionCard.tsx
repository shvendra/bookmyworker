import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../core/theme';
import { AppText } from './AppText';

export type AttentionPriority = 'high' | 'medium' | 'low';

// One actionable item. `title`/`desc` are already localized by the caller.
export interface AttentionItem {
  key: string;
  emoji: string;
  title: string;
  desc: string;
  priority: AttentionPriority;
  onPress?: () => void;
}

interface Props {
  items: AttentionItem[];
  style?: object;
}

/**
 * Premium "Needs Attention" card — a prioritized list of pending actions.
 * Mirrors the CRM employer NeedsAttentionWidget. Role-agnostic: callers build
 * the localized item list. Renders nothing when there are no items.
 * Uses the default `translation` namespace for its own chrome strings.
 */
export const NeedsAttentionCard = ({ items, style }: Props): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const c = theme.colors;

  if (!items || items.length === 0) return null;

  const highCount = items.filter((i) => i.priority === 'high').length;

  const PRIO: Record<AttentionPriority, { color: string; bg: string; label: string }> = {
    high:   { color: c.danger,  bg: c.dangerLight,  label: t('priority_high') },
    medium: { color: c.warning, bg: c.warningLight, label: t('priority_medium') },
    low:    { color: c.success, bg: c.successLight, label: t('priority_low') },
  };

  return (
    <View style={[s.card, { backgroundColor: c.card, borderColor: highCount > 0 ? c.danger + '33' : c.border }, style]}>
      {/* Header */}
      <View style={s.header}>
        <AppText style={{ fontSize: 15 }}>⚠️</AppText>
        <AppText variant="subtitle" style={{ color: c.text, flex: 1, fontSize: 15 }}>
          {t('na_title')}
        </AppText>
        {highCount > 0 && (
          <View style={[s.urgentPill, { backgroundColor: c.dangerLight }]}>
            <AppText style={{ fontSize: 10.5, fontWeight: '800', color: c.danger }}>
              {t('na_urgent', { count: highCount })}
            </AppText>
          </View>
        )}
      </View>

      {/* Items */}
      <View style={{ marginTop: 4 }}>
        {items.map((it, idx) => {
          const p = PRIO[it.priority];
          const Row: React.ElementType = it.onPress ? TouchableOpacity : View;
          return (
            <Row
              key={it.key}
              activeOpacity={0.8}
              onPress={it.onPress}
              style={[s.itemRow, idx > 0 && { borderTopWidth: 1, borderTopColor: c.divider }]}
            >
              <View style={[s.itemIcon, { backgroundColor: p.bg }]}>
                <AppText style={{ fontSize: 16 }}>{it.emoji}</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontSize: 13, fontWeight: '700', color: c.text }} numberOfLines={1}>
                  {it.title}
                </AppText>
                <AppText style={{ fontSize: 11.5, color: c.mutedText, marginTop: 1 }} numberOfLines={2}>
                  {it.desc}
                </AppText>
              </View>
              <View style={[s.prioPill, { backgroundColor: p.bg }]}>
                <AppText style={{ fontSize: 9.5, fontWeight: '800', color: p.color, letterSpacing: 0.3 }}>
                  {p.label}
                </AppText>
              </View>
              {it.onPress ? <AppText style={{ color: c.mutedText, fontSize: 18, marginLeft: 2 }}>›</AppText> : null}
            </Row>
          );
        })}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  urgentPill: { paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 999 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  itemIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  prioPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, flexShrink: 0 },
});
