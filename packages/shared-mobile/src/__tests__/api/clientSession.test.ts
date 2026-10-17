/**
 * Session-resilience behaviour of the API client: sliding token renewal and
 * single sign-out for a burst of parallel 401s.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn(),
  clearAuthSession: jest.fn(),
  saveRefreshedToken: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({
  emitForceSignOut: jest.fn(),
}));

import { apiClient } from '../../core/api/client';
import { getAccessToken, clearAuthSession, saveRefreshedToken } from '../../core/storage/authStorage';
import { emitForceSignOut } from '../../state/auth/authEventBus';

describe('apiClient session resilience', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    jest.clearAllMocks();
  });
  afterEach(() => mock.restore());

  it('stores a renewed token returned in x-refreshed-token', async () => {
    (getAccessToken as jest.Mock).mockResolvedValue('old');
    mock.onGet('/api/v1/x').reply(200, { ok: true }, { 'x-refreshed-token': 'new-token' });
    await apiClient.get('/api/v1/x');
    expect(saveRefreshedToken).toHaveBeenCalledWith('new-token');
  });

  it('does not touch stored tokens when no renewal header is sent', async () => {
    (getAccessToken as jest.Mock).mockResolvedValue('old');
    mock.onGet('/api/v1/x').reply(200, { ok: true });
    await apiClient.get('/api/v1/x');
    expect(saveRefreshedToken).not.toHaveBeenCalled();
  });

  it('a renewal-store failure never breaks the response', async () => {
    (getAccessToken as jest.Mock).mockResolvedValue('old');
    (saveRefreshedToken as jest.Mock).mockRejectedValue(new Error('keystore'));
    mock.onGet('/api/v1/x').reply(200, { ok: true }, { 'x-refreshed-token': 'n' });
    await expect(apiClient.get('/api/v1/x')).resolves.toMatchObject({ status: 200 });
  });

  it('signs out ONCE when many parallel requests all 401', async () => {
    (getAccessToken as jest.Mock).mockResolvedValue('expired');
    (clearAuthSession as jest.Mock).mockResolvedValue(undefined);
    mock.onGet(/\/api\/v1\/p\d/).reply(401, { message: 'expired' });
    const results = await Promise.allSettled([
      apiClient.get('/api/v1/p1'),
      apiClient.get('/api/v1/p2'),
      apiClient.get('/api/v1/p3'),
    ]);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(emitForceSignOut).toHaveBeenCalledTimes(1);
    expect(clearAuthSession).toHaveBeenCalledTimes(1);
  });
});
