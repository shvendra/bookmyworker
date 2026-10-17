/**
 * An expired/invalid JWT must sign the user out — whether the backend answers
 * 401 (current) or 400 "Json Web Token is expired" (older backend). Otherwise the
 * app stays "logged in" with a dead token and every screen shows a fetch error.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn(),
  clearAuthSession: jest.fn(),
  saveRefreshedToken: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { getAccessToken, clearAuthSession } from '../../core/storage/authStorage';
import { emitForceSignOut } from '../../state/auth/authEventBus';

describe('expired-token sign-out', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    jest.useFakeTimers();
    mock = new MockAdapter(apiClient);
    jest.clearAllMocks();
    (getAccessToken as jest.Mock).mockResolvedValue('stale');
    (clearAuthSession as jest.Mock).mockResolvedValue(undefined);
  });
  afterEach(() => { mock.restore(); jest.advanceTimersByTime(5000); jest.useRealTimers(); });

  it('signs out on 400 "Json Web Token is expired" (old backend behaviour)', async () => {
    mock.onGet('/api/v1/mobile/requirements').reply(400, { success: false, message: 'Json Web Token is expired, Try again!' });
    await expect(apiClient.get('/api/v1/mobile/requirements')).rejects.toBeDefined();
    expect(clearAuthSession).toHaveBeenCalledTimes(1);
    expect(emitForceSignOut).toHaveBeenCalledTimes(1);
  });

  it('signs out on 400 "Json Web Token is invalid"', async () => {
    mock.onGet('/x').reply(400, { message: 'Json Web Token is invalid, Try again!' });
    await expect(apiClient.get('/x')).rejects.toBeDefined();
    expect(emitForceSignOut).toHaveBeenCalledTimes(1);
  });

  it('signs out on the new 401 TOKEN_EXPIRED reply', async () => {
    mock.onGet('/x').reply(401, { code: 'TOKEN_EXPIRED', message: 'Json Web Token is expired, Try again!' });
    await expect(apiClient.get('/x')).rejects.toBeDefined();
    expect(emitForceSignOut).toHaveBeenCalledTimes(1);
  });

  it('does NOT sign out on an ordinary 400 validation error', async () => {
    mock.onPost('/x').reply(400, { message: 'Invalid request' });
    await expect(apiClient.post('/x', {})).rejects.toBeDefined();
    expect(emitForceSignOut).not.toHaveBeenCalled();
    expect(clearAuthSession).not.toHaveBeenCalled();
  });
});
