/**
 * Unit tests for authService — OTP flow, registration, password login,
 * role auto-selection, role switching, dev mode bypass, logout.
 */
jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue('mock-token'),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

// Mock the API layer
jest.mock('../../core/api/endpoints/authApi', () => ({
  requestOtp: jest.fn(),
  verifyOtp: jest.fn(),
  verifyOtpOnly: jest.fn(),
  registerUser: jest.fn(),
  switchRoleApi: jest.fn(),
  loginWithPassword: jest.fn(),
}));
jest.mock('../../core/api/endpoints/notificationApi', () => ({
  notificationApi: {
    registerToken: jest.fn().mockResolvedValue(undefined),
    removeToken: jest.fn().mockResolvedValue(undefined),
  },
}));
// pushService is already mocked via moduleNameMapper in jest.config.js

import {
  requestOtp,
  verifyOtp,
  verifyOtpOnly,
  registerUser,
  switchRoleApi,
  loginWithPassword as loginWithPasswordApi,
} from '../../core/api/endpoints/authApi';
import { notificationApi } from '../../core/api/endpoints/notificationApi';
import { authService } from '../../features/auth/services/authService';

const mockRequestOtp   = requestOtp   as jest.Mock;
const mockVerifyOtp    = verifyOtp    as jest.Mock;
const mockVerifyOnly   = verifyOtpOnly as jest.Mock;
const mockRegister     = registerUser as jest.Mock;
const mockSwitchRole   = switchRoleApi as jest.Mock;
const mockLoginPwd     = loginWithPasswordApi as jest.Mock;
const mockRegisterToken = notificationApi.registerToken as jest.Mock;

// ── Fixtures ─────────────────────────────────────────────────────────────────

const user = {
  id: 'user-001',
  fullName: 'Ravi Agent',
  phone: '9876543210',
  role: 'agent' as const,
  kycStatus: 'verified' as const,
  language: 'en' as const,
};

const verifyOtpResponse = (role = 'agent', availableRoles?: string[]) => ({
  token: 'access-token',
  user: { ...user, role },
  availableRoles,
});

beforeEach(() => { jest.clearAllMocks(); });

// ── requestOtp ────────────────────────────────────────────────────────────────

describe('authService.requestOtp', () => {
  it('delegates to requestOtp API', async () => {
    mockRequestOtp.mockResolvedValue({ message: 'OTP sent' });
    const res = await authService.requestOtp('9999999999', 'agent', 'agent-app');
    expect(mockRequestOtp).toHaveBeenCalledWith({
      phone: '9999999999', roleHint: 'agent', appContext: 'agent-app',
    });
    expect(res.message).toBe('OTP sent');
  });

  it('works without roleHint and appContext', async () => {
    mockRequestOtp.mockResolvedValue({ message: 'OTP sent' });
    await authService.requestOtp('9999999999');
    expect(mockRequestOtp).toHaveBeenCalledWith({ phone: '9999999999', roleHint: undefined, appContext: undefined });
  });
});

// ── verifyOtp ─────────────────────────────────────────────────────────────────

describe('authService.verifyOtp', () => {
  it('returns AuthSession with correct structure', async () => {
    mockVerifyOtp.mockResolvedValue(verifyOtpResponse());
    const session = await authService.verifyOtp({ phone: '9876543210', otp: '112233' });
    expect(session.tokens.accessToken).toBe('access-token');
    expect(session.tokens.refreshToken).toBe('access-token');
    expect(session.user.role).toBe('agent');
    expect(session.onboardingCompleted).toBe(true);
    expect(session.tokens.expiresAt).toBeGreaterThan(Date.now());
  });

  it('registers push token when push service returns a token', async () => {
    mockVerifyOtp.mockResolvedValue(verifyOtpResponse());
    await authService.verifyOtp({ phone: '9876543210', otp: '112233' });
    expect(mockRegisterToken).toHaveBeenCalledWith('ExponentPushToken[mock-token]');
  });

  it('auto-selects highest priority role when multiple available and no roleHint', async () => {
    mockVerifyOtp.mockResolvedValue(verifyOtpResponse('selfworker', ['SelfWorker', 'Agent']));
    mockSwitchRole.mockResolvedValue({ token: 'agent-token', user: { ...user, role: 'agent' }, availableRoles: ['Agent', 'SelfWorker'] });

    const session = await authService.verifyOtp({ phone: '9876543210', otp: '112233' });
    expect(mockSwitchRole).toHaveBeenCalledWith('Agent', '9876543210');
    expect(session.tokens.accessToken).toBe('agent-token');
  });

  it('does NOT switch role when only one role available', async () => {
    mockVerifyOtp.mockResolvedValue(verifyOtpResponse('agent', ['Agent']));
    await authService.verifyOtp({ phone: '9876543210', otp: '112233' });
    expect(mockSwitchRole).not.toHaveBeenCalled();
  });

  it('does NOT switch role when roleHint is explicitly provided', async () => {
    mockVerifyOtp.mockResolvedValue(verifyOtpResponse('selfworker', ['SelfWorker', 'Agent']));
    await authService.verifyOtp({ phone: '9876543210', otp: '112233', roleHint: 'selfworker' });
    expect(mockSwitchRole).not.toHaveBeenCalled();
  });

  it('falls back to original session when role switch fails', async () => {
    mockVerifyOtp.mockResolvedValue(verifyOtpResponse('selfworker', ['SelfWorker', 'Agent']));
    mockSwitchRole.mockRejectedValue(new Error('Switch failed'));

    const session = await authService.verifyOtp({ phone: '9876543210', otp: '112233' });
    expect(session.user.role).toBe('selfworker'); // original role preserved
  });

  it('preserves availableRoles from switch response', async () => {
    mockVerifyOtp.mockResolvedValue(verifyOtpResponse('selfworker', ['SelfWorker', 'Agent']));
    mockSwitchRole.mockResolvedValue({
      token: 'agent-token',
      user: { ...user, role: 'agent' },
      availableRoles: ['Agent'],
    });

    const session = await authService.verifyOtp({ phone: '9876543210', otp: '112233' });
    expect(session.availableRoles).toEqual(['Agent']);
  });

  it('falls back to original availableRoles when switch response missing them', async () => {
    mockVerifyOtp.mockResolvedValue(verifyOtpResponse('selfworker', ['SelfWorker', 'Agent']));
    mockSwitchRole.mockResolvedValue({
      token: 'agent-token',
      user: { ...user, role: 'agent' },
      availableRoles: undefined,
    });

    const session = await authService.verifyOtp({ phone: '9876543210', otp: '112233' });
    expect(session.availableRoles).toEqual(['SelfWorker', 'Agent']);
  });

  it('does not throw even when push token registration fails', async () => {
    mockVerifyOtp.mockResolvedValue(verifyOtpResponse());
    mockRegisterToken.mockRejectedValue(new Error('Token registration failed'));
    await expect(authService.verifyOtp({ phone: '9876543210', otp: '112233' })).resolves.toBeDefined();
  });
});

// ── dev mode bypass (OTP 123456) ──────────────────────────────────────────────

describe('authService.verifyOtp — dev mode', () => {
  const g = global as unknown as { __DEV__: boolean };
  const originalDev = g.__DEV__;

  beforeAll(() => { g.__DEV__ = true; });
  afterAll(() => { g.__DEV__ = originalDev; });

  it('returns mock session for OTP 123456 in DEV mode', async () => {
    const session = await authService.verifyOtp({ phone: '9000000001', otp: '123456' });
    expect(session.tokens.accessToken).toBe('dev-access-token');
    expect(session.user.role).toBe('worker');
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });
});

// ── register ──────────────────────────────────────────────────────────────────

describe('authService.register', () => {
  it('calls registerUser API and resolves void', async () => {
    mockRegister.mockResolvedValue({ message: 'Registered' });
    await expect(authService.register({
      name: 'New Agent',
      phone: '9000000002',
      password: 'pass123',
      role: 'Agent',
    })).resolves.toBeUndefined();
    expect(mockRegister).toHaveBeenCalledWith({
      name: 'New Agent', phone: '9000000002', password: 'pass123', role: 'Agent',
    });
  });

  it('throws when registration fails', async () => {
    mockRegister.mockRejectedValue(Object.assign(new Error('Phone exists'), { statusCode: 400 }));
    await expect(authService.register({ name: 'A', phone: '9', password: 'p', role: 'Agent' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

// ── verifyOtpForRegistration ──────────────────────────────────────────────────

describe('authService.verifyOtpForRegistration', () => {
  it('calls verifyOtpOnly for normal OTP', async () => {
    mockVerifyOnly.mockResolvedValue({ success: true });
    await authService.verifyOtpForRegistration('9000000003', '112233');
    expect(mockVerifyOnly).toHaveBeenCalledWith('9000000003', '112233');
  });

  it('skips API call for dev OTP 123456', async () => {
    const gRef = global as unknown as { __DEV__: boolean };
    const originalDev = gRef.__DEV__;
    gRef.__DEV__ = true;
    await authService.verifyOtpForRegistration('9000000003', '123456');
    expect(mockVerifyOnly).not.toHaveBeenCalled();
    gRef.__DEV__ = originalDev;
  });

  it('throws on wrong OTP', async () => {
    mockVerifyOnly.mockRejectedValue(new Error('Invalid OTP'));
    await expect(authService.verifyOtpForRegistration('9000000003', 'wrong'))
      .rejects.toThrow('Invalid OTP');
  });
});

// ── loginWithPassword ─────────────────────────────────────────────────────────

describe('authService.loginWithPassword', () => {
  it('returns AuthSession on successful password login', async () => {
    mockLoginPwd.mockResolvedValue({ token: 'pwd-token', user, availableRoles: ['Agent'] });
    const session = await authService.loginWithPassword('9876543210', 'secret');
    expect(session.tokens.accessToken).toBe('pwd-token');
    expect(session.user.role).toBe('agent');
    expect(session.availableRoles).toEqual(['Agent']);
  });

  it('registers push token after password login', async () => {
    mockLoginPwd.mockResolvedValue({ token: 'tok', user });
    await authService.loginWithPassword('9876543210', 'secret');
    expect(mockRegisterToken).toHaveBeenCalled();
  });

  it('passes roleHint and appContext to loginWithPasswordApi', async () => {
    mockLoginPwd.mockResolvedValue({ token: 'tok', user });
    await authService.loginWithPassword('9876543210', 'secret', 'agent', 'agent-app');
    expect(mockLoginPwd).toHaveBeenCalledWith({
      phone: '9876543210', password: 'secret', roleHint: 'agent', appContext: 'agent-app',
    });
  });

  it('throws on wrong password', async () => {
    mockLoginPwd.mockRejectedValue(Object.assign(new Error('Invalid credentials'), { statusCode: 401 }));
    await expect(authService.loginWithPassword('9876543210', 'wrong'))
      .rejects.toMatchObject({ statusCode: 401 });
  });
});

// ── loginAfterRegister ────────────────────────────────────────────────────────

describe('authService.loginAfterRegister', () => {
  it('logs in via OTP after registration and returns session', async () => {
    mockVerifyOtp.mockResolvedValue(verifyOtpResponse());
    const session = await authService.loginAfterRegister('9876543210', '112233');
    expect(session.tokens.accessToken).toBe('access-token');
    expect(session.onboardingCompleted).toBe(true);
  });

  it('registers push token after registration login', async () => {
    mockVerifyOtp.mockResolvedValue(verifyOtpResponse());
    await authService.loginAfterRegister('9876543210', '112233', 'agent');
    expect(mockRegisterToken).toHaveBeenCalled();
  });
});

// ── switchRole ────────────────────────────────────────────────────────────────

describe('authService.switchRole', () => {
  it('switches role and returns new session', async () => {
    mockSwitchRole.mockResolvedValue({
      token: 'sw-token',
      user: { ...user, role: 'selfworker' },
      availableRoles: ['SelfWorker', 'Agent'],
    });
    const session = await authService.switchRole('SelfWorker', '9876543210');
    expect(session.tokens.accessToken).toBe('sw-token');
    expect(session.user.role).toBe('selfworker');
    expect(session.availableRoles).toEqual(['SelfWorker', 'Agent']);
  });

  it('throws on role switch failure', async () => {
    mockSwitchRole.mockRejectedValue(new Error('Role switch failed.'));
    await expect(authService.switchRole('Admin'))
      .rejects.toThrow('Role switch failed.');
  });
});

// ── logout ────────────────────────────────────────────────────────────────────

describe('authService.logout', () => {
  it('removes notification token and calls logout API', async () => {
    const removeToken = notificationApi.removeToken as jest.Mock;
    removeToken.mockResolvedValue(undefined);

    await expect(authService.logout()).resolves.toBeUndefined();
    expect(removeToken).toHaveBeenCalled();
  });

  it('completes even if removeToken throws', async () => {
    (notificationApi.removeToken as jest.Mock).mockRejectedValue(new Error('Token error'));
    await expect(authService.logout()).resolves.toBeUndefined();
  });
});
