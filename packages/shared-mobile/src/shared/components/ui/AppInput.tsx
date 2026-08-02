import React, { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../core/theme';
import { AppText } from './AppText';

interface AppInputProps extends TextInputProps {
  label?: string;
  helperText?: string;
  errorText?: string;
  leadingIcon?: string;
  trailingIcon?: string;
  onTrailingPress?: () => void;
  maxLength?: number;
  showCount?: boolean;
}

export const AppInput = ({
  label,
  helperText,
  errorText,
  style,
  leadingIcon,
  trailingIcon,
  onTrailingPress,
  maxLength,
  showCount,
  value,
  onChangeText,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
  secureTextEntry,
  ...rest
}: AppInputProps): React.JSX.Element => {
  const { theme } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<TextInput | null>(null);

  const isPasswordField = secureTextEntry === true;

  const hasError = Boolean(errorText);
  const isDark = theme.mode === 'dark';

  const borderColor = hasError
    ? theme.colors.danger
    : focused
    ? theme.colors.primary
    : theme.colors.border;

  const bgColor = hasError
    ? (isDark ? theme.colors.dangerLight + '18' : theme.colors.dangerLight)
    : focused
    ? (isDark ? theme.colors.surface1 : '#F5F8FF')
    : (isDark ? theme.colors.surface1 : theme.colors.surface2);

  const charCount = typeof value === 'string' ? value.length : 0;

  return (
    <View style={styles.wrapper}>
      {/* Label row */}
      {(label || (showCount && maxLength)) && (
        <View style={styles.labelRow}>
          {label ? (
            <AppText
              variant="labelSm"
              numberOfLines={1}
              color={
                hasError
                  ? theme.colors.danger
                  : focused
                  ? theme.colors.primary
                  : theme.colors.textSecondary
              }
              style={styles.label}
            >
              {label}
            </AppText>
          ) : (
            <View />
          )}
          {showCount && maxLength ? (
            <AppText
              variant="micro"
              color={charCount >= maxLength ? theme.colors.danger : theme.colors.mutedText}
            >
              {charCount}/{maxLength}
            </AppText>
          ) : null}
        </View>
      )}

      {/* Input row — View container; only the prefix icon uses Pressable to focus the input */}
      <View
        style={[
          styles.inputRow,
          {
            borderColor,
            backgroundColor: bgColor,
            borderWidth: focused || hasError ? 1.5 : 1,
          },
        ]}
      >
        {leadingIcon ? (
          <Pressable onPress={() => inputRef.current?.focus()} style={styles.leadingIconBtn}>
            <AppText
              style={[
                styles.leadingIcon,
                { color: focused ? theme.colors.primary : theme.colors.mutedText },
              ]}
            >
              {leadingIcon}
            </AppText>
          </Pressable>
        ) : null}

        <TextInput
          ref={inputRef}
          placeholderTextColor={theme.colors.mutedText}
          maxLength={maxLength}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPasswordField ? !showPassword : false}
          onFocus={(e) => {
            setFocused(true);
            onFocusProp?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlurProp?.(e);
          }}
          style={[
            styles.input,
            { color: theme.colors.text, flex: 1 },
            style,
          ]}
          {...rest}
        />

        {isPasswordField ? (
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.trailingBtn}
            activeOpacity={0.6}
          >
            <Ionicons
              name={showPassword ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={focused ? theme.colors.primary : theme.colors.mutedText}
            />
          </TouchableOpacity>
        ) : trailingIcon ? (
          <TouchableOpacity
            onPress={onTrailingPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.trailingBtn}
            disabled={!onTrailingPress}
          >
            <AppText style={[styles.trailingIcon, { color: theme.colors.mutedText }]}>
              {trailingIcon}
            </AppText>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Helper / Error */}
      {hasError || helperText ? (
        <View style={styles.metaRow}>
          {hasError ? (
            <AppText variant="caption" color={theme.colors.danger} style={styles.meta}>
              ⚠ {errorText}
            </AppText>
          ) : (
            <AppText variant="caption" color={theme.colors.mutedText} style={styles.meta}>
              {helperText}
            </AppText>
          )}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  label: { letterSpacing: 0.2, flexShrink: 1 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 54,
  },
input: {
  fontSize: 15,
  paddingVertical: 14,
  paddingHorizontal: 0,
  flex: 1,
  minWidth: 0,
},
leadingIconBtn: {
  marginRight: 10,
  justifyContent: 'center',
  alignItems: 'center',
},  leadingIcon: {
    fontSize: 17,
    lineHeight: 22,
  },
  trailingBtn: { marginLeft: 10 },
  trailingIcon: { fontSize: 18, lineHeight: 22 },
  metaRow: { marginTop: 5, paddingHorizontal: 2 },
  meta: { lineHeight: 17 },
});
