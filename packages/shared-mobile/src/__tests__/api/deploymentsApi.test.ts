/**
 * Unit tests for deploymentsApi — employer-side deployment listing +
 * confirm/reject on a proposed worker.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { deploymentsApi, type Deployment } from '../../core/api/endpoints/deploymentsApi';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

const deployment: Deployment = {
  _id: 'dep-001',
  requirementId: 'req-001',
  clientCompanyId: 'cc-001',
  siteId: 'site-001',
  workerId: 'worker-001',
  workerName: 'Ramesh Kumar',
  workerPhone: '9999999999',
  employerBillingRate: 700,
  billingPayModel: 'Daily',
  payrollModel: 'BMW_Payroll',
  status: 'Proposed',
  kycStatus: 'Verified',
  policeVerification: { status: 'Cleared' },
};

describe('deploymentsApi.listForRequirement', () => {
  it('fetches deployments scoped by requirementId', async () => {
    let url = '';
    mock.onGet('/api/v1/deployments').reply((config) => {
      url = config.url ?? '';
      return [200, { success: true, deployments: [deployment] }];
    });
    const res = await deploymentsApi.listForRequirement('req-001');
    expect(res).toHaveLength(1);
    expect(res[0].kycStatus).toBe('Verified');
    expect(url).toContain('/api/v1/deployments');
    expect(mock.history.get[0].params).toEqual({ requirementId: 'req-001' });
  });

  it('never exposes a worker-pay-rate field even if present in a raw fixture', async () => {
    mock.onGet('/api/v1/deployments').reply(200, { success: true, deployments: [deployment] });
    const res = await deploymentsApi.listForRequirement('req-001');
    expect((res[0] as unknown as Record<string, unknown>).workerPayRate).toBeUndefined();
  });
});

describe('deploymentsApi.confirm', () => {
  it('PUTs to confirm and returns the updated deployment', async () => {
    mock.onPut('/api/v1/deployments/dep-001/confirm').reply(200, {
      success: true, deployment: { ...deployment, status: 'Confirmed' },
    });
    const res = await deploymentsApi.confirm('dep-001');
    expect(res.status).toBe('Confirmed');
  });

  it('propagates a 400 when the deployment is not Proposed', async () => {
    mock.onPut('/api/v1/deployments/dep-001/confirm').reply(400, {
      message: 'Cannot confirm a deployment in Confirmed status',
    });
    await expect(deploymentsApi.confirm('dep-001')).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('deploymentsApi.reject', () => {
  it('PUTs to reject with an optional reason', async () => {
    mock.onPut('/api/v1/deployments/dep-001/reject').reply(200, {
      success: true, deployment: { ...deployment, status: 'Rejected' },
    });
    const res = await deploymentsApi.reject('dep-001', 'Not a good fit');
    expect(res.status).toBe('Rejected');
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ reason: 'Not a good fit' });
  });

  it('PUTs an empty body when no reason is given', async () => {
    mock.onPut('/api/v1/deployments/dep-001/reject').reply(200, { success: true, deployment });
    await deploymentsApi.reject('dep-001');
    expect(JSON.parse(mock.history.put[0].data)).toEqual({});
  });
});
