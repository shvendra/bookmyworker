import { apiClient } from '../client';

// ── Types ─────────────────────────────────────────────────────────────────────
// Mirrors backend/models/PaymentSubmission.js + backend/models/RefundRecord.js.
// See backend/controllers/paymentSubmissionController.js.

export type PaymentMode = 'BankTransfer' | 'Cheque' | 'Cash' | 'UPI' | 'Other';

// NON-NEGOTIABLE COPY RULE (Requirement #16 / plan D7): a PaymentSubmission is
// a CLAIM, not a receipt — the backend's own status field is literally
// "Submitted" until Finance verifies it. The UI must render this state as
// "Pending Verification" (wf_payment_pending_verification) and must NEVER
// imply the invoice has been paid until status === 'Verified'.
export type PaymentSubmissionStatus = 'Submitted' | 'Verified' | 'Rejected';

export interface PaymentSubmission {
  _id: string;
  invoiceId: string;
  clientCompanyId: string;
  amountPaid: number;
  paymentDate: string;
  paymentMode: PaymentMode;
  utrOrTransactionRef: string;
  proofFileUrl: string;
  remarks?: string;
  status: PaymentSubmissionStatus;
  submittedByUserId?: string;
  verifiedAt?: string;
  actualAmountReconciled?: number;
  verificationNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubmitPaymentPayload {
  invoiceId: string;
  amountPaid: number;
  paymentDate: string; // ISO date string
  paymentMode: PaymentMode;
  utrOrTransactionRef: string;
  remarks?: string;
  fileUri: string; // local file URI from document/image picker
  fileName: string;
  mimeType: string;
}

export interface RefundRecord {
  _id: string;
  invoiceId: string;
  clientCompanyId: string;
  amount: number;
  reference?: string;
  note?: string;
  createdAt?: string;
}

export interface CompanyLedgerRow {
  invoiceId: string;
  invoiceNumber?: string;
  totalAmount: number;
  status: string;
  verifiedPaid: number;
  refunded: number;
  outstanding: number;
}

export interface CompanyLedger {
  creditBalance: number;
  totalInvoiced: number;
  totalVerifiedPaid: number;
  totalOutstanding: number;
  rows: CompanyLedgerRow[];
}

// ── API methods ───────────────────────────────────────────────────────────────

export const paymentSubmissionsApi = {
  // Employer-owner only. Multipart upload — the backend reads the file as
  // req.files?.document (see submitPayment in paymentSubmissionController.js),
  // same field-name convention as documentApi.ts's upload().
  submit: async (payload: SubmitPaymentPayload): Promise<PaymentSubmission> => {
    const form = new FormData();
    form.append('invoiceId', payload.invoiceId);
    form.append('amountPaid', String(payload.amountPaid));
    form.append('paymentDate', payload.paymentDate);
    form.append('paymentMode', payload.paymentMode);
    form.append('utrOrTransactionRef', payload.utrOrTransactionRef);
    if (payload.remarks) form.append('remarks', payload.remarks);
    // React Native FormData appends files as { uri, name, type }
    form.append('document', {
      uri: payload.fileUri,
      name: payload.fileName,
      type: payload.mimeType,
    } as unknown as Blob);

    const res = await apiClient.post<{ success: boolean; submission: PaymentSubmission }>(
      '/api/v1/payment-submissions',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.submission;
  },

  // Owner Employer OR CRM (inline check server-side).
  listForInvoice: (invoiceId: string) =>
    apiClient
      .get<{ success: boolean; submissions: PaymentSubmission[] }>('/api/v1/payment-submissions', {
        params: { invoiceId },
      })
      .then((r) => r.data.submissions ?? []),

  listRefunds: (invoiceId: string) =>
    apiClient
      .get<{ success: boolean; refunds: RefundRecord[] }>('/api/v1/payment-submissions/refunds', {
        params: { invoiceId },
      })
      .then((r) => r.data.refunds ?? []),

  // The "reconciliation ledger" — derived on read server-side, never a stored
  // entity. Powers the Invoiced/Verified Paid/Outstanding/Credit Balance strip.
  getLedger: (clientCompanyId: string) =>
    apiClient
      .get<{ success: boolean } & CompanyLedger>('/api/v1/payment-submissions/ledger', {
        params: { clientCompanyId },
      })
      .then((r) => r.data),
};
