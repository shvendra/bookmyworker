// Lightweight stand-ins for the shared UI primitives. Mapped from AppButton,
// AppText, AppInput, ErrorState and LoadingState — each importer pulls the name
// it needs from this single module.
import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

export const AppButton = ({
  title,
  onPress,
  disabled,
  loading,
}: {
  title?: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
}): React.JSX.Element => (
  // NOTE: the press is intentionally NOT blocked when `disabled`/`loading`.
  // Testing-Library skips presses on accessibility-disabled nodes, which would
  // hide the screens' own re-entrancy/validation guards. The screens guard
  // themselves, so we let onPress fire and assert the guarded behaviour. The
  // disabled flag is surfaced via `accessibilityValue` purely for assertions.
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityValue={{ text: disabled ? 'disabled' : 'enabled' }}
    onPress={onPress}
  >
    <Text>{title}</Text>
    {loading ? <Text>loading…</Text> : null}
  </TouchableOpacity>
);

export const AppText = ({
  children,
  onPress,
}: {
  children?: React.ReactNode;
  onPress?: () => void;
}): React.JSX.Element => <Text onPress={onPress}>{children}</Text>;

export const AppInput = ({
  value,
  onChangeText,
  onBlur,
  placeholder,
  errorText,
}: {
  value?: string;
  onChangeText?: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  errorText?: string;
}): React.JSX.Element => (
  <View>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onBlur={onBlur}
      placeholder={placeholder}
    />
    {errorText ? <Text>{errorText}</Text> : null}
  </View>
);

export const ErrorState = ({
  title,
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}): React.JSX.Element => (
  <View>
    <Text>{title}</Text>
    <Text>{message}</Text>
    <Text onPress={onRetry}>retry</Text>
  </View>
);

export const LoadingState = ({
  message,
}: {
  message?: string;
}): React.JSX.Element => <Text>{message}</Text>;

// Trademark renders the ™ glyph; inert stub so screens that import it (e.g.
// EmployerRegisterScreen) load without resolving the real shared-mobile file.
export const Trademark = (): React.JSX.Element | null => null;
