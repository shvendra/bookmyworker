/** Police Verification (BGC) — employer API client + pricing maths. */
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../core/storage/authStorage', () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  clearAuthSession: jest.fn(),
}));
jest.mock('../../state/auth/authEventBus', () => ({ emitForceSignOut: jest.fn() }));

import { apiClient } from '../../core/api/client';
import { bgcApi, computeBgcQuote } from '../../core/api/endpoints/bgcApi';

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); jest.clearAllMocks(); });

const CFG = { enabled: true, pricePerWorker: 500, gstPercent: 18, bulkDiscounts: [{ minWorkers: 2, percent: 10 }, { minWorkers: 5, percent: 20 }] };

describe('computeBgcQuote', () => {
  it('adds GST on the base price', () => {
    expect(computeBgcQuote(CFG, 1)).toMatchObject({ subtotal: 500, discountAmount: 0, gstAmount: 90, total: 590 });
  });
  it('applies the highest matching bulk tier before GST', () => {
    expect(computeBgcQuote(CFG, 2)).toMatchObject({ subtotal: 1000, discountPercent: 10, discountAmount: 100, taxable: 900, gstAmount: 162, total: 1062 });
    expect(computeBgcQuote(CFG, 5)).toMatchObject({ discountPercent: 20, taxable: 2000, total: 2360 });
  });
  it('is safe for a missing config / bad count', () => {
    expect(computeBgcQuote(undefined, 0)).toMatchObject({ count: 1, total: 0 });
    expect(computeBgcQuote(CFG, NaN).count).toBe(1);
  });
});

describe('bgcApi', () => {
  it('getConfig is fail-closed unless enabled === true', async () => {
    mock.onGet('/api/v1/bgc/config').replyOnce(200, { config: { enabled: 'true' } });
    expect(await bgcApi.getConfig()).toEqual({ enabled: false });
    mock.onGet('/api/v1/bgc/config').replyOnce(200, { config: CFG });
    expect((await bgcApi.getConfig()).pricePerWorker).toBe(500);
    mock.onGet('/api/v1/bgc/config').replyOnce(200, {});
    expect(await bgcApi.getConfig()).toEqual({ enabled: false });
  });
  it('lookupWorker sends the phone and normalises the answer', async () => {
    mock.onGet('/api/v1/bgc/my/lookup-worker', { params: { phone: '9876543210' } }).reply(200, { found: true, worker: { name: 'Ravi' } });
    expect(await bgcApi.lookupWorker('9876543210')).toEqual({ found: true, worker: { name: 'Ravi' } });
    mock.onGet('/api/v1/bgc/my/lookup-worker').reply(200, {});
    expect(await bgcApi.lookupWorker('9000000000')).toEqual({ found: false, worker: null });
  });
  it('createOrder posts workers with consent and returns the payment url', async () => {
    mock.onPost('/api/v1/bgc/my/orders').reply((cfg) => {
      const body = JSON.parse(cfg.data);
      return body.consent === true && body.workers.length === 1 ? [201, { url: 'https://pay', merchantOrderId: 'BGC_1', orderNumber: 'BGO1', total: 590 }] : [400, {}];
    });
    const r = await bgcApi.createOrder([{ name: 'R' } as never]);
    expect(r).toMatchObject({ url: 'https://pay', merchantOrderId: 'BGC_1' });
  });
  it('lists orders, pays again, and fetches invoice / certificate links', async () => {
    mock.onGet('/api/v1/bgc/my/orders').reply(200, { orders: [{ _id: 'o1' }] });
    expect(await bgcApi.listOrders()).toEqual([{ _id: 'o1' }]);
    mock.onGet('/api/v1/bgc/my/orders').reply(200, {});
    expect(await bgcApi.listOrders()).toEqual([]);
    mock.onPost('/api/v1/bgc/my/orders/o1/pay').reply(200, { url: 'https://pay2', merchantOrderId: 'BGC_2' });
    expect((await bgcApi.payAgain('o1')).url).toBe('https://pay2');
    mock.onGet('/api/v1/bgc/my/orders/o1/invoice-link').reply(200, { url: 'https://inv' });
    expect(await bgcApi.invoiceLink('o1')).toBe('https://inv');
    mock.onGet('/api/v1/bgc/my/cases/c1/certificate-link').reply(200, { url: 'https://cert' });
    expect(await bgcApi.certificateLink('c1')).toBe('https://cert');
  });
  it('surfaces the server message when the order is rejected', async () => {
    mock.onPost('/api/v1/bgc/my/orders').reply(409, { message: 'Ravi is already under verification' });
    await expect(bgcApi.createOrder([])).rejects.toThrow(/already under verification/);
  });
});

describe('computeBgcQuote — volume slabs', () => {
  const priceTiers = [
    { name: 'Standard', minWorkers: 1, maxWorkers: 10, pricePerWorker: 299 },
    { name: 'Corporate Bulk', minWorkers: 11, maxWorkers: 50, pricePerWorker: 249 },
    { name: 'Large Volume', minWorkers: 201, maxWorkers: 0, pricePerWorker: 149, priceMax: 179, contractOnly: true },
  ];
  const c = { enabled: true, pricePerWorker: 299, gstPercent: 18, priceTiers, bulkDiscounts: [{ minWorkers: 2, percent: 50 }] };
  it('charges the whole order at its slab and ignores % bulk discounts', () => {
    expect(computeBgcQuote(c, 1)).toMatchObject({ unit: 299, discountAmount: 0, total: 352.82 });
    expect(computeBgcQuote(c, 11)).toMatchObject({ unit: 249, subtotal: 2739, total: 3232.02 });
  });
  it('labels slabs', () => {
    const { bgcSlabRange, bgcSlabPrice } = require('../../core/api/endpoints/bgcApi');
    expect(bgcSlabRange(priceTiers[0])).toBe('1–10 workers');
    expect(bgcSlabRange(priceTiers[2])).toBe('201+ workers');
    expect(bgcSlabPrice(priceTiers[0])).toBe('₹299');
    expect(bgcSlabPrice(priceTiers[2])).toBe('₹149–179');
  });
});

describe('documents & requests API', () => {
  const file = { uri: 'file:///x/aadhaar.jpg', name: 'aadhaar.jpg', mimeType: 'image/jpeg', size: 1234 };
  it('uploadDoc posts multipart and returns the signed doc ref', async () => {
    mock.onPost('/api/v1/bgc/my/uploads').reply(201, { document: { docRef: 'ref1', docType: 'aadhaar', label: 'Aadhaar card', fileName: 'aadhaar.jpg', size: 1234 } });
    const { bgcApi } = require('../../core/api/endpoints/bgcApi');
    const doc = await bgcApi.uploadDoc(file, 'aadhaar');
    expect(doc.docRef).toBe('ref1');
  });
  it('respond posts to the right request and returns the refreshed case', async () => {
    mock.onPost('/api/v1/bgc/my/cases/c1/requests/r1/respond').reply(200, { case: { _id: 'c1', status: 'on_hold' } });
    const { bgcApi } = require('../../core/api/endpoints/bgcApi');
    expect((await bgcApi.respond('c1', 'r1', [file], 'aadhaar', 'hello')).status).toBe('on_hold');
  });
  it('documentLink returns the signed url', async () => {
    mock.onGet('/api/v1/bgc/my/cases/c1/documents/d1/link').reply(200, { url: 'https://api/doc/tok' });
    const { bgcApi } = require('../../core/api/endpoints/bgcApi');
    expect(await bgcApi.documentLink('c1', 'd1')).toBe('https://api/doc/tok');
  });
  it('bgcError reads field errors and falls back safely', () => {
    const { bgcError } = require('../../core/api/endpoints/bgcApi');
    expect(bgcError({ message: 'Bad', data: { errors: { 'workers.0.name': 'Enter name' } } })).toEqual({ message: 'Bad', fields: { 'workers.0.name': 'Enter name' } });
    expect(bgcError({ message: 'Bad', details: { consent: 'Tick it' } }).fields).toEqual({ consent: 'Tick it' });
    expect(bgcError({ message: 'x', data: { errors: ['a'] } }).fields).toEqual({});
    expect(bgcError(null, 'fallback')).toEqual({ message: 'fallback', fields: {} });
  });
});

describe('buyer KYC API', () => {
  it('getKyc returns the buyer\'s KYC state (employers submit it from Profile → KYC)', async () => {
    const { bgcApi } = require('../../core/api/endpoints/bgcApi');
    mock.onGet('/api/v1/bgc/my/kyc').reply(200, { kyc: { required: true, status: 'missing', ok: false } });
    expect((await bgcApi.getKyc()).status).toBe('missing');
  });
  it('createOrder never sends a kyc block (KYC is not part of checkout)', async () => {
    const { bgcApi } = require('../../core/api/endpoints/bgcApi');
    const bodies: Array<Record<string, unknown>> = [];
    mock.onPost('/api/v1/bgc/my/orders').reply((cfg) => { bodies.push(JSON.parse(cfg.data)); return [201, { url: 'u', merchantOrderId: 'm', orderNumber: 'o', total: 1 }]; });
    await bgcApi.createOrder([]);
    expect(bodies[0]).toEqual({ workers: [], consent: true });
  });
});
