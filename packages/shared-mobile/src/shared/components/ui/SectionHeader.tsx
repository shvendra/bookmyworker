import React from 'react';
import { StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../../core/theme';
import { AppText } from './AppText';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  subtitle?: string;
  icon?: string;
  style?: StyleProp<ViewStyle>;
  /** Show a colored left accent line */
  accent?: boolean;
}

export const SectionHeader = ({
  title,
  actionLabel,
  onAction,
  subtitle,
  icon,
  style,
  accent = false,
}: SectionHeaderProps): React.JSX.Element => {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.row, style]}>
      <View style={styles.left}>
        {accent && <View style={[styles.accentBar, { backgroundColor: theme.colors.primary }]} />}
        {icon ? <AppText style={styles.icon}>{icon}</AppText> : null}
        <View style={styles.texts}>
          <AppText variant="subtitle" color={theme.colors.text} style={styles.title}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.subtitle}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.actionBtn}
        >
          <AppText variant="labelSm" color={theme.colors.primary} style={styles.action}>
            {actionLabel} →
          </AppText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  accentBar: {
    width: 3,
    height: 18,
    borderRadius: 2,
  },
  texts: { gap: 1 },
  icon: { fontSize: 20, lineHeight: 24 },
  title: { fontSize: 17, lineHeight: 22 },
  subtitle: { lineHeight: 16, marginTop: 1 },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  action: {
    letterSpacing: 0.1,
    color: undefined, // set via prop
  },
});
