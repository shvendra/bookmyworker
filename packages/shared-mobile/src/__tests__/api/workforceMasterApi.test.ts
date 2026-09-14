/**
 * Unit tests for workforceMasterApi — Employer-readable catalog reads
 * (Work Types, Sub Work Types, Skill Tags) used to build the New Requirement
 * form's pickers.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { workforceMasterApi } from '../../core/api/endpoints/workforceMasterApi';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

describe('workforceMasterApi.getWorkTypes', () => {
  it('returns the list of Active work types', async () => {
    mock.onGet('/api/v1/workforce/work-types').reply(200, {
      success: true,
      items: [{ _id: 'wt-001', name: 'Construction', status: 'Active' }],
    });
    const res = await workforceMasterApi.getWorkTypes();
    expect(res).toHaveLength(1);
    expect(res[0].name).toBe('Construction');
  });

  it('returns empty array when the response omits items', async () => {
    mock.onGet('/api/v1/workforce/work-types').reply(200, { success: true });
    const res = await workforceMasterApi.getWorkTypes();
    expect(res).toEqual([]);
  });
});

describe('workforceMasterApi.getSubWorkTypes', () => {
  it('passes workTypeId as a query param when provided', async () => {
    mock.onGet('/api/v1/workforce/sub-work-types').reply((config) => {
      expect(config.params).toEqual({ workTypeId: 'wt-001' });
      return [200, { success: true, items: [] }];
    });
    await workforceMasterApi.getSubWorkTypes('wt-001');
  });

  it('omits params entirely when no workTypeId is given', async () => {
    mock.onGet('/api/v1/workforce/sub-work-types').reply((config) => {
      expect(config.params).toBeUndefined();
      return [200, { success: true, items: [] }];
    });
    await workforceMasterApi.getSubWorkTypes();
  });
});

describe('workforceMasterApi.getSkillTags', () => {
  it('returns the list of skill tags', async () => {
    mock.onGet('/api/v1/workforce/skill-tags').reply(200, {
      success: true,
      items: [{ _id: 'st-001', name: 'Welding', status: 'Active' }],
    });
    const res = await workforceMasterApi.getSkillTags();
    expect(res).toHaveLength(1);
  });
});
