import React from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../core/theme';
import { AppText } from './AppText';

interface AppSheetProps extends React.PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  /** Optional header title (with a close affordance via tap-scrim / drag grip). */
  title?: string;
  subtitle?: string;
  /** Wrap children in a ScrollView (default true). Set false for fixed layouts. */
  scroll?: boolean;
  /** Fraction of screen height the sheet may grow to (default 0.85). */
  maxHeightRatio?: number;
  contentStyle?: StyleProp<ViewStyle>;
  /** Hide the grey drag grip at the top. */
  hideGrip?: boolean;
}

/**
 * Standard bottom sheet — slide-up modal with a dimmed, tap-to-close scrim, a
 * rounded top, a drag grip, safe-area-aware bottom padding, and an optional
 * title row. Replaces the copy-pasted `Modal + scrim + slide + grip` block that
 * every screen re-implements. Behaviour-only; nothing app-specific.
 */
export const AppSheet = ({
  visible,
  onClose,
  title,
  subtitle,
  scroll = true,
  maxHeightRatio = 0.85,
  contentStyle,
  hideGrip = false,
  children,
}: AppSheetProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const C = theme.colors;

  const body = (
    <View style={[styles.body, { paddingBottom: insets.bottom + 18 }, contentStyle]}>{children}</View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity activeOpacity={1} style={styles.scrim} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {}}
          style={[
            styles.sheet,
            {
              backgroundColor: C.card,
              maxHeight: `${Math.round(maxHeightRatio * 100)}%`,
              borderColor: theme.mode === 'dark' ? C.border : 'transparent',
              borderWidth: theme.mode === 'dark' ? StyleSheet.hairlineWidth : 0,
            },
          ]}
        >
          {!hideGrip && <View style={[styles.grip, { backgroundColor: C.border }]} />}

          {(title || subtitle) && (
            <View style={styles.header}>
              {title ? (
                <AppText variant="subtitle" color={C.text} style={styles.title} numberOfLines={2}>
                  {title}
                </AppText>
              ) : null}
              {subtitle ? (
                <AppText variant="caption" color={C.mutedText} style={styles.subtitle}>
                  {subtitle}
                </AppText>
              ) : null}
            </View>
          )}

          {scroll ? (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {body}
            </ScrollView>
          ) : (
            body
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
  },
  grip: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  header: { paddingHorizontal: 20, marginBottom: 8 },
  title: { fontWeight: '800' },
  subtitle: { marginTop: 2 },
  body: { paddingHorizontal: 20, paddingTop: 4 },
});
