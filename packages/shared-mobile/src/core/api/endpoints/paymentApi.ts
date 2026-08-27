import { apiClient } from '../client';

export const GST_RATE = 0.18;

export interface SubscriptionPlanId {
  id: '1m' | '6m' | '12m';
}

export interface InitTransactionPayload {
  employerId: string;
  firstName: string;
  email: string;
  employerType: string;
  employer_phone: string;
  paymentType: 'subscription';
  amount: number;
  gstCharges: number;
  productName: string;
  planId: string;
  // Optional — collected at checkout when the employer's profile has no GST
  // on file, so it prints on the invoice (backend falls back to this when
  // profile KYC has no GST).
  gstNumber?: string;
}

export interface InitTransactionResponse {
  url: string;
  merchantOrderId: string;
}

export interface TopupPayload {
  employerId: string;
  firstName: string;
  email: string;
  employer_phone: string;
  amount: number;
  gstCharges: number;
  contactCount: 50 | 100;
  ernStatus: 'contact_topup';
}

export interface VerifiedBadgePayload {
  employerId: string;
  firstName: string;
  email: string;
  employer_phone: string;
  role: string;
  price?: number;
  gstCharges?: number;
}

export const paymentApi = {
  initiateSubscription: async (payload: InitTransactionPayload): Promise<InitTransactionResponse> => {
    const res = await apiClient.post<InitTransactionResponse>('/api/v1/payment/add-trans', payload);
    return res.data;
  },

  initiateTopup: async (payload: TopupPayload): Promise<InitTransactionResponse> => {
    const res = await apiClient.post<InitTransactionResponse>('/api/v1/payment/add-topup-trans', payload);
    return res.data;
  },

  initiateVerifiedBadge: async (payload: VerifiedBadgePayload): Promise<InitTransactionResponse> => {
    const isAgent = payload.role === 'agent';
    const amount = payload.price ?? (isAgent ? 999 : 49);
    const gstCharges = payload.gstCharges ?? 0;
    const res = await apiClient.post<InitTransactionResponse>('/api/v1/payment/add-trans', {
      employerId: payload.employerId,
      firstName: payload.firstName,
      email: payload.email,
      employer_phone: payload.employer_phone,
      paymentType: 'verifiedbadge',
      amount,
      gstCharges,
      productName: 'Verified Badge',
    });
    return res.data;
  },
};
