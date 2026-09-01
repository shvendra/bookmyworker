import React, { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '../../../shared/components/ui/AppButton';
import { AppText } from '../../../shared/components/ui/AppText';
import { useAppTheme } from '../../../core/theme';

export interface CrossAppTarget {
  kind?: 'worker' | 'employer';
  name: string;
  tagline?: string;
  playStoreUrl: string;
  androidPackage?: string;
}

interface Props {
  /** The role this phone is actually registered as, e.g. "Agent". */
  registeredRole?: string | null;
  /** The app the user should install/use. When absent we show `fallbackMessage`. */
  correctApp?: CrossAppTarget | null;
  /** Server message — always shown as the explanation; also the sole content
   *  when `correctApp` is missing (older backend that only returns text). */
  fallbackMessage?: string | null;
  /** Let the user go back and try another number. */
  onDismiss?: () => void;
}

/**
 * Shown after a login attempt that failed only because the account belongs to
 * the OTHER BookMyWorker app (Worker/Agent ↔ Employer). Gives the user a clear
 * message + a one-tap "Install <app>" Play Store button instead of a dead end.
 * Fully translated (default `translation` namespace, all 11 languages).
 */
export const WrongAppNotice = ({
  registeredRole,
  correctApp,
  fallbackMessage,
  onDismiss,
}: Props): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const [opening, setOpening] = useState(false);

  const roleWord = (role?: string | null): string => {
    switch (String(role || '').trim().toLowerCase()) {
      case 'employer': return t('wrongApp_roleEmployer');
      case 'agent': return t('wrongApp_roleAgent');
      case 'selfworker':
      case 'worker': return t('wrongApp_roleWorker');
      default: return t('wrongApp_roleOther');
    }
  };

  const openStore = (): void => {
    if (!correctApp || opening) return;
    setOpening(true);
    // An https Play Store link opens the Play Store app directly on Android
    // (same approach as IntentSelectScreen).
    Linking.openURL(correctApp.playStoreUrl)
      .catch(() => { /* user can still copy the link from the message */ })
      .finally(() => setOpening(false));
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.primaryLight }]}>
        <AppText style={styles.icon}>📲</AppText>
      </View>

      <AppText variant="heading" style={styles.title} color={theme.colors.text}>
        {t('wrongApp_title')}
      </AppText>

      <AppText variant="body" style={styles.body} color={theme.colors.textSecondary}>
        {t('wrongApp_body', { role: roleWord(registeredRole) })}
        {correctApp ? ` ${t('wrongApp_installHint', { app: correctApp.name })}` : ''}
      </AppText>

      {!correctApp && fallbackMessage ? (
        <AppText variant="caption" style={styles.fallback} color={theme.colors.textSecondary}>
          {fallbackMessage}
        </AppText>
      ) : null}

      {correctApp ? (
        <AppButton
          title={opening ? t('wrongApp_opening') : t('wrongApp_install', { app: correctApp.name })}
          onPress={openStore}
          loading={opening}
          size="lg"
          fullWidth
          style={styles.cta}
        />
      ) : null}

      {onDismiss ? (
        <AppButton
          title={t('wrongApp_tryAnother')}
          onPress={onDismiss}
          variant="ghost"
          size="md"
          fullWidth
          style={styles.secondary}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 28 },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', lineHeight: 21 },
  fallback: { textAlign: 'center', lineHeight: 18 },
  cta: { marginTop: 6 },
  secondary: { marginTop: -2 },
});
