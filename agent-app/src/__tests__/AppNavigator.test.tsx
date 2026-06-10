import React from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '@testing-library/react-native';

// Stub the heavy, animated sibling screens — each has its own dedicated test
// file. The navigator test only cares about WHICH screen/branch is active, so
// lightweight markers keep it fast and deterministic. The language module must
// still export AGENT_LANG_KEY (the navigator imports it).
jest.mock('../screens/language/LanguageSelectScreen', () => ({
  AGENT_LANG_KEY: 'bmw_agent_lang',
  LanguageSelectScreen: () => {
    const { Text: T } = require('react-native');
    return <T>LANG_SCREEN</T>;
  },
}));
jest.mock('../screens/auth/AgentWelcomeScreen', () => ({
  AgentWelcomeScreen: () => {
    const { Text: T } = require('react-native');
    return <T>WELCOME_SCREEN</T>;
  },
}));
jest.mock('../screens/auth/AgentLoginScreen', () => ({
  AgentLoginScreen: () => {
    const { Text: T } = require('react-native');
    return <T>LOGIN_SCREEN</T>;
  },
}));
jest.mock('../screens/auth/AgentRegisterScreen', () => ({
  AgentRegisterScreen: () => null,
}));
jest.mock('../screens/onboarding/WorkCategorySelectScreen', () => ({
  WorkCategorySelectScreen: () => null,
}));
jest.mock('../screens/onboarding/AgentKycScreen', () => ({
  AgentKycScreen: () => null,
}));

import { AppNavigator } from '../navigation/AppNavigator';
import { AGENT_LANG_KEY } from '../screens/language/LanguageSelectScreen';
import { __auth } from './__mocks__/shared/authContext';
import { __themeState } from './__mocks__/shared/theme';
import { navigationRef } from './__mocks__/shared/navigationRef';
import i18n from './__mocks__/shared/i18n';
import {
  __notif,
  setNotificationHandler,
} from './__mocks__/notifications';

void Text; // keep the import referenced for the JSX stubs above

const authenticated = (
  over: Partial<{ role: string; onboardingCompleted: boolean; id: string }> = {},
) => {
  __auth.state = {
    status: 'authenticated',
    session: {
      user: { role: over.role ?? 'agent', id: over.id },
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

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  __themeState.mode = 'light';
  __auth.state = { status: 'unauthenticated', session: null };
  navigationRef.isReady.mockReturnValue(true);
  __notif.responseCb = null;
  __notif.receivedCb = null;
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
  it('shows the loading state while auth is loading', async () => {
    __auth.state = { status: 'loading', session: null };
    render(<AppNavigator />);
    expect(screen.getByText('Preparing your workspace…')).toBeTruthy();
    // Flush the AsyncStorage.getItem promise so there is no dangling update.
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());
    expect(screen.getByText('Preparing your workspace…')).toBeTruthy();
  });

  it('shows the loading state while the saved language is being read', async () => {
    render(<AppNavigator />);
    expect(screen.getByText('Preparing your workspace…')).toBeTruthy();
    // After the language read resolves it transitions to the picker.
    expect(await screen.findByText('LANG_SCREEN')).toBeTruthy();
  });
});

describe('AppNavigator — language bootstrap', () => {
  it('first launch (no saved language) renders the language picker stack', async () => {
    render(<AppNavigator />);
    expect(await screen.findByText('LANG_SCREEN')).toBeTruthy();
  });

  it('returning user (saved language) restores it and skips the picker', async () => {
    await AsyncStorage.setItem(AGENT_LANG_KEY, 'ta');
    render(<AppNavigator />);
    await waitFor(() => {
      expect(i18n.changeLanguage).toHaveBeenCalledWith('ta');
    });
    // Language picker is not the first screen anymore — Login is.
    expect(await screen.findByText('LOGIN_SCREEN')).toBeTruthy();
    expect(screen.queryByText('LANG_SCREEN')).toBeNull();
  });
});

describe('AppNavigator — authenticated routing', () => {
  it('keeps an agent session and renders the app shell', async () => {
    authenticated({ role: 'agent', onboardingCompleted: true });
    render(<AppNavigator />);
    await waitFor(() => expect(screen.queryByText('Preparing your workspace…')).toBeNull());
    expect(__auth.signOut).not.toHaveBeenCalled();
  });

  it('keeps a worker session', async () => {
    authenticated({ role: 'worker', onboardingCompleted: true });
    render(<AppNavigator />);
    await waitFor(() => expect(screen.queryByText('Preparing your workspace…')).toBeNull());
    expect(__auth.signOut).not.toHaveBeenCalled();
  });

  it('keeps a selfworker session', async () => {
    authenticated({ role: 'selfworker', onboardingCompleted: true });
    render(<AppNavigator />);
    await waitFor(() => expect(screen.queryByText('Preparing your workspace…')).toBeNull());
    expect(__auth.signOut).not.toHaveBeenCalled();
  });

  it('signs out a non-agent/worker session (stale employer)', async () => {
    authenticated({ role: 'employer', onboardingCompleted: true });
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

describe('AppNavigator — profile completion redirect', () => {
  it('resets to WorkerProfileCompletion right after fresh registration', async () => {
    authenticated({ role: 'selfworker', onboardingCompleted: false, id: 'u-1' });
    render(<AppNavigator />);
    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('workerProfileFlowSeen_u-1', 'true');
    });
    await waitFor(() => {
      expect(navigationRef.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'WorkerProfileCompletion' }],
      });
    });
  });

  it('does not reset when navigation is not ready', async () => {
    navigationRef.isReady.mockReturnValue(false);
    authenticated({ role: 'agent', onboardingCompleted: false, id: 'u-2' });
    render(<AppNavigator />);
    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('workerProfileFlowSeen_u-2', 'true');
    });
    expect(navigationRef.reset).not.toHaveBeenCalled();
  });

  it('skips the redirect when there is no user id', async () => {
    authenticated({ role: 'agent', onboardingCompleted: false });
    render(<AppNavigator />);
    await waitFor(() => expect(screen.queryByText('Preparing your workspace…')).toBeNull());
    expect(navigationRef.reset).not.toHaveBeenCalled();
  });

  it('does not redirect once onboarding is complete', async () => {
    authenticated({ role: 'agent', onboardingCompleted: true, id: 'u-3' });
    render(<AppNavigator />);
    await waitFor(() => expect(screen.queryByText('Preparing your workspace…')).toBeNull());
    expect(navigationRef.reset).not.toHaveBeenCalled();
  });
});

describe('AppNavigator — notification listeners', () => {
  const renderReady = async () => {
    authenticated();
    render(<AppNavigator />);
    await waitFor(() => expect(__notif.responseCb).toBeInstanceOf(Function));
  };

  it('registers a foreground received listener', async () => {
    await renderReady();
    // The received listener body is a no-op; invoking it covers the callback.
    expect(() => __notif.receivedCb!({})).not.toThrow();
  });

  it('routes a requirement notification to RequirementDetail', async () => {
    await renderReady();
    act(() => {
      __notif.responseCb!(notif({ type: 'requirement', requirementId: 'req-1' }));
    });
    expect(navigationRef.navigate).toHaveBeenCalledWith('RequirementDetail', {
      requirementId: 'req-1',
    });
  });

  it('routes a worker-invite notification to Invitations', async () => {
    await renderReady();
    act(() => {
      __notif.responseCb!(notif({ type: 'workerInvite' }));
    });
    expect(navigationRef.navigate).toHaveBeenCalledWith('Invitations', undefined);
  });

  it('routes a chat notification to ChatRoom with the room name', async () => {
    await renderReady();
    act(() => {
      __notif.responseCb!(notif({ type: 'chat', roomId: 'room-9', roomName: 'Site A' }));
    });
    expect(navigationRef.navigate).toHaveBeenCalledWith('ChatRoom', {
      roomId: 'room-9',
      roomName: 'Site A',
    });
  });

  it('defaults the chat room name to "Chat" when none is provided', async () => {
    await renderReady();
    act(() => {
      __notif.responseCb!(notif({ type: 'chat', roomId: 'room-10' }));
    });
    expect(navigationRef.navigate).toHaveBeenCalledWith('ChatRoom', {
      roomId: 'room-10',
      roomName: 'Chat',
    });
  });

  it('routes an unknown notification to the Notifications screen', async () => {
    await renderReady();
    act(() => {
      __notif.responseCb!(notif({ type: 'somethingElse' }));
    });
    expect(navigationRef.navigate).toHaveBeenCalledWith('Notifications', undefined);
  });

  it('treats a requirement without an id as a generic notification', async () => {
    await renderReady();
    act(() => {
      __notif.responseCb!(notif({ type: 'requirement' }));
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

  it('removes both notification listeners on unmount', async () => {
    authenticated();
    const { unmount } = render(<AppNavigator />);
    await waitFor(() => expect(__notif.responseCb).toBeInstanceOf(Function));
    unmount();
    expect(__notif.removeResponse).toHaveBeenCalled();
    expect(__notif.removeReceived).toHaveBeenCalled();
  });
});
