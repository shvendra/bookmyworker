/**
 * Unit tests for sitesApi — Employer self-service site listing/creation.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { sitesApi, type Site } from '../../core/api/endpoints/sitesApi';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

const site: Site = {
  _id: 'site-001',
  clientCompanyId: 'cc-001',
  siteName: 'Pune Warehouse',
  siteType: 'Warehouse',
  status: 'Active',
};

describe('sitesApi.getMySites', () => {
  it('returns the list of sites', async () => {
    mock.onGet('/api/v1/sites/mine').reply(200, { success: true, sites: [site] });
    const res = await sitesApi.getMySites();
    expect(res).toHaveLength(1);
    expect(res[0].siteName).toBe('Pune Warehouse');
  });

  it('returns empty array when no company is linked yet', async () => {
    mock.onGet('/api/v1/sites/mine').reply(200, { success: true, sites: [] });
    const res = await sitesApi.getMySites();
    expect(res).toEqual([]);
  });
});

describe('sitesApi.createMySite', () => {
  it('POSTs and returns the created site', async () => {
    mock.onPost('/api/v1/sites/mine').reply(201, { success: true, site });
    const res = await sitesApi.createMySite({ siteName: 'Pune Warehouse', siteType: 'Warehouse' });
    expect(res._id).toBe('site-001');
  });

  it('propagates a 400 validation error', async () => {
    mock.onPost('/api/v1/sites/mine').reply(400, { message: 'Site name is required' });
    await expect(sitesApi.createMySite({ siteName: '' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'Site name is required',
    });
  });
});
