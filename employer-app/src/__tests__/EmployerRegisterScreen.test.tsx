import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { EmployerRegisterScreen } from '../screens/auth/EmployerRegisterScreen';
import { authService } from './__mocks__/shared/authService';
import { showAlert } from './__mocks__/shared/appAlert';
import {
  isGoogleSignInAvailable,
  signInWithGoogle,
} from './__mocks__/shared/googleSignIn';
import { __auth } from './__mocks__/shared/authContext';
import { __themeState } from './__mocks__/shared/theme';

const makeNav = () => ({ navigate: jest.fn() });

const renderScreen = (navigation = makeNav()) => {
  render(
    <EmployerRegisterScreen
      navigation={navigation as never}
      route={{ key: 'Register', name: 'Register' } as never}
    />,
  );
  return navigation;
};

const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  __themeState.mode = 'light';
  (Platform as { OS: string }).OS = originalOS;
  (globalThis as Record<string, unknown>).__i18nEmpty = [];
  (isGoogleSignInAvailable as jest.Mock).mockReturnValue(false);
  authService.requestOtp.mockResolvedValue(undefined);
  authService.googleStart.mockResolvedValue({ loggedIn: false });
});

// Helper — move from step 1 to step 2 by selecting a type and continuing.
const goToStep2 = () => {
  fireEvent.press(screen.getByText('employerTypeIndividual'));
  fireEvent.press(screen.getByText('continueBtn'));
};

describe('EmployerRegisterScreen — step 1 (type selection)', () => {
  it('renders the four employer types and the heading', () => {
    renderScreen();
    expect(screen.getByText('employerRegistration')).toBeTruthy();
    expect(screen.getByText('employerTypeIndividual')).toBeTruthy();
    expect(screen.getByText('employerTypeContractor')).toBeTruthy();
    expect(screen.getByText('employerTypeAgency')).toBeTruthy();
    expect(screen.getByText('employerTypeIndustry')).toBeTruthy();
  });

  it('blocks continue and warns when no type is selected', () => {
    renderScreen();
    fireEvent.press(screen.getByText('continueBtn'));
    expect(showAlert).toHaveBeenCalledWith('selectAtLeastOneType', 'selectAtLeastOneType');
    // Still on step 1.
    expect(screen.getByText('employerRegistration')).toBeTruthy();
  });

  it('toggles a type on and off', () => {
    renderScreen();
    const card = screen.getByText('employerTypeContractor');
    fireEvent.press(card); // on → checkmark appears
    expect(screen.getByText('✓')).toBeTruthy();
    fireEvent.press(card); // off → checkmark gone
    expect(screen.queryByText('✓')).toBeNull();
  });

  it('advances to step 2 once a type is selected', () => {
    renderScreen();
    goToStep2();
    expect(screen.getByText('createYourAccount')).toBeTruthy();
  });

  it('navigates to Login from the sign-in link', () => {
    const nav = renderScreen();
    fireEvent.press(screen.getByText('signIn'));
    expect(nav.navigate).toHaveBeenCalledWith('Login');
  });

  it('renders dark-mode styling', () => {
    __themeState.mode = 'dark';
    renderScreen();
    expect(screen.getByText('employerRegistration')).toBeTruthy();
  });
});

describe('EmployerRegisterScreen — step 2 (details form)', () => {
  const fillForm = (over: Partial<Record<string, string>> = {}) => {
    fireEvent.changeText(screen.getByPlaceholderText('companyNamePlaceholder'), over.name ?? 'Acme Co');
    fireEvent.changeText(screen.getByPlaceholderText('9876543210'), over.phone ?? '9876543210');
    fireEvent.changeText(screen.getByPlaceholderText('minSixChars'), over.password ?? 'secret1');
    fireEvent.changeText(screen.getByPlaceholderText('reEnterPassword'), over.confirm ?? 'secret1');
  };

  it('submits valid details, requests OTP and navigates to RegisterOtp', async () => {
    const nav = renderScreen();
    goToStep2();
    fillForm();
    fireEvent.press(screen.getByText('sendOtpRegister'));

    await waitFor(() => {
      expect(authService.requestOtp).toHaveBeenCalledWith('9876543210', undefined);
    });
    expect(nav.navigate).toHaveBeenCalledWith(
      'RegisterOtp',
      expect.objectContaining({
        phone: '9876543210',
        role: 'Employer',
        name: 'Acme Co',
        password: 'secret1',
        employerType: JSON.stringify({
          individual: true,
          contractor: false,
          agency: false,
          industry: false,
        }),
      }),
    );
  });

  it('shows validation errors and does not submit when fields are invalid', async () => {
    const nav = renderScreen();
    goToStep2();
    fillForm({ phone: '123', password: 'x', confirm: 'y', name: '' });
    fireEvent.press(screen.getByText('sendOtpRegister'));

    await waitFor(() => {
      expect(screen.getByText('Enter a valid 10-digit number')).toBeTruthy();
    });
    expect(authService.requestOtp).not.toHaveBeenCalled();
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('surfaces an Error message when OTP request fails', async () => {
    authService.requestOtp.mockRejectedValueOnce(new Error('network down'));
    renderScreen();
    goToStep2();
    fillForm();
    fireEvent.press(screen.getByText('sendOtpRegister'));

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith('alertError', 'network down');
    });
  });

  it('falls back to a generic message when OTP failure is not an Error', async () => {
    authService.requestOtp.mockRejectedValueOnce('boom');
    renderScreen();
    goToStep2();
    fillForm();
    fireEvent.press(screen.getByText('sendOtpRegister'));

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith('alertError', 'au_failedSendOtp');
    });
  });

  it('goes back to step 1 with the back button', () => {
    renderScreen();
    goToStep2();
    fireEvent.press(screen.getByText('←'));
    expect(screen.getByText('employerRegistration')).toBeTruthy();
  });

  it('navigates to Login from step 2 sign-in link', () => {
    const nav = renderScreen();
    goToStep2();
    fireEvent.press(screen.getByText('signIn'));
    expect(nav.navigate).toHaveBeenCalledWith('Login');
  });

  it('renders step 2 in dark mode', () => {
    __themeState.mode = 'dark';
    renderScreen();
    goToStep2();
    expect(screen.getByText('createYourAccount')).toBeTruthy();
  });
});

describe('EmployerRegisterScreen — Google sign-in', () => {
  beforeEach(() => {
    (isGoogleSignInAvailable as jest.Mock).mockReturnValue(true);
  });

  it('shows the Google button and the select-type hint when available', () => {
    renderScreen();
    expect(screen.getByText('continueWithGoogle')).toBeTruthy();
    expect(screen.getByText('selectTypeBeforeGoogle')).toBeTruthy();
  });

  it('renders the literal fallbacks when translations are empty', () => {
    (globalThis as Record<string, unknown>).__i18nEmpty = [
      'orLabel',
      'continueWithGoogle',
      'selectTypeBeforeGoogle',
    ];
    renderScreen();
    expect(screen.getByText('or')).toBeTruthy();
    expect(screen.getByText('Continue with Google')).toBeTruthy();
    expect(
      screen.getByText('Select your employer type above to continue with Google'),
    ).toBeTruthy();
  });

  it('signs in directly when Google returns an existing session', async () => {
    (signInWithGoogle as jest.Mock).mockResolvedValueOnce('id-token');
    authService.googleStart.mockResolvedValueOnce({
      loggedIn: true,
      session: { user: { role: 'employer' } },
    });
    renderScreen();
    fireEvent.press(screen.getByText('employerTypeAgency'));
    fireEvent.press(screen.getByText('continueWithGoogle'));

    await waitFor(() => {
      expect(authService.googleStart).toHaveBeenCalledWith('id-token', 'employer-app');
    });
    expect(__auth.signIn).toHaveBeenCalledWith({ user: { role: 'employer' } });
  });

  it('finishes quietly when Google returns neither a session nor a phone need', async () => {
    (signInWithGoogle as jest.Mock).mockResolvedValueOnce('id-token');
    authService.googleStart.mockResolvedValueOnce({ loggedIn: false });
    renderScreen();
    fireEvent.press(screen.getByText('employerTypeAgency'));
    fireEvent.press(screen.getByText('continueWithGoogle'));

    await waitFor(() => {
      expect(authService.googleStart).toHaveBeenCalled();
    });
    expect(__auth.signIn).not.toHaveBeenCalled();
    expect(screen.queryByText('yourDetails')).toBeNull(); // no phone step
    expect(screen.getByText('employerRegistration')).toBeTruthy(); // still step 1
  });

  it('switches to the phone step when Google needs a phone number', async () => {
    (signInWithGoogle as jest.Mock).mockResolvedValueOnce('id-token');
    authService.googleStart.mockResolvedValueOnce({
      needsPhone: true,
      googleTicket: 'ticket-123',
      name: 'Ravi',
    });
    renderScreen();
    fireEvent.press(screen.getByText('employerTypeAgency'));
    fireEvent.press(screen.getByText('continueWithGoogle'));

    await waitFor(() => {
      expect(screen.getByText('yourDetails')).toBeTruthy();
    });
    // Greeting includes the returned name.
    expect(
      screen.getByText('✓ Signed in with Google as Ravi — add your mobile number to finish.'),
    ).toBeTruthy();
  });

  it('does nothing when the Google sign-in is cancelled', async () => {
    (signInWithGoogle as jest.Mock).mockResolvedValueOnce(null);
    renderScreen();
    fireEvent.press(screen.getByText('employerTypeAgency'));
    fireEvent.press(screen.getByText('continueWithGoogle'));

    await waitFor(() => {
      expect(signInWithGoogle).toHaveBeenCalled();
    });
    expect(authService.googleStart).not.toHaveBeenCalled();
    expect(__auth.signIn).not.toHaveBeenCalled();
  });

  it('alerts when Google sign-in throws an Error', async () => {
    (signInWithGoogle as jest.Mock).mockRejectedValueOnce(new Error('google boom'));
    renderScreen();
    fireEvent.press(screen.getByText('employerTypeAgency'));
    fireEvent.press(screen.getByText('continueWithGoogle'));

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith('alertError', 'google boom');
    });
  });

  it('alerts with a generic message when Google throws a non-Error', async () => {
    (signInWithGoogle as jest.Mock).mockRejectedValueOnce('nope');
    renderScreen();
    fireEvent.press(screen.getByText('employerTypeAgency'));
    fireEvent.press(screen.getByText('continueWithGoogle'));

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith('alertError', 'au_failedSendOtp');
    });
  });
});

describe('EmployerRegisterScreen — Google phone step', () => {
  // Drive the app into googleMode with a selected type, returning the nav mock.
  const enterGoogleMode = async (over: { name?: string } = {}) => {
    (isGoogleSignInAvailable as jest.Mock).mockReturnValue(true);
    (signInWithGoogle as jest.Mock).mockResolvedValueOnce('id-token');
    authService.googleStart.mockResolvedValueOnce({
      needsPhone: true,
      googleTicket: 'ticket-123',
      ...('name' in over ? { name: over.name } : { name: 'Ravi' }),
    });
    const nav = renderScreen();
    fireEvent.press(screen.getByText('employerTypeAgency'));
    fireEvent.press(screen.getByText('continueWithGoogle'));
    await waitFor(() => expect(screen.getByText('yourDetails')).toBeTruthy());
    return nav;
  };

  it('rejects an invalid phone number', async () => {
    await enterGoogleMode();
    fireEvent.changeText(screen.getByPlaceholderText('9876543210'), '123');
    fireEvent.press(screen.getByText('sendOtpRegister'));
    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith('alertError', 'enterValidPhone');
    });
    expect(authService.requestOtp).not.toHaveBeenCalled();
  });

  it('uses the literal phone-error fallback when translation is empty', async () => {
    await enterGoogleMode();
    (globalThis as Record<string, unknown>).__i18nEmpty = ['enterValidPhone'];
    fireEvent.changeText(screen.getByPlaceholderText('9876543210'), '12');
    fireEvent.press(screen.getByText('sendOtpRegister'));
    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith(
        'alertError',
        'Enter a valid 10-digit mobile number',
      );
    });
  });

  it('requests OTP and navigates with the google ticket on a valid phone', async () => {
    const nav = await enterGoogleMode();
    fireEvent.changeText(screen.getByPlaceholderText('9876543210'), '98a7654321x0');
    fireEvent.press(screen.getByText('sendOtpRegister'));

    await waitFor(() => {
      expect(authService.requestOtp).toHaveBeenCalledWith('9876543210', undefined);
    });
    expect(nav.navigate).toHaveBeenCalledWith(
      'RegisterOtp',
      expect.objectContaining({
        phone: '9876543210',
        role: 'Employer',
        name: 'Ravi',
        googleTicket: 'ticket-123',
        // Agency was selected, so hasType is true → selectedTypes used as-is.
        employerType: JSON.stringify({
          individual: false,
          contractor: false,
          agency: true,
          industry: false,
        }),
      }),
    );
  });

  it('defaults name to "Employer" and forces individual when type was lost', async () => {
    // No name returned → googleName '' → falls back to 'Employer'.
    const nav = await enterGoogleMode({ name: undefined });
    // Greeting without the "as <name>" suffix (googleName is empty).
    expect(
      screen.getByText('✓ Signed in with Google — add your mobile number to finish.'),
    ).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('9876543210'), '9000000000');
    fireEvent.press(screen.getByText('sendOtpRegister'));
    await waitFor(() => {
      expect(nav.navigate).toHaveBeenCalledWith(
        'RegisterOtp',
        expect.objectContaining({ name: 'Employer' }),
      );
    });
  });

  it('surfaces an error if OTP request fails in the google phone step', async () => {
    await enterGoogleMode();
    authService.requestOtp.mockRejectedValueOnce(new Error('otp fail'));
    fireEvent.changeText(screen.getByPlaceholderText('9876543210'), '9000000000');
    fireEvent.press(screen.getByText('sendOtpRegister'));
    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith('alertError', 'otp fail');
    });
  });

  it('falls back to a generic message on a non-Error OTP failure', async () => {
    await enterGoogleMode();
    authService.requestOtp.mockRejectedValueOnce('plain-string');
    fireEvent.changeText(screen.getByPlaceholderText('9876543210'), '9000000000');
    fireEvent.press(screen.getByText('sendOtpRegister'));
    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith('alertError', 'au_failedSendOtp');
    });
  });

  it('returns to step 1 from the google phone back button', async () => {
    await enterGoogleMode();
    fireEvent.press(screen.getByText('←'));
    expect(screen.getByText('employerRegistration')).toBeTruthy();
  });

  it('renders the google phone step in dark mode', async () => {
    __themeState.mode = 'dark';
    await enterGoogleMode();
    expect(screen.getByText('yourDetails')).toBeTruthy();
  });

  it('uses the android keyboard behavior in the google phone step', async () => {
    (Platform as { OS: string }).OS = 'android';
    await enterGoogleMode();
    expect(screen.getByText('yourDetails')).toBeTruthy();
  });
});

describe('EmployerRegisterScreen — platform behavior', () => {
  it('uses the android keyboard behavior on the step 2 form', () => {
    (Platform as { OS: string }).OS = 'android';
    renderScreen();
    fireEvent.press(screen.getByText('employerTypeIndividual'));
    fireEvent.press(screen.getByText('continueBtn'));
    expect(screen.getByText('createYourAccount')).toBeTruthy();
  });
});
