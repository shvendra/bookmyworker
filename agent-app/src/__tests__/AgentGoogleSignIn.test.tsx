import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AgentLoginScreen } from '../screens/auth/AgentLoginScreen';
import { AgentRegisterScreen } from '../screens/auth/AgentRegisterScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from './__mocks__/shared/authService';
import { isGoogleSignInAvailable, signInWithGoogle } from './__mocks__/shared/googleSignIn';
import { showAlert } from './__mocks__/shared/appAlert';
import { __auth } from './__mocks__/shared/authContext';
import { __authFlags } from './__mocks__/shared/appConfigApi';

const makeNav = () => ({ navigate: jest.fn() });
const renderLogin = (navigation = makeNav()) => {
  render(<AgentLoginScreen navigation={navigation as never} route={{ key: 'Login', name: 'Login' } as never} />);
  return navigation;
};
const renderRegister = (navigation = makeNav()) => {
  render(<AgentRegisterScreen navigation={navigation as never} route={{ key: 'Register', name: 'Register' } as never} />);
  return navigation;
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (globalThis as Record<string, unknown>).__i18nEmpty = [];
  (isGoogleSignInAvailable as jest.Mock).mockReturnValue(true);
  authService.googleStart.mockResolvedValue({ loggedIn: false });
});

describe('Agent app — Google on the login screen', () => {
  it('hides the button when Google sign-in is not configured', () => {
    (isGoogleSignInAvailable as jest.Mock).mockReturnValue(false);
    renderLogin();
    expect(screen.queryByText('continueWithGoogle')).toBeNull();
  });

  it('signs in an existing Worker/Agent account', async () => {
    (signInWithGoogle as jest.Mock).mockResolvedValueOnce('id-token');
    authService.googleStart.mockResolvedValueOnce({ loggedIn: true, session: { user: { role: 'SelfWorker' } } });
    renderLogin();
    fireEvent.press(screen.getByText('continueWithGoogle'));
    await waitFor(() => expect(authService.googleStart).toHaveBeenCalledWith('id-token', 'agent-app'));
    expect(__auth.signIn).toHaveBeenCalledWith({ user: { role: 'SelfWorker' } });
  });

  it('a Google account with no account yet is told to register, and sent to Register', async () => {
    (signInWithGoogle as jest.Mock).mockResolvedValueOnce('id-token');
    authService.googleStart.mockResolvedValueOnce({ loggedIn: false, needsPhone: true, googleTicket: 't' });
    const nav = renderLogin();
    fireEvent.press(screen.getByText('continueWithGoogle'));
    await waitFor(() => expect(showAlert).toHaveBeenCalledWith('alertError', 'googleNoAccount'));
    expect(nav.navigate).toHaveBeenCalledWith('Register');
    expect(__auth.signIn).not.toHaveBeenCalled();
  });

  it('shows a calm message on DEVELOPER_ERROR, and nothing when the person cancels', async () => {
    (signInWithGoogle as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('DEVELOPER_ERROR: x'), { code: '10' }));
    renderLogin();
    fireEvent.press(screen.getByText('continueWithGoogle'));
    await waitFor(() => expect(showAlert).toHaveBeenCalledWith('alertError', 'googleSignInUnavailable'));
    (showAlert as jest.Mock).mockClear();
    (signInWithGoogle as jest.Mock).mockResolvedValueOnce(null);
    fireEvent.press(screen.getByText('continueWithGoogle'));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(2));
    expect(showAlert).not.toHaveBeenCalled();
  });
});

describe('Agent app — Google on the register screen', () => {
  it('is disabled until a role + type is chosen (hint shown)', () => {
    renderRegister();
    expect(screen.getByText('googleSelectRoleFirst')).toBeTruthy();
    fireEvent.press(screen.getByText('continueWithGoogle'));
    expect(signInWithGoogle).not.toHaveBeenCalled();
  });

  it('existing account → signs straight in', async () => {
    (signInWithGoogle as jest.Mock).mockResolvedValueOnce('id-token');
    authService.googleStart.mockResolvedValueOnce({ loggedIn: true, session: { user: { role: 'Agent' } } });
    renderRegister();
    fireEvent.press(screen.getByText('roleAgentSupplier'));
    fireEvent.press(screen.getByText('agentTypeGroupSupplier'));
    fireEvent.press(screen.getByText('continueWithGoogle'));
    await waitFor(() => expect(authService.googleStart).toHaveBeenCalledWith('id-token', 'agent-app'));
    expect(__auth.signIn).toHaveBeenCalledWith({ user: { role: 'Agent' } });
  });

  it('new person → phone step (name prefilled, no password fields) → OTP with the Google ticket + role + type', async () => {
    (signInWithGoogle as jest.Mock).mockResolvedValueOnce('id-token');
    authService.googleStart.mockResolvedValueOnce({ loggedIn: false, needsPhone: true, googleTicket: 'ticket-1', name: 'Asha Rao' });
    const nav = renderRegister();
    fireEvent.press(screen.getByText('roleJobSeeker'));
    fireEvent.press(screen.getByText('workerTypeSkilled'));
    fireEvent.press(screen.getByText('continueWithGoogle'));
    await waitFor(() => expect(screen.getByText('empGoogleSignedIn')).toBeTruthy());
    expect(screen.getByDisplayValue('Asha Rao')).toBeTruthy();
    expect(screen.queryByPlaceholderText('minSixChars')).toBeNull(); // no password for Google sign-ups

    fireEvent.changeText(screen.getByPlaceholderText('9876543210'), '9876543210');
    fireEvent.press(screen.getByText('sendOtpRegister'));
    await waitFor(() => expect(nav.navigate).toHaveBeenCalled());
    expect(authService.requestOtp).toHaveBeenCalled();
    expect(nav.navigate).toHaveBeenCalledWith('RegisterOtp', expect.objectContaining({
      googleTicket: 'ticket-1', phone: '9876543210', role: 'SelfWorker', name: 'Asha Rao', password: '', workerSubType: expect.any(String),
    }));
  });

  it('rejects a bad phone on the Google step', async () => {
    (signInWithGoogle as jest.Mock).mockResolvedValueOnce('id-token');
    authService.googleStart.mockResolvedValueOnce({ loggedIn: false, needsPhone: true, googleTicket: 't', name: 'Asha' });
    renderRegister();
    fireEvent.press(screen.getByText('roleJobSeeker'));
    fireEvent.press(screen.getByText('workerTypeSkilled'));
    fireEvent.press(screen.getByText('continueWithGoogle'));
    await waitFor(() => expect(screen.getByText('empGoogleSignedIn')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText('9876543210'), '123');
    fireEvent.press(screen.getByText('sendOtpRegister'));
    await waitFor(() => expect(showAlert).toHaveBeenCalled());
    expect(authService.requestOtp).not.toHaveBeenCalled();
  });

  it('OTP disabled by admin → creates the account directly via googleRegister (agent-app context)', async () => {
    __authFlags.registrationOtpEnabled = false;
    (signInWithGoogle as jest.Mock).mockResolvedValueOnce('id-token');
    authService.googleStart.mockResolvedValueOnce({ loggedIn: false, needsPhone: true, googleTicket: 'ticket-2', name: 'Raj' });
    renderRegister();
    fireEvent.press(screen.getByText('roleAgentSupplier'));
    fireEvent.press(screen.getByText('agentTypeGroupSupplier'));
    fireEvent.press(screen.getByText('continueWithGoogle'));
    await waitFor(() => expect(screen.getByText('empGoogleSignedIn')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText('9876543210'), '9123456780');
    fireEvent.press(screen.getByText('createAccount'));
    await waitFor(() => expect(authService.googleRegister).toHaveBeenCalled());
    expect(authService.googleRegister).toHaveBeenCalledWith(expect.objectContaining({
      googleTicket: 'ticket-2', phone: '9123456780', appContext: 'agent-app', role: 'Agent', agentType: 'Group worker supplier',
    }));
    expect(__auth.signIn).toHaveBeenCalled();
    __authFlags.registrationOtpEnabled = true;
  });
});
