import React from 'react';
import { Image, ImageStyle } from 'react-native';
import { useAppConfig } from '../../../core/api/endpoints/appConfigApi';

const STATIC_LOGO = require('../../../../assets/logo.png');

interface BrandLogoProps {
  style?: ImageStyle;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
}

export const BrandLogo = ({ style, resizeMode = 'contain' }: BrandLogoProps): React.JSX.Element => {
  const { config } = useAppConfig();
  const source = config.brand.appLogo ? { uri: config.brand.appLogo } : STATIC_LOGO;
  return <Image source={source} style={style} resizeMode={resizeMode} />;
};
