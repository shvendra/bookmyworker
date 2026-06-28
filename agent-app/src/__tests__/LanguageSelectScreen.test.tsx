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
  AGENT_LANG_KEY,
  LanguageSelectScreen,
} from '../screens/language/LanguageSelectScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from './__mocks__/shared/i18n';

const makeNav = () => ({ replace: jest.fn(), navigate: jest.fn() } as never);

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
    expect(AGENT_LANG_KEY).toBe('bmw_agent_lang');
  });

  it('renders the full language grid and the continue CTA', () => {
    renderScreen();
    expect(screen.getAllByText('हिंदी').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('ਪੰਜਾਬੀ')).toBeTruthy(); // lone-last (odd count) full-width card
    expect(screen.getByText('Continue')).toBeTruthy();
    expect(screen.getByText('Choose Your Language')).toBeTruthy();
  });

  it('defaults to English and shows the selected-language hint', () => {
    renderScreen();
    expect(screen.getByText('Selected:', { exact: false })).toBeTruthy();
  });

  it('persists the choice, syncs i18n and navigates on continue', async () => {
    const { navigation } = renderScreen();
    const replace = (navigation as unknown as { replace: jest.Mock }).replace;
    const btn = () => screen.getAllByRole('button')[0];

    fireEvent.press(screen.getByText('मराठी')); // select Marathi
    fireEvent.press(btn()); // first tap → saving = true, runs the flow
    fireEvent.press(btn()); // second tap → guard short-circuits (no double submit)

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(AGENT_LANG_KEY, 'mr');
    });
    // Also records the deliberate-pick marker so it wins over a stale DB language.
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(`${AGENT_LANG_KEY}_pending`, 'mr');
    // One flow run = the two keys above; the guarded second tap adds nothing.
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
    expect(i18n.changeLanguage).toHaveBeenLastCalledWith('mr');
    expect(replace).toHaveBeenCalledTimes(1);
    // Language → intent (role) choice → (later) Welcome
    expect(replace).toHaveBeenCalledWith('IntentSelect');
  });

  it('defaults to English when continue is pressed without changing selection', async () => {
    renderScreen();
    fireEvent.press(screen.getByText('Continue'));
    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(AGENT_LANG_KEY, 'en');
    });
  });

  it('computes pressed/unpressed style for a non-selected card', () => {
    renderScreen();
    // Hindi is not the default selection (English), so its card exercises the
    // `pressed && !isSelected` style branch.
    const styleFn = findStyleFn(screen.getAllByText('Hindi')[0]);
    expect(styleFn).toBeInstanceOf(Function);
    expect(styleFn({ pressed: true })).toBeTruthy();
    expect(styleFn({ pressed: false })).toBeTruthy();
  });

  it('computes the selected-card style for the default English card', () => {
    renderScreen();
    const styleFn = findStyleFn(screen.getAllByText('English')[0]);
    expect(styleFn).toBeInstanceOf(Function);
    // isSelected is true → the `pressed && !isSelected` arm is false.
    expect(styleFn({ pressed: true })).toBeTruthy();
  });

  it('shows the waiting label while saving', async () => {
    renderScreen();
    fireEvent.press(screen.getByText('Continue'));
    await waitFor(() => {
      expect(screen.getByText('Please wait…')).toBeTruthy();
    });
  });
});
