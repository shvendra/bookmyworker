import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '@testing-library/react-native';

// Stub the employer-owned child screens so this navigator unit test stays fast
// and deterministic (no heavy form/animation subtrees rendering under load).
// Those screens have their own dedicated suites.
jest.mock('../screens/language/LanguageSelectScreen', () => {
  const { Text } = require('react-native');
  return {
    EMPLOYER_LANG_KEY: 'bmw_employer_lang',
    LanguageSelectScreen: () => <Text>LANG_PICKER</Text>,
  };
});
jest.mock('../screens/auth/EmployerRegisterScreen', () => ({
  EmployerRegisterScreen: () => null,
}));

import { AppNavigator } from '../navigation/AppNavigator';
import { __auth } from './__mocks__/shared/authContext';
import { __themeState } from './__mocks__/shared/theme';
import { navigationRef } from './__mocks__/shared/navigationRef';
import i18n from './__mocks__/shared/i18n';
import {
  __notif,
  setNotificationHandler,
} from './__mocks__/notifications';

const authenticated = (over: Partial<{ role: string; onboardingCompleted: boolean }> = {}) => {
  __auth.state = {
    status: 'authenticated',
    session: {
      user: { role: over.role ?? 'employer' },
      onboardingCompleted: over.onboardingCompleted ?? true,
    },
  };
};

// Captured at import time — AppNavigator calls setNotificationHandler once when
// this test file imports it (before any beforeEach clears the mock).
const notificationHandlerConfig = (setNotificationHandler as jest.Mock).mock
  .calls[0]?.[0] as { handleNotification: () => Promise<unknown> } | undefined;

// Build a notification response payload of the shape the listener expects.
const notif = (data: Record<string, unknown>) => ({
  notification: { request: { content: { data } } },
});

beforeEach(() => {
  jest.clearAllMocks();
  // Deterministically control the saved-language read instead of relying on the
  // in-memory store + async clear() timing (which made these tests racy).
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  __themeState.mode = 'light';
  __auth.state = { status: 'unauthenticated', session: null };
  navigationRef.isReady.mockReturnValue(true);
  __notif.responseCb = null;
});

describe('AppNavigator — module init', () => {
  it('registers a notification handler at import time', () => {
    expect(notificationHandlerConfig).toBeDefined();
    expect(typeof notificationHandlerConfig!.handleNotification).toBe('function');
  });

  it('the notification handler asks to show alert, sound and badge', async () => {
    const result = await notificationHandlerConfig!.handleNotification();
    expect(result).toEqual({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    });
  });
});

describe('AppNavigator — boot / loading', () => {
  it('shows the loading state while auth is loading', () => {
    __auth.state = { status: 'loading', session: null };
    render(<AppNavigator />);
    expect(screen.getByText('Preparing your workspace…')).toBeTruthy();
  });

  it('shows the loading state while the saved language is being read', () => {
    // Keep the AsyncStorage read pending so langStatus stays "checking" and the
    // loading screen is shown deterministically.
    (AsyncStorage.getItem as jest.Mock).mockReturnValue(new Promise<string | null>(() => {}));
    render(<AppNavigator />);
    expect(screen.getByText('Preparing your workspace…')).toBeTruthy();
  });
});

describe('AppNavigator — language bootstrap', () => {
  it('first launch (no saved language) renders the language picker stack', async () => {
    render(<AppNavigator />);
    expect(await screen.findByText('LANG_PICKER')).toBeTruthy();
  });

  it('returning user (saved language) restores it and skips the picker', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('ta');
    render(<AppNavigator />);
    await waitFor(() => {
      expect(i18n.changeLanguage).toHaveBeenCalledWith('ta');
    });
    // Language picker is not in the returning-user stack.
    expect(screen.queryByText('LANG_PICKER')).toBeNull();
  });
});

describe('AppNavigator — authenticated routing', () => {
  it('keeps an employer session and renders the app shell', async () => {
    authenticated({ role: 'employer', onboardingCompleted: true });
    render(<AppNavigator />);
    await waitFor(() => expect(screen.queryByText('Preparing your workspace…')).toBeNull());
    expect(__auth.signOut).not.toHaveBeenCalled();
  });

  it('shows the KYC-first flow when onboarding is incomplete', async () => {
    authenticated({ role: 'employer', onboardingCompleted: false });
    render(<AppNavigator />);
    await waitFor(() => expect(screen.queryByText('Preparing your workspace…')).toBeNull());
    expect(__auth.signOut).not.toHaveBeenCalled();
  });

  it('signs out a non-employer session', async () => {
    authenticated({ role: 'agent', onboardingCompleted: true });
    render(<AppNavigator />);
    await waitFor(() => expect(__auth.signOut).toHaveBeenCalledTimes(1));
  });

  it('signs out a session that has no role at all', async () => {
    __auth.state = {
      status: 'authenticated',
      session: { user: { role: undefined as unknown as string }, onboardingCompleted: true },
    };
    render(<AppNavigator />);
    await waitFor(() => expect(__auth.signOut).toHaveBeenCalledTimes(1));
  });

  it('renders correctly in dark mode', async () => {
    __themeState.mode = 'dark';
    authenticated();
    render(<AppNavigator />);
    await waitFor(() => expect(screen.queryByText('Preparing your workspace…')).toBeNull());
  });
});

describe('AppNavigator — notification deep links', () => {
  const renderReady = async () => {
    authenticated();
    render(<AppNavigator />);
    await waitFor(() => expect(__notif.responseCb).toBeInstanceOf(Function));
  };

  it('routes a worker-invite response to RequirementInvitations', async () => {
    await renderReady();
    act(() => {
      __notif.responseCb!(
        notif({ type: 'workerInviteResponse', requirementId: 'req-1', workType: 'Plumber' }),
      );
    });
    expect(navigationRef.navigate).toHaveBeenCalledWith('RequirementInvitations', {
      requirementId: 'req-1',
      requirementTitle: 'Plumber',
    });
  });

  it('routes a requirement notification to RequirementDetail', async () => {
    await renderReady();
    act(() => {
      __notif.responseCb!(notif({ type: 'requirement', requirementId: 'req-2' }));
    });
    expect(navigationRef.navigate).toHaveBeenCalledWith('RequirementDetail', {
      requirementId: 'req-2',
    });
  });

  it('routes an unknown notification to the Notifications screen', async () => {
    await renderReady();
    act(() => {
      __notif.responseCb!(notif({ type: 'somethingElse' }));
    });
    expect(navigationRef.navigate).toHaveBeenCalledWith('Notifications', undefined);
  });

  it('treats a worker-invite without a requirementId as a generic notification', async () => {
    await renderReady();
    act(() => {
      __notif.responseCb!(notif({ type: 'workerInviteResponse' }));
    });
    expect(navigationRef.navigate).toHaveBeenCalledWith('Notifications', undefined);
  });

  it('ignores notifications when navigation is not ready', async () => {
    await renderReady();
    navigationRef.isReady.mockReturnValue(false);
    act(() => {
      __notif.responseCb!(notif({ type: 'requirement', requirementId: 'req-3' }));
    });
    expect(navigationRef.navigate).not.toHaveBeenCalled();
  });

  it('removes the notification listener on unmount', async () => {
    authenticated();
    const { unmount } = render(<AppNavigator />);
    await waitFor(() => expect(__notif.responseCb).toBeInstanceOf(Function));
    unmount();
    expect(__notif.remove).toHaveBeenCalled();
  });
});
