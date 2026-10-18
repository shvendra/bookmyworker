import React from 'react';
import { Image } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

let mockAppLogo = '';
// The REAL module BrandLogo imports (the .ts suffix keeps jest's name-mapper from swapping it for the app-wide double).
jest.mock('../../../packages/shared-mobile/src/core/api/endpoints/appConfigApi.ts', () => ({
  useAppConfig: () => ({ config: { brand: { appLogo: mockAppLogo } } }),
}));

import { BrandLogo } from '../../../packages/shared-mobile/src/shared/components/ui/BrandLogo.tsx'; // .tsx → the real component

describe('BrandLogo — never an empty white box', () => {
  it('no SuperAdmin logo: the built-in brand mark', () => {
    mockAppLogo = '';
    render(<BrandLogo style={{ width: 52, height: 52 }} />);
    expect(screen.getByTestId('brand-mark')).toBeTruthy();
    expect(screen.queryByTestId('brand-logo')).toBeNull();
  });

  it('SuperAdmin logo (network): the brand mark stays visible until that image has loaded', () => {
    mockAppLogo = 'https://cdn.example/logo.png';
    const { UNSAFE_getAllByType } = render(<BrandLogo style={{ width: 100, height: 100 }} />);
    expect(screen.getByTestId('brand-logo')).toBeTruthy();
    expect(screen.getByTestId('brand-mark')).toBeTruthy(); // still downloading → "B" shown, not a blank tile
    const net = UNSAFE_getAllByType(Image).find((i) => (i.props.source as { uri?: string })?.uri === 'https://cdn.example/logo.png')!;
    expect(net).toBeTruthy();
    act(() => { fireEvent(net, 'load'); });
    expect(screen.queryByTestId('brand-mark')).toBeNull(); // loaded → the real logo replaces the mark
  });

  it('a failed download keeps the brand mark', () => {
    mockAppLogo = 'https://cdn.example/broken.png';
    const { UNSAFE_getAllByType } = render(<BrandLogo style={{ width: 52, height: 52 }} />);
    const net = UNSAFE_getAllByType(Image).find((i) => (i.props.source as { uri?: string })?.uri === 'https://cdn.example/broken.png')!;
    act(() => { fireEvent(net, 'error'); });
    expect(screen.getByTestId('brand-mark')).toBeTruthy();
  });
});
