/**
 * Unit tests for walletApi — balance, transactions, withdrawal, payout, invoice URL.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { walletApi, type RawPaymentTransaction } from '../../core/api/endpoints/walletApi';
import { getAccessToken } from '../../core/storage/authStorage';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

const tx: RawPaymentTransaction = {
  _id: 'tx-001',
  amount: 1000,
  paymentType: 'debit',
  creditStatus: 'approved',
  paymentStatus: 'completed',
  createdAt: '2024-01-15T10:00:00.000Z',
  agentId: 'agent-001',
  agentName: 'Ravi',
  isAgentWithdrawal: true,
};

// ── getAgentPayoutSummary ─────────────────────────────────────────────────────

describe('walletApi.getAgentPayoutSummary', () => {
  it('returns agent payout summary', async () => {
    const payload = {
      agentId: 'agent-001',
      totalCredit: 5000,
      totalDebit: 2000,
      incentiveDebitAmount: 100,
      availableAmount: 3000,
      incentiveAmount: 200,
      debitTransactions: [tx],
    };
    mock.onGet('/api/v1/payment/transactions/by-agent/agent-001').reply(200, payload);
    const res = await walletApi.getAgentPayoutSummary('agent-001');
    expect(res.agentId).toBe('agent-001');
    expect(res.availableAmount).toBe(3000);
    expect(res.debitTransactions).toHaveLength(1);
  });

  it('throws on server error', async () => {
    mock.onGet('/api/v1/payment/transactions/by-agent/bad-id').reply(500, { message: 'Server error' });
    await expect(walletApi.getAgentPayoutSummary('bad-id')).rejects.toMatchObject({ statusCode: 500 });
  });
});

// ── getEmployerTransactions ───────────────────────────────────────────────────

describe('walletApi.getEmployerTransactions', () => {
  it('returns employer transactions', async () => {
    mock.onGet('/api/v1/payment/transactions/by-employer/emp-001').reply(200, { transactions: [tx] });
    const res = await walletApi.getEmployerTransactions('emp-001');
    expect(res.transactions).toHaveLength(1);
  });

  it('returns empty transactions array on 404 (no transactions yet)', async () => {
    mock.onGet('/api/v1/payment/transactions/by-employer/emp-new').reply(404, { message: 'Not found' });
    const res = await walletApi.getEmployerTransactions('emp-new');
    expect(res.transactions).toEqual([]);
  });

  it('re-throws non-404 errors', async () => {
    mock.onGet('/api/v1/payment/transactions/by-employer/emp-err').reply(500, { message: 'Internal error' });
    await expect(walletApi.getEmployerTransactions('emp-err')).rejects.toMatchObject({ statusCode: 500 });
  });
});

// ── getTransactionsByAgent (legacy) ──────────────────────────────────────────

describe('walletApi.getTransactionsByAgent', () => {
  it('returns same payload as getAgentPayoutSummary', async () => {
    const payload = { agentId: 'a1', totalCredit: 1000, debitTransactions: [] };
    mock.onGet('/api/v1/payment/transactions/by-agent/a1').reply(200, payload);
    const res = await walletApi.getTransactionsByAgent('a1');
    expect(res.agentId).toBe('a1');
  });
});

// ── getTransactionsByRequirement ──────────────────────────────────────────────

describe('walletApi.getTransactionsByRequirement', () => {
  it('returns transaction list', async () => {
    mock.onGet('/api/v1/payment/transactions/by-requirement/req-001').reply(200, [tx]);
    const res = await walletApi.getTransactionsByRequirement('req-001');
    expect(res).toHaveLength(1);
    expect((res[0] as unknown as { _id: string })._id).toBe('tx-001');
  });
});

// ── getTransactionsByErn ──────────────────────────────────────────────────────

describe('walletApi.getTransactionsByErn', () => {
  it('returns transactions for given ERN', async () => {
    mock.onGet('/api/v1/payment/transactions/by-ern/ERN20240001').reply(200, [tx]);
    const res = await walletApi.getTransactionsByErn('ERN20240001');
    expect(res[0].amount).toBe(1000);
  });
});

// ── addTransaction ────────────────────────────────────────────────────────────

describe('walletApi.addTransaction', () => {
  it('creates a transaction and returns it', async () => {
    const newTx = { ...tx, _id: 'tx-new', amount: 500 };
    mock.onPost('/api/v1/payment/add-trans').reply(201, newTx);
    const res = await walletApi.addTransaction({
      amount: 500,
      direction: 'credit',
      description: 'Commission earned',
      type: 'commission',
    });
    expect((res as unknown as { _id: string })._id).toBe('tx-new');
  });

  it('throws on validation error', async () => {
    mock.onPost('/api/v1/payment/add-trans').reply(422, { message: 'Amount must be positive' });
    await expect(walletApi.addTransaction({ amount: -1, direction: 'debit', description: 'x', type: 'payout' }))
      .rejects.toMatchObject({ statusCode: 422 });
  });
});

// ── requestWithdrawal ─────────────────────────────────────────────────────────

describe('walletApi.requestWithdrawal', () => {
  it('submits withdrawal request', async () => {
    mock.onPost('/api/v1/payment/add-withdrawal').reply(200, { success: true });
    const res = await walletApi.requestWithdrawal({
      requirementId: null,
      employerId: null,
      employerName: null,
      agentId: 'agent-001',
      agentName: 'Ravi',
      paymentType: 'debit',
      amount: 2000,
      creditTransactionId: null,
      creditStatus: 'pending',
      creditPaymentMethod: 'online',
      withdrawalStatus: 'pending',
      platformCharges: 50,
      incentiveCharges: 0,
      gstCharges: 9,
      paymentStatus: 'pending',
      isEmployerCredit: false,
      isAgentWithdrawal: true,
    });
    expect(res).toEqual({ success: true });
  });
});

// ── getMyWalletBalance ────────────────────────────────────────────────────────

describe('walletApi.getMyWalletBalance', () => {
  it('extracts balance from { wallet: { balance } } shape', async () => {
    mock.onGet('/api/v1/payment/balance').reply(200, { wallet: { balance: 3500 } });
    const res = await walletApi.getMyWalletBalance();
    expect(res).toBe(3500);
  });

  it('extracts balance from flat { balance } shape', async () => {
    mock.onGet('/api/v1/payment/balance').reply(200, { balance: 2000 });
    const res = await walletApi.getMyWalletBalance();
    expect(res).toBe(2000);
  });

  it('returns 0 when balance is missing', async () => {
    mock.onGet('/api/v1/payment/balance').reply(200, {});
    const res = await walletApi.getMyWalletBalance();
    expect(res).toBe(0);
  });
});

// ── getAdminPayoutList ────────────────────────────────────────────────────────

describe('walletApi.getAdminPayoutList', () => {
  it('returns paginated payout list', async () => {
    const payload = { transactions: [tx], totalPages: 3, currentPage: 1, totalCount: 30 };
    mock.onGet('/api/v1/payment/agents-payout-list').reply(200, payload);
    const res = await walletApi.getAdminPayoutList({ paymentType: 'debit', page: 1, limit: 10 });
    expect(res.totalPages).toBe(3);
    expect(res.transactions).toHaveLength(1);
  });
});

// ── updatePayout ──────────────────────────────────────────────────────────────

describe('walletApi.updatePayout', () => {
  it('approves payout and returns updated transaction', async () => {
    mock.onPut('/api/v1/payment/approve-payout/tx-001').reply(200, { ...tx, paymentStatus: 'completed' });
    const res = await walletApi.updatePayout('tx-001', {
      paymentStatus: 'completed',
      payoutComment: 'Approved by admin',
    });
    expect((res as { paymentStatus: string }).paymentStatus).toBe('completed');
  });
});

// ── getInvoiceUrl ─────────────────────────────────────────────────────────────

describe('walletApi.getInvoiceUrl', () => {
  it('builds invoice URL with token appended', async () => {
    (getAccessToken as jest.Mock).mockResolvedValue('my-auth-token');
    const url = await walletApi.getInvoiceUrl('tx-001');
    expect(url).toContain('/api/v1/payment/invoice/tx-001');
    expect(url).toContain('token=my-auth-token');
  });

  it('handles null token gracefully (empty string in URL)', async () => {
    (getAccessToken as jest.Mock).mockResolvedValue(null);
    const url = await walletApi.getInvoiceUrl('tx-002');
    expect(url).toContain('token=');
    expect(url).toContain('tx-002');
  });
});
