import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../core/theme';
import { AppButton } from '../ui/AppButton';
import { AppText } from '../ui/AppText';

interface FullScreenNoticeProps {
  emoji: string;
  title: string;
  message: string;
  eta?: string;
  hint?: string;
  retrying?: boolean;
  onRetry?: () => void;
  accent?: 'primary' | 'warning';
}

/**
 * Shared full-screen notice used for the "No internet" overlay and the
 * "Under maintenance" screen. Theme-aware and self-contained so it can render
 * above the whole app regardless of where in the tree it mounts.
 */
export const FullScreenNotice = ({
  emoji,
  title,
  message,
  eta,
  hint,
  retrying,
  onRetry,
  accent = 'primary',
}: FullScreenNoticeProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const accentColor = accent === 'warning' ? theme.colors.warning : theme.colors.primary;

  let etaText = '';
  if (eta) {
    const d = new Date(eta);
    if (!isNaN(d.getTime())) {
      etaText = d.toLocaleString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={styles.container}>
        <View style={[styles.iconCircle, { backgroundColor: `${accentColor}22` }]}>
          <AppText style={styles.icon}>{emoji}</AppText>
        </View>

        <AppText variant="subtitle" color={theme.colors.text} center style={styles.title}>
          {title}
        </AppText>

        <AppText variant="body" color={theme.colors.mutedText} center style={styles.message}>
          {message}
        </AppText>

        {etaText ? (
          <View style={[styles.etaPill, { backgroundColor: `${accentColor}18` }]}>
            <AppText variant="body" color={theme.colors.text} center>
              Expected back: {etaText}
            </AppText>
          </View>
        ) : null}

        {onRetry ? (
          <AppButton
            title={retrying ? 'Checking…' : 'Try again'}
            onPress={onRetry}
            variant="primary"
            icon="↻"
            disabled={retrying}
            style={styles.btn}
          />
        ) : null}

        {hint ? (
          <AppText variant="caption" color={theme.colors.mutedText} center style={styles.hint}>
            {hint}
          </AppText>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 9999, elevation: 9999 },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  iconCircle: { width: 84, height: 84, borderRadius: 42, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  icon: { fontSize: 38 },
  title: { marginTop: 4 },
  message: { marginTop: 2, maxWidth: 320, lineHeight: 22 },
  etaPill: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, maxWidth: 320 },
  btn: { marginTop: 22, minWidth: 180 },
  hint: { marginTop: 14, maxWidth: 300 },
});
