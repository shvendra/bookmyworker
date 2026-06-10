import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { AgentRegisterScreen } from '../screens/auth/AgentRegisterScreen';
import { AGENT_LANG_KEY } from '../screens/language/LanguageSelectScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from './__mocks__/shared/authService';
import { showAlert } from './__mocks__/shared/appAlert';
import { __themeState } from './__mocks__/shared/theme';
import { getDocumentAsync } from './__mocks__/documentPicker';

const makeNav = () => ({ navigate: jest.fn() });

const renderScreen = (navigation = makeNav()) => {
  render(
    <AgentRegisterScreen
      navigation={navigation as never}
      route={{ key: 'Register', name: 'Register' } as never}
    />,
  );
  return navigation;
};

const originalOS = Platform.OS;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  __themeState.mode = 'light';
  (Platform as { OS: string }).OS = originalOS;
  (globalThis as Record<string, unknown>).__i18nEmpty = [];
  authService.requestOtp.mockResolvedValue(undefined);
  (getDocumentAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///resume.pdf', name: 'resume.pdf' }],
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const selectSelfWorker = () => fireEvent.press(screen.getByText('roleJobSeeker'));
const selectAgent = () => fireEvent.press(screen.getByText('roleAgentSupplier'));

const goToStep2AsWorker = (subTypeKey = 'workerTypeSkilled') => {
  selectSelfWorker();
  fireEvent.press(screen.getByText(subTypeKey));
  fireEvent.press(screen.getByText('continueBtn'));
};

const fillForm = (over: Partial<Record<string, string>> = {}) => {
  fireEvent.changeText(screen.getByPlaceholderText('enterFullName'), over.name ?? 'Ravi Kumar');
  fireEvent.changeText(screen.getByPlaceholderText('9876543210'), over.phone ?? '9876543210');
  fireEvent.changeText(screen.getByPlaceholderText('minSixChars'), over.password ?? 'secret1');
  fireEvent.changeText(screen.getByPlaceholderText('reEnterPassword'), over.confirm ?? 'secret1');
};

describe('AgentRegisterScreen — step 1 (role + sub-type)', () => {
  it('renders the role chooser and the two roles', () => {
    renderScreen();
    expect(screen.getByText('whoAreYou')).toBeTruthy();
    expect(screen.getByText('roleJobSeeker')).toBeTruthy();
    expect(screen.getByText('roleAgentSupplier')).toBeTruthy();
  });

  it('shows the worker sub-type grid when SelfWorker is selected', () => {
    renderScreen();
    selectSelfWorker();
    expect(screen.getByText('myWorkType')).toBeTruthy();
    expect(screen.getByText('workerTypeSkilled')).toBeTruthy();
    expect(screen.getByText('workerTypeITI')).toBeTruthy();
  });

  it('shows the agent-type list when Agent is selected', () => {
    renderScreen();
    selectAgent();
    expect(screen.getByText('myRoleAsAgent')).toBeTruthy();
    expect(screen.getByText('agentTypeGroupSupplier')).toBeTruthy();
  });

  it('hides the Continue button until a sub-type is chosen', () => {
    renderScreen();
    expect(screen.queryByText('continueBtn')).toBeNull();
    selectSelfWorker();
    expect(screen.queryByText('continueBtn')).toBeNull(); // role only — not enough
    fireEvent.press(screen.getByText('workerTypeSkilled'));
    expect(screen.getByText('continueBtn')).toBeTruthy();
  });

  it('resets the sub-type when switching roles', () => {
    renderScreen();
    selectSelfWorker();
    fireEvent.press(screen.getByText('workerTypeSkilled'));
    expect(screen.getByText('continueBtn')).toBeTruthy();
    selectAgent(); // onSelectRole clears the worker sub-type
    expect(screen.queryByText('continueBtn')).toBeNull();
  });

  it('navigates to Login from the sign-in link', () => {
    const nav = renderScreen();
    fireEvent.press(screen.getByText('signIn'));
    expect(nav.navigate).toHaveBeenCalledWith('Login');
  });

  it('advances to step 2 from a valid worker selection', () => {
    renderScreen();
    goToStep2AsWorker();
    expect(screen.getByText('yourDetails')).toBeTruthy();
  });

  it('advances to step 2 from a valid agent selection', () => {
    renderScreen();
    selectAgent();
    fireEvent.press(screen.getByText('agentTypeGroupSupplier'));
    fireEvent.press(screen.getByText('continueBtn'));
    expect(screen.getByText('yourDetails')).toBeTruthy();
  });

  it('renders step 1 in dark mode', () => {
    __themeState.mode = 'dark';
    renderScreen();
    selectAgent();
    expect(screen.getByText('agentTypeGroupSupplier')).toBeTruthy();
  });
});

describe('AgentRegisterScreen — resume upload (ITI / Graduate)', () => {
  it('shows the resume row for an ITI/Diploma worker and uploads a file', async () => {
    renderScreen();
    selectSelfWorker();
    fireEvent.press(screen.getByText('workerTypeITI'));
    expect(screen.getByText('Upload Resume / CV')).toBeTruthy();

    fireEvent.press(screen.getByText('Upload Resume / CV'));
    await waitFor(() => {
      expect(screen.getByText('Resume Uploaded ✓')).toBeTruthy();
    });
    expect(screen.getByText('resume.pdf')).toBeTruthy();
  });

  it('clears an uploaded resume', async () => {
    renderScreen();
    selectSelfWorker();
    fireEvent.press(screen.getByText('workerTypeGraduate'));
    fireEvent.press(screen.getByText('Upload Resume / CV'));
    await waitFor(() => expect(screen.getByText('Resume Uploaded ✓')).toBeTruthy());

    fireEvent.press(screen.getByText('✕'));
    expect(screen.getByText('Upload Resume / CV')).toBeTruthy();
  });

  it('ignores a cancelled document pick', async () => {
    (getDocumentAsync as jest.Mock).mockResolvedValueOnce({ canceled: true, assets: [] });
    renderScreen();
    selectSelfWorker();
    fireEvent.press(screen.getByText('workerTypeITI'));
    fireEvent.press(screen.getByText('Upload Resume / CV'));
    await waitFor(() => expect(getDocumentAsync).toHaveBeenCalled());
    expect(screen.getByText('Upload Resume / CV')).toBeTruthy();
  });

  it('alerts when the document picker throws', async () => {
    (getDocumentAsync as jest.Mock).mockRejectedValueOnce(new Error('picker boom'));
    renderScreen();
    selectSelfWorker();
    fireEvent.press(screen.getByText('workerTypeITI'));
    fireEvent.press(screen.getByText('Upload Resume / CV'));
    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith('Error', 'Could not pick file. Try again.');
    });
  });
});

describe('AgentRegisterScreen — step 2 (details form)', () => {
  it('submits valid details, requests OTP and navigates to RegisterOtp', async () => {
    await AsyncStorage.setItem(AGENT_LANG_KEY, 'hi');
    const nav = renderScreen();
    goToStep2AsWorker();
    fillForm();
    fireEvent.press(screen.getByText('sendOtpRegister'));

    await waitFor(() => {
      expect(authService.requestOtp).toHaveBeenCalledWith('9876543210', undefined);
    });
    expect(nav.navigate).toHaveBeenCalledWith(
      'RegisterOtp',
      expect.objectContaining({
        phone: '9876543210',
        role: 'SelfWorker',
        name: 'Ravi Kumar',
        password: 'secret1',
        language: 'hi',
        workerSubType: 'Skilled',
      }),
    );
  });

  it('passes agentType through for an agent registration', async () => {
    const nav = renderScreen();
    selectAgent();
    fireEvent.press(screen.getByText('agentTypeGroupSupplier'));
    fireEvent.press(screen.getByText('continueBtn'));
    fillForm();
    fireEvent.press(screen.getByText('sendOtpRegister'));

    await waitFor(() => {
      expect(nav.navigate).toHaveBeenCalledWith(
        'RegisterOtp',
        expect.objectContaining({ role: 'Agent', agentType: 'Group worker supplier' }),
      );
    });
  });

  it('uses undefined language when none was saved', async () => {
    const nav = renderScreen();
    goToStep2AsWorker();
    fillForm();
    fireEvent.press(screen.getByText('sendOtpRegister'));
    await waitFor(() => {
      expect(nav.navigate).toHaveBeenCalledWith(
        'RegisterOtp',
        expect.objectContaining({ language: undefined }),
      );
    });
  });

  it('shows validation errors and does not submit when fields are invalid', async () => {
    const nav = renderScreen();
    goToStep2AsWorker();
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
    goToStep2AsWorker();
    fillForm();
    fireEvent.press(screen.getByText('sendOtpRegister'));
    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith('Error', 'network down');
    });
  });

  it('falls back to a generic message when OTP failure is not an Error', async () => {
    authService.requestOtp.mockRejectedValueOnce('boom');
    renderScreen();
    goToStep2AsWorker();
    fillForm();
    fireEvent.press(screen.getByText('sendOtpRegister'));
    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith('Error', 'Failed to send OTP');
    });
  });

  it('goes back to step 1 with the back button', () => {
    renderScreen();
    goToStep2AsWorker();
    fireEvent.press(screen.getByText('←'));
    expect(screen.getByText('whoAreYou')).toBeTruthy();
  });

  it('navigates to Login from the step 2 sign-in link', () => {
    const nav = renderScreen();
    goToStep2AsWorker();
    fireEvent.press(screen.getByText('signIn'));
    expect(nav.navigate).toHaveBeenCalledWith('Login');
  });

  it('renders step 2 in dark mode', () => {
    __themeState.mode = 'dark';
    renderScreen();
    goToStep2AsWorker();
    expect(screen.getByText('yourDetails')).toBeTruthy();
  });

  it('uses the android keyboard behavior on step 2', () => {
    (Platform as { OS: string }).OS = 'android';
    renderScreen();
    goToStep2AsWorker();
    expect(screen.getByText('yourDetails')).toBeTruthy();
  });
});
