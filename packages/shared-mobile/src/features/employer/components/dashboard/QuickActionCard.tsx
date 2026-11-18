import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
// Profile-completion nudge disabled for now — mandatory completion is enforced
// via the post-OTP WorkerProfileCompletionScreen instead.
// import { ProfileCompletionModal } from '../../../../shared/components/ui/ProfileCompletionModal';
import { AppText } from '../../../../shared/components/ui/AppText';


// ─── Quick Action Card ─────────────────────────────────────────────────────────
export interface QuickActionProps {
  title: string;
  subtitle: string;
  count: string | null;
  label: string;
  emoji: string;
  accentColor: string;
  iconBg: string;
  isLoading: boolean;
  onPress: () => void;
}
export const QuickActionCard = React.memo(({
  title, subtitle, count, label, emoji, accentColor, iconBg, isLoading, onPress,
}: QuickActionProps): React.JSX.Element => (
  <TouchableOpacity accessibilityRole="button" onPress={isLoading ? undefined : onPress} activeOpacity={0.85} style={[qa.card]}>
    <View style={[qa.topAccent, { backgroundColor: accentColor }]} />
    <View style={qa.inner}>
      <View style={qa.topRow}>
        <View style={[qa.iconWrap, { backgroundColor: iconBg }]}>
          <AppText style={qa.emoji}>{emoji}</AppText>
        </View>
        <AppText style={qa.chevron}>›</AppText>
      </View>
      {isLoading || count === null ? (
        <View style={qa.skeleton} />
      ) : (
        <AppText style={qa.count} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{count}</AppText>
      )}
      <AppText style={qa.label} numberOfLines={1}>{label}</AppText>
      <AppText style={qa.title} numberOfLines={1}>{title}</AppText>
      <AppText style={qa.subtitle} numberOfLines={2}>{subtitle}</AppText>
    </View>
  </TouchableOpacity>
));
QuickActionCard.displayName = 'QuickActionCard';

export const qa = StyleSheet.create({
  card:      { width: '48%', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', marginBottom: 12, overflow: 'hidden', elevation: 2, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  topAccent: { height: 4 },
  inner:     { padding: 14 },
  topRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  iconWrap:  { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  emoji:     { fontSize: 22, lineHeight: 26 },
  chevron:   { fontSize: 22, color: '#94a3b8', fontWeight: '600', lineHeight: 26 },
  skeleton:  { height: 26, width: '55%', borderRadius: 8, backgroundColor: '#e2e8f0', marginBottom: 4 },
  count:     { fontSize: 22, fontWeight: '900', color: '#0f172a', lineHeight: 26, marginBottom: 2 },
  label:     { fontSize: 10, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  title:     { fontSize: 13, fontWeight: '800', color: '#0f172a', marginBottom: 3 },
  subtitle:  { fontSize: 11, color: '#64748b', lineHeight: 15 },
});

