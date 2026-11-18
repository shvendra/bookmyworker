import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../core/theme';
import { logError } from '../../../core/errors/globalErrorHandler';
import { AppText } from '../ui/AppText';

/**
 * Error containment. A render error inside a boundary is caught HERE and never reaches the root boundary, so one broken
 * widget / screen can't take the whole app down.
 *
 *  • <SafeBoundary>   — around an optional section (banner, carousel, popup…). On error it quietly disappears
 *                       (`fallback="hide"`) or shows a small "Couldn't load · Retry" strip (`fallback="inline"`).
 *  • <ScreenBoundary> — around a whole screen (wired into every navigator via `screenLayout`). On error the navigation,
 *                       tab bar and every other screen keep working; only this screen shows a friendly retry / go-back.
 *
 * The raw technical message is logged (logError), never shown to the user.
 */

const report = (scope: string) => (error: unknown, info: { componentStack?: string | null }): void => {
  logError(`boundary:${scope}`, error, { componentStack: info?.componentStack ?? undefined });
};

const InlineFallback = ({ resetErrorBoundary }: FallbackProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  return (
    <View style={[s.inline, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <AppText variant="caption" color={theme.colors.mutedText} style={s.inlineTxt}>
        {t('sectionLoadFailed', { defaultValue: "This section couldn't load." })}
      </AppText>
      <TouchableOpacity onPress={resetErrorBoundary} accessibilityRole="button" hitSlop={8}>
        <AppText variant="caption" color={theme.colors.primary} weight="800">{t('retry', { defaultValue: 'Try again' })}</AppText>
      </TouchableOpacity>
    </View>
  );
};

interface SafeBoundaryProps {
  children: React.ReactNode;
  /** Name used in the error log, e.g. "dashboard.upgradeBanner". */
  scope: string;
  fallback?: 'hide' | 'inline';
  /** When any of these change the boundary resets and tries to render again. */
  resetKeys?: unknown[];
}

export const SafeBoundary = ({ children, scope, fallback = 'hide', resetKeys }: SafeBoundaryProps): React.JSX.Element => (
  <ErrorBoundary
    onError={report(scope)}
    resetKeys={resetKeys}
    {...(fallback === 'inline' ? { FallbackComponent: InlineFallback } : { fallback: null })}
  >
    {children}
  </ErrorBoundary>
);

// ─── Whole-screen boundary ────────────────────────────────────────────────────
interface ScreenBoundaryProps {
  children: React.ReactNode;
  scope: string;
  onGoBack?: () => void;
}

const ScreenFallback = ({ resetErrorBoundary, onGoBack }: FallbackProps & { onGoBack?: () => void }): React.JSX.Element => {
  const { theme } = useAppTheme();
  const { t } = useTranslation('employer');
  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]} testID="screen-error-fallback">
      <View style={[s.iconCircle, { backgroundColor: theme.colors.dangerLight }]}>
        <AppText style={s.icon}>⚠️</AppText>
      </View>
      <AppText variant="subtitle" center>{t('screenLoadFailedTitle', { defaultValue: "This screen couldn't load" })}</AppText>
      <AppText variant="body" color={theme.colors.mutedText} center style={s.msg}>
        {t('screenLoadFailedBody', { defaultValue: 'Something unexpected happened here. The rest of the app is working fine.' })}
      </AppText>
      <TouchableOpacity onPress={resetErrorBoundary} style={[s.btn, { backgroundColor: theme.colors.primary }]} accessibilityRole="button">
        <AppText weight="800" color="#fff">{t('retry', { defaultValue: 'Try again' })}</AppText>
      </TouchableOpacity>
      {onGoBack ? (
        <TouchableOpacity onPress={onGoBack} style={s.link} accessibilityRole="button" hitSlop={8}>
          <AppText weight="700" color={theme.colors.primary}>{t('back', { defaultValue: 'Go back' })}</AppText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export const ScreenBoundary = ({ children, scope, onGoBack }: ScreenBoundaryProps): React.JSX.Element => (
  <ErrorBoundary
    onError={report(scope)}
    fallbackRender={(p) => <ScreenFallback {...p} onGoBack={onGoBack} />}
  >
    {children}
  </ErrorBoundary>
);

const s = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 12, marginBottom: 12, borderRadius: 12, borderWidth: 1 },
  inlineTxt: { flex: 1 },
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  iconCircle: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  icon: { fontSize: 38, lineHeight: 48 },
  msg: { marginBottom: 6 },
  btn: { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14, marginTop: 4 },
  link: { paddingVertical: 8 },
});

/**
 * Pass as `screenLayout` on a navigator (React Navigation 7) so EVERY screen in it is wrapped in a <ScreenBoundary>:
 *   <Stack.Navigator screenLayout={boundedScreenLayout}>
 */
export const boundedScreenLayout = ({ route, navigation, children }: {
  route: { name: string };
  navigation: { canGoBack: () => boolean; goBack: () => void };
  children: React.ReactElement;
}): React.JSX.Element => (
  <ScreenBoundary scope={`screen.${route.name}`} onGoBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}>
    {children}
  </ScreenBoundary>
);
