import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../core/theme';
import { AppText } from '../../shared/components/ui/AppText';

interface UpdateBannerProps {
  /** version the store has, for the "vX available" copy (optional) */
  latestVersion?: string;
  updateUrl: string;
}

/**
 * Slim, dismissible "A new version is available" strip shown at the very top of
 * the app when the installed version is behind `latestVersion` but not below the
 * hard `minVersion`. Dismissal is per app-session (re-appears next cold start).
 */
export const UpdateBanner = ({ latestVersion, updateUrl }: UpdateBannerProps): React.JSX.Element | null => {
  const { theme } = useAppTheme();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.primary }]}>
      <View style={styles.textCol}>
        <AppText variant="labelSm" color="#FFFFFF" style={styles.title}>
          Update available{latestVersion ? ` · v${latestVersion}` : ''}
        </AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.85)">
          Get the latest fixes and improvements.
        </AppText>
      </View>
      <Pressable
        onPress={() => { void Linking.openURL(updateUrl); }}
        style={styles.cta}
        hitSlop={8}
      >
        <AppText variant="labelSm" color={theme.colors.primary} style={styles.ctaTxt}>Update</AppText>
      </Pressable>
      <Pressable onPress={() => setDismissed(true)} style={styles.close} hitSlop={12}>
        <AppText variant="labelSm" color="rgba(255,255,255,0.9)">✕</AppText>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 8,
    gap: 10,
  },
  textCol: { flex: 1, gap: 1 },
  title: { fontWeight: '800' },
  cta: { backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  ctaTxt: { fontWeight: '800' },
  close: { padding: 6 },
});
