/**
 * Unit tests for clientCompaniesApi — the gate for whether the Workforce
 * Management feature shows at all (GET /client-companies/me).
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { clientCompaniesApi, type ClientCompany } from '../../core/api/endpoints/clientCompaniesApi';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

const company: ClientCompany = {
  _id: 'cc-001',
  legalName: 'Acme Manufacturing Pvt Ltd',
  primaryContactUserId: 'user-001',
  payrollModelDefault: 'BMW_Payroll',
  status: 'Active',
};

describe('clientCompaniesApi.getMyCompany', () => {
  it('returns the linked client company', async () => {
    mock.onGet('/api/v1/client-companies/me').reply(200, { success: true, clientCompany: company });
    const res = await clientCompaniesApi.getMyCompany();
    expect(res?._id).toBe('cc-001');
    expect(res?.status).toBe('Active');
  });

  it('returns null when the employer has no linked company yet', async () => {
    mock.onGet('/api/v1/client-companies/me').reply(200, { success: true, clientCompany: null });
    const res = await clientCompaniesApi.getMyCompany();
    expect(res).toBeNull();
  });

  it('propagates 403 when the caller is not an Employer', async () => {
    mock.onGet('/api/v1/client-companies/me').reply(403, { message: 'Only Employer accounts can access this route' });
    await expect(clientCompaniesApi.getMyCompany()).rejects.toMatchObject({
      statusCode: 403,
      message: 'Only Employer accounts can access this route',
    });
  });
});
