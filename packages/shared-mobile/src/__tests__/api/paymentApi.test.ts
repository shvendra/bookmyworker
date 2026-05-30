/**
 * Unit tests for paymentApi — subscription, topup, verified badge.
 * Covers role-specific amount defaulting and GST calculation.
 */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { paymentApi, GST_RATE } from '../../core/api/endpoints/paymentApi';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

const mockTransactionResponse = {
  url: 'https://payment.gateway.com/pay/abc123',
  merchantOrderId: 'order-abc123',
};

const baseEmployer = {
  employerId: 'emp-001',
  firstName: 'Rajesh',
  email: 'rajesh@example.com',
  employer_phone: '9876543210',
};

// ── GST_RATE constant ─────────────────────────────────────────────────────────

describe('GST_RATE', () => {
  it('equals 18% (0.18)', () => {
    expect(GST_RATE).toBe(0.18);
  });
});

// ── initiateSubscription ──────────────────────────────────────────────────────

describe('paymentApi.initiateSubscription', () => {
  it('returns payment URL and merchantOrderId', async () => {
    mock.onPost('/api/v1/payment/add-trans').reply(200, mockTransactionResponse);
    const res = await paymentApi.initiateSubscription({
      ...baseEmployer,
      employerType: 'individual',
      paymentType: 'subscription',
      amount: 999,
      gstCharges: 180,
      productName: 'Basic Plan - 1 Month',
      planId: '1m',
    });
    expect(res.url).toBe('https://payment.gateway.com/pay/abc123');
    expect(res.merchantOrderId).toBe('order-abc123');
  });

  it('throws 400 when employer ID is missing', async () => {
    mock.onPost('/api/v1/payment/add-trans').reply(400, { message: 'Employer ID required' });
    await expect(paymentApi.initiateSubscription({
      employerId: '',
      firstName: 'A',
      email: 'a@b.com',
      employer_phone: '9000000000',
      employerType: 'individual',
      paymentType: 'subscription',
      amount: 999,
      gstCharges: 0,
      productName: 'Plan',
      planId: '1m',
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws on payment gateway error (502)', async () => {
    mock.onPost('/api/v1/payment/add-trans').reply(502, { message: 'Gateway unavailable' });
    await expect(paymentApi.initiateSubscription({
      ...baseEmployer,
      employerType: 'individual',
      paymentType: 'subscription',
      amount: 1999,
      gstCharges: 360,
      productName: '6 Month Plan',
      planId: '6m',
    })).rejects.toMatchObject({ statusCode: 502 });
  });
});

// ── initiateTopup ─────────────────────────────────────────────────────────────

describe('paymentApi.initiateTopup', () => {
  it('returns payment URL for contact topup', async () => {
    mock.onPost('/api/v1/payment/add-topup-trans').reply(200, mockTransactionResponse);
    const res = await paymentApi.initiateTopup({
      ...baseEmployer,
      amount: 499,
      gstCharges: 90,
      contactCount: 50,
      ernStatus: 'contact_topup',
    });
    expect(res.url).toContain('payment.gateway.com');
  });

  it('handles 100-contact topup', async () => {
    mock.onPost('/api/v1/payment/add-topup-trans').reply(200, mockTransactionResponse);
    const res = await paymentApi.initiateTopup({
      ...baseEmployer,
      amount: 799,
      gstCharges: 144,
      contactCount: 100,
      ernStatus: 'contact_topup',
    });
    expect(res.merchantOrderId).toBe('order-abc123');
  });

  it('throws on network error', async () => {
    mock.onPost('/api/v1/payment/add-topup-trans').networkError();
    await expect(paymentApi.initiateTopup({
      ...baseEmployer,
      amount: 499,
      gstCharges: 90,
      contactCount: 50,
      ernStatus: 'contact_topup',
    })).rejects.toBeInstanceOf(Error);
  });
});

// ── initiateVerifiedBadge ─────────────────────────────────────────────────────

describe('paymentApi.initiateVerifiedBadge', () => {
  it('uses ₹999 as default amount for agent role', async () => {
    let sentBody: Record<string, unknown> = {};
    mock.onPost('/api/v1/payment/add-trans').reply((config) => {
      sentBody = JSON.parse(config.data as string);
      return [200, mockTransactionResponse];
    });
    await paymentApi.initiateVerifiedBadge({
      ...baseEmployer,
      role: 'agent',
    });
    expect(sentBody.amount).toBe(999);
    expect(sentBody.paymentType).toBe('verifiedbadge');
    expect(sentBody.productName).toBe('Verified Badge');
  });

  it('uses ₹49 as default amount for non-agent role', async () => {
    let sentBody: Record<string, unknown> = {};
    mock.onPost('/api/v1/payment/add-trans').reply((config) => {
      sentBody = JSON.parse(config.data as string);
      return [200, mockTransactionResponse];
    });
    await paymentApi.initiateVerifiedBadge({
      ...baseEmployer,
      role: 'employer',
    });
    expect(sentBody.amount).toBe(49);
  });

  it('uses custom price when provided', async () => {
    let sentBody: Record<string, unknown> = {};
    mock.onPost('/api/v1/payment/add-trans').reply((config) => {
      sentBody = JSON.parse(config.data as string);
      return [200, mockTransactionResponse];
    });
    await paymentApi.initiateVerifiedBadge({
      ...baseEmployer,
      role: 'agent',
      price: 1499,
      gstCharges: 270,
    });
    expect(sentBody.amount).toBe(1499);
    expect(sentBody.gstCharges).toBe(270);
  });

  it('sends zero gstCharges by default when not provided', async () => {
    let sentBody: Record<string, unknown> = {};
    mock.onPost('/api/v1/payment/add-trans').reply((config) => {
      sentBody = JSON.parse(config.data as string);
      return [200, mockTransactionResponse];
    });
    await paymentApi.initiateVerifiedBadge({ ...baseEmployer, role: 'agent' });
    expect(sentBody.gstCharges).toBe(0);
  });

  it('returns payment URL', async () => {
    mock.onPost('/api/v1/payment/add-trans').reply(200, mockTransactionResponse);
    const res = await paymentApi.initiateVerifiedBadge({ ...baseEmployer, role: 'agent' });
    expect(res.url).toBeTruthy();
  });

  it('throws on 402 payment required', async () => {
    mock.onPost('/api/v1/payment/add-trans').reply(402, { message: 'Payment required' });
    await expect(paymentApi.initiateVerifiedBadge({ ...baseEmployer, role: 'agent' }))
      .rejects.toMatchObject({ statusCode: 402 });
  });
});
