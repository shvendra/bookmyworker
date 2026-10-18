import React from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp } from 'react-native';
import { BRAND_LOGO_DATA_URI } from './brandLogoData';

const BRAND_BLUE = '#1037A4';
const CREAM = '#FFF6E5';

interface BrandMarkProps {
  /** Same style the old <Image> had — only width/height matter. */
  style?: StyleProp<ImageStyle>;
}

/**
 * The BookMyWorker logo. Two layers: a brand-blue tile carrying the "B" monogram that is ALWAYS drawn, with the real
 * logo image on top. If the image is slow or fails to appear, the monogram is what people see — never an empty white box.
 */
export const BrandMark = ({ style }: BrandMarkProps): React.JSX.Element => {
  const flat = StyleSheet.flatten(style) as { width?: number; height?: number } | undefined;
  const size = typeof flat?.width === 'number' ? flat.width : typeof flat?.height === 'number' ? flat.height : 56;
  return (
    <View style={{ width: size, height: size }} testID="brand-mark">
      <View style={[StyleSheet.absoluteFill, s.tile]}>
        <Text style={[s.mono, { fontSize: size * 0.5 }]} allowFontScaling={false}>B</Text>
      </View>
      <Image source={{ uri: BRAND_LOGO_DATA_URI }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
    </View>
  );
};

const s = StyleSheet.create({
  tile: { backgroundColor: BRAND_BLUE, alignItems: 'center', justifyContent: 'center' },
  mono: { color: CREAM, fontWeight: '900', includeFontPadding: false },
});
