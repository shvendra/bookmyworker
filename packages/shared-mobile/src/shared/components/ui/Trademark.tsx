import React from 'react';
import { Text } from 'react-native';

/**
 * Trademark (™) mark shown next to the "BookMyWorker" branding.
 *
 * Rendered as a nested <Text>, so it must live inside an AppText / Text. The ™
 * glyph is inherently raised (superscript) in most fonts, so we only shrink it
 * and colour it to suit the surface:
 *   • dark backgrounds  → white (pass `onDark`)
 *   • light backgrounds → premium blue (#2563EB)
 *
 * `size` is the brand text's fontSize; the ™ renders at ~55% of it.
 *
 * Usage:  <AppText style={styles.brandName}>BookMyWorker<Trademark onDark size={22} /></AppText>
 */
interface TrademarkProps {
  onDark?: boolean;
  size?: number;
}

export const Trademark = ({ onDark = false, size = 20 }: TrademarkProps): React.JSX.Element => (
  <Text
    allowFontScaling={false}
    style={{
      fontSize: Math.round(size * 0.55),
      fontWeight: '700',
      color: onDark ? '#FFFFFF' : '#2563EB',
    }}
  >
    {'™'}
  </Text>
);
