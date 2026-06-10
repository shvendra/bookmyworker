// Lightweight stand-ins for the shared UI primitives. A single module backs the
// AppButton / AppText / AppInput / ErrorState / LoadingState mappings (plus the
// unused-but-imported ScreenHeader / Badge), so each importer pulls the name it
// needs from here.
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
  [key: string]: unknown;
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
  [key: string]: unknown;
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
  [key: string]: unknown;
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
  [key: string]: unknown;
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
  [key: string]: unknown;
}): React.JSX.Element => <Text>{message}</Text>;

// Imported-but-unused in the agent screens — inert stand-ins keep the imports
// resolvable.
export const ScreenHeader = (): React.JSX.Element | null => null;
export const Badge = (): React.JSX.Element | null => null;
