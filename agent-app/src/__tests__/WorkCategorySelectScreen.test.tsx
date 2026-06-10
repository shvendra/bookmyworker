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

// A label from the workerCategoryGrid mock.
const CAT = 'Construction & Project';
const CAT_FORMATTED = 'Construction\n& Project'; // after the screen's label.replace()

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
    expect(screen.getByText('What work do you do?')).toBeTruthy();
    expect(screen.getByText('Select all that apply')).toBeTruthy();
    expect(screen.getByText(CAT_FORMATTED)).toBeTruthy();
  });

  it('toggles a category on and off and updates the counter', () => {
    renderScreen();
    expect(screen.queryByText('1 category selected')).toBeNull();
    fireEvent.press(screen.getByText(CAT_FORMATTED));
    expect(screen.getByText('1 category selected')).toBeTruthy();
    fireEvent.press(screen.getByText(CAT_FORMATTED)); // toggle off
    expect(screen.queryByText('1 category selected')).toBeNull();
  });

  it('pluralises the counter for multiple selections', () => {
    renderScreen();
    fireEvent.press(screen.getByText(CAT_FORMATTED));
    fireEvent.press(screen.getByText('Transport & Logistics'));
    expect(screen.getByText('2 categories selected')).toBeTruthy();
  });

  it('does nothing when Complete is pressed with no selection', async () => {
    renderScreen();
    fireEvent.press(screen.getByText('Complete Profile  ✓'));
    // Guard: selected.size === 0 → no network, no profile update.
    expect((globalThis as { fetch: jest.Mock }).fetch).not.toHaveBeenCalled();
    expect(__auth.updateProfile).not.toHaveBeenCalled();
  });

  it('saves the selection and navigates to Kyc on complete', async () => {
    const nav = renderScreen();
    fireEvent.press(screen.getByText(CAT_FORMATTED));
    fireEvent.press(screen.getByText('Complete Profile  ✓'));

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
    fireEvent.press(screen.getByText('Complete Profile  ✓'));

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
    fireEvent.press(screen.getByText('Complete Profile  ✓'));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('Kyc'));
  });

  it('skips straight to Kyc from the header skip button', () => {
    const nav = renderScreen();
    fireEvent.press(screen.getByText('Skip'));
    expect(nav.replace).toHaveBeenCalledWith('Kyc');
  });

  it('skips straight to Kyc from the footer skip row', () => {
    const nav = renderScreen();
    fireEvent.press(screen.getByText('Skip this step'));
    expect(nav.replace).toHaveBeenCalledWith('Kyc');
  });

  it('closes the screen with the back (✕) button', () => {
    const nav = renderScreen();
    fireEvent.press(screen.getByText('✕'));
    expect(nav.goBack).toHaveBeenCalled();
  });
});
