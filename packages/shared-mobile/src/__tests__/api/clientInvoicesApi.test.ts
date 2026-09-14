/**
 * Unit tests for clientInvoicesApi — Employer-owner invoice listing/detail.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { clientInvoicesApi, type ClientInvoice } from '../../core/api/endpoints/clientInvoicesApi';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

const invoice: ClientInvoice = {
  _id: 'inv-001',
  invoiceNumber: 'INV-2024-0001',
  clientCompanyId: 'cc-001',
  cycleId: 'cycle-001',
  lineItems: [],
  subtotal: 10000,
  gstRate: 18,
  gstAmount: 1800,
  totalAmount: 11800,
  status: 'Issued',
};

describe('clientInvoicesApi.listMine', () => {
  it('fetches invoices scoped by clientCompanyId', async () => {
    mock.onGet('/api/v1/client-invoices').reply((config) => {
      expect(config.params).toEqual({ clientCompanyId: 'cc-001' });
      return [200, { success: true, invoices: [invoice] }];
    });
    const res = await clientInvoicesApi.listMine('cc-001');
    expect(res).toHaveLength(1);
    expect(res[0].invoiceNumber).toBe('INV-2024-0001');
  });

  it('returns empty array when the response omits invoices', async () => {
    mock.onGet('/api/v1/client-invoices').reply(200, { success: true });
    const res = await clientInvoicesApi.listMine('cc-001');
    expect(res).toEqual([]);
  });
});

describe('clientInvoicesApi.getById', () => {
  it('returns the invoice', async () => {
    mock.onGet('/api/v1/client-invoices/inv-001').reply(200, { success: true, invoice });
    const res = await clientInvoicesApi.getById('inv-001');
    expect(res.totalAmount).toBe(11800);
  });

  it('propagates a 403 for a Draft invoice not owned by the caller', async () => {
    mock.onGet('/api/v1/client-invoices/inv-002').reply(403, { message: 'Not authorized' });
    await expect(clientInvoicesApi.getById('inv-002')).rejects.toMatchObject({ statusCode: 403 });
  });
});
