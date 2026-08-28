import React from 'react';
import { PixelRatio, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { useAppTheme } from '../../../core/theme';
import { fontFamilyForWeight, fontsAreReady } from '../../../core/theme/fonts';

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
  children?: React.ReactNode;
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

export const AppText = React.memo(({
  children,
  variant = 'body',
  style,
  weight,
  color,
  center,
  numberOfLines,
  adjustsFontSizeToFit,
  minimumFontScale,
  maxFontSizeMultiplier,
  ...rest
}: AppTextProps): React.JSX.Element => {
  const { theme } = useAppTheme();

  // ── Global text-overflow guards (employer + agent apps) ───────────────────
  // Cap OS font-scaling so large system fonts can't blow text out of its
  // container — the #1 cause of clipped labels on high-accessibility devices.
  //
  // Shrink-to-fit is applied ONLY when a caller explicitly opts in via
  // adjustsFontSizeToFit. We do NOT auto-enable it for every numberOfLines:
  // doing so made long Hindi/Indic labels shrink to a tiny, unreadable size in
  // chips, rows and scrollable containers. Default behaviour now keeps text at
  // its standard size and truncates with an ellipsis if a bounded line is too long.
  const shrinkToFit = adjustsFontSizeToFit === true;
  const cap = maxFontSizeMultiplier ?? 1.3;

  // ── Scale lineHeight in lockstep with the (capped) OS font scale ───────────
  // React Native scales fontSize by the device font-scale setting (clamped by
  // maxFontSizeMultiplier) but leaves an explicit lineHeight UNTOUCHED. On
  // large-font / high-accessibility devices that mismatch makes the line box too
  // short for the now-bigger glyphs, vertically clipping tall scripts
  // (Devanagari/Tamil/Telugu/… top & bottom matras and conjuncts) — most visible
  // in tight chips, pills and badges. Recompute the effective lineHeight so the
  // line box grows together with the rendered text. effScale is 1 at the default
  // font scale, so this is a NO-OP on normal devices → zero layout regression.
  const effScale = Math.min(PixelRatio.getFontScale(), cap);
  // ONE flatten covers both the effective lineHeight (for the scale-aware line
  // box below) AND the effective fontWeight (for the Poppins family map) —
  // avoids doing StyleSheet.flatten twice on every single text node.
  const flat = (StyleSheet.flatten([
    variantStyles[variant],
    weight ? { fontWeight: weight } : undefined,
    style,
  ]) ?? {}) as TextStyle;
  const baseLineHeight = typeof flat.lineHeight === 'number' ? flat.lineHeight : undefined;
  const scaledLineHeight =
    baseLineHeight != null && effScale > 1 ? baseLineHeight * effScale : undefined;

  // ── Brand font (Poppins) ───────────────────────────────────────────────────
  // Android can't synthesise weights from one family, so pick the Poppins family
  // that matches the EFFECTIVE fontWeight (style > weight prop > variant), and
  // neutralise fontWeight so iOS doesn't faux-bold on top. Only applied once
  // fonts are ready — otherwise this is null and text renders exactly as before.
  const brandFont: TextStyle | null = fontsAreReady()
    ? { fontFamily: fontFamilyForWeight(flat.fontWeight), fontWeight: 'normal' }
    : null;

  return (
    <Text
      style={[
        // Android: always reserve room for Devanagari/Indic top & bottom matras
        // so glyphs are never vertically clipped. No-op on iOS, never changes width.
        { includeFontPadding: true },
        variantStyles[variant],
        {
          color: color ?? theme.colors.text,
          fontWeight: weight,
          textAlign: center ? 'center' : undefined,
        },
        style,
        // Applied LAST so it overrides any variant/style lineHeight with the
        // font-scale-aware value (only when the OS is actually scaling fonts up).
        scaledLineHeight != null ? { lineHeight: scaledLineHeight } : null,
        // Brand font family + neutralised weight — wins over variant/style weight.
        brandFont,
      ]}
      allowFontScaling
      maxFontSizeMultiplier={cap}
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={shrinkToFit}
      minimumFontScale={minimumFontScale ?? 0.75}
      {...rest}
    >
      {children}
    </Text>
  );
});
AppText.displayName = 'AppText';
