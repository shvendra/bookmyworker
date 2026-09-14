/**
 * Unit tests for workforceRequirementsApi. Special focus: updateStatus must
 * NOT swallow the backend's exact error message when a cancel is blocked by
 * an outstanding balance — this is the single business-critical behavior
 * called out in the Workforce Management mobile plan.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import {
  workforceRequirementsApi,
  type PrivateWorkforceRequirement,
} from '../../core/api/endpoints/workforceRequirementsApi';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

const requirement: PrivateWorkforceRequirement = {
  _id: 'req-001',
  pwrNumber: 'PWR20240001',
  clientCompanyId: 'cc-001',
  siteId: 'site-001',
  workTypeId: 'wt-001',
  numberOfWorkers: 5,
  durationType: 'Ongoing',
  urgency: 'Standard',
  status: 'Submitted',
};

describe('workforceRequirementsApi.listMine', () => {
  it('returns the list of requirements', async () => {
    mock.onGet('/api/v1/workforce-requirements/mine').reply(200, { success: true, requirements: [requirement] });
    const res = await workforceRequirementsApi.listMine();
    expect(res).toHaveLength(1);
    expect(res[0].pwrNumber).toBe('PWR20240001');
  });

  it('returns empty array when no company is linked yet', async () => {
    mock.onGet('/api/v1/workforce-requirements/mine').reply(200, { success: true, requirements: [] });
    const res = await workforceRequirementsApi.listMine();
    expect(res).toEqual([]);
  });
});

describe('workforceRequirementsApi.create', () => {
  it('POSTs and returns the created requirement', async () => {
    mock.onPost('/api/v1/workforce-requirements').reply(201, { success: true, requirement });
    const res = await workforceRequirementsApi.create({
      siteId: 'site-001',
      workTypeId: 'wt-001',
      numberOfWorkers: 5,
      durationType: 'Ongoing',
    });
    expect(res._id).toBe('req-001');
  });
});

describe('workforceRequirementsApi.getById', () => {
  it('returns the requirement', async () => {
    mock.onGet('/api/v1/workforce-requirements/req-001').reply(200, { success: true, requirement });
    const res = await workforceRequirementsApi.getById('req-001');
    expect(res.status).toBe('Submitted');
  });

  it('propagates a 404', async () => {
    mock.onGet('/api/v1/workforce-requirements/missing').reply(404, { message: 'Requirement not found' });
    await expect(workforceRequirementsApi.getById('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('workforceRequirementsApi.updateStatus', () => {
  it('sends PUT with the target status and returns the updated requirement', async () => {
    mock.onPut('/api/v1/workforce-requirements/req-001/status').reply(200, {
      success: true,
      requirement: { ...requirement, status: 'Cancelled' },
    });
    const res = await workforceRequirementsApi.updateStatus('req-001', 'Cancelled');
    expect(res.status).toBe('Cancelled');
  });

  // Business-critical: an outstanding-balance block must surface verbatim,
  // not as a generic "Invalid request" toast. apiClient's response
  // interceptor reads error.response.data.message directly into the
  // rejected error's .message (see humanMessage/toApiError in client.ts) —
  // this test guards against that message ever being swallowed or replaced.
  it('propagates the backend\'s exact outstanding-balance message on a blocked cancel, not a generic error', async () => {
    const exactMessage =
      'You have an outstanding payment of ₹12500 on a previous invoice. Please clear it before cancelling this requirement — contact your account manager if you need help.';
    mock.onPut('/api/v1/workforce-requirements/req-001/status').reply(400, { message: exactMessage });

    await expect(workforceRequirementsApi.updateStatus('req-001', 'Cancelled')).rejects.toMatchObject({
      statusCode: 400,
      message: exactMessage,
    });
  });

  it('propagates an invalid-transition 400 verbatim', async () => {
    mock.onPut('/api/v1/workforce-requirements/req-001/status').reply(400, {
      message: 'Cannot move a Approved requirement to Cancelled',
    });
    await expect(workforceRequirementsApi.updateStatus('req-001', 'Cancelled')).rejects.toMatchObject({
      message: 'Cannot move a Approved requirement to Cancelled',
    });
  });
});

describe('workforceRequirementsApi attachments', () => {
  it('uploadAttachment sends multipart and returns the document', async () => {
    mock.onPost('/api/v1/workforce-requirements/req-001/attachments').reply(201, {
      success: true,
      document: {
        _id: 'doc-001', requirementId: 'req-001', employerId: 'user-001', name: 'PO.pdf',
        docType: 'Other', fileUrl: 'https://x/doc.pdf', fileKey: 'k', mimeType: 'application/pdf',
        fileSize: 1024, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z',
      },
    });
    const res = await workforceRequirementsApi.uploadAttachment({
      requirementId: 'req-001', fileUri: 'file:///tmp/po.pdf', fileName: 'PO.pdf', mimeType: 'application/pdf',
    });
    expect(res._id).toBe('doc-001');
  });

  it('listAttachments returns documents array', async () => {
    mock.onGet('/api/v1/workforce-requirements/req-001/attachments').reply(200, { success: true, documents: [] });
    const res = await workforceRequirementsApi.listAttachments('req-001');
    expect(res).toEqual([]);
  });

  it('deleteAttachment resolves with success message', async () => {
    mock.onDelete('/api/v1/workforce-requirements/attachments/doc-001').reply(200, { success: true, message: 'Attachment deleted' });
    const res = await workforceRequirementsApi.deleteAttachment('doc-001');
    expect(res.message).toBe('Attachment deleted');
  });
});
