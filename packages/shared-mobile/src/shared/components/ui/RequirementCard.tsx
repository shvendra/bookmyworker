import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../core/theme';
import type { JobRequirement } from '../../types/domain';
import { AppCard } from './AppCard';
import { AppText } from './AppText';
import { Badge, statusToBadgeVariant } from './Badge';

interface RequirementCardProps {
  requirement: JobRequirement;
  onPress?: () => void;
  actionSlot?: React.ReactNode;
}

export const RequirementCard = ({ requirement, onPress, actionSlot }: RequirementCardProps): React.JSX.Element => {
  const { theme } = useAppTheme();

  return (
    <AppCard onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <AppText variant="label" numberOfLines={1}>{requirement.title}</AppText>
          <AppText variant="caption" color={theme.colors.mutedText}>
            {requirement.category}{requirement.subCategory ? ` · ${requirement.subCategory}` : ''}
          </AppText>
        </View>
        <Badge label={requirement.status} variant={statusToBadgeVariant(requirement.status)} />
      </View>

      <View style={styles.meta}>
        <AppText variant="caption" color={theme.colors.mutedText}>
          📍 {requirement.district}, {requirement.state}
        </AppText>
        <AppText variant="caption" color={theme.colors.mutedText}>
          👷 {requirement.workerCount} worker{requirement.workerCount !== 1 ? 's' : ''}
        </AppText>
        {requirement.dailyRate ? (
          <AppText variant="caption" color={theme.colors.mutedText}>
            💰 ₹{requirement.dailyRate}/day
          </AppText>
        ) : null}
      </View>

      {actionSlot ? <View style={[styles.actions, { borderTopColor: theme.colors.divider }]}>{actionSlot}</View> : null}
    </AppCard>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  titleWrap: {
    flex: 1,
    gap: 2,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actions: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
