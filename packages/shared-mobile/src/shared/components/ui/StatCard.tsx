import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../../core/theme';
import { AppText } from './AppText';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
  subLabel?: string;
  trend?: '+' | '-' | '=';
  trendValue?: string;
  onPress?: () => void;
  /** Width proportion — full | half (default) */
  size?: 'full' | 'half';
}

export const StatCard = ({
  label,
  value,
  icon,
  color,
  subLabel,
  trend,
  trendValue,
  onPress,
  size = 'half',
}: StatCardProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const accentColor = color ?? theme.colors.primary;
  const isDark = theme.mode === 'dark';

  const trendColor = trend === '+' ? theme.colors.success : trend === '-' ? theme.colors.danger : theme.colors.mutedText;

  const inner = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: isDark ? theme.colors.border : '#EBF0F8',
          borderWidth: 1,
          flex: size === 'half' ? 1 : undefined,
        },
        theme.shadow.sm,
      ]}
    >
      {/* Top row: icon bubble + trend */}
      <View style={styles.topRow}>
        <View style={[styles.iconBubble, { backgroundColor: accentColor + '18' }]}>
          {icon ? (
            <AppText style={[styles.icon, { fontSize: 20 }]}>{icon}</AppText>
          ) : (
            <View style={[styles.iconDot, { backgroundColor: accentColor }]} />
          )}
        </View>
        {trend && trendValue && (
          <View style={[styles.trendBadge, { backgroundColor: trendColor + '18' }]}>
            <AppText variant="micro" color={trendColor} style={styles.trendText}>
              {trend === '+' ? '↑' : trend === '-' ? '↓' : '—'} {trendValue}
            </AppText>
          </View>
        )}
      </View>

      {/* Value */}
      <AppText
        variant="numeric"
        color={theme.colors.text}
        style={[styles.value, { color: theme.colors.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {String(value)}
      </AppText>

      {/* Label */}
      <AppText variant="caption" color={theme.colors.mutedText} style={styles.label} numberOfLines={2}>
        {label}
      </AppText>

      {/* Sub-label badge */}
      {subLabel ? (
        <View style={[styles.subBadge, { backgroundColor: accentColor + '15' }]}>
          <AppText variant="micro" color={accentColor} style={styles.subBadgeText}>
            {subLabel}
          </AppText>
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return inner;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={size === 'half' ? styles.touchHalf : undefined}>
      {inner}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { lineHeight: 24 },
  iconDot: { width: 10, height: 10, borderRadius: 5 },
  trendBadge: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  trendText: { fontWeight: '700' },
  value: {
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: -0.5,
  },
  label: {
    lineHeight: 16,
    marginTop: 1,
  },
  subBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  subBadgeText: { fontWeight: '700' },
  touchHalf: { flex: 1 },
});
