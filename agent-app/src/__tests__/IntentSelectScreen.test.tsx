import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { IntentSelectScreen } from '../screens/intent/IntentSelectScreen';

const makeNav = () => ({ replace: jest.fn() } as never);

beforeEach(() => jest.clearAllMocks());

describe('IntentSelectScreen (agent / worker app)', () => {
  it('shows the title, worker subtitle and both options', () => {
    render(<IntentSelectScreen navigation={makeNav()} route={{} as never} />);
    expect(screen.getByText('intentTitle')).toBeTruthy();
    expect(screen.getByText('intentSubtitleWorker')).toBeTruthy();
    expect(screen.getByText('intentFindWork')).toBeTruthy();
    expect(screen.getByText('intentHireWorkers')).toBeTruthy();
  });

  it('CORRECT choice (looking for work) continues to Welcome — no redirect', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    const nav = makeNav();
    render(<IntentSelectScreen navigation={nav} route={{} as never} />);
    fireEvent.press(screen.getByText('intentFindWork'));
    expect((nav as { replace: jest.Mock }).replace).toHaveBeenCalledWith('Welcome');
    expect(openURL).not.toHaveBeenCalled();
  });

  it('WRONG choice (looking for workers) opens the Employer app on Play Store — no nav', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    const nav = makeNav();
    render(<IntentSelectScreen navigation={nav} route={{} as never} />);
    fireEvent.press(screen.getByText('intentHireWorkers'));
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('com.bookmyworkers.employer'));
    expect((nav as { replace: jest.Mock }).replace).not.toHaveBeenCalled();
  });
});
