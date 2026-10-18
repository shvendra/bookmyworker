import React from 'react';
import { Image, ImageStyle } from 'react-native';
import { useAppConfig } from '../../../core/api/endpoints/appConfigApi';
import { BrandMark } from './BrandMark';

interface BrandLogoProps {
  style?: ImageStyle;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
}

export const BrandLogo = ({ style, resizeMode = 'contain' }: BrandLogoProps): React.JSX.Element => {
  const { config } = useAppConfig();
  // SuperAdmin-set logo (network) when present; otherwise the built-in mark, which always draws.
  if (config.brand.appLogo) return <Image source={{ uri: config.brand.appLogo }} style={style} resizeMode={resizeMode} />;
  return <BrandMark style={style} />;
};
