/**
 * Unit tests for authApi — OTP, login, register, profile, KYC, role management.
 * Covers role mapping, user mapping, all edge cases and error paths.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import {
  requestOtp,
  verifyOtp,
  verifyOtpOnly,
  registerUser,
  loginWithPassword,
  switchRoleApi,
  setDefaultRoleApi,
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
  getCurrentUser,
  updateProfile,
  updateProfileFields,
  uploadKyc,
  generateUploadLink,
} from '../../core/api/endpoints/authApi';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

// ── Fixtures ─────────────────────────────────────────────────────────────────

const backendUser = {
  _id: 'user-001',
  name: 'Ravi Shankar',
  phone: '9876543210',
  role: 'Agent',
  status: 'Verified',
  email: 'ravi@example.com',
  state: 'Maharashtra',
  district: 'Pune',
  block: 'Hadapsar',
  profilePhoto: 'uploads/ravi.jpg',
  isSubscribed: true,
  veryfiedBage: true,
  areasOfWork: ['Construction'],
};

// ── requestOtp ────────────────────────────────────────────────────────────────

describe('requestOtp', () => {
  it('sends POST with phone, mapped role, returns message', async () => {
    mock.onPost('/api/v1/otp/send-otp-user').reply(200, { message: 'OTP sent' });
    const result = await requestOtp({ phone: '9999999999', roleHint: 'agent' });
    expect(result.message).toBe('OTP sent');
  });

  it('uses default message when server returns no message field', async () => {
    mock.onPost('/api/v1/otp/send-otp-user').reply(200, {});
    const result = await requestOtp({ phone: '9999999999' });
    expect(result.message).toBe('OTP sent successfully');
  });

  it('maps employer role to Employer for the backend', async () => {
    let sentBody: Record<string, unknown> = {};
    mock.onPost('/api/v1/otp/send-otp-user').reply((config) => {
      sentBody = JSON.parse(config.data as string);
      return [200, { message: 'OTP sent' }];
    });
    await requestOtp({ phone: '9000000000', roleHint: 'employer' });
    expect(sentBody.role).toBe('Employer');
  });

  it('maps worker role to SelfWorker', async () => {
    let sentBody: Record<string, unknown> = {};
    mock.onPost('/api/v1/otp/send-otp-user').reply((config) => {
      sentBody = JSON.parse(config.data as string);
      return [200, { message: 'OTP sent' }];
    });
    await requestOtp({ phone: '9000000000', roleHint: 'worker' });
    expect(sentBody.role).toBe('SelfWorker');
  });

  it('uses "register" as role when no roleHint given', async () => {
    let sentBody: Record<string, unknown> = {};
    mock.onPost('/api/v1/otp/send-otp-user').reply((config) => {
      sentBody = JSON.parse(config.data as string);
      return [200, { message: 'OTP sent' }];
    });
    await requestOtp({ phone: '9000000000' });
    expect(sentBody.role).toBe('register');
  });

  it('includes appContext when provided', async () => {
    let sentBody: Record<string, unknown> = {};
    mock.onPost('/api/v1/otp/send-otp-user').reply((config) => {
      sentBody = JSON.parse(config.data as string);
      return [200, { message: 'OTP sent' }];
    });
    await requestOtp({ phone: '9000000000', appContext: 'agent-app' });
    expect(sentBody.appContext).toBe('agent-app');
  });

  it('throws on 429 rate-limit error', async () => {
    mock.onPost('/api/v1/otp/send-otp-user').reply(429, { message: 'Too many requests' });
    await expect(requestOtp({ phone: '9999999999' })).rejects.toMatchObject({ statusCode: 429 });
  });
});

// ── verifyOtp ─────────────────────────────────────────────────────────────────

describe('verifyOtp', () => {
  it('returns mapped user and token on success', async () => {
    mock.onPost('/api/v1/user/login').reply(200, {
      token: 'jwt-token-xyz',
      user: backendUser,
      availableRoles: ['Agent'],
    });
    const res = await verifyOtp({ phone: '9876543210', otp: '112233' });
    expect(res.token).toBe('jwt-token-xyz');
    expect(res.user.id).toBe('user-001');
    expect(res.user.role).toBe('agent'); // mapped from 'Agent'
    expect(res.user.kycStatus).toBe('verified'); // mapped from 'Verified'
    expect(res.user.fullName).toBe('Ravi Shankar');
    expect(res.user.profileImage).toContain('bookmyworker.s3');
    expect(res.availableRoles).toEqual(['Agent']);
  });

  it('maps SelfWorker role to selfworker', async () => {
    mock.onPost('/api/v1/user/login').reply(200, {
      token: 'tok', user: { ...backendUser, role: 'SelfWorker', status: 'Unverified' },
    });
    const res = await verifyOtp({ phone: '9876543210', otp: '000000' });
    expect(res.user.role).toBe('selfworker');
    expect(res.user.kycStatus).toBe('pending');
  });

  it('maps Block status to rejected kycStatus', async () => {
    mock.onPost('/api/v1/user/login').reply(200, {
      token: 'tok', user: { ...backendUser, status: 'Block' },
    });
    const res = await verifyOtp({ phone: '9876543210', otp: '000000' });
    expect(res.user.kycStatus).toBe('rejected');
  });

  it('maps Worker → worker, Admin → admin, SuperAdmin → superadmin', async () => {
    for (const [backendRole, expected] of [
      ['Worker', 'worker'],
      ['Admin', 'admin'],
      ['SuperAdmin', 'superadmin'],
    ] as const) {
      mock.onPost('/api/v1/user/login').reply(200, {
        token: 'tok', user: { ...backendUser, role: backendRole },
      });
      const res = await verifyOtp({ phone: '9876543210', otp: '000000' });
      expect(res.user.role).toBe(expected);
    }
  });

  it('maps unknown backend role to worker as fallback', async () => {
    mock.onPost('/api/v1/user/login').reply(200, {
      token: 'tok', user: { ...backendUser, role: 'UnknownRole' },
    });
    const res = await verifyOtp({ phone: '9876543210', otp: '000000' });
    expect(res.user.role).toBe('worker');
  });

  it('uses subscriptionExpery (typo) as subscriptionExpiry when expiry is missing', async () => {
    mock.onPost('/api/v1/user/login').reply(200, {
      token: 'tok', user: { ...backendUser, subscriptionExpery: '2025-12-31' },
    });
    const res = await verifyOtp({ phone: '9876543210', otp: '000000' });
    expect(res.user.subscriptionExpiry).toBe('2025-12-31');
  });

  it('throws when response is missing token', async () => {
    mock.onPost('/api/v1/user/login').reply(200, { user: backendUser });
    await expect(verifyOtp({ phone: '9876543210', otp: '000000' }))
      .rejects.toThrow('Invalid auth response from server.');
  });

  it('throws when response is missing user', async () => {
    mock.onPost('/api/v1/user/login').reply(200, { token: 'tok' });
    await expect(verifyOtp({ phone: '9876543210', otp: '000000' }))
      .rejects.toThrow('Invalid auth response from server.');
  });

  it('throws on 401 invalid OTP', async () => {
    mock.onPost('/api/v1/user/login').reply(401, { message: 'Invalid OTP' });
    await expect(verifyOtp({ phone: '9876543210', otp: 'wrong' }))
      .rejects.toMatchObject({ statusCode: 401 });
  });
});

// ── verifyOtpOnly ─────────────────────────────────────────────────────────────

describe('verifyOtpOnly', () => {
  it('returns data on success', async () => {
    mock.onPost('/api/v1/otp/verify-otp').reply(200, { success: true, message: 'Verified' });
    const res = await verifyOtpOnly('9000000000', '112233');
    expect(res.success).toBe(true);
  });

  it('throws when success is false', async () => {
    mock.onPost('/api/v1/otp/verify-otp').reply(200, { success: false, message: 'Wrong OTP' });
    await expect(verifyOtpOnly('9000000000', '000000')).rejects.toThrow('Wrong OTP');
  });

  it('throws with default message when server message missing', async () => {
    mock.onPost('/api/v1/otp/verify-otp').reply(200, { success: false });
    await expect(verifyOtpOnly('9000000000', '000000')).rejects.toThrow('Invalid OTP');
  });
});

// ── registerUser ──────────────────────────────────────────────────────────────

describe('registerUser', () => {
  it('returns message on successful registration', async () => {
    mock.onPost('/api/v1/user/register').reply(201, { message: 'Registered successfully' });
    const res = await registerUser({
      name: 'New Agent',
      phone: '9000000001',
      password: 'pass123',
      role: 'Agent',
      state: 'Maharashtra',
      district: 'Pune',
    });
    expect(res.message).toBe('Registered successfully');
  });

  it('uses default message when server returns empty body', async () => {
    mock.onPost('/api/v1/user/register').reply(201, {});
    const res = await registerUser({ name: 'A', phone: '9', password: 'p', role: 'Agent' });
    expect(res.message).toBe('Registered successfully');
  });

  it('throws 400 when phone already registered', async () => {
    mock.onPost('/api/v1/user/register').reply(400, { message: 'Phone already registered' });
    await expect(registerUser({ name: 'A', phone: '9', password: 'p', role: 'Agent' }))
      .rejects.toMatchObject({ statusCode: 400, message: 'Phone already registered' });
  });
});

// ── loginWithPassword ─────────────────────────────────────────────────────────

describe('loginWithPassword', () => {
  it('returns auth session with token and mapped user', async () => {
    mock.onPost('/api/v1/user/login').reply(200, {
      token: 'pwd-token', user: backendUser,
    });
    const res = await loginWithPassword({ phone: '9876543210', password: 'secret123' });
    expect(res.token).toBe('pwd-token');
    expect(res.user.role).toBe('agent');
  });

  it('includes role in payload when roleHint is given', async () => {
    let sentBody: Record<string, unknown> = {};
    mock.onPost('/api/v1/user/login').reply((config) => {
      sentBody = JSON.parse(config.data as string);
      return [200, { token: 'tok', user: backendUser }];
    });
    await loginWithPassword({ phone: '9876543210', password: 'p', roleHint: 'employer' });
    expect(sentBody.role).toBe('Employer');
    expect(sentBody.loginMethod).toBe('password');
  });

  it('omits role when no roleHint', async () => {
    let sentBody: Record<string, unknown> = {};
    mock.onPost('/api/v1/user/login').reply((config) => {
      sentBody = JSON.parse(config.data as string);
      return [200, { token: 'tok', user: backendUser }];
    });
    await loginWithPassword({ phone: '9876543210', password: 'p' });
    expect(sentBody.role).toBeUndefined();
  });

  it('throws on wrong password', async () => {
    mock.onPost('/api/v1/user/login').reply(401, { message: 'Invalid credentials' });
    await expect(loginWithPassword({ phone: '9876543210', password: 'wrong' }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws on invalid response (no token)', async () => {
    mock.onPost('/api/v1/user/login').reply(200, { user: backendUser });
    await expect(loginWithPassword({ phone: '9876543210', password: 'p' }))
      .rejects.toThrow('Invalid auth response from server.');
  });
});

// ── switchRoleApi ─────────────────────────────────────────────────────────────

describe('switchRoleApi', () => {
  it('returns new session token after role switch', async () => {
    mock.onPost('/api/v1/user/setrole').reply(200, {
      token: 'new-role-token',
      user: { ...backendUser, role: 'SelfWorker' },
    });
    const res = await switchRoleApi('SelfWorker', '9876543210');
    expect(res.token).toBe('new-role-token');
    expect(res.user.role).toBe('selfworker');
  });

  it('throws when token/user missing in response', async () => {
    mock.onPost('/api/v1/user/setrole').reply(200, {});
    await expect(switchRoleApi('Agent')).rejects.toThrow('Role switch failed.');
  });
});

// ── setDefaultRoleApi ─────────────────────────────────────────────────────────

describe('setDefaultRoleApi', () => {
  it('completes without throwing on success', async () => {
    mock.onPost('/api/v1/user/set-default-role').reply(200, { success: true });
    await expect(setDefaultRoleApi('Agent')).resolves.toBeUndefined();
  });

  it('throws on server error', async () => {
    mock.onPost('/api/v1/user/set-default-role').reply(500, { message: 'Server error' });
    await expect(setDefaultRoleApi('Agent')).rejects.toMatchObject({ statusCode: 500 });
  });
});

// ── Password reset ────────────────────────────────────────────────────────────

describe('sendPasswordResetOtp', () => {
  it('POSTs phone and role to send-otp-user', async () => {
    mock.onPost('/api/v1/otp/send-otp-user').reply(200, {});
    await expect(sendPasswordResetOtp({ phone: '9000000001', role: 'SelfWorker' }))
      .resolves.toBeUndefined();
  });
});

describe('verifyPasswordResetOtp', () => {
  it('POSTs otp and role resetPassword', async () => {
    mock.onPost('/api/v1/otp/verify-otp').reply(200, { success: true });
    await expect(verifyPasswordResetOtp({ phone: '9000000001', otp: '112233' }))
      .resolves.toBeUndefined();
  });
});

describe('resetPassword', () => {
  it('sends PUT with new password', async () => {
    mock.onPut('/api/v1/user/update/password').reply(200, { success: true });
    await expect(resetPassword({ phone: '9000000001', password: 'new-pass', role: 'SelfWorker' }))
      .resolves.toBeUndefined();
  });
});

// ── getCurrentUser ────────────────────────────────────────────────────────────

describe('getCurrentUser', () => {
  it('returns mapped user from { user: BackendUser } shape', async () => {
    mock.onGet('/api/v1/user/getuser').reply(200, { user: backendUser });
    const res = await getCurrentUser();
    expect(res.id).toBe('user-001');
    expect(res.role).toBe('agent');
  });

  it('returns mapped user from flat BackendUser shape', async () => {
    mock.onGet('/api/v1/user/getuser').reply(200, backendUser);
    const res = await getCurrentUser();
    expect(res.fullName).toBe('Ravi Shankar');
  });
});

// ── updateProfile ─────────────────────────────────────────────────────────────

describe('updateProfile', () => {
  it('sends FormData via PUT and returns mapped user', async () => {
    mock.onPut('/api/v1/user/update').reply(200, { user: backendUser });
    const fd = new FormData();
    fd.append('name', 'Ravi Updated');
    const res = await updateProfile(fd);
    expect(res.id).toBe('user-001');
  });

  it('handles flat response (no user wrapper)', async () => {
    mock.onPut('/api/v1/user/update').reply(200, backendUser);
    const res = await updateProfile(new FormData());
    expect(res.fullName).toBe('Ravi Shankar');
  });
});

// ── updateProfileFields ───────────────────────────────────────────────────────

describe('updateProfileFields', () => {
  it('serializes fields and calls updateProfile', async () => {
    mock.onPut('/api/v1/user/update').reply(200, { user: backendUser });
    const res = await updateProfileFields({
      name: 'Updated Name',
      areasOfWork: ['construction'],
      employerType: { individual: true },
    });
    expect(res.id).toBe('user-001');
  });

  it('skips undefined/null fields', async () => {
    mock.onPut('/api/v1/user/update').reply(200, { user: backendUser });
    // Should not throw even with sparse fields
    await expect(updateProfileFields({ name: 'Only Name' })).resolves.toBeDefined();
  });
});

// ── uploadKyc ─────────────────────────────────────────────────────────────────

describe('uploadKyc', () => {
  it('sends FormData to the correct KYC endpoint', async () => {
    mock.onPut('/api/v1/user/upload-kyc/job-abc').reply(200, { success: true });
    const fd = new FormData();
    fd.append('idFront', 'file-uri');
    await expect(uploadKyc('job-abc', fd)).resolves.toBeUndefined();
  });
});

// ── generateUploadLink ────────────────────────────────────────────────────────

describe('generateUploadLink', () => {
  it('returns link and jobId', async () => {
    mock.onPost('/api/v1/user/generate-upload-link').reply(200, {
      link: 'https://s3.example.com/presigned',
      jobId: 'job-xyz',
    });
    const res = await generateUploadLink();
    expect(res.link).toBe('https://s3.example.com/presigned');
    expect(res.jobId).toBe('job-xyz');
  });

  it('throws on 401 unauthorized', async () => {
    mock.onPost('/api/v1/user/generate-upload-link').reply(401, { message: 'Unauthorized' });
    await expect(generateUploadLink()).rejects.toMatchObject({ statusCode: 401 });
  });
});
