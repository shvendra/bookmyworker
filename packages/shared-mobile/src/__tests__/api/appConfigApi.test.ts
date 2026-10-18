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
    expect(cfg.authFlags).toEqual({ registrationOtpEnabled: true, loginOtpEnabled: true, otpChannel: 'whatsapp', otpPrimary: 'whatsapp', otpAlternate: null, otpCanChoose: false, otpUnavailable: false });
  });

  it('maps explicit false values from settings.auth', async () => {
    mock.onGet('/api/v1/settings/public').reply(200, {
      success: true,
      data: { auth: { registrationOtpEnabled: false, loginOtpEnabled: true, otpChannel: 'whatsapp', otpPrimary: 'whatsapp', otpAlternate: null, otpCanChoose: false, otpUnavailable: false } },
    });
    const cfg = await fetchAppConfig();
    expect(cfg.authFlags).toEqual({ registrationOtpEnabled: false, loginOtpEnabled: true, otpChannel: 'whatsapp', otpPrimary: 'whatsapp', otpAlternate: null, otpCanChoose: false, otpUnavailable: false });
  });

  it('treats only an explicit false as disabled', async () => {
    mock.onGet('/api/v1/settings/public').reply(200, {
      success: true,
      data: { auth: { loginOtpEnabled: false } },
    });
    const cfg = await fetchAppConfig();
    expect(cfg.authFlags).toEqual({ registrationOtpEnabled: true, loginOtpEnabled: false, otpChannel: 'whatsapp', otpPrimary: 'whatsapp', otpAlternate: null, otpCanChoose: false, otpUnavailable: false });
  });

  it('reads the OTP mode (older backend: only an explicit "sms" / "user" counts)', async () => {
    mock.onGet('/api/v1/settings/public').reply(200, { success: true, data: { auth: { otpChannel: 'sms' } } });
    expect((await fetchAppConfig()).authFlags).toMatchObject({ otpChannel: 'sms', otpPrimary: 'sms', otpAlternate: null });
    mock.onGet('/api/v1/settings/public').reply(200, { success: true, data: { auth: { otpChannel: 'user' } } });
    expect((await fetchAppConfig()).authFlags).toMatchObject({ otpChannel: 'user', otpCanChoose: true, otpAlternate: 'sms' });
    mock.onGet('/api/v1/settings/public').reply(200, { success: true, data: { auth: { otpChannel: 'voice' } } });
    expect((await fetchAppConfig()).authFlags.otpChannel).toBe('whatsapp');
  });

  it('reads the live OTP availability the server reports', async () => {
    mock.onGet('/api/v1/settings/public').reply(200, {
      success: true,
      data: { auth: { otpChannel: 'whatsapp', otpPrimary: 'whatsapp', otpAlternate: 'sms', otpCanChoose: false, otpUnavailable: false } },
    });
    expect((await fetchAppConfig()).authFlags).toMatchObject({ otpPrimary: 'whatsapp', otpAlternate: 'sms' });
    mock.onGet('/api/v1/settings/public').reply(200, {
      success: true,
      data: { auth: { otpChannel: 'whatsapp', otpPrimary: null, otpAlternate: null, otpCanChoose: false, otpUnavailable: true } },
    });
    expect((await fetchAppConfig()).authFlags).toMatchObject({ otpPrimary: null, otpAlternate: null, otpUnavailable: true });
  });
});
