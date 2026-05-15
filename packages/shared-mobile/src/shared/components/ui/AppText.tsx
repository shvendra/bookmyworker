import React from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { useAppTheme } from '../../../core/theme';

// Extended variant system for a richer typographic hierarchy
export type TextVariant =
  | 'display'     // 34px 900 — hero titles, splash
  | 'title'       // 28px 800 — screen titles
  | 'heading'     // 22px 700 — section headings
  | 'subtitle'    // 18px 700 — card titles, subtitles
  | 'body'        // 15px 400 — standard body text
  | 'bodyMd'      // 15px 500 — slightly heavier body
  | 'label'       // 14px 600 — labels, tags
  | 'labelSm'     // 13px 600 — small labels
  | 'caption'     // 12px 400 — captions, helper text
  | 'micro'       // 11px 500 — timestamps, tiny badges
  | 'numeric';    // 24px 800 — stat numbers, amounts

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  weight?: TextStyle['fontWeight'];
  color?: string;
  center?: boolean;
}

const variantStyles = StyleSheet.create({
  display: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heading: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '400',
    letterSpacing: 0,
  },
  bodyMd: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '500',
    letterSpacing: 0,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  labelSm: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  caption: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  micro: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  numeric: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});

export const AppText = ({
  children,
  variant = 'body',
  style,
  weight,
  color,
  center,
  ...rest
}: AppTextProps): React.JSX.Element => {
  const { theme } = useAppTheme();

  return (
    <Text
      style={[
        variantStyles[variant],
        {
          color: color ?? theme.colors.text,
          fontWeight: weight,
          textAlign: center ? 'center' : undefined,
        },
        style,
      ]}
      allowFontScaling
      {...rest}
    >
      {children}
    </Text>
  );
};
