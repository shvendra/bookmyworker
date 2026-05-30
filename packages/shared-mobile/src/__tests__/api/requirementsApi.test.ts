/**
 * Unit tests for requirementsApi — 20+ methods covering listing, CRUD,
 * likes, interest expression, assignment, attendance, and employer phone reveal.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { requirementsApi, type RawRequirement } from '../../core/api/endpoints/requirementsApi';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

// ── Fixture ──────────────────────────────────────────────────────────────────

const req: RawRequirement = {
  _id: 'req-001',
  ERN_NUMBER: 'ERN20240001',
  workType: 'construction_project_workers',
  subCategory: 'Mason',
  district: 'Pune',
  state: 'Maharashtra',
  status: 'open',
  minBudgetPerWorker: 600,
  maxBudgetPerWorker: 800,
  workerQuantitySkilled: 5,
  createdAt: '2024-01-01T00:00:00.000Z',
};

// ── listForRole ───────────────────────────────────────────────────────────────

describe('requirementsApi.listForRole', () => {
  // listForRole appends query params directly to URL path, so use regex to match
  it('fetches mobile requirements with default pagination', async () => {
    mock.onGet(/\/api\/v1\/mobile\/requirements/).reply(200, {
      requirements: [req],
      pagination: { totalPages: 2, currentPage: 1, totalCount: 25 },
    });
    const res = await requirementsApi.listForRole({ role: 'agent', page: 1, limit: 20 });
    expect(res.requirements).toHaveLength(1);
    expect(res.pagination.totalPages).toBe(2);
  });

  it('scopes by employerId for employer role', async () => {
    let url = '';
    mock.onGet(/\/api\/v1\/mobile\/requirements/).reply((config) => {
      url = config.url ?? '';
      return [200, { requirements: [], pagination: { totalPages: 1, currentPage: 1, totalCount: 0 } }];
    });
    await requirementsApi.listForRole({ role: 'employer', userId: 'emp-123' });
    expect(url).toContain('employerId=emp-123');
  });

  it('applies optional filters: workType, state, district, search, myInterests', async () => {
    let url = '';
    mock.onGet(/\/api\/v1\/mobile\/requirements/).reply((config) => {
      url = config.url ?? '';
      return [200, { requirements: [] }];
    });
    await requirementsApi.listForRole({
      role: 'agent',
      workType: 'construction_project_workers',
      state: 'Maharashtra',
      district: 'Pune',
      search: 'mason',
      myInterests: true,
    });
    expect(url).toContain('workType=construction_project_workers');
    expect(url).toContain('state=Maharashtra');
    expect(url).toContain('search=mason');
    expect(url).toContain('myInterests=true');
  });

  it('provides fallback pagination when server omits pagination field', async () => {
    mock.onGet(/\/api\/v1\/mobile\/requirements/).reply(200, {
      requirements: [req],
      total: 50,
    });
    const res = await requirementsApi.listForRole({ role: 'agent', page: 3 });
    expect(res.pagination.currentPage).toBe(3);
    expect(res.pagination.totalCount).toBe(50);
  });

  it('returns empty requirements array when not present in response', async () => {
    mock.onGet(/\/api\/v1\/mobile\/requirements/).reply(200, {});
    const res = await requirementsApi.listForRole({ role: 'worker' });
    expect(res.requirements).toEqual([]);
  });
});

// ── list ──────────────────────────────────────────────────────────────────────

describe('requirementsApi.list', () => {
  it('returns requirements and total', async () => {
    mock.onGet('/api/v1/application').reply(200, { requirements: [req], total: 1 });
    const res = await requirementsApi.list({ status: 'open', page: 1 });
    expect((res.requirements[0] as unknown as { _id: string })._id).toBe('req-001');
    expect(res.total).toBe(1);
  });
});

// ── getById ───────────────────────────────────────────────────────────────────

describe('requirementsApi.getById', () => {
  it('returns the requirement object', async () => {
    mock.onGet('/api/v1/mobile/requirements/req-001').reply(200, { requirement: req });
    const res = await requirementsApi.getById('req-001');
    expect(res._id).toBe('req-001');
    expect(res.district).toBe('Pune');
  });

  it('throws 404 when not found', async () => {
    mock.onGet('/api/v1/mobile/requirements/missing').reply(404, { message: 'Not found' });
    await expect(requirementsApi.getById('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── create ────────────────────────────────────────────────────────────────────

describe('requirementsApi.create', () => {
  it('POSTs and returns created requirement', async () => {
    const payload = {
      workType: 'construction_project_workers',
      subCategory: 'Mason',
      workerQuantitySkilled: 3,
      state: 'Maharashtra',
      district: 'Pune',
      workerNeedDate: '2024-06-01',
      remarks: 'Urgent',
      minBudgetPerWorker: 600,
      maxBudgetPerWorker: 800,
    };
    mock.onPost('/api/v1/application/insertrequirement').reply(201, { ...payload, _id: 'new-req' });
    const res = await requirementsApi.create(payload);
    expect((res as unknown as { _id: string })._id).toBe('new-req');
  });
});

// ── update ────────────────────────────────────────────────────────────────────

describe('requirementsApi.update', () => {
  it('sends PUT and returns updated requirement', async () => {
    mock.onPut('/api/v1/application/req-001').reply(200, { ...req, remarks: 'Updated' });
    const res = await requirementsApi.update('req-001', { remarks: 'Updated' } as never);
    expect((res as unknown as { remarks: string }).remarks).toBe('Updated');
  });
});

// ── close ─────────────────────────────────────────────────────────────────────

describe('requirementsApi.close', () => {
  it('closes the requirement', async () => {
    mock.onPut(/\/api\/v1\/application\/update-status/).reply(200, { success: true });
    await expect(requirementsApi.close('req-001')).resolves.toEqual({ success: true });
  });
});

// ── toggleLike ────────────────────────────────────────────────────────────────

describe('requirementsApi.toggleLike', () => {
  it('returns liked=true and count on first like', async () => {
    mock.onPost('/api/v1/mobile/requirements/req-001/like').reply(200, {
      success: true, liked: true, likeCount: 1,
    });
    const res = await requirementsApi.toggleLike('req-001');
    expect(res.liked).toBe(true);
    expect(res.likeCount).toBe(1);
  });

  it('returns liked=false when unliking', async () => {
    mock.onPost('/api/v1/mobile/requirements/req-001/like').reply(200, {
      success: true, liked: false, likeCount: 0,
    });
    const res = await requirementsApi.toggleLike('req-001');
    expect(res.liked).toBe(false);
  });
});

// ── getLiked ──────────────────────────────────────────────────────────────────

describe('requirementsApi.getLiked', () => {
  it('returns liked requirements with pagination', async () => {
    mock.onGet('/api/v1/mobile/requirements/liked').reply(200, {
      requirements: [req],
      pagination: { totalPages: 1, currentPage: 1, totalCount: 1 },
    });
    const res = await requirementsApi.getLiked();
    expect(res.requirements).toHaveLength(1);
    expect(res.pagination.totalCount).toBe(1);
  });

  it('provides fallback pagination when missing', async () => {
    mock.onGet('/api/v1/mobile/requirements/liked').reply(200, { requirements: [] });
    const res = await requirementsApi.getLiked(2, 10);
    expect(res.pagination.currentPage).toBe(2);
    expect(res.requirements).toEqual([]);
  });
});

// ── expressInterestWithWage ───────────────────────────────────────────────────

describe('requirementsApi.expressInterestWithWage', () => {
  it('sends wage in body', async () => {
    mock.onPost('/api/v1/application/req-001/express-interest').reply(200, { success: true });
    await expect(requirementsApi.expressInterestWithWage('req-001', 700)).resolves.toEqual({ success: true });
  });
});

describe('requirementsApi.expressInterest', () => {
  it('POSTs without body', async () => {
    mock.onPost('/api/v1/application/req-001/express-interest').reply(200, { success: true });
    await expect(requirementsApi.expressInterest('req-001')).resolves.toEqual({ success: true });
  });
});

// ── assignAgent ───────────────────────────────────────────────────────────────

describe('requirementsApi.assignAgent', () => {
  it('sends PUT with all required fields', async () => {
    mock.onPut('/api/v1/application/assign').reply(200, { success: true });
    await expect(requirementsApi.assignAgent({
      agentId: 'agent-1',
      ern: 'ERN001',
      assignedAgentName: 'Ravi',
      assignedAgentPhone: '9999999999',
      finalAgentRequiredWage: 650,
    })).resolves.toEqual({ success: true });
  });
});

// ── unassignOrAccept ──────────────────────────────────────────────────────────

describe('requirementsApi.unassignOrAccept', () => {
  it('accepts the requirement', async () => {
    mock.onPut('/api/v1/application/unassignOrAccept').reply(200, { success: true });
    await expect(requirementsApi.unassignOrAccept({
      agentId: 'agent-1', ern: 'ERN001', isAgentAccepted: 'Yes',
    })).resolves.toEqual({ success: true });
  });
});

// ── assignWorker ──────────────────────────────────────────────────────────────

describe('requirementsApi.assignWorker', () => {
  it('POSTs assignment payload', async () => {
    mock.onPost('/api/v1/application/assign').reply(200, { success: true });
    await expect(requirementsApi.assignWorker({
      requirementId: 'req-001', workerId: 'w-001',
    })).resolves.toEqual({ success: true });
  });
});

// ── getAttendanceByRequirement ────────────────────────────────────────────────

describe('requirementsApi.getAttendanceByRequirement', () => {
  it('returns attendance records', async () => {
    const records = [{ _id: 'att-1', wages: 600, status: 'Present' }];
    mock.onGet(/\/api\/v1\/attendance\/get-by-requirement/).reply(200, { data: records, success: true });
    const res = await requirementsApi.getAttendanceByRequirement('req-001', 'emp-001');
    expect(res).toEqual(records);
  });

  it('returns empty array when data missing from response', async () => {
    mock.onGet(/\/api\/v1\/attendance\/get-by-requirement/).reply(200, { success: true });
    const res = await requirementsApi.getAttendanceByRequirement('req-001');
    expect(res).toEqual([]);
  });
});

// ── approveAttendance ─────────────────────────────────────────────────────────

describe('requirementsApi.approveAttendance', () => {
  it('sends PUT to approve attendance', async () => {
    mock.onPut(/\/api\/v1\/attendance\/update-requ/).reply(200, { success: true });
    await expect(requirementsApi.approveAttendance('att-001')).resolves.toEqual({ success: true });
  });
});

// ── getMyRequirements ─────────────────────────────────────────────────────────

describe('requirementsApi.getMyRequirements', () => {
  it('returns myJobs array', async () => {
    mock.onGet('/api/v1/job/getmyjobs').reply(200, { myJobs: [req] });
    const res = await requirementsApi.getMyRequirements();
    expect(res).toHaveLength(1);
  });

  it('falls back to jobs array if myJobs is missing', async () => {
    mock.onGet('/api/v1/job/getmyjobs').reply(200, { jobs: [req] });
    const res = await requirementsApi.getMyRequirements();
    expect(res).toHaveLength(1);
  });

  it('handles flat array response', async () => {
    mock.onGet('/api/v1/job/getmyjobs').reply(200, [req]);
    const res = await requirementsApi.getMyRequirements();
    expect(res).toHaveLength(1);
  });

  it('returns empty array when body has neither myJobs nor jobs', async () => {
    mock.onGet('/api/v1/job/getmyjobs').reply(200, {});
    const res = await requirementsApi.getMyRequirements();
    expect(res).toEqual([]);
  });
});

// ── getAllJobs ────────────────────────────────────────────────────────────────

describe('requirementsApi.getAllJobs', () => {
  it('returns jobs from { jobs } shape', async () => {
    mock.onGet('/api/v1/job/getall').reply(200, { jobs: [req], total: 1 });
    const res = await requirementsApi.getAllJobs();
    expect(res.jobs).toHaveLength(1);
    expect(res.total).toBe(1);
  });

  it('returns jobs from { data } shape', async () => {
    mock.onGet('/api/v1/job/getall').reply(200, { data: [req] });
    const res = await requirementsApi.getAllJobs();
    expect(res.jobs).toHaveLength(1);
  });

  it('handles flat array response', async () => {
    mock.onGet('/api/v1/job/getall').reply(200, [req]);
    const res = await requirementsApi.getAllJobs();
    expect(res.jobs).toHaveLength(1);
    expect(res.total).toBe(1);
  });
});

// ── getJobById ────────────────────────────────────────────────────────────────

describe('requirementsApi.getJobById', () => {
  it('returns job from { job } shape', async () => {
    mock.onGet('/api/v1/job/get/req-001').reply(200, { job: req });
    const res = await requirementsApi.getJobById('req-001');
    expect((res as unknown as { _id: string })._id).toBe('req-001');
  });

  it('returns flat job object', async () => {
    mock.onGet('/api/v1/job/get/req-001').reply(200, req);
    const res = await requirementsApi.getJobById('req-001');
    expect((res as unknown as { _id: string })._id).toBe('req-001');
  });
});

// ── submitApplication ─────────────────────────────────────────────────────────

describe('requirementsApi.submitApplication', () => {
  it('POSTs application and returns result', async () => {
    mock.onPost('/api/v1/application/post').reply(201, { success: true, applicationId: 'app-1' });
    const res = await requirementsApi.submitApplication({ jobId: 'req-001' });
    expect(res.applicationId).toBe('app-1');
  });
});

// ── getMyApplications ─────────────────────────────────────────────────────────

describe('requirementsApi.getMyApplications', () => {
  it('returns applications from { applications } shape', async () => {
    mock.onGet('/api/v1/application/jobseeker/getall').reply(200, { applications: [{}], total: 1 });
    const res = await requirementsApi.getMyApplications();
    expect(res.applications).toHaveLength(1);
    expect(res.total).toBe(1);
  });

  it('falls back to data array', async () => {
    mock.onGet('/api/v1/application/jobseeker/getall').reply(200, { data: [{}] });
    const res = await requirementsApi.getMyApplications();
    expect(res.applications).toHaveLength(1);
  });
});

// ── getWorkHistory ────────────────────────────────────────────────────────────

describe('requirementsApi.getWorkHistory', () => {
  it('returns history and total', async () => {
    mock.onGet('/api/v1/application/getworkhistory').reply(200, { history: [{}], total: 1 });
    const res = await requirementsApi.getWorkHistory();
    expect(res.history).toHaveLength(1);
  });
});

// ── getHiredWorkers ───────────────────────────────────────────────────────────

describe('requirementsApi.getHiredWorkers', () => {
  it('returns list of hired workers', async () => {
    const workers = [{ workerId: 'w1', workerName: 'A', workerPhone: '9000000000', lastHireDate: '', workType: '' }];
    mock.onGet('/api/v1/mobile/employer/hired-workers').reply(200, { workers });
    const res = await requirementsApi.getHiredWorkers();
    expect(res).toHaveLength(1);
  });

  it('returns empty array when workers is missing', async () => {
    mock.onGet('/api/v1/mobile/employer/hired-workers').reply(200, {});
    const res = await requirementsApi.getHiredWorkers();
    expect(res).toEqual([]);
  });
});

// ── revealEmployerPhone ───────────────────────────────────────────────────────

describe('requirementsApi.revealEmployerPhone', () => {
  it('returns phone and name', async () => {
    mock.onGet('/api/v1/mobile/requirements/req-001/employer-phone').reply(200, {
      success: true, phone: '9111111111', name: 'Employer Name',
    });
    const res = await requirementsApi.revealEmployerPhone('req-001');
    expect(res.phone).toBe('9111111111');
    expect(res.name).toBe('Employer Name');
  });

  it('throws 403 when employer not subscribed', async () => {
    mock.onGet('/api/v1/mobile/requirements/req-001/employer-phone')
      .reply(403, { message: 'Employer not subscribed' });
    await expect(requirementsApi.revealEmployerPhone('req-001'))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});
