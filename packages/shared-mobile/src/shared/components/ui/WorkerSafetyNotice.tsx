import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';

/**
 * Scam-prevention reminder shown wherever an employer can view/unlock a
 * worker's phone number — the highest-risk moment for the classic "worker"
 * scam: someone asks for advance travel/rent money before ever showing up,
 * then goes silent. BookMyWorker never touches employer-worker payments, so
 * this is awareness-only, not a policy we can enforce.
 *
 * Always rendered (no dismiss) — a one-time popup gets forgotten right when
 * it matters most, so this stays visible every time the phone card shows.
 */
export const WorkerSafetyNotice: React.FC = () => {
  const { t } = useTranslation('employer');

  return (
    <View style={styles.box}>
      <AppText style={styles.icon}>⚠️</AppText>
      <AppText variant="caption" color="#92400E" style={styles.text}>
        {t('wp_safetyNotice')}
      </AppText>
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
});
