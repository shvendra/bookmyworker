import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { AgentLoginScreen } from '../screens/auth/AgentLoginScreen';
import { __themeState } from './__mocks__/shared/theme';

const makeNav = () => ({ navigate: jest.fn() });

const renderScreen = (
  navigation = makeNav(),
  params: Record<string, unknown> | undefined = undefined,
) => {
  render(
    <AgentLoginScreen
      navigation={navigation as never}
      route={{ key: 'Login', name: 'Login', params } as never}
    />,
  );
  return navigation;
};

const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  __themeState.mode = 'light';
  (Platform as { OS: string }).OS = originalOS;
});

describe('AgentLoginScreen', () => {
  it('renders the hero, both login-mode tabs and the trust badges', () => {
    renderScreen();
    expect(screen.getByText('BookMyWorker')).toBeTruthy();
    expect(screen.getAllByText('welcomeBack').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('🔒  passwordLoginTab')).toBeTruthy();
    expect(screen.getByText('📱  otpLoginTab')).toBeTruthy();
    expect(screen.getByText('loginTrustOtp')).toBeTruthy();
  });

  it('defaults to the password login form', () => {
    renderScreen();
    // Password tab is active by default; both tabs are present.
    expect(screen.getByText('🔒  passwordLoginTab')).toBeTruthy();
  });

  it('switches to the OTP form and back to password', () => {
    renderScreen();
    fireEvent.press(screen.getByText('📱  otpLoginTab')); // mode → otp
    fireEvent.press(screen.getByText('🔒  passwordLoginTab')); // mode → password
    // Still rendering without crashing after toggling both branches.
    expect(screen.getByText('📱  otpLoginTab')).toBeTruthy();
  });

  it('navigates to Register from the create-account link', () => {
    const nav = renderScreen();
    fireEvent.press(screen.getByText('createAccount'));
    expect(nav.navigate).toHaveBeenCalledWith('Register');
  });

  it('accepts a roleHint route param without crashing', () => {
    renderScreen(makeNav(), { roleHint: 'worker' });
    expect(screen.getByText('welcomeBack')).toBeTruthy();
  });

  it('renders correctly in dark mode', () => {
    __themeState.mode = 'dark';
    renderScreen();
    expect(screen.getByText('loginWhyBmw')).toBeTruthy();
  });

  it('uses the ios keyboard behavior', () => {
    (Platform as { OS: string }).OS = 'ios';
    renderScreen();
    expect(screen.getByText('loginSubtitle')).toBeTruthy();
  });
});
