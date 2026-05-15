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

export const paymentApi = {
  initiateSubscription: async (payload: InitTransactionPayload): Promise<InitTransactionResponse> => {
    const res = await apiClient.post<InitTransactionResponse>('/api/v1/payment/add-trans', payload);
    return res.data;
  },

  initiateTopup: async (payload: TopupPayload): Promise<InitTransactionResponse> => {
    const res = await apiClient.post<InitTransactionResponse>('/api/v1/payment/add-topup-trans', payload);
    return res.data;
  },
};
