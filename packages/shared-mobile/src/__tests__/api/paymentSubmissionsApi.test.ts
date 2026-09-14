/**
 * Unit tests for paymentSubmissionsApi — payment-claim submission (multipart),
 * listing, refunds, and the company ledger. Note that the backend's own
 * status field is literally "Submitted", not "Pending" or "Paid" — the UI
 * layer is responsible for the "Pending Verification" copy (Requirement #16).
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { paymentSubmissionsApi, type PaymentSubmission } from '../../core/api/endpoints/paymentSubmissionsApi';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

const submission: PaymentSubmission = {
  _id: 'sub-001',
  invoiceId: 'inv-001',
  clientCompanyId: 'cc-001',
  amountPaid: 11800,
  paymentDate: '2024-06-15T00:00:00.000Z',
  paymentMode: 'UPI',
  utrOrTransactionRef: 'UPI123456789',
  proofFileUrl: 'https://x/proof.pdf',
  status: 'Submitted',
};

describe('paymentSubmissionsApi.submit', () => {
  it('POSTs multipart form-data and returns the created submission', async () => {
    mock.onPost('/api/v1/payment-submissions').reply((config) => {
      expect(config.headers?.['Content-Type']).toBe('multipart/form-data');
      expect(config.data).toBeInstanceOf(FormData);
      return [201, { success: true, submission }];
    });
    const res = await paymentSubmissionsApi.submit({
      invoiceId: 'inv-001',
      amountPaid: 11800,
      paymentDate: '2024-06-15',
      paymentMode: 'UPI',
      utrOrTransactionRef: 'UPI123456789',
      fileUri: 'file:///tmp/proof.pdf',
      fileName: 'proof.pdf',
      mimeType: 'application/pdf',
    });
    expect(res._id).toBe('sub-001');
    // The submission is a claim — never surfaced as paid until Verified.
    expect(res.status).toBe('Submitted');
  });

  it('propagates a 400 when required fields are missing', async () => {
    mock.onPost('/api/v1/payment-submissions').reply(400, {
      message: 'Amount, date, mode and transaction reference are required',
    });
    await expect(
      paymentSubmissionsApi.submit({
        invoiceId: 'inv-001',
        amountPaid: 0,
        paymentDate: '',
        paymentMode: 'UPI',
        utrOrTransactionRef: '',
        fileUri: 'file:///tmp/proof.pdf',
        fileName: 'proof.pdf',
        mimeType: 'application/pdf',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('paymentSubmissionsApi.listForInvoice', () => {
  it('returns submissions for the invoice', async () => {
    mock.onGet('/api/v1/payment-submissions').reply((config) => {
      expect(config.params).toEqual({ invoiceId: 'inv-001' });
      return [200, { success: true, submissions: [submission] }];
    });
    const res = await paymentSubmissionsApi.listForInvoice('inv-001');
    expect(res).toHaveLength(1);
  });
});

describe('paymentSubmissionsApi.listRefunds', () => {
  it('returns refunds for the invoice', async () => {
    mock.onGet('/api/v1/payment-submissions/refunds').reply(200, { success: true, refunds: [] });
    const res = await paymentSubmissionsApi.listRefunds('inv-001');
    expect(res).toEqual([]);
  });
});

describe('paymentSubmissionsApi.getLedger', () => {
  it('returns the reconciliation ledger', async () => {
    mock.onGet('/api/v1/payment-submissions/ledger').reply(200, {
      success: true,
      creditBalance: 500,
      totalInvoiced: 11800,
      totalVerifiedPaid: 0,
      totalOutstanding: 11800,
      rows: [],
    });
    const res = await paymentSubmissionsApi.getLedger('cc-001');
    expect(res.totalOutstanding).toBe(11800);
    expect(res.creditBalance).toBe(500);
  });
});
