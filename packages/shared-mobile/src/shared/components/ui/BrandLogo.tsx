import React, { useEffect, useState } from 'react';
import { Image, ImageStyle, StyleSheet, View } from 'react-native';
import { useAppConfig } from '../../../core/api/endpoints/appConfigApi';
import { BrandMark } from './BrandMark';

interface BrandLogoProps {
  style?: ImageStyle;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
}

/**
 * The app logo. With no SuperAdmin logo it is the built-in <BrandMark/>. With one (a network image) the built-in mark
 * stays visible until that image has actually loaded — so a slow or failed download shows the brand "B", never an
 * empty white box.
 */
export const BrandLogo = ({ style, resizeMode = 'contain' }: BrandLogoProps): React.JSX.Element => {
  const { config } = useAppConfig();
  const uri = config.brand.appLogo || '';
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setLoaded(false); }, [uri]);

  if (!uri) return <BrandMark style={style} />;

  const flat = (StyleSheet.flatten(style) ?? {}) as ImageStyle;
  return (
    <View style={[style as never, { overflow: 'hidden' }]} testID="brand-logo">
      {!loaded && <BrandMark style={{ width: flat.width, height: flat.height } as ImageStyle} />}
      <Image
        source={{ uri }}
        style={[StyleSheet.absoluteFill, { opacity: loaded ? 1 : 0 }]}
        resizeMode={resizeMode}
        onLoad={() => setLoaded(true)}
      />
    </View>
  );
};
