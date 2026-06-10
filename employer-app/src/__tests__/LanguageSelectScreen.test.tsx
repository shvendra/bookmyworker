import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Walk up from a node to the ancestor whose `style` prop is a function
// (i.e. the Pressable card), so we can exercise its press-state style callback.
const findStyleFn = (start: { parent: unknown; props?: { style?: unknown } } | null) => {
  let node: any = start;
  while (node && typeof node.props?.style !== 'function') node = node.parent;
  return node?.props?.style as (s: { pressed: boolean }) => unknown;
};

import {
  EMPLOYER_LANG_KEY,
  LanguageSelectScreen,
} from '../screens/language/LanguageSelectScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from './__mocks__/shared/i18n';

const makeNav = () =>
  ({ replace: jest.fn(), navigate: jest.fn() } as never);

const renderScreen = () => {
  const navigation = makeNav();
  const utils = render(<LanguageSelectScreen navigation={navigation} route={{} as never} />);
  return { navigation, ...utils };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LanguageSelectScreen', () => {
  it('exposes a stable storage key', () => {
    expect(EMPLOYER_LANG_KEY).toBe('bmw_employer_lang');
  });

  it('renders the full language grid and the continue CTA', () => {
    renderScreen();
    // A sample of the 11 supported languages.
    expect(screen.getAllByText('हिंदी').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('ਪੰਜਾਬੀ')).toBeTruthy(); // lone-last (odd count) card
    expect(screen.getByText('langSelectContinue')).toBeTruthy();
  });

  it('defaults to Hindi and shows the selected-language hint', () => {
    renderScreen();
    expect(screen.getByText('langSelectSelected', { exact: false })).toBeTruthy();
  });

  it('changes selection when a different language card is pressed', () => {
    renderScreen();
    // The English card shows "English" as both native and english label.
    fireEvent.press(screen.getAllByText('English')[0]);
    expect(i18n.changeLanguage).toHaveBeenCalledWith('en');
  });

  it('persists the choice, syncs i18n and navigates on continue', async () => {
    const { navigation } = renderScreen();
    const replace = (navigation as unknown as { replace: jest.Mock }).replace;
    const btn = () => screen.getAllByRole('button')[0];

    fireEvent.press(screen.getByText('मराठी')); // select Marathi
    fireEvent.press(btn()); // first tap → saving = true, runs the flow
    fireEvent.press(btn()); // second tap → guard short-circuits (no double submit)

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(EMPLOYER_LANG_KEY, 'mr');
    });
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(i18n.changeLanguage).toHaveBeenLastCalledWith('mr');
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('Welcome');
  });

  it('computes pressed/unpressed style for a non-selected card', () => {
    renderScreen();
    // English (index 1) is not the default selection (Hindi), so its card
    // exercises the `pressed && !isSelected` style branch.
    const styleFn = findStyleFn(screen.getAllByText('English')[0]);
    expect(styleFn).toBeInstanceOf(Function);
    expect(styleFn({ pressed: true })).toBeTruthy();
    expect(styleFn({ pressed: false })).toBeTruthy();
  });

  it('shows the waiting label while saving', async () => {
    renderScreen();
    fireEvent.press(screen.getByText('langSelectContinue'));
    // setSaving(true) flips the CTA label.
    await waitFor(() => {
      expect(screen.getByText('langSelectWait')).toBeTruthy();
    });
  });
});
