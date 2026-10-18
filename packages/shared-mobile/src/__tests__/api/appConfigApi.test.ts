/**
 * Unit tests for appConfigApi.fetchAppConfig — focused on the SuperAdmin auth
 * toggles (registration / login OTP) mapped from GET /api/v1/settings/public.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { fetchAppConfig } from '../../core/api/endpoints/appConfigApi';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

describe('appConfigApi.fetchAppConfig — authFlags', () => {
  it('defaults both flags to enabled when settings omit the auth object', async () => {
    mock.onGet('/api/v1/settings/public').reply(200, { success: true, data: {} });
    const cfg = await fetchAppConfig();
    expect(cfg.authFlags).toEqual({ registrationOtpEnabled: true, loginOtpEnabled: true, otpChannel: 'whatsapp' });
  });

  it('maps explicit false values from settings.auth', async () => {
    mock.onGet('/api/v1/settings/public').reply(200, {
      success: true,
      data: { auth: { registrationOtpEnabled: false, loginOtpEnabled: true, otpChannel: 'whatsapp' } },
    });
    const cfg = await fetchAppConfig();
    expect(cfg.authFlags).toEqual({ registrationOtpEnabled: false, loginOtpEnabled: true, otpChannel: 'whatsapp' });
  });

  it('treats only an explicit false as disabled', async () => {
    mock.onGet('/api/v1/settings/public').reply(200, {
      success: true,
      data: { auth: { loginOtpEnabled: false } },
    });
    const cfg = await fetchAppConfig();
    expect(cfg.authFlags).toEqual({ registrationOtpEnabled: true, loginOtpEnabled: false, otpChannel: 'whatsapp' });
  });

  it('reads the OTP channel: only an explicit "sms" selects SMS', async () => {
    mock.onGet('/api/v1/settings/public').reply(200, { success: true, data: { auth: { otpChannel: 'sms' } } });
    expect((await fetchAppConfig()).authFlags.otpChannel).toBe('sms');
    mock.onGet('/api/v1/settings/public').reply(200, { success: true, data: { auth: { otpChannel: 'voice' } } });
    expect((await fetchAppConfig()).authFlags.otpChannel).toBe('whatsapp');
  });
});
