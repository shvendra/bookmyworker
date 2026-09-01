import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../core/theme';
import { AppText } from './AppText';
import { AppButton } from './AppButton';

interface AppEmptyStateProps {
  /** Ionicons name — e.g. "search-outline", "cloud-offline-outline", "people-outline". */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message?: string;
  /** Optional primary action (e.g. "Retry", "Clear filters"). */
  actionLabel?: string;
  onAction?: () => void;
  /** "error" tints the icon red; default is neutral. */
  tone?: 'neutral' | 'error';
  style?: StyleProp<ViewStyle>;
}

/**
 * One shared empty / error state for lists and results — centered icon, title,
 * message and an optional action button. Replaces per-screen bespoke "no
 * results" / "something went wrong" blocks.
 */
export const AppEmptyState = ({
  icon = 'file-tray-outline',
  title,
  message,
  actionLabel,
  onAction,
  tone = 'neutral',
  style,
}: AppEmptyStateProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const C = theme.colors;
  const iconColor = tone === 'error' ? C.danger : C.mutedText;
  const iconBg = tone === 'error' ? C.dangerLight : C.surface1;

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={30} color={iconColor} />
      </View>
      <AppText variant="subtitle" color={C.text} style={styles.title}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" color={C.mutedText} style={styles.message}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <AppButton
          title={actionLabel}
          onPress={onAction}
          variant={tone === 'error' ? 'primary' : 'outline'}
          size="md"
          style={styles.btn}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 44, paddingHorizontal: 32, gap: 6 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  title: { textAlign: 'center', fontWeight: '800' },
  message: { textAlign: 'center', lineHeight: 21, maxWidth: 300 },
  btn: { marginTop: 12, alignSelf: 'center', minWidth: 160 },
});
