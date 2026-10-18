import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { BrandMark } from '../../../packages/shared-mobile/src/shared/components/ui/BrandMark.tsx'; // .tsx → the REAL component (the bare path is mapped to a test double)
import { BRAND_LOGO_DATA_URI } from '../../../packages/shared-mobile/src/shared/components/ui/brandLogoData';

describe('BrandMark — the logo that must never be an empty box', () => {
  it('always draws the brand-blue "B" monogram, even before/without the image', () => {
    render(<BrandMark style={{ width: 96, height: 96 }} />);
    expect(screen.getByText('B')).toBeTruthy();
  });

  it('layers the real logo (embedded PNG data URI) on top of the monogram', () => {
    const { UNSAFE_getByType } = render(<BrandMark style={{ width: 56, height: 56 }} />);
    const { Image } = require('react-native');
    expect(UNSAFE_getByType(Image).props.source).toEqual({ uri: BRAND_LOGO_DATA_URI });
    expect(BRAND_LOGO_DATA_URI.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('takes its size from the style it replaces', () => {
    render(<BrandMark style={{ width: 96, height: 96 }} />);
    const root = screen.getByTestId('brand-mark');
    expect(StyleSheet.flatten(root.props.style)).toMatchObject({ width: 96, height: 96 });
  });

  it('falls back to 56 when no size is given', () => {
    render(<BrandMark />);
    expect(StyleSheet.flatten(screen.getByTestId('brand-mark').props.style)).toMatchObject({ width: 56, height: 56 });
  });
});
