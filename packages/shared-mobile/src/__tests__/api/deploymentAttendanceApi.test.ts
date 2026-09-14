/**
 * Unit tests for deploymentAttendanceApi — Employer-scope Summary attendance
 * only (getCycle, submitSummary, list). Daily/lock/correction-approval stay
 * CRM-only and intentionally have no wrapper functions here.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { deploymentAttendanceApi, type PayrollCycle } from '../../core/api/endpoints/deploymentAttendanceApi';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

const cycle: PayrollCycle = {
  _id: 'cycle-001',
  clientCompanyId: 'cc-001',
  periodStart: '2024-06-01T00:00:00.000Z',
  periodEnd: '2024-06-30T00:00:00.000Z',
  cycleType: 'Monthly',
  status: 'Open',
};

describe('deploymentAttendanceApi.getCycle', () => {
  it('fetches the cycle for a company + month', async () => {
    mock.onGet('/api/v1/deployment-attendance/cycle').reply((config) => {
      expect(config.params).toEqual({ clientCompanyId: 'cc-001', month: '2024-06' });
      return [200, { success: true, cycle }];
    });
    const res = await deploymentAttendanceApi.getCycle('cc-001', '2024-06');
    expect(res.status).toBe('Open');
  });

  it('propagates 403 when the caller does not own the company', async () => {
    mock.onGet('/api/v1/deployment-attendance/cycle').reply(403, { message: 'Not authorized' });
    await expect(deploymentAttendanceApi.getCycle('cc-002', '2024-06')).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('deploymentAttendanceApi.submitSummary', () => {
  it('returns the attendance record on a normal create/update', async () => {
    mock.onPost('/api/v1/deployment-attendance/summary').reply(201, {
      success: true,
      attendance: { _id: 'att-001', deploymentId: 'dep-001', cycleId: 'cycle-001', entryMode: 'Summary', daysPresent: 22 },
    });
    const res = await deploymentAttendanceApi.submitSummary({ deploymentId: 'dep-001', month: '2024-06', daysPresent: 22 });
    expect(res.attendance?.daysPresent).toBe(22);
    expect(res.correction).toBeUndefined();
  });

  it('returns a pending-approval correction when the cycle is Locked', async () => {
    mock.onPost('/api/v1/deployment-attendance/summary').reply(201, {
      success: true,
      correction: { _id: 'att-002', deploymentId: 'dep-001', cycleId: 'cycle-001', entryMode: 'Summary', daysPresent: 20, correctionOf: 'att-001' },
      message: 'Cycle is locked — correction recorded, pending approval',
    });
    const res = await deploymentAttendanceApi.submitSummary({ deploymentId: 'dep-001', month: '2024-06', daysPresent: 20 });
    expect(res.correction?.correctionOf).toBe('att-001');
    expect(res.message).toContain('pending approval');
  });

  it('propagates a 400 when days present exceeds the deployment overlap', async () => {
    mock.onPost('/api/v1/deployment-attendance/summary').reply(400, {
      message: 'Days present (35) exceeds the 30 day(s) this deployment was active in this cycle',
    });
    await expect(
      deploymentAttendanceApi.submitSummary({ deploymentId: 'dep-001', month: '2024-06', daysPresent: 35 }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('deploymentAttendanceApi.list', () => {
  it('returns records for a deployment', async () => {
    mock.onGet('/api/v1/deployment-attendance').reply(200, { success: true, records: [] });
    const res = await deploymentAttendanceApi.list('dep-001');
    expect(res).toEqual([]);
  });

  it('includes cycleId in params when provided', async () => {
    mock.onGet('/api/v1/deployment-attendance').reply((config) => {
      expect(config.params).toEqual({ deploymentId: 'dep-001', cycleId: 'cycle-001' });
      return [200, { success: true, records: [] }];
    });
    await deploymentAttendanceApi.list('dep-001', 'cycle-001');
  });
});
