import React from 'react';
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
  type RegisterOptions,
} from 'react-hook-form';
import { type KeyboardTypeOptions, type StyleProp, type ViewStyle } from 'react-native';
import { AppInput } from '../ui/AppInput';

interface FormInputProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  style?: StyleProp<ViewStyle>;
  rules?: RegisterOptions<T, Path<T>>;
}

export const FormInput = <T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  keyboardType,
  secureTextEntry,
  multiline,
  numberOfLines,
  maxLength,
  style,
  rules,
}: FormInputProps<T>): React.JSX.Element => (
  <Controller
    control={control}
    name={name}
    rules={rules}
    render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
      <AppInput
        label={label}
        value={String(value ?? '')}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={numberOfLines}
        maxLength={maxLength}
        errorText={error?.message}
        style={style}
      />
    )}
  />
);
