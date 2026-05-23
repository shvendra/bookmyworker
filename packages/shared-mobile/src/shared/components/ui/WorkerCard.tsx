import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../../core/theme';
import type { WorkerProfile } from '../../types/domain';
import { AppCard } from './AppCard';
import { AppText } from './AppText';
import { Avatar } from './Avatar';
import { Badge } from './Badge';

interface WorkerCardProps {
  worker: WorkerProfile;
  onPress?: () => void;
  actionSlot?: React.ReactNode;
  /** Compact list mode — no skills/salary row */
  compact?: boolean;
}


export const WorkerCard = ({ worker, onPress, actionSlot, compact = false }: WorkerCardProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const isDark = theme.mode === 'dark';

  // Skills — use areasOfWork if available, fall back to category
  const skills: string[] = (worker as unknown as { areasOfWork?: string[] }).areasOfWork?.slice(0, 3) ??
    (worker.category ? [worker.category] : []);
  const extraSkills = skills.length - 3;

  const salaryText = worker.dailyRate
    ? `₹${worker.dailyRate.toLocaleString('en-IN')}/day`
    : (worker as unknown as { monthlySalary?: number }).monthlySalary
    ? `₹${((worker as unknown as { monthlySalary?: number }).monthlySalary ?? 0).toLocaleString('en-IN')}/mo`
    : null;

  return (
    <AppCard onPress={onPress} style={styles.card} variant="default">
      {/* Top row: avatar + info + badge */}
      <View style={styles.topRow}>
        <Avatar
          name={worker.fullName}
          uri={worker.profileImage}
          size={52}
          online={worker.available}
        />

        <View style={styles.info}>
          {/* Name + verified */}
          <View style={styles.nameRow}>
            <AppText variant="label" color={theme.colors.text} numberOfLines={1} style={styles.name}>
              {worker.fullName}
            </AppText>
            {worker.verified && (
              <View style={[styles.verifiedChip, { backgroundColor: theme.colors.infoLight }]}>
                <AppText style={[styles.verifiedText, { color: theme.colors.primary }]}>✓ Verified</AppText>
              </View>
            )}
          </View>

          {/* Category */}
          <AppText variant="caption" color={theme.colors.mutedText} numberOfLines={1}>
            {worker.category}
            {worker.subCategory ? ` · ${worker.subCategory}` : ''}
            {worker.experienceYears ? ` · ${worker.experienceYears}y exp` : ''}
          </AppText>

          {/* Location */}
          <AppText variant="micro" color={theme.colors.mutedText}>
            📍 {worker.district}, {worker.state}
          </AppText>

        </View>

        {/* Availability badge */}
        <Badge
          label={worker.available ? 'Available' : 'Busy'}
          variant={worker.available ? 'success' : 'neutral'}
          dot
        />
      </View>

      {!compact && (
        <>
          {/* Skills row */}
          {skills.length > 0 && (
            <View style={styles.skillsRow}>
              {skills.map((skill) => (
                <View
                  key={skill}
                  style={[
                    styles.skillChip,
                    { backgroundColor: isDark ? theme.colors.surface1 : theme.colors.primaryLight, borderColor: theme.colors.borderStrong },
                  ]}
                >
                  <AppText variant="micro" color={theme.colors.primary} style={styles.skillText}>
                    {skill}
                  </AppText>
                </View>
              ))}
              {extraSkills > 0 && (
                <View style={[styles.skillChip, { backgroundColor: isDark ? theme.colors.surface2 : theme.colors.surface1, borderColor: theme.colors.border }]}>
                  <AppText variant="micro" color={theme.colors.mutedText}>+{extraSkills}</AppText>
                </View>
              )}
            </View>
          )}

          {/* Footer: salary + action */}
          <View style={[styles.footer, { borderTopColor: theme.colors.divider }]}>
            {salaryText ? (
              <View style={styles.salaryWrap}>
                <AppText variant="micro" color={theme.colors.mutedText}>Expected</AppText>
                <AppText variant="label" color={theme.colors.success} style={styles.salary}>{salaryText}</AppText>
              </View>
            ) : (
              <View />
            )}
            {actionSlot}
          </View>
        </>
      )}
    </AppCard>
  );
};

// ── Horizontal compact card (for dashboard scroll) ────────────────────────────
interface WorkerCardMiniProps {
  worker: WorkerProfile;
  onPress?: () => void;
}

export const WorkerCardMini = ({ worker, onPress }: WorkerCardMiniProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={[
        miniStyles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.mode === 'dark' ? theme.colors.border : '#E2E8F4',
          shadowColor: '#8896B0',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 2,
        },
      ]}
    >
      <Avatar name={worker.fullName} uri={worker.profileImage} size={48} online={worker.available} />
      <AppText variant="labelSm" color={theme.colors.text} numberOfLines={1} style={miniStyles.name}>
        {worker.fullName}
      </AppText>
      <AppText variant="micro" color={theme.colors.mutedText} numberOfLines={1}>
        {worker.category}
      </AppText>
      {worker.dailyRate ? (
        <AppText variant="micro" color={theme.colors.success} style={miniStyles.rate}>
          ₹{worker.dailyRate}/day
        </AppText>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { marginBottom: 10 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 15, lineHeight: 20, flexShrink: 1, textTransform: 'capitalize' },
  verifiedChip: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  verifiedText: { fontSize: 10, fontWeight: '700' },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  skillChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  skillText: { fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  salaryWrap: { gap: 1 },
  salary: { fontSize: 14 },
});

const miniStyles = StyleSheet.create({
  card: {
    width: 148,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 5,
    alignItems: 'center',
    marginRight: 10,
  },
  name: { textAlign: 'center', textTransform: 'capitalize' },
  rate: { color: '#059669', fontWeight: '700' },
});
