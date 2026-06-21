import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../../../shared/components/ui/AppText';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { useSmartMatch, type SmartMatchParams } from '../../../core/hooks/useSmartMatch';
import { buildPhotoUrl } from '../../../core/config/env';
import type { MainStackParamList } from '../../../app/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

/**
 * "Best Matches" strip — AI-ranked top workers for the active filters.
 * Self-contained: fetches via useSmartMatch and renders a horizontal scroller.
 * Renders nothing while loading or when there are no matches, so it never
 * disrupts the main results list.
 */
export const SmartMatchStrip = ({
  params,
  enabled = true,
}: {
  params: SmartMatchParams;
  enabled?: boolean;
}): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const { data, isLoading } = useSmartMatch(params, enabled);

  const matches = data?.success ? data.matches : [];
  if (isLoading || !matches.length) return null;

  const badgeColor = (score: number) =>
    score >= 80 ? theme.colors.success : score >= 60 ? theme.colors.primary : theme.colors.mutedText;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <AppText style={[styles.title, { color: theme.colors.text }]}>✨ Best Matches</AppText>
        <AppText variant="micro" color={theme.colors.mutedText}>AI-ranked for you</AppText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {matches.map((m) => (
          <TouchableOpacity
            key={m.workerId}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('WorkerProfile', { workerId: m.workerId })}
            style={[
              styles.card,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.topRow}>
              <Avatar name={m.name} uri={buildPhotoUrl(m.photo)} size={40} />
              <View style={[styles.scoreBadge, { backgroundColor: badgeColor(m.matchScore) + '1A' }]}>
                <AppText style={[styles.scoreText, { color: badgeColor(m.matchScore) }]}>
                  {m.matchScore}%
                </AppText>
              </View>
            </View>

            <AppText variant="labelSm" color={theme.colors.text} numberOfLines={1} style={styles.name}>
              {m.name}
            </AppText>

            <View style={styles.metaRow}>
              {m.verified && <Ionicons name="checkmark-circle" size={12} color={theme.colors.primary} />}
              <AppText variant="micro" color={theme.colors.mutedText} numberOfLines={1}>
                {m.reliability}
                {typeof m.avgRating === 'number' && m.avgRating > 0 ? ` · ${m.avgRating}★` : ''}
              </AppText>
            </View>

            <AppText variant="micro" color={theme.colors.mutedText} numberOfLines={2} style={styles.reason}>
              {m.reason}
            </AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 15, fontWeight: '800' },
  scroll: { gap: 10, paddingRight: 4 },
  card: {
    width: 170,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  scoreText: { fontSize: 12, fontWeight: '800' },
  name: { textTransform: 'capitalize' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reason: { lineHeight: 15 },
});
