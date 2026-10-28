/**
 * The API client while signed in as a TEAM MEMBER: employer calls go through the team gateway with the team token, anything the
 * gateway does not offer is refused locally (403, never sent, never signs the member out), and a dead team token signs out.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn(),
  clearAuthSession: jest.fn().mockResolvedValue(undefined),
  saveRefreshedToken: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { getAccessToken } from '../../core/storage/authStorage';
import { emitForceSignOut } from '../../state/auth/authEventBus';
import { setTeamMode } from '../../core/team/teamMode';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); jest.clearAllMocks(); (getAccessToken as jest.Mock).mockResolvedValue('TEAM.TOKEN'); });
afterEach(() => { mock.restore(); setTeamMode(false); });

describe('team mode ON', () => {
  beforeEach(() => setTeamMode(true));

  it('rewrites to the gateway and sends X-Team-Token — never the normal Authorization header', async () => {
    mock.onGet('/api/v1/team-access/api/user/getAllAgents').reply((cfg) => [200, { headers: cfg.headers }]);
    const res = await apiClient.get('/api/v1/user/getAllAgents');
    expect(res.data.headers['X-Team-Token']).toBe('TEAM.TOKEN');
    expect(res.data.headers.Authorization).toBeUndefined();
  });
  it('public boot endpoints go out untouched and without any token', async () => {
    mock.onGet('/api/v1/settings/public').reply((cfg) => [200, { headers: cfg.headers }]);
    const res = await apiClient.get('/api/v1/settings/public');
    expect(res.data.headers['X-Team-Token']).toBeUndefined();
    expect(res.data.headers.Authorization).toBeUndefined();
  });
  it('refuses a non-gateway call locally as 403 — nothing is sent and the member stays signed in', async () => {
    mock.onAny().reply(200, {}); // would answer if the call leaked
    await expect(apiClient.post('/api/v1/payment/create', {})).rejects.toMatchObject({ statusCode: 403, code: 'TEAM_NOT_ALLOWED' });
    await expect(apiClient.get('/api/v1/employer-team')).rejects.toMatchObject({ statusCode: 403 });
    expect(mock.history.post.length + mock.history.get.length).toBe(0);
    expect(emitForceSignOut).not.toHaveBeenCalled();
  });
  it('a gateway 403 (no permission) does not sign out; a gateway 401 (revoked / expired) does', async () => {
    mock.onGet('/api/v1/team-access/api/user/unlock-number/w1').reply(403, { code: 'TEAM_NO_PERMISSION', message: 'no' });
    await expect(apiClient.get('/api/v1/user/unlock-number/w1')).rejects.toMatchObject({ statusCode: 403 });
    expect(emitForceSignOut).not.toHaveBeenCalled();
    mock.onGet('/api/v1/team-access/api/user/getAllAgents').reply(401, { code: 'TEAM_ACCESS_REVOKED', message: 'revoked' });
    await expect(apiClient.get('/api/v1/user/getAllAgents')).rejects.toMatchObject({ statusCode: 401 });
    await new Promise((r) => setTimeout(r, 0));
    expect(emitForceSignOut).toHaveBeenCalledTimes(1);
  });
});

describe('team mode OFF (normal employer / agent app) — unchanged', () => {
  it('keeps the old behaviour: same URL, Bearer token, no team header', async () => {
    mock.onGet('/api/v1/user/getAllAgents').reply((cfg) => [200, { headers: cfg.headers }]);
    const res = await apiClient.get('/api/v1/user/getAllAgents');
    expect(res.data.headers.Authorization).toBe('Bearer TEAM.TOKEN');
    expect(res.data.headers['X-Team-Token']).toBeUndefined();
    mock.onPost('/api/v1/payment/create').reply(200, { ok: true });
    await expect(apiClient.post('/api/v1/payment/create', {})).resolves.toBeTruthy();
  });
});
