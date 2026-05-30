/**
 * Unit tests for workerMappingApi — pipeline CRUD, status advancement, overview.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { workerMappingApi, type WorkerMapping } from '../../core/api/endpoints/workerMappingApi';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

const mapping: WorkerMapping = {
  _id: 'map-001',
  requirementId: 'req-001',
  workerName: 'Ramesh Singh',
  workerPhone: '9000000001',
  workerSkill: 'Mason',
  employerId: 'emp-001',
  status: 'Shortlisted',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

// ── mapWorker ─────────────────────────────────────────────────────────────────

describe('workerMappingApi.mapWorker', () => {
  it('maps worker to requirements and returns mapped data', async () => {
    const response = {
      success: true,
      message: 'Worker mapped successfully',
      mapped: [mapping],
      errors: [],
    };
    mock.onPost('/api/v1/mapping/map').reply(201, response);
    const res = await workerMappingApi.mapWorker({
      workerName: 'Ramesh Singh',
      workerPhone: '9000000001',
      requirementIds: ['req-001', 'req-002'],
      status: 'Shortlisted',
    });
    expect(res.success).toBe(true);
    expect(res.mapped).toHaveLength(1);
    expect(res.errors).toHaveLength(0);
  });

  it('includes workerId when provided', async () => {
    let sentBody: Record<string, unknown> = {};
    mock.onPost('/api/v1/mapping/map').reply((config) => {
      sentBody = JSON.parse(config.data as string);
      return [201, { success: true, mapped: [], errors: [] }];
    });
    await workerMappingApi.mapWorker({
      workerId: 'w-001',
      workerName: 'Test',
      workerPhone: '9000000002',
      requirementIds: ['req-001'],
      status: 'Shortlisted',
    });
    expect(sentBody.workerId).toBe('w-001');
  });

  it('throws 422 on validation error', async () => {
    mock.onPost('/api/v1/mapping/map').reply(422, { message: 'Phone is required' });
    await expect(workerMappingApi.mapWorker({
      workerName: 'X',
      workerPhone: '',
      requirementIds: [],
      status: 'Shortlisted',
    })).rejects.toMatchObject({ statusCode: 422 });
  });
});

// ── getEmployerOpenRequirements ───────────────────────────────────────────────

describe('workerMappingApi.getEmployerOpenRequirements', () => {
  it('returns list of open requirements', async () => {
    const requirements = [
      { _id: 'req-001', workType: 'construction_project_workers', ERN_NUMBER: 1001, district: 'Pune' },
      { _id: 'req-002', workType: 'household_domestic_workers', ERN_NUMBER: 1002, district: 'Mumbai' },
    ];
    mock.onGet('/api/v1/mapping/employer/requirements').reply(200, { success: true, requirements });
    const res = await workerMappingApi.getEmployerOpenRequirements();
    expect(res).toHaveLength(2);
    expect(res[0]._id).toBe('req-001');
  });

  it('returns empty array when requirements is missing', async () => {
    mock.onGet('/api/v1/mapping/employer/requirements').reply(200, { success: true });
    const res = await workerMappingApi.getEmployerOpenRequirements();
    expect(res).toEqual([]);
  });

  it('throws on unauthorized access', async () => {
    mock.onGet('/api/v1/mapping/employer/requirements').reply(401, { message: 'Unauthorized' });
    await expect(workerMappingApi.getEmployerOpenRequirements()).rejects.toMatchObject({ statusCode: 401 });
  });
});

// ── getRequirementMappings ────────────────────────────────────────────────────

describe('workerMappingApi.getRequirementMappings', () => {
  it('returns mappings and grouped data', async () => {
    const response = {
      success: true,
      mappings: [mapping],
      grouped: {
        Shortlisted: [mapping],
        Selected: [],
        Joined: [],
      },
    };
    mock.onGet('/api/v1/mapping/requirement/req-001').reply(200, response);
    const res = await workerMappingApi.getRequirementMappings('req-001');
    expect(res.mappings).toHaveLength(1);
    expect(res.grouped.Shortlisted).toHaveLength(1);
    expect(res.grouped.Selected).toHaveLength(0);
  });

  it('throws 404 when requirement not found', async () => {
    mock.onGet('/api/v1/mapping/requirement/missing').reply(404, { message: 'Requirement not found' });
    await expect(workerMappingApi.getRequirementMappings('missing'))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── updateMappingStatus ───────────────────────────────────────────────────────

describe('workerMappingApi.updateMappingStatus', () => {
  it('advances worker from Shortlisted to Selected', async () => {
    const updated = { ...mapping, status: 'Selected' as const };
    mock.onPut('/api/v1/mapping/map-001/status').reply(200, {
      success: true,
      message: 'Status updated',
      mapping: updated,
    });
    const res = await workerMappingApi.updateMappingStatus('map-001', 'Selected');
    expect(res.mapping.status).toBe('Selected');
    expect(res.success).toBe(true);
  });

  it('advances to Joined status', async () => {
    const updated = { ...mapping, status: 'Joined' as const };
    mock.onPut('/api/v1/mapping/map-001/status').reply(200, {
      success: true, message: 'Joined', mapping: updated,
    });
    const res = await workerMappingApi.updateMappingStatus('map-001', 'Joined');
    expect(res.mapping.status).toBe('Joined');
  });

  it('throws on invalid status transition', async () => {
    mock.onPut('/api/v1/mapping/map-001/status').reply(400, { message: 'Cannot transition from Joined to Shortlisted' });
    await expect(workerMappingApi.updateMappingStatus('map-001', 'Shortlisted'))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

// ── removeShortlist ───────────────────────────────────────────────────────────

describe('workerMappingApi.removeShortlist', () => {
  it('removes shortlisted worker and returns success', async () => {
    mock.onDelete('/api/v1/mapping/map-001').reply(200, { success: true, message: 'Removed from shortlist' });
    const res = await workerMappingApi.removeShortlist('map-001');
    expect(res.success).toBe(true);
  });

  it('throws when trying to remove non-Shortlisted worker', async () => {
    mock.onDelete('/api/v1/mapping/map-002').reply(400, { message: 'Can only remove Shortlisted workers' });
    await expect(workerMappingApi.removeShortlist('map-002'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 when mapping not found', async () => {
    mock.onDelete('/api/v1/mapping/nonexistent').reply(404, { message: 'Mapping not found' });
    await expect(workerMappingApi.removeShortlist('nonexistent'))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── getEmployerPipelineOverview ───────────────────────────────────────────────

describe('workerMappingApi.getEmployerPipelineOverview', () => {
  it('returns totals and per-requirement worker lists', async () => {
    const response = {
      success: true,
      totals: { Shortlisted: 5, Selected: 3, Joined: 2 },
      requirements: [
        {
          requirement: { _id: 'req-001', workType: 'construction_project_workers' },
          counts: { Shortlisted: 2, Selected: 1, Joined: 1 },
          workers: [mapping],
        },
      ],
    };
    mock.onGet('/api/v1/mapping/employer/pipeline-overview').reply(200, response);
    const res = await workerMappingApi.getEmployerPipelineOverview();
    expect(res.totals.Shortlisted).toBe(5);
    expect(res.requirements).toHaveLength(1);
    expect(res.requirements[0].workers).toHaveLength(1);
  });

  it('throws on server error', async () => {
    mock.onGet('/api/v1/mapping/employer/pipeline-overview').reply(500, { message: 'Server error' });
    await expect(workerMappingApi.getEmployerPipelineOverview()).rejects.toMatchObject({ statusCode: 500 });
  });
});
