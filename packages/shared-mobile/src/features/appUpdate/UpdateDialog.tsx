import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../core/theme';
import { AppText } from '../../shared/components/ui/AppText';
import { AppButton } from '../../shared/components/ui/AppButton';

interface UpdateDialogProps {
  visible: boolean;
  latestVersion?: string;
  message?: string;
  onUpdate: () => void;
  onLater: () => void;
}

/** "A new version is available" dialog with Update / Later. Optional updates only — a mandatory one uses the blocking screen. */
export const UpdateDialog = ({ visible, latestVersion, message, onUpdate, onLater }: UpdateDialogProps): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onLater}>
      <Pressable style={styles.backdrop} onPress={onLater} testID="update-dialog-backdrop">
        {/* inner Pressable swallows taps so touching the card does not close it */}
        <Pressable style={[styles.card, { backgroundColor: theme.colors.card ?? '#FFFFFF' }]} onPress={() => {}}>
          <View style={[styles.iconCircle, { backgroundColor: `${theme.colors.primary}1F` }]}>
            <AppText style={styles.icon}>🚀</AppText>
          </View>
          <AppText variant="subtitle" color={theme.colors.text} center style={styles.title}>
            Update available{latestVersion ? ` · v${latestVersion}` : ''}
          </AppText>
          <AppText variant="body" color={theme.colors.mutedText} center style={styles.msg}>
            {message?.trim() || 'A new version of BookMyWorker is ready with the latest fixes and improvements.'}
          </AppText>
          <AppButton title="Update now" onPress={onUpdate} fullWidth />
          <Pressable onPress={onLater} style={styles.later} hitSlop={10} testID="update-dialog-later">
            <AppText variant="label" color={theme.colors.mutedText}>Later</AppText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, borderRadius: 24, padding: 22, alignItems: 'stretch' },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
  icon: { fontSize: 30 },
  title: { fontWeight: '800', marginBottom: 6 },
  msg: { marginBottom: 18 },
  later: { alignItems: 'center', paddingVertical: 14 },
});
