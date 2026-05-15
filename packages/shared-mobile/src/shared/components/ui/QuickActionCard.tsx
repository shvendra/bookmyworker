/**
 * QuickActionCard — Tappable action button used in dashboard "Quick Actions" sections.
 * Displays an icon bubble, title, and optional subtitle in a compact card format.
 */
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../../core/theme';
import { AppText } from './AppText';

interface QuickActionCardProps {
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  color?: string;
  badge?: string | number;
  /** Fill the icon background with the color (darker style) */
  filled?: boolean;
}

export const QuickActionCard = ({
  icon,
  title,
  subtitle,
  onPress,
  color,
  badge,
  filled = false,
}: QuickActionCardProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const accentColor = color ?? theme.colors.primary;
  const isDark = theme.mode === 'dark';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: isDark ? theme.colors.border : '#EBF0F8',
        },
        theme.shadow.sm,
      ]}
    >
      {/* Icon bubble */}
      <View
        style={[
          styles.iconBubble,
          {
            backgroundColor: filled ? accentColor : accentColor + '18',
          },
        ]}
      >
        <AppText style={[styles.icon, filled && styles.iconFilled]}>{icon}</AppText>
        {badge != null && (
          <View style={[styles.badge, { backgroundColor: theme.colors.danger }]}>
            <AppText variant="micro" color="#FFF" style={styles.badgeText}>
              {typeof badge === 'number' && badge > 99 ? '99+' : String(badge)}
            </AppText>
          </View>
        )}
      </View>

      {/* Text */}
      <AppText
        variant="labelSm"
        color={theme.colors.text}
        style={styles.title}
        numberOfLines={2}
      >
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="micro" color={theme.colors.mutedText} numberOfLines={1} style={styles.subtitle}>
          {subtitle}
        </AppText>
      ) : null}
    </TouchableOpacity>
  );
};

// Horizontal list layout wrapper
export const QuickActionsRow = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label?: string;
}): React.JSX.Element => {
  const { theme } = useAppTheme();
  return (
    <View style={styles.section}>
      {label ? (
        <AppText variant="label" color={theme.colors.mutedText} style={styles.sectionLabel}>
          {label}
        </AppText>
      ) : null}
      <View style={styles.row}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
    minWidth: 70,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
    lineHeight: 28,
  },
  iconFilled: {
    // icon text stays the same; filled background provides contrast
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  title: {
    textAlign: 'center',
    lineHeight: 17,
  },
  subtitle: {
    textAlign: 'center',
  },
  section: {
    marginBottom: 4,
  },
  sectionLabel: {
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 11,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
});
