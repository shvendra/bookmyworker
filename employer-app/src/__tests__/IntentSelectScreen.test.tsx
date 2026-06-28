import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { IntentSelectScreen } from '../screens/intent/IntentSelectScreen';

const makeNav = () => ({ replace: jest.fn() } as never);

beforeEach(() => jest.clearAllMocks());

describe('IntentSelectScreen (employer app)', () => {
  it('shows the title, employer subtitle and both options', () => {
    render(<IntentSelectScreen navigation={makeNav()} route={{} as never} />);
    expect(screen.getByText('intentTitle')).toBeTruthy();
    expect(screen.getByText('intentSubtitleEmployer')).toBeTruthy();
    expect(screen.getByText('intentHireWorkers')).toBeTruthy();
    expect(screen.getByText('intentFindWork')).toBeTruthy();
  });

  it('CORRECT choice (hiring workers) continues to Welcome — no redirect', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    const nav = makeNav();
    render(<IntentSelectScreen navigation={nav} route={{} as never} />);
    fireEvent.press(screen.getByText('intentHireWorkers'));
    expect((nav as { replace: jest.Mock }).replace).toHaveBeenCalledWith('Welcome');
    expect(openURL).not.toHaveBeenCalled();
  });

  it('WRONG choice (looking for work) opens the Worker app on Play Store — no nav', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    const nav = makeNav();
    render(<IntentSelectScreen navigation={nav} route={{} as never} />);
    fireEvent.press(screen.getByText('intentFindWork'));
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('com.app.myworker'));
    expect((nav as { replace: jest.Mock }).replace).not.toHaveBeenCalled();
  });
});
