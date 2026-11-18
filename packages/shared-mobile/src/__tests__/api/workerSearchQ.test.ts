/** Employer worker-search box → server-side `q` (searches ALL workers, not just the loaded page). */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { workerApi } from '../../core/api/endpoints/workerApi';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); mock.onGet('/api/v1/user/getAllAgents').reply(200, { agents: [], pagination: { total: 0 } }); });
afterEach(() => { mock.restore(); });

describe('workerApi.getAllAgents q', () => {
  it('sends the trimmed search text as q', async () => {
    await workerApi.getAllAgents({ q: '  Rewa ' });
    expect(mock.history.get[0].params.q).toBe('Rewa');
  });
  it('omits q when empty', async () => {
    await workerApi.getAllAgents({ q: '   ' });
    await workerApi.getAllAgents({});
    expect(mock.history.get[0].params.q).toBeUndefined();
    expect(mock.history.get[1].params.q).toBeUndefined();
  });
});
