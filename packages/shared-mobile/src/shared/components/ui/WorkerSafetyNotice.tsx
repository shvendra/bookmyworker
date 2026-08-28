import React, { useState } from 'react';
import { View, StyleSheet, Pressable, StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';

interface WorkerSafetyNoticeProps {
  /** Optional style override merged onto the outer box — lets a screen that
   * already has its own top spacing (e.g. a FlatList's contentContainerStyle
   * paddingTop) collapse this component's default marginTop instead of
   * stacking both. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Scam-prevention reminder shown wherever an employer can view/unlock a
 * worker's phone number — the highest-risk moment for the classic "worker"
 * scam: someone asks for advance travel/rent money before ever showing up,
 * then goes silent. BookMyWorker never touches employer-worker payments, so
 * this is awareness-only, not a policy we can enforce.
 *
 * Dismissible per screen-mount only (not persisted) — it reappears on the
 * next visit/navigation by design, since a one-time popup gets forgotten
 * right when it matters most, but a visible close button lets someone
 * clear it off-screen once they've read it this time.
 */
export const WorkerSafetyNotice: React.FC<WorkerSafetyNoticeProps> = ({ style }) => {
  const { t } = useTranslation('employer');
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <View style={[styles.box, style]}>
      <AppText style={styles.icon}>⚠️</AppText>
      <AppText variant="caption" color="#92400E" style={styles.text}>
        {t('wp_safetyNotice')}
      </AppText>
      <Pressable
        onPress={() => setDismissed(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('wp_safetyNoticeDismiss')}
        style={styles.closeBtn}
      >
        <AppText style={styles.closeIcon}>✕</AppText>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  icon: {
    fontSize: 16,
    marginTop: 1,
  },
  text: {
    flex: 1,
    lineHeight: 17,
  },
  closeBtn: {
    marginTop: 1,
    marginLeft: 2,
  },
  closeIcon: {
    fontSize: 15,
    color: '#92400E',
    fontWeight: '700',
  },
});
