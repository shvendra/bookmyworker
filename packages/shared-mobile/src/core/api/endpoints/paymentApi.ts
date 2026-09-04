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
  // Optional coupon code applied at checkout. The backend re-validates and
  // recomputes the discount server-side — this is never trusted as-is.
  couponCode?: string;
}

export interface CouponMeta {
  code: string;
  label: string;
  discountPercent: number;
}

export interface CouponPricing {
  basePrice: number;
  discountAmount: number;
  discountedBase: number;
  gstCharges: number;
  totalAmount: number;
}

export type ValidateCouponResponse =
  | { success: true; valid: true; coupon: CouponMeta; pricing?: CouponPricing }
  | { success: true; valid: false; message: string };

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
  // Preview a coupon before paying. Omit planId to just check the code is
  // valid & the employer is eligible; pass it to also get the discounted
  // price breakdown for that specific plan.
  validateCoupon: async (params: { code: string; employerType: string; planId?: string }): Promise<ValidateCouponResponse> => {
    const res = await apiClient.post<ValidateCouponResponse>('/api/v1/coupons/validate', params);
    return res.data;
  },

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
