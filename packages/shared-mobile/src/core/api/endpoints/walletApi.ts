import { apiClient } from '../client';
import type { WalletTransaction } from '../../../shared/types/domain';

export interface AddTransactionPayload {
  amount: number;
  direction: 'credit' | 'debit';
  description: string;
  type: 'payout' | 'topup' | 'commission' | 'refund' | 'charge';
  requirementId?: string;
  referenceId?: string;
}

export interface WithdrawalPayload {
  requirementId: null;
  employerId: string | null;
  employerName: string | null;
  agentId: string | null;
  agentName: string | null;
  paymentType: 'debit';
  amount: number;
  creditTransactionId: null;
  creditStatus: 'pending';
  creditPaymentMethod: 'online';
  withdrawalStatus: 'pending';
  platformCharges: number;
  incentiveCharges: number;
  gstCharges: number;
  paymentStatus: 'pending';
  isEmployerCredit: false;
  isAgentWithdrawal: true;
}

export interface RawPaymentTransaction {
  _id: string;
  amount: number;
  paymentType: string;
  creditStatus?: string;
  paymentStatus?: string;
  withdrawalStatus?: string;
  createdAt: string;
  creditTransactionId?: string;
  incentiveCharges?: number;
  payoutComment?: string;
  isAgentWithdrawal?: boolean;
  isEmployerCredit?: boolean;
  platformCharges?: number;
  gstCharges?: number;
  agentId?: string;
  agentName?: string;
  employerId?: string;
  employerName?: string;
  ernNumber?: string;
  paymentDateTime?: string;
  gstNumber?: string;
  creditPaymentMethod?: string;
}

export interface AgentPayoutSummary {
  agentId: string;
  totalCredit: number;
  totalDebit: number;
  incentiveDebitAmount: number;
  availableAmount: number;
  incentiveAmount: number;
  debitTransactions: RawPaymentTransaction[];
}

export interface EmployerTransactions {
  transactions: RawPaymentTransaction[];
}

export interface AdminPayoutList {
  transactions: RawPaymentTransaction[];
  totalPages: number;
  currentPage: number;
  totalCount: number;
}

export const walletApi = {
  getAgentPayoutSummary: (agentId: string) =>
    apiClient
      .get<AgentPayoutSummary>(`/api/v1/payment/transactions/by-agent/${agentId}`)
      .then((r) => r.data),

  getEmployerTransactions: async (employerId: string): Promise<EmployerTransactions> => {
    try {
      const res = await apiClient.get<EmployerTransactions>(
        `/api/v1/payment/transactions/by-employer/${employerId}`
      );
      return res.data;
    } catch (err: unknown) {
      // Backend returns 404 when no completed transactions exist (not a real error)
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) return { transactions: [] };
      throw err;
    }
  },

  // Legacy compat
  getTransactionsByAgent: (agentId: string) =>
    apiClient
      .get<AgentPayoutSummary>(`/api/v1/payment/transactions/by-agent/${agentId}`)
      .then((r) => r.data),

  getTransactionsByRequirement: (requirementId: string) =>
    apiClient
      .get<WalletTransaction[]>(`/api/v1/payment/transactions/by-requirement/${requirementId}`)
      .then((r) => r.data),

  getTransactionsByErn: (ernNumber: string) =>
    apiClient
      .get<WalletTransaction[]>(`/api/v1/payment/transactions/by-ern/${ernNumber}`)
      .then((r) => r.data),

  addTransaction: (payload: AddTransactionPayload) =>
    apiClient.post<WalletTransaction>('/api/v1/payment/add-trans', payload).then((r) => r.data),

  requestWithdrawal: (payload: WithdrawalPayload) =>
    apiClient.post('/api/v1/payment/add-withdrawal', payload).then((r) => r.data),

  getMyWalletBalance: () =>
    apiClient
      .get<{ balance?: number; wallet?: { balance?: number } }>('/api/v1/payment/balance')
      .then((r) => {
        const body = r.data;
        return (body as { wallet?: { balance?: number } }).wallet?.balance ?? (body as { balance?: number }).balance ?? 0;
      }),

  getAdminPayoutList: (params: {
    paymentType: 'debit' | 'credit';
    paymentStatus?: string;
    creditStatus?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient
      .get<AdminPayoutList>('/api/v1/payment/agents-payout-list', { params })
      .then((r) => r.data),

  updatePayout: (id: string, data: {
    amount?: number;
    incentiveCharges?: number;
    payoutComment?: string;
    paymentStatus?: string;
    creditTransactionId?: string;
  }) =>
    apiClient.put(`/api/v1/payment/approve-payout/${id}`, data).then((r) => r.data),
};
