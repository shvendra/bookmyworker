import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../core/theme';
import { AppButton } from '../ui/AppButton';
import { AppText } from '../ui/AppText';

interface ErrorStateProps {
  title?: string;
  message?: string;
  description?: string;
  onRetry?: () => void;
}

export const ErrorState = ({
  title = 'Something went wrong',
  message,
  description,
  onRetry,
}: ErrorStateProps): React.JSX.Element => {
  const body = description ?? message ?? 'An unexpected error occurred. Please try again.';
  const { theme } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Error icon circle */}
      <View style={[styles.iconCircle, { backgroundColor: theme.colors.dangerLight }]}>
        <AppText style={styles.icon}>⚠️</AppText>
      </View>

      <AppText variant="subtitle" color={theme.colors.text} center style={styles.title}>
        {title}
      </AppText>

      <AppText variant="body" color={theme.colors.mutedText} center style={styles.message}>
        {body}
      </AppText>

      {onRetry ? (
        <AppButton
          title="Try again"
          onPress={onRetry}
          variant="secondary"
          icon="↺"
          style={styles.btn}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 14,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  icon: { fontSize: 36, lineHeight: 42 },
  title: { fontSize: 18 },
  message: { maxWidth: 290, lineHeight: 22 },
  btn: { marginTop: 4 },
});
