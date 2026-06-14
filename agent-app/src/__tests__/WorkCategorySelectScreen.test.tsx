import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { WorkCategorySelectScreen } from '../screens/onboarding/WorkCategorySelectScreen';
import { __auth } from './__mocks__/shared/authContext';
import { getAccessToken } from './__mocks__/shared/authStorage';

const makeNav = () => ({ replace: jest.fn(), goBack: jest.fn() });

const renderScreen = (navigation = makeNav()) => {
  render(
    <WorkCategorySelectScreen
      navigation={navigation as never}
      route={{ key: 'WorkCategorySelect', name: 'WorkCategorySelect' } as never}
    />,
  );
  return navigation;
};

// The screen renders categories via t(cat.translationKey); the i18n mock
// echoes the key back, so the rendered text is the translationKey itself.
const CAT_FORMATTED = 'cat_construction';

beforeEach(() => {
  jest.clearAllMocks();
  __auth.updateProfile.mockResolvedValue(undefined);
  (getAccessToken as jest.Mock).mockResolvedValue('test-token');
  (globalThis as Record<string, unknown>).fetch = jest
    .fn()
    .mockResolvedValue({ ok: true });
});

describe('WorkCategorySelectScreen', () => {
  it('renders the hero, the section label and the category grid', () => {
    renderScreen();
    expect(screen.getByText('acsTitle')).toBeTruthy();
    expect(screen.getByText('acsSelectApply')).toBeTruthy();
    expect(screen.getByText(CAT_FORMATTED)).toBeTruthy();
  });

  it('toggles a category on and off and updates the counter', () => {
    renderScreen();
    expect(screen.queryByText('acsCountOne')).toBeNull();
    fireEvent.press(screen.getByText(CAT_FORMATTED));
    expect(screen.getByText('acsCountOne')).toBeTruthy();
    fireEvent.press(screen.getByText(CAT_FORMATTED)); // toggle off
    expect(screen.queryByText('acsCountOne')).toBeNull();
  });

  it('pluralises the counter for multiple selections', () => {
    renderScreen();
    fireEvent.press(screen.getByText(CAT_FORMATTED));
    fireEvent.press(screen.getByText('cat_transport'));
    expect(screen.getByText('acsCountOther')).toBeTruthy();
  });

  it('does nothing when Complete is pressed with no selection', async () => {
    renderScreen();
    fireEvent.press(screen.getByText('acsCompleteProfile'));
    // Guard: selected.size === 0 → no network, no profile update.
    expect((globalThis as { fetch: jest.Mock }).fetch).not.toHaveBeenCalled();
    expect(__auth.updateProfile).not.toHaveBeenCalled();
  });

  it('saves the selection and navigates to Kyc on complete', async () => {
    const nav = renderScreen();
    fireEvent.press(screen.getByText(CAT_FORMATTED));
    fireEvent.press(screen.getByText('acsCompleteProfile'));

    await waitFor(() => {
      expect((globalThis as { fetch: jest.Mock }).fetch).toHaveBeenCalledWith(
        'https://test.api/api/v1/user/update',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
          body: JSON.stringify({ areasOfWork: ['construction_project_workers'] }),
        }),
      );
    });
    expect(__auth.updateProfile).toHaveBeenCalledWith({
      areasOfWork: ['construction_project_workers'],
    });
    expect(nav.replace).toHaveBeenCalledWith('Kyc');
  });

  it('omits the Authorization header when there is no token', async () => {
    (getAccessToken as jest.Mock).mockResolvedValueOnce(null);
    const nav = renderScreen();
    fireEvent.press(screen.getByText(CAT_FORMATTED));
    fireEvent.press(screen.getByText('acsCompleteProfile'));

    await waitFor(() => {
      expect((globalThis as { fetch: jest.Mock }).fetch).toHaveBeenCalled();
    });
    const headers = (globalThis as { fetch: jest.Mock }).fetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBeUndefined();
    expect(nav.replace).toHaveBeenCalledWith('Kyc');
  });

  it('still navigates to Kyc when the network call fails', async () => {
    (globalThis as { fetch: jest.Mock }).fetch = jest
      .fn()
      .mockRejectedValue(new Error('offline'));
    const nav = renderScreen();
    fireEvent.press(screen.getByText(CAT_FORMATTED));
    fireEvent.press(screen.getByText('acsCompleteProfile'));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('Kyc'));
  });

  it('skips straight to Kyc from the header skip button', () => {
    const nav = renderScreen();
    fireEvent.press(screen.getByText('acsSkip'));
    expect(nav.replace).toHaveBeenCalledWith('Kyc');
  });

  it('skips straight to Kyc from the footer skip row', () => {
    const nav = renderScreen();
    fireEvent.press(screen.getByText('acsSkipStep'));
    expect(nav.replace).toHaveBeenCalledWith('Kyc');
  });

  it('closes the screen with the back (✕) button', () => {
    const nav = renderScreen();
    fireEvent.press(screen.getByText('✕'));
    expect(nav.goBack).toHaveBeenCalled();
  });
});
