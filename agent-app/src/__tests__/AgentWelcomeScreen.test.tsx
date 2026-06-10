import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { AgentWelcomeScreen } from '../screens/auth/AgentWelcomeScreen';
import { __themeState } from './__mocks__/shared/theme';

const makeNav = () => ({ navigate: jest.fn() });

const renderScreen = (navigation = makeNav()) => {
  render(
    <AgentWelcomeScreen
      navigation={navigation as never}
      route={{ key: 'Welcome', name: 'Welcome' } as never}
    />,
  );
  return navigation;
};

beforeEach(() => {
  jest.clearAllMocks();
  __themeState.mode = 'light';
});

describe('AgentWelcomeScreen', () => {
  it('renders the brand, headline and the work-type chips', () => {
    renderScreen();
    expect(screen.getByText('BookMyWorker')).toBeTruthy();
    expect(screen.getByText('welcomeHeadline')).toBeTruthy();
    // A sample of the 12 work-type chips (translation keys echoed by the mock).
    expect(screen.getByText('construction')).toBeTruthy();
    expect(screen.getByText('retail')).toBeTruthy();
  });

  it('renders both role boxes and the live workers pill', () => {
    renderScreen();
    expect(screen.getByText('agentRole')).toBeTruthy();
    expect(screen.getByText('workerRole')).toBeTruthy();
    expect(screen.getByText('liveWorkersActive', { exact: false })).toBeTruthy();
  });

  it('navigates to Login from the primary CTA', () => {
    const nav = renderScreen();
    fireEvent.press(screen.getByText('getStartedLogin'));
    expect(nav.navigate).toHaveBeenCalledWith('Login');
  });

  it('navigates to Register from the secondary CTA', () => {
    const nav = renderScreen();
    fireEvent.press(screen.getByText('createNewAccount'));
    expect(nav.navigate).toHaveBeenCalledWith('Register');
  });

  it('navigates to Register from the agent role box', () => {
    const nav = renderScreen();
    fireEvent.press(screen.getByText('agentRole'));
    expect(nav.navigate).toHaveBeenCalledWith('Register');
  });

  it('navigates to Register from the worker role box', () => {
    const nav = renderScreen();
    fireEvent.press(screen.getByText('workerRole'));
    expect(nav.navigate).toHaveBeenCalledWith('Register');
  });

  it('renders correctly in dark mode', () => {
    __themeState.mode = 'dark';
    renderScreen();
    expect(screen.getByText('welcomeHeadline')).toBeTruthy();
  });
});
