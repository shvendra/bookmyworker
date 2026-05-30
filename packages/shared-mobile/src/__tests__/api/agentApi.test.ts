/**
 * Unit tests for agentApi — all 8 methods with mock HTTP responses.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { agentApi } from '../../core/api/endpoints/agentApi';

let mock: MockAdapter;

beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

// ── Fixtures ────────────────────────────────────────────────────────────────

const mockStats = {
  totalLeads: 10,
  activeRequirements: 5,
  pendingCommission: 2000,
  totalEarned: 15000,
  verifiedLeads: 3,
  pendingLeads: 7,
  totalCommission: 5000,
  paidCommission: 3000,
  fulfilledRequirements: 2,
};

const mockLead = {
  _id: 'lead-1',
  name: 'Ramesh Kumar',
  phone: '9876543210',
  callStatus: 'pending',
};

const mockWorker = {
  _id: 'w1',
  name: 'Suresh Yadav',
  phone: '9123456780',
  district: 'Lucknow',
  state: 'Uttar Pradesh',
  status: 'Verified' as const,
  areasOfWork: ['Construction'],
  createdAt: '2024-01-01T00:00:00.000Z',
};

// ── getStats ─────────────────────────────────────────────────────────────────

describe('agentApi.getStats', () => {
  it('returns agent statistics on success', async () => {
    mock.onGet('/api/v1/user/agent/stats').reply(200, mockStats);
    const result = await agentApi.getStats();
    expect(result).toEqual(mockStats);
  });

  it('throws ApiClientError on server error', async () => {
    mock.onGet('/api/v1/user/agent/stats').reply(500, { message: 'Server error' });
    await expect(agentApi.getStats()).rejects.toMatchObject({ statusCode: 500 });
  });
});

// ── getMyLeads ────────────────────────────────────────────────────────────────

describe('agentApi.getMyLeads', () => {
  it('returns leads list and total with no params', async () => {
    mock.onGet('/api/v1/user/leads').reply(200, { leads: [mockLead], total: 1 });
    const result = await agentApi.getMyLeads();
    expect(result.leads).toHaveLength(1);
    expect(result.total).toBe(1);
    expect((result.leads[0] as unknown as { _id: string })._id).toBe('lead-1');
  });

  it('passes page and callStatus params to API', async () => {
    mock.onGet('/api/v1/user/leads', { params: { page: 2, callStatus: 'done' } })
      .reply(200, { leads: [], total: 0 });
    const result = await agentApi.getMyLeads({ page: 2, callStatus: 'done' });
    expect(result.leads).toHaveLength(0);
  });

  it('throws on network failure', async () => {
    mock.onGet('/api/v1/user/leads').networkError();
    await expect(agentApi.getMyLeads()).rejects.toBeInstanceOf(Error);
  });
});

// ── updateLead ────────────────────────────────────────────────────────────────

describe('agentApi.updateLead', () => {
  it('sends PUT with callStatus and notes, returns updated lead', async () => {
    mock.onPut('/api/v1/admin/lead-1/lead-status').reply(200, { ...mockLead, callStatus: 'done' });
    const result = await agentApi.updateLead('lead-1', { callStatus: 'done', notes: 'Called back' });
    expect(result.callStatus).toBe('done');
  });

  it('throws on 404 when lead not found', async () => {
    mock.onPut('/api/v1/admin/no-lead/lead-status').reply(404, { message: 'Lead not found' });
    await expect(agentApi.updateLead('no-lead', { callStatus: 'done' }))
      .rejects.toMatchObject({ statusCode: 404, message: 'Lead not found' });
  });
});

// ── getActiveRequirements ─────────────────────────────────────────────────────

describe('agentApi.getActiveRequirements', () => {
  it('fetches open requirements with status=open by default', async () => {
    const payload = { requirements: [{ _id: 'req-1' }], total: 1 };
    mock.onGet('/api/v1/application').reply(200, payload);
    const result = await agentApi.getActiveRequirements();
    expect(result).toEqual(payload);
  });

  it('passes page param when provided', async () => {
    mock.onGet('/api/v1/application').reply(200, { requirements: [], total: 0 });
    const result = await agentApi.getActiveRequirements({ page: 3 });
    expect(result.total).toBe(0);
  });
});

// ── getWorkStream ─────────────────────────────────────────────────────────────

describe('agentApi.getWorkStream', () => {
  it('returns stream data', async () => {
    const payload = { updates: ['update-1'], total: 1 };
    mock.onGet('/api/v1/application/update-stream-moreinfo').reply(200, payload);
    const result = await agentApi.getWorkStream();
    expect(result).toEqual(payload);
  });

  it('passes page param', async () => {
    mock.onGet('/api/v1/application/update-stream-moreinfo').reply(200, { updates: [] });
    await agentApi.getWorkStream({ page: 2 });
  });
});

// ── getTransactionsByAgent ────────────────────────────────────────────────────

describe('agentApi.getTransactionsByAgent', () => {
  it('returns transactions for the given agent ID', async () => {
    const payload = { debitTransactions: [{ _id: 'tx-1', amount: 500 }] };
    mock.onGet('/api/v1/payment/transactions/by-agent/agent-123').reply(200, payload);
    const result = await agentApi.getTransactionsByAgent('agent-123');
    expect(result).toEqual(payload);
  });

  it('throws when agentId is invalid', async () => {
    mock.onGet('/api/v1/payment/transactions/by-agent/bad').reply(404, { message: 'Not found' });
    await expect(agentApi.getTransactionsByAgent('bad'))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── registerWorker ────────────────────────────────────────────────────────────

describe('agentApi.registerWorker', () => {
  it('POSTs FormData with multipart header and returns response', async () => {
    const responseData = { success: true, workerId: 'new-worker-id' };
    mock.onPost('/api/v1/job/post').reply(201, responseData);

    const form = new FormData();
    form.append('name', 'Test Worker');
    form.append('phone', '9000000001');

    const result = await agentApi.registerWorker(form);
    expect(result).toEqual(responseData);
  });

  it('throws 422 when required fields are missing', async () => {
    mock.onPost('/api/v1/job/post').reply(422, { message: 'Phone is required' });
    await expect(agentApi.registerWorker(new FormData()))
      .rejects.toMatchObject({ statusCode: 422, message: 'Phone is required' });
  });
});

// ── getMyWorkers ──────────────────────────────────────────────────────────────

describe('agentApi.getMyWorkers', () => {
  it('returns paginated worker list', async () => {
    const payload = { success: true, workers: [mockWorker], total: 1, page: 1, pages: 1 };
    mock.onGet('/api/v1/user/my-workers').reply(200, payload);

    const result = await agentApi.getMyWorkers();
    expect(result.workers).toHaveLength(1);
    expect(result.workers[0].name).toBe('Suresh Yadav');
    expect(result.total).toBe(1);
    expect(result.pages).toBe(1);
  });

  it('passes page and limit params', async () => {
    const payload = { success: true, workers: [], total: 0, page: 2, pages: 5 };
    mock.onGet('/api/v1/user/my-workers').reply(200, payload);
    const result = await agentApi.getMyWorkers({ page: 2, limit: 10 });
    expect(result.page).toBe(2);
  });

  it('returns empty array when no workers registered', async () => {
    mock.onGet('/api/v1/user/my-workers').reply(200, {
      success: true, workers: [], total: 0, page: 1, pages: 0,
    });
    const result = await agentApi.getMyWorkers();
    expect(result.workers).toHaveLength(0);
  });
});
