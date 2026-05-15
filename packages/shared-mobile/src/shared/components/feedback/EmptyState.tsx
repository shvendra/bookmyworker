import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../core/theme';
import { AppText } from '../ui/AppText';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  message?: string;
  description?: string;
  icon?: string;
  action?: React.ReactNode;
  /** Show smaller compact version inside a list */
  compact?: boolean;
}

export const EmptyState = ({
  title,
  subtitle,
  message,
  description,
  icon,
  action,
  compact = false,
}: EmptyStateProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const body = description ?? message ?? subtitle;

  return (
    <View style={[styles.wrapper, compact && styles.wrapperCompact]}>
      {/* Icon area */}
      <View style={[styles.iconCircle, { backgroundColor: theme.colors.primaryLight }]}>
        <AppText style={styles.icon}>{icon ?? '📭'}</AppText>
      </View>

      <AppText variant="subtitle" color={theme.colors.text} center style={styles.title}>
        {title}
      </AppText>

      {body ? (
        <AppText variant="body" color={theme.colors.mutedText} center style={styles.body}>
          {body}
        </AppText>
      ) : null}

      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    gap: 12,
  },
  wrapperCompact: {
    padding: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  icon: {
    fontSize: 36,
    lineHeight: 42,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
  },
  body: {
    lineHeight: 22,
    maxWidth: 280,
  },
  action: { marginTop: 8 },
});
