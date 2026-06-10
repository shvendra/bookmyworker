import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AgentKycScreen } from '../screens/onboarding/AgentKycScreen';
import { __auth } from './__mocks__/shared/authContext';
import { __themeState } from './__mocks__/shared/theme';
import { resetToMain } from './__mocks__/shared/navigationRef';
import { getAccessToken } from './__mocks__/shared/authStorage';
import { launchImageLibraryAsync } from './__mocks__/imagePicker';

const makeNav = () => ({ navigate: jest.fn(), goBack: jest.fn() });

const renderScreen = (navigation = makeNav()) => {
  render(
    <AgentKycScreen
      navigation={navigation as never}
      route={{ key: 'Kyc', name: 'Kyc' } as never}
    />,
  );
  return navigation;
};

const withSession = (over: Partial<{ fullName: string; language: string }> = {}) => {
  __auth.state = {
    status: 'authenticated',
    session: {
      user: { role: 'agent', kycStatus: 'pending', ...over },
      onboardingCompleted: false,
    },
  };
};

// Pick an ID image so the submit CTA becomes enabled.
const pickId = async () => {
  fireEvent.press(screen.getByText('kycUploadId'));
  await waitFor(() => expect(screen.getByText('continueToApp →')).toBeTruthy());
};

beforeEach(() => {
  jest.clearAllMocks();
  __themeState.mode = 'light';
  (globalThis as Record<string, unknown>).__i18nEmpty = [];
  __auth.state = { status: 'unauthenticated', session: null };
  __auth.setLanguage.mockResolvedValue(undefined);
  __auth.updateProfile.mockResolvedValue(undefined);
  __auth.completeOnboarding.mockResolvedValue(undefined);
  (getAccessToken as jest.Mock).mockResolvedValue('test-token');
  (launchImageLibraryAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///id.jpg', mimeType: 'image/jpeg' }],
  });
  (globalThis as Record<string, unknown>).fetch = jest.fn().mockResolvedValue({ ok: true });
  (globalThis as Record<string, unknown>).FormData = class {
    append = jest.fn();
  };
});

describe('AgentKycScreen — rendering', () => {
  it('renders the language card, the upload card and the CTA', () => {
    renderScreen();
    expect(screen.getByText('preferredLanguage')).toBeTruthy();
    expect(screen.getAllByText('English').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('हिंदी')).toBeTruthy();
    expect(screen.getByText('kycUploadId')).toBeTruthy();
    expect(screen.getByText('uploadIdToContinue')).toBeTruthy();
    expect(screen.getByText('privacyNote')).toBeTruthy();
  });

  it('selects a different language chip', () => {
    renderScreen();
    fireEvent.press(screen.getByText('हिंदी'));
    expect(screen.getByText('हिंदी')).toBeTruthy();
  });

  it('defaults the language to the saved user language when present', () => {
    withSession({ language: 'mr' });
    renderScreen();
    expect(screen.getByText('मराठी')).toBeTruthy();
  });

  it('renders correctly in dark mode', () => {
    __themeState.mode = 'dark';
    renderScreen();
    expect(screen.getByText('preferredLanguage')).toBeTruthy();
  });
});

describe('AgentKycScreen — ID upload', () => {
  it('uploads an ID image and enables the CTA', async () => {
    renderScreen();
    await pickId();
    expect(screen.getByText('✓ kycIdUploaded')).toBeTruthy();
  });

  it('stays disabled when the image pick is cancelled', async () => {
    (launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({ canceled: true, assets: [] });
    renderScreen();
    fireEvent.press(screen.getByText('kycUploadId'));
    await waitFor(() => expect(launchImageLibraryAsync).toHaveBeenCalled());
    expect(screen.getByText('uploadIdToContinue')).toBeTruthy();
  });

  it('stays disabled when the image picker throws', async () => {
    (launchImageLibraryAsync as jest.Mock).mockRejectedValueOnce(new Error('cam boom'));
    renderScreen();
    fireEvent.press(screen.getByText('kycUploadId'));
    await waitFor(() => expect(launchImageLibraryAsync).toHaveBeenCalled());
    expect(screen.getByText('uploadIdToContinue')).toBeTruthy();
  });

  it('derives the file extension from a uri without a dot', async () => {
    (launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///noext', mimeType: undefined }],
    });
    renderScreen();
    await pickId();
    expect(screen.getByText('✓ kycIdUploaded')).toBeTruthy();
  });
});

describe('AgentKycScreen — submission', () => {
  it('completes onboarding: sets language, uploads the doc and resets to Main', async () => {
    withSession({ fullName: 'Ravi', language: 'hi' });
    renderScreen();
    await pickId();
    fireEvent.press(screen.getByText('continueToApp →'));

    await waitFor(() => expect(__auth.completeOnboarding).toHaveBeenCalled());
    expect(__auth.setLanguage).toHaveBeenCalledWith('hi');
    expect(__auth.updateProfile).toHaveBeenCalledWith({ fullName: 'Ravi' });
    expect((globalThis as { fetch: jest.Mock }).fetch).toHaveBeenCalledWith(
      'https://test.api/api/v1/user/update',
      expect.objectContaining({
        method: 'PUT',
        headers: { Authorization: 'Bearer test-token' },
      }),
    );
    expect(resetToMain).toHaveBeenCalled();
  });

  it('does not update the profile when no name is present', async () => {
    renderScreen(); // unauthenticated → fullName defaults to ''
    await pickId();
    fireEvent.press(screen.getByText('continueToApp →'));
    await waitFor(() => expect(__auth.completeOnboarding).toHaveBeenCalled());
    expect(__auth.updateProfile).not.toHaveBeenCalled();
    expect(resetToMain).toHaveBeenCalled();
  });

  it('omits the Authorization header when there is no token', async () => {
    (getAccessToken as jest.Mock).mockResolvedValue(null);
    renderScreen();
    await pickId();
    fireEvent.press(screen.getByText('continueToApp →'));
    await waitFor(() => expect(resetToMain).toHaveBeenCalled());
    const opts = (globalThis as { fetch: jest.Mock }).fetch.mock.calls[0][1];
    expect(opts.headers.Authorization).toBeUndefined();
  });

  it('still completes onboarding when the doc upload network call fails', async () => {
    (globalThis as { fetch: jest.Mock }).fetch = jest.fn().mockRejectedValue(new Error('offline'));
    renderScreen();
    await pickId();
    fireEvent.press(screen.getByText('continueToApp →'));
    await waitFor(() => expect(__auth.completeOnboarding).toHaveBeenCalled());
    expect(resetToMain).toHaveBeenCalled();
  });

  it('surfaces an Error message when completing onboarding fails', async () => {
    __auth.setLanguage.mockRejectedValueOnce(new Error('save failed'));
    renderScreen();
    await pickId();
    fireEvent.press(screen.getByText('continueToApp →'));
    await waitFor(() => {
      expect(screen.getByText('⚠ save failed')).toBeTruthy();
    });
    expect(resetToMain).not.toHaveBeenCalled();
  });

  it('falls back to a generic message when the failure is not an Error', async () => {
    __auth.setLanguage.mockRejectedValueOnce('nope');
    renderScreen();
    await pickId();
    fireEvent.press(screen.getByText('continueToApp →'));
    await waitFor(() => {
      expect(screen.getByText('⚠ kycSomethingWrong')).toBeTruthy();
    });
  });
});
