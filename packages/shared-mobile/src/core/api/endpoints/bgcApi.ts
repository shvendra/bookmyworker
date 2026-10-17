import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

// Background Verification (police verification) — employer side. Mirrors the
// CRM/website; the server re-computes every price and is the authority.

export interface BgcPriceTier { name?: string; minWorkers: number; maxWorkers?: number; pricePerWorker: number; priceMax?: number; contractOnly?: boolean }

export interface BgcConfig {
  enabled: boolean;
  headline?: string;
  tagline?: string;
  benefits?: string[];
  promo?: { headline: string; subline: string; cta: string };
  pricePerWorker?: number;
  mrpPerWorker?: number;
  gstPercent?: number;
  turnaroundMinDays?: number;
  turnaroundMaxDays?: number;
  maxWorkersPerOrder?: number;
  bulkDiscounts?: Array<{ minWorkers: number; percent: number }>;
  priceTiers?: BgcPriceTier[];
  startingPrice?: number;
  consentText?: string;
  maxDocsPerWorker?: number;
  docMaxMb?: number;
  requireBuyerKyc?: boolean;
  kycConsentText?: string;
  verifiedCount?: number; // workers already police-verified (SuperAdmin base + real); 0 = show nothing
}

export interface BgcQuote {
  unit: number; count: number; subtotal: number; discountPercent: number; discountAmount: number;
  taxable: number; gstPercent: number; gstAmount: number; total: number;
}

/** "1–10 workers", "201+ workers" */
export const bgcSlabRange = (t: BgcPriceTier): string =>
  `${t.maxWorkers ? (t.maxWorkers === t.minWorkers ? `${t.minWorkers}` : `${t.minWorkers}–${t.maxWorkers}`) : `${t.minWorkers}+`} workers`;
/** "₹299" or, for a range, "₹149–179" */
export const bgcSlabPrice = (t: BgcPriceTier): string => `₹${t.pricePerWorker}${(t.priceMax ?? 0) > t.pricePerWorker ? `–${t.priceMax}` : ''}`;

/** Price for N workers — same maths as the backend (display only). */
export function computeBgcQuote(cfg: BgcConfig | undefined, count: number): BgcQuote {
  const n = Math.max(1, Math.floor(Number(count) || 1));
  // Volume slabs: the whole order is charged at the slab the worker count falls in.
  const slab = (cfg?.priceTiers ?? []).find((t) => n >= t.minWorkers && (!t.maxWorkers || n <= t.maxWorkers));
  const unit = slab ? Number(slab.pricePerWorker) || 0 : Number(cfg?.pricePerWorker) || 0;
  const gstPercent = Number(cfg?.gstPercent) || 0;
  const subtotal = Math.round(unit * n * 100) / 100;
  const tier = cfg?.priceTiers?.length ? undefined : [...(cfg?.bulkDiscounts ?? [])].sort((a, b) => b.minWorkers - a.minWorkers).find((t) => n >= t.minWorkers);
  const discountPercent = tier ? tier.percent : 0;
  const discountAmount = Math.round(subtotal * discountPercent) / 100;
  const taxable = Math.round((subtotal - discountAmount) * 100) / 100;
  const gstAmount = Math.round(taxable * gstPercent) / 100;
  const total = Math.round((taxable + gstAmount) * 100) / 100;
  return { unit, count: n, subtotal, discountPercent, discountAmount, taxable, gstPercent, gstAmount, total };
}

export interface BgcStagedDoc { docRef: string; docType: string; label: string; fileName: string; size: number; mimeType?: string }
export interface BgcKycInfo { required: boolean; status: 'approved' | 'pending' | 'rejected' | 'missing' | 'blocked'; reason?: string; idType?: string; ok: boolean }
export interface BgcPickedFile { uri: string; name: string; mimeType: string; size: number }

export interface BgcWorkerInput {
  userId?: string;
  documents: string[]; // docRefs from uploadDoc()
  name: string; fatherName: string; gender: string; dob: string;
  phone: string; altPhone: string; email: string;
  address: { line: string; block: string; district: string; state: string; pincode: string };
  idType: string; idNumber: string;
}

export interface BgcLookupResult {
  found: boolean;
  worker: null | {
    userId?: string; name?: string; gender?: string; altPhone?: string; email?: string; birthYear?: number | null;
    address?: { line?: string; block?: string; district?: string; state?: string; pincode?: string };
  };
}

export interface BgcCaseDoc {
  _id: string; docType: string; label: string; fileName: string; size: number; mimeType: string; uploadedAt: string;
  uploadedBy: string; status: 'submitted' | 'accepted' | 'rejected'; rejectReason?: string; requestId?: string | null;
}
export interface BgcRequest {
  _id: string; type: 'document' | 'info'; title: string; message: string; docType?: string; docLabel?: string;
  status: 'open' | 'submitted' | 'closed' | 'cancelled'; rejectCount: number; lastRejectReason?: string;
  response?: { text: string; at: string; byName: string } | null;
}

export interface BgcTimelineItem { type: 'status' | 'comment'; status?: string; label?: string; at: string; comment?: string; by?: string }
export interface BgcCase {
  _id: string; caseNumber: string; status: string; statusLabel: string; step: number; customerMessage: string;
  worker: { name?: string; phone?: string };
  timeline: BgcTimelineItem[]; hasCertificate: boolean; expectedBy?: string | null; completedAt?: string | null;
  documents?: BgcCaseDoc[]; requests?: BgcRequest[]; openRequestCount?: number; awaitingReview?: boolean;
}
export interface BgcOrder {
  _id: string; orderNumber: string; createdAt: string; paymentStatus: string; workerCount: number;
  pricing: { total: number }; invoiceNumber: string; hasInvoice: boolean; canPay: boolean; cases: BgcCase[];
}

/** Normalise any failed request: { message, fields } — fields maps "workers.0.name" → message. */
export function bgcError(e: unknown, fallback = 'Something went wrong. Please try again.'): { message: string; fields: Record<string, string> } {
  const err = e as { message?: string; data?: { errors?: unknown }; details?: unknown } | null;
  const raw = (err?.data?.errors ?? err?.details) as unknown;
  const fields = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, string>) : {};
  return { message: err?.message || fallback, fields };
}

const UPLOAD_TIMEOUT = 90_000; // photos on a slow connection take a while

const toPart = (f: BgcPickedFile) => ({ uri: f.uri, name: f.name, type: f.mimeType }) as unknown as Blob;

export const bgcApi = {
  async getConfig(): Promise<BgcConfig> {
    const res = await apiClient.get<{ config?: BgcConfig }>('/api/v1/bgc/config');
    return res.data?.config?.enabled === true ? (res.data.config as BgcConfig) : { enabled: false };
  },
  async lookupWorker(phone: string): Promise<BgcLookupResult> {
    const res = await apiClient.get<BgcLookupResult>('/api/v1/bgc/my/lookup-worker', { params: { phone } });
    return { found: !!res.data?.found, worker: res.data?.worker ?? null };
  },
  async uploadDoc(file: BgcPickedFile, docType: string): Promise<BgcStagedDoc> {
    const fd = new FormData();
    fd.append('file', toPart(file));
    fd.append('docType', docType);
    const res = await apiClient.post<{ document: BgcStagedDoc }>('/api/v1/bgc/my/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: UPLOAD_TIMEOUT });
    return res.data.document;
  },
  async respond(caseId: string, requestId: string, files: BgcPickedFile[], docType: string, text: string): Promise<BgcCase> {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', toPart(f)));
    fd.append('docType', docType);
    if (text.trim()) fd.append('text', text.trim());
    const res = await apiClient.post<{ case: BgcCase }>(`/api/v1/bgc/my/cases/${caseId}/requests/${requestId}/respond`, fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: UPLOAD_TIMEOUT });
    return res.data.case;
  },
  async documentLink(caseId: string, docId: string): Promise<string> {
    const res = await apiClient.get<{ url: string }>(`/api/v1/bgc/my/cases/${caseId}/documents/${docId}/link`);
    return res.data.url;
  },
  async getKyc(): Promise<BgcKycInfo> {
    const res = await apiClient.get<{ kyc: BgcKycInfo }>('/api/v1/bgc/my/kyc');
    return res.data.kyc;
  },
  async createOrder(workers: BgcWorkerInput[]): Promise<{ url: string; merchantOrderId: string; orderNumber: string; total: number }> {
    const res = await apiClient.post('/api/v1/bgc/my/orders', { workers, consent: true });
    return res.data;
  },
  async listOrders(): Promise<BgcOrder[]> {
    const res = await apiClient.get<{ orders?: BgcOrder[] }>('/api/v1/bgc/my/orders', { params: { page: 1, limit: 50 } });
    return res.data?.orders ?? [];
  },
  async payAgain(orderId: string): Promise<{ url: string; merchantOrderId: string }> {
    const res = await apiClient.post(`/api/v1/bgc/my/orders/${orderId}/pay`, {});
    return res.data;
  },
  async invoiceLink(orderId: string): Promise<string> {
    const res = await apiClient.get<{ url: string }>(`/api/v1/bgc/my/orders/${orderId}/invoice-link`);
    return res.data.url;
  },
  async certificateLink(caseId: string): Promise<string> {
    const res = await apiClient.get<{ url: string }>(`/api/v1/bgc/my/cases/${caseId}/certificate-link`);
    return res.data.url;
  },
};

/** Live config — polled like the other SuperAdmin switches so an enable/disable shows up without a restart. */
export function useBgcConfig(enabledByApp = true) {
  const q = useQuery({
    queryKey: ['bgc-config'],
    queryFn: bgcApi.getConfig,
    enabled: enabledByApp,
    staleTime: 15 * 1000,
    refetchInterval: 15 * 1000,
    retry: 1,
  });
  return { config: q.data ?? ({ enabled: false } as BgcConfig), isLoading: q.isLoading };
}
