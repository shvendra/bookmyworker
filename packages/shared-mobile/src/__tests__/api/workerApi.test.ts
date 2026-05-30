/**
 * Unit tests for workerApi — search, profile, unlock, remarks, attendance.
 * Covers RawAgent → WorkerProfile mapping logic and all branching paths.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

// Mock native fetch and ENV for uploadResume
global.fetch = jest.fn();

import { apiClient } from '../../core/api/client';
import { workerApi } from '../../core/api/endpoints/workerApi';

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
  (global.fetch as jest.Mock).mockReset();
});
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

const rawAgent = {
  _id: 'agent-001',
  name: 'Suresh Yadav',
  phone: '9123456780',
  role: 'Agent',
  status: 'Verified',
  state: 'Maharashtra',
  district: 'Pune',
  block: 'Hadapsar',
  areasOfWork: ['Construction', 'Transport'],
  fixedSalary: 700,
  salaryFrom: 600,
  salaryTo: 800,
  workExperience: 5,
  profilePhoto: 'uploads/suresh.jpg',
  rating: 4.5,
  totalRatings: 20,
  dob: '1990-05-15',
  gender: 'Male',
  veryfiedBage: true,
  workerSubType: 'ITI/Diploma',
  agentType: 'Freelance',
};

const paginationResponse = {
  success: true,
  agents: [rawAgent],
  pagination: { totalPages: 3, currentPage: 1, totalCount: 60, total: 60 },
};

// ── getAllAgents ───────────────────────────────────────────────────────────────

describe('workerApi.getAllAgents', () => {
  it('returns mapped WorkerProfile list with pagination', async () => {
    mock.onGet('/api/v1/user/getAllAgents').reply(200, paginationResponse);
    const res = await workerApi.getAllAgents({ page: 1, limit: 25 });

    expect(res.workers).toHaveLength(1);
    expect(res.workers[0].id).toBe('agent-001');
    expect(res.workers[0].fullName).toBe('Suresh Yadav');
    expect(res.workers[0].verified).toBe(true);
    expect(res.workers[0].kycStatus).toBe('verified');
    expect(res.workers[0].category).toBe('Construction');
    expect(res.workers[0].experienceYears).toBe(5);
    expect(res.workers[0].rating).toBe(4.5);
    expect(res.total).toBe(60);
    expect(res.pages).toBe(3);
    expect(res.currentPage).toBe(1);
  });

  it('maps Block status to rejected kycStatus and available=false', async () => {
    mock.onGet('/api/v1/user/getAllAgents').reply(200, {
      success: true,
      agents: [{ ...rawAgent, status: 'Block' }],
    });
    const res = await workerApi.getAllAgents({});
    expect(res.workers[0].kycStatus).toBe('rejected');
    expect(res.workers[0].available).toBe(false);
  });

  it('maps Unverified status to pending kycStatus', async () => {
    mock.onGet('/api/v1/user/getAllAgents').reply(200, {
      success: true,
      agents: [{ ...rawAgent, status: 'Unverified' }],
    });
    const res = await workerApi.getAllAgents({});
    expect(res.workers[0].kycStatus).toBe('pending');
  });

  it('uses salaryFrom as dailyRate when fixedSalary is missing', async () => {
    const noFixed = { ...rawAgent, fixedSalary: undefined };
    mock.onGet('/api/v1/user/getAllAgents').reply(200, { success: true, agents: [noFixed] });
    const res = await workerApi.getAllAgents({});
    expect(res.workers[0].dailyRate).toBe(600); // salaryFrom
  });

  it('falls back to totalCount when total is missing in pagination', async () => {
    mock.onGet('/api/v1/user/getAllAgents').reply(200, {
      success: true,
      agents: [rawAgent],
      pagination: { totalPages: 2, currentPage: 1, totalCount: 40 },
    });
    const res = await workerApi.getAllAgents({});
    expect(res.total).toBe(40);
  });

  it('falls back to agents.length when pagination is missing', async () => {
    mock.onGet('/api/v1/user/getAllAgents').reply(200, {
      success: true,
      agents: [rawAgent, rawAgent],
    });
    const res = await workerApi.getAllAgents({});
    expect(res.total).toBe(2);
    expect(res.pages).toBe(1);
  });

  it('returns empty workers list when agents is missing', async () => {
    mock.onGet('/api/v1/user/getAllAgents').reply(200, { success: true });
    const res = await workerApi.getAllAgents({});
    expect(res.workers).toHaveLength(0);
  });

  it('throws on 500 error', async () => {
    mock.onGet('/api/v1/user/getAllAgents').reply(500, { message: 'Server error' });
    await expect(workerApi.getAllAgents({})).rejects.toMatchObject({ statusCode: 500 });
  });
});

// ── unlockNumber ──────────────────────────────────────────────────────────────

describe('workerApi.unlockNumber', () => {
  it('returns phone and message', async () => {
    mock.onGet('/api/v1/user/unlock-number/agent-001').reply(200, {
      phone: '9123456780',
      message: 'Number unlocked',
    });
    const res = await workerApi.unlockNumber('agent-001');
    expect(res.phone).toBe('9123456780');
  });

  it('throws 403 when subscription required', async () => {
    mock.onGet('/api/v1/user/unlock-number/agent-001').reply(403, { message: 'Subscription required' });
    await expect(workerApi.unlockNumber('agent-001')).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── saveWorkerRemark ──────────────────────────────────────────────────────────

describe('workerApi.saveWorkerRemark', () => {
  it('saves remark without throwing', async () => {
    mock.onPost('/api/v1/user/worker-remark').reply(200, { success: true });
    await expect(workerApi.saveWorkerRemark('worker-001', 'Interested')).resolves.toBeUndefined();
  });

  it('throws on error', async () => {
    mock.onPost('/api/v1/user/worker-remark').reply(422, { message: 'Invalid status' });
    await expect(workerApi.saveWorkerRemark('w1', 'bad')).rejects.toMatchObject({ statusCode: 422 });
  });
});

// ── getWorkerRemarks ──────────────────────────────────────────────────────────

describe('workerApi.getWorkerRemarks', () => {
  it('returns remarks array', async () => {
    const remarks = [{ workerId: 'w1', status: 'Contacted' }];
    mock.onGet('/api/v1/user/worker-remarks').reply(200, remarks);
    const res = await workerApi.getWorkerRemarks();
    expect(res).toHaveLength(1);
    expect(res[0].workerId).toBe('w1');
  });

  it('returns empty array when null response', async () => {
    mock.onGet('/api/v1/user/worker-remarks').reply(200, null);
    const res = await workerApi.getWorkerRemarks();
    expect(res).toEqual([]);
  });
});

// ── search (alias for getAllAgents) ───────────────────────────────────────────

describe('workerApi.search', () => {
  it('delegates to getAllAgents', async () => {
    mock.onGet('/api/v1/user/getAllAgents').reply(200, paginationResponse);
    const res = await workerApi.search({ state: 'Maharashtra', district: 'Pune' });
    expect(res.workers).toHaveLength(1);
  });
});

// ── getWorkerById ─────────────────────────────────────────────────────────────

describe('workerApi.getWorkerById', () => {
  it('returns worker detail', async () => {
    mock.onGet('/api/v1/user/worker/agent-001').reply(200, {
      success: true,
      worker: { _id: 'agent-001', name: 'Suresh', role: 'Agent', state: 'MH' },
    });
    const res = await workerApi.getWorkerById('agent-001');
    expect(res._id).toBe('agent-001');
    expect(res.name).toBe('Suresh');
  });
});

// ── getAgentsByIds ────────────────────────────────────────────────────────────

describe('workerApi.getAgentsByIds', () => {
  it('returns empty array for empty ids list', async () => {
    const res = await workerApi.getAgentsByIds([]);
    expect(res).toEqual([]);
  });

  it('fetches multiple agents in parallel and returns array', async () => {
    mock.onGet('/api/v1/user/worker/a1').reply(200, { success: true, worker: { _id: 'a1', name: 'Agent 1', phone: '9000000001' } });
    mock.onGet('/api/v1/user/worker/a2').reply(200, { success: true, worker: { _id: 'a2', name: 'Agent 2', phone: '9000000002' } });
    const res = await workerApi.getAgentsByIds(['a1', 'a2']);
    expect(res).toHaveLength(2);
    expect(res[0]._id).toBe('a1');
  });

  it('skips agents that return errors (settled=rejected)', async () => {
    mock.onGet('/api/v1/user/worker/a1').reply(200, { success: true, worker: { _id: 'a1', name: 'Agent 1', phone: '9000000001' } });
    mock.onGet('/api/v1/user/worker/bad').reply(404, { message: 'Not found' });
    const res = await workerApi.getAgentsByIds(['a1', 'bad']);
    expect(res).toHaveLength(1);
    expect(res[0]._id).toBe('a1');
  });
});

// ── getDashboard ──────────────────────────────────────────────────────────────

describe('workerApi.getDashboard', () => {
  it('returns dashboard data', async () => {
    const dashboard = {
      profile: { id: 'w1', fullName: 'Worker', phone: '9000000001' },
      activeRequirements: 2,
      totalEarnings: 5000,
      pendingPayouts: 1000,
      recentJobs: [],
    };
    mock.onGet('/api/v1/worker/dashboard').reply(200, dashboard);
    const res = await workerApi.getDashboard();
    expect(res.activeRequirements).toBe(2);
    expect(res.totalEarnings).toBe(5000);
  });
});

// ── updateProfile ─────────────────────────────────────────────────────────────

describe('workerApi.updateProfile', () => {
  it('sends updated profile data', async () => {
    mock.onPut('/api/v1/user/update').reply(200, { id: 'w1', fullName: 'Updated Name' });
    const res = await workerApi.updateProfile({ fullName: 'Updated Name' } as never);
    expect((res as { fullName: string }).fullName).toBe('Updated Name');
  });
});

// ── getAttendance ─────────────────────────────────────────────────────────────

describe('workerApi.getAttendance', () => {
  it('returns attendance records', async () => {
    const records = [{ _id: 'att-1', type: 'check-in', date: '2024-01-15' }];
    mock.onGet('/api/v1/attendance/get-by-requirement').reply(200, records);
    const res = await workerApi.getAttendance({ requirementId: 'req-001' });
    expect(res).toHaveLength(1);
  });
});

// ── markAttendance ────────────────────────────────────────────────────────────

describe('workerApi.markAttendance', () => {
  it('marks check-in and returns attendance record', async () => {
    const record = { _id: 'att-new', type: 'check-in', requirementId: 'req-001' };
    mock.onPost('/api/v1/attendance/add-attendance').reply(201, record);
    const res = await workerApi.markAttendance({ requirementId: 'req-001', type: 'check-in' });
    expect((res as unknown as { type: string }).type).toBe('check-in');
  });
});

// ── uploadResume ──────────────────────────────────────────────────────────────

describe('workerApi.uploadResume', () => {
  it('uploads PDF resume via native fetch (file:// URI)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, resumeUrl: 'https://s3.example.com/resume.pdf' }),
    });
    const url = await workerApi.uploadResume('file:///tmp/resume.pdf', 'resume.pdf');
    expect(url).toBe('https://s3.example.com/resume.pdf');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/user/upload-resume'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('handles docx mime type', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, resumeUrl: 'https://s3.example.com/resume.docx' }),
    });
    const url = await workerApi.uploadResume('file:///tmp/resume.docx', 'resume.docx');
    expect(url).toContain('resume.docx');
  });

  it('throws when server responds with error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: jest.fn().mockResolvedValue({ message: 'File too large' }),
    });
    await expect(workerApi.uploadResume('file:///big.pdf', 'big.pdf'))
      .rejects.toThrow('File too large');
  });

  it('throws with default message when error response has no message', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: jest.fn().mockResolvedValue({}),
    });
    await expect(workerApi.uploadResume('file:///x.pdf', 'x.pdf'))
      .rejects.toThrow('Upload failed');
  });
});
