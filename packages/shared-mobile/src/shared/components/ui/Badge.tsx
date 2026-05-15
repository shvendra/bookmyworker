import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../core/theme';
import { AppText } from './AppText';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'primary'
  | 'secondary'
  | 'neutral'
  | 'accent'
  | 'info';

type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  dot?: boolean;
  size?: BadgeSize;
  /** Filled (default) or outlined style */
  outlined?: boolean;
}

export const Badge = ({ label, variant = 'neutral', dot = false, size = 'md', outlined = false }: BadgeProps): React.JSX.Element => {
  const { theme } = useAppTheme();

  type ColorPair = { bg: string; text: string; border: string };

  const colorMap: Record<BadgeVariant, ColorPair> = {
    success: {
      bg: outlined ? 'transparent' : theme.colors.successLight,
      text: theme.colors.success,
      border: theme.colors.success + '50',
    },
    warning: {
      bg: outlined ? 'transparent' : theme.colors.warningLight,
      text: theme.colors.warning,
      border: theme.colors.warning + '50',
    },
    danger: {
      bg: outlined ? 'transparent' : theme.colors.dangerLight,
      text: theme.colors.danger,
      border: theme.colors.danger + '50',
    },
    primary: {
      bg: outlined ? 'transparent' : theme.colors.primaryLight,
      text: theme.colors.primary,
      border: theme.colors.primary + '40',
    },
    secondary: {
      bg: outlined ? 'transparent' : theme.colors.secondaryLight,
      text: theme.colors.secondary,
      border: theme.colors.secondary + '40',
    },
    neutral: {
      bg: outlined ? 'transparent' : theme.colors.divider,
      text: theme.colors.mutedText,
      border: theme.colors.border,
    },
    accent: {
      bg: outlined ? 'transparent' : theme.colors.accentLight,
      text: theme.colors.accent,
      border: theme.colors.accent + '50',
    },
    info: {
      bg: outlined ? 'transparent' : theme.colors.infoLight,
      text: theme.colors.info,
      border: theme.colors.info + '50',
    },
  };

  const { bg, text, border } = colorMap[variant];
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderColor: outlined ? border : 'transparent',
          borderWidth: outlined ? 1 : 0,
          paddingHorizontal: isSm ? 7 : 10,
          paddingVertical: isSm ? 2 : 4,
        },
      ]}
    >
      {dot && (
        <View style={[styles.dot, { backgroundColor: text, width: isSm ? 5 : 6, height: isSm ? 5 : 6 }]} />
      )}
      <AppText
        variant={isSm ? 'micro' : 'caption'}
        color={text}
        style={[styles.text, isSm && styles.smText]}
      >
        {label}
      </AppText>
    </View>
  );
};

export const statusToBadgeVariant = (status: string): BadgeVariant => {
  const s = (status ?? '').toLowerCase();
  if (['open', 'active', 'verified', 'accepted', 'success', 'present', 'assigned', 'ongoing'].includes(s)) return 'success';
  if (['pending', 'invited', 'half-day', 'interested'].includes(s)) return 'warning';
  if (['closed', 'rejected', 'failed', 'absent', 'expired'].includes(s)) return 'danger';
  if (['fulfilled', 'completed'].includes(s)) return 'primary';
  if (['agent', 'worker'].includes(s)) return 'info';
  return 'neutral';
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    borderRadius: 999,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  smText: {
    fontWeight: '700',
  },
});
